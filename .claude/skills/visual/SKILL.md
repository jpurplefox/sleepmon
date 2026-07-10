---
name: visual
description: Use for a feature with a UI, after the product design exists — explores visual options against the design system, gets the user to pick one, and writes the feature's visual design.
---

# Visual Design

## Overview

Turn the *what* into how it **looks**. Given a design document, design the feature's UI by applying the project's **design system** — components, layout, states — before any implementation.

The core of this skill is **exploration**: you show the user real, styled options and let them choose — you do not write anything durable or touch the design system until they pick a direction.

**Announce at start:** "I'm using the visual skill to design the feature's UI."

**Input:** the design document (the *what* — purpose, scope, rules, acceptance criteria) and the project's **design system** (the visual language: identity, tokens, components, states, decisions). Read both.

## Process

1. **Read the design document and the design system.** Understand what the feature does and the visual language it must speak.
2. **Explore — present at least 2 options.** Before writing any document or touching the design system, produce **at least two** visual mockups of the feature. Each mockup is a **self-contained HTML page**: the design-system tokens (CSS variables) inlined, the feature's screens built by composing the design-system components, realistic placeholder content, and **no JS / no functionality** — the user sees how it looks, not how it works. Render each so the user can actually open and view it — as an **Artifact** (one per option, or one showing the options side by side); fall back to writing the HTML and serving/opening it in a browser where artifacts aren't available. Lead with your recommendation and say how the options differ.
3. **Iterate until the user picks.** The user chooses one option, combines pieces of several, or asks for changes. Revise the mockups and show them again. Stay in this loop until they approve a direction. **Write nothing durable and change nothing in the design system during exploration.**
4. **Detect system growth (only after a direction is approved).** If the chosen design needs a component/token the design system does not have, or hits an inconsistency in it, **flag it to the user** — say what's missing and why. The user decides whether to record it; only with their go-ahead, invoke the `ds-update` skill to change the design system. Never edit the design system yourself.
5. **Write the visual spec** to the scratchpad (the approved design — see Output).
6. **Self-review** the spec with fresh eyes (see below); fix gaps inline.
7. **User reviews** the spec, then **hand off**.

## What this skill owns

Applying the design system to the feature:

- **Component composition** — which existing components/patterns build each screen, and how they're arranged.
- **Layout** — structure, responsive behavior, how it reflows on narrow widths.
- **States** — loading, empty, error, and any locked/disabled presentation, per the design system's rules.
- **Token usage** — which colors/type/radii/spacing apply where, staying within the palette rules (max two "voiced" colors, gold reserved for identity).

It does NOT own functionality or data flow (that's `architect`), nor the product *what* (that's the design document). It composes existing pieces; it does not invent one-off styling that bypasses the design system.

## Output

- **Visual spec → scratchpad.** Write the approved design to the session's scratchpad directory, under `visual/` (the path the harness injects), as `visual/YYYY-MM-DD-<slug>.md`. It is ephemeral scaffolding — do **not** `git add`/`commit` it. Capture: the screens/components used, layout, states, token usage, and responsive notes.
- **System growth → `ds-update`.** Any change to the design system itself (a new/changed component or token, or a decision worth recording) goes through the `ds-update` skill, with the user's go-ahead — never edited here.

## Visual Doc Self-Review

After writing the visual spec, look at it with fresh eyes against the design document and the design system:

1. **Placeholder / TODO scan:** any "TBD", "TODO", or vague hand-waving? The spec must be concrete enough to build from without guessing. Fix them.
2. **AC coverage:** does every UI-facing acceptance criterion from the design map to a screen/component here? Close any gap.
3. **States covered:** are loading, empty, and error states specified — not just the happy path?
4. **System fidelity:** does everything use existing design-system components/tokens? Any one-off styling that should instead be an existing piece — or a `ds-update`?

Fix any issues inline. No need to re-review — just fix and move on.

## User Review Gate

Ask the user to review the visual spec before proceeding:

> "Visual design written to `<path>`. Let me know if you'd like changes before I hand it to `plan`."

Wait for the user's response. If they request changes, make them and re-run the self-review. Only proceed once the user approves.

## Handoff

`visual` and `architect` are siblings — a feature with a UI needs both, in either order, and both feed `plan`. When both are done, invoke the `plan` skill. Do not invoke any other skill.
