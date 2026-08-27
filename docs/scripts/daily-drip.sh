#!/usr/bin/env bash
# daily-drip.sh — Daily Drip hook for Claude Code
#
# UserPromptSubmit hook. Once a day, asks one short personal question and files
# the answer into knowledge/me.md, so personal context accumulates instead of
# having to be dumped in one sitting.
#
# The hook stays silent until knowledge/me.md exists. A fresh fork is therefore
# never interrupted; /kickoff creates the file and the drip starts from there.
#
# State: ~/.cache/daily-drip/last-asked

set -euo pipefail

PROFILE="knowledge/me.md"
STATE_DIR="$HOME/.cache/daily-drip"
STATE_FILE="$STATE_DIR/last-asked"
TODAY=$(date +%Y-%m-%d)

# Not set up yet — stay quiet.
[ -f "$PROFILE" ] || exit 0

mkdir -p "$STATE_DIR"

# Already asked today.
if [ -f "$STATE_FILE" ] && [ "$(cat "$STATE_FILE")" = "$TODAY" ]; then
    exit 0
fi

echo "$TODAY" > "$STATE_FILE"

cat <<'PROMPT'
[Daily Drip] Before responding to the user's request, ask them ONE personal question from the Daily Drip pool in docs/templates.md (section "Daily Drip - Question of the Day"). Pick a question whose answer is NOT already in knowledge/me.md. Keep it casual and short. After they answer, save their response into the matching section of knowledge/me.md using the Edit tool. Then proceed with their actual request.
PROMPT
