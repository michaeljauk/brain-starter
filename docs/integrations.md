# Integrations

## Obsidian (active)

This repo is an Obsidian vault. Obsidian is the primary interface for reading and editing notes.

- `.obsidian/` is committed — settings and plugins travel with the repo; this is intentional.
- Use Obsidian for navigation, search, graph view, and plugin-driven workflows.

## Granola → Obsidian sync (active, trial config since 2026-05-30)

Meeting notes are synced from Granola via the **`granola-sync-plus`** Obsidian plugin.

- The plugin auto-populates `meetings/` — do **not** manually edit or rename those files.
- Granola files use the filename pattern `YYYY-MM-DD_Title With Spaces.md` (underscore separator, title-case with spaces). This differs from the manual convention but is intentional — do not "correct" it.
- Treat all files in `meetings/` created by Granola sync as read-only; edits belong in Granola itself.

**Config trial (since 2026-05-30):** `Skip Existing Notes` is OFF + sync interval 5 min. Reason: Granola enhances notes after the meeting; with Skip ON the plugin doesn't pull the enhanced version. Observation window through ~2026-06-06. If notes still arrive stale (e.g. when Obsidian is closed during enhancement), fall back to Option 3 in `research/granola-sync/2026-05-30-research-brief.md` (custom API poller via official Granola REST API, `launchd` agent).

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
- **Collection:** `brain` → `~/brain` (~1,555 files indexed as of 2026-08-02)
- **Skill:** installed globally at `~/.claude/skills/qmd/`, `~/.cursor/skills/qmd/`, `~/.codex/skills/qmd/`
- **MCP:** `qmd mcp` (stdio) — only for clients without shell access, see below. Claude Code, Cursor and Codex keep using the CLI via skill: cheaper (no process, no tool schemas in context) and in line with [[feedback_skills_over_mcp]]

```bash
qmd search "keywords"              # BM25 keyword search
qmd vsearch "natural language"     # Vector semantic search
qmd query "hybrid question"        # Hybrid + reranking (best quality)
qmd get "path/to/file.md"          # Retrieve full document
qmd update                         # Re-index after vault changes
qmd embed                          # Refresh vector embeddings
qmd-doctor                         # Health check: alive? index current?
```

#### Reliability setup (added 2026-08-02)

qmd was **silently broken from ~April to 2026-08-02**. Its `better-sqlite3` native module is
compiled for one specific Node major; run it under another and it dies with `ERR_DLOPEN_FAILED`
before opening the DB. Every calling skill (`ingest-article`, `linkedin-draft`, `research-spike`,
`marp`, `gws-obsidian-prep`) falls back to Grep/Glob on failure and keeps returning plausible
results, so nothing surfaced. The index was also 120 days stale, covering 901 of ~1,900 notes.

Three moving parts now guard against a repeat. **All are removable — see below.**

| Component | Path | What it does |
|-----------|------|--------------|
| ABI resolver | `~/.local/bin/qmd-node` | Probes installed Node versions, caches the one that can load qmd's native module. No version pin to keep in sync. |
| Wrapper | `~/.local/bin/qmd-exec` | Runs qmd under the resolved Node. On failure, re-probes once and retries, so a Node upgrade or qmd reinstall self-heals. Used by the `qmd()` function in `~/.zshrc`, by `qmd-doctor`, and by the scheduled job. |
| Health check | `~/.local/bin/qmd-doctor` | Exit `0` healthy / `1` broken / `2` stale. Reports file count, index age, and how many tracked `.md` changed since indexing. Wired into `/lint-brain` as check 11. Writes a marker to `~/.cache/qmd-health`. |
| Session banner | `~/.local/bin/qmd-health-banner` | SessionStart hook in `~/.claude/settings.json`. Reads the marker (a file read, never invokes qmd) and warns in-session when unhealthy. **Prints nothing when healthy.** |

**Visibility — how you find out something broke:**

| Channel | When it fires |
|---------|---------------|
| macOS notification | Immediately after the daily run, **only if** broken or still stale afterwards. Silent on success. |
| Claude session banner | At the start of any session, if the index is broken/stale — or if the marker is missing or older than 3 days, which means *the reindex agent itself stopped running*. |
| `/lint-brain` check 11 | On demand. A non-zero result is reported above the score, because every other finding in that run was produced with degraded search. |
| `qmd-doctor` | On demand, any time. |

The deliberate choice throughout is **silence on success**. A daily "qmd is fine" notification is
noise, and noise is precisely how four months of breakage went unnoticed.

**Scheduled reindex — a launchd background agent:**

- **Label:** `com.{username}.qmd-reindex`
- **Plist:** `~/Library/LaunchAgents/com.{username}.qmd-reindex.plist`
- **Script:** `~/.claude/scheduled-tasks/qmd-reindex/run.sh`
- **Logs:** `~/.claude/scheduled-tasks/qmd-reindex/runs/YYYY-MM-DD.log` (auto-pruned after 30 days)
- **Schedule:** daily 07:41, deliberately before `project-status-sync` (08:07) so its searches hit a fresh index
- **Cost:** local only. `qmd update` is a filesystem scan; `qmd embed` uses the local `embeddinggemma` model. No network, no API spend. A typical incremental run is ~15s.

**To remove the scheduled agent** (the resolver/wrapper/doctor can stay — they are passive):

```bash
launchctl unload ~/Library/LaunchAgents/com.{username}.qmd-reindex.plist
rm ~/Library/LaunchAgents/com.{username}.qmd-reindex.plist
rm -rf ~/.claude/scheduled-tasks/qmd-reindex
```

**To remove the session banner:** delete the `SessionStart` entry from `~/.claude/settings.json`
(a timestamped backup was written alongside it when the hook was added).

**Everything is version-controlled** in [`docs/scripts/qmd/`](scripts/qmd/README.md) — the four
scripts, the reindex job, and the launchd plist. `~/.local/bin`, `~/.claude/scheduled-tasks/` and
`~/Library/LaunchAgents/` hold symlinks into the repo (launchd loads a symlinked plist fine).
Restore on a new machine with `bash ~/brain/docs/scripts/qmd/install.sh` — idempotent, and it
prints the two shared-config snippets it deliberately does not edit (`~/.zshrc` function,
`SessionStart` hook).

**If the MacBook is asleep at 07:41:** per `man launchd.plist`, `StartCalendarInterval` jobs start
on next wake, and multiple missed intervals coalesce into a single run; powered off means it runs
after next login. `StartInterval` was deliberately avoided — its firings during sleep are simply
missed. Network state is irrelevant; the whole pipeline is local.

Without it, staleness returns as a manual problem: `qmd-doctor` and `/lint-brain` will *report*
a stale index, but someone has to run `qmd update && qmd embed`.

**After any Node major upgrade:** nothing to do — the resolver re-probes automatically. If qmd
itself stops working entirely, `bun install -g @tobilu/qmd` rebuilds the native module.

#### Claude Desktop via MCP (added 2026-08-05)

qmd ships its own MCP server — `qmd mcp`, stdio transport. Verified 2026-08-05: handshake clean,
`serverInfo: qmd 0.9.9`, four tools (`query`, `get`, `multi_get`, `status`). The server sends its
own instructions including the collection description, so the client knows what it is searching
without extra prompting.

Wired into `~/Library/Application Support/Claude/claude_desktop_config.json`
(backup written alongside as `.bak`; `mcpServers` was empty before — the Canva/Granola/Drive
connectors visible in Desktop are account-side, not local):

```json
"mcpServers": {
  "brain": {
    "command": "~/.local/bin/qmd-exec",
    "args": ["mcp"]
  }
}
```

Absolute path, no `~`. Desktop launches MCP servers without a login shell — no nvm, minimal PATH.
Verified working under `env -i` because `qmd-node` caches an absolute Node path, so the ABI
resolver carries this too. Needs a full Desktop restart (Cmd+Q) to load.

**Read-only.** All four tools carry `readOnlyHint: true` — search and fetch, never write.

#### Write-back and mobile access

Deliberately *not* solved with a custom MCP server. Write-back goes through **Claude Code on the
web** (claude.ai/code) against the private GitHub repo `{github-username}/brain`: read, write and commit
in one, works in the browser and therefore on mobile, and needs no self-hosted infrastructure.
The decisive advantage over a Desktop write-MCP is that a Claude Code session reads `CLAUDE.md`,
`hot.md` and the `MANIFEST.md` files, so the placement rules and the dedup discipline actually
apply — a generic filesystem MCP knows none of that and would reproduce the duplicate problem
(`llm-wiki-pattern` vs `karpathy-llm-knowledge-bases`).

Known gaps, accepted: no vault access in a plain mobile chat (a Code session has to be opened
explicitly), and no qmd in the sandbox — only Grep/Glob/Read, so conceptual search stays weaker
than on the Mac. A remote MCP endpoint would close both, but is exactly the self-hosted category
that has reliably died here ([[feedback_self_hosted_push_channels_fail]]).

Full rationale including the four rejected alternatives:
[[2026-08-05-vault-access-mobile-and-write-back]].

### ~~smart-connections-mcp~~ (removed 2026-03-22)
Replaced by QMD. MCP server removed from all clients.

---

## Browser Automation (Stand 2026-08-03)

Zwei CLIs, eines davon kaputt. **`agent-browser` ist das aktive Tool**, `browser-use` nicht mehr.

### agent-browser (active)
`/opt/homebrew/bin/agent-browser` v0.27.0, npm-global. Accessibility-Tree statt Screenshots.

Zwei Stolpersteine, die beide wie Tool-Fehler aussehen aber keine sind:

- **Domain-Allowlist.** `agent-browser open x.com/...` bricht mit `Domain 'x.com' is not in the
  allowed domains list` ab. Das kommt aus `AGENT_BROWSER_ALLOWED_DOMAINS`, nicht von der Seite.
  Override pro Aufruf: `--allowed-domains "x.com,*.x.com,*.twimg.com"`.
- **`--profile "Default"` funktioniert nicht, solange Chrome läuft.** Das Profil ist lock-gehalten,
  der Start scheitert mit `CDP response channel closed`. `--auto-connect` hilft nur, wenn Chrome
  mit `--remote-debugging-port` gestartet wurde. Für eingeloggte Sessions also entweder Chrome
  beenden oder den Body von Hand liefern — nicht mehr als einen Versuch investieren.

### Eingeloggte Sessions — `--session-name` statt `--profile`
Ersatz für das, wofür früher `browser-use --profile "Default"` da war. Nicht das echte
Chrome-Profil anfassen, sondern einmal interaktiv einloggen und den State wiederverwenden:

```bash
# einmalig, sichtbares Fenster, von Hand einloggen:
agent-browser --session-name linkedin --headed --allowed-domains "linkedin.com,*.linkedin.com" \
  open https://www.linkedin.com/feed/

# danach headless, State wird automatisch geladen:
agent-browser --session-name linkedin eval "document.body.innerText.substring(0,3000)"
```

`--session-name` speichert Cookies + localStorage und stellt sie beim nächsten Aufruf wieder her.
Alternativ explizit: `agent-browser state save ./auth.json` / `state load ./auth.json`.
Verschlüsselung optional über `AGENT_BROWSER_ENCRYPTION_KEY` (`openssl rand -hex 32`).

> Der Login-Flow ist so noch **nicht durchgespielt** — dokumentiert aus `agent-browser state --help`,
> nicht aus einem erfolgreichen LinkedIn-Lauf. Die Rezepte in `.claude/settings.local.json` zeigen
> alle noch auf das tote browser-use und müssen umgeschrieben werden.

### ~~browser-use~~ (kaputt seit dem Intel-Homebrew-Ausbau)
`~/.browser-use-env/bin/browser-use` → `bad interpreter: .../bin/python3: no such file or directory`.
Das venv zeigt auf `home = /usr/local/opt/python@3.12/bin` (Intel-Homebrew, existiert nicht mehr).
Die site-packages sind x86_64-Wheels — ein Umbiegen auf arm64-Python reicht nicht, es braucht einen
echten venv-Rebuild. Bis dahin laufen alle `browser-use --profile "Default"`-Rezepte in
`.claude/settings.local.json` (LinkedIn-Scraping) ins Leere.

### X/Twitter Long-form Articles
`x.com/<user>/status/<id>` ist bei Long-form nur eine Titel-Karte; der Body liegt unter
`x.com/i/article/<id>` und ist login-gated. Der Weg zur Article-ID:
`curl -sIL https://t.co/XXXX | grep -i location` (der t.co-Link im Post). Teaser ohne Login:
`curl -s "https://cdn.syndication.twimg.com/tweet-result?id=<TWEET_ID>&token=a"` → `article.title`
+ `article.preview_text` (~200 Zeichen). Reicht zur Relevanzeinschätzung, **nicht** zum Ingest.
Für den Volltext: im eingeloggten Browser kopieren und als Datei übergeben.

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

## Verwandte Referenzen

- [[project-repo-map]] — welches Projekt in welchem Repo liegt
- [[credentials-cloudflare-dns]] — Cloudflare-DNS-Zugang
- [[pandoc-publishing-workflow]] — DOCX/Mermaid-Publishing per pandoc
