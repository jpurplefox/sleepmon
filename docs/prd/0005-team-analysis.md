# Team Analysis

## Purpose

**Team Analysis** answers *"how much does my whole team produce in a day (and a
week), and how strong is it?"*. You assemble a team of up to 5 slots from your Box,
and the tool **aggregates** each member's estimated production into team totals —
berries, skills, ingredients, and their combined strength — plus a **grand total**.

It's where you read the team **as a unit**, not one Pokémon at a time (that's the
[Box](0001-box.md)) or side by side (that's [Comparison](0002-comparison.md)).

Two companion read-outs live on the same page and share its inputs: the [Cooking
plan](0006-cooking-plan.md) and [Map bonuses & Snorlax
rating](0007-map-bonuses-rating.md). **This document covers the core aggregate, the
roster (including split slots), and the Good Camp Ticket.**

## What it does (scope)

1. **Assemble a team** — up to 5 slots, each filled from the Box; a slot can be
   **split** between two Pokémon.
2. **Aggregate production** — berries (by type: amount + strength), skill effects,
   ingredients, and total strength.
3. **Show the grand total** — **daily and weekly (×7)**, combining berries + skills +
   cooking.
4. **Good Camp Ticket** — a global toggle that boosts the team.
5. **Flag members it can't compute** — species outside the curated catalog.

## How it works

### Assembling the team (roster)

- Up to **5 slots**, each filled by picking a saved Pokémon from the Box (via the
  [Box picker](0004-box-picker.md)).
- The roster is **ephemeral** (session state): which Pokémon you assemble is not
  persisted; the Pokémon themselves live in the Box.
- **Split slots** — a slot can hold **two** Pokémon with a weight split (default
  50/50, e.g. 60/40), modeling a slot that **rotates** during the week. Each
  Pokémon's production is **scaled linearly** by its weight before aggregating. A
  normal (single) slot is a 100% split — identical numbers to no split. With every
  slot split, up to 10 Pokémon.

### The aggregate

- **Berries** — per berry type, the amount/day and its strength, with a berry
  subtotal.
- **Skills** — the skill effects the team produces (energy, helpers, dream shards,
  etc.) and total skill strength.
- **Ingredients** — team ingredient totals (which feed the Cooking plan).
- **Strength breakdown** — the share of total strength from berries, skills,
  recipes, fillers, and Extra Tasty.
- **Grand total** — berries + skills + cooking, shown **daily and weekly (×7)**.

### Good Camp Ticket

A **global toggle** modeling Pokémon Sleep's camp bonus. When on, it applies **three
effects** to the whole team (not a single member):

- **Helping 20% faster** — the help interval is scaled by **×0.8**, so each Pokémon
  helps more often. This **cascades**: more helps/day means more **berries,
  ingredients, and skill triggers**.
- **+20% inventory** — each Pokémon's carry size is **×1.2**, so it holds more before
  overflowing.
- **+50% pot** — each meal's pot is **50% larger** (the base pot plus the team's skill
  pot expansion, rounded up), which the [Cooking plan](0006-cooking-plan.md) uses to
  fit more fillers.

### Members it can't compute

If a slot holds a species **outside the curated catalog**, it can't be aggregated;
the tool reports how many members were **excluded** rather than silently dropping
them.

## Acceptance criteria

- With **no members**, the tool shows an empty state (nothing to aggregate), not an
  error.
- Adding a member from the Box updates the team totals; the roster holds **at most 5
  slots**.
- A split slot with weights **60/40** contributes each Pokémon's daily production
  scaled by **0.60 / 0.40**; a single slot (100%) contributes the **same as if
  unsplit** (no regression).
- Weights within a slot always **sum to 100%**; moving one side moves the other.
- **Removing** the active Pokémon from a split slot collapses it to the remaining one
  at **100%**.
- A species **outside the curated catalog** is reported as an **excluded** member
  (with a count), not dropped silently.
- The **grand total** is shown both **daily and weekly (×7)**.
- Turning on the **Good Camp Ticket** applies all three effects: help interval
  **×0.8** (more helps/day → more berries, ingredients, skill triggers), inventory
  **×1.2**, and pot **+50%** per meal.
- The roster is **ephemeral**: reloading does not restore the assembled team (the Box
  members persist; the team composition does not).

## Guidelines

- **The team as a unit.** Team Analysis reads the team as a whole; per-Pokémon detail
  is the Box, side-by-side is Comparison.
- **The computation lives in the domain.** The tool presents aggregated production; it
  does not reinvent the per-Pokémon [Production model](0008-production-model.md) (the
  same one the Box and Comparison use).
- **Ephemeral by default.** The roster, map, bonus, ticket, and meals are session
  inputs; the tool persists nothing on its own.
- **Modifiers annotate, they don't replace.** Splits, the camp ticket, and map
  bonuses shape the aggregate; the underlying per-member production is unchanged.
- **No false hierarchy.** Berries, skills, and cooking feed one total; none is "the
  KPI" beyond the grand total itself.

## Out of scope

- **Editing the Pokémon themselves** — that's the Box (via the [Pokémon
  form](0003-pokemon-form.md)). Team Analysis assembles existing Pokémon.
- **Persisting a team** — the roster is ephemeral.
- **The meal-planning and map/rating read-outs** — those are [Cooking
  plan](0006-cooking-plan.md) and [Map bonuses & Snorlax
  rating](0007-map-bonuses-rating.md), which share this tool's inputs.
