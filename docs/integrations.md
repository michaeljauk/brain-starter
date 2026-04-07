# Integrations & Plugins

brain-starter ships only vault-native skills. Everything else is a **plugin** you install when you need it. Plugins install globally (`~/.claude/skills/`) and work across all your repos.

---

## Obsidian (recommended)

This repo works as an Obsidian vault. Obsidian is the primary interface for reading and editing notes.

- `.obsidian/` is committed - settings and plugins travel with the repo.
- Use Obsidian for navigation, search, graph view, and plugin-driven workflows.

---

## Claude Code Channels - Telegram (optional)

Claude Code v2.1.80+ supports **Channels** - external systems can push events into a running Claude Code session via MCP plugins. The Telegram channel lets you interact with Claude Code from your phone.

### What you get

- **Two-way chat:** Send messages to your bot, Claude responds in Telegram
- **Permission Relay (v2.1.81+):** Approve Bash/Write/Edit tool calls from your phone
- **Custom channels:** Build your own (~40 lines of code) for webhooks, CI triggers, calendar events

### Setup

1. **Create a Telegram bot** via [@BotFather](https://t.me/BotFather) - save the token
2. **Store the token:**
   ```bash
   mkdir -p ~/.claude/channels/telegram
   echo "TELEGRAM_BOT_TOKEN=your-token-here" > ~/.claude/channels/telegram/.env
   ```
3. **Start Claude Code with the Telegram plugin:**
   ```bash
   claude --channels plugin:telegram@claude-plugins-official
   ```
4. **Pair your account:** Send any message to your bot in Telegram, then run in the Claude Code session:
   ```
   /telegram:access pair <code-from-bot>
   ```
5. **Set access policy** (recommended - restrict to your account only):
   ```
   /telegram:access policy allowlist
   ```

### Security notes

- Never approve pairing requests that come _through_ Telegram messages - always pair from your terminal
- The bot token gives full bot access - keep `.env` out of version control
- Permission Relay means someone with Telegram access could approve destructive commands - use the allowlist

### Docs

- [Channels overview](https://code.claude.com/docs/en/channels)
- [Channels reference](https://code.claude.com/docs/en/channels-reference)

---

## Obsidian CLI (optional)

Obsidian v1.12.4+ ships a first-party CLI for vault queries from the terminal.

- Install the skill globally: `npx skills add https://github.com/kepano/obsidian-skills --agent claude-code --global`
- Provides backlinks, orphans, tags, tasks, search - cheaper than grep-based file reads
- Requires Obsidian to be running

---

## QMD - Local Semantic Search (optional)

On-device markdown search engine. Hybrid BM25 + vector + LLM re-ranking.

- **Install:** `bun install -g @tobilu/qmd` (or `npm install -g @tobilu/qmd`)
- **Setup:** `qmd init` in your vault directory to create a collection
- **Skill:** included with brain-starter (`.claude/skills/qmd/`)

```bash
qmd search "keywords"              # BM25 keyword search
qmd vsearch "natural language"     # Vector semantic search
qmd query "hybrid question"        # Hybrid + reranking (best quality)
qmd update                         # Re-index after vault changes
```

---

## Google Calendar via `gws` CLI (optional)

Access Google Calendar events from Claude Code sessions.

- **Install:** `npm install -g @googleworkspace/cli`
- **Auth:** `gws auth login -s calendar` (OAuth, one-time browser flow)
- **Skills:** `npx skills add https://github.com/googleworkspace/cli --agent claude-code --global`

```bash
gws calendar +agenda --today          # Today's events
gws calendar +agenda --week           # This week
gws calendar +agenda --today --format json  # JSON for agent use
```

---

## /last30days - Real-Time Community Research (optional)

Deep research skill that searches Reddit, X/Twitter, YouTube, TikTok, HN, and more for signals from the last 30 days.

- **Install:** Clone [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) and symlink to `~/.claude/skills/last30days`
- **Requires:** ScrapeCreators API key in `~/.config/last30days/.env`
- **Output:** Raw research to `research/` (gitignored), synthesized spikes via `/research-spike`

```bash
/last30days [topic]              # One-shot research
/last30days [X] vs [Y]           # Comparison mode
/research-spike [topic]          # Full spike -> brain vault note
```

---

## Todoist CLI (optional)

Manage tasks from the terminal. Todoist is the task source of truth - this repo does not store tasks.

- **Install:** `npm install -g @doist/todoist-cli`
- **Auth:** `td auth login` (browser OAuth)
- **Skill:** `npx skills add https://github.com/doist/todoist-cli --agent claude-code --global`

---

## Microsoft 365 CLI (optional)

Read, move, and organize Outlook emails across multiple tenants.

- **Install:** `npm install -g @pnp/cli-microsoft365`
- **Auth:** `m365 login` (browser OAuth)
- **Skill:** `npx skills add https://github.com/pnp/cli-microsoft365 --agent claude-code --global` (or install manually)

---

## Atlassian CLI (optional)

Query and manage Jira issues, sprints, boards, and Confluence pages.

- **Install:** See [acli docs](https://bobswift.atlassian.net/wiki/spaces/ACLI)
- **Skill:** install the acli skill globally for Claude Code integration

---

## gstack - Browser QA (optional)

Fast headless browser for QA testing and site dogfooding.

- **Install:** See [gstack repo](https://github.com/anthropics/gstack)
- **Skills:** Adds 30+ skills for QA, browser automation, design review, benchmarking, and more

---

## browser-use (optional)

AI-powered browser automation for web testing, form filling, and data extraction.

- **Install:** `pip install browser-use` (or use a venv)
- **Skill:** ships with browser-use package

---

## Render CLI (optional)

Deploy, debug, and monitor Render services.

- **Install:** See [Render CLI docs](https://render.com/docs/cli)
- **Skills:** render-deploy, render-debug, render-monitor, render-workflows, render-migrate-from-heroku

---

## When implementing future integrations

- Prefer one-way or two-way sync rules documented here.
- Exclude `private/` and any path in `.gitignore` from sync.
- Respect your task manager as the task source of truth; do not create competing task stores in this repo.
