# Brain Repo — Claude Instructions

## Purpose
This repo is a personal second brain — reference docs, project notes, meeting notes, and knowledge. Your task manager (Todoist, Linear, etc.) is the task source of truth.

## File Placement Rules

### Directory Guide

| Directory | Content | Examples |
|-----------|---------|---------|
| `projects/` | Project overviews, status pages | `my-saas.md`, `side-project.md` |
| `decisions/` | Non-trivial choices with context + alternatives | `YYYY-MM-DD-short-slug.md` |
| `notes/` | Analyses, brainstorms, research, webinar notes, deep-dives | `api-design-patterns.md` |
| `docs/` | Reference docs, conventions, templates, integrations | `templates.md`, `integrations.md` |
| `meetings/` | Meeting notes (read-only if managed by Granola or similar) | — |
| `context/` | Background context (people, companies, clients) | `clients.md` |
| `working-files/` | Operational files, agent handover prompts, organized by project | `working-files/my-project/` |
| `sources/` | Third-party reference material (gitignored) | — |
| `tasks/` | Task manager sync (managed) | — |
| `tmp/` | Temporary/ephemeral files (email drafts, etc.) | `.eml`, `.html` |
| `archive/` | Done/inactive projects | — |

### What does NOT belong in this repo
- **New project repos / codebases** — keep those in their own repos

### How to choose the right directory
- **Project overview or status page?** → `projects/`
- **Non-trivial choice with alternatives?** → `decisions/`
- **Analysis, brainstorm, or event-based note?** → `notes/`
- **Stable reference, convention, or template?** → `docs/`
- **Operational/working file for a project?** → `working-files/{project}/`
- **Temporary/ephemeral output?** → `tmp/`

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
