# brain-starter

An opinionated, Claude Code-powered second brain template built on Obsidian.

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/michaeljauk)

[![GitHub Release](https://img.shields.io/github/v/release/michaeljauk/brain-starter?style=flat&label=latest)](https://github.com/michaeljauk/brain-starter/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Why

A ready-to-fork template that turns a markdown vault into an **AI-augmented knowledge system** using **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** and **[Obsidian](https://obsidian.md)**. Extracted from a real daily-driver vault - not a toy example.

### Opinions baked in

- **Everything is a markdown file** - no databases, no proprietary formats, no lock-in
- **Conventional commits on a knowledge repo** - your brain deserves the same discipline as your code
- **AI does the grunt work** - classifying notes, linking projects, prepping meetings - you focus on thinking
- **Obsidian is the interface, git is the backbone** - version-controlled knowledge with graph view on top
- **Plugins install themselves** - brain-starter ships only vault-native skills; everything else is a plugin you add when you need it

### What's included

- 18 vault-native Claude Code skills - guided setup, template updates, session wrap-up, article ingestion, vault health, semantic search, project sync, and more
- MANIFEST.md indexes - auto-generated directory indexes for LLM two-tier retrieval
- Conventional commits - enforced via commitlint + husky
- Pre-commit meta-doc sync warning - warns if project files changed but README/AGENTS.md weren't updated
- Obsidian-native - wikilinks, frontmatter, callouts, Bases, JSON Canvas, graph view as first-class citizens
- Integration guides - QMD semantic search, Google Calendar, Todoist, Outlook, Jira, browser QA, and more in [`docs/integrations.md`](docs/integrations.md), each with an install and a verify command
- Structured directories - projects, research, knowledge, decisions, meetings, and archive

---

## Quick start

```bash
# 1. Use this template (click "Use this template" on GitHub, or clone)
git clone https://github.com/michaeljauk/brain-starter.git my-brain
cd my-brain

# 2. Install dependencies (commitlint + husky)
pnpm install

# 3. Open in Obsidian
#    File > Open Vault > select the my-brain directory
```

### Bootstrap your brain

Open Claude Code in your vault directory and run:

```
/kickoff
```

It walks you through six phases and checks its own work at each one - identity, first project,
search, integrations, indexes, first commit. Each phase is optional, state is saved to
`.claude/kickoff-state.json`, and re-running resumes where you left off rather than starting over.

Roughly 15 minutes for all six. Skip to a single phase with `/kickoff search` or `/kickoff identity`.

---

## Directory structure

```
my-brain/
├── projects/       Project knowledge, one subdir per project
│   ├── my-saas/    Overview, decisions, working files
│   └── side-project/
├── research/       Non-project research, topic-grouped
│   ├── ai-agents/
│   └── infrastructure/
├── knowledge/      Curated long-lived reference material
├── decisions/      Cross-cutting decisions (project-specific live in projects/)
├── docs/           Repo meta, conventions, templates, skill output
├── meetings/       Meeting notes (manual or auto-synced)
├── tasks/          Task manager sync (if applicable)
├── sources/        Third-party reference material (gitignored)
├── tmp/            Truly ephemeral files with no project association
├── archive/        Done/inactive projects
├── .claude/        Skills + memory for Claude Code
└── .husky/         Git hooks (commitlint + meta-doc sync)
```

> **Tip:** Run `bash docs/scripts/generate-manifests.sh` to generate `MANIFEST.md` index files for each directory. These give the LLM a table of contents for efficient two-tier retrieval.

---

## Included skills

These ship with brain-starter in `.claude/skills/` and work out of the box:

| Skill | Trigger | What it does |
|-------|---------|-------------|
| **kickoff** | `/kickoff` | Guided first-run setup: identity, first project, search, integrations, first commit |
| **update-brain-starter** | `/update-brain-starter` | Show what a newer brain-starter release changes and merge it in, keeping your own edits |
| **wrap-up** | `/wrap-up` | End-of-session review: replay what happened, commit changes, create tasks for loose ends |
| **ingest-article** | `/ingest-article [URL]` | Extract knowledge from a URL or text, classify it, place it in the right vault location |
| **lint-brain** | `/lint-brain` | Vault health check: orphan notes, broken wikilinks, missing frontmatter, staleness |
| **project-sync** | `/project-sync [name]` | Pull live git/GitHub/Jira data and update project status docs |
| **save-answer** | `/save-answer` | File conversation outputs (research, analysis) back into the vault |
| **research-spike** | `/research-spike [topic]` | Chain community research into a structured comparison matrix + recommendation note |
| **gws-obsidian-prep** | "prep notes for today" | Fetch Google Calendar events and create meeting prep notes |
| **sync-brain-starter** | `/sync-brain-starter` | Sync vault skills and configs to a public template repo |
| **log-decision** | `/log-decision` or "log decision: X" | Write a dated decision record with alternatives and rationale |
| **find-skills** | `/find-skills [query]` | Discover and install community agent skills |
| **defuddle** | Auto (URL extraction) | Clean web page extraction via Defuddle CLI - removes clutter, saves tokens |
| **qmd** | Auto (vault search) | Semantic search over the vault via QMD - hybrid BM25 + vector + LLM reranking |
| **obsidian-markdown** | Auto (.md files) | Obsidian Flavored Markdown guide - wikilinks, callouts, embeds, properties |
| **obsidian-bases** | Auto (.base files) | Create database-like views with filters, formulas, and summaries |
| **obsidian-cli** | Auto (vault interaction) | Obsidian CLI reference for reading, creating, searching notes |
| **json-canvas** | Auto (.canvas files) | Create and edit JSON Canvas files - mind maps, flowcharts, visual connections |

---

## Extend with plugins

brain-starter is intentionally minimal. Add capabilities by installing plugin skills globally - they'll be available in every repo, not just your brain.

### How plugins work

Claude Code loads skills from two places:
1. **Project skills** (`.claude/skills/`) - shipped with this template, vault-specific
2. **Global skills** (`~/.claude/skills/`) - installed once, available everywhere

When you install a plugin, it adds its skill to `~/.claude/skills/` and Claude Code picks it up automatically. No changes to brain-starter needed.

### Installing plugins

Some install via `npx skills add`, others are a clone plus a setup script:

```bash
# A skill published for npx skills add
npx skills add https://github.com/owner/repo --agent claude-code --global

# gstack ships its own installer
git clone https://github.com/garrytan/gstack ~/tech/gstack && cd ~/tech/gstack && ./setup
```

Some plugins are standalone CLIs with companion skills. See [`docs/integrations.md`](docs/integrations.md) for setup guides.

### Recommended plugins

These pair well with a second brain workflow:

| Category | Plugin | What it adds | Install |
|----------|--------|-------------|---------|
| **Search** | [QMD](https://github.com/tobi/qmd) | Local semantic search over your vault | `bun install -g @tobilu/qmd` + [setup](docs/integrations.md#qmd---local-semantic-search-optional) |
| **Research** | [last30days](https://github.com/mvanhorn/last30days-skill) | Real-time community research (Reddit, X, HN, YouTube) | [setup](docs/integrations.md#last30days---real-time-community-research-optional) |
| **Calendar** | [gws](https://github.com/googleworkspace/cli) | Google Calendar + Gmail from Claude Code | `npm install -g @googleworkspace/cli` + [setup](docs/integrations.md#google-calendar-via-gws-cli-optional) |
| **Tasks** | [Todoist CLI](https://www.npmjs.com/package/@doist/todoist-cli) | Manage Todoist tasks from the terminal | `npm install -g @doist/todoist-cli` + [setup](docs/integrations.md#todoist-cli-optional) |
| **Email** | [m365 CLI](https://pnp.github.io/cli-microsoft365/) | Outlook email triage and management | [setup](docs/integrations.md#microsoft-365-cli-optional) |
| **Jira** | [acli](https://developer.atlassian.com/cloud/acli/) | Atlassian CLI for Jira/Confluence | [setup](docs/integrations.md#atlassian-cli-optional) |
| **Browser QA** | [gstack](https://github.com/garrytan/gstack) | Headless browser for QA testing and site dogfooding | [setup](docs/integrations.md#gstack---browser-qa-optional) |
| **Browser automation** | [browser-use](https://github.com/browser-use/browser-use) | AI-powered browser interactions | `pip install browser-use` |
| **Documents** | Built into Claude Code | PDF, DOCX, XLSX, PPTX creation and editing | No install needed |
| **Deployments** | [Render CLI](https://render.com/docs/cli) | Deploy, debug, and monitor Render services | [setup](docs/integrations.md#render-cli-optional) |

> **Tip:** Run `/find-skills [what you need]` to discover more community skills.

---

## Decision logging

Say **"log decision: [topic]"** to Claude Code and it will:

1. Ask for context (alternatives, who was involved)
2. Create `decisions/YYYY-MM-DD-short-slug.md` using the template
3. Use today's date

Templates for decisions, meetings, and project briefs are in [`docs/templates.md`](docs/templates.md).

---

## Releases & commit conventions

Conventional Commits are enforced via commitlint. Common patterns for a brain vault:

```bash
docs(project): update project status        # project notes
docs(decision): log auth provider selection  # decisions
chore(vault): backup 2026-03-20             # obsidian auto-sync
chore(skill): improve wrap-up                # skill changes
feat(skill): add new article-ingest skill    # new skills
```

This template is actively maintained. Check the [**Releases**](https://github.com/michaeljauk/brain-starter/releases) page for the latest version, changelog, and downloadable snapshots. Releases are cut automatically from conventional commits - `feat` bumps minor, `fix` bumps patch.

> **Tip:** Watch this repo (Releases only) to get notified when new skills or features land.

## Updating your brain

Your vault learns about new brain-starter releases by itself and can take them over. This works for
vaults made with "Use this template" and for clones, because it does not use git history.

**The check.** A `SessionStart` hook in `.claude/settings.json` runs
`docs/scripts/brain-starter-check.sh`. Once every 7 days it sends one unauthenticated GET request
to `api.github.com/repos/michaeljauk/brain-starter/releases/latest`, in the background. If that
request fails (for example offline), it tries again after an hour at the earliest.
Nothing from your vault is sent; GitHub sees your IP address, as with any request. If a newer
release exists, the session starts with one line:

```
brain-starter 3.9.0 is available (you have 3.8.0). Run /update-brain-starter to see what changes.
```

Settings live in `.brain-starter.json`: `"check": false` turns the check off, and
`"checkIntervalDays"` changes the interval. The result is cached in
`$XDG_CACHE_HOME/brain-starter/` (default `~/.cache/brain-starter/`).

**The update.** `/update-brain-starter` shows the changelog first and changes nothing until you
agree. It then downloads your installed release and the new one and merges three ways, on a new
branch `brain-starter-update/<version>`:

- It touches only files the release lists as template-owned in `.brain-starter.json`: the shipped
  skills, scripts, templates, git hooks, configs and the release workflow. Your notes,
  `.claude/memory/` and your own skills are never touched.
- A file you did not change takes the new version. A file you and the template both changed is
  merged, and Claude explains every conflict. A file you deleted stays deleted. A file the
  template deleted is only proposed for deletion.
- A skill the template renamed moves to its new name together with your edits, and Claude tells
  you the new command (in 3.8.0: `/wrap-session-up` became `/wrap-up`).
- `.claude/settings.json` gets new hooks added; your own hooks and settings stay.
- In `CLAUDE.md`, only the parts between `<!-- brain-starter:begin NAME -->` and
  `<!-- brain-starter:end NAME -->` belong to the template. Write your own instructions outside
  those markers.

Nothing is committed or pushed without your go.

**Vaults from 3.7.0 or older** have neither the check nor the skill yet. Fetch both once from the
latest release, then run the skill; it reads your version from `.release-please-manifest.json`:

```bash
TAG=$(curl -fsSL https://api.github.com/repos/michaeljauk/brain-starter/releases/latest \
  | grep -o '"tag_name": *"[^"]*"' | cut -d'"' -f4)
RAW=https://raw.githubusercontent.com/michaeljauk/brain-starter/$TAG
mkdir -p .claude/skills/update-brain-starter
curl -fsSL "$RAW/.claude/skills/update-brain-starter/SKILL.md" -o .claude/skills/update-brain-starter/SKILL.md
curl -fsSL "$RAW/docs/scripts/brain-starter-update.mjs" -o docs/scripts/brain-starter-update.mjs
```

Then start a new Claude Code session in the vault and run `/update-brain-starter`.

---

## Customization

### Add your projects

Create subdirectories in `projects/` - one per project.

### Configure project sync

Copy `docs/scripts/repos.json.example` to `docs/scripts/repos.json` and add your repos:

```json
{
  "my-project": {
    "repo_path": "~/code/my-project",
    "gh_repo": "your-org/my-project",
    "status_doc": "projects/my-project-status.md",
    "brain_docs": ["projects/my-project.md"]
  }
}
```

### Add your own skills

Create `.claude/skills/my-skill/SKILL.md` with frontmatter:

```yaml
---
name: my-skill
description: What it does and when to trigger it.
---
```

## Prerequisites

| Tool | Required | Purpose |
|------|----------|---------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | Yes | AI assistant that uses the skills |
| [Obsidian](https://obsidian.md) | Yes | Vault interface |
| [pnpm](https://pnpm.io) | Yes | Package manager for commitlint/husky |
| [gh](https://cli.github.com/) | For project-sync | GitHub CLI |

Everything else is a plugin. Install what you need from the [plugin list](#recommended-plugins) or [`docs/integrations.md`](docs/integrations.md).

---

## Recommended Obsidian plugins

These work well with this vault setup:

- **[Todoist Vault Sync](https://github.com/michaeljauk/obsidian-todoist-vault)** - sync Todoist projects & tasks as real markdown files
- **[Granola Sync](https://github.com/mcclellanddj/Granola-to-Obsidian)** - auto-sync AI meeting notes from Granola
- **[Obsidian Git](https://github.com/denolehov/obsidian-git)** - auto-backup to git on interval

---

## Support

Built by [Michael Jauk](https://github.com/michaeljauk). If this saves you time, consider
[buying me a coffee](https://buymeacoffee.com/michaeljauk).

## License

[MIT](./LICENSE) © Michael Jauk. Use it, fork it, make it yours.
