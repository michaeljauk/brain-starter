#!/usr/bin/env node
// Wrap-up queue worker: runs the headless wrap-up for finished sessions when the machine has room.
// Design and setup: README.md next to this file.
//
//   node docs/scripts/wrapup-queue/worker.mjs install [--global] [--model M] [--no-commit]
//                                                     [--claude PATH] [--print]
//   node docs/scripts/wrapup-queue/worker.mjs uninstall
//   node docs/scripts/wrapup-queue/worker.mjs status
//   node docs/scripts/wrapup-queue/worker.mjs tick        # scheduler entry
//   node docs/scripts/wrapup-queue/worker.mjs dry-run <sid-prefix> --vault <copy of the vault>
//   node docs/scripts/wrapup-queue/worker.mjs requeue <sid-prefix>
//
// Gates per job: never at critical memory pressure, never while the plan reported a usage limit;
// start at normal pressure, or after CAP_WAIT at any pressure below critical. Jobs older than
// BACKLOG_MAX are skipped and land in failed/, so the session start notice shows them. A failed
// run that left nothing in the vault goes back to pending once, RETRY_DELAY later. A run that
// wrote files is never retried: it would file twice. Jobs that a dead worker left in running/
// move to failed/ as "interrupted"; `requeue` puts them back.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUEUE, VAULT, lastMessageUuid } from './enqueue.mjs';
import { WRAPUP_MARKER, findTranscript, iterRecords, segment, shortPath } from '../recent-sessions.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.WRAPUP_HOME || os.homedir(); // tests point this at a temp folder

export const CAP_WAIT = 3 * 3600;
export const BACKLOG_MAX = 24 * 3600;
const MAX_JOBS_PER_TICK = 3;
const JOB_TIMEOUT = 45 * 60;
const MIN_CHARS = 1500; // below this a segment is trivial (a status question, a one-line fix)
const MAX_SEGMENT = 350_000; // ~90k tokens; above it the segment is condensed harder, then cut
const MAX_ATTEMPTS = 2; // first run plus one retry
export const RETRY_DELAY = 15 * 60;
const LIMIT_DELAY = 60 * 60;
const LIMIT_PATTERN = /usage limit|rate limit|limit reached|limit will reset|credit balance is too low/i;
const DONE_STATES = new Set(['done', 'trivial', 'nothing-new']);

const now = () => Date.now() / 1000;
const q = (...p) => path.join(QUEUE, ...p);

let logFile = null;
function log(msg) {
  const d = new Date();
  const line = `${d.toTimeString().slice(0, 8)} ${msg}\n`;
  if (logFile) fs.appendFileSync(logFile, line);
  else process.stdout.write(line);
}

function ensureDirs() {
  for (const d of ['pending', 'running', 'done', 'failed', 'wrapped', 'logs']) {
    fs.mkdirSync(q(d), { recursive: true });
  }
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, obj) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1) + '\n');
  fs.renameSync(tmp, file);
}

export function readConfig() {
  return readJson(q('config.json'));
}

// ---------- gates ----------

// 1 normal, 2 warn, 4 critical (the macOS scale). Unknown counts as warn.
export function pressureLevel(platform = process.platform) {
  if (process.env.WRAPUP_TEST_PRESSURE) return Number(process.env.WRAPUP_TEST_PRESSURE); // tests only
  try {
    if (platform === 'darwin') {
      const out = spawnSync('/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level'],
        { encoding: 'utf8', timeout: 10_000 }).stdout.trim();
      const n = Number(out);
      return [1, 2, 4].includes(n) ? n : 2;
    }
    if (platform === 'linux' && fs.existsSync('/proc/pressure/memory')) {
      // Share of the last 10 s in which some task waited for memory.
      const m = /some avg10=([\d.]+)/.exec(fs.readFileSync('/proc/pressure/memory', 'utf8'));
      if (m) {
        const avg = Number(m[1]);
        return avg < 5 ? 1 : avg < 30 ? 2 : 4;
      }
    }
    const free = os.freemem() / os.totalmem();
    return free > 0.2 ? 1 : free > 0.05 ? 2 : 4;
  } catch {
    return 2;
  }
}

export function gates() {
  const [l1] = os.loadavg();
  const lim = readJson(q('limited.json'), {});
  const until = Number(lim.until_epoch || 0);
  return { load1: Math.round(l1 * 10) / 10, pressure: pressureLevel(), limitedUntil: until > now() ? until : 0 };
}

// Returns run | wait | wait-limited | skip-backlog.
export function decide(age, g) {
  if (age > BACKLOG_MAX) return 'skip-backlog';
  if (g.limitedUntil) return 'wait-limited';
  if (g.pressure >= 4) return 'wait';
  if (g.pressure === 1 || age >= CAP_WAIT) return 'run';
  return 'wait';
}

// ---------- queue ----------

function lock() {
  const d = q('worker.lock.d');
  try {
    fs.mkdirSync(d);
  } catch {
    try {
      const pid = Number(fs.readFileSync(path.join(d, 'pid'), 'utf8').trim());
      process.kill(pid, 0);
      if (now() - fs.statSync(d).mtimeMs / 1000 < JOB_TIMEOUT * MAX_JOBS_PER_TICK + 600) return false;
    } catch { /* owner gone */ }
    fs.rmSync(d, { recursive: true, force: true }); // stale: owner dead or far over its time budget
    try {
      fs.mkdirSync(d);
    } catch {
      return false;
    }
  }
  fs.writeFileSync(path.join(d, 'pid'), String(process.pid));
  return true;
}

function unlock() {
  fs.rmSync(q('worker.lock.d'), { recursive: true, force: true });
}

function jobFiles(dir) {
  try {
    return fs.readdirSync(q(dir)).filter((f) => f.endsWith('.json') && !f.endsWith('.result.json')
      && !f.startsWith('.')).sort().map((f) => q(dir, f));
  } catch {
    return [];
  }
}

// Pending job files grouped by session; the newest job of a session defines the end.
export function pendingGroups() {
  const groups = new Map();
  for (const f of jobFiles('pending')) {
    const job = readJson(f);
    if (!job || !job.session_id) {
      fs.renameSync(f, q('failed', path.basename(f)));
      continue;
    }
    // A requeued job ages from its requeue time, so BACKLOG_MAX does not drop the retry.
    const epoch = job.requeued_epoch || job.enqueued_epoch;
    let g = groups.get(job.session_id);
    if (!g) {
      g = { sid: job.session_id, files: [], first: epoch, job, notBefore: 0 };
      groups.set(job.session_id, g);
    }
    g.files.push(f);
    g.first = Math.min(g.first, epoch);
    if (job.not_before) g.notBefore = Math.max(g.notBefore, job.not_before);
    if (job.enqueued_epoch >= g.job.enqueued_epoch) g.job = job;
  }
  return [...groups.values()].sort((a, b) => a.first - b.first);
}

function watermark(sid) {
  try {
    return fs.readFileSync(q('wrapped', sid), 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function setWatermark(sid, uuid) {
  if (uuid) fs.writeFileSync(q('wrapped', sid), uuid + '\n');
}

function finish(group, status, result) {
  const dest = DONE_STATES.has(status) ? 'done' : 'failed';
  for (const f of group.files) if (fs.existsSync(f)) fs.renameSync(f, q(dest, path.basename(f)));
  Object.assign(result, { status, session_id: group.sid, finished_at: new Date().toISOString() });
  const name = path.basename(group.files[group.files.length - 1]).replace(/\.json$/, '.result.json');
  writeJson(q(dest, name), result);
}

// True if the run failed without a trace in the vault and has an attempt left.
export function retryable(group, result) {
  return 'exit' in result && result.snapshot_ok && !(result.manifest || []).length
    && !(result.touched || []).length && !result.probe_log_entry
    && (group.job.attempts || 1) < MAX_ATTEMPTS;
}

// Moves job files back to pending. count=false is the manual or limit requeue: no attempt used.
export function requeue(files, why, { count = true, delay = RETRY_DELAY } = {}) {
  const t = now();
  for (const f of files) {
    const job = readJson(f);
    if (!job) continue;
    if (count) job.attempts = (job.attempts || 1) + 1;
    job.requeued_epoch = t;
    job.not_before = t + delay;
    job.requeue_reason = why;
    const name = path.basename(f);
    writeJson(q('pending', name), job);
    if (path.resolve(f) !== q('pending', name)) fs.rmSync(f, { force: true });
  }
}

// ---------- vault state ----------

function git(vault, args, opts = {}) {
  return spawnSync('git', args, { cwd: vault, encoding: opts.encoding ?? 'utf8', maxBuffer: 256 << 20, ...opts });
}

export function isGitRepo(vault) {
  const r = git(vault, ['rev-parse', '--show-toplevel']);
  return r.status === 0 && path.resolve(r.stdout.trim()) === fs.realpathSync(vault);
}

// "<sha1>\t<path>" per dirty or untracked path. Content hashes, not only paths: a page that was
// already dirty before the run and that the run appends to is dirty both times. Returns null on error.
export function snapshot(vault) {
  const r = git(vault, ['status', '--porcelain', '-z', '--untracked-files=all'], { encoding: 'buffer' });
  if (r.status !== 0) return null;
  const parts = r.stdout.toString('utf8').split('\0');
  const lines = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (!e) continue;
    const status = e.slice(0, 2);
    const p = e.slice(3);
    if (status[0] === 'R' || status[0] === 'C') i++; // the source path follows as its own record
    const full = path.join(vault, p);
    let digest = 'absent';
    try {
      if (fs.statSync(full).isFile()) digest = crypto.createHash('sha1').update(fs.readFileSync(full)).digest('hex');
    } catch { /* deleted */ }
    lines.push(`${digest}\t${p}`);
  }
  return lines.sort();
}

// Paths whose content changed during the run AND that the job wrote. A path that changed but
// that the job did not write belongs to a parallel session and stays out. A path that was already
// dirty before the run holds uncommitted work of the user; committing the whole file would take
// that work along, so it stays uncommitted too (dirtyBefore), with the job's edit in it.
export function buildManifest(before, after, touched) {
  const b = new Set(before);
  const dirty = new Set(before.map((l) => l.split('\t')[1]));
  const changed = [...new Set(after.filter((l) => !b.has(l)).map((l) => l.split('\t')[1]))].sort();
  const own = new Set(touched);
  return { keep: changed.filter((p) => own.has(p) && !dirty.has(p)),
    dirtyBefore: changed.filter((p) => own.has(p) && dirty.has(p)),
    foreign: changed.filter((p) => !own.has(p)) };
}

// Number of wrap-up entries for this session in log.md. The worker compares the count before and
// after the run: an entry from an earlier segment of the same session must not count.
function logEntries(vault, sid8) {
  let text = '';
  try { text = fs.readFileSync(path.join(vault, 'log.md'), 'utf8'); } catch { return 0; }
  return (text.match(new RegExp(`^## \\[\\d{4}-\\d{2}-\\d{2}\\] wrap-up \\|.*\\(session ${sid8}\\)`, 'gm')) || []).length;
}

function commit(vault, files, sid8) {
  // --no-verify: the message is fixed and conventional, and the commit-msg hook needs pnpm, which
  // the scheduler's PATH usually lacks. --only via pathspec: other staged work stays staged.
  const add = git(vault, ['add', '--', ...files]);
  if (add.status !== 0) return { ok: false, out: add.stderr };
  const c = git(vault, ['commit', '--no-verify', '-q', '-m', `docs(vault): wrap-up session ${sid8}`, '--', ...files]);
  if (c.status !== 0) return { ok: false, out: c.stdout + c.stderr };
  return { ok: true, sha: git(vault, ['rev-parse', '--short', 'HEAD']).stdout.trim() };
}

// ---------- one job ----------

export function prepare(job) {
  const after = watermark(job.session_id);
  if (after && after === job.last_uuid) return { text: '', st: { prompts: 0, chars: 0, reason: 'nothing-new' } };
  let s = segment(job.transcript_path, after, job.last_uuid);
  if (!s.found) {
    // The watermark uuid is not in the file (rewritten transcript). Wrapping from the start would
    // file everything twice; flag it instead.
    return { text: '', st: { prompts: s.prompts, chars: 0, reason: 'watermark-missing' } };
  }
  // The hook found no message uuid in the transcript tail: end at the last message there is now.
  const endUuid = job.last_uuid || s.lastUuid;
  if (s.chars > MAX_SEGMENT) s = segment(job.transcript_path, after, job.last_uuid, 1200, 120);
  let text = s.text;
  const st = { prompts: s.prompts, chars: s.chars, manual_wraps: s.manualWraps, end_uuid: endUuid };
  if (s.chars > MAX_SEGMENT) {
    const head = text.slice(0, MAX_SEGMENT / 5);
    const tail = text.slice(-(MAX_SEGMENT - head.length));
    text = `${head}\n\n[… middle of the session cut by the worker: segment too long …]\n\n${tail}`;
    st.cut = true;
  }
  return { text, st };
}

function titleOf(file) {
  let title = null;
  for (const o of iterRecords(file)) {
    if (o.type === 'ai-title' || o.type === 'custom-title') title = o.customTitle || o.aiTitle || title;
  }
  return title || 'Untitled session';
}

const fwd = (p) => p.split(path.sep).join('/');

function jobSettings(cfg, work) {
  const cmd = `"${fwd(cfg.node || process.execPath)}" "${fwd(path.join(HERE, 'guard.mjs'))}"`;
  const file = path.join(work, 'job-settings.json');
  writeJson(file, { hooks: { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: cmd, timeout: 10 }] }] } });
  return file;
}

function jobEnv(cfg, job, vault, touched) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('CLAUDE_CODE_') || ['CLAUDECODE', 'CLAUDE_CONFIG_DIR', 'NODE_OPTIONS'].includes(k)) continue;
    env[k] = v;
  }
  const extra = [cfg.node, cfg.claude].filter(Boolean).map((p) => path.dirname(p));
  const std = process.platform === 'win32' ? [] : [path.join(HOME, '.local/bin'), '/opt/homebrew/bin',
    '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
  env.PATH = [...new Set([...extra, ...(env.PATH || '').split(path.delimiter).filter(Boolean), ...std])]
    .join(path.delimiter);
  Object.assign(env, { BRAIN_WRAPUP_JOB: '1', WRAPUP_VAULT: vault, WRAPUP_TOUCHED: touched });
  if (job.config_dir) env.CLAUDE_CONFIG_DIR = job.config_dir; // same plan as the session
  return env;
}

export function runClaude(cfg, prompt, args, opts) {
  const bin = cfg.claude || 'claude';
  // A .cmd shim on Windows needs a shell; then every argument is quoted for cmd.exe. The prompt
  // goes in on stdin, so it never meets shell quoting.
  const shell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(bin);
  const r = spawnSync(shell ? `"${bin}"` : bin, shell ? args.map((x) => `"${x}"`) : args, { ...opts, input: prompt, encoding: 'utf8',
    maxBuffer: 64 << 20, timeout: JOB_TIMEOUT * 1000, shell, windowsHide: true });
  if (r.error && r.error.code === 'ETIMEDOUT') return { rc: 124, out: `TIMEOUT after ${JOB_TIMEOUT}s\n${r.stdout || ''}` };
  if (r.error) return { rc: 127, out: `could not start ${bin}: ${r.error.message}` };
  return { rc: r.status ?? 128, out: (r.stdout || '') + (r.stderr || '') };
}

export function runJob(group, vault, cfg, dry) {
  const job = group.job;
  const sid = job.session_id;
  const sid8 = sid.slice(0, 8);
  const { text, st } = prepare(job);
  const result = { segment: st, dry_run: dry, model: cfg.model };
  if (st.reason === 'nothing-new') return ['nothing-new', result];
  if (st.reason === 'watermark-missing') return ['failed', result];
  if (st.prompts === 0 || st.chars < MIN_CHARS) {
    if (!dry) setWatermark(sid, st.end_uuid);
    return ['trivial', result];
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), `wrapup-${sid8}-`));
  const segPath = path.join(work, 'segment.md');
  fs.writeFileSync(segPath, text);
  const touched = path.join(work, 'touched');
  fs.writeFileSync(touched, '');
  const date = new Date(job.enqueued_epoch * 1000);
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const inbox = `docs/wrapup-inbox/${day}-${sid8}.md`;
  const prompt = `${WRAPUP_MARKER} Run the task described in ${fwd(path.join(vault, 'docs/scripts/wrapup-queue/job.md'))}. `
    + 'Read that file in full first and stay inside its hard limits.\n\n'
    + `VAULT: ${fwd(vault)}\nSEGMENT: ${fwd(segPath)}\nSESSION: ${sid}\nCWD: ${job.cwd || ''}\n`
    + `TITLE: ${titleOf(job.transcript_path)}\n`
    + `RANGE: ${job.enqueued_at || ''} (${st.prompts} prompts, ${st.chars} chars)\nINBOX: ${inbox}\n`;
  const useGit = isGitRepo(vault);
  const before = useGit ? snapshot(vault) : [];
  const logBefore = logEntries(vault, sid8);
  const t0 = now();
  // --permission-mode default: the guard answers every call with allow or deny. If the guard does
  // not run (hooks disabled in the user's settings), calls that need a permission are refused.
  const args = ['-p', '--model', cfg.model || 'sonnet', '--settings', jobSettings(cfg, work), '--strict-mcp-config',
    '--permission-mode', 'default'];
  const { rc, out } = runClaude(cfg, prompt, args, { cwd: vault, env: jobEnv(cfg, job, vault, touched) });
  Object.assign(result, { exit: rc, seconds: Math.round(now() - t0), inbox, work_dir: work });
  log(`claude exit ${rc} after ${result.seconds}s\n----- agent report -----\n${out.trim().slice(-6000)}\n-----`);

  const after = useGit ? snapshot(vault) : [];
  result.snapshot_ok = !useGit || (before !== null && after !== null);
  result.touched = [...new Set(fs.readFileSync(touched, 'utf8').split('\n').filter(Boolean))].sort();
  try {
    result.guard_calls = fs.readFileSync(`${touched}.guard`, 'utf8').split('\n').filter(Boolean).length;
  } catch {
    result.guard_calls = 0;
  }
  if (useGit && result.snapshot_ok) {
    const m = buildManifest(before, after, result.touched);
    result.manifest = m.keep;
    if (m.dirtyBefore.length) result.left_uncommitted = m.dirtyBefore;
    for (const p of m.foreign) log(`manifest: left out (changed during the run, not written by this job): ${p}`);
    for (const p of m.dirtyBefore) log(`manifest: left uncommitted (had uncommitted changes before the run): ${p}`);
  } else {
    result.manifest = useGit ? [] : result.touched;
    if (useGit) log('SNAPSHOT FAILED: nothing of this job will be committed');
  }
  // The new log.md entry job.md step 7 requires. An exit code alone proves nothing.
  result.probe_log_entry = logEntries(vault, sid8) > logBefore;
  if (rc !== 0 && LIMIT_PATTERN.test(out)) result.limited = true;
  // Every job reads the segment, so a run without a single guard call ran unguarded.
  const guarded = result.guard_calls > 0;
  if (!guarded) {
    result.error = 'the guard hook saw no tool call: hooks may be disabled in your settings; nothing was committed';
    log(`GUARD DID NOT RUN: ${result.error}`);
  }

  if (dry) return [rc === 0 && result.probe_log_entry && guarded ? 'done' : 'failed', result];

  let committed = true;
  if (guarded && cfg.commit !== false && useGit && result.manifest.length && result.snapshot_ok) {
    const c = commit(vault, result.manifest, sid8);
    result.commit = c.ok ? c.sha : `failed: ${String(c.out).trim().slice(-500)}`;
    committed = c.ok;
    log(c.ok ? `committed ${c.sha}: ${result.manifest.join(', ')}` : `COMMIT FAILED: ${c.out}`);
  }
  if (rc === 0 && result.probe_log_entry && guarded && committed) {
    setWatermark(sid, st.end_uuid);
    fs.rmSync(work, { recursive: true, force: true });
    return ['done', result];
  }
  return ['failed', result];
}

// ---------- inbox ----------

export function inboxSummary(vault) {
  const dir = path.join(vault, 'docs', 'wrapup-inbox');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort(); } catch { return { files: [], proposals: 0 }; }
  const out = [];
  let proposals = 0;
  for (const f of files) {
    const body = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!/^status:\s*open\s*$/m.test(body)) continue;
    const open = body.split(/^## Filed/m)[0];
    const n = (open.match(/^\|\s*\d+\s*\|/gm) || []).length + (open.match(/^- /gm) || []).length;
    out.push({ file: `docs/wrapup-inbox/${f}`, n });
    proposals += n;
  }
  return { files: out, proposals };
}

// ---------- commands ----------

function cmdTick() {
  const cfg = readConfig();
  if (!cfg || cfg.enabled === false) return 0;
  ensureDirs();
  if (!lock()) return 0;
  const d = new Date();
  logFile = q('logs', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.log`);
  try {
    try { os.setPriority(os.constants.priority.PRIORITY_LOW); } catch { /* best effort */ }
    recoverRunning();
    const groups = pendingGroups();
    if (!groups.length) return 0;
    let g = gates();
    log(`=== tick: ${groups.length} session(s) pending · load ${g.load1} · pressure ${g.pressure}`);
    let ran = 0;
    for (const group of groups) {
      if (ran >= MAX_JOBS_PER_TICK) break;
      const decision = decide(now() - group.first, g);
      if (decision === 'skip-backlog') {
        finish(group, 'skip-backlog', { age_h: Math.round((now() - group.first) / 360) / 10 });
        log(`${group.sid.slice(0, 8)}: skip-backlog`);
        continue;
      }
      if (now() < group.notBefore) continue; // a retry waits; it does not block younger sessions
      if (decision !== 'run') {
        log(`${group.sid.slice(0, 8)}: ${decision}`);
        break; // oldest first: do not overtake a waiting job
      }
      group.files = group.files.map((f) => {
        const dest = q('running', path.basename(f));
        fs.renameSync(f, dest);
        return dest;
      });
      log(`--- ${group.sid.slice(0, 8)} (${shortPath(group.job.cwd)})`);
      let status;
      let result;
      try {
        [status, result] = runJob(group, VAULT, cfg, false);
      } catch (err) {
        [status, result] = ['failed', { error: String(err && err.stack || err) }];
      }
      if (status === 'failed' && result.limited && retryable({ job: { attempts: 0 } }, result)) {
        writeJson(q('limited.json'), { until_epoch: Math.round(now() + LIMIT_DELAY), seen: new Date().toISOString() });
        requeue(group.files, 'usage limit', { count: false, delay: LIMIT_DELAY });
        status = 'wait-limited';
      } else if (status === 'failed' && retryable(group, result)) {
        requeue(group.files, `exit ${result.exit} after ${result.seconds}s, nothing written`);
        status = 'retry';
      } else {
        finish(group, status, result);
      }
      log(`--- ${group.sid.slice(0, 8)}: ${status}`);
      ran += 1;
      if (status === 'wait-limited') break;
      g = gates();
    }
    return 0;
  } finally {
    unlock();
  }
}

// Under the lock, running/ is empty unless an earlier worker died mid-run (reboot, kill, power
// loss). Its run may have written files, so a blind retry could file twice: mark it interrupted
// in failed/, where the session start notice shows it, unless its watermark shows it finished.
function recoverRunning() {
  const groups = new Map();
  for (const f of jobFiles('running')) {
    const job = readJson(f) || {};
    const sid = job.session_id || path.basename(f);
    if (!groups.has(sid)) groups.set(sid, { sid, files: [], job });
    groups.get(sid).files.push(f);
  }
  for (const group of groups.values()) {
    const finished = group.job.last_uuid && watermark(group.sid) === group.job.last_uuid;
    finish(group, finished ? 'done' : 'interrupted', { note: 'found in running/ at the start of a tick' });
    log(`${group.sid.slice(0, 8)}: ${finished ? 'done (found in running/)' : 'interrupted, see failed/ and requeue'}`);
  }
}

function cmdStatus() {
  const cfg = readConfig();
  console.log(`vault: ${VAULT}`);
  if (!cfg || cfg.enabled === false) {
    console.log('wrap-up queue: off. Turn it on with: node docs/scripts/wrapup-queue/worker.mjs install');
    return 0;
  }
  console.log(`wrap-up queue: on · ${cfg.scheduler?.kind || '?'} · model ${cfg.model} · commit ${cfg.commit !== false ? 'on' : 'off'}`
    + ` · global hook ${cfg.globalHook ? 'on' : 'off'}`);
  ensureDirs();
  const g = gates();
  console.log(`load ${g.load1} · pressure ${g.pressure}`
    + (g.limitedUntil ? ` · usage limit until ${new Date(g.limitedUntil * 1000).toLocaleString()}` : ''));
  for (const group of pendingGroups()) {
    const age = now() - group.first;
    let decision = decide(age, g);
    if (now() < group.notBefore) decision = `retry at ${new Date(group.notBefore * 1000).toLocaleTimeString()}`;
    console.log(`pending ${group.sid.slice(0, 8)} ${group.files.length} job(s) age ${(age / 3600).toFixed(1)} h`
      + ` reason ${group.job.reason} cwd ${shortPath(group.job.cwd)} → ${decision}`);
  }
  for (const d of ['running', 'failed']) {
    const n = jobFiles(d).length;
    if (n) console.log(`${d}: ${n} job file(s) in ${q(d)}`);
  }
  const inbox = inboxSummary(VAULT);
  console.log(`inbox: ${inbox.proposals} proposal(s) in ${inbox.files.length} open file(s) · run /wrapup-inbox`);
  return 0;
}

function cmdDryRun(a) {
  if (!a.vault) throw new Error('dry-run needs --vault <copy of the vault>');
  const vault = fs.realpathSync(a.vault);
  if (vault === fs.realpathSync(VAULT)) throw new Error('dry-run: --vault must be a copy, not the real vault');
  const file = findTranscript(a.positional);
  const sid = path.basename(file, '.jsonl');
  const job = { v: 1, session_id: sid, transcript_path: file, cwd: '', config_dir: process.env.CLAUDE_CONFIG_DIR || '',
    reason: 'dry-run', enqueued_at: new Date().toISOString(), enqueued_epoch: Math.floor(now()),
    last_uuid: lastMessageUuid(file) };
  for (const o of iterRecords(file)) {
    if (o.cwd) { job.cwd = o.cwd; break; }
  }
  const cfg = { ...(readConfig() || {}), ...(a.claude ? { claude: a.claude } : {}) };
  cfg.model = a.model || cfg.model || 'sonnet';
  cfg.claude = cfg.claude || findClaude();
  const [status, result] = runJob({ sid, files: [], first: now(), job }, vault, cfg, true);
  result.status = status;
  console.log(JSON.stringify(result, null, 1));
  return status === 'done' || status === 'trivial' ? 0 : 1;
}

function cmdRequeue(a) {
  ensureDirs();
  const files = jobFiles('failed').filter((f) => path.basename(f).slice(17).startsWith(a.positional));
  const sids = new Set(files.map((f) => path.basename(f).slice(17, 53)));
  if (sids.size !== 1) {
    console.log(`need exactly one session for '${a.positional}' in failed/, found ${sids.size}: ${[...sids].join(', ')}`);
    return 1;
  }
  const [sid] = sids;
  requeue(files, 'manual requeue', { count: false, delay: 0 });
  for (const f of fs.readdirSync(q('failed'))) {
    if (f.includes(sid) && f.endsWith('.result.json')) fs.renameSync(q('failed', f), q('failed', f + '.requeued'));
  }
  console.log(`requeued ${files.length} job file(s) of ${sid}`);
  return 0;
}

// ---------- install ----------

function vaultId() {
  return crypto.createHash('sha1').update(fs.realpathSync(VAULT)).digest('hex').slice(0, 8);
}

function findClaude() {
  const candidates = [];
  if (process.platform === 'win32') {
    // `where` can list the extensionless npm shim first; only .exe and .cmd can be started.
    const r = spawnSync('where', ['claude'], { encoding: 'utf8' });
    const rank = (f) => (/\.exe$/i.test(f) ? 0 : /\.cmd$/i.test(f) ? 1 : 9);
    if (r.status === 0) {
      candidates.push(...r.stdout.split(/\r?\n/).filter((f) => rank(f) < 9).sort((x, y) => rank(x) - rank(y)));
    }
  } else {
    const r = spawnSync('/bin/sh', ['-c', 'command -v claude'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim().startsWith('/')) candidates.push(r.stdout.trim());
    candidates.push(path.join(HOME, '.local/bin/claude'), path.join(HOME, '.claude/local/claude'));
  }
  return candidates.find((c) => fs.existsSync(c)) || null;
}

function xml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// The files and commands that start `worker.mjs tick` on this OS.
export function schedulerPlan(platform, node, id) {
  const worker = path.join(HERE, 'worker.mjs');
  const pending = q('pending');
  if (platform === 'darwin') {
    const label = `dev.brain-starter.wrapup-queue.${id}`;
    const file = path.join(HOME, 'Library', 'LaunchAgents', `${label}.plist`);
    const args = ['/usr/sbin/taskpolicy', '-b', node, worker, 'tick'];
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<!-- brain-starter wrap-up queue for ${xml(VAULT)}. Written by worker.mjs install; removed by uninstall. -->
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
${args.map((x) => `        <string>${xml(x)}</string>`).join('\n')}
    </array>
    <key>WatchPaths</key>
    <array>
        <string>${xml(pending)}</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>RunAtLoad</key>
    <false/>
    <key>ProcessType</key>
    <string>Background</string>
    <key>LowPriorityIO</key>
    <true/>
    <key>Nice</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>${xml(q('logs', 'scheduler.out'))}</string>
    <key>StandardErrorPath</key>
    <string>${xml(q('logs', 'scheduler.err'))}</string>
</dict>
</plist>
`;
    const uid = process.getuid ? process.getuid() : 0;
    return { kind: 'launchd', label, files: { [file]: body },
      load: [['launchctl', ['bootstrap', `gui/${uid}`, file]]],
      unload: [['launchctl', ['bootout', `gui/${uid}/${label}`]]] };
  }
  if (platform === 'linux') {
    const unit = `brain-starter-wrapup-${id}`;
    const dir = path.join(HOME, '.config', 'systemd', 'user');
    // systemd expands % specifiers everywhere and $ variables in ExecStart.
    const pct = (s) => String(s).replace(/%/g, '%%');
    const sq = (s) => `"${pct(s).replace(/\$/g, '$$$$').replace(/(["\\])/g, '\\$1')}"`;
    return {
      kind: 'systemd', label: unit,
      files: {
        [path.join(dir, `${unit}.service`)]: `[Unit]
Description=brain-starter wrap-up queue worker for ${pct(VAULT)}

[Service]
Type=oneshot
ExecStart=${sq(node)} ${sq(worker)} tick
Nice=10
IOSchedulingClass=idle
`,
        [path.join(dir, `${unit}.path`)]: `[Unit]
Description=Start the brain-starter wrap-up worker when a job is queued

[Path]
PathChanged=${pct(pending)}
Unit=${unit}.service

[Install]
WantedBy=default.target
`,
        [path.join(dir, `${unit}.timer`)]: `[Unit]
Description=Retry waiting brain-starter wrap-up jobs every 5 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
Unit=${unit}.service

[Install]
WantedBy=timers.target
`,
      },
      load: [['systemctl', ['--user', 'daemon-reload']],
        ['systemctl', ['--user', 'enable', '--now', `${unit}.path`, `${unit}.timer`]]],
      unload: [['systemctl', ['--user', 'disable', '--now', `${unit}.path`, `${unit}.timer`]]],
    };
  }
  if (platform === 'win32') {
    // Task Scheduler has no file watch: it polls every 5 minutes. wscript runs the worker without
    // a console window popping up. WSH reads a .vbs as ANSI unless it is UTF-16 with a BOM, so a
    // non-ASCII user name in the path needs UTF-16.
    const task = `brain-starter wrapup ${id}`;
    const vbs = q('run-worker.vbs');
    const cmd = `""${node}"" ""${worker}"" tick`;
    return {
      kind: 'task-scheduler', label: task,
      files: { [vbs]: Buffer.from(`\ufeff' brain-starter wrap-up queue. Written by worker.mjs install.\r\n`
        + `CreateObject("WScript.Shell").Run "${cmd}", 0, True\r\n`, 'utf16le') },
      load: [['schtasks', ['/Create', '/F', '/SC', 'MINUTE', '/MO', '5', '/TN', task, '/TR', `wscript.exe "${vbs}"`]]],
      unload: [['schtasks', ['/Delete', '/F', '/TN', task]]],
    };
  }
  throw new Error(`no scheduler for platform ${platform}`);
}

function globalSettingsPath() {
  return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude'), 'settings.json');
}

export function globalHookCommand(node) {
  return `"${fwd(node)}" "${fwd(path.join(HERE, 'enqueue.mjs'))}"`;
}

// Adds (on) or removes (off) the SessionEnd hook in a user settings file. Returns a description.
export function setGlobalHook(on, node, file = globalSettingsPath()) {
  const raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '{}';
  const settings = JSON.parse(raw);
  const target = fwd(path.join(HERE, 'enqueue.mjs'));
  const groups = (settings.hooks?.SessionEnd || []).map((g) => ({ ...g,
    hooks: (g.hooks || []).filter((h) => !String(h.command || '').includes(target)) }))
    .filter((g) => g.hooks.length);
  if (on) groups.push({ hooks: [{ type: 'command', command: globalHookCommand(node), timeout: 5 }] });
  settings.hooks = settings.hooks || {};
  if (groups.length) settings.hooks.SessionEnd = groups;
  else delete settings.hooks.SessionEnd;
  if (!Object.keys(settings.hooks).length) delete settings.hooks;
  const next = JSON.stringify(settings, null, 2) + '\n';
  if (next === raw) return `${file}: unchanged`;
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak-wrapup-queue`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  return `${file}: SessionEnd hook ${on ? 'added' : 'removed'} (backup: ${file}.bak-wrapup-queue)`;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { ok: r.status === 0, out: ((r.stdout || '') + (r.stderr || '') + (r.error ? r.error.message : '')).trim() };
}

function cmdInstall(a) {
  const node = process.execPath;
  const claude = a.claude || findClaude();
  if (!claude) throw new Error('could not find the claude CLI. Pass --claude <path>.');
  const plan = schedulerPlan(process.platform, node, vaultId());
  if (a.print) {
    for (const [f, body] of Object.entries(plan.files)) {
      console.log(`# ${f}\n${Buffer.isBuffer(body) ? body.toString('utf16le').replace(/^\ufeff/, '') : body}`);
    }
    for (const [c, args] of plan.load) console.log(`$ ${c} ${args.join(' ')}`);
    if (a.global) console.log(`# SessionEnd hook for ${globalSettingsPath()}: ${globalHookCommand(node)}`);
    return 0;
  }
  const shim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(claude);
  const v = spawnSync(shim ? `"${claude}"` : claude, ['--version'], { encoding: 'utf8', shell: shim });
  if (v.status !== 0) throw new Error(`${claude} --version failed: ${(v.stderr || v.error?.message || '').trim()}`);
  ensureDirs();
  const prev = readConfig() || {};
  // Settings first: if the user's settings file does not parse, stop before anything is on.
  const settingsFiles = new Set(prev.globalSettingsFiles || []);
  const notes = [];
  if (a.global) {
    notes.push(setGlobalHook(true, node));
    settingsFiles.add(globalSettingsPath());
  } else {
    for (const f of settingsFiles) notes.push(setGlobalHook(false, node, f));
    settingsFiles.clear();
  }
  for (const [c, args] of plan.unload) run(c, args); // reinstall: drop the old registration first
  for (const [f, body] of Object.entries(plan.files)) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body);
  }
  if (!a.noLoad) {
    for (const [c, args] of plan.load) {
      const r = run(c, args);
      if (!r.ok) {
        for (const f of Object.keys(plan.files)) fs.rmSync(f, { force: true }); // leave nothing half-installed
        throw new Error(`${c} ${args.join(' ')} failed: ${r.out}`);
      }
    }
  }
  const cfg = { v: 1, enabled: true, node, claude, model: a.model || prev.model || 'sonnet',
    commit: a.noCommit ? false : prev.commit !== false, globalHook: settingsFiles.size > 0,
    globalSettingsFiles: [...settingsFiles],
    scheduler: { kind: plan.kind, label: plan.label, files: Object.keys(plan.files) },
    installed_at: new Date().toISOString() };
  writeJson(q('config.json'), cfg);
  console.log(`wrap-up queue on for ${VAULT}`);
  console.log(`scheduler: ${plan.kind} (${plan.label})${a.noLoad ? ' (files written, not loaded)' : ''}`);
  console.log(`model ${cfg.model} · commit ${cfg.commit ? 'on' : 'off'} · claude ${claude}`);
  for (const n of notes) console.log(n);
  if (!a.global) console.log('hook: sessions in this vault only (add --global for sessions in other folders)');
  else console.log('Using several CLAUDE_CONFIG_DIRs? Run install --global once in each; uninstall cleans all of them.');
  return 0;
}

function cmdUninstall() {
  const cfg = readConfig() || {};
  // The label install recorded: the vault may have moved since, which changes vaultId().
  const recorded = /([0-9a-f]{8})$/.exec((cfg.scheduler && cfg.scheduler.label) || '');
  for (const id of new Set([recorded ? recorded[1] : vaultId(), vaultId()])) {
    const plan = schedulerPlan(process.platform, process.execPath, id);
    for (const [c, args] of plan.unload) run(c, args);
    for (const f of Object.keys(plan.files)) fs.rmSync(f, { force: true });
    if (plan.kind === 'systemd') run('systemctl', ['--user', 'daemon-reload']);
  }
  for (const f of (cfg.scheduler && cfg.scheduler.files) || []) fs.rmSync(f, { force: true });
  const files = new Set(cfg.globalSettingsFiles || []);
  if (cfg.globalHook && !files.size) files.add(globalSettingsPath()); // config from before the list existed
  for (const f of files) {
    try {
      console.log(setGlobalHook(false, process.execPath, f));
    } catch (err) {
      console.log(`${f}: could not remove the SessionEnd hook (${err.message}); remove it by hand`);
    }
  }
  fs.rmSync(q('config.json'), { force: true });
  console.log(`wrap-up queue off for ${VAULT}. Queue data stays in ${QUEUE}.`);
  return 0;
}

function parseArgs(argv) {
  const a = { cmd: argv[0], positional: null };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) throw new Error(`${k} needs a value`);
      return argv[++i];
    };
    if (k === '--global') a.global = true;
    else if (k === '--print') a.print = true;
    else if (k === '--no-commit') a.noCommit = true;
    else if (k === '--no-load') a.noLoad = true;
    else if (k === '--model') a.model = val();
    else if (k === '--claude') a.claude = val();
    else if (k === '--vault') a.vault = val();
    else if (!k.startsWith('-') && a.positional === null) a.positional = k;
    else throw new Error(`unknown argument ${k}`);
  }
  return a;
}

const COMMANDS = { tick: cmdTick, status: cmdStatus, 'dry-run': cmdDryRun, requeue: cmdRequeue,
  install: cmdInstall, uninstall: cmdUninstall };

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const a = parseArgs(process.argv.slice(2));
    const fn = COMMANDS[a.cmd];
    if (!fn) {
      console.error(`usage: worker.mjs ${Object.keys(COMMANDS).join('|')} (see the header of this file)`);
      process.exitCode = 2;
    } else {
      if (['dry-run', 'requeue'].includes(a.cmd) && !a.positional) throw new Error(`${a.cmd} needs a session id prefix`);
      process.exitCode = fn(a);
    }
  } catch (err) {
    console.error(`worker: ${err.message}`);
    process.exitCode = 1;
  }
}
