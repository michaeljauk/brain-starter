---
name: lint-brain
description: Run health checks over the brain vault - find orphan notes, broken wikilinks, missing frontmatter, stale projects, and missing cross-links. Use when asked to "lint the brain", "health check", "vault hygiene", or "/lint-brain".
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

## Step-by-step workflow

Run all six checks in order, collect results, then present the report.

### 1. Orphan notes

Find notes in `projects/`, `research/`, and `knowledge/` that have zero inbound wikilinks from other files in the vault.

**Method:**
1. List all `.md` files in `projects/`, `research/`, and `knowledge/`
2. For each file, extract its basename without extension (e.g., `my-project` from `projects/my-project.md`)
3. Grep the entire vault for `[[basename]]` or `[[basename|` or `[[basename#` patterns
4. Exclude self-references (the file linking to itself)
5. Exclude matches found only in `meetings/` (auto-generated, don't count as intentional links)
6. Any file with zero inbound links from non-meetings files is orphaned

**Important:** A file counts as linked if ANY variant matches - `[[filename]]`, `[[filename|alias]]`, `[[filename#heading]]`.

### 2. Broken wikilinks

Find all `[[...]]` references that point to non-existent files.

**Method:**
1. Grep all `.md` files (excluding `meetings/`, `sources/`, `research/`, `.obsidian/`) for the pattern `\[\[([^\]|#]+)` to extract wikilink targets
2. Build a set of all `.md` filenames (without extension) in the vault
3. For each wikilink target, check if a matching filename exists anywhere in the vault
4. Report broken links with the source file path and line number

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
1. For each project directory in `projects/`, run `git log -1 --format="%ai" - <file>` to get the last commit date
2. Calculate days since last modification
3. Flag any file with 60+ days since last commit

**Note:** Use git history, not filesystem mtime (mtime changes on checkout).

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
1. For each `.md` file in the target directories, run `git log -1 --format="%ai" - <file>`
2. Calculate days since last modification
3. Categorize into: OK, WARN (approaching threshold), STALE (past threshold)
4. For decisions, also check if the decision has an "Outcome / follow-up" section that is empty or contains only "-"

**Output:** Group by severity (STALE first, then WARN). Include the last modified date and days since.

### 7. Near-duplicate detection

Find notes that may be duplicates or near-duplicates created by repeated ingestion.

**Method:**
1. Extract titles from frontmatter (or filename) for all notes
2. Normalize titles: lowercase, remove dates, remove common prefixes ("spike-", "research-")
3. Compare all pairs using these heuristics:
   - Exact normalized title match = definite duplicate
   - One title is a substring of another (>60% length overlap) = likely duplicate
   - Same tags + created within 7 days of each other = suspicious
4. Cap at 10 suggestions

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
   - Count entries in the MANIFEST.md table
   - If counts differ, the manifest is stale
2. Report stale manifests with the file count discrepancy

### 10. Knowledge islands

Find large notes with poor outbound connectivity.

**Method:**
1. For each `.md` file in `projects/`, `research/`, `knowledge/`, `decisions/`, and `docs/`:
   - Count total lines
   - Count outbound `[[wikilinks]]`
2. Flag files with 200+ lines and fewer than 2 unique outbound wikilinks
3. Exclude files in `meetings/` and `sources/`

## Scoring

Calculate a health score from 0-100:

```
base = 100
penalty = 0
penalty += orphan_count * 2          (max 20)
penalty += broken_links_count * 3    (max 15)
penalty += missing_frontmatter * 2   (max 15)
penalty += stale_notes_count * 1     (max 10)  # staleness tiers
penalty += near_duplicates * 3       (max 10)  # near-duplicate detection
penalty += decayed_decisions * 2     (max 10)  # decision decay
penalty += stale_manifests * 2       (max 5)   # manifest freshness
penalty += knowledge_islands * 2     (max 15)
bonus  = min(10, cross_link_suggestions < 5 ? 10 : 0)  # low suggestions = healthy linking

score = max(0, base - min(penalty, 90) + bonus)
```

Cap each category's penalty contribution so one category can't tank the whole score.

## Output format

Present the report inline (do not write to a file unless asked). Use this structure:

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
- `research/ai-agents/a.md` <-> `projects/my-saas/b.md` - shared tags: [ai, agents]
...

### Staleness Tiers (N found)
- STALE: `projects/old-project/spec.md` - 195 days (threshold: 90)
- WARN: `research/infra/setup.md` - 160 days (threshold: 180)
...

### Near-Duplicates (N found)
- `research/ai-agents/tool-comparison.md` ~ `projects/my-saas/tool-comparison.md` - title overlap 85%
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

After presenting the report (and after any fixes), append an entry to `log.md` in the vault root:

```markdown
## [YYYY-MM-DD] lint | Brain vault health check
- **Score:** {X}/100
- **Issues:** {orphans: N, broken links: N, missing frontmatter: N, stale: N, duplicates: N, islands: N}
- **Fixed:** {what was fixed, if anything, or "report only"}
```
