---
name: email-triage
description: "Scan, categorize, and organize Outlook emails across multiple accounts. Reads inbox, cross-references sent items, and proposes triage (Action/Waiting/Archive/Newsletter). Always human-in-the-loop before moving. Use when the user wants to clean up their inbox, triage emails, or check what needs attention."
---

# Email Triage

Scan Outlook inboxes, categorize emails, and organize them into folders - always with user approval before moving anything.

## Prerequisites

- m365 CLI installed and configured (invoke the `m365` skill for reference)
- Check memory file `reference_m365_cli.md` for connection UUIDs and folder IDs

## Workflow

### 1. Connect and scan

Switch to the target tenant and scan the inbox:

```bash
m365 connection use --name "<connection-uuid>"
m365 outlook message list --folderName inbox -o json \
  --query "[].{id:id, subject:subject, from:from.emailAddress.address, received:receivedDateTime, isRead:isRead}"
```

Also scan sent items to know what the user already replied to:

```bash
m365 outlook message list --folderName sentitems --startTime "<30-days-ago>" -o json \
  --query "[].{subject:subject, to:toRecipients[0].emailAddress.address, sent:sentDateTime}"
```

### 2. Categorize each message

For every inbox message, determine the category by applying these rules **in order**:

#### Newsletter
Bulk sender, no personal content. Common patterns:
- `@mail.beehiiv.com`, `@substack.com`, `newsletters@*`, `@newsletter.*`
- `noreply@*` with marketing content
- Political party newsletters, industry digests

#### Action (requires user's response or work)
- Unanswered business email (no matching sent item after receive date)
- Someone replied AFTER the user's last reply (cross-reference sent items!)
- Tasks assigned to user (HubSpot reminders, Jira assignments)
- Expiring items (credit cards, certificates, domain verifications)
- Invoices/bills that need processing
- Security alerts requiring action

#### Waiting (user already acted, waiting on others)
- User replied and no response yet
- Support tickets in progress
- Pending offers/proposals from vendors

#### Archive (no action needed)
- User replied and conversation is done (no new reply from other side)
- Old Jira/GitHub notifications (due dates passed, PRs merged)
- LinkedIn contact requests, job suggestions
- Transactional confirmations (domain registered, payment processed)
- Superseded messages (older message in same thread where newer exists)

### 3. Cross-reference sent items

**Critical step.** For each inbox message, check if the user already replied:

1. Search sent items for matching recipient or subject keywords
2. Compare timestamps: user's last sent vs. inbox message received date
3. If inbox message arrived AFTER user's last reply -> **Action** (they responded to you)
4. If user's reply was AFTER the inbox message -> check if anyone replied after that
5. If no sent match found -> likely **Action** (unanswered)

**Rule: Never archive a conversation where someone replied after the user's last response.**

### 4. Present triage to user

Always present the full categorization as a table BEFORE moving anything:

```
## Account: you@example.com - Inbox (N mails)

**ACTION (X mails):**
| Betreff | Von | Datum | Grund |
|---------|-----|-------|-------|
| ... | ... | ... | Unanswered / Reply after yours |

**WAITING (X mails):**
| ... |

**NEWSLETTER (X mails):**
| ... |

**ARCHIVE (X mails):**
| ... |

**UNKLAR (X mails):**
| ... | ... | ... | Need your input |
```

### 5. Wait for user approval

**NEVER move emails without explicit user confirmation.** The user may:
- Correct categorizations
- Exclude specific senders from bulk operations
- Ask to see email content before deciding
- Change their mind about specific items

Common user corrections to watch for:
- "Don't archive anything from X" -> remember this for future triages
- "That's actually done" -> move to archive
- "Move only the newsletters for now" -> partial execution

### 6. Execute moves

Only after user says "go" or confirms specific categories:

```bash
m365 outlook message move --id "<msg-id>" --sourceFolderName inbox --targetFolderId "<folder-id>" -o none
```

Report results: `"Moved X to Action, Y to Archive, Z to Newsletter"`

## Folder Structure

Standard folder layout (check actual folder IDs in memory):

| Folder | Purpose |
|--------|---------|
| Inbox / Posteingang | Unsorted incoming |
| {prefix}/Action | Needs user's response or work |
| {prefix}/Waiting | User acted, waiting on others |
| Archive / Archiv | Done, no action needed |
| Newsletter | Bulk/digest emails |

## Priority Assessment

When the user asks for highest priority items, rank by:

1. **Expiring/breaking things** - certificates, credit cards, domain verification, service disruptions
2. **Legal/equity** - contracts, VSOPs, NDAs, compliance (ISO, DORA)
3. **Unanswered business** - client/partner emails waiting for response, especially older ones
4. **Broken infrastructure** - expired tokens, CI failures, DB issues
5. **Revenue opportunities** - new business inquiries, partnership responses

## Important Rules

- **Human in the loop always** - present, wait for approval, then move
- **Cross-reference sent items** - never assume a mail is unanswered without checking
- **Respect sender exclusions** - if user says "don't auto-archive X", save to memory and honor in future
- **Scan all configured accounts** - check memory for which tenants are set up
- **Don't read email bodies by default** - subject + sender + date is usually enough; only fetch body if user asks or categorization is unclear
- **Batch by account** - triage one account at a time, present results, then move to next
