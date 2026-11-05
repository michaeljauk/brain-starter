#!/usr/bin/env node
// PreToolUse hook for the headless wrap-up job: the job's write boundary.
//
// Why a hook and not --allowed-tools: if your settings use `defaultMode: bypassPermissions` or
// allow Write and Bash without a pattern, a headless `claude -p` inherits that, and an allow list
// restricts nothing. A hook's deny applies in every permission mode.
//
// Active only with BRAIN_WRAPUP_JOB=1, so it never touches an interactive session. The worker
// wires it in through a generated settings file. The vault root is WRAPUP_VAULT.
//
// The guard is the job's permission authority. It answers every call with an explicit allow or
// deny, and the worker starts the job with --permission-mode default. So the job works without
// any allow rules in the user's settings, and if the guard does not run, calls that need a
// permission are refused. Each call is also counted in WRAPUP_TOUCHED.guard, and the worker
// refuses to commit a run in which the guard saw nothing.
//
// Rules:
// - Write, Edit, MultiEdit, NotebookEdit: only inside the vault, only under WRITABLE. Each allowed
//   path is appended to WRAPUP_TOUCHED, so the worker commits only what the job wrote.
// - Bash: every link of a chain (| || && ;) must start with a read-only command from the allow
//   list, as a bare name. Redirects only 2>&1 and >/dev/null. No &, subshells, backticks, $( or
//   newlines. No VAR=value prefix. Shell expansions pass only in forms that cannot turn a word into
//   one the guard did not check (see tokenize). gh only against the vault's own repository.
// - Read, Glob, Grep, LS, ToolSearch, TodoWrite: allowed. Everything else (Agent, Skill, Web*,
//   MCP tools) is denied.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Not .claude/memory/: in default permission mode Claude Code refuses writes under .claude/ as
// sensitive, whatever a hook says (seen in a real run on 2026-11-05). Memories are proposals.
export const WRITABLE = ['projects/', 'research/', 'decisions/', 'knowledge/', 'docs/wrapup-inbox/',
  'log.md'];
const READ_TOOLS = new Set(['Read', 'Glob', 'Grep', 'LS', 'ToolSearch', 'TodoWrite']);
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

// Read-only command prefixes. A command matches if its first words equal one of these.
const BASH_PREFIXES = [
  ['git', 'log'], ['git', 'status'], ['git', 'diff'], ['git', 'show'], ['git', 'ls-files'],
  ['git', 'blame'], ['git', 'rev-parse'],
  ['qmd', 'query'], ['qmd', 'search'], ['qmd', 'vsearch'], ['qmd', 'get'], ['qmd', 'multi-get'],
  ['qmd', 'status'],
  ['ls'], ['cat'], ['head'], ['tail'], ['wc'], ['date'], ['grep'], ['rg'], ['sort'], ['cut'],
  ['find'], ['echo'], ['cd'], ['pwd'], ['jq'], ['tr'], ['stat'], ['basename'], ['dirname'],
  ['td', 'task', 'list'], ['td', 'task', 'view'], ['td', 'project', 'list'],
  ['linear', 'issue', 'list'], ['linear', 'issue', 'view'],
  ['acli', 'jira', 'workitem', 'search'], ['acli', 'jira', 'workitem', 'view'],
  ['gh', 'issue', 'list'], ['gh', 'issue', 'view'], ['gh', 'pr', 'list'], ['gh', 'pr', 'view'],
  ['gh', 'search', 'issues'],
];
// Arguments that turn a read-only command into one that writes or runs something. Long options
// can be abbreviated (sort --outp), so they match by prefix; short flags can be combined (-uo).
const BAD_ARGS = {
  find: [/^-(delete|exec|execdir|ok|okdir|fprint|fprint0|fprintf|fls)$/],
  git: [/^--ou/, /^-o$/], // --ou is the shortest unambiguous prefix of --output (--o could be --oneline)
  rg: [/^--pre/],
  sort: [/^-[^-]*o/, /^--[oc]/],
  date: [/^-[^-]*s/, /^--s/, /^[^-+]/], // a bare argument sets the clock (BSD date 202611051200)
  // Another repository or a URL would send the job's text to a place the user does not own.
  gh: [/^-R/, /^--r/, /:\/\//, /github\.com/],
  tail: [/^-[^-]*[fF]/, /^--f/], // follow mode never ends
};
// A $ before one of these is literal, for example a regex anchor in grep "USER$". Outside quotes
// a $ before a quote is not: $'..' and $".." are bash quoting forms that decode to other text.
const DOLLAR_SAFE_NEXT = new Set(['', ' ', '\t', '"', '|', ')', ';']);
const DOLLAR_SAFE_NEXT_UNQUOTED = new Set(['', ' ', '\t', '|', ')', ';']);
const GLOB = new Set(['*', '?', '[']);
const FORBIDDEN_RAW = /[`\n\r]|\$\(/;
const CHAIN_OPS = new Set(['|', '||', '&&', ';']);
const PUNCT = new Set(['(', ')', ';', '<', '>', '|', '&']);

export class Denied extends Error {}

function deny(reason) {
  throw new Denied(reason);
}

// Splits a command like a POSIX shell would for our purposes: quotes and backslashes bind words,
// unquoted runs of ();<>|& become operator tokens. A quoted "a|b" stays one word.
// Shell expansions pass only where the guard still knows the word the shell runs:
// - $ only as a literal (end of word, before a quote, space or |): grep "USER$". $HOME, ${X:--d},
//   $'..' and $".." are denied.
// - * ? [ only after a literal prefix that does not start with -, or after a --long= option:
//   docs/x/*.md, --include=*.md. The expansion keeps that prefix, so it cannot become -delete.
//   A quoted prefix counts ('-delet'* is -delet*), an empty one does not (''*).
// - ~ only as ~/ at the start of a word (the home directory).
// - { } ! and a word that starts with = (zsh turns =rm into /bin/rm) are always denied.
// Measured 2026-11-05: denying every expansion refused 32 of 301 Bash calls of real wrap-up jobs,
// mostly cd ~/dir, *.md globs and grep anchors.
export function tokenize(cmd) {
  const toks = [];
  let word = null;
  let i = 0;
  const flush = () => {
    if (word !== null) toks.push({ v: word, op: false });
    word = null;
  };
  while (i < cmd.length) {
    const c = cmd[i];
    if (c === ' ' || c === '\t') {
      flush();
      i++;
    } else if (PUNCT.has(c)) {
      flush();
      let run = '';
      while (i < cmd.length && PUNCT.has(cmd[i])) run += cmd[i++];
      toks.push({ v: run, op: true });
    } else if (c === "'") {
      const end = cmd.indexOf("'", i + 1);
      if (end < 0) deny('unparsable command: open quote');
      word = (word ?? '') + cmd.slice(i + 1, end);
      i = end + 1;
    } else if (c === '"') {
      let j = i + 1;
      let s = '';
      while (j < cmd.length && cmd[j] !== '"') {
        if (cmd[j] === '\\' && j + 1 < cmd.length && '"\\$`'.includes(cmd[j + 1])) {
          s += cmd[j + 1];
          j += 2;
        } else {
          if (cmd[j] === '$' && !DOLLAR_SAFE_NEXT.has(cmd[j + 1] ?? '')) deny('no $ expansion; use single quotes');
          s += cmd[j++];
        }
      }
      if (j >= cmd.length) deny('unparsable command: open quote');
      word = (word ?? '') + s;
      i = j + 1;
    } else if (c === '\\') {
      word = (word ?? '') + (cmd[i + 1] ?? '');
      i += 2;
    } else {
      if (c === '=' && word === null) deny('a word must not start with an unquoted =');
      if ('{}!'.includes(c)) deny(`unquoted ${JSON.stringify(c)}: put patterns in single quotes`);
      if (c === '~' && !(word === null && ['/', ' ', '\t', undefined].includes(cmd[i + 1]))) {
        deny('~ only as ~/ at the start of a path');
      }
      if (c === '$' && !DOLLAR_SAFE_NEXT_UNQUOTED.has(cmd[i + 1] ?? '')) deny('no $ expansion; use single quotes');
      if (GLOB.has(c)) {
        const prefix = word ?? '';
        if (!prefix || (prefix.startsWith('-') && !(prefix.startsWith('--') && prefix.includes('=')))) {
          deny(`unquoted ${JSON.stringify(c)} after ${JSON.stringify(prefix)}: a glob could expand into an option; quote it`);
        }
      }
      word = (word ?? '') + c;
      i++;
    }
  }
  flush();
  return toks;
}

// The first word must equal an allow-list entry exactly, so a path (./ls, /tmp/x/ls) or a
// VAR=value prefix (X=/ls rm x) never matches.
function normalize(words) {
  const w = words;
  if (w[0] === 'git') {
    // git --no-pager log, git -C <dir> log
    const out = ['git'];
    for (let i = 1; i < w.length; i++) {
      if (out.length === 1 && w[i] === '--no-pager') continue;
      if (out.length === 1 && w[i] === '-C') { i++; continue; }
      out.push(w[i]);
    }
    return out;
  }
  if (w[0] === 'linear' && w[1] === '--workspace') return ['linear', ...w.slice(3)];
  return w;
}

export function checkBash(cmd, vault) {
  if (!cmd.trim()) deny('empty command');
  if (FORBIDDEN_RAW.test(cmd)) deny('no backticks, $( or newlines');
  const toks = tokenize(cmd);
  const segs = [[]];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.op && CHAIN_OPS.has(t.v)) {
      segs.push([]);
      continue;
    }
    // 2>&1 is the tokens "2" ">&" "1"; >/dev/null is ">" "/dev/null".
    let j = i;
    if (!t.op && t.v === '2' && toks[i + 1]?.op && ['>', '>&', '>>'].includes(toks[i + 1].v)) j = i + 1;
    if (toks[j].op && ['>', '>&', '>>'].includes(toks[j].v)) {
      const op = toks[j].v;
      const target = toks[j + 1] && !toks[j + 1].op ? toks[j + 1].v : '';
      if ((op === '>&' && target === '1') || (op === '>' && target === '/dev/null')) {
        i = j + 1;
        continue;
      }
      deny('redirects only as 2>&1 or >/dev/null, never into a file');
    }
    if (t.op) deny(`shell operator ${JSON.stringify(t.v)} is not allowed`);
    segs[segs.length - 1].push(t.v);
  }
  const sessionsScript = path.join(vault, 'docs', 'scripts', 'recent-sessions.mjs');
  for (const raw of segs) {
    if (!raw.length) deny('empty command in a chain');
    const words = normalize(raw);
    // Only the vault's own copy, by absolute path: a relative path depends on the working
    // directory, and the job can write a file of that name under projects/.
    if (words[0] === 'node' && words.length > 1 && path.isAbsolute(words[1])
      && realish(words[1]) === realish(sessionsScript)) {
      continue;
    }
    if (!BASH_PREFIXES.some((p) => p.every((x, k) => words[k] === x))) {
      deny(`'${words.slice(0, 3).join(' ')}' is not on the read-only allow list`);
    }
    for (const re of BAD_ARGS[words[0]] || []) {
      if (words.slice(1).some((a) => re.test(a))) deny(`${words[0]} with a writing or executing flag`);
    }
  }
}

// realpath that also works for a file that does not exist yet: resolve the deepest existing
// ancestor, then append the rest.
function realish(p) {
  let cur = path.resolve(p);
  const rest = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(cur), ...rest);
    } catch {
      let link = false;
      try { link = fs.lstatSync(cur).isSymbolicLink(); } catch { /* does not exist */ }
      if (link) deny(`${cur} is a symlink that points nowhere`);
      const parent = path.dirname(cur);
      if (parent === cur) return path.join(cur, ...rest);
      rest.unshift(path.basename(cur));
      cur = parent;
    }
  }
}

export function checkWrite(file, vault) {
  if (!file) deny('no file path');
  const root = realish(vault);
  const real = realish(path.isAbsolute(file) ? file : path.join(root, file));
  const rel = path.relative(root, real);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    deny(`${file} is outside the vault ${root}. Write only inside the vault.`);
  }
  const posix = rel.split(path.sep).join('/');
  if (path.basename(posix).toLowerCase() === 'manifest.md'
    || !WRITABLE.some((w) => posix === w || (w.endsWith('/') && posix.startsWith(w)))) {
    deny(`${posix} is not writable for this job. Writable: ${WRITABLE.join(', ')}. `
      + 'Propose other changes in the inbox file instead.');
  }
  return posix;
}

export function decide(payload, env = process.env) {
  if (env.BRAIN_WRAPUP_JOB !== '1') return { allow: true };
  const vault = env.WRAPUP_VAULT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const tool = payload.tool_name || '';
  const inp = payload.tool_input || {};
  try {
    if (READ_TOOLS.has(tool)) return { allow: true };
    if (WRITE_TOOLS.has(tool)) {
      return { allow: true, touched: checkWrite(inp.file_path || inp.notebook_path, vault) };
    }
    if (tool === 'Bash') {
      checkBash(String(inp.command || ''), vault);
      return { allow: true };
    }
    deny(`tool ${tool} is not available in the wrap-up job`);
  } catch (err) {
    if (err instanceof Denied) return { allow: false, reason: err.message };
    throw err;
  }
  return { allow: true };
}

function output(decision, reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse',
    permissionDecision: decision, permissionDecisionReason: 'wrap-up job: ' + reason } }) + '\n');
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.BRAIN_WRAPUP_JOB === '1') {
    let payload;
    try {
      payload = JSON.parse(fs.readFileSync(0, 'utf8'));
    } catch {
      payload = null;
    }
    if (process.env.WRAPUP_TOUCHED) {
      try { fs.appendFileSync(`${process.env.WRAPUP_TOUCHED}.guard`, `${payload ? payload.tool_name : '?'}\n`); } catch { /* best effort */ }
    }
    if (!payload) {
      output('deny', 'unreadable hook input');
    } else {
      let d;
      try {
        d = decide(payload);
      } catch (err) {
        d = { allow: false, reason: `guard error: ${err.message}` }; // fail closed
      }
      if (!d.allow) {
        output('deny', d.reason);
      } else {
        if (d.touched && process.env.WRAPUP_TOUCHED) fs.appendFileSync(process.env.WRAPUP_TOUCHED, d.touched + '\n');
        output('allow', 'allowed by the wrap-up guard');
      }
    }
  }
  process.exitCode = 0;
}
