#!/usr/bin/env bash
# classify-meetings.sh
#
# Automatically tags unclassified meeting notes with a project: frontmatter field.
# Auto-discovers projects from projects/ subdirectories, then matches meeting
# titles against directory names + optional extra keywords from project files.
# Designed to run from .git/hooks/post-commit (obsidian-git triggers this).
#
# Only processes meetings/ files that:
# 1. Have frontmatter (start with ---)
# 2. Don't already have a project: field
# 3. Were committed in the last git commit (or all if --all flag)

set -eo pipefail

BRAIN_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
MEETINGS_DIR="$BRAIN_DIR/meetings"
PROJECTS_DIR="$BRAIN_DIR/projects"

# Extra keywords per project (beyond the directory name itself).
# Optional - only needed when the directory name alone isn't enough.
# Format: project_dir_name -> pipe-separated regex patterns
# These are checked IN ADDITION to the auto-discovered directory name.
declare -A EXTRA_KEYWORDS=(
  # Examples - replace with your own projects and keywords:
  # [my-saas]="saas|product.*review|sprint.*review|standup"
  # [client-acme]="acme|acme.corp|workshop.*acme"
  # [side-project]="hackathon|prototype|mvp"
)

# Auto-discover project directories
discover_projects() {
  local projects=()
  for dir in "$PROJECTS_DIR"/*/; do
    [ -d "$dir" ] || continue
    local name
    name=$(basename "$dir")
    projects+=("$name")
  done
  echo "${projects[@]}"
}

classify_file() {
  local file="$1"

  # Skip if no frontmatter
  [ "$(head -1 "$file")" != "---" ] && return

  # Skip if already has project: field
  local fm
  fm=$(awk 'NR==1{next} /^---$/{exit} {print}' "$file")
  echo "$fm" | grep -q "^project:" && return

  # Get title from frontmatter or filename
  local title
  title=$(echo "$fm" | grep "^title:" | head -1 | sed 's/^title:[[:space:]]*//' | sed 's/^["'"'"']//;s/["'"'"']$//' | tr '[:upper:]' '[:lower:]')
  [ -z "$title" ] && title=$(basename "$file" .md | tr '[:upper:]' '[:lower:]')

  # Match against projects
  local matched_project=""
  for project in $(discover_projects); do
    # Build pattern: directory name + any extra keywords
    local pattern="$project"
    if [ -n "${EXTRA_KEYWORDS[$project]+x}" ]; then
      pattern="$project|${EXTRA_KEYWORDS[$project]}"
    fi

    if echo "$title" | grep -iEq "$pattern"; then
      matched_project="$project"
      break
    fi
  done

  if [ -n "$matched_project" ]; then
    # Insert project: field after the opening ---
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "1 a\\
project: $matched_project
" "$file"
    else
      sed -i "1 a project: $matched_project" "$file"
    fi
    echo "  Tagged: $(basename "$file") -> $matched_project"
  fi
}

# Determine which files to process
if [ "$1" = "--all" ]; then
  # Process all untagged meetings
  find "$MEETINGS_DIR" -maxdepth 1 -name "*.md" | while read -r file; do
    classify_file "$file"
  done
else
  # Only process files from the last commit that are in meetings/
  git -C "$BRAIN_DIR" diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null | grep "^meetings/.*\.md$" | while read -r relpath; do
    local_file="$BRAIN_DIR/$relpath"
    [ -f "$local_file" ] && classify_file "$local_file"
  done
fi
