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
- **Skills** (reusable only): `wrap-session-up`, `ingest-article`, `defuddle`, `obsidian-cli`, `obsidian-markdown`, `gws-obsidian-prep`, `project-sync`
- **Configs**: `commitlint.config.js`, `.husky/commit-msg`, `docs/templates.md`

It does NOT copy: `CLAUDE.md`, `README.md`, `.autolink/auto-link.sh`, `package.json`, `.claude/memory/MEMORY.md` — these are generalized differently in the template.

### 2. Review the diff

```bash
cd ~/tech/brain-starter && git diff
```

**Check for leaks before committing:**
- Personal names, company names, client names
- Email addresses or OAuth accounts
- Hardcoded absolute paths (e.g. `/Users/yourname/`)
- Internal project references (NC-xxxx, Jira tickets, specific repo names)
- Company-specific tool configs

If any personal references slipped through, fix them in the brain-starter copy before committing. Do NOT modify the brain repo source — the template versions may intentionally differ.

### 3. Commit and push

Use `feat` or `fix` only for user-facing changes. Use `chore` for everything else — only `feat` and `fix` trigger release PRs.

```bash
cd ~/tech/brain-starter
git add -A
git commit -m "feat(skill): update [skill-name] with [what changed]"
git push
```

### 4. Report

```
Brain starter sync complete.

Synced:
- [list of files that changed]

No changes:
- [list of files that were already up to date]

Pushed to: https://github.com/michaeljauk/brain-starter
```

## Important constraints

- **Never auto-commit** — always show the diff and wait for confirmation
- **Check for personal info** — every sync is a potential leak vector
- **Use correct commit types** — `chore` for infra, `feat` for new skills/features, `fix` for bug fixes. Only `feat`/`fix` create releases.
- **Don't modify brain repo** — this skill only copies brain → brain-starter, never the reverse
- **If a new skill was added to brain** that should be public, add it to the `SKILLS` array in `~/brain/scripts/sync-brain-starter.sh` first
