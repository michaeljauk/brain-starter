// Shared fixtures for the wrap-up queue tests.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const NODE = process.execPath;

export function tmpdir(prefix = 'wrapup-test-') {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

export const uuid = () => crypto.randomUUID();

// A transcript as Claude Code writes it: one JSON record per line. turns: [role, text] pairs.
// Assistant records carry "type" after the message body, as in real transcripts.
// append: add to an existing transcript (a resumed session keeps its earlier records and uuids).
export function writeTranscript(file, turns, { cwd = '/work/demo', entrypoint = 'cli', append = false } = {}) {
  const recs = [];
  let ts = Date.parse('2026-11-05T09:00:00Z');
  for (const [role, text] of turns) {
    ts += 60_000;
    const id = uuid();
    if (role === 'user') {
      recs.push({ type: 'user', uuid: id, timestamp: new Date(ts).toISOString(), cwd, entrypoint,
        message: { role: 'user', content: text } });
    } else if (role === 'tool') {
      recs.push({ parentUuid: null, message: { role: 'assistant', content: [{ type: 'tool_use', name: text.name, input: text.input }] },
        uuid: id, timestamp: new Date(ts).toISOString(), type: 'assistant' });
    } else {
      recs.push({ parentUuid: null, message: { role: 'assistant', content: [{ type: 'text', text }] },
        uuid: id, timestamp: new Date(ts).toISOString(), type: 'assistant' });
    }
  }
  if (!append) recs.push({ type: 'ai-title', aiTitle: 'Demo session' });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  (append ? fs.appendFileSync : fs.writeFileSync)(file, recs.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return recs.filter((r) => r.uuid);
}

// A vault with the shipped scripts copied in, as a git repo with one commit.
export function makeVault() {
  const vault = tmpdir('wrapup-vault-');
  fs.cpSync(SCRIPTS, path.join(vault, 'docs', 'scripts'), { recursive: true,
    filter: (src) => !src.includes(`${path.sep}tests${path.sep}`) || src.endsWith('helpers.mjs') });
  for (const d of ['projects', 'research', 'decisions', 'knowledge', '.claude/memory']) {
    fs.mkdirSync(path.join(vault, d), { recursive: true });
  }
  fs.writeFileSync(path.join(vault, '.gitignore'), '.claude/wrapup-queue/\n');
  fs.writeFileSync(path.join(vault, 'projects', 'demo.md'), '# Demo\n');
  const git = (...a) => {
    const r = spawnSync('git', a, { cwd: vault, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`);
    return r.stdout;
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  git('add', '-A');
  git('commit', '-q', '-m', 'chore: initial');
  return { vault, git };
}

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || ''), stdout: r.stdout || '', stderr: r.stderr || '' };
}

// Environment without the variables of the Claude session that runs the tests.
export function cleanEnv(extra = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('CLAUDE_CODE_') || ['CLAUDECODE', 'BRAIN_WRAPUP_JOB', 'WRAPUP_VAULT', 'WRAPUP_TOUCHED',
      'WRAPUP_QUEUE_DIR', 'CLAUDE_PROJECT_DIR', 'CLAUDE_CONFIG_DIR', 'WRAPUP_HOME'].includes(k)) continue;
    env[k] = v;
  }
  return { ...env, ...extra };
}
