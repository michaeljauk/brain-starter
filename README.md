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
- 🏠 **Local-first AI** — auto-linking runs on [Ollama](https://ollama.com) (local LLM), not cloud APIs
- 🔗 **Obsidian is the interface, git is the backbone** — version-controlled knowledge with graph view on top

### What's included

- 🛠️ **15 Claude Code skills** — session wrap-up, article ingestion, project sync, meeting prep, semantic search, and more
- 🧲 **LLM-powered auto-linking** — a post-commit hook that classifies notes into projects
- 🔍 **Local semantic search** — [QMD](https://github.com/tobi/qmd) for hybrid BM25 + vector search across your vault
- ✅ **Conventional commits** — enforced via commitlint + husky
- 💎 **Obsidian-native** — wikilinks, frontmatter, callouts, Bases, JSON Canvas, graph view as first-class citizens
- 📁 **Structured directories** — projects, decisions, notes, meetings, working files, and archive

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

### 🔌 Optional: enable auto-linking

The auto-link script classifies notes into projects using a local LLM. To set it up:

1. Install and run [Ollama](https://ollama.com): `brew install ollama && ollama serve`
2. Pull a small model: `ollama pull qwen2.5:3b`
3. Make sure the [Obsidian CLI](https://help.obsidian.md/cli) is available
4. Run manually whenever you want to classify unlinked notes:
   ```bash
   bash .autolink/auto-link.sh
   ```

---

## 📁 Directory structure

```
my-brain/
├── 📋 projects/       Project overviews and status pages
├── ⚖️  decisions/      Non-trivial choices with context + alternatives
├── 📝 notes/          Analyses, brainstorms, research, deep-dives
├── 📚 docs/           Reference docs, conventions, templates
├── 🗓️  meetings/       Meeting notes (manual or auto-synced)
├── 👥 context/        Background context (people, companies, clients)
├── 🔧 working-files/  Operational files, organized by project
├── ✅ tasks/          Task manager sync (if applicable)
├── 📦 sources/        Third-party reference material (gitignored)
├── 🗑️  tmp/            Temporary/ephemeral files
├── 🗄️  archive/        Done/inactive projects
├── 🤖 .claude/        Skills + memory for Claude Code
├── 🧲 .autolink/      LLM-powered note → project classification
├── 🪝 .husky/         Git hooks (commitlint)
└── ⚙️  scripts/        Project sync config
```

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
| 📅 **gws-obsidian-prep** | "prep notes for today" | Fetch Google Calendar events and create meeting prep notes |

### Global skills (`~/.claude/skills/`)

These are installed globally and work across all your repos:

| Skill | What it does |
|-------|-------------|
| 🔍 **qmd** | Semantic search over markdown vaults via [QMD](https://github.com/tobi/qmd) — hybrid BM25 + vector + LLM reranking |
| ✅ **todoist-cli** | Manage Todoist tasks, projects, labels via the `td` CLI |
| 🌐 **browser-use** | Automate browser interactions — web testing, form filling, screenshots, data extraction |
| 🔎 **find-skills** | Discover and install community agent skills |
| 🛠️ **skill-creator** | Create, modify, and benchmark agent skills |

---

## 🧲 Auto-linking

The `.autolink/auto-link.sh` script uses a local LLM to automatically organize your notes:

1. 🔍 Finds unlinked notes in `meetings/`, `notes/`, and `working-files/`
2. 🤖 Sends each to Ollama with your project list for classification
3. 🏷️ Sets `project` and `category` frontmatter properties
4. 🔗 Appends a `[[projects/...]]` wikilink
5. ⛓️ Chains meeting series chronologically (within subdirectories)
6. 📌 Links task files back to project hubs

It learns from corrections in `.autolink/corrections.md` — when it gets one wrong, add a row and it won't repeat the mistake.

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

Create files in `projects/` — one per project. The auto-linker reads these to classify notes.

### Configure project sync

Copy `scripts/repos.json.example` to `scripts/repos.json` and add your repos:

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

### Customize auto-link categories

Edit the `get_category()` function in `.autolink/auto-link.sh` to map your meeting subdirectories to category slugs.

---

## 📋 Prerequisites

| Tool | Required | Purpose |
|------|----------|---------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | ✅ Yes | AI assistant that uses the skills |
| [Obsidian](https://obsidian.md) | ✅ Yes | Vault interface |
| [pnpm](https://pnpm.io) | ✅ Yes | Package manager for commitlint/husky |
| [Obsidian CLI](https://help.obsidian.md/cli) | ⚡ For auto-link | Read/write notes from terminal |
| [Ollama](https://ollama.com) | ⚡ For auto-link | Local LLM for note classification |
| [QMD](https://github.com/tobi/qmd) | ⚡ For semantic search | Local hybrid search engine (`npm install -g @tobilu/qmd`) |
| [Defuddle](https://github.com/kepano/defuddle-cli) | ⚡ For ingest-article | Clean web page extraction |
| [gws](https://github.com/googleworkspace/cli) | ⚡ For meeting prep | Google Calendar CLI |
| [gh](https://cli.github.com/) | ⚡ For project-sync | GitHub CLI |
| [Todoist CLI](https://www.npmjs.com/package/@doist/todoist-cli) | ⚡ For task tracking | Todoist from the terminal (`npm install -g @doist/todoist-cli`) |

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
