---
name: sync-brain-starter
description: Sync reusable skills, configs, and templates from the private brain repo to the public brain-starter template repo. Use when you've updated a skill or config and want to push it to the open-source template.
---

# Sync Brain Starter

Syncs reusable parts from the private brain repo (`~/brain`) to the public template repo (`~/tech/brain-starter`). Copies skills, configs, and templates — then shows a diff for review before committing.

## Trigger phrases

- `/sync-brain-starter`
- "sync brain starter"
- "push changes to the template"
- "update brain-starter"

## Step-by-step workflow

### 1. Run the sync script

```bash
bash ~/brain/scripts/sync-brain-starter.sh
```

This copies:
- **Vault skills** (curated list): `wrap-session-up`, `ingest-article`, `defuddle`, `obsidian-cli`, `obsidian-markdown`, `obsidian-bases`, `json-canvas`, `gws-obsidian-prep`, `project-sync`, `research-spike`, `save-answer`, `lint-brain`, `qmd`, `find-skills`, `sync-brain-starter`
- **Configs**: `commitlint.config.js`, `.husky/commit-msg`, `docs/templates.md`, `docs/integrations.md`

It does NOT copy:
- `CLAUDE.md`, `README.md`, `package.json`, `.claude/memory/MEMORY.md` -- these are generalized differently in the template
- **Global/plugin skills** -- brain-starter no longer bundles plugin skills (gstack, gws, todoist, m365, etc.). Users install these globally via their own install commands.

### 2. Review the diff

```bash
cd ~/tech/brain-starter && git diff
```

**Check for leaks before committing:**
- Personal names (your name, family members, colleagues)
- Company or client names
- Email addresses or OAuth accounts
- Hardcoded absolute paths (e.g. `/Users/yourname/`)
- Internal project references (Jira ticket keys, specific repo names)
- Company-specific tool configs

If any personal references slipped through, fix them in the brain-starter copy before committing. Do NOT modify the brain repo source — the template versions may intentionally differ.

### 3. Update the README

If any new skills were added, docs created, or features changed, update `~/tech/brain-starter/README.md`:

- **New skill?** → Add a row to the vault skills or global skills table
- **New doc (e.g. `docs/integrations.md`)?** → Reference it in the "What's included" section
- **Skill count changed?** → Update the "X Claude Code skills" number in the intro
- **New prerequisite tool?** → Add it to the Prerequisites table

Always check the README is accurate before committing — it's the first thing users see.

### 4. Commit and push

Use `feat` or `fix` only for user-facing changes. Use `chore` for everything else — only `feat` and `fix` trigger release PRs.

```bash
cd ~/tech/brain-starter
git add -A
git commit -m "feat(skill): update [skill-name] with [what changed]"
git push
```

### 5. Report

```
Brain starter sync complete.

Synced:
- [list of files that changed]

No changes:
- [list of files that were already up to date]

Pushed to: {your brain-starter fork URL}
```

## Important constraints

- **Never auto-commit** — always show the diff and wait for confirmation
- **Check for personal info** — every sync is a potential leak vector
- **Use correct commit types** — `chore` for infra, `feat` for new skills/features, `fix` for bug fixes. Only `feat`/`fix` create releases.
- **Don't modify brain repo** — this skill only copies brain → brain-starter, never the reverse
- **If a new vault skill was added to brain** that should be public, add it to the `SKILLS` array in `~/brain/scripts/sync-brain-starter.sh`
- **Global/plugin skills are NOT synced** -- brain-starter only ships vault-native skills. Plugin skills (gstack, gws, todoist, render, etc.) install themselves globally via their own repos
