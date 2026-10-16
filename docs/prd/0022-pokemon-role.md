# Pokémon role

> Product document. The visual language lives in
> [`docs/design-system.md`](../design-system.md).

## Purpose

The game labels every Pokémon with a **specialty** (Berries, Ingredients, Skills), but
some Skills specialists earn their place by what they **produce**, not by their skill:
a Charge Strength Noivern is played as a berry Pokémon, an Ingredient Draw Crustle as an
ingredient one.

The **role** answers *"what is this Pokémon really for?"*. It is one internal
classification, never shown as a label, that every feature asking that question reads
the same way, so a Pokémon never counts as a berry Pokémon in one place and a skill one
in another.

## What it does (scope)

1. **Assigns each Pokémon one role** — Berries, Ingredients or Skills — from its
   specialty and its main skill.
2. **Is read by** [Box coverage](0001-box.md#box-coverage), the [level-up
   gain](0021-level-up-cost.md#what-the-target-buys) and the [Comparison
   suggestions](0002-comparison.md#suggestions).

## How it works

| Role | Who has it |
|---|---|
| **Berries** | Berries specialists, and **Skills** specialists whose main skill is **Charge Strength** or **Berry Burst** (any variant) |
| **Ingredients** | Ingredients specialists, and **Skills** specialists whose main skill is **Ingredient Draw** (any variant) |
| **Skills** | every other Skills specialist — **Ingredient Magnet** included: its ingredients are random, so it is no ingredient Pokémon |

- **The specialty wins.** The skill only re-files Skills specialists: Golem, an
  Ingredients specialist with Charge Strength, stays in Ingredients.
- **Mythicals ("All": Mew, Darkrai)** keep counting as every specialty in Box coverage
  and read their strength in the level-up gain, as before. Where a single role is
  needed — the Comparison suggestions — they take the role their main skill gives a
  Skills specialist: Darkrai (Charge Strength M) is Berries, a Mew carrying Ingredient
  Draw is Ingredients, a Mew with any other skill is Skills. A Mew's skill is the one it
  carries.

## Acceptance criteria

- **Noivern** (Skills, Charge Strength M) → Berries; **Sceptile** (Skills, Berry Burst)
  → Berries.
- **Crustle** (Skills, Ingredient Draw S) → Ingredients.
- **Plusle** (Skills, Ingredient Magnet S (Plus)) → Skills: it no longer covers its main
  ingredient in Box coverage, and its level-up gain reads skill triggers / day.
- **Delibird** (Ingredients, Ingredient Magnet S (Present)) → Ingredients, by its
  specialty.
- **Golem** (Ingredients, Charge Strength S (Random)) → Ingredients; **Wigglytuff**
  (Skills, Energy for Everyone S) → Skills.
- **Darkrai** in the Comparison suggestions → Berries (its berry); in Box coverage it
  still counts as each specialty.
- A **Mew carrying Cooking Power-Up S** in the Comparison suggestions → Skills.

## Guidelines

- **One rule, read everywhere.** A feature that sorts Pokémon by what they're for uses
  the role; it never re-derives its own variant.
- **Produce, not label.** The role groups Pokémon that can replace one another in a
  team; a skill whose output is random or not a berry/ingredient stays Skills.
- **Internal.** The role shapes counts, gains and suggestions; it is not displayed as a
  tag, and the game's specialty stays the one shown and filtered on.

## Out of scope

- **Showing or filtering by role.** The Box keeps filtering and counting by the game's
  specialty.
- **Partial roles** (e.g. Dream Shard Magnet (Aura Sphere) adding some strength): a
  skill re-files a Pokémon only when berries or specific ingredients are its point.
