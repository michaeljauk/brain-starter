# project-sync

On-demand AI-powered sync of a project's repo state into the brain vault. Reads live git/GitHub/Jira data, updates the project status doc, and makes targeted edits to relevant brain docs where content is clearly stale.

## Trigger phrases

- `/project-sync [project-name]`
- "sync my-project"
- "update project docs for [project]"
- "what's the current state of [project]"

Default project: first entry in `repos.json` if no argument given.

## Config

Load project config from `~/brain/scripts/repos.json`. Each entry has:
- `repo_path` — local repo path
- `gh_repo` — GitHub `owner/repo` for `gh` CLI
- `jira` — (optional) `{ "project_key": "PROJ", "site": "your-org.atlassian.net" }`
- `status_doc` — AI-owned status file (always overwritten)
- `brain_docs` — list of brain notes to review and potentially update

## Step-by-step workflow

### 1. Gather repo data

Run these commands against the project's `repo_path`:

```bash
# Recent commits (last 14 days)
git -C {repo_path} log --oneline --since="14 days ago" --format="%h %s (%an, %ar)"

# Active branches (excluding stale)
git -C {repo_path} branch -r --sort=-committerdate | head -20

# Current branch + status
git -C {repo_path} status --short

# Open PRs
gh pr list --repo {gh_repo} --json number,title,author,labels,createdAt,url --limit 20

# Recently merged PRs (last 7 days)
gh pr list --repo {gh_repo} --state merged --json number,title,mergedAt,url --limit 10
```

### 2. Gather Jira data (if configured)

If the project has a `jira` config, use `acli` to pull issue data:

```bash
# Recently updated issues (last 14 days)
acli jira workitem search --jql "project = {project_key} AND updated >= -14d ORDER BY updated DESC" --fields "key,summary,status,assignee,priority" --limit 30 --json

# Current sprint issues
acli jira workitem search --jql "project = {project_key} AND sprint in openSprints() ORDER BY priority ASC" --fields "key,summary,status,assignee,priority" --limit 50 --json

# Blocked / flagged issues
acli jira workitem search --jql "project = {project_key} AND status = Blocked ORDER BY priority ASC" --fields "key,summary,status,assignee,priority" --json

# Issues due this week
acli jira workitem search --jql "project = {project_key} AND duedate <= endOfWeek() AND status != Done ORDER BY duedate ASC" --fields "key,summary,status,assignee,duedate" --json
```

If `acli` is not authenticated or fails, skip Jira data and note it in the status doc.

**Jira workflow awareness:** If your project uses custom Jira statuses (e.g. Dev Review, Waiting for Merge, Staging), document them here so the skill doesn't misclassify them as stale. Only flag mismatches where Jira says "To Do" but a PR/branch exists, or Jira says "In Progress" but no activity in weeks.

### 3. Read brain docs

Read all files listed in `brain_docs` and the `status_doc` (if it exists).

### 3. Write the status doc

Overwrite `{status_doc}` completely. Use this template:

```markdown
---
title: "{Project} — Repo Status"
updated: YYYY-MM-DD HH:MM
type: project-status
tags: [auto-sync, {project}]
---

# {Project} — Repo Status

_Auto-synced: {timestamp}. Review with `git diff` before committing._

---

## Recent Activity

{List of commits from last 14 days, grouped by theme if clear patterns emerge. Not a raw dump — summarise clusters of related commits.}

## Open PRs ({count})

{Table or list: PR number, title, age, author. Flag anything open >5 days.}

## Active Branches

{List branches with last commit date. Flag any that look stale (>2 weeks no commits).}

## Jira Snapshot

{Only if jira config exists. Summarise current sprint status: how many To Do / In Progress / Done. List blocked issues. List issues due this week. Flag tickets with no assignee or stale status. Cross-reference Jira ticket statuses with git/PR activity — flag mismatches (e.g. ticket says "To Do" but a PR exists).}

## Deadlines & Hot Path

{Extract deadline signals from ALL sources: Jira due dates, commit messages, PR titles, branch names, brain docs. Cross-reference across sources for the most accurate picture.}

## Claude's Read

> {2–4 sentences of actual analysis: what is the team focused on right now, any risks or blockers visible from the data, what deserves attention. Be direct and specific — not generic.}
```

### 4. Review and update brain docs

For each file in `brain_docs`, read its current content and compare against fresh repo data. Make **targeted, surgical edits** only where content is clearly stale or wrong. Do NOT rewrite sections that are still accurate.

**Safe to update:**
- Status fields (e.g. `**Status:** In Arbeit` → reflect latest)
- Ticket status tables — update using Jira status as source of truth, cross-referenced with commits/PRs
- `## Aktive Capabilities` table — update status column using Jira ticket status + git/PR evidence
- `## Offene Action Items` — mark items as done if evidence exists

**Never touch:**
- Architecture sections, design decisions, team tables
- ADR references
- Sections with no new signal from the repo data
- The `## Wave-Plan` structure — only update status within it, not the structure

When making edits, use the Edit tool for precise in-place changes. Do not rewrite whole sections.

### 5. Report to user

After all writes are done:

```bash
git -C ~/brain diff --stat
git -C ~/brain diff
```

Output a summary:
```
Project sync complete: {project}

Status doc: projects/{project}-status.md ✓ (overwritten)

Brain doc changes:
- projects/my-project.md — updated ticket status
- projects/my-project-overview.md — no changes needed

Review with: git diff
Commit when satisfied.
```

## Important constraints

- Always show `git diff` output at the end so the user can review before committing
- Never commit — the user reviews and commits manually
- If `gh` CLI is not authenticated, skip PR data and note it in the status doc
- If the repo path doesn't exist, stop and tell the user
- The status doc is fully AI-owned — overwrite without hesitation
- Brain docs are user-owned — edit only what is clearly outdated, with surgical precision
