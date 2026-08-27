#!/usr/bin/env bash
# leak-gate.sh — block private names from reaching a public repo.
#
# If you sync parts of this vault to a public template, a prose checklist is not
# enough. Reading a diff is not a check. This script is the check: it must print
# nothing and exit 0.
#
# Edit TERMS below. It should list every client, employer, colleague, product
# and account name that must never appear in the public copy, plus the token
# shapes for secrets. Keep it in the private repo only - the list is itself
# sensitive.
#
# Modes:
#   (default)   staged diff       — run before every commit
#   --worktree  staged + unstaged — run right after a sync
#   --tree      the whole checked-out tree
#   --history   every commit in every ref
#
# --tree says nothing about older commits. `git grep <rev>` searches that
# revision's tree only. To judge whether a repo was ever exposed, use --history.

set -uo pipefail

TARGET="${TARGET:-$PWD}"
MODE="${1:-staged}"

# ── EDIT THIS ────────────────────────────────────────────────────────────────
TERMS='your-employer|your-client|your-surname|internal-product|[A-Z]{2,5}-[0-9]+|/Users/|[a-z0-9._%-]+@[a-z0-9.-]+\.[a-z]{2,}|sk-[a-zA-Z0-9]{20,}|ghp_|xox[baprs]-'

# Substrings that are intentionally public. Removed from each line BEFORE matching, so a
# line carrying both an allowed URL and a private name still trips.
#
# Each entry must be a COMPLETE token, longest first. A prefix leaves a fragment behind and the
# fragment can still match, reporting a hit that is not there. Allow the whole host name, not the
# first label of it.
ALLOW='your-org\.atlassian\.net|/Users/username/|github-username|your-username|\{username\}|your-org|ACME-[0-9]+|acme|jane-doe|you@example|example\.'
# ─────────────────────────────────────────────────────────────────────────────

cd "$TARGET" || { echo "No such directory: $TARGET" >&2; exit 2; }

case "$MODE" in
  staged)     LABEL="staged diff";           SOURCE="$(git diff --cached -U0 | grep '^+' | grep -v '^+++' || true)" ;;
  --worktree) LABEL="staged + unstaged diff"; SOURCE="$( { git diff -U0; git diff --cached -U0; } | grep '^+' | grep -v '^+++' || true)" ;;
  --tree)     LABEL="checked-out tree";      SOURCE="$(git grep -InE "$TERMS" -- . || true)" ;;
  --history)  LABEL="full history";          SOURCE="$(git log --all -p --format='' | grep '^+' | grep -v '^+++' || true)" ;;
  *) echo "Unknown mode: $MODE (expected --worktree, --tree or --history)" >&2; exit 2 ;;
esac

# Drop the gate's own TERMS/ALLOW definitions: they contain the patterns as
# patterns, not as data, and would otherwise always match themselves.
HITS="$(printf '%s\n' "$SOURCE" \
  | grep -vE "(^|[+:])(TERMS|ALLOW)=." \
  | sed -E "s#${ALLOW}##g" \
  | grep -inE "$TERMS" || true)"

if [[ -z "${HITS//[[:space:]]/}" ]]; then
  echo "Leak gate: clean ($LABEL)"
  exit 0
fi

echo "Leak gate: BLOCKED — $(printf '%s\n' "$HITS" | wc -l | tr -d ' ') hit(s) in the $LABEL" >&2
echo "" >&2
printf '%s\n' "$HITS" >&2
echo "" >&2
echo "Every hit is a blocker. Replace it with a placeholder, then run this again." >&2
exit 1
