# Brain Repo - Claude Instructions

## Purpose
This repo is a personal second brain - reference docs, project notes, meeting notes, and knowledge. Your task manager (Todoist, Linear, etc.) is the task source of truth.

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

## Decision Logging

Trigger: *"log decision: [topic]"*

When asked to log a decision:
1. Ask for context if not provided (what needed deciding, who was involved, alternatives considered)
2. Create `decisions/YYYY-MM-DD-short-slug.md` using the template in `docs/templates.md`
3. Use today's date

## Commit Style
- **Conventional Commits** enforced via commitlint + husky
- Common types for this repo: `docs`, `chore`, `feat`, `fix`, `refactor`
- Common scopes: `vault`, `project`, `decision`, `meeting`, `skill`, `config`
- Examples:
  - `docs(project): update project status`
  - `chore(skill): improve wrap-session-up`
  - `docs(decision): log vendor selection for auth provider`
  - `chore(vault): backup 2026-03-20` (Obsidian auto-sync)
