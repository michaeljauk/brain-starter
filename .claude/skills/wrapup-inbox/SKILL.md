---
name: wrapup-inbox
description: Work through the proposals the automatic wrap-up queue left in docs/wrapup-inbox/ - tasks, issues, fixes outside the vault, open decisions. Shows them as one table, creates only what the user approves, and closes the files. Use when the user says "/wrapup-inbox", "wrap-up proposals", or the session start says wrap-up proposals are open.
---

# Wrap-up inbox

The headless wrap-up job (`docs/scripts/wrapup-queue/`) cannot ask anything, so it writes
proposals into `docs/wrapup-inbox/YYYY-MM-DD-<sid8>.md` (`status: open`). The session start shows
one line while such files exist. This skill turns proposals into actions, **only with the user's
explicit answer**.

## Steps

### 1. Collect

Read every file in `docs/wrapup-inbox/` with `status: open`. Number all proposals across files in
one sequence: tasks first, then issues, then fixes, then decisions, then memory proposals. Also
read each file's `## Filed` section: those notes were written without asking, and the user may
want to check them.

### 2. Check again before you show them

Proposals can be hours or days old. For each task and issue proposal, check that it is still
untracked with the task manager and issue tracker of this vault (see `docs/integrations.md`), for
example `td task list --filter "search: <keyword>"` (plain output, not `--json`) or
`gh issue list --search "<keyword>"`. Mark tracked ones as "already tracked" instead of dropping
them silently.

### 3. Show one table

```
| # | Kind | Proposal | Project/team | Priority | Due | Session | Evidence |
```

Below it, list the decisions with the recommendation, and the filed notes as links. Then ask for
one answer, for example "1, 3, 5 yes; 2 as p1; rest no". Do not create anything before that
answer. An answer that approves some items and asks a new question approves only the named items.

### 4. Do what was approved

- Tasks: create them with the task manager CLI, for example
  `td task add "<task>" --project "<project>" --priority <p> --due "<date>"`.
- Issues: only on an explicit yes per item, with the tracker's CLI, linked to the right project.
- Fixes outside the vault: do not do them inline. Offer a handover prompt for a fresh session.
- Decisions: record the user's answer where the inbox file says (project note or `decisions/`).
- Memory proposals: write the memory file under `.claude/memory/` and its line in `MEMORY.md`,
  following the memory rules of this vault. The headless job cannot write there itself.
- A filed note the user rejects: revert or edit it, and say which.

### 5. Close the files

In each inbox file, write the outcome next to each item (`→ task <id>`, `→ <issue key>`,
`→ rejected`, `→ open`). Set `status: done` when no item is `open`. Never delete an inbox file.

### 6. Report

List what was created (with IDs and links), what was rejected, and what stays open. If the queue
reported failed jobs, run `node docs/scripts/wrapup-queue/worker.mjs status` and show its output.
