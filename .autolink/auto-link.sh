#!/usr/bin/env bash
# auto-link.sh
#
# Uses a local LLM (Ollama) to classify notes into projects
# and immediately applies the links via Obsidian CLI.
#
# REQUIRES: Ollama running (ollama serve), a small model pulled (e.g. qwen2.5:3b)
# REQUIRES: Obsidian running with CLI enabled
# TRIGGERED BY: git post-commit hook (see .husky/post-commit)

# ── Configuration ────────────────────────────────────────────────────────────
# Update these paths to match your setup

VAULT_PATH="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
MEETINGS_DIR="$VAULT_PATH/meetings"
PROJECTS_DIR="$VAULT_PATH/projects"
LOG_FILE="$VAULT_PATH/logs/auto-link.log"
OLLAMA_MODEL="qwen2.5:3b"  # Change to your preferred model
OLLAMA_URL="http://localhost:11434/api/generate"

# ── Helpers ──────────────────────────────────────────────────────────────────

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    echo "$msg"
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "$msg" >> "$LOG_FILE"
}

check_deps() {
    which obsidian > /dev/null 2>&1 || { echo "[auto-link] obsidian CLI not found. Install: https://help.obsidian.md/cli"; exit 1; }
    obsidian vault info > /dev/null 2>&1 || { echo "[auto-link] Obsidian not running."; exit 1; }
    which ollama > /dev/null 2>&1 || { echo "[auto-link] ollama not found. Run: brew install ollama"; exit 1; }
    curl -s "$OLLAMA_URL" > /dev/null 2>&1 || { echo "[auto-link] Ollama not running. Run: ollama serve"; exit 1; }
}

# Build project list for the LLM prompt from projects/ files
build_project_list() {
    local list=""
    for f in "$PROJECTS_DIR"/*.md; do
        [ -f "$f" ] || continue
        filename=$(basename "$f" .md)
        slug=$(echo "$filename" | sed 's/^[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}-//')
        title=$(grep -m1 '^title:' "$f" | sed 's/^title:[[:space:]]*//' | tr -d '"'"'")
        desc=$(awk '/^---/{c++; next} c==2{print; exit}' "$f" | head -c 200)
        list+="- ${slug}: ${title}. ${desc}\n"
    done
    echo -e "$list"
}

# Classify a single note via LLM
classify_note() {
    local file="$1"
    local project_list="$2"

    local content
    content=$(head -c 3000 "$file")

    local corrections=""
    local corrections_file="$VAULT_PATH/.autolink/corrections.md"
    if [ -f "$corrections_file" ]; then
        corrections=$(grep "^|" "$corrections_file" | grep -v "Meeting title" | grep -v "^|---" | \
            awk -F'|' '{gsub(/^ +| +$/, "", $2); gsub(/^ +| +$/, "", $3); gsub(/^ +| +$/, "", $5); print "- If meeting contains \""$2"\" → project: "$3" (not "$4") because "$5}')
    fi

    local prompt
    prompt="You are a classifier. Given a meeting note and a list of projects, output ONLY the project key that best matches, or the word 'none' if no project clearly matches. Output exactly one word. No punctuation, no explanation.

Projects:
${project_list}

Past correction examples (learn from these mistakes):
${corrections}

Meeting note:
${content}"

    local result
    result=$(curl -s "$OLLAMA_URL" \
        -H "Content-Type: application/json" \
        -d "$(jq -n \
            --arg model "$OLLAMA_MODEL" \
            --arg prompt "$prompt" \
            '{model: $model, prompt: $prompt, stream: false, options: {temperature: 0}}')" \
        | jq -r '.response' \
        | tr -d '[:space:]' \
        | tr '[:upper:]' '[:lower:]')

    echo "$result"
}

# Find the full project filename for a given slug
slug_to_filename() {
    local slug="$1"
    for f in "$PROJECTS_DIR"/*.md; do
        [ -f "$f" ] || continue
        filename=$(basename "$f" .md)
        derived=$(echo "$filename" | sed 's/^[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}-//')
        if [[ "$derived" == "$slug" ]]; then
            echo "$filename"
            return
        fi
    done
}

# Check if a filename matches any pattern in the ignore list
is_ignored() {
    local filename="$1"
    local ignore_file="$VAULT_PATH/.autolink/ignore.txt"
    [ -f "$ignore_file" ] || return 1
    while IFS= read -r pattern; do
        [[ -z "${pattern// }" ]] && continue
        if [[ "$pattern" == *\* ]]; then
            local prefix="${pattern%\*}"
            [[ "$filename" == "$prefix"* ]] && return 0
        else
            [[ "$filename" == "$pattern" ]] && return 0
        fi
    done < <(grep -v '^#' "$ignore_file" | grep -v '^$')
    return 1
}

# Map subdirectory path to a category slug.
# Customize this mapping for your vault structure.
get_category() {
    local file="$1"
    local rel="${file#$MEETINGS_DIR/}"
    [[ "$rel" != */* ]] && echo "" && return
    local subdir="${rel%%/*}"
    # Add your own mappings here:
    case "$subdir" in
        # "Team Meetings") echo "team" ;;
        # "1:1s")          echo "1on1" ;;
        # "Interviews")    echo "hiring" ;;
        # Fallback: slugify the directory name
        *) echo "$(echo "$subdir" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')" ;;
    esac
}

# Classify and link all unlinked notes in a directory (recursive).
classify_and_link_dir() {
    local dir="$1"
    local -n _linked="$2"

    [ -d "$dir" ] || return

    mapfile -d '' files < <(find "$dir" -name "*.md" -print0)
    for file in "${files[@]}"; do
        basename_noext=$(basename "$file" .md)
        if is_ignored "$basename_noext"; then continue; fi
        rel_path="${file#$VAULT_PATH/}"

        # Skip if already linked
        current=$(obsidian property:read name="project" path="$rel_path" 2>/dev/null)
        if [ -n "$current" ] && [[ "$current" != *"not found"* ]] && [[ "$current" != *"Error"* ]]; then
            continue
        fi

        log "Classifying: $(basename "$file")"
        result=$(classify_note "$file" "$project_list")

        if [ -n "$result" ] && [ "$result" != "none" ]; then
            project_file=$(slug_to_filename "$result")
            if [ -n "$project_file" ]; then
                obsidian property:set name="project" value="$result" path="$rel_path" silent 2>/dev/null
                category=$(get_category "$file")
                if [ -n "$category" ]; then
                    obsidian property:set name="category" value="$category" path="$rel_path" silent 2>/dev/null
                fi
                if ! grep -q "\[\[$project_file\]\]" "$file"; then
                    obsidian append path="$rel_path" content="\n---\n[[projects/$project_file]]" silent 2>/dev/null
                fi
                log "  → linked to [[projects/$project_file]]${category:+ [$category]}"
                ((_linked++))
            else
                log "  → '$result' (no matching project file, skipping)"
            fi
        else
            obsidian property:set name="project" value="none" path="$rel_path" silent 2>/dev/null
            log "  → none"
        fi
    done
}

# ── Main ─────────────────────────────────────────────────────────────────────

check_deps

log "── auto-link run ──────────────────────────────────────"
project_list=$(build_project_list)
linked=0

# Classify notes in these directories (add/remove as needed):
classify_and_link_dir "$MEETINGS_DIR"               linked
classify_and_link_dir "$VAULT_PATH/notes"            linked
classify_and_link_dir "$VAULT_PATH/working-files"    linked

log "Done. Linked: $linked notes."

# ── Backfill category on already-linked notes ─────────────────────────────────
log "── category backfill run ─────────────────────────────────────────────"
backfilled=0
[ -d "$MEETINGS_DIR" ] && {
    mapfile -d '' backfill_files < <(find "$MEETINGS_DIR" -name "*.md" -print0)
    for file in "${backfill_files[@]}"; do
        basename_noext=$(basename "$file" .md)
        if is_ignored "$basename_noext"; then continue; fi
        rel_path="${file#$VAULT_PATH/}"

        current_proj=$(obsidian property:read name="project" path="$rel_path" 2>/dev/null)
        if [ -z "$current_proj" ] || [[ "$current_proj" == *"not found"* ]] || [[ "$current_proj" == *"Error"* ]]; then
            continue
        fi

        current_cat=$(obsidian property:read name="category" path="$rel_path" 2>/dev/null)
        if [ -n "$current_cat" ] && [[ "$current_cat" != *"not found"* ]] && [[ "$current_cat" != *"Error"* ]]; then
            continue
        fi

        category=$(get_category "$file")
        if [ -n "$category" ]; then
            obsidian property:set name="category" value="$category" path="$rel_path" silent 2>/dev/null
            log "  → backfilled category '$category' on $basename_noext"
            ((backfilled++))
        fi
    done
}
log "Done. Backfilled category: $backfilled notes."

# ── Meeting series linking ─────────────────────────────────────────────────────
log "── meeting series linking run ─────────────────────────────────────────"
series_linked=0
[ -d "$MEETINGS_DIR" ] && {
    while IFS= read -r -d '' subdir; do
        mapfile -t subdir_files < <(find "$subdir" -maxdepth 1 -name "*.md" | sort)
        [ "${#subdir_files[@]}" -lt 2 ] && continue

        for (( i=1; i<${#subdir_files[@]}; i++ )); do
            current="${subdir_files[$i]}"
            previous="${subdir_files[$((i-1))]}"

            current_basename=$(basename "$current" .md)
            previous_basename=$(basename "$previous" .md)
            current_rel="${current#$VAULT_PATH/}"

            if is_ignored "$current_basename" || is_ignored "$previous_basename"; then continue; fi

            if ! grep -qF "[[$previous_basename]]" "$current" 2>/dev/null; then
                obsidian append path="$current_rel" content="← [[$previous_basename]]" silent 2>/dev/null
                log "  → $current_basename ← $previous_basename"
                ((series_linked++))
            fi
        done
    done < <(find "$MEETINGS_DIR" -mindepth 1 -type d -print0)
}
log "Done. Series links added: $series_linked."

# ── Task files → project hubs ─────────────────────────────────────────────
log "── task-file linking run ─────────────────────────────────────────────"
tasks_linked=0

[ -d "$VAULT_PATH/tasks" ] && {
    for file in "$VAULT_PATH/tasks/"*.md; do
        [ -f "$file" ] || continue
        task_filename=$(basename "$file" .md)
        if is_ignored "$task_filename"; then continue; fi
        task_link="[[$task_filename]]"

        if grep -Frl "$task_link" "$PROJECTS_DIR/" > /dev/null 2>&1; then
            continue
        fi

        log "Finding hub for task file: $task_filename"
        result=$(classify_note "$file" "$project_list")

        if [ -n "$result" ] && [ "$result" != "none" ]; then
            project_file=$(slug_to_filename "$result")
            if [ -n "$project_file" ]; then
                hub_path="$PROJECTS_DIR/$project_file.md"
                if ! grep -q "## Tasks" "$hub_path"; then
                    printf '\n---\n\n## Tasks\n\n%s\n' "$task_link" >> "$hub_path"
                elif ! grep -q "$task_link" "$hub_path"; then
                    sed -i '' "/## Tasks/a\\
$task_link" "$hub_path"
                fi
                log "  → added $task_link to [[projects/$project_file]]"
                ((tasks_linked++))
            else
                log "  → '$result' (no matching project file, skipping)"
            fi
        else
            log "  → none"
        fi
    done
}

log "Done. Task files linked: $tasks_linked."
