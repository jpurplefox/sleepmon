# Box picker

## Purpose

When you bring a saved Pokémon from your Box into another tool, you have to be able
to **find it** and **recognize which one it is** at a glance — even with a full Box,
or several copies of the same species with different configs. This is the shared
**"My Pokémon"** modal.

Today the [Comparison](0002-comparison.md) tool and the team-building tool open it,
and more callers could. Like the [Pokémon form](0003-pokemon-form.md), it is a
**shared building block**, agnostic of its caller.

It answers: *"from my Box, which one do I want?"*.

## What it does (scope)

1. **Search by species name.**
2. **Identify each copy by its config alone** — enough to tell duplicates apart
   without opening them.
3. **Pick** — hand the chosen Pokémon back to the caller (copying its config), and
   let the caller do the rest.
4. **Mark what's already chosen** so it can't be picked twice.

## How it works

### Search

- A field at the **top**, **auto-focused** when the modal opens, filtering **live**
  by species name, **case- and accent-insensitive** (e.g. "ralts" matches "Ralts",
  "pikachú" matches "Pikachu").
- When nothing matches, a **clear empty-search message** naming the query (not a
  blank list). The number of matches is announced for assistive tech.

### Item identity (config-derived)

Each item shows only what **derives from the Pokémon's own config**, enough to
distinguish duplicates without opening them: sprite, species name with the **ribbon
beside it**, level, **nature as stat icons** (↑ raises / ↓ lowers, not stat-name
text), ingredients, sub skills (with their tier), and the main skill level. A
neutral or unset nature is communicated clearly. **No production numbers** —
recognize, don't recalculate.

### Already-chosen marking

Members the caller passes in as already chosen are **marked** and **disabled** —
they cannot be picked twice.

### Keyboard

From the search field: **Enter** picks the **highlighted** result (or the first
selectable one when none is highlighted); **↑/↓** move the highlight between results
**without leaving the field** (you can keep typing); the active highlight is
visible; changing the search resets the highlight.

### Pick and dismiss

- Picking (click or Enter) **hands the chosen Pokémon to the caller**, which
  **copies** its config (not coupling) and closes the modal. The picker itself does
  not add or persist anything — the caller does.
- The modal dismisses with **Escape**, a **backdrop click**, or the **close
  control**, making no changes.

## Acceptance criteria

- Search filters **live** by species name, **case- and accent-insensitive** (e.g.
  "ralts" matches "Ralts", "pikachú" matches "Pikachu").
- The **search field is focused** when the modal opens.
- A search with **no matches** shows a clear message naming the query, not a blank
  list.
- Two members of the **same species with different configs** are visually
  distinguishable from their item alone (level, nature, ingredients, sub skills,
  skill level).
- **Nature** is shown as **stat icons** (↑/↓), not stat-name text; a neutral/unset
  nature is communicated clearly.
- The **ribbon**, if any, appears **next to the species name**.
- A member **already chosen** (passed in as already-in) is **marked** and **cannot
  be picked again**.
- **Enter** picks the highlighted result, or the first selectable one when none is
  highlighted; **↑/↓** move the highlight **without leaving** the search field.
- Picking **hands the member to the caller** and does not itself add or persist
  anything; the config is **copied**, so later edits don't affect the origin.
- **No production/performance numbers** are shown in the picker.
- The modal can be **dismissed** with Escape, backdrop, or the close control, with
  **no changes**.
- While the Box **loads** → a loading state; on **load error** → a message with a
  **retry**; an **empty Box** → a clear empty message.

## Guidelines

- **Identity from config only.** No nicknames or new fields; what distinguishes a
  Pokémon is its configuration, which already exists.
- **Recognize, not recalculate.** The picker helps you *choose*; production is
  estimated only once the Pokémon enters the tool. No performance numbers here.
- **Agnostic of its caller.** The picker returns a chosen Pokémon; opening/closing
  the modal, adding it, and deciding what to do with it belong to the caller (today
  Comparison and the team-building tool, potentially more).
- **Same representation everywhere.** A copy reads the same wherever it appears
  (Box, picker, comparison); there is no second way to represent it.
- **Dense but legible.** It may show many copies; favor fast parallel scanning over
  exhaustive detail.

## Out of scope

- **Nicknames** or any data that doesn't derive from the config.
- **Sorting or filtering** by anything other than the name (e.g. by ingredient or
  tier).
- **Changing already-added items or estimating production** — that belongs to the
  calling tool.
