---
name: lint-brain
description: Run health checks over the brain vault - find orphan notes, broken wikilinks, missing frontmatter, stale projects, and missing cross-links. Use when asked to "lint the brain", "health check", "vault hygiene", or "/lint-brain".
context: fork
model: haiku
---

# Lint Brain

Vault health check skill. Scans the brain repo for structural issues - orphan notes, broken links, missing metadata, stale files, and poorly connected knowledge islands. Reports a scored summary and optionally fixes issues.

## Trigger phrases

- `/lint-brain`
- "lint the brain"
- "vault health check"
- "brain hygiene"
- "check vault health"

## Vault location

`~/brain/`

## Directories to check

- `projects/` - project knowledge (one subdir per project, includes decisions)
- `research/` - non-project research (ai-agents, infrastructure, compliance, business, content)
- `knowledge/` - curated long-lived reference (lenny, people, companies)
- `decisions/` - cross-cutting decision records
- `docs/` - repo meta, templates, skill output

## Directories to skip

- `meetings/` - read-only, managed by granola-sync. Never modify.
- `sources/` - gitignored third-party material
- `archive/` - inactive projects
- `.obsidian/` - Obsidian config
- `tmp/` - ephemeral files

## Step 0 — run the stats script FIRST (do not count by hand)

```bash
python3 ~/brain/docs/scripts/lint/vault-stats.py --json
```

**Every countable metric comes from this script.** Orphans, broken links, missing frontmatter,
staleness, near-duplicates, duplicate source URLs, thin-but-linked pages, knowledge islands, hubs,
and existing contradiction flags are all computed deterministically in ~0.3s.

Do **not** recount them yourself. On 2026-08-02 this skill's first persisted audit got five counts
wrong — broken links 311 vs ~120, near-duplicates 8 vs 0, stale manifests 4 vs 0, contradictions
2 vs 0, staleness 51 vs 542. This skill runs as a Haiku fork; arithmetic over 600 files is the wrong
job for it. The script counts, you interpret.

**What still needs you** (and is not in the script):
- **Check 13** — semantic contradiction detection. Requires reading and judgement; use `qmd query`.
- **Check 5** — cross-link suggestions.
- Deciding which findings actually matter, and writing the analysis.

If the script fails, say so and report that the audit is incomplete. Never silently fall back to
hand-counting.

## Step-by-step workflow

The checks below describe *what each metric means* and how to interpret it. The numbers come from
step 0.

### 1. Orphan notes

Find notes in `projects/`, `research/`, and `knowledge/` that have zero inbound wikilinks from other files in the vault.

**Method:**
1. List all `.md` files in `projects/`, `research/`, and `knowledge/`
2. For each file, extract its basename without extension (e.g., `acme` from `projects/acme.md`)
3. Grep the entire vault for `[[basename]]` or `[[basename|` or `[[basename#` patterns
4. Exclude self-references (the file linking to itself)
5. Exclude matches found only in `meetings/` (auto-generated, don't count as intentional links)
6. Any file with zero inbound links from non-meetings files is orphaned

**Important:** A file counts as linked if ANY variant matches - `[[filename]]`, `[[filename|alias]]`, `[[filename#heading]]`.

**Entry points are not orphans** (settled 2026-08-04). `projects/<x>/<x>.md`, `research/<x>/<x>.md`
and root files like `hot.md` are the front doors of their directory: they link outward and nothing
links in, by design. Counting them produced ~30 permanent orphans no amount of linking could clear,
which is why this definition sat open from 2026-08-02. `vault-stats.py` now excludes them.

The genuine fix for the rest was structural: 60 of 70 orphaned project notes sat under the eight
hand-authored overviews, which the stub generator deliberately never rewrites. `link-entities.py`
now appends a generated `## Index` below its marker on every overview, hand-authored ones included —
the content above the marker is never touched. Orphans went 89 → 31 → 10 in one pass.

### 2. Broken wikilinks

Find all `[[...]]` references that point to non-existent files.

**Method:**
1. Grep all `.md` files (excluding `meetings/`, `sources/`, `research/`, `.obsidian/`) for the pattern `\[\[([^\]|#]+)` to extract wikilink targets
2. Build a set of all `.md` filenames (without extension) in the vault
3. For each wikilink target, check if a matching filename exists anywhere in the vault
4. **Valid targets include `.claude/memory/*.md`** (185 files). Memory notes are legitimate wikilink
   destinations; omitting them inflated the count by ~40% (311 reported vs 119 actual, 2026-08-02).
5. Report broken links with the source file path and line number

**Edge cases:**
- `[[file#heading]]` - extract just `file` before the `#`
- `[[file|alias]]` - extract just `file` before the `|`
- Ignore external URLs inside wikilinks
- Case-insensitive matching (Obsidian is case-insensitive for links)

### 3. Missing frontmatter

Check required YAML frontmatter fields per directory.

**Required fields:**
- `research/`: title, date, type, tags
- `projects/` (top-level .md): title
- `decisions/`: title, date

**Method:**
1. For each `.md` file in the target directories, read the first 30 lines
2. Check if the file starts with `---` (has frontmatter)
3. If no frontmatter at all, report all required fields as missing
4. If frontmatter exists, parse it and check which required fields are absent or empty

### 4. Stale project notes

Find project files that haven't been touched in 60+ days.

**Method:**
1. For each project directory in `projects/`, run `git log -1 --format="%ai" -- <file>` to get the last commit date
2. Calculate days since last modification
3. Flag any file with 60+ days since last commit

**Note:** Use git history, not filesystem mtime (mtime changes on checkout).

**Exclude `tasks/`** — it is a managed task-manager sync, not authored content, and its files are
permanently "stale" by design.

### 5. Missing cross-links (suggested connections)

Find notes that likely should link to each other but don't.

**Method:**
1. For each file in `projects/`, `research/`, and `knowledge/`, extract:
   - Tags from frontmatter (the `tags:` field)
   - Title keywords (words from the `title:` field, excluding stop words)
2. Compare every pair of files:
   - If two files share 2+ tags, suggest a cross-link
   - If a file's title contains a keyword that matches another file's title, suggest a cross-link
3. Only suggest links where neither file currently links to the other
4. Cap at 15 suggestions to keep the report useful

### 6. Staleness tiers

Flag notes that may need refresh or archival based on directory-specific thresholds.

**Thresholds:**
- `projects/` notes: warn at 90+ days since last git commit, critical at 180+ days
- `research/` notes: warn at 180+ days, critical at 365+ days
- `decisions/` notes: warn at 180+ days (decision decay - may need re-evaluation)

**Method:**
1. For each `.md` file in the target directories, run `git log -1 --format="%ai" -- <file>`
2. Calculate days since last modification
3. Categorize into: OK, WARN (approaching threshold), STALE (past threshold)
4. For decisions, also check if the decision has an "Outcome / follow-up" section that is empty or contains only "-"

**Output:** Group by severity (STALE first, then WARN). Include the last modified date and days since.

### 7. Near-duplicate detection

Find notes that may be duplicates or near-duplicates created by repeated ingestion.

**Method:**
1. Extract titles from frontmatter (or filename) for all notes
2. Normalize titles: lowercase, remove dates, remove common prefixes ("spike-", "research-")
3. **Exclude generated and boilerplate basenames first:** `MANIFEST.md`, `CLAUDE.md`, `README.md`,
   `SUMMARY.md`, `AGENTS.md`. Every directory has them; comparing them by title guarantees 8+ false
   positives on every run (verified 2026-08-02).
4. Compare all remaining pairs using these heuristics:
   - Exact normalized title match = definite duplicate
   - One title is a substring of another (>60% length overlap) = likely duplicate
   - Same tags + created within 7 days of each other = suspicious
5. Cap at 10 suggestions

### 8. Decision decay

Flag decisions older than 6 months that may need re-evaluation.

**Method:**
1. For each file in `decisions/`, extract the `date:` from frontmatter
2. Calculate months since the decision date
3. Flag decisions older than 6 months
4. Check if "Outcome / follow-up" section exists and has content beyond placeholder "-"
5. Decisions with empty outcomes are higher priority for review

### 9. Manifest freshness

Check if MANIFEST.md files are up-to-date.

**Method:**
1. For each directory that should have a MANIFEST.md (projects/, research/, knowledge/, decisions/):
   - Check if MANIFEST.md exists
   - Count .md files in the directory (excluding MANIFEST.md, CLAUDE.md, SUMMARY.md, README.md)
   - Count entries in the MANIFEST.md table — count only rows starting with `` | ` `` (a backtick-quoted
     path). Counting every `^|` line includes the header and the `|---|` separator, a constant +2 that
     reports every manifest as stale (verified 2026-08-02: `decisions/` has 13 files and 13 entries).
   - If counts differ, the manifest is stale
2. Report stale manifests with the file count discrepancy

### 10. Knowledge islands

Find large notes with poor outbound connectivity.

**Method:**
1. For each `.md` file in `projects/`, `research/`, `knowledge/`, `decisions/`, and `docs/`:
   - Count total lines
   - Count outbound `[[wikilinks]]`
2. Exclude generated `MANIFEST.md` files — they are long by nature and are not knowledge islands
3. Flag files with 200+ lines and **zero** unique outbound wikilinks. Not "fewer than 2" — that
   threshold was arbitrary and reported 19 notes that each had a valid link to their overview
   note as islands (verified 2026-08-02). A note connected to one thing is connected.
3. Exclude files in `meetings/` and `sources/`

### 11. Retrieval health (qmd index)

Verify the semantic search index is alive and current. **Run this first** — several skills
(`ingest-article`, `linkedin-draft`, `research-spike`, `marp`, `gws-obsidian-prep`) call `qmd`
and silently fall back to Grep/Glob when it fails, so a dead or stale index degrades their
output without producing an error. qmd was broken for ~4 months before this was noticed.

**Method:**
1. Run `qmd-doctor`
2. Interpret the exit code: `0` healthy, `1` broken (cannot run), `2` stale
3. Report its stdout verbatim — it names the file count, index age, and how many tracked
   `.md` files changed since indexing

**Output:** If exit is non-zero, put this at the TOP of the report, above the score. A broken
index means every other finding in this run was produced with degraded search, so say that
explicitly rather than burying it. Fix is `qmd update && qmd embed`, or wait for the scheduled
reindex job.

### 12. Duplicate source URLs

Catch notes that capture the same source twice. Check 7 (near-duplicate titles) provably cannot:
`llm-wiki-pattern.md` and `karpathy-llm-knowledge-bases.md` share byte-identical `source:`
frontmatter yet their normalised titles are neither an exact match nor a substring of one another,
and their tag sets differ, so the "same tags + 7 days" rule never fires. They coexisted four months.

**Method:**
1. For every `.md` with frontmatter, extract `source:` (and each entry of a `sources:` list)
2. **Only compare URL-shaped values** — must start with `http://` or `https://`. Pipeline labels are
   legitimately shared: many notes from one importer can carry the same label, e.g. `bank-import`
3. Normalise: strip trailing `/`, strip `?utm_*` query params
4. Report any URL appearing in more than one note, with all paths

**Output:** List each duplicated URL with its notes. These are merge candidates, not automatic
errors — an `archive/` copy alongside an active note can be intentional.

### 13. Unflagged contradictions

Find notes that assert conflicting things about the same subject without saying so. The convention
(see `CLAUDE.md` > Contradictions) is that conflicts are **never silently overwritten** — both
versions stay, wrapped in a `> [!contradiction]` callout with dates and sources.

**Method:**
1. Use `qmd query` to pull clusters of notes on the same subject (this needs semantic search —
   keyword matching will not find "token budgets explode" vs "70-90% fewer tokens")
2. Within a cluster, look for opposing factual or evaluative claims about the same object
3. Report the pair with file paths, the two claims, and each note's `date:`
4. Do **not** auto-resolve. Report as merge/flag candidates for a human

**Report existing `[!contradiction]` callouts separately and NEVER penalise them** — a flagged
contradiction is the convention working, not a defect. Only *unflagged* conflicting pairs count
toward `unflagged_contradictions`. (Verified 2026-08-02: the first run scored 2 healthy flags as
defects, costing 6 phantom points.)

**Cheap precondition:** grep for existing `[!contradiction]` callouts and count them. A vault with
zero flagged contradictions across 1,900 notes is not a vault without conflicts — it is a vault
where nobody is looking. (That was true here until 2026-08-02.)

### 14. Hub and thin-page analysis (backlink-boosted)

Borrowed from gbrain's backlink-boosted ranking: pages referenced often are load-bearing, and a
heavily-referenced page that is thin is the highest-value gap in the vault.

**Method:**
1. Count inbound `[[wikilinks]]` per note
2. Report the top 20 by inbound count ("hubs")
3. **Report any note with 3+ inbound links and fewer than 30 lines** — these are the real content
   gaps: everything points at them and there is nothing there
4. Exclude `meetings/` and `sources/`

**Output:** Hubs are informational. The thin-but-linked list is the actionable one — lead with it.

## Scoring

**The score comes from the script** (`score` and `penalty` fields). Do not compute or adjust it.

On 2026-08-03 two audits with byte-identical metrics reported 23 and 19, because one added a
"+4 cross-link bonus" it had itself marked *(not computed)*. A score you cannot recompute cannot
be trended, and trending is the whole reason audits are persisted. There is no bonus term.

If a metric looks wrong, fix the script and say so in the report — never adjust the number by hand.

**Scoring is ratio-based**, not absolute-count-based (changed 2026-08-03). The original caps were
sized for a small vault: at ~600 files, five of eight categories sat at their cap, so the large
cleanup of 2026-08-02 moved the score by **zero**. Penalties now scale with the share of files
affected, so real improvement is visible. Under the current formula that cleanup reads +18 points
(57 -> 75) instead of +0.

**Do not re-baseline against pre-2026-08-03 scores** — 45, 23 and 19 were produced by the old
formula and are not comparable. The first comparable number is 75/100.

## Output format

**Always persist the report**, then present it inline as well.

Write the full report to `docs/audits/YYYY-MM-DD.md` — **exactly that name**, overwriting any
existing file for today. Never invent a variant like `-corrected.md`: one audit per day is what
makes the trend line diffable, and two files for one date break it (happened 2026-08-02). Without persisted audits there is no trend line — you cannot tell
whether orphan count, stale count, or connectivity are improving or rotting. Include a
machine-readable header so trends can be diffed across runs:

```yaml
---
date: YYYY-MM-DD
type: audit
score: 87
orphans: 12
broken_links: 3
missing_frontmatter: 5
stale: 21
near_duplicates: 2
duplicate_source_urls: 7
unflagged_contradictions: 1
thin_but_linked: 4
qmd_status: OK          # OK | STALE | BROKEN
---
```

After writing, compare against the previous audit in `docs/audits/` and add a one-line delta
("score 87, +4 vs 2026-07-26; orphans 12 → 9"). If no previous audit exists, say so.

Use this structure for the report body:

```
## Brain Vault Health Check

Score: X/100

### Orphan Notes (N found)
- `research/ai-agents/foo.md` - no inbound links
...

### Broken Wikilinks (N found)
- `research/business/bar.md:15` - [[nonexistent-note]]
...

### Missing Frontmatter (N found)
- `research/ai-agents/baz.md` - missing: tags, type
...

### Stale Projects (N found)
- `projects/old.md` - last modified 95 days ago
...

### Suggested Cross-Links (N suggestions)
- `research/ai-agents/a.md` <-> `projects/acme/b.md` - shared tags: [ai, agents]
...

### Staleness Tiers (N found)
- STALE: `projects/old-project/spec.md` - 195 days (threshold: 90)
- WARN: `research/infra/setup.md` - 160 days (threshold: 180)
...

### Near-Duplicates (N found)
- `research/ai-agents/llm-architecture.md` ~ `projects/my-project/ai/llm-architecture.md` - title overlap 85%
...

### Decision Decay (N found)
- `decisions/2025-09-15-auth-provider.md` - 6 months old, empty outcome section
...

### Manifest Freshness (N found)
- `projects/MANIFEST.md` - stale (104 files on disk, 98 in manifest)
...

### Knowledge Islands (N found)
- `research/ai-agents/big.md` - 350 lines, 1 outbound link
...
```

If a category has zero issues, still show it with "(0 found) - all clear".

## Fix mode

After presenting the report, ask:

> Want me to fix any of these? I can:
> 1. **Add missing frontmatter** - fill in missing fields with sensible defaults
> 2. **Add suggested cross-links** - append "See also" sections with wikilinks
> 3. **Fix broken wikilinks** - remove or replace with closest match
> 4. **Regenerate manifests** - run `docs/scripts/generate-manifests.sh` to fix stale manifests
> 5. **Archive stale notes** - move STALE-tier notes to `archive/` (with confirmation per file)
>
> I will never delete notes or modify anything in `meetings/`.

When fixing:

**Missing frontmatter:**
- `title`: derive from filename (replace hyphens with spaces, title-case)
- `date`: use git log first commit date, or today's date as fallback
- `type`: use "research" for `research/`, "project" for `projects/`, "decision" for `decisions/`
- `tags`: leave as empty array `[]` and flag for manual review

**Suggested cross-links:**
- Append a `## See also` section at the end of the file (or add to existing one)
- Use wikilink format: `- [[other-note]]`
- Only add if the user confirms specific suggestions

**Broken wikilinks:**
- Search for the closest filename match using fuzzy matching (check if the target is a substring of any existing filename)
- If a close match exists, suggest replacement
- If no match, offer to remove the broken link or leave it

**Important constraints:**
- Never modify files in `meetings/`
- Never delete any files
- Always show what will change before applying fixes
- Apply fixes one category at a time, confirming with the user between categories

## Activity log

After presenting the report (and after any fixes), **append** an entry to the END of `log.md` in the vault root (never prepend after the
frontmatter — dream-cycle appends, and mixing the two makes the file non-chronological):

```markdown
## [YYYY-MM-DD] lint | Brain vault health check
- **Score:** {X}/100
- **Issues:** {orphans: N, broken links: N, missing frontmatter: N, stale: N, duplicates: N, islands: N}
- **Fixed:** {what was fixed, if anything, or "report only"}
```

## Return contract

Return only: the score + per-category issue counts + what was fixed (if any). Never paste back the full per-issue report, lists of orphan/stale files, or suggested cross-link pairs — the parent reads the report inline if it ran in-conversation, or from `log.md` otherwise. Cap at 15 lines.
