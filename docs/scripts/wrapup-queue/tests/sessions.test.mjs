import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { segment, userText } from '../../recent-sessions.mjs';
import { tmpdir, writeTranscript } from './helpers.mjs';

const dir = tmpdir('wrapup-sessions-');

test('userText: drops reminders, UI commands and tool results', () => {
  assert.equal(userText('<system-reminder>x</system-reminder>  hello'), 'hello');
  assert.equal(userText('<command-name>/clear</command-name>'), null);
  assert.equal(userText('<command-name>/wrap-up</command-name><command-args></command-args>'), '/wrap-up');
  assert.equal(userText([{ type: 'tool_result', content: 'x' }]), null);
  assert.equal(userText('[Request interrupted by user]'), null);
});

test('segment: starts after the watermark and stops at the end uuid', () => {
  const f = path.join(dir, 'a.jsonl');
  const r = writeTranscript(f, [['user', 'one'], ['assistant', 'a1'], ['user', 'two'], ['assistant', 'a2'],
    ['user', 'three'], ['assistant', 'a3']]);
  const s = segment(f, r[1].uuid, r[3].uuid);
  assert.equal(s.prompts, 1);
  assert.match(s.text, /two/);
  assert.doesNotMatch(s.text, /one|three/);
  assert.equal(s.lastUuid, r[3].uuid);
  assert.equal(segment(f, 'not-in-file').lastUuid, null);
});

test('segment: a manual /wrap-up resets the segment', () => {
  const f = path.join(dir, 'b.jsonl');
  writeTranscript(f, [['user', 'before'], ['assistant', 'x'], ['user', '/wrap-up'],
    ['tool', { name: 'Write', input: { file_path: 'log.md' } }], ['assistant', 'wrapped'], ['user', 'after'], ['assistant', 'y']]);
  const s = segment(f);
  assert.equal(s.manualWraps, 1);
  assert.equal(s.prompts, 1);
  assert.match(s.text, /after/);
  assert.doesNotMatch(s.text, /before|wrapped/);
});
