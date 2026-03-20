# brain-starter

An opinionated, Claude Code-powered second brain template built on Obsidian. Skills, automation, and conventions for turning a markdown vault into an AI-augmented knowledge system.

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/michaeljauk)

## What this is

An opinionated, ready-to-use template for a personal knowledge vault that works with **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** (Anthropic's agentic coding tool) and **[Obsidian](https://obsidian.md)**. It's extracted from a real daily-driver vault and encodes specific opinions about how a second brain should work:

- **Everything is a markdown file** — no databases, no proprietary formats, no lock-in
- **Conventional commits on a knowledge repo** — because your brain deserves the same discipline as your code
- **AI does the grunt work** — auto-classifying notes, linking projects, preparing meetings — you focus on thinking
- **Local-first AI** — auto-linking uses Ollama (local LLM), not cloud APIs
- **Obsidian is the interface, git is the backbone** — version-controlled knowledge with graph view on top

It includes:

- **7 Claude Code skills** — session wrap-up, article ingestion, project sync, meeting prep, and more
- **LLM-powered auto-linking** — a post-commit hook that uses Ollama to classify notes into projects
- **Conventional commits** — enforced via commitlint + husky
- **Obsidian-native** — wikilinks, frontmatter, callouts, and graph view as first-class citizens
- **Structured directories** — projects, decisions, notes, meetings, working files, and archive

## Quick start

```bash
# Clone the template
git clone https://github.com/michaeljauk/brain-starter.git my-brain
cd my-brain

# Install dependencies (commitlint + husky)
pnpm install

# Initialize git (if you cloned, it's already a repo)
# Or: git init && git add -A && git commit -m "chore: initial brain setup"

# Open in Obsidian
# File → Open Vault → select the my-brain directory
```

### Optional: enable auto-linking

The auto-link hook classifies notes into projects using a local LLM. To enable it:

1. Install and run [Ollama](https://ollama.com): `brew install ollama && ollama serve`
2. Pull a small model: `ollama pull qwen2.5:3b`
3. Make sure the [Obsidian CLI](https://help.obsidian.md/cli) is available
4. The hook runs automatically on every git commit (via `.husky/post-commit`)

To disable: comment out the line in `.husky/post-commit`.

## Directory structure

```
my-brain/
├── projects/       # Project overviews and status pages
├── decisions/      # Non-trivial choices with context + alternatives
├── notes/          # Analyses, brainstorms, research, deep-dives
├── docs/           # Reference docs, conventions, templates
├── meetings/       # Meeting notes (manual or auto-synced)
├── context/        # Background context (people, companies, clients)
├── working-files/  # Operational files, organized by project
├── tasks/          # Task manager sync (if applicable)
├── sources/        # Third-party reference material (gitignored)
├── tmp/            # Temporary/ephemeral files
├── archive/        # Done/inactive projects
├── .claude/
│   ├── skills/     # Claude Code skills (the AI workflows)
│   └── memory/     # Claude Code's persistent memory
├── .autolink/      # LLM-powered note → project classification
├── .husky/         # Git hooks (commitlint + auto-link)
└── scripts/        # Project sync config and shell hooks
```

## Skills

Skills are Claude Code's way of learning reusable workflows. Each skill lives in `.claude/skills/` and is triggered by slash commands or natural language.

| Skill | Trigger | What it does |
|-------|---------|-------------|
| **wrap-session-up** | `/wrap-session-up` | End-of-session review: replay what happened, commit changes, create tasks for loose ends |
| **ingest-article** | `/ingest-article [URL]` | Extract knowledge from a URL or text, classify it, place it in the right vault location |
| **defuddle** | Auto (when fetching URLs) | Clean web page extraction via Defuddle CLI — removes clutter, saves tokens |
| **obsidian-cli** | Auto (when interacting with vault) | Obsidian CLI reference for reading, creating, searching notes |
| **obsidian-markdown** | Auto (when editing .md files) | Obsidian Flavored Markdown guide — wikilinks, callouts, embeds, properties |
| **project-sync** | `/project-sync [name]` | Pull live git/GitHub/Jira data and update project status docs |
| **gws-obsidian-prep** | "prep notes for today" | Fetch Google Calendar events and create meeting prep notes |

## Auto-linking

The `.autolink/auto-link.sh` script runs after every commit and:

1. Finds unlinked notes in `meetings/`, `notes/`, and `working-files/`
2. Sends each to a local LLM (Ollama) with your project list
3. Sets `project` and `category` frontmatter properties
4. Appends a `[[projects/...]]` wikilink
5. Chains meeting series chronologically (within subdirectories)
6. Links task files back to project hubs

It learns from corrections in `.autolink/corrections.md` — when it gets one wrong, add a row and it won't repeat the mistake.

## Decision logging

Say "log decision: [topic]" to Claude Code and it will:
1. Ask for context (alternatives, who was involved)
2. Create `decisions/YYYY-MM-DD-short-slug.md` using the template
3. Use today's date

Templates for decisions, meetings, and project briefs are in `docs/templates.md`.

## Commit conventions & releases

Conventional Commits are enforced via commitlint. Common patterns for a brain vault:

```bash
docs(project): update project status        # project notes
docs(decision): log auth provider selection  # decisions
chore(vault): backup 2026-03-20             # obsidian auto-sync
chore(skill): improve wrap-session-up        # skill changes
feat(skill): add new article-ingest skill    # new skills
```

This template uses conventional commits not just for discipline — they also power the [changelog](https://github.com/michaeljauk/brain-starter/releases). `feat` = new skill or feature, `fix` = bug fix, `docs` = documentation change.

## Customization

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

## Prerequisites

| Tool | Required | Purpose |
|------|----------|---------|
| [Claude Code](https://claude.ai/claude-code) | Yes | AI assistant that uses the skills |
| [Obsidian](https://obsidian.md) | Yes | Vault interface |
| [pnpm](https://pnpm.io) | Yes | Package manager for commitlint/husky |
| [Obsidian CLI](https://help.obsidian.md/cli) | For auto-link | Read/write notes from terminal |
| [Ollama](https://ollama.com) | For auto-link | Local LLM for note classification |
| [Defuddle](https://github.com/nicholasgriffintn/defuddle) | For ingest-article | Clean web page extraction |
| [gws](https://github.com/nicholasgriffintn/gws) | For meeting prep | Google Calendar CLI |
| [gh](https://cli.github.com/) | For project-sync | GitHub CLI |

## Recommended Obsidian plugins

These work well with this vault setup:

- **[Smart Connections](https://github.com/brianpetro/obsidian-smart-connections)** — semantic search + related notes
- **[Granola Sync](https://github.com/mcclellanddj/Granola-to-Obsidian)** — auto-sync AI meeting notes from Granola
- **[Obsidian Git](https://github.com/denolehov/obsidian-git)** — auto-backup to git on interval

## License

MIT

---

Built by [Michael Jauk](https://github.com/michaeljauk). If this saves you time, consider [buying me a coffee](https://buymeacoffee.com/michaeljauk).
