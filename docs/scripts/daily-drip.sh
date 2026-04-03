#!/usr/bin/env bash
# daily-drip.sh — Daily Drip hook for Claude Code
#
# UserPromptSubmit hook. If no question was asked today,
# outputs additional context instructing Claude to ask one.
# State tracked in ~/.cache/daily-drip/last-asked

set -euo pipefail

STATE_DIR="$HOME/.cache/daily-drip"
STATE_FILE="$STATE_DIR/last-asked"
TODAY=$(date +%Y-%m-%d)

# Ensure state dir exists
mkdir -p "$STATE_DIR"

# Check if already asked today
if [ -f "$STATE_FILE" ] && [ "$(cat "$STATE_FILE")" = "$TODAY" ]; then
    # Already asked today — no additional context
    exit 0
fi

# Mark as asked
echo "$TODAY" > "$STATE_FILE"

# Output additional context
cat <<'EOF'
[Daily Drip] Before responding to the user's request, ask them ONE personal question from the Daily Drip pool in docs/templates.md (section "Daily Drip — Question of the Day"). Pick a question whose answer is NOT already in context/me.md. Keep it casual and short. After they answer, save their response into the matching section of context/me.md using the Edit tool. Then proceed with their actual request.
EOF
