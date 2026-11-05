#!/usr/bin/env node
// recent-sessions: what happened in your Claude Code sessions in the last N hours.
//
// Searches the local transcripts on demand. Nothing is indexed and nothing runs in the background.
// A session can look up recent work of other sessions before the wrap-up queue has processed them.
// Read-only.
//
// Usage:
//   node docs/scripts/recent-sessions.mjs                         # interactive sessions, last 3 h
//   node docs/scripts/recent-sessions.mjs --hours 8 -k deploy     # only sessions that match
//   node docs/scripts/recent-sessions.mjs --cwd my-app            # filter by working directory
//   node docs/scripts/recent-sessions.mjs --all                   # also headless `claude -p` runs
//   node docs/scripts/recent-sessions.mjs --show <sid-prefix>     # condensed transcript of one session
//   node docs/scripts/recent-sessions.mjs --show <sid> --after-uuid <uuid>
//
// Transcripts are read from $CLAUDE_CONFIG_DIR/projects and ~/.claude/projects.
// segment() is also the input of the wrap-up job (docs/scripts/wrapup-queue/worker.mjs).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';

const HOME = os.homedir();

// The headless wrap-up prompt starts with this marker. Sessions that carry it are never queued and
// never listed as work (recursion guard, second layer next to BRAIN_WRAPUP_JOB=1).
export const WRAPUP_MARKER = '[brain-wrapup-job]';

// Records whose content never matters here. The substring test runs before JSON.parse: about half
// of the transcript bytes are request blobs and attachments.
const SKIP_TYPES = ['"type":"attachment"', '"type":"api-request', '"type":"file-history',
  '"type":"queue-operation"', '"type":"mode"', '"type":"permission-mode"', '"type":"last-prompt"',
  '"type":"cost-state"'];

const SYSREM = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
const CMD = /<command-name>(\/?[^<]+)<\/command-name>(?:\s*<command-args>([\s\S]*?)<\/command-args>)?/;
// Slash commands that only change the UI or session state; they say nothing about the work.
const UI_COMMANDS = new Set(['clear', 'exit', 'compact', 'model', 'effort', 'config', 'resume',
  'status', 'cost', 'context', 'fast', 'login', 'logout', 'permissions', 'statusline', 'rename',
  'color']);
const TAG_ONLY = /^\s*<(local-command-caveat|local-command-stdout|task-notification|bash-stdout|bash-stderr)\b/;
const WRAP_PROMPTS = ['/wrap-up', '/wrap-session-up'];
const WRAP_TOOLS = ['Skill: wrap-up', 'Skill: wrap-session-up'];

export function configDirs() {
  const dirs = [process.env.CLAUDE_CONFIG_DIR, path.join(HOME, '.claude')].filter(Boolean);
  const seen = new Set();
  return dirs.filter((d) => {
    let real = d;
    try { real = fs.realpathSync(d); } catch { /* missing dir */ }
    if (seen.has(real)) return false;
    seen.add(real);
    return true;
  });
}

function projectRoots() {
  const seen = new Set();
  const roots = [];
  for (const d of configDirs()) {
    const p = path.join(d, 'projects');
    let real;
    try { real = fs.realpathSync(p); } catch { continue; }
    if (!seen.has(real)) { seen.add(real); roots.push(p); }
  }
  return roots;
}

function transcripts() {
  const out = [];
  for (const root of projectRoots()) {
    for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const full = path.join(root, dir.name);
      for (const f of fs.readdirSync(full)) if (f.endsWith('.jsonl')) out.push(path.join(full, f));
    }
  }
  return out;
}

function pad(n) { return String(n).padStart(2, '0'); }

export function localHm(ts, withDate = false) {
  const d = new Date(ts * 1000);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withDate ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}` : hm;
}

function parseTs(s) {
  const t = Date.parse(s || '');
  return Number.isNaN(t) ? null : t / 1000;
}

// Text a human typed (or a slash command), without tool results and system reminders.
// Returns null for records that carry no human input.
export function userText(content) {
  if (Array.isArray(content)) {
    const parts = content.filter((b) => b && b.type === 'text').map((b) => b.text || '');
    if (!parts.length) return null; // tool_result or image only
    content = parts.join('\n');
  }
  if (typeof content !== 'string') return null;
  const m = CMD.exec(content);
  if (m) {
    if (UI_COMMANDS.has(m[1].replace(/^\//, ''))) return null;
    const args = (m[2] || '').trim();
    return (m[1] + (args ? ' ' + args : '')).trim();
  }
  if (TAG_ONLY.test(content)) return null;
  content = content.replace(SYSREM, '').trim();
  if (content.startsWith('[Request interrupted by user')) return null;
  content = content.replace(/<\/?bash-input>/g, '').trim();
  return content || null;
}

function toolLine(block) {
  const name = block.name || '?';
  const inp = block.input || {};
  const arg = name === 'Skill' ? inp.skill || ''
    : inp.file_path || inp.command || inp.pattern || inp.query || inp.url || inp.description
      || inp.prompt || '';
  return `${name}: ${String(arg).split(/\s+/).filter(Boolean).join(' ')}`;
}

// Lines of a file, read in 1 MB chunks. Transcripts can be hundreds of MB.
function* readLines(file) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(1 << 20);
  const dec = new StringDecoder('utf8');
  let rest = '';
  try {
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (!n) break;
      const parts = (rest + dec.write(buf.subarray(0, n))).split('\n');
      rest = parts.pop();
      yield* parts;
    }
    rest += dec.end();
    if (rest) yield rest;
  } finally {
    fs.closeSync(fd);
  }
}

// Parsed transcript records that can carry content or metadata we use.
export function* iterRecords(file) {
  for (const line of readLines(file)) {
    const head = line.slice(0, 160);
    if (SKIP_TYPES.some((t) => head.includes(t))) continue;
    try { yield JSON.parse(line); } catch { /* cut or broken line */ }
  }
}

// Yields {ts, role, kind, text, rec} for user prompts, assistant text and tool calls.
// kind: 'prompt' | 'text' | 'tool'. Sidechains, meta records and compact summaries are skipped:
// the file keeps the full pre-compaction history anyway. meta, if given, collects title, cwd and
// entrypoint in the same pass.
export function* iterTurns(file, afterUuid = null, untilUuid = null, meta = null, state = {}) {
  let started = afterUuid == null;
  let stopNext = false;
  for (const o of iterRecords(file)) {
    if (meta) {
      if (['ai-title', 'custom-title', 'summary'].includes(o.type)) {
        meta.title = o.customTitle || o.aiTitle || o.summary || meta.title;
      }
      if (!meta.cwd && o.cwd) meta.cwd = o.cwd;
      if (!meta.entrypoint && o.entrypoint) meta.entrypoint = o.entrypoint;
    }
    if (!started) {
      if (o.uuid === afterUuid) {
        started = true;
        state.found = true;
      }
      continue;
    }
    if (stopNext) return;
    if (untilUuid && o.uuid === untilUuid) stopNext = true;
    if (!['user', 'assistant'].includes(o.type) || o.isSidechain || o.isMeta || o.isCompactSummary) {
      continue;
    }
    const ts = parseTs(o.timestamp) || 0;
    const content = (o.message || {}).content;
    if (o.type === 'user') {
      const text = userText(content);
      if (text) yield { ts, role: 'user', kind: 'prompt', text, rec: o };
    } else {
      for (const b of Array.isArray(content) ? content : []) {
        if (!b || typeof b !== 'object') continue;
        if (b.type === 'text' && (b.text || '').trim()) {
          yield { ts, role: 'assistant', kind: 'text', text: b.text.trim(), rec: o };
        } else if (b.type === 'tool_use') {
          yield { ts, role: 'assistant', kind: 'tool', text: toolLine(b), rec: o };
        }
      }
    }
  }
}

function runningSessions() {
  const out = new Set();
  for (const d of configDirs()) {
    let files = [];
    try { files = fs.readdirSync(path.join(d, 'sessions')).filter((f) => f.endsWith('.json')); } catch { continue; }
    for (const f of files) {
      try {
        const s = JSON.parse(fs.readFileSync(path.join(d, 'sessions', f), 'utf8'));
        process.kill(Number(s.pid), 0);
        out.add(s.sessionId);
      } catch { /* not running */ }
    }
  }
  return out;
}

// Length and cut in code points, not UTF-16 units: an emoji counts once and is never split.
const cpLength = (s) => (s.length < 2 ? s.length : [...s].length);
function cut(s, n) {
  return s.length <= n ? s : [...s].slice(0, n).join('');
}

function line(t, maxText, toolWidth) {
  const hm = t.ts ? localHm(t.ts, true) : '--';
  if (t.kind === 'prompt') return `\n## ${hm} USER\n${t.text}`;
  if (t.kind === 'text') {
    return `\n## ${hm} ASSISTANT\n${cut(t.text, maxText)}${cpLength(t.text) > maxText ? ' […]' : ''}`;
  }
  return `- tool ${cut(t.text, toolWidth)}`;
}

// Plain-text replay of a session: prompts in full, assistant text capped, tool calls as one line
// each, tool output left out.
export function condense(file, afterUuid = null, maxText = 4000) {
  const lines = [];
  for (const t of iterTurns(file, afterUuid)) lines.push(line(t, maxText, 300));
  return lines.join('\n').replace(/^\s+/, '');
}

// The part of a session a wrap-up job covers, as condensed text plus counts. A manual /wrap-up
// inside the range resets the segment: everything up to it was wrapped in the session itself, and
// the job starts at the next prompt after it.
export function segment(file, afterUuid = null, untilUuid = null, maxText = 4000, toolWidth = 300) {
  let lines = [];
  let prompts = 0;
  let wraps = 0;
  let lastUuid = null;
  let skipping = false;
  const state = {};
  for (const t of iterTurns(file, afterUuid, untilUuid, null, state)) {
    lastUuid = t.rec.uuid || lastUuid;
    const isWrap = (t.kind === 'prompt' && WRAP_PROMPTS.some((p) => t.text.startsWith(p)))
      || (t.kind === 'tool' && WRAP_TOOLS.includes(t.text));
    if (isWrap) {
      lines = [];
      prompts = 0;
      wraps += 1;
      skipping = true;
      continue;
    }
    if (skipping) {
      if (t.kind !== 'prompt') continue;
      skipping = false;
    }
    if (t.kind === 'prompt') prompts += 1;
    lines.push(line(t, maxText, toolWidth));
  }
  const text = lines.join('\n').replace(/^\s+/, '');
  // found: false only if afterUuid was given and is not in the file (a rewritten transcript).
  return { text, prompts, chars: cpLength(text), manualWraps: wraps, lastUuid, found: afterUuid == null || Boolean(state.found) };
}

function summarize(file, cutoff, patterns) {
  const info = { sid: path.basename(file, '.jsonl'), path: file, cwd: null, entrypoint: null,
    title: null, first: null, last: null, start: null, end: null, turns: 0, wrote: [], hits: [],
    wrapupJob: false, manualWrapup: false };
  for (const t of iterTurns(file, null, null, info)) {
    if (t.kind === 'prompt' && t.text.startsWith(WRAPUP_MARKER)) info.wrapupJob = true;
    if (t.ts < cutoff) continue;
    info.start = info.start || t.ts;
    info.end = t.ts;
    if (t.kind === 'prompt') {
      info.turns += 1;
      info.first = info.first || t.text;
      info.last = t.text;
      if (WRAP_PROMPTS.some((p) => t.text.startsWith(p))) info.manualWrapup = true;
    }
    if (t.kind === 'tool') {
      const [name, ...rest] = t.text.split(': ');
      const arg = rest.join(': ');
      if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(name) && !info.wrote.includes(arg)) {
        info.wrote.push(arg);
      }
      if (WRAP_TOOLS.includes(t.text)) info.manualWrapup = true;
    }
    if (patterns.length && patterns.some((p) => p.test(t.text))) {
      info.hits.push({ ts: t.ts, role: t.role, kind: t.kind, text: t.text });
    }
  }
  return info.turns || info.hits.length ? info : null;
}

function snippet(text, patterns, width = 110) {
  const flat = text.split(/\s+/).filter(Boolean).join(' ');
  for (const p of patterns) {
    const m = p.exec(flat);
    if (m) {
      const a = Math.max(0, m.index - Math.floor(width / 2));
      return (a ? '…' : '') + flat.slice(a, a + width) + (a + width < flat.length ? '…' : '');
    }
  }
  return flat.slice(0, width);
}

export function shortPath(p) {
  if (!p) return '?';
  return p.replace(/\/(private\/)?tmp\/claude-\d+\/[^/]+\/[0-9a-f-]{36}\/scratchpad\//, 'scratchpad/')
    .split(HOME).join('~');
}

export function findTranscript(prefix) {
  const hits = transcripts().filter((f) => path.basename(f).startsWith(prefix));
  if (hits.length !== 1) {
    throw new Error(`recent-sessions: ${hits.length} transcripts match '${prefix}'`
      + hits.slice(0, 10).map((h) => '\n  ' + h).join(''));
  }
  return hits[0];
}

function parseArgs(argv) {
  const a = { hours: 3, keyword: [], cwd: null, all: false, json: false, includeSelf: false,
    show: null, afterUuid: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`recent-sessions: ${k} needs a value`);
      return argv[++i];
    };
    if (k === '--hours') a.hours = Number(next());
    else if (k === '-k' || k === '--keyword') a.keyword.push(next());
    else if (k === '--cwd') a.cwd = next();
    else if (k === '--all') a.all = true;
    else if (k === '--json') a.json = true;
    else if (k === '--include-self') a.includeSelf = true;
    else if (k === '--show') a.show = next();
    else if (k === '--after-uuid') a.afterUuid = next();
    else if (k === '-h' || k === '--help') a.help = true;
    else throw new Error(`recent-sessions: unknown argument ${k}`);
  }
  if (!(a.hours > 0)) throw new Error('recent-sessions: --hours must be a positive number');
  return a;
}

function main(argv) {
  const a = parseArgs(argv);
  if (a.help) {
    console.log('Usage: recent-sessions.mjs [--hours N] [-k REGEX]... [--cwd TEXT] [--all] [--json]'
      + ' [--include-self] [--show SID [--after-uuid UUID]]');
    return 0;
  }
  if (a.show) {
    console.log(condense(findTranscript(a.show), a.afterUuid));
    return 0;
  }
  const cutoff = Date.now() / 1000 - a.hours * 3600;
  const patterns = a.keyword.map((k) => new RegExp(k, 'i'));
  const files = transcripts().filter((f) => fs.statSync(f).mtimeMs / 1000 >= cutoff);
  const running = runningSessions();
  const self = process.env.CLAUDE_CODE_SESSION_ID;
  const rows = [];
  for (const f of files) {
    const info = summarize(f, cutoff, patterns);
    if (!info) continue;
    if (!a.all && (info.entrypoint !== 'cli' || info.wrapupJob)) continue;
    if (!a.includeSelf && info.sid === self) continue;
    if (a.cwd && !(info.cwd || '').toLowerCase().includes(a.cwd.toLowerCase())) continue;
    if (patterns.length && !info.hits.length) continue;
    info.running = running.has(info.sid);
    rows.push(info);
  }
  rows.sort((x, y) => (y.end || 0) - (x.end || 0));
  if (a.json) {
    for (const r of rows) r.hits = r.hits.map((h) => ({ ...h, text: h.text.slice(0, 500) }));
    console.log(JSON.stringify(rows, null, 1));
    return 0;
  }
  const flat = (s, n) => s.split(/\s+/).filter(Boolean).join(' ').slice(0, n);
  for (const r of rows) {
    const tag = r.running ? 'RUN ' : '    ';
    const ep = r.entrypoint === 'cli' ? '' : ` [${r.entrypoint || '?'}]`;
    const wr = r.manualWrapup ? ' [wrapped]' : '';
    console.log(`${localHm(r.start)}-${localHm(r.end)} ${tag}${r.sid.slice(0, 8)}  ${shortPath(r.cwd)}`
      + `  ${r.turns} turns${ep}${wr}  | ${r.title || ''}`);
    if (r.first) console.log(`    first: ${flat(r.first, 160)}`);
    if (r.last && r.last !== r.first) console.log(`    last:  ${flat(r.last, 160)}`);
    if (r.wrote.length) {
      const ws = r.wrote.map(shortPath);
      console.log(`    wrote: ${ws.slice(0, 6).join(', ')}${ws.length > 6 ? ` (+${ws.length - 6})` : ''}`);
    }
    for (const h of r.hits.slice(0, 5)) {
      console.log(`    ${localHm(h.ts)} ${h.role.slice(0, 4)}${h.kind === 'tool' ? '/tool' : ''}: `
        + snippet(h.text, patterns));
    }
    if (r.hits.length > 5) console.log(`    … ${r.hits.length - 5} more hits (--show ${r.sid.slice(0, 8)})`);
  }
  console.error(`\n${rows.length} session(s) in the last ${a.hours} h, ${files.length} transcript(s) scanned.`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 2;
  }
}
