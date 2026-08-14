---
name: ingest-article
description: Ingest an article from a URL or raw text into the brain vault. Extracts key knowledge, determines placement, creates or updates notes, and links to relevant projects. Use when the user shares a URL or text and wants to absorb it into their knowledge base.
context: fork
model: sonnet
---

# Ingest Article

Takes a URL or raw text, extracts the key knowledge, and places it in the right location(s) in the brain vault.

## Trigger phrases

- "ingest this: [URL]"
- "ingest article: [URL]"
- "/ingest-article [URL]"
- "add this to my brain: [URL or text]"
- "save this knowledge: [URL or text]"

## Input

The user provides one of:
- **A URL** — extract content using Defuddle CLI
- **Raw text** — use directly (pasted article, email, notes)

Optional: the user may specify a target topic or project to file under.

## Step-by-step workflow

### 1. Extract content

**If URL:**
```bash
defuddle parse <url> --md
```

Also grab metadata:
```bash
defuddle parse <url> -p title
defuddle parse <url> -p domain
defuddle parse <url> -p description
```

**If raw text:** Use the text as-is. Ask the user for a title/source if not obvious.

**Paywall bail-out:** If defuddle output is < 500 chars AND contains markers like `subscribe`, `paywall`, `sign up to read`, `become a member`, abort the auto-ingest. Tell the user the source is paywalled and ask them to paste the full text. Do NOT write a thin note from a paywalled snippet.

### 2. Analyze and classify

Read the extracted content and determine:

1. **Topic summary** — What is this article about? (1-2 sentences)
2. **Key insights** — The 3-8 most actionable or notable takeaways
3. **Actionable insights with application targets** — For each key insight, identify the specific project/area where it could be applied. Format as `{insight} → {project or area} — {what to do}`. This is mandatory output, not optional. If an insight has no application target across active projects (check memory for active projects list), label it `general reference` and explain why.
4. **Relevance** — Which existing projects, notes, or topics does this relate to?
5. **Placement decision** — Where should this go?

### 3. Determine placement

Use this decision tree:

| Condition | Action |
|-----------|--------|
| Article directly relates to an **active project** (check `projects/`) | **Update** the project note with a new section or append insights |
| Article is research for an **in-progress deliverable** | **Create** in `projects/{project}/` |
| Otherwise (general knowledge, reference material) | **Create** a new note in `research/` as a standalone knowledge note |

**Important:** Do NOT merge into curated topic notes like `knowledge/lenny/*.md` — those are hand-curated from specific sources. Always create a separate knowledge note instead.

**Priority:** Update project notes if directly relevant > Create in working-files if tied to a deliverable > Create standalone note in `research/`.

### 4. Search for related content

Before writing, search for related existing notes:

Use Grep to search file contents and Glob to find related files. Also use `qmd vsearch "{keywords}"` for semantic matches if keyword search is insufficient.

**Short-content shortcut:** If extracted content is < 1000 chars, skip `qmd vsearch` and run only Grep+Glob over the most likely subdir (e.g. `research/ai-agents/` for an AI tweet).

**Do NOT skip `qmd vsearch` based on domain.** The old rule exempted `x.com` / `twitter.com` / `bsky.app` on the theory that "dedup risk on short social posts is low". Both duplicate pairs ever found in this vault were X-sourced, and X long-form Articles are not short posts. Judge by actual content length only.

**If `qmd` errors, do not silently continue on Grep alone** — say the dedup check was degraded and run `qmd-doctor`. A broken index is exactly how `llm-wiki-pattern.md` and `karpathy-llm-knowledge-bases.md` both got created.

Check:
- `projects/` — any project this relates to?
- `research/` — any existing note on this exact topic that should be updated instead of creating a new file?

If an existing note in `research/` covers the same topic closely, **update that note** rather than creating a duplicate.

### 5. Write the content

#### If creating a new note in `research/`:

Filename: `{short-descriptive-slug}.md` (no date prefix for reference notes, per conventions).

```markdown
---
title: "{Descriptive title}"
date: YYYY-MM-DD
type: note
tags: [{relevant, tags}]
source: "{URL or description}"
---

# {Descriptive title}

> Source: [{article title}]({URL}) — {domain}, {date if available}

## Summary

{1-3 sentence summary of what this article covers and why it matters}

## Key Insights

{Distilled, actionable insights — not a verbatim copy:
- Lead with the insight, not the author's framing
- Include specific numbers, frameworks, or models
- Skip fluff, intros, and promotional content}

## Relevance

{How this connects to active projects or decisions. Include wikilinks:}
- [[project-name]] — {how it's relevant}

## Raw quotes

{Optional: 2-3 particularly well-stated quotes worth preserving verbatim, with attribution}
```

#### If updating a project note:

- Add insights under a relevant section (e.g., ## Research, ## Notes, or a new subsection)
- Add source attribution inline
- Keep it concise — project notes should stay scannable
- Include `[[wikilinks]]` to related notes, other projects, or concepts inline within the update

#### If skipping ephemeral content:

- Still mention related projects using `[[wikilinks]]` in the warning message (e.g., "This relates to [[acme-ai]] but is too time-sensitive to ingest")

### 6. Cross-link and ripple

**Every output must contain at least one `[[wikilink]]`** -- whether it's a new note, a project update, or an ephemeral content warning. This is non-negotiable.

- Add `[[wikilinks]]` to related notes in the new/updated content
- If the article is highly relevant to a project, consider adding a backlink in the project note's ## Related or ## Notes section

**Ripple updates (MANDATORY):** An ingest that only creates a note without linking it back is passive archiving, not knowledge management. After writing the main note, you MUST update related files:

1. **Project notes** -- if the article is relevant to an active project, append a cross-link (1-2 lines) in the project file's ## See also, ## Notes, or ## Research section, with a wikilink back to the new note. This is NOT optional -- if the actionability assessment identified a project, that project note gets updated.
2. **Related research notes** -- if the article strengthens, contradicts, or extends an existing research note, add a brief cross-reference there
3. **Concept pages** -- if the article introduces or significantly develops a concept that has its own page, update that page

Target: 8-15 files touched per ingest (including the primary note). Karpathy's pattern touches 10-15 and 0xkkai's claims 8-15; the old 2-5 target was the largest structural gap between this vault and both reference patterns. Ripple means updating the entity, concept and project pages the source actually bears on — not padding the count. The primary note + at least one project/research backlink is the minimum. Only skip backlinks if there is genuinely no connection to any existing note.

**Parallelize ripple Edits.** Once you have the list of files to update, issue all Edit tool calls in a single tool-use block. Do not chain them sequentially - the parent waits for each round-trip. For 3+ backlinks this cuts latency ~40%.

### 6b. Append to activity log

**Dedupe rule:** Before appending, Grep `log.md` for the source URL on today's date. If an entry already exists for the same URL today, update that entry in place (rewrite the action/insights/linked-to fields) instead of appending a duplicate.

Add an entry to `log.md` in the vault root:

```markdown
## [YYYY-MM-DD] ingest | {Article title}
- **Source:** {URL or "raw text"}
- **Action:** {Created | Updated} `{file path}`
- **Insights:** {count} extracted
- **Linked to:** [[note-a]], [[note-b]]
```

### 7. Report to user

Summarize what was done, give a quick roundup of the content, AND surface the actionable insights with their application targets. All three sections are mandatory.

```
Ingested: "{article title}"
Source: {URL or "raw text"}

Action: {Created new note | Updated existing note | Updated project note}
Location: {file path}
Key insights: {count} extracted
Linked to: [[project-a]], [[existing-note-b]]

## Roundup

{3-6 bullet points or 4-8 sentences distilling what the article actually says. This is the "what's in there" -- enough that the user understands the core claims/content without reading the source. Lead with the thesis, then the supporting structure (key primitives, numbers, frameworks). Skip fluff and meta-framing. Use bullets when the content has discrete parts (e.g. a tool with N primitives); use prose when it's a narrative argument.}

## Actionable insights

| Insight | Where to apply | What to do |
|---------|----------------|------------|
| {one-line insight} | {project path or area, e.g. projects/acme/ai/} | {concrete next action} |
| ... | ... | ... |
```

Rules for the actionable insights table:
- One row per insight that has a concrete application target. Skip insights that are pure reference.
- "Where to apply" must be a specific project directory or named area, not a vague topic.
- "What to do" must be an action verb phrase (audit, add, design, pitch, benchmark, expose, etc.) — not "consider" or "think about."
- If the article yields zero actionable insights for active projects, say so explicitly: `No actionable insights for active projects — filed as general reference.` Do not pad with generic advice.

### 8. Prompt for next steps

After reporting, always ask the user what they want to do with this knowledge. Suggest concrete actions based on the content:

- **If the article describes a tool, method, or workflow:** "Want me to integrate this into an existing skill, install it, or build something based on it?"
- **If the article relates to an active project:** "Should I create a task in Todoist, update the project plan, or flag this for someone?"
- **If the article contains a framework or model:** "Want me to apply this framework to [relevant project]?"
- **If the article is general reference:** "Anything actionable here, or just filing for future reference?"

Keep it to one short question with 2-3 concrete options. The goal is to turn passive ingestion into active application.

## Batch ingestion

When the user provides multiple URLs or texts at once:

1. Fetch and create all notes (parallelized where possible)
2. After all notes are created, run a **consolidated actionability assessment**: review all ingested content against active projects (check memory for the active projects list) and surface anything that warrants a task, follow-up, or project update
3. Present as a single summary table, not per-item prompts

This replaces step 8 for batch mode -- one assessment at the end instead of per-item questions.

## Content rules

- **Distill, don't copy.** Extract insights and frameworks, not paragraphs. The goal is a knowledge base, not an article archive.
- **Attribute sources.** Always include the URL/source and article title.
- **No ephemeral content.** Skip news that won't be useful in 3 months. If the article is mostly time-sensitive, warn the user and suggest skipping or saving only the durable insights.
- **Respect conventions.** Follow `docs/conventions.md` for filenames, frontmatter, and folder placement.
- **Don't touch curated collections.** Never merge into `knowledge/lenny/` or other hand-curated topic files. Create separate notes instead.
- **Dedup before creating.** If `research/` already has a file on the same topic, update it rather than creating a new file.

## Examples

**User:** "ingest this: https://example.com/article-about-pricing"
→ Defuddle extracts → general knowledge → creates `research/saas-pricing-value-metrics.md`

**User:** "ingest article: https://example.com/ai-agent-patterns"
→ Defuddle extracts → relates to two active projects → creates `research/ai-agent-patterns.md` with wikilinks to both projects

**User:** "add this to my brain: [pasted text about EU AI Act compliance]"
→ Raw text → directly relevant to an active project → updates `projects/my-project.md` with key compliance insights

## Return contract

Return only:
1. file path created/updated, insight count, linked-to wikilinks
2. **Roundup** — 3-6 bullets or 4-8 sentences distilling what the article says (the "what's in there"). Required.
3. **Actionable insights table** (insight | where to apply | what to do). Required.
4. nothing else

Never paste back the full article text, the full insights body, or raw quotes — the parent reads the file from disk if it needs the content. Roundup + actionable insights table are the exceptions: they must be in the return so the parent surfaces them without re-reading the note.
