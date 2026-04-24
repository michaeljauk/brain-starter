---
name: save-answer
description: File a conversation output (research, analysis, comparison, framework) back into the brain vault so it compounds instead of vanishing into chat history. Use when the user says "save this", "file this", "keep this", or when a valuable answer should persist.
---

# Save Answer

Files a conversation output back into the brain vault. Turns ephemeral Q&A, research, analysis, and comparisons into persistent, cross-linked knowledge.

Inspired by Karpathy's LLM Wiki pattern: "good answers should be filed back into the wiki as new pages so explorations compound."

## Trigger phrases

- `/save-answer`
- "save this answer"
- "file this"
- "keep this in the brain"
- "this is worth saving"
- "persist this"

## Input

The content to save. This can be:
- **Explicit:** User says "save this" after a Q&A exchange or analysis
- **Implicit:** User invokes `/save-answer` and Claude identifies the most recent substantial output in the conversation

If no clear output is identifiable, ask: "Which part of our conversation should I save?"

## Step-by-step workflow

### 1. Identify the output

Extract the valuable content from the conversation. Common types:
- **Research finding** -- answer to a question that required multi-source synthesis
- **Comparison/analysis** -- a table or structured evaluation of options
- **Framework application** -- a mental model applied to a specific problem
- **Decision rationale** -- reasoning behind a choice (if not already logged as a decision)
- **Technical insight** -- something learned about a tool, API, or system

### 2. Determine placement

| Type | Location |
|------|----------|
| Project-specific insight | Append to `projects/{project}/{relevant-file}.md` |
| Research finding | `research/{topic}/{descriptive-slug}.md` |
| Cross-project analysis | `research/{topic}/{descriptive-slug}.md` |
| Decision rationale | `decisions/YYYY-MM-DD-{slug}.md` (use decision template) |

Check for existing notes on the same topic before creating new files. Update if a close match exists.

### 3. Write the content

For new notes:

```markdown
---
title: "{Descriptive title}"
date: YYYY-MM-DD
type: note
tags: [{relevant, tags}]
source: "conversation"
---

# {Descriptive title}

> Derived from conversation on YYYY-MM-DD

## Context

{1-2 sentences: what question or analysis led to this}

## Key Findings

{The actual content -- distilled, not a transcript dump:
- Lead with conclusions
- Include specific data, comparisons, or frameworks
- Keep it scannable}

## Relevance

- [[project-or-note]] -- {how it connects}
```

For appending to existing notes:
- Add under the most relevant section (## Notes, ## Research, or a new subsection)
- Include a date marker: `*Added YYYY-MM-DD from conversation*`
- Keep it concise

### 4. Cross-link

- Add `[[wikilinks]]` to related notes in the saved content
- If highly relevant to a project, add a backlink in the project note

### 5. Append to activity log

Add an entry to `log.md`:

```markdown
## [YYYY-MM-DD] save | {Short title}
- **Type:** {research finding | comparison | framework | decision rationale | technical insight}
- **Action:** {Created | Updated} `{file path}`
- **Linked to:** [[note-a]], [[note-b]]
```

### 6. Report to user

```
Saved: "{title}"
Location: {file path}
Action: {Created new note | Appended to existing note}
Linked to: [[note-a]], [[note-b]]
```

## Content rules

- **Distill, don't transcribe.** Extract the insight, not the conversation.
- **Only save durable knowledge.** Skip anything that won't be useful in 3+ months.
- **One concept per note.** If the output covers multiple distinct topics, split into separate notes.
- **Don't duplicate.** Check `research/` and `projects/` before creating.
- **Don't touch curated collections.** Never merge into `knowledge/lenny/` or other hand-curated files.

## Proactive use

The `/wrap-session-up` skill checks for unsaved session outputs in its "Compound session outputs" step. This skill can be invoked directly when the user wants to save something mid-conversation without waiting for wrap-up.
