---
name: research-spike
description: Research a topic using /last30days community signals, then produce a structured comparison matrix and recommendation note in the brain vault. Use when evaluating tools, libraries, vendors, or approaches - e.g. "spike on auth providers", "research X vs Y", "evaluate options for Z".
---

# Research Spike

Runs a structured research spike: gathers real-time community signals via `/last30days`, synthesizes findings into a comparison matrix, and saves a recommendation note to the brain vault.

## Trigger phrases

- `/research-spike [topic]`
- "spike on [topic]"
- "research [topic]"
- "evaluate [X] vs [Y]"
- "compare options for [topic]"
- "what should we use for [topic]?"

## Input

The user provides:
- **Topic** (required) - what to research (e.g., "auth providers for Next.js", "Playwright vs Cypress", "vector databases")
- **Context** (optional) - project constraints, must-haves, dealbreakers
- **Candidates** (optional) - specific options to compare. If not provided, the skill discovers them during research.

## Step-by-step workflow

### 1. Clarify scope

Before researching, confirm:
1. **What decision does this inform?** (library choice, vendor selection, architecture approach, etc.)
2. **What project is this for?** (check `projects/` for active projects - constraints differ per project)
3. **Any known candidates?** If the user already has 2-3 options in mind, start there. If not, discovery is part of the research.
4. **Dealbreakers?** (e.g., "must be open source", "needs EU hosting", "no vendor lock-in")

If the user's input already covers these, skip asking and proceed.

### 2. Run /last30days research

Invoke the last30days skill for the topic. This searches Reddit, X, YouTube, HN, and other sources for community signals from the past 30 days.

```
/last30days [topic]
```

For comparison spikes (X vs Y), use the comparison mode:
```
/last30days [X] vs [Y]
```

If there are 3+ candidates, run `/last30days` for the overall topic first, then targeted searches for the top contenders if the initial results don't cover them well enough.

**Important:** `/last30days` takes 2-8 minutes. Let the user know it's running.

Raw research output is automatically saved to `~/brain/research/` via the `LAST30DAYS_OUTPUT_DIR` env var and `--save-dir` flag. This keeps all research artifacts inside the brain repo.

### 3. Search existing knowledge

While waiting for or after /last30days completes, check the brain vault for prior research:

```bash
qmd vsearch "[topic keywords]"
```

Also check:
- `research/` - any prior /last30days raw output on this topic?
- `research/` - any existing spike or research note on this topic?
- `decisions/` - any past decision that's relevant?
- `projects/` - constraints from the target project?

### 4. Synthesize into comparison matrix

Create a structured comparison. The format depends on the spike type:

**For tool/library/vendor comparisons:**

| Criteria | Option A | Option B | Option C |
|----------|----------|----------|----------|
| Community momentum (last 30 days) | | | |
| Maturity / stability | | | |
| Fits project constraints | | | |
| Pricing / licensing | | | |
| Integration effort | | | |
| [domain-specific criteria] | | | |

**For approach/architecture spikes:**

| Dimension | Approach A | Approach B |
|-----------|-----------|-----------|
| Complexity | | |
| Time to implement | | |
| Maintainability | | |
| Risk | | |
| Community support | | |

Criteria should be tailored to the specific decision - don't use generic filler rows.

### 5. Write recommendation

Produce a clear recommendation with reasoning:

1. **Recommendation** - which option and why (1-2 sentences)
2. **Confidence level** - high / medium / low, and what would change it
3. **Key risk** - the biggest risk with the recommended option
4. **Next step** - what to do to move forward (e.g., "spike a prototype", "check pricing", "discuss with team")

### 6. Save to brain vault

Save the complete research as a note in `research/`:

Filename: `spike-{short-slug}.md`

```markdown
---
title: "Spike: {Descriptive title}"
date: YYYY-MM-DD
type: note
tags: [spike, {relevant-tags}]
---

# Spike: {Descriptive title}

> Research spike for [[{project}]] - {date}

## Context

{What decision this informs, constraints, dealbreakers}

## Community Signals (last 30 days)

{Summarized findings from /last30days - key themes, sentiment, warnings, endorsements. Include source counts (e.g., "across 45 Reddit threads and 12 HN discussions"). Cite specific high-signal posts where relevant.}

## Comparison Matrix

{The comparison table from step 4}

## Recommendation

**{Recommended option}** - {1-2 sentence rationale}

- **Confidence:** {high/medium/low} - {what would change it}
- **Key risk:** {biggest risk}
- **Next step:** {concrete action}

## Sources

{Top 5-10 most valuable sources with links, from /last30days output}
```

If the spike directly relates to a project, also add a one-line reference in the project note's relevant section (e.g., `## Research` or `## Notes`).

### 7. Report to user

```
Spike complete: "{title}"
Location: {file path}
Sources: {X} Reddit threads, {Y} HN discussions, {Z} other
Recommendation: {option} (confidence: {level})
Next step: {action}
```

## Content rules

- **Ground in data, not vibes.** Every claim in the matrix should trace back to community signals or documentation. If data is thin, say so.
- **Recency matters.** Prefer signals from the last 30 days over older knowledge. Flag if the landscape changed recently.
- **No auto-posting.** Never push results to Jira, Linear, or Confluence without the user asking. The note lives in the brain vault.
- **Respect existing decisions.** Check `decisions/` first - if there's a prior decision on this topic, reference it and explain what changed.
- **Dedup.** If `research/` already has a spike on this exact topic, update it rather than creating a new file.

## Examples

**User:** "spike on vector databases for my project"
→ `/last30days vector databases 2024` → comparison of pgvector vs Pinecone vs Weaviate vs Qdrant → saves `research/spike-vector-db.md` with recommendation grounded in community data + project constraints

**User:** "evaluate Playwright vs Cypress"
→ `/last30days Playwright vs Cypress` (comparison mode) → side-by-side matrix → saves `research/spike-playwright-vs-cypress.md`

**User:** "what auth provider should we use?"
→ Checks `projects/` for constraints → `/last30days Next.js auth providers` → comparison of NextAuth vs Clerk vs Auth0 vs Keycloak → saves `research/spike-auth-provider.md`
