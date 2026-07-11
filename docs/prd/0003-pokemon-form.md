# Pokémon form

## Purpose

A single form to **build or fix a Pokémon's configuration**, respecting the game's
rules (what unlocks at which level). It is the **same component** across its
uses — today the [Box](0001-box.md) (create/edit a member) and
[Comparison](0002-comparison.md) (create/edit a config), potentially more — and it
is a **shared building block**, not a tool of its own.

It owns *what a valid config is and how the form guides you to one*. What happens to
the resulting config is owned by **whoever opens it**: the Box persists it,
Comparison keeps it ephemeral, and a future caller could do something else.

It answers: *"how do I set up (or correct) this Pokémon's config without breaking
the game's rules?"*.

## What it does (scope)

1. **Presents the fields** of a Pokémon config, driven by the catalog.
2. **Guides toward a valid config** — mirrors the domain's unlock and validation
   rules — while letting you **plan ahead** by setting not-yet-unlocked slots.
3. **Two modes** — create (blank defaults) and edit (pre-filled).
4. **Hands the result to its caller** — it does not decide persistence itself.

## How it works

### Fields

- **Species** (required) — a searchable picker with sprites and specialty. Changing
  species **resets** the ingredient slots to each slot's first valid option.
- **Level** — 1–100, with **quick-access buttons** to the unlock levels: ingredients
  at 1 / 30 / 60 and sub skills at 10 / 25 / 50 / 70 / 80.
- **Nature** (optional, default none) — shows each nature's effect (the stat it
  raises and the one it lowers).
- **Ingredients** — **3 slots**, unlocking at 1 / 30 / 60; each slot offers the
  species' valid options.
- **Sub skills** — up to **5**, unlocking at 10 / 25 / 50 / 70 / 80; each unique.
- **Main skill level** — from 1 up to the skill's maximum (typically 7).
- **Ribbon** (optional, default none) — steps through the research thresholds
  (200 / 500 / 1000 / 2000 h), each showing its bonus.

### Plan-ahead rule (locked but editable)

A slot that is not yet unlocked at the current level **can still be set**: the value
is assigned to the Pokémon and simply **takes effect when it reaches that level**.
Such slots are shown **dimmed but interactive** (not disabled). The same applies to
sub skills.

### Catalog-driven

Every field's options come from the **domain catalog**; the form is **dependent** —
the species defines the ingredient slots, and the level defines the unlocks. Nothing
is hard-coded per species.

### Validation mirrors the domain

The form mirrors the rules to **guide** (it blocks submit until the config is
minimally valid), but the **backend is the source of truth**. Submit stays disabled
until a **known species** is chosen and **all 3 ingredient slots** are filled. When
the backend rejects a save, the error is surfaced **inline** and the modal keeps the
entered values.

### Modes and destination

- **Create** opens with blank defaults; **Edit** opens **pre-filled** from the
  existing config.
- The form hands its result to the caller and **does not persist on its own**: the
  Box saves it (persistent); Comparison keeps it in the session (ephemeral). In
  Comparison a **footer note** states whether changes reach the Box — they don't,
  unless the card came from the Box, in which case saving updates that origin.

## Acceptance criteria

- **Submit is disabled** until a **known species** is chosen and **all 3 ingredient
  slots** are filled.
- Choosing a species **not in the loaded catalog** shows an inline error and blocks
  submit.
- **Changing the species** resets the 3 ingredient slots to each slot's first valid
  option — except when first opening in **edit**, which keeps the saved ingredients.
- A slot or sub skill **above the current level** can still be set; it appears
  **dimmed but interactive** (never disabled by level).
- **Sub skills** are capped at **5** and must be **unique**; a 6th cannot be added.
- **Level** accepts **1–100**; the quick buttons jump to 1 / 10 / 25 / 30 / 50 / 60
  / 70 / 80.
- A **create** form opens with defaults: no species, **level 30**, no nature, no sub
  skills, no ribbon, **skill level 1**, and ingredients empty until a species is
  chosen.
- An **edit** form opens **pre-filled** with the existing config.
- A **backend rejection** (invalid combo, out-of-range value, etc.) is surfaced
  inline; the modal **stays open** with the entered values.
- The modal can be **dismissed** with Escape, a backdrop click, or the close
  control; dismissing makes **no changes**.
- In **Comparison**, a footer note states whether changes will reach the Box (they
  don't, unless the card came from the Box and is saved from it).

## Guidelines

- **One form, agnostic of its caller.** The same form serves any tool that needs a
  Pokémon config (today the Box and Comparison, potentially more); it produces the
  config and hands it off — **each caller decides what to do with the data** (persist
  it, keep it ephemeral, feed it somewhere else).
- **The catalog rules.** Field options and unlocks come from the domain catalog; the
  form is dependent and never hard-codes per-species data.
- **Validation lives in the domain.** The form mirrors the rules to guide, but the
  backend imposes the truth.
- **Let the user plan ahead.** Not-yet-unlocked slots stay editable (dimmed, not
  disabled), because the value simply activates at the right level.

## Out of scope

- **Deciding persistence.** The form produces a config; whether it is saved (Box) or
  kept ephemeral (Comparison) is the caller's decision.
- **Suggesting a config.** It does not recommend species, natures, or builds — it
  records what you choose.
