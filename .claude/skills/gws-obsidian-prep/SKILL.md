# gws-obsidian-prep

Cross-skill recipe: fetch today's (or tomorrow's) Google Calendar events via `gws` CLI and create meeting prep notes in the Obsidian vault.

## Prerequisites

- `gws` CLI installed and authenticated (`gws auth login -s calendar`)
- Obsidian CLI available (`which obsidian` - requires Obsidian running)
- Vault path: `~/brain/`

## Trigger phrases

- "What meetings do I have today / tomorrow?"
- "Create prep notes for today's meetings"
- "Show me this week's schedule"
- "Prep note for [meeting name]"

## Step-by-step workflow

### 1. Fetch events

```bash
# Today
gws calendar +agenda --today --format json

# Tomorrow
gws calendar +agenda --tomorrow --format json

# This week
gws calendar +agenda --week --format json
```

Parse the JSON array. Each event has: `summary`, `start.dateTime`, `end.dateTime`, `attendees[]`, `description`, `htmlLink`.

### 2. Filter relevant events

Skip events where:
- `summary` matches `/OOO|Out of Office|Blocked|Focus Time/i`
- Duration < 10 minutes (likely auto-blocks)
- No attendees other than self (solo blocks)

### 3. Check for existing prep note

For each event, check if a prep note already exists:

```bash
obsidian search query="YYYY-MM-DD Event-Name prep"
```

If a note is found, skip creation and report it.

### 4. Create prep note

If no existing note found, create one:

```bash
obsidian create \
  name="meetings/YYYY-MM-DD_Event-Name-prep" \
  content="..." \
  silent
```

**Filename convention:** `YYYY-MM-DD_Event-Name-prep.md`
- Date = event date (not today if prepping ahead)
- Event name: lowercase, hyphens, truncate at 40 chars
- Always suffix `-prep`
- Placed in `meetings/` folder

### 5. Note template

```markdown
---
title: "Prep: {event summary}"
date: YYYY-MM-DD
type: meeting-prep
tags: [meeting-prep]
---

# Prep: {event summary}

**Date:** {date} {start time} – {end time}
**Calendar:** {calendarId or "primary"}

## Attendees

{- Name (email) for each attendee, self last}

## Agenda

{event description if present, else "- [ ] (add agenda items)"}

## My talking points

- [ ]

## Open questions

- [ ]

## Related

{wikilinks to matching project notes - see Project matching below}
```

### 6. Project matching

After creating the note body, search for related project notes:

```bash
obsidian search query="{key words from event summary}"
```

Check `projects/` results. If a file clearly matches (e.g. event is "Acme sprint review" → `projects/acme.md`), append a wikilink to the Related section:

```
[[acme]]
```

Use `qmd vsearch "{event summary}"` as a fallback if obsidian search returns no clear match.

## Output to user

After running, summarise:

```
Created prep notes for N meetings on {date}:
- HH:MM {Event Name} → meetings/YYYY-MM-DD_Event-Name-prep.md (linked: [[project]])
- HH:MM {Event Name} → already existed, skipped
```

## Auth troubleshooting

If `gws calendar +agenda` returns an auth error:

```bash
gws auth login -s calendar
# Follow OAuth browser flow for your Google account
```

Check token status: `gws auth status`

## Notes

- `meetings/` files created by this workflow are **not** Granola-managed - they are safe to edit directly.
- Granola-synced notes use `YYYY-MM-DD_Title With Spaces.md` (spaces); prep notes use hyphens. This is intentional.
- Do not create prep notes in `meetings/` for events already synced by Granola - check for an existing file with the same date + title first.
