---
name: m365
description: "Microsoft 365 CLI: Read, move, and organize Outlook emails across multiple tenants. Use when interacting with Outlook mail - reading inbox, moving messages, managing folders, or triaging email."
metadata:
  openclaw:
    category: "productivity"
    requires:
      bins: ["m365"]
---

# m365 - Microsoft 365 CLI

Use this skill when the user wants to interact with their Microsoft 365 Outlook mail.

## Quick Reference

```bash
# List connections
m365 connection list

# Switch tenant
m365 connection use --name "<connection-uuid>"

# Check status
m365 status

# List inbox messages
m365 outlook message list --folderName inbox -o json

# List messages in a specific folder (use ID for folders with / in name)
m365 outlook message list --folderId "<folder-id>" -o json

# Move a message (sourceFolderName or sourceFolderId is REQUIRED)
m365 outlook message move --id "<msg-id>" --sourceFolderName inbox --targetFolderId "<folder-id>" -o none

# Delete a message
m365 outlook message remove --id "<msg-id>" --force -o none

# Get a single message with body
m365 outlook message get --id "<msg-id>" -o json

# Send an email
m365 outlook mail send --to "user@example.com" --subject "Subject" --bodyContents "Body" --bodyContentType Text

# List sent items
m365 outlook message list --folderName sentitems -o json
```

## Connection Management

Each Microsoft 365 tenant requires its own Entra app registration and connection. Connection names are UUIDs assigned at login time.

```bash
# Login to a tenant
m365 login --connectionName "<name>" --appId "<app-id>" --tenant "<tenant-id>"

# List all connections
m365 connection list

# Switch active connection
m365 connection use --name "<connection-uuid>"
```

**Important:** Named connections (e.g. "dectria") get lost on `m365 logout`. Always use UUID connection names from `m365 connection list`.

Check memory file `reference_m365_cli.md` for the user's configured connection UUIDs and folder IDs.

## JMESPath Queries

Use `--query` to filter JSON output and reduce noise:

```bash
# Just subject, sender, date
m365 outlook message list --folderName inbox -o json \
  --query "[].{subject:subject, from:from.emailAddress.address, received:receivedDateTime}"

# Include read status
m365 outlook message list --folderName inbox -o json \
  --query "[].{id:id, subject:subject, from:from.emailAddress.address, received:receivedDateTime, isRead:isRead}"

# Filter by date range
m365 outlook message list --folderName inbox --startTime "2026-03-01T00:00:00Z" --endTime "2026-03-31T23:59:59Z" -o json

# Get just message IDs
m365 outlook message list --folderName inbox -o json --query "[].id"

# Filter by subject keyword
m365 outlook message list --folderName inbox -o json --query "[?contains(subject, 'keyword')]"
```

## Folder Operations

The m365 CLI has no native folder create/delete commands. Use the Graph API directly:

```bash
# Get access token
TOKEN=$(m365 util accesstoken get --resource https://graph.microsoft.com 2>&1 | tr -d '"')

# List all folders
curl -s "https://graph.microsoft.com/v1.0/me/mailFolders?\$top=50" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for f in data['value']:
    print(f['displayName'], '|', f['id'])
"

# Create a folder
curl -s -X POST "https://graph.microsoft.com/v1.0/me/mailFolders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"FolderName"}'

# Create a subfolder
curl -s -X POST "https://graph.microsoft.com/v1.0/me/mailFolders/<parent-folder-id>/childFolders" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"SubfolderName"}'
```

## Batch Moving Messages

When moving multiple messages, loop over IDs:

```bash
FOLDER_ID="<target-folder-id>"
for id in "${MSG_IDS[@]}"; do
    m365 outlook message move --id "$id" --sourceFolderName inbox --targetFolderId "$FOLDER_ID" -o none 2>&1
done
```

For moving all messages matching a date filter:

```bash
# Get IDs of messages before a cutoff date
IDS=$(m365 outlook message list --folderId "<source-folder>" --endTime "2026-03-01T00:00:00Z" -o json --query "[].id")

# Move each one
for id in $(echo "$IDS" | python3 -c "import json,sys; [print(i) for i in json.load(sys.stdin)]"); do
    m365 outlook message move --id "$id" --sourceFolderId "<source>" --targetFolderId "<target>" -o none
done
```

## Gotchas

- **Folder names with `/`** (like `dec/Action`) don't work with `--folderName` - always use `--folderId`
- **`message move` requires source** - `--sourceFolderName` or `--sourceFolderId` is mandatory, not optional
- **`m365 request --body` needs content-type** - there's no way to set headers; use `curl` with access token instead
- **Named connections are fragile** - they get lost on logout; use UUID names from `connection list`
- **Output can be huge** - always use `--query` to filter fields, or pipe through `python3 -c` for processing
- **Rate limits** - moving many messages sequentially works fine; no need for delays between calls

## Permissions Required

Both apps need these delegated permissions (configured in Azure Entra ID):

| Permission | Purpose |
|------------|---------|
| User.Read | Sign in and read profile |
| Mail.ReadWrite | Read and move emails |
| MailboxFolder.ReadWrite | List and create folders |

Admin consent must be granted in each tenant's Azure portal.

## Setup (New Tenant)

1. `m365 setup` - interactive wizard, creates Entra app registration
2. Select "User.Read" scopes (add Mail.ReadWrite + MailboxFolder.ReadWrite manually in Azure Portal)
3. Select "Scripting" mode
4. Grant admin consent in Azure Portal > Entra ID > App registrations > API permissions
5. `m365 login --connectionName "<name>" --appId "<app-id>" --tenant "<tenant-id>"`
