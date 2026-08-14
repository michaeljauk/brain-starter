---
name: log-decision
description: Log cross-cutting business/product/hiring/vendor decisions to decisions/ directory with context and alternatives
---

# Log Decision

Capture non-trivial decisions that span projects, with context and alternatives considered.

## Trigger phrases

- "log decision: [topic]"
- "/log-decision [topic]"

## Workflow

1. Ask for context if not provided (what needed deciding, who was involved, alternatives considered)
2. Create `decisions/YYYY-MM-DD-short-slug.md` using the template in `docs/templates.md`
3. Use today's date

## Scope

Business, product, hiring, vendor, cross-project architecture.

**Not** product or tech ADRs — those live in the product repo at `/docs/adr/`.
**Not** project-specific decisions — those go in `projects/{project}/decisions/`.
