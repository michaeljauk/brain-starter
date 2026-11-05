import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { NODE, cleanEnv, makeVault, run, tmpdir, writeTranscript } from './helpers.mjs';

// The worker module reads WRAPUP_HOME and WRAPUP_QUEUE_DIR at import time.
const home = tmpdir('wrapup-home-');
process.env.WRAPUP_HOME = home;
delete process.env.CLAUDE_CONFIG_DIR; // never touch the real settings of the session that runs the tests
process.env.WRAPUP_QUEUE_DIR = path.join(home, 'queue');
const W = await import('../worker.mjs');

const g = (pressure, limitedUntil = 0) => ({ load1: 1, pressure, limitedUntil });

test('decide: pressure, wait cap, usage limit and backlog', () => {
  assert.equal(W.decide(60, g(1)), 'run');
  assert.equal(W.decide(60, g(2)), 'wait');
  assert.equal(W.decide(W.CAP_WAIT + 1, g(2)), 'run');
  assert.equal(W.decide(W.CAP_WAIT + 1, g(4)), 'wait');
  assert.equal(W.decide(60, g(1, Date.now() / 1000 + 600)), 'wait-limited');
  assert.equal(W.decide(W.BACKLOG_MAX + 1, g(1)), 'skip-backlog');
});

test('manifest: only paths that changed and that the job wrote, never files dirty before', () => {
  const before = ['aaa\tprojects/a.md', 'bbb\tprojects/dirty.md'];
  const after = ['aaa\tprojects/a.md', 'ccc\tprojects/dirty.md', 'ddd\tlog.md', 'eee\tprojects/other-session.md'];
  const m = W.buildManifest(before, after, ['projects/dirty.md', 'log.md', 'projects/a.md']);
  assert.deepEqual(m.keep, ['log.md']);
  assert.deepEqual(m.dirtyBefore, ['projects/dirty.md']);
  assert.deepEqual(m.foreign, ['projects/other-session.md']);
});

test('retryable: only a run that left no trace and has an attempt left', () => {
  const clean = { exit: 1, snapshot_ok: true, manifest: [], touched: [], probe_log_entry: false };
  assert.equal(W.retryable({ job: {} }, clean), true);
  assert.equal(W.retryable({ job: { attempts: 2 } }, clean), false);
  assert.equal(W.retryable({ job: {} }, { ...clean, touched: ['log.md'] }), false);
  assert.equal(W.retryable({ job: {} }, { ...clean, manifest: ['log.md'] }), false);
  assert.equal(W.retryable({ job: {} }, { ...clean, probe_log_entry: true }), false);
  assert.equal(W.retryable({ job: {} }, { ...clean, snapshot_ok: false }), false);
});

test('scheduler plans for macOS, Linux and Windows', () => {
  const mac = W.schedulerPlan('darwin', '/opt/node/bin/node', 'abcd1234');
  assert.equal(mac.kind, 'launchd');
  const [plist, body] = Object.entries(mac.files)[0];
  assert.ok(plist.startsWith(path.join(home, 'Library', 'LaunchAgents')));
  assert.match(body, /<string>dev\.brain-starter\.wrapup-queue\.abcd1234<\/string>/);
  assert.match(body, /<string>\/opt\/node\/bin\/node<\/string>/);
  assert.match(body, /<key>WatchPaths<\/key>/);
  if (process.platform === 'darwin') {
    fs.writeFileSync(path.join(home, 'lint.plist'), body);
    const lint = run('plutil', ['-lint', path.join(home, 'lint.plist')]);
    assert.equal(lint.code, 0, lint.out);
  }
  const linux = W.schedulerPlan('linux', '/usr/bin/node', 'abcd1234');
  const units = Object.keys(linux.files).map((f) => path.basename(f)).sort();
  assert.deepEqual(units, ['brain-starter-wrapup-abcd1234.path', 'brain-starter-wrapup-abcd1234.service',
    'brain-starter-wrapup-abcd1234.timer']);
  const service = Object.entries(linux.files).find(([f]) => f.endsWith('.service'))[1];
  assert.match(service, /^ExecStart="\/usr\/bin\/node" ".*worker\.mjs" tick$/m);
  assert.match(Object.entries(linux.files).find(([f]) => f.endsWith('.path'))[1], /^PathChanged=.*pending$/m);
  assert.deepEqual(linux.load[1][1].slice(0, 3), ['--user', 'enable', '--now']);
  const win = W.schedulerPlan('win32', 'C:\\node\\node.exe', 'abcd1234');
  assert.equal(win.kind, 'task-scheduler');
  assert.deepEqual(win.load[0][1].slice(0, 6), ['/Create', '/F', '/SC', 'MINUTE', '/MO', '5']);
  assert.match(Object.values(win.files)[0].toString('utf16le'), /WScript\.Shell"\)\.Run """C:\\node\\node\.exe"" "".*worker\.mjs"" tick", 0, True/);
});

test('scheduler plans escape special characters in the vault path', () => {
  const linux = W.schedulerPlan('linux', '/opt/100%/node', 'abcd1234');
  const service = Object.entries(linux.files).find(([f]) => f.endsWith('.service'))[1];
  assert.match(service, /^ExecStart="\/opt\/100%%\/node" /m);
  const win = W.schedulerPlan('win32', 'C:\\Users\\Jürgen\\node.exe', 'abcd1234');
  const vbs = Object.values(win.files)[0];
  assert.ok(Buffer.isBuffer(vbs), 'the .vbs launcher is UTF-16 with BOM, which WSH reads for non-ASCII paths');
  assert.equal(vbs.subarray(0, 2).toString('hex'), 'fffe');
  assert.match(vbs.toString('utf16le'), /Jürgen/);
});

test('global hook: added once, removed again, other hooks stay', () => {
  const file = path.join(home, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const original = { model: 'opus', hooks: { SessionEnd: [{ hooks: [{ type: 'command', command: 'echo mine' }] }],
    Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }] } };
  fs.writeFileSync(file, JSON.stringify(original, null, 2) + '\n');
  W.setGlobalHook(true, '/usr/bin/node');
  W.setGlobalHook(true, '/usr/bin/node');
  const on = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(on.hooks.SessionEnd.length, 2);
  assert.match(on.hooks.SessionEnd[1].hooks[0].command, /enqueue\.mjs"$/);
  assert.ok(fs.existsSync(`${file}.bak-wrapup-queue`));
  W.setGlobalHook(false, '/usr/bin/node');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), original);
  // An explicit settings file (another CLAUDE_CONFIG_DIR) is changed, the default one is not.
  const other = path.join(home, '.claude-work', 'settings.json');
  W.setGlobalHook(true, '/usr/bin/node', other);
  assert.match(fs.readFileSync(other, 'utf8'), /enqueue\.mjs/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), original);
  W.setGlobalHook(false, '/usr/bin/node', other);
  assert.doesNotMatch(fs.readFileSync(other, 'utf8'), /enqueue\.mjs/);
});

test('install --global records every settings file; uninstall cleans all of them', () => {
  const s = setup();
  const worker = path.join(s.vault, 'docs/scripts/wrapup-queue/worker.mjs');
  const h = tmpdir('wrapup-ihome-');
  const a = path.join(h, 'a');
  const b = path.join(h, 'b');
  for (const dir of [a, b]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'settings.json'), '{"model":"opus"}\n');
  }
  const fake = JSON.parse(fs.readFileSync(path.join(s.queue, 'config.json'), 'utf8')).claude;
  const inst = (dir) => run(NODE, [worker, 'install', '--global', '--no-load', '--claude', fake],
    { env: cleanEnv({ WRAPUP_HOME: h, CLAUDE_CONFIG_DIR: dir }) });
  for (const dir of [a, b]) assert.equal(inst(dir).code, 0);
  const cfg = JSON.parse(fs.readFileSync(path.join(s.queue, 'config.json'), 'utf8'));
  assert.deepEqual(cfg.globalSettingsFiles.sort(), [path.join(a, 'settings.json'), path.join(b, 'settings.json')].sort());
  const un = run(NODE, [worker, 'uninstall'], { env: cleanEnv({ WRAPUP_HOME: h, CLAUDE_CONFIG_DIR: a }) });
  assert.equal(un.code, 0, un.out);
  for (const dir of [a, b]) assert.equal(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'), '{\n  "model": "opus"\n}\n');
});

test('install with an unreadable settings file leaves the queue off', () => {
  const s = setup();
  fs.rmSync(path.join(s.queue, 'config.json'));
  const h = tmpdir('wrapup-bad-');
  fs.writeFileSync(path.join(h, 'settings.json'), '{ not json');
  const r = run(NODE, [path.join(s.vault, 'docs/scripts/wrapup-queue/worker.mjs'), 'install', '--global', '--no-load', '--claude', process.execPath],
    { env: cleanEnv({ WRAPUP_HOME: h, CLAUDE_CONFIG_DIR: h }) });
  assert.notEqual(r.code, 0);
  assert.ok(!fs.existsSync(path.join(s.queue, 'config.json')));
});

// ---------- end to end: tick with a fake claude ----------

const FAKE = `#!/usr/bin/env node
const fs = require('fs'); const path = require('path');
if (process.argv.includes('--version')) { console.log('9.9.9 (fake)'); process.exit(0); }
const prompt = fs.readFileSync(0, 'utf8');
const field = (k) => (prompt.match(new RegExp('^' + k + ': (.*)$', 'm')) || [])[1];
const argv = process.argv.slice(2);
const settings = JSON.parse(fs.readFileSync(argv[argv.indexOf('--settings') + 1], 'utf8'));
fs.appendFileSync(process.env.FAKE_CALLS, JSON.stringify({ argv, settings, marker: prompt.startsWith('[brain-wrapup-job]'),
  job: process.env.BRAIN_WRAPUP_JOB, vault: process.env.WRAPUP_VAULT }) + '\\n');
const mode = process.env.FAKE_MODE;
// The real guard counts every tool call; the fake stands in for one Read call.
if (mode !== 'noguard') fs.appendFileSync(process.env.WRAPUP_TOUCHED + '.guard', 'Read\\n');
if (mode === 'fail') { console.log('boom'); process.exit(1); }
if (mode === 'limit') { console.log('Claude usage limit reached. Your limit will reset at 5pm'); process.exit(1); }
const vault = field('VAULT'); const sid8 = field('SESSION').slice(0, 8); const inbox = field('INBOX');
const w = (rel, text, own = true) => { fs.mkdirSync(path.dirname(path.join(vault, rel)), { recursive: true });
  fs.appendFileSync(path.join(vault, rel), text); if (own) fs.appendFileSync(process.env.WRAPUP_TOUCHED, rel + '\\n'); };
w('projects/demo.md', '- status: shipped\\n');
w(inbox, '---\\nstatus: open\\n---\\n## Task proposals\\n| # | Task |\\n|---|---|\\n| 1 | Follow up |\\n');
w('projects/parallel-session.md', 'written by another session\\n', false);
if (mode !== 'nolog') w('log.md', '## [2026-11-05] wrap-up | Demo session (session ' + sid8 + ')\\n');
console.log('filed 2 files');
`;

function setup() {
  const { vault, git } = makeVault();
  const queue = path.join(vault, '.claude', 'wrapup-queue');
  const fake = path.join(vault, '..', `fake-claude-${path.basename(vault)}`);
  fs.writeFileSync(fake, FAKE, { mode: 0o755 });
  fs.mkdirSync(queue, { recursive: true });
  fs.writeFileSync(path.join(queue, 'config.json'), JSON.stringify({ enabled: true, node: NODE, claude: fake, model: 'sonnet' }));
  const calls = path.join(vault, '..', `calls-${path.basename(vault)}.jsonl`);
  fs.writeFileSync(calls, '');
  const env = (extra = {}) => cleanEnv({ WRAPUP_TEST_PRESSURE: '1', FAKE_CALLS: calls, ...extra });
  const enqueue = (transcript, sid, extra = {}) => {
    const r = run(NODE, [path.join(vault, 'docs/scripts/wrapup-queue/enqueue.mjs')], { env: env(),
      input: JSON.stringify({ session_id: sid, transcript_path: transcript, cwd: '/work/demo', reason: 'prompt_input_exit' }) });
    assert.equal(r.code, 0, r.out);
    const pending = path.join(queue, 'pending');
    for (const f of fs.readdirSync(pending)) {
      const p = path.join(pending, f);
      fs.writeFileSync(p, JSON.stringify({ ...JSON.parse(fs.readFileSync(p, 'utf8')), ...extra }));
    }
  };
  const tick = (extra = {}) => {
    const r = run(NODE, [path.join(vault, 'docs/scripts/wrapup-queue/worker.mjs'), 'tick'], { env: env(extra) });
    assert.equal(r.code, 0, r.out);
  };
  const ls = (d) => (fs.existsSync(path.join(queue, d)) ? fs.readdirSync(path.join(queue, d)).sort() : []);
  const callCount = () => fs.readFileSync(calls, 'utf8').split('\n').filter(Boolean).length;
  return { vault, git, queue, enqueue, tick, ls, callCount, calls };
}

const long = 'x'.repeat(1200);
const turns = [['user', `Plan the release. ${long}`], ['assistant', `Here is the plan. ${long}`],
  ['user', 'Ship it and note the status.'], ['assistant', 'Shipped.']];

test('tick: runs the job, commits only its own files, sets the watermark', () => {
  const s = setup();
  const sid = '11111111-2222-3333-4444-555555555555';
  const t = path.join(s.vault, '..', `t-${sid}.jsonl`);
  const recs = writeTranscript(t, turns);
  s.enqueue(t, sid);
  s.tick();
  assert.deepEqual(s.ls('pending'), []);
  const done = s.ls('done');
  assert.equal(done.length, 2, done.join(','));
  const result = JSON.parse(fs.readFileSync(path.join(s.queue, 'done', done.find((f) => f.endsWith('.result.json'))), 'utf8'));
  assert.equal(result.status, 'done');
  assert.equal(result.probe_log_entry, true);
  const call = JSON.parse(fs.readFileSync(s.calls, 'utf8').trim());
  assert.equal(call.marker, true);
  assert.equal(call.job, '1');
  assert.ok(call.argv.includes('--settings') && call.argv.includes('--strict-mcp-config'));
  assert.equal(call.argv[call.argv.indexOf('--permission-mode') + 1], 'default');
  const { settings } = call;
  assert.match(settings.hooks.PreToolUse[0].hooks[0].command, /guard\.mjs"$/);
  const subject = s.git('log', '-1', '--format=%s').trim();
  assert.equal(subject, 'docs(vault): wrap-up session 11111111');
  const files = s.git('show', '--name-only', '--format=', 'HEAD').trim().split('\n').sort();
  assert.deepEqual(files, ['docs/wrapup-inbox/' + result.inbox.split('/').pop(), 'log.md', 'projects/demo.md'].sort());
  assert.match(s.git('status', '--porcelain'), /\?\? projects\/parallel-session\.md/);
  assert.equal(fs.readFileSync(path.join(s.queue, 'wrapped', sid), 'utf8').trim(), recs[recs.length - 1].uuid);
  // The same session ends again without new messages: nothing to do, no second run.
  s.enqueue(t, sid);
  s.tick();
  assert.equal(s.callCount(), 1);
  assert.match(s.ls('done').join(','), /nothing-new|result/);
});

test('tick: a failed run without trace is retried once, then fails', () => {
  const s = setup();
  const sid = '21111111-2222-3333-4444-555555555555';
  const t = path.join(s.vault, '..', `t-${sid}.jsonl`);
  writeTranscript(t, turns);
  s.enqueue(t, sid);
  s.tick({ FAKE_MODE: 'fail' });
  const [p] = s.ls('pending');
  const job = JSON.parse(fs.readFileSync(path.join(s.queue, 'pending', p), 'utf8'));
  assert.equal(job.attempts, 2);
  assert.ok(job.not_before > Date.now() / 1000);
  s.tick({ FAKE_MODE: 'fail' });
  assert.equal(s.callCount(), 1, 'the retry waits RETRY_DELAY');
  fs.writeFileSync(path.join(s.queue, 'pending', p), JSON.stringify({ ...job, not_before: 0 }));
  s.tick({ FAKE_MODE: 'fail' });
  assert.equal(s.callCount(), 2);
  assert.deepEqual(s.ls('pending'), []);
  assert.equal(s.ls('failed').filter((f) => !f.endsWith('.result.json')).length, 1);
});

test('tick: a run that wrote files but no log entry fails without retry', () => {
  const s = setup();
  const sid = '31111111-2222-3333-4444-555555555555';
  const t = path.join(s.vault, '..', `t-${sid}.jsonl`);
  writeTranscript(t, turns);
  s.enqueue(t, sid);
  s.tick({ FAKE_MODE: 'nolog' });
  assert.deepEqual(s.ls('pending'), []);
  assert.equal(s.ls('failed').length, 2);
  assert.ok(!fs.existsSync(path.join(s.queue, 'wrapped', sid)));
});

test('tick: a usage limit pauses the queue without using the retry', () => {
  const s = setup();
  const sid = '41111111-2222-3333-4444-555555555555';
  const t = path.join(s.vault, '..', `t-${sid}.jsonl`);
  writeTranscript(t, turns);
  s.enqueue(t, sid);
  s.tick({ FAKE_MODE: 'limit' });
  const [p] = s.ls('pending');
  const job = JSON.parse(fs.readFileSync(path.join(s.queue, 'pending', p), 'utf8'));
  assert.equal(job.attempts, undefined);
  assert.ok(JSON.parse(fs.readFileSync(path.join(s.queue, 'limited.json'), 'utf8')).until_epoch > Date.now() / 1000);
});

test('tick: trivial, backlog and pressure gates start no claude run', () => {
  const s = setup();
  const t1 = path.join(s.vault, '..', 't-trivial.jsonl');
  writeTranscript(t1, [['user', 'status?'], ['assistant', 'all green']]);
  s.enqueue(t1, '51111111-2222-3333-4444-555555555555');
  s.tick();
  assert.match(fs.readFileSync(path.join(s.queue, 'done', s.ls('done').find((f) => f.endsWith('.result.json'))), 'utf8'), /"trivial"/);
  const t2 = path.join(s.vault, '..', 't-old.jsonl');
  writeTranscript(t2, turns);
  s.enqueue(t2, '61111111-2222-3333-4444-555555555555', { enqueued_epoch: Math.floor(Date.now() / 1000) - 25 * 3600 });
  s.tick();
  // Skipped sessions were never wrapped: they land in failed/, where the session start notice sees them.
  assert.ok(s.ls('failed').some((f) => fs.readFileSync(path.join(s.queue, 'failed', f), 'utf8').includes('skip-backlog')));
  const t3 = path.join(s.vault, '..', 't-busy.jsonl');
  writeTranscript(t3, turns);
  s.enqueue(t3, '71111111-2222-3333-4444-555555555555');
  s.tick({ WRAPUP_TEST_PRESSURE: '2' });
  s.enqueue(t3, '71111111-2222-3333-4444-555555555555', { enqueued_epoch: Math.floor(Date.now() / 1000) - 4 * 3600 });
  s.tick({ WRAPUP_TEST_PRESSURE: '4' });
  // One or two job files (two if the enqueues fell into different seconds), all of that session.
  assert.ok(s.ls('pending').length >= 1 && s.ls('pending').every((f) => f.includes('71111111')));
  assert.equal(s.callCount(), 0);
});

test('tick: does nothing while the queue is off', () => {
  const s = setup();
  fs.rmSync(path.join(s.queue, 'config.json'));
  const t = path.join(s.vault, '..', 't-off.jsonl');
  writeTranscript(t, turns);
  fs.mkdirSync(path.join(s.queue, 'pending'), { recursive: true });
  fs.writeFileSync(path.join(s.queue, 'pending', '20261105T090000Z-81111111-2222-3333-4444-555555555555-other.json'),
    JSON.stringify({ v: 1, session_id: '81111111-2222-3333-4444-555555555555', transcript_path: t, enqueued_epoch: Math.floor(Date.now() / 1000) }));
  s.tick();
  assert.equal(s.ls('pending').length, 1);
  assert.equal(s.callCount(), 0);
});

test('tick: no commit when the guard never ran', () => {
  const s = setup();
  const sid = '91111111-2222-3333-4444-555555555555';
  const t = path.join(s.vault, '..', `t-${sid}.jsonl`);
  writeTranscript(t, turns);
  s.enqueue(t, sid);
  s.tick({ FAKE_MODE: 'noguard' });
  assert.equal(s.git('log', '--oneline').trim().split('\n').length, 1);
  const result = JSON.parse(fs.readFileSync(path.join(s.queue, 'failed', s.ls('failed').find((f) => f.endsWith('.result.json'))), 'utf8'));
  assert.equal(result.guard_calls, 0);
  assert.match(result.error, /guard/);
});

test('tick: a file that was dirty before the run is not committed', () => {
  const s = setup();
  fs.appendFileSync(path.join(s.vault, 'projects', 'demo.md'), 'my unsaved line\n');
  const sid = 'a1111111-2222-3333-4444-555555555555';
  const t = path.join(s.vault, '..', `t-${sid}.jsonl`);
  writeTranscript(t, turns);
  s.enqueue(t, sid);
  s.tick();
  assert.doesNotMatch(s.git('show', '--name-only', '--format=', 'HEAD'), /projects\/demo\.md/);
  assert.match(s.git('status', '--porcelain'), / M projects\/demo\.md/);
});

test('tick: a second segment needs its own log entry', () => {
  const s = setup();
  const sid = 'b1111111-2222-3333-4444-555555555555';
  const t = path.join(s.vault, '..', `t-${sid}.jsonl`);
  writeTranscript(t, turns);
  s.enqueue(t, sid);
  s.tick();
  writeTranscript(t, [['user', `Resumed: one more thing. ${long}`], ['assistant', `Done. ${long}`]], { append: true });
  s.enqueue(t, sid);
  s.tick({ FAKE_MODE: 'nolog' });
  const failed = s.ls('failed').find((f) => f.endsWith('.result.json'));
  const result = JSON.parse(fs.readFileSync(path.join(s.queue, 'failed', failed), 'utf8'));
  assert.equal(result.segment.prompts, 1, 'the second run covers only the resumed part');
  assert.equal(result.probe_log_entry, false);
});

test('tick: jobs left in running/ by a dead worker are not lost', () => {
  const s = setup();
  const sid = 'c1111111-2222-3333-4444-555555555555';
  const t = path.join(s.vault, '..', `t-${sid}.jsonl`);
  writeTranscript(t, turns);
  s.enqueue(t, sid);
  fs.mkdirSync(path.join(s.queue, 'running'), { recursive: true });
  for (const f of s.ls('pending')) fs.renameSync(path.join(s.queue, 'pending', f), path.join(s.queue, 'running', f));
  s.tick();
  assert.deepEqual(s.ls('running'), []);
  assert.match(fs.readFileSync(path.join(s.queue, 'failed', s.ls('failed').find((f) => f.endsWith('.result.json'))), 'utf8'), /"interrupted"/);
});

test('tick: two hooks for one session end give one run', () => {
  const s = setup();
  const sid = 'd1111111-2222-3333-4444-555555555555';
  const t = path.join(s.vault, '..', `t-${sid}.jsonl`);
  writeTranscript(t, turns);
  s.enqueue(t, sid);
  const [f] = s.ls('pending');
  fs.copyFileSync(path.join(s.queue, 'pending', f), path.join(s.queue, 'pending', f.replace('prompt_input_exit', 'other')));
  s.tick();
  assert.equal(s.callCount(), 1);
  assert.equal(s.ls('done').filter((x) => !x.endsWith('.result.json')).length, 2);
});

test('prepare: UI-only records after the watermark are nothing new, not a missing watermark', async () => {
  const s = setup();
  const sid = 'e1111111-2222-3333-4444-555555555555';
  const t = path.join(s.vault, '..', `t-${sid}.jsonl`);
  const recs = writeTranscript(t, [...turns, ['user', '<command-name>/model</command-name>']]);
  fs.mkdirSync(path.join(s.queue, 'wrapped'), { recursive: true });
  fs.writeFileSync(path.join(s.queue, 'wrapped', sid), recs[3].uuid + '\n');
  s.enqueue(t, sid);
  s.tick();
  assert.equal(s.callCount(), 0);
  assert.deepEqual(s.ls('failed'), []);
});

test('tick: a job without last_uuid sets the watermark from the transcript', () => {
  const s = setup();
  const sid = 'f1111111-2222-3333-4444-555555555555';
  const t = path.join(s.vault, '..', `t-${sid}.jsonl`);
  const recs = writeTranscript(t, turns);
  s.enqueue(t, sid, { last_uuid: null });
  s.tick();
  assert.equal(fs.readFileSync(path.join(s.queue, 'wrapped', sid), 'utf8').trim(), recs[recs.length - 1].uuid);
});
