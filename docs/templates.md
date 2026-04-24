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

## Daily Drip — Frage des Tages

Zweck: Täglich eine kurze Frage stellen, um `knowledge/me.md` organisch mit persönlichem Kontext anzureichern — Vorlieben, Gewohnheiten, Meinungen, die sich schwer in einem Rutsch abfragen lassen.

**Ablauf:**
1. Agent wählt eine Frage aus dem Pool (oder generiert eine neue, die noch nicht beantwortet ist)
2. Frage wird dem User gestellt (Kanal offen — Todoist, Chat, Daily Note)
3. Antwort wird in die passende Sektion von `knowledge/me.md` eingearbeitet

**Fragen-Pool (Startset):**

Essen & Trinken:
- Wie trinkst du deinen Kaffee? (Oder Tee?)
- Lieblingsgericht unter der Woche vs. wenn du dir was gönnst?
- Gibt's Essen, das gar nicht geht?
- Lieblingsrestaurant / Lieblings-Bestell-App?

Arbeit & Produktivität:
- Wann bist du am produktivsten? (Tageszeit, Umgebung)
- Welche Musik/Podcasts beim Arbeiten?
- Wie sieht dein idealer Deep-Work-Block aus?
- Tool, ohne das du nicht arbeiten könntest?

Freizeit & Interessen:
- Letzter Film/Serie, die dich gepackt hat?
- Lieblingsspiel (Board, Video, Sport)?
- Wo fährst du am liebsten hin, wenn du mal rauskommst?
- Bucket-List-Item Nr. 1?

Persönlichkeit & Werte:
- Worüber kannst du dich richtig aufregen?
- Welcher Ratschlag hat dir am meisten gebracht?
- Was würdest du deinem 18-jährigen Ich sagen?
- Introvertiert oder extrovertiert? (Oder situationsabhängig?)

Meta / AI:
- Welche AI-Aufgabe spart dir am meisten Zeit?
- Was soll AI niemals für dich entscheiden?
- Gibt's eine Aufgabe, die du gern automatisieren würdest, aber noch nicht geschafft hast?

**Regeln:**
- Max. 1 Frage pro Tag
- Nicht fragen, was schon in `me.md` dokumentiert ist
- Antworten direkt in die passende Sektion einpflegen (nicht als separate Datei)
- Kurz halten — eine Frage, nicht ein Interview

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
