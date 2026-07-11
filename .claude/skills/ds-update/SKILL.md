---
name: ds-update
description: Records a change to the design system in docs/design-system.md — adds or edits a token/component, and/or appends a visual decision. Invoked when a durable visual decision or new piece needs to be captured.
---

# Design System Update

## Overview

Record **one** coherent change to the project's design system (`docs/design-system.md`): a new or changed **token** or **component**, and/or a **decision** worth remembering.

**Announce at start:** "I'm using the ds-update skill to update the design system."

## What can change

The design system has two kinds of content, and an update touches one or both:

- **The language** (normative) — tokens (§ Tokens) and the reusable component inventory (§ Component inventory). Add a new piece/token, or refine an existing entry, in the same format as the surrounding ones.
- **The decision log** (§ Decisions) — append a resolved visual/UX question in the form **Question → Resolution → Why**, so a future similar case has a precedent.

A given change is often both: a new piece *and* the decision behind it.

## Steps

1. **Decide what the change is:** a token, a component/pattern, a decision, or a combination.
2. **Ground it against the real code — don't trust the mockup.** If the change adds a variant of, or edits, an **existing** component, first read that component's actual implementation (CSS/markup) and confirm the approved design genuinely *is* that component. If it only looks similar but is a distinct pattern (different structure, borders, gaps, states), record it as its **own component**, not a variant of the other. Never extend a component you have not read — the design system is the source of truth, so a wrong entry here misleads every later use.
3. **Check it fits the concept.** A change must reinforce the identity, not fight it — respect the anti-goals (no gratuitous tokens/colors/effects; prefer removing to adding). If it doesn't fit, say so rather than recording it.
4. **Edit `docs/design-system.md`:**
   - New/changed **token** → the Tokens section, following the existing grouping and comment style.
   - New/changed **component/pattern** → the Component inventory, matching the existing entry shape (what it is · variants · states · where it lives).
   - **Decision** → append to the Decisions log: `**Title.** *Question:* … *Resolution:* … *Why:* …`.
   - Keep edits minimal and consistent with the surrounding format.
5. **Offer to commit.** Offer to commit the `docs/design-system.md` change, staging **only** that file. Commit only if the user accepts.

## Scope

One coherent change per invocation — a single piece and/or a single decision. Don't refactor the whole document; record what was just resolved.
