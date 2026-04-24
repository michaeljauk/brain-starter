# Integrations

## Obsidian (active)

This repo is an Obsidian vault. Obsidian is the primary interface for reading and editing notes.

- `.obsidian/` is committed — settings and plugins travel with the repo; this is intentional.
- Use Obsidian for navigation, search, graph view, and plugin-driven workflows.

## Granola → Obsidian sync (active)

Meeting notes are synced from Granola via the **`granola-sync-plus`** Obsidian plugin.

- The plugin auto-populates `meetings/` — do **not** manually edit or rename those files.
- Granola files use the filename pattern `YYYY-MM-DD_Title With Spaces.md` (underscore separator, title-case with spaces). This differs from the manual convention but is intentional — do not "correct" it.
- Treat all files in `meetings/` created by Granola sync as read-only; edits belong in Granola itself.

## AI Agent Access to Vault (active)

### Obsidian CLI (Claude Code + Cursor)
Obsidian v1.12.4+ ships a first-party CLI. PATH is set in `~/.zprofile`.

- Skill installed at `~/.claude/skills/obsidian-cli/` (Claude Code, global)
- Skill installed at `~/.cursor/skills/obsidian-cli/` (Cursor, global)
- Skill installed at `brain/.claude/skills/obsidian-cli/` (vault-local fallback)
- Use for vault queries from Claude Code/Cursor — uses Obsidian's internal graph (backlinks, orphans, tags, tasks), far cheaper than grep-based file reads
- Requires Obsidian to be running

### ~~obsidian-mcp~~ (removed 2026-03-22)
Replaced by Obsidian CLI skill + kepano/obsidian-skills. MCP server removed from all clients.

### QMD — Local Semantic Search (Claude Code + Cursor + Codex)
On-device search engine for markdown. Hybrid BM25 + vector + LLM re-ranking via node-llama-cpp. Replaces smart-connections-mcp.

- **CLI:** `qmd` v2.0.1, installed via `bun install -g @tobilu/qmd`
- **Repo:** `~/tech/qmd` (cloned from [tobi/qmd](https://github.com/tobi/qmd))
- **Collection:** `brain` → `~/brain` (765 files indexed)
- **Skill:** installed globally at `~/.claude/skills/qmd/`, `~/.cursor/skills/qmd/`, `~/.codex/skills/qmd/`
- **No MCP needed** — agents use `qmd` CLI directly via skill

```bash
qmd search "keywords"              # BM25 keyword search
qmd vsearch "natural language"     # Vector semantic search
qmd query "hybrid question"        # Hybrid + reranking (best quality)
qmd get "path/to/file.md"          # Retrieve full document
qmd update                         # Re-index after vault changes
qmd embed                          # Refresh vector embeddings
```

### ~~smart-connections-mcp~~ (removed 2026-03-22)
Replaced by QMD. MCP server removed from all clients.

---

## Keeping this file current

Update this file when:
- A new integration becomes active (move from planned → active, add accurate details)
- An existing integration changes tool, config path, or setup
- An integration is removed or deprecated

---

## Google Calendar via `gws` CLI (active)

Google Calendar events from your Google account are accessible via the official `gws` CLI.

- **CLI:** `gws` v0.16.0, installed via npm (`npm install -g @googleworkspace/cli`)
- **Auth:** OAuth 2.0 — run `gws auth login -s calendar` once to authorize; token persisted locally
- **Scope:** calendar read + write (only Calendar API enabled on personal GCP project `personal-gws`)

### Skills installed (global, `~/.claude/skills/`)

| Skill | Purpose |
|-------|---------|
| `gws-shared` | Auth, global flags, security rules — prerequisite for all gws skills |
| `gws-calendar` | Full Calendar API reference (events, acl, calendarList) |
| `gws-calendar-agenda` | `gws calendar +agenda --today/--week` helper |
| `gws-workflow-meeting-prep` | `gws workflow +meeting-prep` — next meeting with attendees + docs |

Installed via: `npx skills add https://github.com/googleworkspace/cli --agent claude-code --global`

### Custom cross-skill recipe

`brain/.claude/skills/gws-obsidian-prep/SKILL.md` — combines `gws calendar` with `obsidian` CLI to create meeting prep notes in the vault. Defines the prep note template, naming convention (`YYYY-MM-DD_Event-Name-prep.md` in `meetings/`), and project matching via search.

### Quick reference

```bash
gws calendar +agenda --today          # today's events (terminal)
gws calendar +agenda --week           # this week
gws calendar +agenda --today --format json  # JSON for agent use
gws auth status                       # check token
gws auth login -s calendar            # re-auth if needed
```

### Auth setup (one-time, if token expires or needs reset)

1. [console.cloud.google.com](https://console.cloud.google.com) → project `personal-gws`
2. Google Calendar API must be enabled
3. OAuth consent screen: External, your Google account as test user
4. Credentials: OAuth 2.0 Client ID, type Desktop app
5. `gws auth login -s calendar` → approve in browser

---

## /last30days — Real-Time Community Research (active)

Deep research skill that searches Reddit, X/Twitter, YouTube, TikTok, Instagram, Hacker News, Polymarket, Bluesky, Truth Social, and the web for signals from the last 30 days.

- **Repo:** `~/tech/last30days-skill` (cloned from [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill))
- **Version:** 2.9.5
- **License:** MIT

### Skills installed (global)

| Location | Skill |
|----------|-------|
| `~/.claude/skills/last30days` | Claude Code (symlink → `~/tech/last30days-skill`) |
| `~/.cursor/skills/last30days` | Cursor (symlink → `~/tech/last30days-skill`) |
| `~/.codex/skills/last30days` | Codex (symlink → `~/tech/last30days-skill`) |

### Custom skills that use last30days

| Skill | Location | Purpose |
|-------|----------|---------|
| `/research-spike` | `brain/.claude/skills/research-spike/SKILL.md` | Chains `/last30days` → comparison matrix → `research/spike-{slug}.md` |

### Configuration

**Global config:** `~/.config/last30days/.env`
```
SCRAPECREATORS_API_KEY=...   # Required — covers Reddit, TikTok, Instagram
LAST30DAYS_OUTPUT_DIR=...    # Raw output directory
```

**Per-project override:** `brain/.claude/last30days.env`
```
LAST30DAYS_OUTPUT_DIR=~/brain/research
```

**Output routing:**
- Raw research output → `~/brain/research/` (gitignored — regenerable, large files)
- Synthesized spike notes → `~/brain/research/spike-{slug}.md` (committed — distilled value)

### Optional auth (not configured)

| Source | Env vars needed | How to get |
|--------|----------------|------------|
| X/Twitter | `AUTH_TOKEN` + `CT0` | Copy from x.com browser cookies |
| Bluesky | `BSKY_HANDLE` + `BSKY_APP_PASSWORD` | Create at bsky.app/settings/app-passwords |
| xAI fallback (for X) | `XAI_API_KEY` | xAI API key — alternative to cookie auth |

### Quick reference

```bash
/last30days [topic]              # One-shot research
/last30days [X] vs [Y]           # Comparison mode
/research-spike [topic]          # Full spike → brain vault
```

### Updating

```bash
cd ~/tech/last30days-skill && git pull   # Updates all three symlinks
```

---

## When implementing future integrations

- Prefer one-way or two-way sync rules documented here.
- Exclude `private/` and any path in `.gitignore` from sync.
- Respect Todoist as task source; do not sync tasks from this repo into Todoist.
