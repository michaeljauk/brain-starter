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

## Daily Drip — Question of the Day

Purpose: Ask one short personal question per day to organically build up `context/me.md` with preferences, habits, and opinions that are hard to capture in a single session.

**How it works:**
1. Agent picks a question from the pool (or generates a new one not yet answered)
2. Question is asked at the start of the first session of the day (via `UserPromptSubmit` hook)
3. Answer is saved into the matching section of `context/me.md`

**Setup:** Add the hook to your project settings (`.claude/settings.json` or `~/.claude/projects/.../settings.json`):
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash scripts/daily-drip.sh"
          }
        ]
      }
    ]
  }
}
```

**Question pool (starter set):**

Food & Drink:
- How do you take your coffee? (Or tea?)
- Go-to weekday meal vs. treat-yourself meal?
- Any food you absolutely can't stand?
- Favorite restaurant or delivery app?

Work & Productivity:
- When are you most productive? (Time of day, environment)
- Music or podcasts while working? What kind?
- What does your ideal deep-work block look like?
- Tool you couldn't work without?

Hobbies & Interests:
- Last movie or show that really grabbed you?
- Favorite game (board, video, sport)?
- Where do you go when you need to get away?
- Bucket list item #1?

Personality & Values:
- What really gets under your skin?
- Best advice you've ever received?
- What would you tell your 18-year-old self?
- Introvert or extrovert? (Or depends on the situation?)

Meta / AI:
- Which AI task saves you the most time?
- What should AI never decide for you?
- Is there a task you'd love to automate but haven't cracked yet?

**Rules:**
- Max 1 question per day
- Don't ask what's already documented in `context/me.md`
- Save answers directly into the matching section (not as a separate file)
- Keep it short — one question, not an interview

---

## Keeping this file current

Update this file when:
- Frontmatter fields change (add/remove/rename a field)
- A new note type is introduced that needs its own template
- The meeting or project template structure is revised

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
