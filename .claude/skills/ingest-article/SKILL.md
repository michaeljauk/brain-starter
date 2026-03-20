---
name: ingest-article
description: Ingest an article from a URL or raw text into the brain vault. Extracts key knowledge, determines placement, creates or updates notes, and links to relevant projects. Use when the user shares a URL or text and wants to absorb it into their knowledge base.
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

### 2. Analyze and classify

Read the extracted content and determine:

1. **Topic summary** — What is this article about? (1-2 sentences)
2. **Key insights** — The 3-8 most actionable or notable takeaways
3. **Relevance** — Which existing projects, notes, or topics does this relate to?
4. **Placement decision** — Where should this go?

### 3. Determine placement

Use this decision tree:

| Condition | Action |
|-----------|--------|
| Article directly relates to an **active project** (check `projects/`) | **Update** the project note with a new section or append insights |
| Article is research for an **in-progress deliverable** | **Create** in `working-files/{project}/` |
| Otherwise (general knowledge, reference material) | **Create** a new note in `notes/` as a standalone knowledge note |

**Priority:** Update project notes if directly relevant > Create in working-files if tied to a deliverable > Create standalone note in `notes/`.

### 4. Search for related content

Before writing, search for related existing notes using Grep and Glob. Also use semantic search (smart-connections MCP) if configured and keyword search is insufficient.

Check:
- `projects/` — any project this relates to?
- `notes/` — any existing note on this exact topic that should be updated instead of creating a new file?

If an existing note in `notes/` covers the same topic closely, **update that note** rather than creating a duplicate.

### 5. Write the content

#### If creating a new note in `notes/`:

Filename: `{short-descriptive-slug}.md`

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

### 6. Cross-link

After writing:
- Add `[[wikilinks]]` to related notes in the new/updated content
- If the article is highly relevant to a project, consider adding a backlink in the project note

### 7. Report to user

Summarize what was done:

```
Ingested: "{article title}"
Source: {URL or "raw text"}

Action: {Created new note | Updated existing note | Updated project note}
Location: {file path}
Key insights: {count} extracted
Linked to: [[project-a]], [[existing-note-b]]
```

## Content rules

- **Distill, don't copy.** Extract insights and frameworks, not paragraphs. The goal is a knowledge base, not an article archive.
- **Attribute sources.** Always include the URL/source and article title.
- **No ephemeral content.** Skip news that won't be useful in 3 months. If the article is mostly time-sensitive, warn the user and suggest skipping or saving only the durable insights.
- **Dedup before creating.** If `notes/` already has a file on the same topic, update it rather than creating a new file.
