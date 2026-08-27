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
# Two lists, matched separately.
#   NAMES  - client, employer, colleague and product names. Matched case-insensitively.
#   EXACT  - token shapes: absolute paths, issue keys, mail addresses, secret prefixes. Matched
#            case-sensitively: the capitalised macOS home prefix is a real path, its lowercase
#            spelling is a URL segment in half the code samples. Folding case made --history
#            unusable.
NAMES='your-employer|your-client|your-surname|internal-product'
EXACT='[A-Z]{2,5}-[0-9]+|/Users/|[a-z0-9._%-]+@[a-z0-9.-]+\.[a-z]{2,}|sk-[a-zA-Z0-9]{20,}|ghp_|xox[baprs]-'

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
  --tree)     LABEL="checked-out tree";      SOURCE="$(git grep -InE "$NAMES|$EXACT" -- . || true)" ;;
  --history)  LABEL="full history";          SOURCE="$(git log --all -p --format='' | grep '^+' | grep -v '^+++' || true)" ;;
  *) echo "Unknown mode: $MODE (expected --worktree, --tree or --history)" >&2; exit 2 ;;
esac

# Drop the gate's own NAMES/EXACT/ALLOW definitions: they hold the patterns as
# patterns, not as data, and would otherwise always match themselves.
SCRUBBED="$(printf '%s\n' "$SOURCE" \
  | grep -vE "(^|[+:])(NAMES|EXACT|TERMS|ALLOW)=." \
  | sed -E "s#${ALLOW}##g")"

# Two passes, each over its own copy of the input. Piping one stream into a
# group of two greps does not work: the first drains stdin and the second
# silently matches nothing.
HITS="$( { printf '%s\n' "$SCRUBBED" | grep -inE "$NAMES"
           printf '%s\n' "$SCRUBBED" | grep -nE  "$EXACT"; } \
         | sort -t: -k1,1n -u || true)"

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
