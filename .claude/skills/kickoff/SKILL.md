---
name: kickoff
description: Guided first-run setup for a forked brain-starter vault. Walks through identity, first project, semantic search, integrations, indexes, and the first commit - verifying each phase before moving on. Use when the user has just forked or cloned brain-starter, says "set up my brain", "I just forked brain-starter", or runs /kickoff.
---

# Kickoff

Takes a freshly forked brain-starter from empty template to working vault. A preflight check, then
six phases, each one independently useful. The user can stop after any phase and still have
something better than they started with.

Target: 15 minutes for all six.

## Trigger phrases

- `/kickoff`
- `/kickoff <phase>` - run one phase only (`identity`, `project`, `search`, `integrations`,
  `indexes`, `commit`)
- "I just forked brain-starter"
- "set up my brain"
- "help me personalise this vault"

## Contract

These are not style preferences. Breaking one makes the skill worse than no skill.

- **Every phase is gated.** Ask before starting each one. The user may skip any phase, in any
  order, and skipping is a normal outcome - not a failure.
- **Every phase verifies its own work with a tool call.** An exit code of 0 is not verification.
  Read the file back. Run the query. Check that a known note comes out. If you did not observe the
  result, you may not report the phase as done.
- **Never install anything without asking.** Detect, report, offer the command. The user runs it,
  or approves you running it. This is their machine.
- **Never invent facts about the user.** Everything in `CLAUDE.md` and `knowledge/me.md` comes from
  what they told you in this conversation. An empty section beats a plausible guess.
- **Progress is saved after every phase** to `.claude/kickoff-state.json`, so an interrupted run
  resumes instead of restarting.
- **Re-running is safe.** Completed phases report as already done and are skipped unless the user
  asks to redo one. Never overwrite the user's own edits to a file a previous phase created -
  read it first, and extend rather than replace.

## State file

`.claude/kickoff-state.json`. Create it on first run. Write it after every phase.

```json
{
  "version": 1,
  "started": "YYYY-MM-DD",
  "phases": {
    "preflight":    { "status": "done",    "at": "YYYY-MM-DD" },
    "identity":     { "status": "done",    "at": "YYYY-MM-DD" },
    "project":      { "status": "skipped", "at": "YYYY-MM-DD" },
    "search":       { "status": "failed",  "at": "YYYY-MM-DD", "note": "qmd not installed" },
    "integrations": { "status": "pending" },
    "indexes":      { "status": "pending" },
    "commit":       { "status": "pending" }
  }
}
```

Status is one of `pending`, `done`, `skipped`, `failed`. On start, read the file if it exists and
tell the user where they left off before asking anything else.

## Phase 0 - Preflight

Detect what is present. Report it as a table. Install nothing.

```bash
for t in git pnpm bun node gh qmd; do
  printf '%-6s %s\n' "$t" "$(command -v $t 2>/dev/null || echo 'not found')"
done
```

| Tool | Needed for | If missing |
|------|-----------|------------|
| git | everything | stop - the vault is a git repo |
| pnpm | commitlint, husky | `npm install -g pnpm` |
| bun or node | qmd | either one works |
| gh | `project-sync` | optional, skip the phase |
| qmd | semantic search | phase 3 offers the install |

Also confirm the working directory is the vault root: `.claude/skills/` and `CLAUDE.md` both exist.
If not, stop and ask where the vault is. Every later phase writes relative paths.

**Verify:** git is present and `git rev-parse --show-toplevel` succeeds.

## Phase 1 - Identity

The template's `CLAUDE.md` describes a generic vault. Make it theirs.

Ask, in one message, and accept partial answers:

1. Name, and what they do
2. Company or main context, if any
3. What they want this vault to hold - projects, research, meeting notes, personal
4. Stack defaults worth writing down, if they build software
5. Language for their own notes

Then:

- **`CLAUDE.md`** - add an `## Identity` section near the top with their answers. Leave the File
  Placement Rules alone; those are the template's spine. If they named a task manager, replace the
  generic mention in `## Purpose`.
- **`knowledge/me.md`** - create it with the background they gave, sectioned so the Daily Drip hook
  has somewhere to file answers: Work, Preferences, Tools, Personal. Empty sections are fine and
  are the point.
- **`.claude/memory/MEMORY.md`** - fill the placeholder comments with what you now know.

Creating `knowledge/me.md` also switches on the Daily Drip hook, which stays silent until that file
exists. Say so, and say it asks one question a day. If they do not want it, remove the
`UserPromptSubmit` block from `.claude/settings.json`.

**Verify:** read all three files back and show the user their `## Identity` section.

## Phase 2 - First project

A vault with no content teaches nothing about where things go.

Ask what they are working on right now. Create `projects/{slug}/{slug}.md` from the project brief
template in `docs/templates.md`, filled with what they told you.

If they mention a decision they have already made on it, write that too, as
`projects/{slug}/decisions/YYYY-MM-DD-{slug}.md`. Two files show the pattern better than one.

**Verify:** read the files back. Confirm the frontmatter parses and the date is today's.

## Phase 3 - Semantic search

Grep finds strings. `qmd` finds meaning. The vault gets noticeably more useful with it, and this is
the phase most worth not skipping.

If `qmd` is missing, offer:

```bash
bun install -g @tobilu/qmd     # or: npm install -g @tobilu/qmd
```

Then index the vault:

```bash
qmd collection add . --name brain
qmd embed
```

**Verify - this is the phase where a proxy check is most tempting and most wrong.** `qmd embed`
exiting 0 proves nothing. Query for something you know is in the vault, because you just wrote it
in phase 1 or 2, and confirm it comes back:

```bash
qmd query "<a phrase from the project note you just created>" --collection brain
```

If the note does not come back, the phase failed. Record `failed` with the reason. Do not record
`done`.

Tell them the index is a snapshot: notes written later are invisible to semantic search until the
next `qmd update && qmd embed`. Offer to show them how to schedule it.

## Phase 4 - Integrations

Read `docs/integrations.md` and list what is on offer with one line each. Ask which they want.

For each one they pick: print the install and verify commands from that document. Let them run
them, or ask before running them yourself. Do not chain installs together - one tool, one
verification, then the next.

If they configure `project-sync`, copy `docs/scripts/repos.json.example` to
`docs/scripts/repos.json` and fill in the project from phase 2.

**Verify:** for each tool they installed, run its verify command from `docs/integrations.md` and
report the real output. A tool that installed but does not authenticate is not done.

## Phase 5 - Indexes

Generate the `MANIFEST.md` files that give the agent a table of contents per directory:

```bash
bash docs/scripts/generate-manifests.sh
```

**This script writes with `>` and takes a while on a large vault.** Do not put it behind a short
timeout. If it is interrupted it leaves a half-written file that looks like a valid result. If you
cut it off, delete the partial files and run it again.

**Verify:** list the generated files and check that each is non-empty and ends mid-sentence
nowhere.

## Phase 6 - First commit

Show `git status`. Walk through what the previous phases created.

Commit messages here are checked by commitlint. Conventional Commits, lowercase description,
100 characters maximum on the header **and on every body line**. A long body line is the most
common rejection.

```bash
git add -A
git commit -m "chore(vault): initial setup via kickoff"
```

**Ask before committing.** Never commit unprompted, even inside this skill.

Then run `/wrap-session-up` as an end-to-end smoke test. It exercises the skill loader, the vault
conventions, and the task integration in one go. If it works, the vault works.

## Final report

```
Kickoff complete.

Live:
- Identity: CLAUDE.md, knowledge/me.md, .claude/memory/MEMORY.md
- Project: projects/{slug}/
- Search: qmd indexed {n} notes, verified by query
- Integrations: {list}

Skipped:
- {phase}: {reason the user gave}

Failed:
- {phase}: {what actually happened}

Next:
- {the one thing most worth doing}
```

Report skipped and failed phases plainly. A kickoff where the user skipped four phases is a
success if they got what they wanted. A kickoff that reports six green phases when `qmd` never
returned a result is a failure that looks like a success.

## Never

- Install a tool without asking
- Write a fact about the user that they did not tell you
- Report a phase done without observing its verification output
- Overwrite a file the user edited between runs
- Commit without being asked in this session
- Continue past a failed phase without saying it failed
