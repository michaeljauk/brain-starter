#!/usr/bin/env node
// SessionEnd hook: put one wrap-up job into the queue and exit. Nothing else.
//
// Claude Code ends SessionEnd hooks before slow work finishes, so this hook never runs `claude`.
// The worker (worker.mjs) does the wrap-up later, when the machine has headroom.
//
// Does nothing until `worker.mjs install` wrote .claude/wrapup-queue/config.json (opt-in).
// Skips, silently and with exit 0:
//   - BRAIN_WRAPUP_JOB=1: the headless wrap-up run itself (recursion guard, layer 1; the prompt
//     marker [brain-wrapup-job] is layer 2, checked by the worker);
//   - CLAUDE_CODE_ENTRYPOINT other than `cli`: `claude -p` runs and SDK agents;
//   - a missing or empty transcript.
// The vault hook and the optional global hook can both fire for one session. The worker merges
// all job files of a session into one run.
//
// Job file: .claude/wrapup-queue/pending/<UTC stamp>-<session id>-<reason>.json. It is written to a
// temp name, then renamed, so the worker never reads a half-written file.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VAULT = path.resolve(HERE, '..', '..', '..');
export const QUEUE = process.env.WRAPUP_QUEUE_DIR || path.join(VAULT, '.claude', 'wrapup-queue');
const TAIL_BYTES = 512 * 1024;
const MESSAGE_LINE = /"type":"(user|assistant)"/;

// uuid of the last user or assistant record: the end of the segment this job covers. Reads only
// the tail of the file, so a 100 MB transcript does not slow the hook down.
export function lastMessageUuid(file) {
  let lines;
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const len = Math.min(size, TAIL_BYTES);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, size - len);
      lines = buf.toString('utf8').split('\n');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    // Test the whole line: in assistant records "type" comes after the message body.
    if (!MESSAGE_LINE.test(lines[i])) continue;
    let rec;
    try { rec = JSON.parse(lines[i]); } catch { continue; } // the first tail line can be cut
    if ((rec.type === 'user' || rec.type === 'assistant') && rec.uuid) return rec.uuid;
  }
  return null;
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(QUEUE, 'config.json'), 'utf8'));
  } catch {
    return null;
  }
}

function stamp(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

export function enqueue(payload, env = process.env) {
  const cfg = readConfig();
  if (!cfg || cfg.enabled === false) return null;
  if (env.BRAIN_WRAPUP_JOB === '1') return null;
  if ((env.CLAUDE_CODE_ENTRYPOINT || 'cli') !== 'cli') return null;
  const sid = String(payload.session_id || '');
  const tpath = String(payload.transcript_path || '');
  if (!/^[0-9a-f-]{36}$/.test(sid)) return null;
  let size;
  try {
    const st = fs.statSync(tpath);
    if (!st.isFile()) return null;
    size = st.size;
  } catch {
    return null;
  }
  if (!size) return null;
  const reason = String(payload.reason || 'other').replace(/[^a-z_]/g, '').slice(0, 30) || 'other';
  const now = new Date();
  const job = {
    v: 1,
    session_id: sid,
    transcript_path: tpath,
    cwd: payload.cwd || '',
    config_dir: env.CLAUDE_CONFIG_DIR || '',
    reason,
    enqueued_at: now.toISOString(),
    enqueued_epoch: Math.floor(now.getTime() / 1000),
    transcript_bytes: size,
    last_uuid: lastMessageUuid(tpath),
  };
  const pending = path.join(QUEUE, 'pending');
  fs.mkdirSync(pending, { recursive: true });
  const name = `${stamp(now)}-${sid}-${reason}.json`;
  const tmp = path.join(QUEUE, `.${name}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(job, null, 1));
  fs.renameSync(tmp, path.join(pending, name));
  return path.join(pending, name);
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let payload = null;
    try { payload = JSON.parse(readStdin()); } catch { /* not JSON: nothing to queue */ }
    if (payload) enqueue(payload, process.env);
  } catch (err) {
    // Never break the user's exit. Leave a trace instead.
    try {
      fs.mkdirSync(QUEUE, { recursive: true });
      fs.appendFileSync(path.join(QUEUE, 'enqueue-errors.log'),
        `${new Date().toISOString()} ${err && err.name}: ${err && err.message}\n`);
    } catch { /* nothing left to do */ }
  }
  process.exitCode = 0;
}
