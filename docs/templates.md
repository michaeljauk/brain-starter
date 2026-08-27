# Templates

Copy the relevant block when creating a new note.

## Meeting note

> **Note:** `meetings/` is primarily managed by the `granola-sync-plus` Obsidian plugin. Use this template only for manually created meeting notes (e.g. notes taken outside Granola). Granola-synced files use a different filename pattern (`YYYY-MM-DD_Title With Spaces.md`) — that's intentional.

Save in `meetings/` as `YYYY-MM-DD-short-title.md`.

```markdown
---
title: "Meeting title"
date: YYYY-MM-DD
type: meeting
tags: []
---

# Meeting title

**Date:** YYYY-MM-DD  
**Attendees:**

- 

## Agenda

- 

## Notes / discussion

- 

## Decisions

- 

## Action items

- [ ] 
- [ ] 

## Follow-ups
```

---

---

## Decision record

Save in `decisions/` as `YYYY-MM-DD-short-slug.md`. Trigger phrase: *"log decision: [topic]"*

```markdown
---
title: "Decision: [topic]"
date: YYYY-MM-DD
type: decision
tags: []
projects: []
---

# Decision: [topic]

**Date:** YYYY-MM-DD
**Context:** Why did this decision need to be made?

## Decision

What was decided, in one sentence.

## Alternatives considered

| Option | Why rejected |
|--------|-------------|
| Option A | … |
| Option B | … |

## Rationale

Why the chosen option wins.

## Involved

-

## Outcome / follow-up

-
```

---

## Daily Drip - Question of the Day

Purpose: ask one short question a day so `knowledge/me.md` fills up with personal context
organically - preferences, habits, opinions. Hard to collect in one sitting, easy one question at
a time.

Wired up as a `UserPromptSubmit` hook in `.claude/settings.json`. The hook stays silent until
`knowledge/me.md` exists, so a fresh fork is never interrupted.

**How it runs:**
1. The agent picks a question from the pool below, or writes a new one that is still unanswered
2. It asks the question before answering your actual prompt
3. Your answer goes into the matching section of `knowledge/me.md`

**Question pool (starter set):**

Food and drink:
- How do you take your coffee? Or tea?
- Go-to weekday meal, versus what you order when you treat yourself?
- Anything you will not eat?
- Favourite restaurant or delivery app?

Work and productivity:
- When are you most productive? Time of day, environment
- Music or podcasts while you work?
- What does your ideal deep-work block look like?
- Which tool could you not work without?

Free time and interests:
- Last film or series that got you hooked?
- Favourite game: board, video, or sport?
- Where do you go when you get out of town?
- Number one item on your bucket list?

Personality and values:
- What really winds you up?
- Which piece of advice paid off the most?
- What would you tell your 18-year-old self?
- Introvert or extrovert? Or does it depend?

Meta and AI:
- Which AI task saves you the most time?
- What should AI never decide for you?
- Any task you would like to automate but have not got to yet?

**Rules:**
- One question a day, maximum
- Never ask what `knowledge/me.md` already answers
- File answers into the matching section, not as a separate note
- Keep it short - one question, not an interview

---

## Research note

Save in `research/{topic}/` as `short-descriptive-title.md`.

```markdown
---
title: "Research topic title"
date: YYYY-MM-DD
type: research
tags: []
source: ""
---

# Research topic title

## Summary

One-paragraph TL;DR of what was found.

## Key findings

- 

## Analysis

Details, comparisons, data points.

## Relevance

How this connects to active projects or decisions.

## Sources

- 
```

## Vision board monthly check-in

Save in `projects/vision-board-checkins/` as `YYYY-MM.md`. Do this on the last day of each month.

```markdown
---
title: "Vision Board Check-In — YYYY-MM"
date: YYYY-MM-DD
type: vision-checkin
tags: [personal, vision]
---

# Vision Board Check-In — Month YYYY

## Pillar Health

| Pillar | Status | Note |
|--------|--------|------|
| Build | on track / slipping / stuck | |
| Freedom & Purpose | on track / slipping / stuck | |
| Wealth | on track / slipping / stuck | |
| Resilience | on track / slipping / stuck | |
| Experience | on track / slipping / stuck | |
| Legacy | on track / slipping / stuck | |
| Partnership | on track / slipping / stuck | |
| Self-Mastery | on track / slipping / stuck | |

## Wins This Month

One concrete thing per pillar. Skip any that had no movement.

- **Build:**
- **Freedom & Purpose:**
- **Wealth:**
- **Resilience:**
- **Experience:**
- **Legacy:**
- **Partnership:**
- **Self-Mastery:**

## The Three Questions

1. **Does my current trajectory match this board?**

2. **What did I do this month that moved me closer?**

3. **What should I add or remove from this board?**

## Honest Check

- Which pillar am I avoiding?
- What am I telling myself that isn't true?
- What would the version of me on this board do differently tomorrow?
```

---

## Vision board quarterly review

Save in `projects/vision-board-checkins/` as `YYYY-QN-review.md`. Do this at the end of each quarter.

```markdown
---
title: "Vision Board Quarterly Review — YYYY QN"
date: YYYY-MM-DD
type: vision-review
tags: [personal, vision]
---

# Vision Board Quarterly Review — QN YYYY

## Stoic Filter

Run each pillar through the filter before deciding to keep, change, or remove it.

| Pillar | Dichotomy of Control | Memento Mori (5 years left?) | Preferred Indifferent? | Verdict |
|--------|---------------------|------------------------------|----------------------|---------|
| Build | | | | keep / evolve / remove |
| Freedom & Purpose | | | | keep / evolve / remove |
| Wealth | | | | keep / evolve / remove |
| Resilience | | | | keep / evolve / remove |
| Experience | | | | keep / evolve / remove |
| Legacy | | | | keep / evolve / remove |
| Partnership | | | | keep / evolve / remove |
| Self-Mastery | | | | keep / evolve / remove |

## Trend Review

Look at the last 3 monthly check-ins. What patterns do you see?

- Consistently strong:
- Consistently neglected:
- Improving:
- Declining:

## Board Changes

- **Add:**
- **Remove:**
- **Reword:**

## Updated Mantras

Are the 4 mantras still hitting? If not, swap them.

1.
2.
3.
4.
```

---

## Keeping this file current

Update this file when:
- Frontmatter fields change (add/remove/rename a field)
- A new note type is introduced that needs its own template
- The meeting or project template structure is revised

---

## Entity page (person / company)

Save in `projects/{project}/people/{slug}.md` or `projects/{project}/companies/{slug}.md`. One file per entity.

Pattern: **compiled truth at top** (current best understanding, rewritten as facts change) + **append-only timeline** below (dated bullets, never edited). New facts are appended; outdated lines move into the compiled-truth section above.

```markdown
---
title: "Entity name"
type: person | company
project: primary-project-slug
related-projects: []
status: active | dormant | closed
tags: []
---

# Entity name

## State

One paragraph of current truth. Role, relationship, what is true today. Rewritten when facts change. Reader should be able to walk into a meeting after reading just this section.

## Open threads

- Thing currently in motion that has no resolution yet
- Decision waiting on something or someone

## Timeline

Append-only. Newest at the bottom. Never edit past entries — if a fact reverses, append the reversal.

- 2026-MM-DD — what happened, where it came from (meeting / email / call / note link)
- 2026-MM-DD — ...

## Raw

Optional. Links to source material: meeting notes, transcripts, emails, attachments.

-
```

**Conventions:**
- Slug uses lowercase ASCII, dashes only: `jane-doe`, `acme-gmbh`
- One entity = one file across projects. Cross-references via `related-projects`
- Companies and people sit in sibling subdirs (`people/`, `companies/`) inside the primary project
- Cross-cutting people (e.g. accountants, advisors used by every venture) belong in `knowledge/people/` instead
- The `meeting-entity-propagate` skill appends to the Timeline section automatically — never the State section

---

## Project brief

Save in `projects/` as `YYYY-MM-DD-short-title.md`.

```markdown
---
title: "Project name"
date: YYYY-MM-DD
type: project
tags: []
---

# Project name

## Goal

- 

## Constraints

- 

## Stakeholders

- 

## Milestones

- [ ] 
- [ ] 

## Notes
```
