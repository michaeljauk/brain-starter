---
name: update-brain-starter
description: Update this vault to a newer brain-starter template release. Shows the changelog first, then merges template-owned files (skills, scripts, templates, hooks) three-way and leaves the user's notes alone. Use when the session start says a new brain-starter version is available, or the user says "update brain-starter", "update the template", or runs /update-brain-starter.
---

# Update brain-starter

Brings the template-owned parts of this vault to a newer brain-starter release. The user's own
content never changes: `projects/`, `knowledge/`, `research/`, `decisions/`, `meetings/`, `tasks/`,
`.claude/memory/`, `log.md`, `hot.md`, and every file that the release does not list as owned.

Works for vaults made with "Use this template" and for clones. It does not use git history: it
downloads the installed release and the target release from GitHub and merges three ways.

## Trigger phrases

- `/update-brain-starter`
- `/update-brain-starter 3.9.0` - a specific version instead of the latest
- "update brain-starter", "update the template", "is there a new brain-starter version?"

## Contract

- **The user decides.** Show the changelog and the plan before anything changes. No `apply`
  without a yes to that plan in this conversation.
- **Never delete a file and never remove a hook on your own.** The helper only proposes them.
  The one exception is a rename the user agreed to in the plan: apply moves the file and removes
  the old path.
  Do each one only after the user agrees to that item.
- **Every conflict gets an explanation.** For each conflict: what the user changed, what the
  template changed, and a proposed resolution. The user picks.
- **Never commit without asking.** One commit on the update branch, after the user's go.

## Files

| Path | Role |
|------|------|
| `.brain-starter.json` | Installed version, update check settings, the release's list of owned files |
| `docs/scripts/brain-starter-update.mjs` | Downloads both releases, classifies and merges files |
| `docs/scripts/brain-starter-check.sh` | SessionStart hook that prints the "new version" line |

## Step 1 - Plan

```bash
node docs/scripts/brain-starter-update.mjs plan            # or: plan --to 3.9.0
```

The output is JSON. If `status` is `up-to-date`, say so and stop.

**Check the base before you trust the plan.** `localMatchesBase` (for example `41/44`) counts the
owned files that are byte-identical to the installed release. A vault that matches its base
mostly is normal. If fewer than half match, the installed version is probably wrong (an old vault
from before `.brain-starter.json` existed reads it from `.release-please-manifest.json`). Ask the
user which version they started from and rerun with `--from X.Y.Z`. Also tell the user where
`from` came from (`fromSource`).

Then show the user:

1. **The changelog** (`changelog`) as it is.
2. **The file plan**, grouped by action:

| Action | Meaning | What apply does |
|--------|---------|-----------------|
| `add` | New in the release | Writes it |
| `update` | Changed upstream, unchanged locally | Takes the new version |
| `merge-clean` | Changed upstream and locally, no overlap | Writes the three-way merge |
| `merge-conflict` | Changed upstream and locally, overlapping lines | Writes the merge with conflict markers |
| `added-both-clean` / `added-both-conflict` | New upstream, but a different local file exists at that path | Merge against an empty base; usually conflicts |
| `keep-deleted` | Changed upstream but deleted locally, or new in a skill folder the user deleted | Nothing; it stays deleted |
| `rename-update` | The release renamed the file (`oldPath` -> `path`), unchanged locally | Writes the new version at the new path, removes the old path |
| `rename-move` | Renamed, content unchanged upstream or already equal | Moves the local file to the new path |
| `rename-merge-clean` / `rename-merge-conflict` | Renamed, changed upstream and locally | Writes the three-way merge at the new path, removes the old path |
| `rename-move-own` | The user's own file inside a renamed folder | Moves it along with the folder |
| `rename-own-clash` | The user's own file in a renamed folder, but the new path is taken | Nothing; ask the user |
| `rename-own-ignored` | A file git ignores (for example `.DS_Store`) in a renamed folder | Nothing; it stays in the old folder |
| `rename-own-symlink` | A symlink in a renamed folder | Nothing; tell the user to move or recreate it |
| `rename-blocked-symlink` | A template file in the old folder is a symlink, so the whole rename is skipped | Nothing; tell the user to replace the link with a file or rename the folder by hand |
| `rename-leftover` | Old and new path both exist locally, the old copy is the template's | Nothing; propose deleting the old one |
| `rename-leftover-modified` | Old and new path both exist locally, the old copy has the user's edits | Nothing; show the edits and recommend carrying them over before any deletion |
| `skipped-symlink` | The local path runs through a symlink | Nothing; writing could leave the vault. Tell the user to update the link target by hand |
| `propose-delete` | Deleted upstream, unchanged locally | Nothing; ask the user |
| `propose-delete-modified` | Deleted upstream, changed locally | Nothing; recommend keeping it |

3. **Renamed skills** (`renamed`, only renames that move files in this vault): for each entry,
   tell the user plainly that the command changes from `oldCommand` to `newCommand` and that their
   edits move along. `ignoredRenames` lists renames the release declares but the helper could not
   follow (a cycle, or a target that is not a template folder); tell the user that the old folder
   stays and the new one may come in as well. This is the one case where
   apply removes files: the old paths, after their content is written to the new ones.
4. **The special files** (`special`):
   - `.claude/settings.json` (`hooks`): hooks to add (`added`); hooks the template removed that
     are still present here (`removedUpstream`, proposal only); other top-level keys the template
     changed (`otherKeysChanged`, show the user the template's value and let them decide).
   - `CLAUDE.md` (`sections`): only the parts between `<!-- brain-starter:begin NAME -->` and
     `<!-- brain-starter:end NAME -->` are template-owned. Lists `updated`, `merged`, `conflicts`,
     `added`, `removedUpstream`, `keptDeleted`. In `sections-added` mode (a vault from before
     the markers), the template sections are found by their headings and get markers in the same
     step; text outside them stays as it is. `whole-file` mode is the fallback when that is not
     possible: the whole file is merged once.
   - `updated` hooks: the template changed a hook's attributes (for example the timeout) and the
     local copy was unchanged. `changedUpstream`: the same, but the user changed that hook too;
     show both and let the user decide.

Ask: "Apply this update on branch `brain-starter-update/<to>`?" Wait for a yes.

## Step 2 - Apply

```bash
node docs/scripts/brain-starter-update.mjs apply --from <plan.from> --to <plan.to>
```

Always pass the `from` and `to` values from the plan. Without them a release published in between
would change what gets written; `apply` refuses to run without both.

It stops if tracked files have uncommitted changes. Tell the user to commit or stash first, and
do not do it for them. It also stops if the branch exists from an earlier attempt.

It creates the branch, writes `written`, and bumps `.brain-starter.json`: the release sets the
version and the owned list, the user's own keys (`check`, `checkIntervalDays`, a fork's `repo`)
stay. Nothing is committed.

If it stops halfway (exit code 2 after the branch exists), the error lists the files it wrote and
the commands to go back, in the order to run them. Show them to the user; do not run them without
a yes.

## Step 3 - Conflicts

For each path in `conflicts`, open the file and find the conflict blocks:

```
<<<<<<< yours
...the user's version...
||||||| brain-starter 3.7.0
...the template before...
=======
...the template now...
>>>>>>> brain-starter 3.8.0
```

For each block, explain in two or three sentences what each side changed and why it matters, and
propose a resolution. Keep the user's intent unless the template change fixes a bug they would
otherwise keep. Edit the file only after the user picks. When done, confirm no markers remain:

```bash
grep -n '^<<<<<<< \|^||||||| \|^=======$\|^>>>>>>> ' <file>
```

That grep must print nothing. A `=======` line can be legitimate markdown; if it is, say so
instead of deleting it.

## Step 4 - Proposals

Go through `propose-delete`, `propose-delete-modified` and `removedUpstream` (hooks and CLAUDE.md
sections) one by one. For each one the user accepts:

- File: `git rm <path>`
- Hook: remove that entry from `.claude/settings.json`, then confirm it still parses:
  `node -e 'JSON.parse(require("fs").readFileSync(".claude/settings.json","utf8"))'`
- CLAUDE.md section: remove it including both marker lines

## Step 5 - Verify and commit

1. `git -c status.relativePaths=true status --short --untracked-files=all -- .` and
   `git diff --stat --relative`, both run in the vault root, so paths are relative to the vault
   also when it sits inside a larger git repo (`--porcelain` would print repo-root paths).
   Every changed path must be in `written`, in `removed` (tracked old paths of renamed files), in
   `movedUntracked` (files the user never tracked; they moved but are not staged), in
   `untrackedOwned` (files fetched by hand to bootstrap an old vault), or be one of the proposals
   the user accepted. Anything else is a bug; stop and report it.
2. Confirm the version: `node -e 'console.log(require("./.brain-starter.json").version)'`.
3. Show the summary and ask before committing. Stage by path, never `git add -A`:

```bash
git add -- <every path from written, removed, untrackedOwned and the accepted proposals>
git commit -m "chore(vault): update brain-starter to <to>"
```

4. Tell the user how to finish: merge the branch into their main branch
   (`git switch main && git merge brain-starter-update/<to>`), or keep it to look at later.
   Skills that changed take effect in the next session.

## Report

```
brain-starter <from> -> <to> on branch brain-starter-update/<to>

Updated: <n> files    Merged: <n>    Conflicts resolved: <n>
Added: <list>
Kept as is (deleted by you): <list>
Proposals accepted: <list>    declined: <list>
Committed: <sha or "not yet">
```

## Never

- Touch a file that is not in the plan
- Delete a file or remove a hook without the user's yes for that item (renames in the agreed
  plan excepted)
- Resolve a conflict without showing it to the user
- Commit without being asked in this session
- Push
