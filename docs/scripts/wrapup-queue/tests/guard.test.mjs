import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { checkBash, checkWrite, decide } from '../guard.mjs';
import { NODE, SCRIPTS, cleanEnv, run, tmpdir } from './helpers.mjs';

const vault = tmpdir('wrapup-guard-');
fs.mkdirSync(path.join(vault, 'projects'), { recursive: true });

const allowed = (cmd) => assert.doesNotThrow(() => checkBash(cmd, vault), cmd);
const denied = (cmd) => assert.throws(() => checkBash(cmd, vault), undefined, cmd);

test('bash: read-only commands and chains pass', () => {
  for (const cmd of [
    'git log --oneline -5',
    'git --no-pager diff --stat',
    'git -C projects log --since="2026-11-05 10:00" --oneline',
    'qmd query "deploy pipeline" 2>&1',
    'qmd search vendor 2>/dev/null',
    'grep -ri "a\\|b" projects/ | head -20',
    'ls projects; wc -c log.md',
    'cat projects/demo.md && echo done',
    'td task list --filter "search: invoice"',
    'linear --workspace acme issue list --limit 20 | grep -i login',
    'gh issue list --search "login bug"',
    `node ${vault}/docs/scripts/recent-sessions.mjs --hours 12 -k deploy`,
    "grep -n '\\$HOME and {braces} and *.md' log.md",
    'grep -n "\\$1" log.md',
    'git log --format=%h%x20%s -3',
    'find projects -name "*.md" -newer log.md',
    "rg -n 'TODO' research",
    'echo "a > b; c | d"',
    'head -n 2 log.md',
  ]) allowed(cmd);
});

test('bash: writes, execution and shell tricks are denied', () => {
  // Hooks run in the project directory; relative paths must be judged from there.
  const cwd = process.cwd();
  process.chdir(vault);
  fs.mkdirSync(path.join(vault, 'docs', 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(vault, 'docs', 'scripts', 'recent-sessions.mjs'), '');
  for (const cmd of [
    'touch projects/x.md',
    'echo hi > projects/x.md',
    'cat a >> log.md',
    'cat < /etc/passwd',
    'rm -rf projects',
    'find . -name x -delete',
    'find . -exec rm {} \\;',
    'td task add "new task"',
    'linear issue create --title x',
    'gh issue create --title x',
    'git commit -m x',
    'git push',
    'git diff --output=projects/x.md',
    'sort -o log.md log.md',
    'rg --pre ./evil x',
    'echo $(whoami)',
    'echo `whoami`',
    'sleep 100 &',
    '(cd /; ls)',
    'bash -c "ls"',
    'python3 -c "open(\'x\',\'w\')"',
    'node -e "1"',
    'node other.mjs',
    'ls\nrm x',
    'echo "open quote',
    'ls |& cat',
    // found in the cold review 2026-11-05
    'X=/ls touch pwned',
    'PAGER=a/cat rm -rf projects',
    '/tmp/evil/ls',
    './ls',
    'cd projects/x && node docs/scripts/recent-sessions.mjs',
    'node docs/scripts/recent-sessions.mjs',
    `node ${vault}/projects/x/docs/scripts/recent-sessions.mjs`,
    "find . -name x $'-delete'",
    'find . -name x $"-delete"',
    'find . ${X:--delete}',
    'find . -{delete,}',
    'find . -delet?',
    'find . -delet*',
    'find . -[d]elete',
    'ls ~root',
    'echo "$HOME"',
    'sort -uo log.md log.md',
    'sort --outp=log.md x',
    'sort --compress-program=sh x',
    'git diff --outp=projects/x.md',
    'date --se=now',
    'date 202611051200',
    'tail -f log.md',
    'tail --follow log.md',
    'cat =rm',
    'ls || ',
    '',
  ]) denied(cmd);
  process.chdir(cwd);
});

test('write: only inside the vault and only to writable paths', () => {
  assert.equal(checkWrite(path.join(vault, 'projects', 'a', 'b.md'), vault), 'projects/a/b.md');
  assert.equal(checkWrite('log.md', vault), 'log.md');
  assert.equal(checkWrite('docs/wrapup-inbox/2026-11-05-abc.md', vault), 'docs/wrapup-inbox/2026-11-05-abc.md');
  for (const p of ['CLAUDE.md', 'docs/scripts/wrapup-queue/guard.mjs', '.claude/settings.json', '.claude/memory/user.md',
    'meetings/x.md', 'projects/MANIFEST.md', 'research/MANIFEST.md', '../outside.md', '/etc/hosts',
    path.join(vault, '..', 'x.md'), 'projects/../CLAUDE.md', 'log.md.bak', 'projects/manifest.md', 'projects/a/Manifest.MD', '']) {
    assert.throws(() => checkWrite(p, vault), undefined, p);
  }
});

test('write: a symlink inside a writable dir that points outside is denied', () => {
  const outside = tmpdir('wrapup-outside-');
  fs.symlinkSync(outside, path.join(vault, 'projects', 'escape'));
  assert.throws(() => checkWrite('projects/escape/x.md', vault));
});

test('write: a dangling symlink inside a writable dir is denied', () => {
  fs.symlinkSync(path.join(tmpdir('wrapup-gone-'), 'missing', 'target.md'), path.join(vault, 'projects', 'dangling.md'));
  assert.throws(() => checkWrite('projects/dangling.md', vault));
});

test('decide: inactive outside the job, tools outside the list are denied in the job', () => {
  assert.equal(decide({ tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }, {}).allow, true);
  const env = { BRAIN_WRAPUP_JOB: '1', WRAPUP_VAULT: vault };
  for (const tool of ['Agent', 'Skill', 'WebFetch', 'WebSearch', 'mcp__todoist__add_task']) {
    assert.equal(decide({ tool_name: tool, tool_input: {} }, env).allow, false, tool);
  }
  for (const tool of ['Read', 'Glob', 'Grep']) assert.equal(decide({ tool_name: tool, tool_input: {} }, env).allow, true);
  assert.equal(decide({ tool_name: 'Edit', tool_input: { file_path: 'projects/x.md' } }, env).touched, 'projects/x.md');
});

test('hook process: prints a deny and records allowed writes', () => {
  const touched = path.join(vault, 'touched');
  fs.writeFileSync(touched, '');
  const env = cleanEnv({ BRAIN_WRAPUP_JOB: '1', WRAPUP_VAULT: vault, WRAPUP_TOUCHED: touched });
  const guard = path.join(SCRIPTS, 'wrapup-queue', 'guard.mjs');
  const deny = run(NODE, [guard], { env, input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: '/etc/x' } }) });
  assert.equal(deny.code, 0);
  assert.equal(JSON.parse(deny.stdout).hookSpecificOutput.permissionDecision, 'deny');
  const ok = run(NODE, [guard], { env, input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: `${vault}/projects/new.md` } }) });
  assert.equal(ok.code, 0);
  // An explicit allow: the guard is the permission authority, so the job works in default mode.
  assert.equal(JSON.parse(ok.stdout).hookSpecificOutput.permissionDecision, 'allow');
  assert.equal(fs.readFileSync(touched, 'utf8'), 'projects/new.md\n');
  // Every call is counted, so the worker can tell that the guard ran.
  assert.equal(fs.readFileSync(`${touched}.guard`, 'utf8').trim().split('\n').length, 2);
  const bad = run(NODE, [guard], { env, input: 'not json' });
  assert.equal(JSON.parse(bad.stdout).hookSpecificOutput.permissionDecision, 'deny');
  const off = run(NODE, [guard], { env: cleanEnv(), input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'rm x' } }) });
  assert.equal(off.stdout, '');
});
