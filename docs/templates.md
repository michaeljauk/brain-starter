# Templates

Copy the relevant block when creating a new note.

## Meeting note

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

## Project brief

Save in `projects/` as `short-name.md`.

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

---

## Keeping this file current

Update this file when:
- Frontmatter fields change (add/remove/rename a field)
- A new note type is introduced that needs its own template
- The meeting or project template structure is revised
