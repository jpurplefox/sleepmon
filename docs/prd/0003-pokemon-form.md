# Pokémon form

## Purpose

A single form to **build or fix a Pokémon's configuration**, respecting the game's
rules (what unlocks at which level). It is the **same component** across its
uses — today the [Box](0001-box.md) (create/edit a member),
[Comparison](0002-comparison.md) and [Team Analysis](0005-team-analysis.md)
(create/edit a config), potentially more — and it is a **shared building block**, not
a tool of its own.

It owns *what a valid config is and how the form guides you to one*. What happens to
the resulting config is owned by **whoever opens it**: the Box persists it, Comparison
and Team Analysis keep it ephemeral, and a future caller could do something else.

It answers: *"how do I set up (or correct) this Pokémon's config without breaking
the game's rules?"*.

## What it does (scope)

1. **Presents the fields** of a Pokémon config, driven by the catalog.
2. **Guides toward a valid config** — mirrors the domain's unlock and validation
   rules — while letting you **plan ahead** by setting not-yet-unlocked slots.
3. **Two modes** — create (blank defaults) and edit (pre-filled).
4. **Hands the result to its caller** — it does not decide persistence itself.
5. **Can open pre-filled from game screenshots**, marking what wasn't read — see
   [Screenshot import](0019-screenshot-import.md).
6. **Moves the Pokémon along its evolution line**, one stage forward or back.

## How it works

### Fields

- **Species** (required) — a searchable picker with sprites and specialty. Changing
  species **keeps** each ingredient the new species offers in that slot; any other slot
  falls back to its first valid option.
- **Level** — 1–100, with **quick-access buttons** to the unlock levels: ingredients
  at 1 / 30 / 60 and sub skills at 10 / 25 / 50 / 70 / 80.
- **Nature** (optional, default none) — shows each nature's effect (the stat it
  raises and the one it lowers).
- **Ingredients** — **3 slots**, unlocking at 1 / 30 / 60; each slot offers the
  species' valid options. A mythical (Darkrai, Mew) offers its **whole ingredient pool**
  in **every** slot, each with that slot's amount; repeats are allowed (Mew's Slowpoke
  Tail only comes at the Lv 60 slot).
- **Sub skills** — up to **5**, unlocking at 10 / 25 / 50 / 70 / 80; each unique.
- **Main skill level** — from 1 up to the skill's maximum (typically 7).
- **Mew's skill** — Mew's main skill, *Versatile*, is one of **12 skills** that each
  Mew carries. Its name in the skill stepper opens a menu to pick it; a new Mew starts
  with **Metronome**, as in the game. The stepper reaches Versatile's level 8, and the
  description shows the chosen skill at its own maximum when that is lower.
- **Ribbon** (optional, default none) — steps through the research thresholds
  (200 / 500 / 1000 / 2000 h), each showing its bonus.

### Evolving

A screenshot is often of a Pokémon that hasn't evolved yet, while the comparison you
want is at its full potential. The form moves the Pokémon along its evolution line the
way the game would, instead of re-picking the species by hand:

- **One stage per action**, forward or back: Bulbasaur → Ivysaur → Venusaur takes two
  steps, and going back from Venusaur reaches Ivysaur, then Bulbasaur.
- **Back always reaches the previous stage**, whether the Pokémon was evolved in the
  form or opened already evolved. It also fixes a wrong branch or a misclick.
- A stage with nowhere to go — no evolution, or no previous stage — shows that step as
  unavailable rather than hiding it.
- **Branching lines** (Eevee, Kirlia, Slowpoke, Toxel…) ask **which evolution**; a
  regional form or size evolves into its own (Alolan Vulpix → Alolan Ninetales,
  Paldean Wooper → Clodsire, Jumbo Pumpkaboo → Jumbo Gourgeist).
- What the game keeps, the form keeps: **level, nature, ingredients, sub skills and
  ribbon**.
- The **main skill moves one level per stage**, as evolving does in the game: **up** on
  evolving (to the skill's maximum) and **down** on going back (never below 1).

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
  Box saves it (persistent); Comparison and Team Analysis keep it in the session
  (ephemeral). In those two a **footer note** states whether changes reach the Box —
  they don't, unless the config came from the Box, in which case saving updates that
  origin.

## Acceptance criteria

- **Submit is disabled** until a **known species** is chosen and **all 3 ingredient
  slots** are filled.
- Choosing a species **not in the loaded catalog** shows an inline error and blocks
  submit.
- **Changing the species** keeps each ingredient the new species offers in that slot
  and sets the rest to the slot's first valid option; first opening in **edit** keeps
  the saved ingredients as they are.
- **Evolving** a Bulbasaur twice gives a Venusaur with the same level, nature,
  ingredients, sub skills and ribbon, and a main skill **two levels** higher (capped at
  the skill's max); a final form can't evolve further.
- Evolving a **Kirlia** asks between Gardevoir and Gallade; an **Alolan Vulpix** evolves
  only into Alolan Ninetales.
- **Going back** from a Venusaur opened as is gives an Ivysaur with the main skill one
  level lower; at skill level 1 it stays at 1. A base form (Bulbasaur) or a Pokémon
  that doesn't evolve can't go back.
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
- In **Comparison** and **Team Analysis**, a footer note states whether changes will
  reach the Box (they don't, unless the config came from the Box and is saved from
  it).

## Guidelines

- **One form, agnostic of its caller.** The same form serves any tool that needs a
  Pokémon config (today the Box, Comparison and Team Analysis, potentially more); it
  produces the config and hands it off — **each caller decides what to do with the
  data** (persist it, keep it ephemeral, feed it somewhere else).
- **The catalog rules.** Field options and unlocks come from the domain catalog; the
  form is dependent and never hard-codes per-species data.
- **Validation lives in the domain.** The form mirrors the rules to guide, but the
  backend imposes the truth.
- **Let the user plan ahead.** Not-yet-unlocked slots stay editable (dimmed, not
  disabled), because the value simply activates at the right level.

## Out of scope

- **Deciding persistence.** The form produces a config; whether it is saved (Box) or
  kept ephemeral (Comparison, Team Analysis) is the caller's decision.
- **Suggesting a config.** It does not recommend species, natures, or builds — it
  records what you choose.
