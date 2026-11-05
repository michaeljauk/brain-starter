---
name: wrap-up
description: End-of-session review for a Claude Code conversation. Replays what was discussed, checks for open action items, documents relevant outcomes in the brain vault, and creates Todoist tasks for anything untracked. Use at the end of a work session to ensure nothing falls through the cracks. Triggers on "/wrap-up" and "wrap up" (named wrap-session-up before brain-starter 3.8.0).
---

# Wrap Up

End-of-conversation review skill. Replays the current Claude Code session, identifies what was accomplished, what's still open, and documents everything in the right places before the context is lost.

## Trigger phrases

- `/wrap-up`
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
6. **Friction points** — anything that caused repeated correction, workarounds, or user frustration (skill misbehaved, tool returned wrong output, Claude misunderstood something repeatedly, a convention was unclear). Only count it if it happened more than once or was explicitly called out. Step 9a fixes these; it does not log them.

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

For each open item, check if it's already tracked:

**Check Todoist:**
```bash
td task list --filter "search: {keywords}" 2>/dev/null
```

Read the plain output. In at least one `td` version, `--json` returned an empty list for
searches that had matches, so every item looked untracked and the step proposed duplicates. If a
search returns nothing, run it once more with a shorter keyword before calling the item untracked.

**Check the issue tracker for every item, not only for dev work.** Product and ops tasks often
live there too. Example for Jira with the Atlassian CLI `acli` (install it yourself, see
`docs/integrations.md`):
```bash
acli jira workitem search --jql "summary ~ '{keywords}' AND status != Done" --fields "key,summary,status,assignee" --limit 5 --json 2>/dev/null
```

Categorize each item:
- **Already tracked** — exists in Todoist or the issue tracker
- **Needs tracking** — not found, should be created
- **Can skip** — trivial or already handled

### 4. Document in the brain vault

#### Decisions
For non-trivial decisions made during the session:
- Business/product/vendor/architecture → create `decisions/YYYY-MM-DD-short-slug.md` using the template from `docs/templates.md`
- Minor tactical decisions → note in the relevant project file

#### Project notes
If the session surfaced information that should update a project file:
1. Read the relevant `projects/*.md` file
2. Make **surgical edits** for status changes, timeline updates, new risks, changed priorities
3. Don't rewrite sections that are still accurate

#### Working files
If the session produced operational artifacts (plans, specs, handover docs):
- Save to `projects/{project}/` with a descriptive filename

#### Memory
If the session revealed something about the user, their preferences, or their workflow that would be useful in future conversations — save it as a memory file per the memory system rules.

### 5. Compound session outputs

Review the session for Q&A exchanges, research results, or analysis that produced valuable knowledge but wasn't explicitly saved to a file. Common patterns:

- User asked a question, Claude researched the vault/web and gave a detailed answer
- A comparison or analysis was done verbally but not persisted
- A framework or mental model was discussed that would be useful later
- Research was done (web searches, vault queries) that surfaced non-obvious connections

For each valuable output found:

1. **Check if it's already captured** - was a note or file created during the session? If yes, skip.
2. **Assess durability** - will this be useful in 3+ months? Skip ephemeral/obvious stuff.
3. **Propose filing** - suggest creating a note in the appropriate location:
   - Research findings -> `research/{topic}/{descriptive-slug}.md`
   - Project-specific insights -> append to `projects/{project}.md`
   - Decision rationale -> `decisions/YYYY-MM-DD-{slug}.md`
4. **Present to user** - show what would be saved and where, get confirmation before creating

Format for the user:

```
### Compound Outputs

Found N session outputs worth persisting:

| # | Output | Proposed location | Action |
|---|--------|-------------------|--------|
| 1 | {brief description} | `research/ai-agents/foo.md` | Create new |
| 2 | {brief description} | `projects/bar.md` | Append |
```

The goal: explorations and queries in this session should "add up" in the knowledge base (per Karpathy's pattern), not evaporate when the context window closes.

After saving any compound outputs, append entries to `log.md` in the vault root:

```markdown
## [YYYY-MM-DD] save | {Short title}
- **Type:** {research finding | comparison | framework | decision rationale | technical insight}
- **Action:** {Created | Updated} `{file path}`
- **Linked to:** [[note-a]], [[note-b]]
```

### 5b. Auto project-sync (when outside brain repo)

If the current working directory is **not** `~/brain`, check whether it matches a known project repo:

1. Read `~/brain/scripts/repos.json`
2. Expand `~` in each project's `repo_paths` and compare against `$PWD` (match if `$PWD` starts with any repo path)
3. If a match is found, run the `/project-sync` skill for that project name -- this updates the brain's status doc and brain docs with fresh repo/issue-tracker data
4. If no match is found, skip silently -- the repo isn't tracked in the brain

This ensures the brain vault stays current whenever you wrap up a session in a project repo. The synced files will be included in the smart commit step later.

### 6. Create Todoist tasks for untracked items

For open items that need tracking and aren't already in Todoist or the issue tracker:

**IMPORTANT: Always show the proposed tasks to the user first and wait for confirmation before creating them.** Present as a table:

```
| # | Task | Priority | Due |
|---|------|----------|-----|
| 1 | ... | p1 | YYYY-MM-DD |
```

Only after user confirms (or adjusts), create them:

```bash
td task add "{action item}" --project "{project if clear}" --priority {p1-p4} --due "{date if mentioned}"
```

**Priority mapping:**
- Blocking or has a deadline → p1
- Important, no hard deadline → p2
- Nice-to-have → p3

**Do NOT create Todoist tasks for:**
- Items already tracked in the issue tracker (it is the source of truth for dev work)
- Vague ideas without a clear next step
- Things the user explicitly deferred ("maybe someday")

### 7. Regenerate vault indexes

If any `.md` files in `projects/`, `research/`, `knowledge/`, or `decisions/` were created, deleted, or had their frontmatter changed during this session, regenerate the MANIFEST.md indexes:

```bash
bash docs/scripts/generate-manifests.sh
```

This keeps the LLM navigation indexes fresh. Skip if no vault notes were touched.

### 8. Smart commit changes (including regenerated manifests)

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

### 9a. Fix friction points on the spot

Do not keep a friction log. A log that no skill reads only grows: in the original vault, more than
a thousand entries piled up, and the biggest problems recurred for months although a memory
described each of them. Fixes that changed a script or a skill stuck; reminders did not.

For each friction point from step 1, pick the strongest fix that fits, in this order:

1. **Script, hook or tool change** that makes the mistake impossible or loud.
2. **A required step in the skill** where it happened, with a check that fails visibly.
3. **A memory**, only if 1 and 2 do not fit. First check whether a memory on it already exists
   (`qmd query`).
   If it exists and the problem recurred, the memory is not working: propose 1 or 2 instead of
   adding another case to it.

A fix outside this vault (global settings, hooks, other repos) is a proposal in the step 10 report,
not an action.

### 9c. Mine session for shared agent knowledge (cq)

If the `cq` plugin is installed, run `/cq:reflect` to mine the session for reusable learnings. This captures error resolutions, workarounds, and domain-specific knowledge that can prevent future agents from repeating the same mistakes.

If cq is not installed, skip this step silently.

### 10. Report to user

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
| 1 | ... | ✅ Created in Todoist | td#{id} |
| 2 | ... | ⏭ Already in the issue tracker | ACME-123 |
| 3 | ... | ⚠️ Skipped (WIP) | {reason} |

### Documented
- `decisions/YYYY-MM-DD-slug.md` — {summary}
- `projects/foo.md` — updated {what}
- Memory saved: {description}

### Suggested Next Steps
- {What to pick up in the next session}
```

## Important constraints

- **Don't invent items** — only surface action items that were actually discussed or implied in the conversation, not hypothetical improvements
- **Ask before creating** — if more than 3 Todoist tasks would be created, list them first and ask for confirmation
- **Issue tracker over Todoist for dev work** — dev tasks for projects with an issue tracker should be flagged for the tracker, not created in Todoist
- **Respond in session language** — if the session was in German, report in German
- **Don't duplicate** — if something is already tracked, don't create a second tracker
- **Use acli for Jira** — if you use Jira, prefer the `acli` CLI over Atlassian MCP tools
- **Git safety** — smart commit changes (grouped logically), but never push; skip secrets, broken files, and explicit user-deferred changes
