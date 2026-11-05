// The session start notice in docs/scripts/brain-starter-check.sh.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { SCRIPTS, cleanEnv, run, tmpdir } from './helpers.mjs';

const CHECK = process.env.CHECK_SCRIPT || path.join(SCRIPTS, 'brain-starter-check.sh');

function vault({ check = false, inbox = [], failed = [] } = {}) {
  const root = tmpdir('wrapup-check-');
  fs.writeFileSync(path.join(root, '.brain-starter.json'),
    JSON.stringify({ repo: 'example/brain-starter', version: '3.9.0', check, checkIntervalDays: 7 }));
  fs.mkdirSync(path.join(root, 'docs', 'wrapup-inbox'), { recursive: true });
  inbox.forEach((status, i) => fs.writeFileSync(path.join(root, 'docs', 'wrapup-inbox', `2026-11-05-${i}.md`), `---\nstatus: ${status}\n---\n`));
  fs.mkdirSync(path.join(root, '.claude', 'wrapup-queue', 'failed'), { recursive: true });
  for (const f of failed) fs.writeFileSync(path.join(root, '.claude', 'wrapup-queue', 'failed', f), '{}');
  return root;
}

function check(root, cache = tmpdir('wrapup-cache-')) {
  const r = run('bash', [CHECK], { env: cleanEnv({ CLAUDE_PROJECT_DIR: root, XDG_CACHE_HOME: cache }) });
  assert.equal(r.code, 0, r.out);
  return r.stdout.trim() ? JSON.parse(r.stdout) : null;
}

test('no inbox, no failed jobs: no output', { skip: process.platform === 'win32' }, () => {
  assert.equal(check(vault({ inbox: ['done'] })), null);
});

test('open inbox files and failed jobs are reported, also with "check": false', { skip: process.platform === 'win32' }, () => {
  const cache = tmpdir('wrapup-cache-');
  const root = vault({ inbox: ['open', 'open', 'done'], failed: ['a.json', 'a.result.json', 'b.result.json.requeued'] });
  const out = check(root, cache);
  assert.match(out.systemMessage, /2 open proposal file\(s\), run \/wrapup-inbox\. 1 session\(s\) not wrapped/);
  assert.match(out.hookSpecificOutput.additionalContext, /In your first reply/);
  const again = check(root, cache);
  assert.doesNotMatch(again.hookSpecificOutput.additionalContext, /In your first reply/);
});

test('update notice and inbox notice share one message', { skip: process.platform === 'win32' }, () => {
  const cache = tmpdir('wrapup-cache-');
  fs.mkdirSync(path.join(cache, 'brain-starter'));
  fs.writeFileSync(path.join(cache, 'brain-starter', 'latest-example_brain-starter'), '3.10.0\n');
  const out = check(vault({ check: true, inbox: ['open'] }), cache);
  assert.match(out.systemMessage, /^Wrap-up queue: 1 open proposal file\(s\).* brain-starter 3\.10\.0 is available/);
});
