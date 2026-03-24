---
name: acli
description: "Atlassian CLI (acli): Query and manage Jira issues, sprints, boards, and Confluence pages. Use when interacting with Jira or Confluence — searching issues, viewing sprints, creating/editing tickets, transitioning status, or querying boards."
---

# acli — Atlassian CLI

Use the `acli` CLI to interact with Jira and Confluence Cloud. Requires authentication per app.

## Auth

```bash
acli auth status                # check auth state
acli jira auth login --web      # authenticate Jira (OAuth browser flow)
acli confluence auth login --web # authenticate Confluence
```

If a command returns `unauthorized`, prompt the user to re-authenticate.

## Jira: Search issues

```bash
# JQL search — always use --json for structured output
acli jira workitem search --jql "<JQL>" --fields "key,summary,status,assignee,priority" --limit 20 --json

# Count only
acli jira workitem search --jql "<JQL>" --count

# Paginate all results
acli jira workitem search --jql "<JQL>" --fields "key,summary,status,assignee,priority" --json --paginate
```

### Common JQL patterns

| Intent | JQL |
|--------|-----|
| Recently updated | `project = {key} AND updated >= -14d ORDER BY updated DESC` |
| Current sprint | `project = {key} AND sprint in openSprints() ORDER BY priority ASC` |
| Blocked | `project = {key} AND status = Blocked ORDER BY priority ASC` |
| My open issues | `project = {key} AND assignee = currentUser() AND status != Done` |
| Due this week | `project = {key} AND duedate <= endOfWeek() AND status != Done ORDER BY duedate ASC` |
| High priority open | `project = {key} AND priority in (Highest, High) AND status != Done` |
| Unassigned | `project = {key} AND assignee is EMPTY AND status != Done` |
| Recently resolved | `project = {key} AND status = Done AND resolved >= -7d` |
| Epic children | `project = {key} AND "Epic Link" = {key}-1234` |
| Text search | `project = {key} AND text ~ "search term"` |

## Jira: View a single issue

```bash
acli jira workitem view PROJ-1234 --json

# Specific fields only
acli jira workitem view PROJ-1234 --fields "summary,status,assignee,description,comment" --json

# Open in browser
acli jira workitem view PROJ-1234 --web
```

## Jira: Create issues

```bash
acli jira workitem create \
  --project PROJ \
  --type Story \
  --summary "Summary here" \
  --description "Description here" \
  --assignee "user@example.com" \
  --label "label1,label2"

# Self-assign
acli jira workitem create --project PROJ --type Task --summary "..." --assignee @me

# With parent (sub-task of epic)
acli jira workitem create --project PROJ --type Story --summary "..." --parent PROJ-100
```

Types: `Epic`, `Story`, `Task`, `Bug`, `Sub-task`

## Jira: Edit issues

```bash
# By key
acli jira workitem edit --key "PROJ-456" --summary "Updated" --yes

# By JQL (bulk)
acli jira workitem edit --jql "project = PROJ AND labels = old-label" --labels "new-label" --yes

# Remove assignee
acli jira workitem edit --key "PROJ-456" --remove-assignee --yes
```

Always pass `--yes` to skip interactive confirmation.

## Jira: Transition (change status)

```bash
# Single issue
acli jira workitem transition --key "PROJ-456" --status "In Progress" --yes

# Bulk via JQL
acli jira workitem transition --jql "project = PROJ AND status = 'To Do' AND sprint in openSprints()" --status "In Progress" --yes
```

Always pass `--yes` to skip interactive confirmation.

## Jira: Assign

```bash
acli jira workitem assign PROJ-456 --assignee "user@example.com"
acli jira workitem assign PROJ-456 --assignee @me
```

## Jira: Comments

```bash
# List comments
acli jira workitem comment list --workitem PROJ-456 --json

# Add comment
acli jira workitem comment add --workitem PROJ-456 --body "Comment text here"
```

## Jira: Sprints & Boards

```bash
# Find boards
acli jira board search --project PROJ --json

# List sprints for a board
acli jira board list-sprints --id {boardId} --state active --json

# All sprints (active + closed)
acli jira board list-sprints --id {boardId} --json --paginate

# List issues in a sprint
acli jira sprint list-workitems --sprint {sprintId} --board {boardId} --fields "key,summary,assignee,status,priority" --json
```

## Jira: Projects

```bash
acli jira board list-projects --json
```

## Output formats

- `--json` — structured JSON (always prefer this for parsing)
- `--csv` — CSV output
- Default — human-readable table (good for direct display to user)

## Best practices

1. Always use `--json` when you need to parse output programmatically
2. Always use `--yes` on edit/transition commands to avoid interactive prompts
3. Use `--fields` to limit response size — don't fetch all fields unless needed
4. Use `--limit` to cap results; add `--paginate` only when you need everything
5. For bulk operations, prefer JQL-based targeting over listing individual keys
