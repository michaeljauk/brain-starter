# 🧠 brain-starter

An opinionated, Claude Code-powered second brain template built on Obsidian.

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/michaeljauk)

[![GitHub Release](https://img.shields.io/github/v/release/michaeljauk/brain-starter?style=flat&label=latest)](https://github.com/michaeljauk/brain-starter/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 💡 What this is

A ready-to-fork template that turns a markdown vault into an **AI-augmented knowledge system** using **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** and **[Obsidian](https://obsidian.md)**. Extracted from a real daily-driver vault — not a toy example.

### Opinions baked in

- 📄 **Everything is a markdown file** — no databases, no proprietary formats, no lock-in
- 🔒 **Conventional commits on a knowledge repo** — your brain deserves the same discipline as your code
- 🤖 **AI does the grunt work** — classifying notes, linking projects, prepping meetings — you focus on thinking
- 🔗 **Obsidian is the interface, git is the backbone** — version-controlled knowledge with graph view on top

### What's included

- 🛠️ **80 Claude Code skills** — session wrap-up, article ingestion, vault health checks, project sync, meeting prep, semantic search, document generation, QA testing, code review, deployment workflows, and more
- 🔍 **Local semantic search** — [QMD](https://github.com/tobi/qmd) for hybrid BM25 + vector search across your vault
- 📇 **MANIFEST.md indexes** — auto-generated directory indexes for LLM two-tier retrieval (read index first, then fetch specific files)
- ✅ **Conventional commits** — enforced via commitlint + husky
- 🔔 **Pre-commit meta-doc sync warning** — warns if project files changed but README/AGENTS.md weren't updated
- 💎 **Obsidian-native** — wikilinks, frontmatter, callouts, Bases, JSON Canvas, graph view as first-class citizens
- 📡 **Integration guides** — Telegram Channels (remote control from phone), Obsidian CLI, QMD, Google Calendar, and more in [`docs/integrations.md`](docs/integrations.md)
- 📁 **Structured directories** — projects (one subdir per project), research (topic-grouped), knowledge, decisions, meetings, and archive

---

## 🚀 Quick start

```bash
# 1. Use this template (click "Use this template" on GitHub, or clone)
git clone https://github.com/michaeljauk/brain-starter.git my-brain
cd my-brain

# 2. Install dependencies (commitlint + husky)
pnpm install

# 3. Open in Obsidian
#    File → Open Vault → select the my-brain directory
```

### 🧠 Bootstrap your brain

After cloning, open Claude Code in your vault directory and paste this prompt to personalize everything:

```
I just forked brain-starter. Help me set it up:

1. Update CLAUDE.md with my identity (name, role, company, stack defaults)
2. Create my first project file in projects/
3. Set up qmd for semantic search: `npm install -g @tobilu/qmd && qmd collection add . --name brain && qmd embed`
4. Create knowledge/me.md with background context about me
5. Run a test: /wrap-session-up

Here's who I am: [tell Claude about yourself, your role, your projects]
```

Claude Code will walk you through personalizing the vault, installing tools, and creating your first notes.

---

## 📁 Directory structure

```
my-brain/
├── 📋 projects/       Project knowledge, one subdir per project
│   ├── my-saas/       Overview, decisions, working files for this project
│   └── side-project/  Everything about this project in one place
├── 🔬 research/       Non-project research, topic-grouped
│   ├── ai-agents/     AI agent ecosystem, patterns, tools
│   ├── infrastructure/ Hosting, deployment, databases
│   └── business/      Pricing, GTM, startup strategy
├── 📚 knowledge/      Curated long-lived reference material
├── ⚖️  decisions/      Cross-cutting decisions (project-specific live in projects/)
├── 📄 docs/           Repo meta, conventions, templates, skill output
├── 🗓️  meetings/       Meeting notes (manual or auto-synced)
├── ✅ tasks/          Task manager sync (if applicable)
├── 📦 sources/        Third-party reference material (gitignored)
├── 🗑️  tmp/            Temporary/ephemeral files
├── 🗄️  archive/        Done/inactive projects
├── 🤖 .claude/        Skills + memory for Claude Code
└── 🪝 .husky/         Git hooks (commitlint + meta-doc sync)
```

> **Tip:** Run `bash docs/scripts/generate-manifests.sh` to generate `MANIFEST.md` index files for each directory. These give the LLM a table of contents for efficient two-tier retrieval.

---

## 🤖 Skills

Skills are Claude Code's reusable workflows. Each lives in `.claude/skills/` and is triggered by slash commands or natural language.

### Vault skills (`.claude/skills/`)

| Skill | Trigger | What it does |
|-------|---------|-------------|
| 🔄 **wrap-session-up** | `/wrap-session-up` | End-of-session review: replay what happened, commit changes, create tasks for loose ends |
| 📥 **ingest-article** | `/ingest-article [URL]` | Extract knowledge from a URL or text, classify it, place it in the right vault location |
| 🧹 **defuddle** | Auto (when fetching URLs) | Clean web page extraction via Defuddle CLI — removes clutter, saves tokens |
| 💻 **obsidian-cli** | Auto (when interacting with vault) | Obsidian CLI reference for reading, creating, searching notes |
| ✍️ **obsidian-markdown** | Auto (when editing .md files) | Obsidian Flavored Markdown guide — wikilinks, callouts, embeds, properties |
| 📊 **obsidian-bases** | Auto (when working with .base files) | Create database-like views with filters, formulas, and summaries |
| 🗺️ **json-canvas** | Auto (when working with .canvas files) | Create and edit JSON Canvas files — mind maps, flowcharts, visual connections |
| 🔄 **project-sync** | `/project-sync [name]` | Pull live git/GitHub/Jira data and update project status docs |
| 🔬 **research-spike** | `/research-spike [topic]` | Chain `/last30days` into a structured comparison matrix + recommendation note |
| 📅 **gws-obsidian-prep** | "prep notes for today" | Fetch Google Calendar events and create meeting prep notes |
| 📧 **email-triage** | "triage my inbox" | Scan, categorize, and organize Outlook emails — human-in-the-loop before moving |
| 🔄 **sync-brain-starter** | `/sync-brain-starter` | Sync reusable skills and configs to a public template repo |
| 🩺 **lint-brain** | `/lint-brain` | Vault health check: orphan notes, broken wikilinks, missing frontmatter, staleness, duplicates, decision decay |

### Global skills (`~/.claude/skills/`)

These are installed globally and work across all your repos:

**Search & Research**

| Skill | What it does |
|-------|-------------|
| 🔍 **qmd** | Semantic search over markdown vaults via [QMD](https://github.com/tobi/qmd) — hybrid BM25 + vector + LLM reranking |
| 📰 **last30days** | Deep research across 10+ sources (Reddit, X, YouTube, HN, Bluesky, web) with AI synthesis |
| 🔎 **find-skills** | Discover and install community agent skills |
| 💾 **save-answer** | File conversation outputs (research, analysis) back into the vault so they compound |

**Task & Project Management**

| Skill | What it does |
|-------|-------------|
| ✅ **todoist-cli** | Manage Todoist tasks, projects, labels via the `td` CLI |
| 🔧 **acli** | Atlassian CLI — query and manage Jira issues, sprints, boards, Confluence pages |
| 📧 **m365** | Microsoft 365 CLI — read, move, and organize Outlook emails |
| 📧 **gws-gmail** | Gmail — send, read, and manage email |
| 📅 **gws-calendar** | Google Calendar — manage calendars and events |
| 📋 **gws-calendar-agenda** | Google Calendar — show upcoming events across all calendars |
| 🔗 **gws-shared** | Google Workspace CLI — shared patterns for auth, flags, output formatting |
| 🗓️ **gws-workflow-meeting-prep** | Google Workflow — prepare for meetings with agenda, attendees, and docs |

**Development & Frameworks**

| Skill | What it does |
|-------|-------------|
| 🎨 **frontend-design** | Create production-grade frontend interfaces with high design quality |
| ⚡ **nextjs** | Build Next.js 16 apps — App Router, Server Components, Cache Components, async params |
| 🧱 **payload** | Work with Payload CMS 3 — collections, hooks, access control, validation |
| 🎯 **shadcn-ui** | shadcn/ui component library — installation, forms with React Hook Form + Zod, theming |
| 🔐 **workos** | WorkOS authentication — SSO, SAML, SCIM, RBAC, roles, permissions |
| 🧩 **workos-widgets** | Build and integrate WorkOS Widgets for user management and admin portals |
| 🏗️ **mcp-builder** | Guide for creating MCP servers to integrate external APIs and services |

**Testing & QA**

| Skill | What it does |
|-------|-------------|
| 🧪 **webapp-testing** | Test local web apps with Playwright — screenshots, browser logs, UI verification |
| 🌐 **browser-use** | Automate browser interactions — web testing, form filling, screenshots, data extraction |
| 🔍 **browse** | Fast headless browser for QA testing and site dogfooding |
| 🏁 **qa** | Systematically QA test a web app and fix bugs found |
| 📋 **qa-only** | Report-only QA testing — structured report without fixing |
| 🍪 **setup-browser-cookies** | Import cookies from your real browser into headless sessions |
| 🔌 **connect-chrome** | Launch real Chrome controlled by skills with Side Panel extension |
| 📊 **benchmark** | Performance regression detection — page load, Core Web Vitals, resource sizes |
| 🐦 **canary** | Post-deploy canary monitoring — watch for console errors, regressions |

**Code Review & Shipping**

| Skill | What it does |
|-------|-------------|
| 🔍 **review** | Pre-landing PR review — SQL safety, trust boundaries, conditional side effects |
| 🚀 **ship** | Ship workflow — tests, review, version bump, changelog, PR creation |
| 🛬 **land-and-deploy** | Merge PR, wait for CI, verify production health |
| ⚙️ **setup-deploy** | Configure deployment settings for land-and-deploy |
| 🤖 **codex** | OpenAI Codex CLI — independent review, adversarial challenges, consultation |

**Planning & Strategy**

| Skill | What it does |
|-------|-------------|
| 👔 **plan-ceo-review** | CEO/founder-mode plan review — rethink the problem, find the 10-star product |
| 🎨 **plan-design-review** | Designer's eye plan review — rates design dimensions, suggests improvements |
| 🔧 **plan-eng-review** | Eng manager-mode plan review — architecture, data flow, edge cases |
| 📐 **autoplan** | Auto-review pipeline — runs CEO, design, and eng reviews sequentially |
| 🏢 **office-hours** | YC Office Hours — startup forcing questions or builder-mode brainstorming |
| 🔒 **cso** | Chief Security Officer mode — infrastructure audit, OWASP, STRIDE modeling |
| 🔍 **devex-review** | Live developer experience audit — navigate docs, test getting started, time TTHW |
| 📐 **plan-devex-review** | Developer Experience plan review — rates 8 DX dimensions with scorecard |
| 🔬 **investigate** | Systematic debugging — investigate, analyze, hypothesize, implement. No fixes without root cause |

**Document Generation**

| Skill | What it does |
|-------|-------------|
| 📄 **docx** | Create, read, edit Word documents — tables of contents, formatting, images |
| 📊 **xlsx** | Create, read, edit spreadsheets — formulas, formatting, charts, data cleaning |
| 📑 **pptx** | Create, read, edit PowerPoint presentations — layouts, speaker notes, templates |
| 📕 **pdf** | Read, merge, split, rotate, watermark, encrypt, OCR PDF files |
| 🎨 **design-html** | Generate production-quality HTML/CSS from approved mockups |
| 🎯 **design-shotgun** | Generate multiple design variants and compare in a board |
| 🖌️ **design-consultation** | Design system creation — aesthetic, typography, color, layout, motion |
| 🔍 **design-review** | Designer's eye QA — visual inconsistency, spacing, hierarchy, AI slop detection |

**DevOps & Infrastructure**

| Skill | What it does |
|-------|-------------|
| 🚀 **render-deploy** | Deploy apps to Render — analyze codebases, generate Blueprints |
| 🐛 **render-debug** | Debug failed Render deployments — logs, metrics, error analysis |
| 📈 **render-monitor** | Monitor Render services — health, performance, resource usage |
| 🔄 **render-workflows** | Set up, develop, test, and deploy Render Workflows |
| 🚚 **render-migrate-from-heroku** | Migrate from Heroku to Render — read project files, generate services |

**Utilities**

| Skill | What it does |
|-------|-------------|
| 🛠️ **skill-creator** | Create, modify, and benchmark agent skills |
| 📖 **document-release** | Post-ship documentation update — README, CHANGELOG, ARCHITECTURE |
| 📒 **learn** | Manage project learnings — review, search, prune, export |
| 🔄 **retro** | Weekly engineering retrospective — commit analysis, work patterns, team contributions |
| ❤️ **health** | Code quality dashboard — type checker, linter, tests, dead code, composite score |
| 💾 **checkpoint** | Save and resume working state checkpoints across sessions |
| 🔒 **freeze** | Restrict file edits to a specific directory for the session |
| 🔓 **unfreeze** | Clear the freeze boundary, allow edits everywhere again |
| 🛡️ **careful** | Safety guardrails for destructive commands — warns before rm -rf, DROP TABLE, force-push |
| 🛡️ **guard** | Full safety mode — combines careful + freeze for maximum protection |
| 📈 **parqet** | Portfolio tracker CLI — fetch value, holdings, performance, and activities |
| ⬆️ **gstack-upgrade** | Upgrade gstack skill pack to the latest version |
| 🧰 **gstack** | Fast headless browser for QA testing and site dogfooding |

---

## ⚖️ Decision logging

Say **"log decision: [topic]"** to Claude Code and it will:

1. Ask for context (alternatives, who was involved)
2. Create `decisions/YYYY-MM-DD-short-slug.md` using the template
3. Use today's date

Templates for decisions, meetings, and project briefs are in [`docs/templates.md`](docs/templates.md).

---

## 📦 Releases & commit conventions

Conventional Commits are enforced via commitlint. Common patterns for a brain vault:

```bash
docs(project): update project status        # project notes
docs(decision): log auth provider selection  # decisions
chore(vault): backup 2026-03-20             # obsidian auto-sync
chore(skill): improve wrap-session-up        # skill changes
feat(skill): add new article-ingest skill    # new skills
```

This template is actively maintained. Check the [**Releases**](https://github.com/michaeljauk/brain-starter/releases) page for the latest version, changelog, and downloadable snapshots. Releases are cut automatically from conventional commits — `feat` bumps minor, `fix` bumps patch.

> 💡 **Tip:** Watch this repo (Releases only) to get notified when new skills or features land.

---

## 🎨 Customization

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

## 📋 Prerequisites

| Tool | Required | Purpose |
|------|----------|---------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | ✅ Yes | AI assistant that uses the skills |
| [Obsidian](https://obsidian.md) | ✅ Yes | Vault interface |
| [pnpm](https://pnpm.io) | ✅ Yes | Package manager for commitlint/husky |
| [QMD](https://github.com/tobi/qmd) | ⚡ For semantic search | Local hybrid search engine (`npm install -g @tobilu/qmd`) |
| [Defuddle](https://github.com/kepano/defuddle-cli) | ⚡ For ingest-article | Clean web page extraction |
| [gws](https://github.com/googleworkspace/cli) | ⚡ For meeting prep | Google Calendar CLI |
| [gh](https://cli.github.com/) | ⚡ For project-sync | GitHub CLI |
| [Todoist CLI](https://www.npmjs.com/package/@doist/todoist-cli) | ⚡ For task tracking | Todoist from the terminal (`npm install -g @doist/todoist-cli`) |
| [browser-use](https://github.com/browser-use/browser-use) | ⚡ For browser automation | AI-powered browser interactions (`pip install browser-use`) |
| [acli](https://bobswift.atlassian.net/wiki/spaces/ACLI) | ⚡ For Jira/Confluence | Atlassian CLI for issue and page management |
| [Render CLI](https://render.com/docs/cli) | ⚡ For Render skills | Deploy, debug, and monitor Render services |
| [m365 CLI](https://pnp.github.io/cli-microsoft365/) | ⚡ For Outlook email | Microsoft 365 CLI for email triage |

---

## 🧩 Recommended Obsidian plugins

These work well with this vault setup:

- ✅ **[Todoist Vault Sync](https://github.com/michaeljauk/obsidian-todoist-vault)** — sync Todoist projects & tasks as real markdown files (bidirectional, works with Dataview)
- 🎙️ **[Granola Sync](https://github.com/mcclellanddj/Granola-to-Obsidian)** — auto-sync AI meeting notes from Granola
- 🔄 **[Obsidian Git](https://github.com/denolehov/obsidian-git)** — auto-backup to git on interval

---

## 📄 License

MIT — use it, fork it, make it yours.

---

Built with 🧠 by [Michael Jauk](https://github.com/michaeljauk). If this saves you time, consider [buying me a coffee](https://buymeacoffee.com/michaeljauk) ☕
