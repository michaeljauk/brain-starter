import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { NODE, SCRIPTS, cleanEnv, makeVault, run, uuid, writeTranscript } from './helpers.mjs';

const { vault } = makeVault();
const enqueue = path.join(vault, 'docs', 'scripts', 'wrapup-queue', 'enqueue.mjs');
const queue = path.join(vault, '.claude', 'wrapup-queue');
const pending = path.join(queue, 'pending');
const transcript = path.join(vault, 'tmp-transcripts', 'demo.jsonl');
const recs = writeTranscript(transcript, [['user', 'first'], ['assistant', 'answer one'], ['user', 'second'],
  ['assistant', 'answer two']]);
const sid = uuid();

// Two jobs of one session in the same second share a file name; the newer one wins. So each call
// starts with an empty pending/ and expects at most one file.
function fire(payload, env = {}, args = []) {
  fs.rmSync(pending, { recursive: true, force: true });
  const r = run(NODE, [enqueue, ...args], { env: cleanEnv(env), input: typeof payload === 'string' ? payload : JSON.stringify(payload) });
  assert.equal(r.code, 0, r.out);
  const files = fs.existsSync(pending) ? fs.readdirSync(pending) : [];
  assert.ok(files.length <= 1);
  return files.length ? JSON.parse(fs.readFileSync(path.join(pending, files[0]), 'utf8')) : null;
}

const payload = { session_id: sid, transcript_path: transcript, cwd: '/work/demo', reason: 'clear' };

test('no job while the queue is not installed', () => {
  assert.equal(fire(payload), null);
});

test('queues a job with the last message uuid once installed', () => {
  fs.mkdirSync(queue, { recursive: true });
  fs.writeFileSync(path.join(queue, 'config.json'), JSON.stringify({ enabled: true }));
  const job = fire(payload);
  assert.ok(job);
  assert.equal(job.session_id, sid);
  assert.equal(job.reason, 'clear');
  assert.equal(job.last_uuid, recs[recs.length - 1].uuid);
});

test('skips job runs, headless runs, bad input and empty transcripts', () => {
  assert.equal(fire(payload, { BRAIN_WRAPUP_JOB: '1' }), null);
  assert.equal(fire(payload, { CLAUDE_CODE_ENTRYPOINT: 'sdk-cli' }), null);
  assert.equal(fire({ ...payload, session_id: '../../etc' }), null);
  assert.equal(fire({ ...payload, transcript_path: '/nonexistent.jsonl' }), null);
  assert.equal(fire('not json'), null);
  const empty = path.join(vault, 'tmp-transcripts', 'empty.jsonl');
  fs.writeFileSync(empty, '');
  assert.equal(fire({ ...payload, transcript_path: empty }), null);
});

test('the vault hook also queues when a global hook exists (the worker merges both)', () => {
  fs.writeFileSync(path.join(queue, 'config.json'), JSON.stringify({ enabled: true, globalHook: true }));
  assert.ok(fire(payload, {}, ['--from', 'vault']));
  assert.ok(fire(payload));
  fs.writeFileSync(path.join(queue, 'config.json'), JSON.stringify({ enabled: true }));
});

test('the settings hook command runs nothing without config.json', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(SCRIPTS, '..', '..', '.claude', 'settings.json'), 'utf8'));
  // A vault can have its own SessionEnd hooks next to the shipped one.
  const cmd = settings.hooks.SessionEnd.flatMap((g) => g.hooks).map((h) => h.command)
    .find((c) => c.includes('wrapup-queue/enqueue.mjs'));
  assert.ok(cmd, 'no wrap-up SessionEnd hook in .claude/settings.json');
  fs.rmSync(path.join(queue, 'config.json'));
  fs.rmSync(pending, { recursive: true, force: true });
  fs.mkdirSync(pending);
  const before = 0;
  const r = run('bash', ['-c', cmd], { env: cleanEnv({ CLAUDE_PROJECT_DIR: vault }), input: JSON.stringify(payload) });
  assert.equal(r.code, 0);
  assert.equal(fs.readdirSync(pending).length, before);
  fs.writeFileSync(path.join(queue, 'config.json'), JSON.stringify({ enabled: true }));
  run('bash', ['-c', cmd], { env: cleanEnv({ CLAUDE_PROJECT_DIR: vault }), input: JSON.stringify(payload) });
  assert.equal(fs.readdirSync(pending).length, before + 1);
});
