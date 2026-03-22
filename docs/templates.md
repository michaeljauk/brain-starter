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

Zweck: Täglich eine kurze Frage stellen, um `context/michael.md` organisch mit persönlichem Kontext anzureichern — Vorlieben, Gewohnheiten, Meinungen, die sich schwer in einem Rutsch abfragen lassen.

**Ablauf:**
1. Agent wählt eine Frage aus dem Pool (oder generiert eine neue, die noch nicht beantwortet ist)
2. Frage wird dem User gestellt (Kanal offen — Todoist, Chat, Daily Note)
3. Antwort wird in die passende Sektion von `context/michael.md` eingearbeitet

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
- Nicht fragen, was schon in `michael.md` dokumentiert ist
- Antworten direkt in die passende Sektion einpflegen (nicht als separate Datei)
- Kurz halten — eine Frage, nicht ein Interview

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
