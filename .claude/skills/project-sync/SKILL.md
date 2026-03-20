# project-sync

On-demand AI-powered sync of a project's repo state into the brain vault. Reads live git/GitHub data, updates the project status doc, and makes targeted edits to relevant brain docs where content is clearly stale.

## Trigger phrases

- `/project-sync [project-name]`
- "sync [project]"
- "update project docs for [project]"
- "what's the current state of [project]"

## Config

Load project config from `scripts/repos.json`. Each entry has:
- `repo_path` — local repo path
- `gh_repo` — GitHub `owner/repo` for `gh` CLI
- `jira` — (optional) `{ "project_key": "XX", "site": "your-site.atlassian.net" }`
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

If the project has a `jira` config, use your Jira CLI to pull issue data:

```bash
# Recently updated issues (last 14 days)
# Current sprint issues
# Blocked / flagged issues
# Issues due this week
```

If the CLI is not authenticated or fails, skip Jira data and note it in the status doc.

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

{List of commits from last 14 days, grouped by theme if clear patterns emerge.}

## Open PRs ({count})

{Table or list: PR number, title, age, author. Flag anything open >5 days.}

## Active Branches

{List branches with last commit date. Flag any that look stale (>2 weeks no commits).}

## Jira Snapshot

{Only if jira config exists. Summarise current sprint status.}

## Deadlines & Hot Path

{Extract deadline signals from ALL sources.}

## Claude's Read

> {2–4 sentences of actual analysis: what is the team focused on, any risks or blockers, what deserves attention.}
```

### 4. Review and update brain docs

For each file in `brain_docs`, read its current content and compare against fresh repo data. Make **targeted, surgical edits** only where content is clearly stale or wrong. Do NOT rewrite sections that are still accurate.

**Safe to update:**
- Status fields
- Ticket status tables
- Active items tables — update status column
- Open action items — mark items as done if evidence exists

**Never touch:**
- Architecture sections, design decisions, team tables
- Sections with no new signal from the repo data

### 5. Report to user

After all writes are done:

```bash
git diff --stat
git diff
```

Output a summary:
```
Project sync complete: {project}

Status doc: projects/{project}-status.md (overwritten)

Brain doc changes:
- projects/{project}.md — updated status
- projects/{project}.md — no changes needed

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
