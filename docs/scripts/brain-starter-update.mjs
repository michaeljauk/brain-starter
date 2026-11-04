#!/usr/bin/env node
// brain-starter updater. Used by the update-brain-starter skill.
//
//   node docs/scripts/brain-starter-update.mjs plan  [--from X.Y.Z] [--to X.Y.Z]
//   node docs/scripts/brain-starter-update.mjs apply  --from X.Y.Z   --to X.Y.Z
//
// Downloads the installed release (merge base) and the target release as tarballs from GitHub and
// compares three versions of every template-owned file: base, target and the local copy. Git
// history is not used, so this works for vaults made with "Use this template" and for clones.
//
// plan  prints the changelog and what would happen to each file. Writes nothing in the vault.
// apply creates the branch brain-starter-update/<to>, writes the result and leaves it uncommitted.
//       It never deletes a file and never removes a hook; it lists those as proposals. The one
//       exception: a file the release renamed ("renamed" in .brain-starter.json) moves to its
//       new path, and the old path is removed after the new one is written.
//
// Line endings are compared without CR, so a Windows checkout with core.autocrlf matches the
// release. Merged and new files are written with LF.
//
// Requires node >= 18, git and tar.

import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_REPO = 'michaeljauk/brain-starter';
const MARKER = '.brain-starter.json';
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const SECTION_RE = /^<!-- brain-starter:(begin|end) ([a-z0-9-]+) -->\s*$/;
const HEADING_RE = /^(#{1,6}) /;

let workDir = null;

function fail(message) {
  console.error(`error: ${message}`);
  if (workDir) rmSync(workDir, { recursive: true, force: true });
  process.exit(2);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (command !== 'plan' && command !== 'apply') {
    fail('usage: brain-starter-update.mjs <plan|apply> [--from X.Y.Z] [--to X.Y.Z]');
  }
  const opts = { command };
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];
    if ((key !== '--from' && key !== '--to') || !value) fail(`unknown or incomplete option: ${key}`);
    if (!VERSION_RE.test(value)) fail(`${key} needs a version like 3.8.0, got "${value}"`);
    opts[key.slice(2)] = value;
  }
  // apply must write exactly what plan showed, so it takes both versions explicitly.
  if (command === 'apply' && (!opts.from || !opts.to)) {
    fail('apply needs --from and --to; pass the "from" and "to" values that plan printed');
  }
  return opts;
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// Reads a regular file without following symlinks. Returns null for anything else.
function readOrNull(path) {
  try {
    return lstatSync(path).isFile() ? readFileSync(path) : null;
  } catch {
    return null;
  }
}

// Text with CR LF turned into LF, so a Windows checkout compares equal to the release. Works on
// bytes, so no encoding is assumed. Content with a NUL byte is binary and stays as it is.
function lf(buf) {
  if (buf === null || !buf.includes(13) || buf.includes(0)) return buf;
  const out = Buffer.alloc(buf.length);
  let n = 0;
  for (let i = 0; i < buf.length; i += 1) {
    if (buf[i] === 13 && buf[i + 1] === 10) continue;
    out[n] = buf[i];
    n += 1;
  }
  return out.subarray(0, n);
}

function sameBytes(a, b) {
  if (a === null || b === null) return a === b;
  return a.equals(b);
}

// True if any part of root/rel is a symlink. Writing through it could leave the vault.
function symlinkOnPath(root, rel) {
  let current = root;
  for (const part of rel.split('/')) {
    current = join(current, part);
    try {
      if (lstatSync(current).isSymbolicLink()) return true;
    } catch {
      return false;
    }
  }
  return false;
}

function existsNoFollow(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function listFiles(dir, base = dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else if (entry.isFile()) out.push(relative(base, full).split(sep).join('/'));
  }
  return out;
}

function listLinks(dir, base = dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listLinks(full, base));
    else if (entry.isSymbolicLink()) out.push(relative(base, full).split(sep).join('/'));
  }
  return out;
}

// Quotes a value for a POSIX shell.
function sh(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function removeEmptyDirs(dir) {
  try {
    if (!lstatSync(dir).isDirectory()) return;
  } catch {
    return;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(join(dir, entry.name));
  }
  if (readdirSync(dir).length === 0) rmdirSync(dir);
}

function isOwned(file, owned) {
  return owned.some((entry) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry));
}

function validOwnedList(owned) {
  return (
    Array.isArray(owned) &&
    owned.every((e) => typeof e === 'string' && e && !e.startsWith('/') && !e.split('/').includes('..'))
  );
}

// --- Release download -------------------------------------------------------------------------

async function latestVersion(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'brain-starter-update' },
  });
  if (!res.ok) fail(`GitHub API answered ${res.status} for the latest release of ${repo}`);
  const tag = String((await res.json()).tag_name || '').replace(/^v/, '');
  if (!VERSION_RE.test(tag)) fail(`latest release tag is not a version: "${tag}"`);
  return tag;
}

async function fetchRelease(repo, version) {
  const name = `${version}.tar.gz`;
  const archive = join(workDir, name);
  // Tests point this at a folder of v<version>.tar.gz files instead of GitHub.
  const localDir = process.env.BRAIN_STARTER_TARBALL_DIR;
  if (localDir) {
    const source = join(localDir, `v${version}.tar.gz`);
    if (!existsSync(source)) fail(`no tarball for ${version} in ${localDir}`);
    copyFileSync(source, archive);
  } else {
    const url = `https://codeload.github.com/${repo}/tar.gz/refs/tags/v${version}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'brain-starter-update' } });
    if (!res.ok) fail(`download of ${version} failed (${res.status}): ${url}`);
    writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
  }
  mkdirSync(join(workDir, version));
  // Relative paths: GNU tar in Git Bash reads "C:\..." as a remote host.
  execFileSync('tar', ['-xzf', name, '-C', version, '--strip-components=1'], { cwd: workDir });
  return join(workDir, version);
}

// --- Changelog --------------------------------------------------------------------------------

function changelogBetween(targetDir, from, to) {
  const text = readOrNull(join(targetDir, 'CHANGELOG.md'));
  if (!text) return '(no CHANGELOG.md in the target release)';
  const lines = text.toString('utf8').split('\n');
  const out = [];
  let keep = false;
  for (const line of lines) {
    const m = line.match(/^#{2,3} \[?(\d+\.\d+\.\d+)\]?/);
    if (m) keep = compareVersions(m[1], from) > 0 && compareVersions(m[1], to) <= 0;
    if (keep) out.push(line);
  }
  return out.join('\n').trim() || '(no changelog entries between these versions)';
}

// --- Three-way text merge ---------------------------------------------------------------------

function mergeText(local, base, target, from, to) {
  const dir = mkdtempSync(join(workDir, 'merge-'));
  try {
    const l = join(dir, 'local');
    const b = join(dir, 'base');
    const t = join(dir, 'target');
    writeFileSync(l, local);
    writeFileSync(b, base);
    writeFileSync(t, target);
    const res = spawnSync(
      'git',
      ['merge-file', '-p', '--diff3', '-L', 'yours', '-L', `brain-starter ${from}`, '-L', `brain-starter ${to}`, l, b, t],
      { encoding: 'buffer' },
    );
    if (res.status === null || res.status < 0 || res.status > 127) {
      fail(`git merge-file failed: ${res.stderr?.toString() || res.error}`);
    }
    return { content: res.stdout, conflicts: res.status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- Owned files ------------------------------------------------------------------------------

// renames maps an old folder prefix to its new one, for the renames that happen between base and
// target. A renamed file's base is the old path in the base release; its local copy is the old path
// in the vault as long as the new path does not exist there yet.
function classifyOwned(root, baseDir, targetDir, baseOwned, targetOwned, renames, skip, from, to) {
  const { tracked, ignored } = gitFileSets(root, renames);
  // If a template file in an old folder is a symlink, moving the rest would split the skill
  // across two folders. Such a rename is blocked as a whole and only reported.
  const blocked = new Set(
    Object.keys(renames).filter((o) =>
      listFiles(baseDir).some((f) => f.startsWith(o) && existsNoFollow(join(root, f)) && symlinkOnPath(root, f)),
    ),
  );
  const renameList = Object.entries(renames).filter(([o]) => !blocked.has(o));
  const toNew = (p) => {
    for (const [o, n] of Object.entries(renames)) if (p.startsWith(o)) return n + p.slice(o.length);
    return p;
  };
  const baseFiles = listFiles(baseDir).filter((f) => isOwned(f, [...baseOwned, ...Object.keys(renames)]));
  const targetFiles = listFiles(targetDir).filter((f) => isOwned(f, targetOwned));
  const baseByPath = new Map(baseFiles.map((f) => [toNew(f), f])); // target path -> base path
  const localExists = (p) => existsNoFollow(join(root, p));

  // A folder entry (a skill) the user deleted completely stays deleted, also for files that the
  // release adds to it. For a renamed folder, both the old and the new path count.
  const deletedFolders = targetOwned.filter((entry) => {
    if (!entry.endsWith('/')) return false;
    const inBase = [...baseByPath].filter(([p]) => p.startsWith(entry));
    return inBase.length > 0 && !inBase.some(([p, b]) => localExists(p) || localExists(b));
  });

  const result = [];
  let comparable = 0;
  let localMatchesBase = 0;
  for (const path of [...new Set([...baseByPath.keys(), ...targetFiles])].sort()) {
    if (skip.has(path)) continue;
    const basePath = baseByPath.get(path) ?? null;
    const B = basePath ? lf(readOrNull(join(baseDir, basePath))) : null;
    const T = lf(readOrNull(join(targetDir, path)));
    const oldPath = basePath !== null && basePath !== path ? basePath : null;
    if ([...blocked].some((o) => (oldPath ?? '').startsWith(o) || path.startsWith(renames[o]))) {
      result.push({ path, ...(oldPath ? { oldPath } : {}), action: 'rename-blocked-symlink' });
      continue;
    }
    const moving = oldPath !== null && !localExists(path) && localExists(oldPath);
    const localPath = moving ? oldPath : path;
    const linked = symlinkOnPath(root, localPath);
    const L = linked ? null : lf(readOrNull(join(root, localPath)));
    if (B !== null && !linked) {
      comparable += 1;
      if (sameBytes(L, B)) localMatchesBase += 1;
    }
    if (oldPath && !moving && localExists(path) && localExists(oldPath)) {
      // Both names exist locally. Say whether the old copy holds edits of its own.
      const old = lf(readOrNull(join(root, oldPath)));
      result.push({ path: oldPath, action: sameBytes(old, B) ? 'rename-leftover' : 'rename-leftover-modified' });
    }
    let action;
    if (linked) {
      if (sameBytes(B, T) && !moving) continue;
      action = 'skipped-symlink';
    } else if (moving) {
      // The release renamed this file and the vault still has it under the old name.
      if (T === null) {
        result.push({ path: oldPath, action: sameBytes(L, B) ? 'propose-delete' : 'propose-delete-modified' });
        continue;
      }
      if (sameBytes(B, T) || sameBytes(L, T)) action = 'rename-move';
      else if (sameBytes(L, B)) action = 'rename-update';
      else action = 'rename-merge';
      const entry = { path, oldPath, action, B, T, L, raw: readOrNull(join(root, oldPath)), tracked: tracked.has(oldPath) };
      if (action === 'rename-merge') {
        entry.merged = mergeText(L, B, T, from, to);
        entry.action = entry.merged.conflicts ? 'rename-merge-conflict' : 'rename-merge-clean';
      }
      result.push(entry);
      continue;
    } else if (sameBytes(B, T)) continue; // no upstream change; local edits and deletions stay
    else if (B === null) {
      if (L === null) action = deletedFolders.some((d) => path.startsWith(d)) ? 'keep-deleted' : 'add';
      else action = sameBytes(L, T) ? 'same' : 'added-both';
    } else if (T === null) action = L === null ? 'gone' : sameBytes(L, B) ? 'propose-delete' : 'propose-delete-modified';
    else if (L === null) action = 'keep-deleted';
    else if (sameBytes(L, B)) action = 'update';
    else if (sameBytes(L, T)) action = 'same';
    else action = 'merge';
    if (action === 'gone' || action === 'same') continue;
    const entry = { path, action, B, T, L };
    if (action === 'merge' || action === 'added-both') {
      entry.merged = mergeText(L, B ?? Buffer.alloc(0), T, from, to);
      entry.action = entry.merged.conflicts ? `${action}-conflict` : `${action}-clean`;
    }
    result.push(entry);
  }

  // The user's own files in a renamed folder move along with it. Files git ignores (.DS_Store)
  // and symlinks stay where they are and are reported.
  const handled = new Set(baseFiles);
  for (const [o, n] of renameList) {
    if (symlinkOnPath(root, o.replace(/\/$/, ''))) continue;
    for (const rest of listFiles(join(root, o))) {
      const oldPath = o + rest;
      if (handled.has(oldPath)) continue;
      const path = n + rest;
      let action = 'rename-move-own';
      if (ignored.has(oldPath)) action = 'rename-own-ignored';
      else if (targetFiles.includes(path) || localExists(path)) action = 'rename-own-clash';
      result.push({ path, oldPath, action, raw: readOrNull(join(root, oldPath)), tracked: tracked.has(oldPath) });
    }
    for (const rest of listLinks(join(root, o))) result.push({ path: n + rest, oldPath: o + rest, action: 'rename-own-symlink' });
  }
  return { files: result, comparable, localMatchesBase };
}

// Git's view of the files under the old folders of renames: which are tracked, which ignored.
function gitFileSets(root, renames) {
  const prefixes = Object.keys(renames).filter((o) => existsNoFollow(join(root, o)));
  if (prefixes.length === 0) return { tracked: new Set(), ignored: new Set() };
  const list = (args) => new Set(git(root, ['ls-files', '-z', ...args, '--', ...prefixes]).split('\0').filter(Boolean));
  return { tracked: list([]), ignored: list(['--others', '--ignored', '--exclude-standard']) };
}

// Renames from the target release that happen between base and target: the base release has the
// old folder and not yet the new one.
// A chain of renames (a -> b in one release, b -> c in a later one) resolves to its last name.
// The last name must be an owned folder of the target release.
function activeRenames(targetMarker, baseDir) {
  const out = {};
  const renamed = targetMarker.renamed;
  if (!renamed || typeof renamed !== 'object' || Array.isArray(renamed)) return out;
  const map = {};
  for (const [o, n] of Object.entries(renamed)) {
    if (validOwnedList([o, n]) && o.endsWith('/') && n.endsWith('/') && typeof n === 'string') map[o] = n;
  }
  const baseList = listFiles(baseDir);
  for (const o of Object.keys(map)) {
    const seen = new Set([o]);
    let n = map[o];
    while (map[n] !== undefined && !seen.has(n)) {
      seen.add(n);
      n = map[n];
    }
    if (!baseList.some((f) => f.startsWith(o))) continue; // this vault's release never had it
    if (seen.has(n) || !targetMarker.owned.includes(n)) {
      ignoredRenames.push(o); // a cycle, or not a template folder
      continue;
    }
    if (!baseList.some((f) => f.startsWith(n))) out[o] = n;
  }
  // Two folders renamed into one would overwrite each other's files.
  const targets = Object.values(out);
  for (const [o, n] of Object.entries(out)) {
    if (targets.filter((t) => t === n).length > 1) {
      ignoredRenames.push(o);
      delete out[o];
    }
  }
  return out;
}

const ignoredRenames = [];

// --- settings.json hooks ----------------------------------------------------------------------

function hookEntries(settings) {
  const out = new Map();
  const hooks = settings?.hooks || {};
  for (const [event, groups] of Object.entries(hooks)) {
    for (const group of groups || []) {
      for (const hook of group.hooks || []) {
        const key = JSON.stringify([event, group.matcher ?? '', hook.type, hook.command ?? hook.url ?? hook.prompt ?? '']);
        out.set(key, { event, matcher: group.matcher, hook });
      }
    }
  }
  return out;
}

function describeHook(e) {
  return `${e.event} ${e.matcher ?? ''} ${e.hook.command ?? e.hook.url ?? e.hook.prompt ?? ''}`.replace(/\s+/g, ' ').trim();
}

function mergeSettings(baseText, targetText, localText) {
  const report = { added: [], updated: [], changedUpstream: [], removedUpstream: [], otherKeysChanged: [], error: null, content: null };
  const base = baseText ? JSON.parse(baseText) : {};
  const target = targetText ? JSON.parse(targetText) : {};
  let local;
  try {
    local = JSON.parse(localText);
  } catch (e) {
    report.error = `local .claude/settings.json is not valid JSON: ${e.message}`;
    return report;
  }
  const B = hookEntries(base);
  const T = hookEntries(target);
  const L = hookEntries(local);
  for (const [key, entry] of T) {
    const b = B.get(key);
    const l = L.get(key);
    if (b && JSON.stringify(b.hook) !== JSON.stringify(entry.hook)) {
      // Same hook, other attributes changed upstream (for example the timeout).
      if (l && JSON.stringify(l.hook) === JSON.stringify(b.hook)) {
        for (const k of Object.keys(l.hook)) delete l.hook[k];
        Object.assign(l.hook, structuredClone(entry.hook));
        report.updated.push(describeHook(entry));
      } else if (l) {
        report.changedUpstream.push(describeHook(entry));
      }
      continue;
    }
    if (b || l) continue;
    local.hooks ??= {};
    local.hooks[entry.event] ??= [];
    const groups = local.hooks[entry.event];
    let group = groups.find((g) => (g.matcher ?? '') === (entry.matcher ?? ''));
    if (!group) {
      group = entry.matcher === undefined ? { hooks: [] } : { matcher: entry.matcher, hooks: [] };
      groups.push(group);
    }
    group.hooks ??= [];
    group.hooks.push(structuredClone(entry.hook));
    report.added.push(describeHook(entry));
  }
  for (const [key, entry] of B) if (!T.has(key) && L.has(key)) report.removedUpstream.push(describeHook(entry));
  const keys = new Set([...Object.keys(base), ...Object.keys(target)]);
  for (const k of keys) {
    if (k === 'hooks') continue;
    if (JSON.stringify(base[k]) !== JSON.stringify(target[k])) report.otherKeysChanged.push(k);
  }
  if (report.added.length || report.updated.length) report.content = `${JSON.stringify(local, null, 2)}\n`;
  return report;
}

// --- CLAUDE.md sections -----------------------------------------------------------------------

function parseSections(text) {
  const lines = text.split('\n');
  const sections = new Map();
  let open = null;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(SECTION_RE);
    if (!m) continue;
    if (m[1] === 'begin') open = { name: m[2], begin: i };
    else if (open && open.name === m[2]) {
      sections.set(m[2], { begin: open.begin, end: i, body: lines.slice(open.begin + 1, i).join('\n') });
      open = null;
    }
  }
  return { lines, sections };
}

// Marks the lines inside fenced code blocks (CommonMark rules: a fence closes only with the same
// character, at least as long, and nothing else on the line; an unclosed fence runs to the end).
function fencedLines(lines) {
  const inFence = [];
  let open = null;
  for (const line of lines) {
    if (open) {
      inFence.push(true);
      const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === open.ch && close[1].length >= open.len) open = null;
    } else {
      const start = line.match(/^ {0,3}(`{3,}|~{3,})/);
      inFence.push(Boolean(start));
      if (start) open = { ch: start[1][0], len: start[1].length };
    }
  }
  return inFence;
}

// For a file from before the markers existed: wrap each template section, found by its first
// heading line outside code fences, searched after the previous section. A section runs to the
// next heading of the same or a higher level. With refSections (the release the file came from),
// it ends after the last line that matches that release's section in order, plus the rest of that
// paragraph or list. So the user's own edits to the section stay inside, and the user's own text
// after a blank line stays outside. Returns null if a template section does not start with a
// heading.
function markByHeadings(text, targetSections, refSections = null) {
  const lines = text.split('\n');
  const inFence = fencedLines(lines);
  const isHeading = (i) => !inFence[i] && lines[i].match(HEADING_RE);
  const found = [];
  let searchFrom = 0;
  for (const [name, t] of targetSections) {
    const heading = t.body.split('\n').find((l) => l.trim() !== '');
    const m = heading?.match(HEADING_RE);
    if (!m) return null;
    const matches = (i) => lines[i] === heading && !inFence[i] && !found.some((f) => i >= f.start && i < f.end);
    let start = -1;
    for (let i = searchFrom; i < lines.length && start < 0; i += 1) if (matches(i)) start = i;
    for (let i = 0; i < searchFrom && start < 0; i += 1) if (matches(i)) start = i;
    if (start < 0) continue; // the user removed or renamed it
    const level = m[1].length;
    let end = start + 1;
    while (end < lines.length) {
      const h = isHeading(end);
      if (h && h[1].length <= level) break;
      end += 1;
    }
    const ref = refSections?.get(name)?.body.split('\n').filter((l) => l.trim() !== '');
    if (ref && ref.length > 1) {
      let j = 1; // ref[0] is the heading
      let last = -1;
      for (let i = start + 1; i < end && j < ref.length; i += 1) {
        if (lines[i] === ref[j]) {
          j += 1;
          last = i;
        }
      }
      if (last >= 0) {
        let k = last + 1;
        while (k < end && lines[k].trim() !== '') k += 1;
        end = k;
      }
    }
    while (end > start + 1 && lines[end - 1].trim() === '') end -= 1;
    found.push({ name, start, end });
    searchFrom = end;
  }
  found.sort((a, b) => b.start - a.start);
  for (const f of found) {
    lines.splice(f.end, 0, `<!-- brain-starter:end ${f.name} -->`);
    lines.splice(f.start, 0, `<!-- brain-starter:begin ${f.name} -->`);
  }
  return lines.join('\n');
}

function mergeClaudeMd(baseText, targetText, localText, from, to) {
  const report = { mode: 'sections', updated: [], merged: [], conflicts: [], added: [], removedUpstream: [], keptDeleted: [], content: null };
  const target = parseSections(targetText);
  let base = parseSections(baseText);
  if (base.sections.size === 0) {
    const marked = markByHeadings(baseText, target.sections);
    if (marked !== null) base = parseSections(marked);
  }
  let local = parseSections(localText);
  if (local.sections.size === 0) {
    const marked = markByHeadings(localText, target.sections, base.sections);
    if (marked === null) {
      // Last resort: one whole-file merge.
      report.mode = 'whole-file';
      if (baseText === targetText) return report;
      const merged = mergeText(localText, baseText, targetText, from, to);
      report.content = merged.content.toString('utf8');
      if (merged.conflicts) report.conflicts.push('(whole file)');
      return report;
    }
    report.mode = 'sections-added';
    local = parseSections(marked);
  }

  const replacements = new Map();
  for (const [name, t] of target.sections) {
    const b = base.sections.get(name);
    const l = local.sections.get(name);
    if (!l) {
      if (!b) report.added.push(name);
      else if (b.body !== t.body) report.keptDeleted.push(name);
      continue;
    }
    if (b && b.body === t.body) continue;
    if (l.body === t.body) continue;
    if (b && l.body === b.body) {
      replacements.set(name, t.body);
      report.updated.push(name);
      continue;
    }
    const merged = mergeText(`${l.body}\n`, `${b ? b.body : ''}\n`, `${t.body}\n`, from, to);
    replacements.set(name, merged.content.toString('utf8').replace(/\n$/, ''));
    (merged.conflicts ? report.conflicts : report.merged).push(name);
  }
  for (const [name, b] of base.sections) {
    const l = local.sections.get(name);
    if (!target.sections.has(name) && l && l.body === b.body) report.removedUpstream.push(name);
  }

  // Rebuild the local file: replace changed section bodies, then insert new sections after the
  // section that precedes them in the target, or at the end.
  const out = [];
  const byBegin = new Map([...local.sections].map(([name, s]) => [s.begin, name]));
  for (let i = 0; i < local.lines.length; i += 1) {
    const name = byBegin.get(i);
    if (name !== undefined && replacements.has(name)) {
      const s = local.sections.get(name);
      out.push(local.lines[s.begin], ...replacements.get(name).split('\n'), local.lines[s.end]);
      i = s.end;
    } else {
      out.push(local.lines[i]);
    }
  }
  let text = out.join('\n');
  const targetOrder = [...target.sections.keys()];
  for (const name of report.added) {
    const block = `<!-- brain-starter:begin ${name} -->\n${target.sections.get(name).body}\n<!-- brain-starter:end ${name} -->`;
    const idx = targetOrder.indexOf(name);
    const anchor = targetOrder.slice(0, idx).reverse().find((n) => text.includes(`<!-- brain-starter:end ${n} -->`));
    const next = targetOrder.slice(idx + 1).find((n) => text.includes(`<!-- brain-starter:begin ${n} -->`));
    if (anchor) {
      const endMarker = `<!-- brain-starter:end ${anchor} -->`;
      const at = text.indexOf(endMarker) + endMarker.length;
      text = `${text.slice(0, at)}\n\n${block}${text.slice(at)}`;
    } else if (next) {
      const at = text.indexOf(`<!-- brain-starter:begin ${next} -->`);
      text = `${text.slice(0, at)}${block}\n\n${text.slice(at)}`;
    } else {
      text = `${text.replace(/\n*$/, '')}\n\n${block}\n`;
    }
  }
  if (text !== localText) report.content = text;
  return report;
}

// --- Main -------------------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  // The vault root is two levels above this script (docs/scripts/). A vault can sit inside a
  // larger git repo, so the repo's top level is not the vault.
  // The vault is two folders above the script. process.argv[1] keeps the path of a symlinked
  // script, which is the vault when the link sits in that vault's docs/scripts/. A link anywhere
  // else (for example ~/bin) would point at the wrong folder, so then the link target counts.
  const SCRIPT = join('docs', 'scripts', 'brain-starter-update.mjs');
  const argvPath = process.argv[1] ? resolve(process.argv[1]) : null;
  const argvRoot = argvPath ? resolve(dirname(argvPath), '..', '..') : null;
  const realRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const root = argvRoot && relative(argvRoot, argvPath) === SCRIPT ? argvRoot : realRoot;
  if (!existsSync(join(root, 'CLAUDE.md')) || !existsSync(join(root, '.claude'))) {
    fail(`no vault root at ${root} (expected CLAUDE.md and .claude/ there)`);
  }
  try {
    git(root, ['rev-parse', '--is-inside-work-tree']);
  } catch {
    fail('the vault must be a git repository');
  }

  // 6: a broken marker must not be replaced silently, it may hold "check": false.
  const marker = readJson(join(root, MARKER));
  if (existsSync(join(root, MARKER)) && (marker === null || typeof marker !== 'object' || Array.isArray(marker))) {
    fail(`${MARKER} is not valid JSON with an object at the top; fix it first`);
  }
  const repo = marker?.repo ?? DEFAULT_REPO;
  if (!REPO_RE.test(repo)) fail(`"repo" in ${MARKER} must look like owner/name, got "${repo}"`);
  let from = opts.from || marker?.version;
  let fromSource = opts.from ? '--from' : marker?.version ? MARKER : null;
  if (!from) {
    const manifest = readJson(join(root, '.release-please-manifest.json'));
    from = manifest?.['.'];
    fromSource = from ? '.release-please-manifest.json' : null;
  }
  if (!from || !VERSION_RE.test(from)) {
    fail('cannot tell which brain-starter version this vault came from; pass --from X.Y.Z');
  }
  const to = opts.to || (await latestVersion(repo));
  const order = compareVersions(from, to);
  if (order === 0) {
    console.log(JSON.stringify({ status: 'up-to-date', version: from, repo }, null, 2));
    return;
  }
  if (order > 0) fail(`installed version ${from} is newer than target ${to}`);

  workDir = mkdtempSync(join(tmpdir(), 'brain-starter-update-'));
  const baseDir = await fetchRelease(repo, from);
  const targetDir = await fetchRelease(repo, to);

  const targetMarker = readJson(join(targetDir, MARKER));
  if (!validOwnedList(targetMarker?.owned)) fail(`release ${to} has no valid ${MARKER} with an "owned" list`);
  const baseMarker = readJson(join(baseDir, MARKER));
  const targetOwned = targetMarker.owned;
  const baseOwned = validOwnedList(baseMarker?.owned) ? baseMarker.owned : targetOwned;
  const mergeModes = targetMarker.merge || {};
  for (const path of Object.keys(mergeModes)) {
    if (!validOwnedList([path]) || path.endsWith('/')) fail(`invalid merge path in release ${to}: ${path}`);
  }
  const skip = new Set([MARKER, ...Object.keys(mergeModes)]);

  const renames = activeRenames(targetMarker, baseDir);
  const owned = classifyOwned(root, baseDir, targetDir, baseOwned, targetOwned, renames, skip, from, to);
  const MOVES = new Set(['rename-update', 'rename-move', 'rename-merge-clean', 'rename-merge-conflict', 'rename-move-own']);
  const renamed = Object.entries(renames)
    .filter(([o]) => owned.files.some((f) => f.oldPath?.startsWith(o) && MOVES.has(f.action)))
    .map(([o, n]) => {
      const skill = n.match(/^\.claude\/skills\/([^/]+)\/$/);
      const old = o.match(/^\.claude\/skills\/([^/]+)\/$/);
      return { from: o, to: n, ...(skill && old ? { oldCommand: `/${old[1]}`, newCommand: `/${skill[1]}` } : {}) };
    });

  // Owned files that exist locally but are not tracked yet, such as the two files fetched by hand
  // to bootstrap an old vault. They need staging with the update commit.
  const untrackedOwned = git(root, ['ls-files', '-z', '--others', '--exclude-standard'])
    .split('\0')
    .filter((p) => p && isOwned(p, targetOwned) && existsSync(join(targetDir, p)));

  const special = [];
  for (const [path, mode] of Object.entries(mergeModes)) {
    if (symlinkOnPath(root, path)) {
      special.push({ path, mode, report: { skippedSymlink: true } });
      continue;
    }
    const B = lf(readOrNull(join(baseDir, path)))?.toString('utf8') ?? '';
    const T = lf(readOrNull(join(targetDir, path)))?.toString('utf8') ?? '';
    const L = lf(readOrNull(join(root, path)))?.toString('utf8');
    if (L === undefined) {
      special.push({ path, mode, report: { keptDeleted: true } });
      continue;
    }
    const report = mode === 'hooks' ? mergeSettings(B, T, L) : mode === 'sections' ? mergeClaudeMd(B, T, L, from, to) : null;
    if (!report) fail(`unknown merge mode "${mode}" for ${path}`);
    special.push({ path, mode, report });
  }

  // Apply: branch, write, report. Nothing is committed. Nothing is deleted, except the old path of
  // a file the release renamed, after its content is written to the new path.
  const branch = `brain-starter-update/${to}`;
  const written = [];
  const removed = [];
  const movedUntracked = [];
  const conflicts = [];
  if (opts.command === 'apply') {
    if (owned.files.some((f) => f.action === 'rename-blocked-symlink')) {
      fail('a rename is blocked by a symlink (see rename-blocked-symlink in the plan); replace the link with the real files or rename the folder by hand, then run again');
    }
    const untrackedChanged = owned.files.filter(
      (f) => f.oldPath && f.tracked === false && ['rename-update', 'rename-merge-clean', 'rename-merge-conflict'].includes(f.action),
    );
    if (untrackedChanged.length) {
      fail(
        `commit these files first, a rename changes their content and git has no copy: ${untrackedChanged.map((f) => f.oldPath).join(', ')}` +
          ' (use git add -f for a file that .gitignore matches)',
      );
    }
    const dirty = git(root, ['status', '--porcelain', '--untracked-files=no']);
    if (dirty) {
      fail('the git repository has uncommitted changes to tracked files (also outside the vault, if it sits in a larger repo); commit or stash them first');
    }
    if (spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: root }).status === 0) {
      fail(`branch ${branch} already exists from an earlier attempt; delete it (git branch -D ${branch}) or finish it`);
    }
    if (symlinkOnPath(root, MARKER)) fail(`${MARKER} is a symlink; refusing to write through it`);
    const sw = spawnSync('git', ['switch', '-c', branch], { cwd: root, encoding: 'utf8' });
    if (sw.status !== 0) fail(`cannot create branch ${branch}: ${(sw.stderr || '').trim()}`);

    const created = [];
    const createdDirs = []; // folders this run made; only these are removed on recovery
    const write = (path, content, modeFrom) => {
      const dest = join(root, path);
      if (symlinkOnPath(root, path)) throw new Error(`refusing to write through a symlink: ${path}`);
      if (!existsNoFollow(dest)) created.push(path);
      const firstNew = mkdirSync(dirname(dest), { recursive: true });
      if (firstNew) createdDirs.push(relative(root, firstNew).split(sep).join('/'));
      writeFileSync(dest, content);
      if (modeFrom) chmodSync(dest, lstatSync(modeFrom).mode & 0o777);
      written.push(path);
    };
    try {
      for (const f of owned.files) {
        if (f.action === 'add' || f.action === 'update') write(f.path, f.T, join(targetDir, f.path));
        if (f.action === 'rename-update') write(f.path, f.T, join(targetDir, f.path));
        if (f.action === 'rename-move' || f.action === 'rename-move-own') write(f.path, f.raw, join(root, f.oldPath));
        if (f.merged) {
          write(f.path, f.merged.content, f.oldPath ? join(root, f.oldPath) : null);
          if (f.merged.conflicts) conflicts.push(f.path);
        }
        if (f.oldPath && MOVES.has(f.action) && written.includes(f.path)) {
          if (symlinkOnPath(root, f.oldPath)) throw new Error(`refusing to remove through a symlink: ${f.oldPath}`);
          unlinkSync(join(root, f.oldPath));
          // Only tracked paths go into "removed": git add on an untracked old path fails.
          if (f.tracked) removed.push(f.oldPath);
          else {
            // The user never tracked it: keep it out of "written", so it is not staged.
            movedUntracked.push([f.oldPath, f.path]);
            written.splice(written.indexOf(f.path), 1);
          }
        }
      }
      // Remove the old folders of renames once they are empty. Never through a symlink.
      for (const o of Object.keys(renames)) {
        const dir = o.replace(/\/$/, '');
        if (!symlinkOnPath(root, dir)) removeEmptyDirs(join(root, dir));
      }
      for (const s of special) {
        if (s.report.content) write(s.path, s.report.content);
        if (s.report.conflicts?.length) conflicts.push(s.path);
      }
      // The user's own keys win (check, interval, a fork's repo, extra keys); the release sets
      // the owned list, the merge modes and the version.
      const newMarker = {
        ...targetMarker,
        ...(marker || {}),
        owned: targetOwned,
        merge: targetMarker.merge,
        renamed: targetMarker.renamed,
        version: to,
      };
      write(MARKER, `${JSON.stringify(newMarker, null, 2)}\n`);
    } catch (e) {
      // Recovery as commands, in this order: git restores tracked files (and their folders), then
      // untracked files that moved go back (git has no copy of them), then files this run created
      // are deleted and the branch goes.
      const movedBack = new Set(movedUntracked.map(([, n]) => n));
      const toDelete = created.filter((p) => !movedBack.has(p));
      const steps = [
        'git switch -f -',
        ...movedUntracked.map(([o, n]) => `mkdir -p ${sh(dirname(o))} && mv ${sh(n)} ${sh(o)}`),
        ...(toDelete.length ? [`rm -f -- ${toDelete.map(sh).join(' ')}`] : []),
        ...createdDirs.map((d) => `[ ! -d ${sh(d)} ] || find ${sh(d)} -depth -type d -empty -delete`),
        `git branch -D ${sh(branch)}`,
      ];
      fail(
        `apply stopped: ${e.message}\nOn branch ${branch}, already written: ${written.join(', ') || 'nothing'}` +
          `${removed.length ? `; removed (renamed): ${removed.join(', ')}` : ''}` +
          `${movedUntracked.length ? `; moved untracked files: ${movedUntracked.map(([, n]) => n).join(', ')}` : ''}.\n` +
          `To go back, run these commands in the vault root (${root}):\n${steps.map((c) => `  ${c}\n`).join('')}`,
      );
    }
  }

  const summary = {
    status: opts.command === 'apply' ? 'applied' : 'planned',
    root,
    repo,
    from,
    fromSource,
    to,
    branch: opts.command === 'apply' ? branch : null,
    localMatchesBase: `${owned.localMatchesBase}/${owned.comparable}`,
    renamed,
    ignoredRenames,
    files: owned.files.map(({ path, oldPath, action }) => ({ path, ...(oldPath ? { oldPath } : {}), action })),
    special: special.map(({ path, mode, report }) => ({
      path,
      mode,
      ...Object.fromEntries(Object.entries(report).filter(([k]) => k !== 'content')),
      changes: Boolean(report.content),
    })),
    written,
    removed,
    movedUntracked: movedUntracked.map(([o, n]) => ({ from: o, to: n })),
    untrackedOwned,
    conflicts,
    changelog: changelogBetween(targetDir, from, to),
  };
  rmSync(workDir, { recursive: true, force: true });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => fail(e?.stack || String(e)));
