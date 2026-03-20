---
name: wrap-session-up
description: End-of-session review for a Claude Code conversation. Replays what was discussed, checks for open action items, documents relevant outcomes in the brain vault, and creates tasks for anything untracked. Use at the end of a work session to ensure nothing falls through the cracks.
---

# Wrap Session Up

End-of-conversation review skill. Replays the current Claude Code session, identifies what was accomplished, what's still open, and documents everything in the right places before the context is lost.

## Trigger phrases

- `/wrap-session-up`
- "wrap up this session"
- "anything left open?"
- "let's wrap up"

## Step-by-step workflow

### 1. Replay the session

Review the full conversation history. Extract:

1. **What was accomplished** — files created/edited, commands run, problems solved
2. **Open action items** — things discussed but not yet done, commitments made ("I'll do that later", "next step is..."), tasks the user mentioned wanting to do
3. **Decisions made** — technology choices, architecture decisions, approach changes
4. **New knowledge surfaced** — things learned about the project, codebase, or tools that should be persisted
5. **Files touched** — all files created or modified during the session

Run `git diff --stat` to get a concrete picture of what changed.

### 2. Check for loose ends

For each open item identified, check if it was resolved later in the session or if it's genuinely still open. Common patterns:

- User said "I'll handle X" → still open, needs tracking
- User asked to do X but conversation moved on → still open
- A TODO/FIXME was added in code → still open
- An error was hit but not fully resolved → still open
- User mentioned wanting to follow up on something → still open

Also check for:
- **Uncommitted changes** — `git status` and `git diff --stat` to see what changed
- **Unfinished edits** — files partially modified
- **Broken state** — tests failing, build errors introduced

### 3. Cross-reference action items

For each open item, check if it's already tracked in your task manager (Todoist, Linear, Jira, etc.).

Categorize each item:
- **Already tracked** — exists in task manager
- **Needs tracking** — not found, should be created
- **Can skip** — trivial or already handled

### 4. Document in the brain vault

#### Decisions
For non-trivial decisions made during the session:
- Create `decisions/YYYY-MM-DD-short-slug.md` using the template from `docs/templates.md`

#### Project notes
If the session surfaced information that should update a project file:
1. Read the relevant `projects/*.md` file
2. Make **surgical edits** for status changes, timeline updates, new risks, changed priorities
3. Don't rewrite sections that are still accurate

#### Working files
If the session produced operational artifacts (plans, specs, handover docs):
- Save to `working-files/{project}/` with a descriptive filename

#### Memory
If the session revealed something about the user, their preferences, or their workflow that would be useful in future conversations — save it as a memory file per the memory system rules.

### 5. Create tasks for untracked items

For open items that need tracking and aren't already in your task manager, create them using your configured CLI tool (e.g. `td task add`, `linear issue create`, etc.).

**Do NOT create tasks for:**
- Items already tracked elsewhere
- Vague ideas without a clear next step
- Things the user explicitly deferred ("maybe someday")

### 6. Smart commit changes

If there are uncommitted changes, group and commit them intelligently:

1. Run `git status` and `git diff --stat` to understand all changes
2. **Group related changes** into logical commits. For example:
   - Brain vault notes (decisions, project updates, working files) → one commit
   - Code changes for feature X → one commit
   - Config/tooling changes → one commit
   - If everything is part of one logical unit of work → single commit is fine
3. For each commit group:
   - Stage only the relevant files (`git add <specific files>`)
   - Use **conventional commits** (enforced by commitlint): `type(scope): description`
   - Common types: `docs`, `chore`, `feat`, `fix`, `refactor`
   - Common scopes: `vault`, `project`, `decision`, `meeting`, `skill`, `config`
4. **Do NOT commit:**
   - Files that look like secrets, credentials, or `.env` files
   - Files in a broken/half-finished state — flag these for the user instead
   - Changes the user explicitly said they'd handle themselves
5. **Never push** — commits stay local; the user decides when to push

If unsure whether something should be committed (e.g., experimental changes, WIP code), ask the user before committing.

### 7. Report to user

Present a structured summary:

```
## Session Wrap-Up

### Accomplished
- {What got done — files created, problems solved, features built}

### Commits
- `abc1234` — {commit message}
- `def5678` — {commit message}
{or: "No changes to commit"}

### Open Items

| # | Item | Status | Action |
|---|------|--------|--------|
| 1 | ... | Created in task manager | {id} |
| 2 | ... | Already tracked | {id} |
| 3 | ... | Skipped (WIP) | {reason} |

### Documented
- `decisions/YYYY-MM-DD-slug.md` — {summary}
- `projects/foo.md` — updated {what}
- Memory saved: {description}

### Suggested Next Steps
- {What to pick up in the next session}
```

## Important constraints

- **Don't invent items** — only surface action items that were actually discussed or implied in the conversation, not hypothetical improvements
- **Ask before creating** — if more than 3 tasks would be created, list them first and ask for confirmation
- **Respond in session language** — if the session was in German, report in German
- **Don't duplicate** — if something is already tracked, don't create a second tracker
- **Git safety** — smart commit changes (grouped logically), but never push; skip secrets, broken files, and explicit user-deferred changes
