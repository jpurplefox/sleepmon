# Comparison

## Purpose

**Comparison** lets you put **several Pokémon side by side** and read the
differences in their **estimated daily production**. The goal is to **compare**:
the production estimate is the input, not the end.

It answers: *"of these configurations, which one yields more, and why?"*.

The first card is the **base**; every other card is read as a **delta** against it.
Production is a shared concept other tools also use; the identity of **this** tool
is the comparison.

## What it does (scope)

1. **Add Pokémon to compare**, in three ways — a **new** ad-hoc config, one brought
   from the [Box](0001-box.md), or a **clone** of a card already present.
2. **Estimate and show** each card's daily production: help cadence, helps/day,
   inventory and fill time, and three equal-weight blocks — **berries, ingredients,
   and skill** — including the chance of triggering the skill **while asleep**.
3. **Compare with a base and deltas** — the first card is the base; the rest show
   the difference against it. The base can be reordered or changed.
4. **Act on each card** — edit, clone, remove, reorder, and save to the Box.
5. **Persist by explicit action only** — save a config to the Box (as new, or
   updating the origin Pokémon a card came from).

## How it works

### Adding cards

- **New** — an ad-hoc configuration built with the [Pokémon
  form](0003-pokemon-form.md). Ephemeral to this comparison; it is not saved
  anywhere until you ask.
- **My Pokémon** — brings a saved config **from the Box** through the searchable
  [Box picker](0004-box-picker.md), which **excludes** members already in the
  comparison. The config is **copied** in.
- **Clone** — duplicates a card already present, **untied** to any Box Pokémon.
  Meant for comparing **variants** of a similar Pokémon (bump the level, swap a sub
  skill or an ingredient, and read the effect).

Entering Comparison from the Box's **Compare** action seeds that Pokémon as the
first card (the base).

### What each card shows

At equal hierarchy, in a neutral color:

- **Help cadence** (seconds per help) and **helps / day**.
- **Inventory** and its **fill time**.
- **Berries** — amount per day, combined **strength** (berries + skill, with the
  breakdown available when the skill contributes), and the berry share of help.
- **Ingredients** — **all** ingredients, combining normal production with the
  skill's when the skill produces ingredients, shown per ingredient.
- **Skill** — triggers/day, the effective skill share, and any **skill-specific
  yield** (energy, random ingredients, dream shards, extra cooking ingredients,
  Extra Tasty chance, help multiplier, etc.).
- **Skill while asleep** — the chance of the skill activating during sleep, shown
  as a **probability** (see *Calculation assumptions*).

For every card except the base, each metric is annotated with its **delta** against
the base.

### Base and deltas

- The **first card is the base**; the base itself shows no deltas.
- Any other card can be promoted with **"Make base"**, and deltas recompute against
  the new base.
- Cards can be **reordered** (drag the grip, or arrow keys / left-right controls).

### Per-card actions

- **Edit** — opens the Pokémon form on that card's config (editing the local copy).
- **Clone** — duplicates the card, untied to the Box.
- **Remove** — drops the card from the comparison.
- **Make base** / **reorder** — as above.
- **Save to Box** — with no origin, creates a **new** Box Pokémon; if the card came
  from the Box, **updates that origin** Pokémon. Shows inline "Saving… / Saved"
  feedback.

## Calculation assumptions

The per-card estimate comes from the shared [Production model](0008-production-model.md)
— a day of **15.5 h awake + 8.5 h asleep**, and a **cap on the skill while asleep** (1
for non-Skill Pokémon, 2 for Skill specialists). Comparison surfaces that night cap as
a **probability** on each card — P(exactly 1) and P(2) for specialists, P(at least 1)
for the rest.

## Acceptance criteria

- **Empty comparison** → a hint to add a Pokémon, with **"+ New"** and **"+ My
  Pokémon"** buttons — not an error.
- **Catalog loading** → "Loading catalog…"; **catalog error** → a message with a
  **retry** option.
- **Per-card computing** → "Calculating…"; a **per-card error** (e.g. a species not
  in the catalog) shows on that card and **does not break the others**.
- **Max 5 Pokémon**: at 5, the add buttons are replaced by a hint ("Already 5
  Pokémon: that's the team max in the game. Remove one to add another."), and
  **Clone is disabled**.
- The **first card is the base** and shows no deltas; every other card shows its
  metrics' **delta** against the base.
- **"Make base"** on a non-base card promotes it to base; all deltas recompute
  against it.
- The **My Pokémon** picker **excludes** members already in the comparison; it is
  searchable and has a clear empty-search state.
- **Clone** produces a card **untied** to any Box Pokémon: editing the clone does
  not change any origin.
- **Save to Box**: a card with no origin **creates** a new Box Pokémon; a card
  brought from the Box **updates** that origin; either way it shows inline
  save feedback.
- **Skill while asleep**: a Skill specialist shows **two** probabilities (P(exactly
  1) and P(2)); other Pokémon show a **single** P(at least 1).
- **Berries, ingredients, and skill** are shown at **equal weight** — none is
  presented as the primary metric.

## Guidelines

- **Comparing is the goal.** Everything is arranged to put configurations in
  parallel and read the differences at a glance.
- **Max 5 Pokémon** — the team size in the game. Comparing more has no product
  meaning and breaks parallel reading.
- **Ephemeral by default, persistent by explicit action.** Configs are local to the
  session; they only touch the Box when the user saves.
- **Copy without coupling.** "My Pokémon" and "Clone" **copy** the config; editing a
  copy never affects its origin unless the user explicitly saves onto that origin.
- **No false hierarchy.** Berries, ingredients, and skill are shown with **equal
  weight**; none is "the main thing".
- **The computation lives in the domain.** The card only **presents** the shared
  [Production model](0008-production-model.md); it may **derive** values (e.g.
  P(exactly 1) = P(≥1) − P(≥2)) but does not reimplement the formula or invent numbers.

## Out of scope

- **Optimization**: Comparison does not suggest the "best" config; it only estimates
  and compares.
- **Being the team record** — that's the [Box](0001-box.md). Comparison touches the
  Box only by explicit save.
