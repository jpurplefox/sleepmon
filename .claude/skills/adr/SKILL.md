---
name: adr
description: Records one architectural decision as an ADR in docs/adr — picks the next number, writes the Nygard record, updates the index, and handles supersession. Invoked when a durable cross-cutting decision needs to be captured.
---

# Writing an ADR

## Overview

Record **one** significant architectural decision as an ADR in `docs/adr/`, using the Nygard format: **Title / Status / Context / Decision / Consequences**. Usually invoked when `architect` detects a durable, cross-cutting decision, but it can be run on its own.

**Announce at start:** "I'm using the adr skill to record an architectural decision."

## Steps

1. **Pick the next number.** Scan `docs/adr/` and its index (`docs/adr/README.md`) for the highest existing four-digit `NNNN` and add 1. Numbers are **never reused** — count superseded and deprecated records too.
2. **Write the record** at `docs/adr/NNNN-<kebab-title>.md`, following `docs/adr/0000-template.md`:
   - `# NNNN. <short title>` and `Date: <YYYY-MM-DD>`.
   - **Status:** `Accepted` for a decision that has been made; use `Proposed` only if it is still open.
   - **Context:** the forces at play — technical constraints, product goals, what makes the choice non-obvious. State facts, not opinions.
   - **Decision:** active voice — "We will …".
   - **Consequences:** what becomes easier or harder, including the trade-offs knowingly accepted.
3. **Supersession** (only if this replaces an earlier decision): do **not** rewrite the old ADR's `Decision` — it is history. Update the old record's **Status** to `Superseded by [ADR-NNNN](…)`, or `Partially superseded by [ADR-NNNN](…) (which part)`, and reference it from this record's Context.
4. **Update the index.** Add a row to the table in `docs/adr/README.md` (`| [NNNN](file) | Title | Status |`), and update the superseded record's Status cell if step 3 applied.
5. **Offer to commit.** Offer to commit the new ADR plus the README index change (and any superseded record you touched), staging **only** those files. Commit only if the user accepts.

## Scope

One decision per ADR — though a "decision" may be a cohesive set of tightly-related choices (e.g. a whole tech stack). Capture the architectural decision and its trade-offs, not implementation detail and not the full plan.
