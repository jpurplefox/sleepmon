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
5. **Set the map scenario** — a map (normal or one of the two expert maps), up to
   three favorite berries and, on an expert map, the weekly bonus — applied to
   every card alike.
6. **Persist by explicit action only** — save a config to the Box (as new, or
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
- Cards can be **reordered** with the ‹ › controls, which swap a card with its
  neighbour. There is no drag and drop: it never worked on touch.

### Per-card actions

- **Edit** — opens the Pokémon form on that card's config (editing the local copy).
- **Clone** — duplicates the card, untied to the Box.
- **Remove** — drops the card from the comparison.
- **Make base** / **reorder** — as above.
- **Save to Box** — with no origin, creates a **new** Box Pokémon; if the card came
  from the Box, **updates that origin** Pokémon. Shows inline "Saving… / Saved"
  feedback.

### Map scenario

Comparison doesn't rate a map — that's [Team analysis](0007-map-bonuses-rating.md).
It sets the **terms** the cards are compared under, with three controls shared by the
whole comparison. It exists so that Pokémon the map treats differently can be read
side by side — e.g. on Cyan Beach (Expert), one whose berry is the main favorite
against one whose berry isn't a favorite at all.

- **Map** — **Normal** (the default), **Greengrass Isle (Expert)** or **Cyan Beach
  (Expert)**. Normal stands for any non-expert map: there the map only decides which
  berries are favorites, and that is chosen below.
- **Favorite berries** — from **none** to **three**, any berry, no repeats. On an
  expert map the berry in **slot 1** is the **main favorite** and the others are
  **sub-favorites**. The three slots keep their places: removing any berry — the main
  or a sub — leaves its slot open (shown as "?" where it was), and the next berry
  chosen fills the first open slot, as in Team analysis. On Normal there is no main:
  they are all just favorites.
- **Weekly bonus** — only on an expert map: **berries ×2.4** (the default), **+1
  ingredient** per gather, or **skill ×1.25**.

What each card gets depends on its own berry:

| Card's berry | Normal | Expert map |
| --- | --- | --- |
| **Main favorite** | — | Helps **faster** (map's figure), **Main Skill +1 level**, and the weekly bonus |
| **Favorite / sub-favorite** | Berry strength **×2** | The weekly bonus (×2.4 replaces the ×2, doesn't stack; with the other two bonuses the ×2 stays) |
| **Not a favorite** | Nothing | Helps **slower** (map's figure), no weekly bonus |

The speed figures are each expert map's own (see [Map
bonuses](0007-map-bonuses-rating.md)): main favorite **−10%** / **−20%** help
interval and non-favorites **+15%** / **+35%** on Greengrass Isle (Expert) / Cyan
Beach (Expert).

- The terms reach **every card, the base included**, so the deltas keep comparing
  like with like, and each affected metric carries the same **mark** the team's cards
  use (`×2`, `×2.4`, `+1`, `×1.25`, `Skill +1`, and each map's cadence figures).
- **Switching maps keeps the favorites**, slots and all. Going back to Normal turns the
  main into one more favorite; going to an expert map makes slot 1 the main again (or
  leaves the main open, if slot 1 is).
- The other map effects — **area bonus** and **Snorlax rating** — stay in Team
  analysis: the area bonus multiplies every card alike, so it moves no delta.

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
- **Normal, Pikachu's berry (Grepa) as a favorite** → its berry strength **doubles**
  and nothing else moves (a Pikachu at level 60 with no nature or sub skills goes from
  **14,469** to **28,937**); a card whose berry isn't a favorite doesn't move at all.
- **Normal never penalizes**: with any favorites, a non-favorite card's numbers are
  identical to having no favorites.
- **Cyan Beach (Expert)**, Quagsire's berry as the **main favorite**, weekly bonus
  **×2.4**, Amoonguss alongside → Quagsire helps at **×0.8** of its interval, its Main
  Skill acts **one level higher** and its berries yield **×2.4**; Amoonguss helps at
  **×1.35** and gets no bonus. Switching the map to **Greengrass Isle (Expert)** moves
  them to **×0.9** and **×1.15**, everything else equal.
- On an expert map, a card whose berry is a **sub-favorite** gets the weekly bonus but
  **neither** the main's speed nor its Skill +1.
- Each **weekly bonus** moves its own metric on every favorite card and marks it:
  strength goes to **×2.4** (not ×4.8); **+1 ingredient** raises the ingredients per
  day *and* fills the inventory sooner; **skill ×1.25** raises the triggers per day
  *and* the chance of the skill firing while asleep.
- **Expert map with no favorites** → **every** card takes the map's penalty and none
  gets a weekly bonus — not an error.
- At **three** favorites no more can be added until one is removed; a berry already
  chosen can't be chosen again.
- The **weekly bonus** control shows **only on an expert map**.
- **Switching maps keeps the favorites**: Normal → expert makes the first one the main;
  expert → Normal drops every expert effect and leaves the ×2.
- The terms apply to **every card, the base included**, so the deltas keep comparing
  like with like.
- The comparison **starts on Normal with no favorites** on every visit — reloading
  resets it, and with those terms every card shows its plain production.

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
- **One set of terms for the whole comparison**, never per card — and the map
  controls are **secondary**: they set the terms, the cards remain the tool.
- **The same rules as Team analysis.** Favorites, the main favorite and the expert
  effects behave exactly as on the map there; Comparison only lets you set them
  without building a team.
- **The computation lives in the domain.** The card only **presents** the shared
  [Production model](0008-production-model.md); it may **derive** values (e.g.
  P(exactly 1) = P(≥1) − P(≥2)) but does not reimplement the formula or invent numbers.

## Out of scope

- **Optimization**: Comparison does not suggest the "best" config; it only estimates
  and compares.
- **Being the team record** — that's the [Box](0001-box.md). Comparison touches the
  Box only by explicit save.
- **The full map list** — normal maps with fixed favorites, the area bonus and the
  Snorlax rating belong to [Team analysis](0007-map-bonuses-rating.md). Comparison
  offers only what changes a delta: Normal and the two expert maps.
- **Restricting Cyan Beach (Expert)'s main favorite** to Oran, Pamtre or Pecha — as in
  Team analysis, any berry can be chosen.
