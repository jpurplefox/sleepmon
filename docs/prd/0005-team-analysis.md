# Team Analysis

## Purpose

**Team Analysis** answers *"how much does my whole team produce in a day (and a
week), and how strong is it?"*. You assemble a team of up to 5 slots — each Pokémon
**created on the spot** or **copied from your Box** — and the tool **aggregates** each
member's estimated production into team totals — berries, skills, ingredients, and
their combined strength — plus a **grand total**.

It's where you read the team **as a unit**, not one Pokémon at a time (that's the
[Box](0001-box.md)) or side by side (that's [Comparison](0002-comparison.md)).

The team is the tool's own: a list of **configurations** it holds, not a selection of
saved Pokémon. The Box is an optional **source** to copy from and an optional
**destination** to save to. Because assembling and reading a team is purely ephemeral
computation, the tool asks for **no account**; only the two actions that touch the Box
— **My Pokémon** and **Save to Box** — ask for a session (see
[Authentication](0010-authentication.md)).

Two companion read-outs live on the same page and share its inputs: the [Cooking
plan](0006-cooking-plan.md) and [Map bonuses & Snorlax
rating](0007-map-bonuses-rating.md). **This document covers the core aggregate, the
roster (building and editing the Pokémon in it, including split slots), and the Good
Camp Ticket.**

## What it does (scope)

1. **Assemble a team** — up to 5 slots; each Pokémon is either **new** (built on the
   spot) or **copied from the Box**. A slot can be **split** between two Pokémon.
2. **Edit any Pokémon in the team, in place** — the team's copy changes, the Box does
   not.
3. **Save a team Pokémon to the Box** — explicitly, as new or updating the one it came
   from.
4. **Aggregate production** — berries (by type: amount + strength), skill effects,
   ingredients, and total strength.
5. **Show the grand total** — **daily and weekly (×7)**, combining berries + skills +
   cooking.
6. **Good Camp Ticket** — a global toggle that boosts the team.
7. **Refuse what it can't compute** — a species outside the curated catalog is turned
   away when you try to bring it in.

## How it works

### Assembling the team (roster)

Up to **5 slots**. Each Pokémon enters in one of two ways, the same pair Comparison
offers:

- **New** — an ad-hoc configuration built with the [Pokémon
  form](0003-pokemon-form.md), the same form the Box and Comparison use. It is
  saved nowhere until you ask.
- **My Pokémon** — a configuration **copied** from the Box through the [Box
  picker](0004-box-picker.md). Copied, not linked: the team holds its own copy, so the
  Box entry is unaffected by what you do here.
- **Either way fills either half** — a new slot, or the second half of a **split**
  slot.
- The roster is **ephemeral** (session state): neither the composition nor the
  Pokémon created in it survive a reload. What deserves to last is saved to the Box.
- **Split slots** — a slot can hold **two** Pokémon with a weight split (default
  50/50, e.g. 60/40), modeling a slot that **rotates** during the week. Each
  Pokémon's production is **scaled linearly** by its weight before aggregating. A
  normal (single) slot is a 100% split — identical numbers to no split. With every
  slot split, up to 10 Pokémon.
- **Duplicates are allowed.** Two identical configurations are two Pokémon and both
  contribute; the same Box Pokémon can be copied in twice. Splitting a slot never
  depends on having spare Pokémon in the Box — the second one can be created on the
  spot.

### Editing a Pokémon in the team

Any Pokémon in the team reopens in the same [Pokémon form](0003-pokemon-form.md) with
its current configuration. Confirming changes **only the team's copy** and recomputes
the totals; the Box Pokémon it was copied from is untouched. This is how you try
things: raise a level, swap a sub skill, and read the team react.

### Saving to the Box

Each Pokémon in the team can be sent to the Box **explicitly**: one copied from the
Box **updates** that entry, one created here is **created** as new — and from then on
that slot saves over it. Nothing goes back to the Box without that action.

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

### Species outside the curated catalog

The form only offers species from the curated catalog, so a Pokémon created here can
always be computed. A Box Pokémon whose species is **outside** the catalog is
**refused when you try to bring it in**, with a message naming the species — the tool
says so where the decision is made, instead of leaving a silent hole in the team.

## Acceptance criteria

- With **no members**, the tool shows an empty state (nothing to aggregate), not an
  error.
- Adding a Pokémon — **new** or **from the Box** — updates the team totals; the
  roster holds **at most 5 slots**, and at 5 the option to add disappears.
- **Without an account**: the whole tool is usable — assemble, edit, aggregate,
  cooking plan, map rating — and **no** sign-in prompt ever appears. Tapping **My
  Pokémon** or **Save to Box** is the only thing that asks for a session, through the
  contextual prompt, and completing it returns to what was being done.
- **Editing** a team Pokémon from level 30 to 50 recomputes the team totals; the Box
  Pokémon it was copied from is **unchanged**.
- **Save to Box** on a Pokémon copied from the Box **updates** that entry; on one
  created here it **creates** a new entry, and the slot then saves over it.
- Two Pokémon with the **same configuration** in the team are both accepted and both
  contribute — no duplicate error.
- **Splitting** a slot works with an **empty Box and no account** (the second Pokémon
  created on the spot).
- A split slot with weights **60/40** contributes each Pokémon's daily production
  scaled by **0.60 / 0.40**; a single slot (100%) contributes the **same as if
  unsplit** (no regression).
- Weights within a slot always **sum to 100%**; moving one side moves the other.
- **Removing** the active Pokémon from a split slot collapses it to the remaining one
  at **100%**.
- Bringing in a Box Pokémon whose species is **outside the curated catalog** is
  **refused** with a message naming the species; it is not added, and no slot is left
  blank.
- The **grand total** is shown both **daily and weekly (×7)**.
- Turning on the **Good Camp Ticket** applies all three effects: help interval
  **×0.8** (more helps/day → more berries, ingredients, skill triggers), inventory
  **×1.2**, and pot **+50%** per meal.
- The roster is **ephemeral**: reloading restores neither the composition nor the
  Pokémon created in it; whatever was saved to the Box is intact.

## Guidelines

- **The team as a unit.** Team Analysis reads the team as a whole; per-Pokémon detail
  is the Box, side-by-side is Comparison.
- **The computation lives in the domain.** The tool presents aggregated production; it
  does not reinvent the per-Pokémon [Production model](0008-production-model.md) (the
  same one the Box and Comparison use).
- **The computation never asks for an account.** A session buys access to the Box —
  reading it and writing it — and nothing else.
- **The team holds configurations, not identities.** Every Pokémon in it is an
  independent copy; nothing in the team changes because the Box changed.
- **One way to create, one way to pick.** The [Pokémon form](0003-pokemon-form.md) and
  the [Box picker](0004-box-picker.md); this tool never grows a second way to assemble
  a Pokémon.
- **Nothing returns to the Box without an explicit action.**
- **Ephemeral by default.** The roster, map, bonus, ticket, and meals are session
  inputs; the tool persists nothing on its own.
- **Modifiers annotate, they don't replace.** Splits, the camp ticket, and map
  bonuses shape the aggregate; the underlying per-member production is unchanged.
- **No false hierarchy.** Berries, skills, and cooking feed one total; none is "the
  KPI" beyond the grand total itself.

## Out of scope

- **Cloning a Pokémon within the team** — comparing variants of one configuration is
  [Comparison](0002-comparison.md)'s move, not this tool's.
- **Persisting a team** — the roster is ephemeral; neither the browser nor a shareable
  link remembers it, and there is no notion of a **saved team**.
- **The meal-planning and map/rating read-outs** — those are [Cooking
  plan](0006-cooking-plan.md) and [Map bonuses & Snorlax
  rating](0007-map-bonuses-rating.md), which share this tool's inputs.
