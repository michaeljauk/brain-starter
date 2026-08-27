# Integrations

Every integration here is optional except Obsidian and git. The vault is plain markdown and works
with none of them installed. Add one when you feel the friction it removes.

Each section says what the tool does, how to install it, how to prove it works, and which shipped
skill uses it. Run `/kickoff` to be walked through the ones you want.

## Obsidian

The vault interface. Point Obsidian at the repo root: **File > Open Vault > select the directory**.

Vault settings live in `.obsidian/` and are committed, so the same layout follows the repo to
another machine. If you would rather keep them local, add `.obsidian/` to `.gitignore`.

Nothing in this template depends on an Obsidian plugin. Wikilinks, frontmatter, callouts, Bases,
and Canvas are all Obsidian-native and the shipped skills write them directly.

## QMD - Local Semantic Search (optional)

Local hybrid search over the vault: BM25 plus vector similarity plus an LLM re-ranking pass. It
answers "what do I already know about X" and "is there a note on this yet". Grep answers "which
file contains this exact string". They are different questions - use the right one.

**Install**

```bash
bun install -g @tobilu/qmd     # or: npm install -g @tobilu/qmd
qmd collection add . --name brain
qmd embed
```

**Verify** - do not trust the exit code, check that a note actually comes back:

```bash
qmd query "something you know is in the vault" --collection brain
```

**Keep the index fresh.** `qmd embed` indexes what exists at that moment. Notes written afterwards
are invisible to semantic search until the next run. Schedule `qmd update && qmd embed` daily, and
if you also run a nightly maintenance job, order the reindex *before* it.

**When it errors, say so.** Silently falling back to Grep produces answers that look complete and
are not. Report the degradation and re-run `qmd embed`.

Used by: the `qmd` skill, `lint-brain`, `ingest-article`.

## Google Calendar via gws CLI (optional)

Reads your Google Calendar so the agent can prepare meeting notes before the day starts.

**Install**

```bash
npm install -g @googleworkspace/cli
gws auth login
```

**Verify**

```bash
gws auth status
gws calendar +agenda --today --format json
```

**Note on install location.** If you manage node with nvm, a version switch can strand a global
CLI on a version that is no longer on `PATH`. Installing to a system prefix avoids the class of
problem entirely.

Used by: the `gws-obsidian-prep` skill.

## last30days - Real-Time Community Research (optional)

Sweeps Reddit, X, Hacker News, YouTube and the open web for the last 30 days and synthesises a
cited report. Useful when the question is "what does the community actually think right now",
which model training data cannot answer.

**Install** - clone the skill and register it globally:

```bash
git clone https://github.com/mvanhorn/last30days-skill ~/tech/last30days-skill
ln -s ~/tech/last30days-skill ~/.claude/skills/last30days
```

Set any API keys the skill asks for in its own env file. Do not commit them to this vault.

Used by: the `research-spike` skill, which turns a sweep into a comparison matrix and a
recommendation note in `research/`.

## Todoist CLI (optional)

Tasks belong in a task manager, not in the vault. This template treats the vault as context and
memory, and whatever you use for tasks as the source of truth.

**Install**

```bash
npm install -g @doist/todoist-cli
td auth login
```

**Verify**

```bash
td task list --filter today
```

Used by: the `wrap-session-up` skill, which files loose ends as tasks rather than leaving them in a
note nobody re-reads.

## Microsoft 365 CLI (optional)

Reads and organises Outlook mail from the terminal, for mail triage into vault notes.

**Install**

```bash
npm install -g @pnp/cli-microsoft365
m365 login
```

**Verify**

```bash
m365 status
```

If you work across more than one tenant, log in per tenant and keep the connection names distinct.

## Atlassian CLI (optional)

Queries and edits Jira issues and Confluence pages, so project notes can carry live ticket state
instead of a hand-copied snapshot.

**Install** - see the [acli documentation](https://developer.atlassian.com/cloud/acli/) for the
platform package, then:

```bash
acli jira auth login
acli jira workitem search --jql "project = ACME AND sprint in openSprints()"
```

Used by: the `project-sync` skill, when a project has a `jira` block in `docs/scripts/repos.json`.

## gstack - Browser QA (optional)

A headless browser for agents. Returns the accessibility tree rather than screenshots, which is
both cheaper and easier for a model to act on.

**Install**

```bash
git clone https://github.com/garrytan/gstack ~/tech/gstack
cd ~/tech/gstack && ./setup
```

**Verify**

```bash
browse open https://example.com
```

## Render CLI (optional)

Deploys and debugs services on Render, for vaults that track infrastructure alongside project
notes.

**Install**

```bash
brew install render
render login
```

**Verify**

```bash
render services list
```

## Meeting notes (optional)

`meetings/` holds one file per meeting. Two ways to fill it:

- **By hand** - use the meeting template in [`docs/templates.md`](templates.md), named
  `YYYY-MM-DD-short-title.md`.
- **From a notetaker** - most AI notetakers export markdown or expose an API. Write the export
  into `meetings/` and treat the directory as read-only afterwards, so a re-sync never fights your
  edits.

If a sync writes the directory, say so in `CLAUDE.md`. An agent that does not know a directory is
managed will happily edit files that the next sync overwrites.

Used by: `docs/scripts/classify-meetings.sh`, which tags meeting notes by content.

## Keeping this file current

An integration that is documented but broken is worse than one that is missing - it sends you
debugging in the wrong direction.

When something changes, record it here in the same pass:

- A tool becomes active: add its section with the install and the verify command
- A tool breaks or is replaced: say so, name the replacement, and keep the entry
- A verify command changes: update it, because it is the only part anyone runs

State the date on anything that is version-dependent or that you have not personally re-tested.
