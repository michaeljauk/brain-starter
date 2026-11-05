#!/usr/bin/env bash
# brain-starter update check. Runs as a SessionStart hook (see .claude/settings.json).
#
# Prints one line when a newer brain-starter release exists than the version in
# .brain-starter.json. Claude Code shows that line dimmed, so once a day per vault (and again
# when a newer release appears) Claude is also asked to mention the update in its first reply.
# The line comes from a local cache, so session start never waits on the network. If the last successful check is older than checkIntervalDays, a detached background
# process refreshes the cache with one unauthenticated GET to the GitHub releases API. The request
# carries no data from this vault.
#
# Turn it off with "check": false in .brain-starter.json. Every error is silent.

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cfg="$root/.brain-starter.json"
[ -f "$cfg" ] || exit 0

# Reads one scalar key (string, number or boolean) from the marker file.
read_key() {
  tr -d '\n\r' < "$cfg" \
    | grep -o "\"$1\"[[:space:]]*:[[:space:]]*[^,}]*" \
    | head -n 1 \
    | sed -e 's/^[^:]*:[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//'
}

is_version() { [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; }

# Returns 0 if version $1 is greater than version $2.
version_gt() {
  local IFS=. i
  local -a a=($1) b=($2)
  for i in 0 1 2; do
    (( 10#${a[i]} > 10#${b[i]} )) && return 0
    (( 10#${a[i]} < 10#${b[i]} )) && return 1
  done
  return 1
}

[ "$(read_key check)" = "false" ] && exit 0

installed="$(read_key version)"
repo="$(read_key repo)"
days="$(read_key checkIntervalDays)"
is_version "$installed" || exit 0
[[ "$repo" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]] || exit 0
[[ "$days" =~ ^[1-9][0-9]{0,3}$ ]] || days=7

cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/brain-starter"
cache="$cache_dir/latest-${repo//\//_}"
attempt="$cache.attempt"

# 1. Report from the cache. No network.
latest="$(head -n 1 "$cache" 2>/dev/null)"
if is_version "$latest" && version_gt "$latest" "$installed"; then
  msg="brain-starter $latest is available (you have $installed). Run /update-brain-starter to see what changes."
  ctx="A newer brain-starter template release is available: $latest (installed: $installed). Mention it only if the user asks about updates; the update-brain-starter skill shows the changes and applies them."
  # Ask Claude to say it once per day and vault. If the state cannot be written, stay quiet
  # rather than repeat the request in every session.
  announced="$cache_dir/announced-${repo//\//_}-$(printf '%s' "$root" | cksum | cut -d ' ' -f 1)"
  stamp="$(date +%Y-%m-%d) $latest"
  if [ "$(head -n 1 "$announced" 2>/dev/null)" != "$stamp" ] \
    && mkdir -p "$cache_dir" 2>/dev/null && { printf '%s\n' "$stamp" > "$announced"; } 2>/dev/null; then
    ctx="A newer brain-starter template release is available: $latest (installed: $installed). In your first reply of this session, add one short line for the user, for example: brain-starter $latest is available, run /update-brain-starter to see what changes. Say it only once in this session. The update-brain-starter skill shows the changes and applies them."
  fi
  printf '{"systemMessage": "%s", "hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "%s"}}\n' "$msg" "$ctx"
fi

# 2. Refresh the cache in the background if the last success is older than the interval and no
#    attempt ran in the last hour (keeps an offline machine from retrying on every session).
fresh() { [ -n "$(find "$1" -mmin "-$2" 2>/dev/null)" ]; }
fresh "$cache" "$((days * 1440))" && exit 0
fresh "$attempt" 60 && exit 0

refresh() {
  mkdir -p "$cache_dir" || return
  touch "$attempt"
  local tmp
  tmp="$(mktemp "$cache_dir/.latest.XXXXXX")" || return
  trap 'rm -f "$tmp"' EXIT HUP INT TERM
  curl -fsS --max-time 10 \
    -H 'Accept: application/vnd.github+json' \
    -A 'brain-starter-update-check' \
    "https://api.github.com/repos/$repo/releases/latest" \
    | tr -d '\n\r' \
    | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | head -n 1 \
    | sed -e 's/.*"v\{0,1\}\([^"]*\)"$/\1/' > "$tmp"
  if is_version "$(head -n 1 "$tmp")"; then mv "$tmp" "$cache"; else rm -f "$tmp"; fi
}

refresh </dev/null >/dev/null 2>&1 &
disown 2>/dev/null
exit 0
