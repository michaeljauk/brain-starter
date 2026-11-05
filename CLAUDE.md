# Brain Repo - Claude Instructions

## Purpose
This repo is a personal second brain - reference docs, project notes, meeting notes, and knowledge. Your task manager (Todoist, Linear, etc.) is the task source of truth.

<!-- brain-starter:begin kickoff-hint -->
## Not set up yet?

If this file still describes a generic vault, the fork has not been personalised. Run `/kickoff`.
It walks through identity, first project, semantic search, integrations, indexes, and the first
commit, and verifies each phase before moving on.
<!-- brain-starter:end kickoff-hint -->

<!-- brain-starter:begin file-placement -->
## File Placement Rules

### Directory Guide

| Directory | Content | Examples |
|-----------|---------|---------|
| `projects/` | Project knowledge, one subdir per project | `projects/my-saas/`, `projects/side-project/` |
| `research/` | Non-project research, topic-grouped | `research/ai-agents/`, `research/infrastructure/` |
| `knowledge/` | Curated long-lived reference | `knowledge/tools.md` |
| `decisions/` | Cross-cutting decisions with context + alternatives | `YYYY-MM-DD-short-slug.md` |
| `docs/` | Repo meta, templates, skill output | `templates.md`, `integrations.md` |
| `meetings/` | Meeting notes (read-only if managed by Granola or similar) | - |
| `sources/` | Third-party reference material (gitignored) | - |
| `tasks/` | Task manager sync (managed) | - |
| `tmp/` | Truly ephemeral files with no project association | - |
| `archive/` | Done/inactive projects | - |

### What does NOT belong in this repo
- **New project repos / codebases** - keep those in their own repos

### How to choose the right directory
- **Project overview, working file, or anything project-specific?** → `projects/{project}/`
- **Non-project research, analysis, or tool evaluation?** → `research/{topic}/`
- **Curated reference material?** → `knowledge/`
- **Non-trivial choice with alternatives?** → `decisions/` (cross-cutting only; project-specific go in `projects/{project}/decisions/`)
- **Stable reference, convention, or template?** → `docs/`
- **Output files (email drafts, PDFs, data files)?** → `projects/{project}/outputs/`
- **Truly ephemeral, no project association?** → `tmp/`
<!-- brain-starter:end file-placement -->

<!-- brain-starter:begin decision-logging -->
## Decision Logging

Trigger: *"log decision: [topic]"*

When asked to log a decision:
1. Ask for context if not provided (what needed deciding, who was involved, alternatives considered)
2. Create `decisions/YYYY-MM-DD-short-slug.md` using the template in `docs/templates.md`
3. Use today's date
<!-- brain-starter:end decision-logging -->

<!-- brain-starter:begin commit-style -->
## Commit Style
- **Conventional Commits** enforced via commitlint + husky
- Common types for this repo: `docs`, `chore`, `feat`, `fix`, `refactor`
- Common scopes: `vault`, `project`, `decision`, `meeting`, `skill`, `config`
- Examples:
  - `docs(project): update project status`
  - `chore(skill): improve wrap-up`
  - `docs(decision): log vendor selection for auth provider`
  - `chore(vault): backup 2026-03-20` (Obsidian auto-sync)
<!-- brain-starter:end commit-style -->

<!-- brain-starter:begin wrapup-queue -->
## Automatic wrap-up (optional)

If the wrap-up queue is on (`node docs/scripts/wrapup-queue/worker.mjs status`), a background job
wraps up every finished session. It files notes directly and leaves proposals in
`docs/wrapup-inbox/`. Run `/wrapup-inbox` to work through them; nothing in a task manager or issue
tracker is created without the user's answer. To find recent work of other sessions, run
`node docs/scripts/recent-sessions.mjs --hours 8 -k <keyword>`.
<!-- brain-starter:end wrapup-queue -->
