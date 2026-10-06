# Production model

## Purpose

The **production model** is the shared estimate that every tool presents: how much a
Pokémon produces in a day, and how strong it is. The [Box](0001-box.md) shows it per
Pokémon, [Comparison](0002-comparison.md) side by side, and [Team
Analysis](0005-team-analysis.md) aggregated. It defines what *berries/day*,
*strength*, *helps/day*, and *skill triggers* **mean** and how they're derived.

It is a **shared building block**, computed **once** in the domain; the tools present
it — none reinvents it.

It answers: *"how are a Pokémon's daily numbers estimated?"*.

## What it does (scope)

1. **Help cadence** and helps/day.
2. **Inventory** and fill time.
3. **Berries** — amount and strength.
4. **Ingredients** — per slot.
5. **Skill** — triggers, night-sleep probabilities, and effects.
6. **Total strength.**

## How it works

### The day: awake + asleep

A day is **15.5 h awake + 8.5 h asleep**.

- **Awake** — you tend the Pokémon (empty its inventory), so it never fills; every
  help yields berries, ingredients, or a skill trigger.
- **Asleep** — you don't tend it; the inventory **fills and can overflow**. Until it
  fills, helps yield normally; once **full**, every remaining help yields **berries
  only** (no ingredients, no skill).

### Help cadence

- **Seconds per help** starts from the species' base interval and is **shortened** by:
  level (−0.2% per level above 1), **Helping Speed** sub skills, a helping **nature**,
  a **higher ribbon** (500 h+), the **Good Camp Ticket** (×0.8), and an always-on
  **energy bonus** (~2.22×, standing in for a well-rested Pokémon).
- **helps/day** = 86,400 s ÷ seconds-per-help, spread across the full day; those helps
  are then split into the awake and asleep phases.

The [Event bonus](0012-event-bonus.md) can add per-help ingredients and berries, raise
skill trigger and level, scale skill ingredients, and add to the carry limit.

### Inventory & overflow

- **Capacity** = the species' carry limit (which grows with the Pokémon's **evolution
  stage**) + **Inventory Up** sub skills + the ribbon's bonus, then **×1.2** with the
  Good Camp Ticket.
- **Fill time** = how long into the night before capacity is reached; after that,
  overflow (berries only). If it never fills, fill time is the full **8.5 h**.

### Berries

- **Per help**: **1** berry normally, **2** for a **Berry specialist**, **+1** with
  **Berry Finding S**.
- **Strength per berry at a level** = `round(max(base + (level − 1), base ×
  1.025^(level − 1)))` — linear at low levels, exponential (×1.025 per level) at high
  levels. Each berry has its own base. A **favorite** berry (see [Map
  bonuses](0007-map-bonuses-rating.md)) **doubles** it (×2).
- **berries/day** = berry-yielding helps × berries-per-help; **berry strength/day** =
  that × the per-berry strength.

### Ingredients

- Each help yields **either** ingredients **or** berries. The **ingredient chance** is
  the species' base percentage, raised by **Ingredient Finder** sub skills and an
  ingredient **nature**.
- **Slots** unlock at **Lv 1 / 30 / 60**; the ingredient-yielding helps split across
  the unlocked slots, and each slot's chosen ingredient has its own per-help amount →
  per-slot daily totals.

### Skill

- **Trigger chance** = the species' base percentage, raised by **Skill Trigger** sub
  skills and a skill **nature**, then adjusted by a **pity** mechanic that guarantees a
  trigger within a bounded number of helps (**78** for non-specialists; scaled by help
  frequency for Skill specialists).
- **skill triggers/day** = daytime triggers (uncapped) + nighttime triggers, which are
  **capped**: **1** for non-Skill Pokémon, **2** for Skill specialists. The night
  activations are modeled as random arrivals (Poisson) and reported as
  **probabilities** — P(exactly 1), and P(2) for specialists.
- **Skill effects** depend on the main skill and its level, and are `triggers/day ×
  per-trigger amount`: extra **strength** (Charge Strength), **energy** (to the team,
  to self, or to a random teammate), **ingredients** (Draw / Magnet), **dream shards**,
  **cooking pot** slots, **Tasty Chance** (feeds [Extra Tasty](0006-cooking-plan.md)),
  or a **help multiplier**. **Berry Burst** yields **berries** — its own and its
  teammates' — and counts as berry strength (see [Berry Burst](0013-berry-burst.md)).
  The exact per-level amounts live in the domain catalog.
- **Variants use their own numbers.** A variant shares its base skill's mechanic but
  not necessarily its amounts: **Lunar Blessing**, **Nuzzle**, and **Present** have
  smaller tables, and **Heal Pulse** gives its own amount to **two** teammates.
  **Super Luck** and **Hyper Cutter** draw from a fixed selection of ingredients, not
  the species'; random outcomes count at their expected value — Super Luck sometimes
  gets **dream shards** instead of ingredients, Hyper Cutter sometimes gets **twice**
  the ingredients. Second effects that need more modeling (Lunar Blessing's berries,
  Heal Pulse's extra helps, Nuzzle's skill bonus, Present's candy) aren't counted yet.
- **Skills with two effects count both** when both are modeled: **Aura Sphere**
  (Lucario) gets dream shards *and* strength; **Cooking Assist S (Bulk Up)**
  (Heracross) gets random ingredients *and* raises the Extra Tasty rate, accumulated
  like Tasty Chance. **Stockpile** (Drifloon, Drifblim) stores triggers and spits them
  out later; it counts its **average strength per trigger**. **Psystrike** (Mewtwo)
  counts only its strength — its Berry Zone boost isn't modeled yet.

### Total strength

- **Total strength = berry strength + skill strength.** Only berries (Berry Burst's
  included) and strength-producing skills (e.g. Charge Strength) count; ingredients, energy, and
  shards do **not** add strength. In Team Analysis, the map's **area bonus** and
  **favorite ×2** apply on top, and **cooking** adds its own strength.

## Acceptance criteria

- A higher **level** shortens the help interval (−0.2% per level) → **more helps/day**.
- **Berry strength** follows `round(max(base + level − 1, base × 1.025^(level − 1)))`;
  a favorite berry **doubles** it.
- A **Berry specialist** yields **2** berries/help (others **1**); **Berry Finding S**
  adds **+1**.
- **Ingredient slots** unlock at **Lv 1 / 30 / 60**; below the unlock a slot does not
  produce (though it can be pre-set — see the [Pokémon form](0003-pokemon-form.md)).
- At **night**, once inventory **fills**, further helps yield **berries only** (no
  ingredients, no skill).
- **Night skill activations** are capped — **1** for non-Skill, **2** for Skill
  specialists — and shown as **probabilities**.
- The **Good Camp Ticket** shortens the help interval (**×0.8**) and enlarges inventory
  (**×1.2**).
- **Total strength** counts **berries + strength skills only**; ingredients / energy /
  shards do not add strength.
- The **same inputs** produce the **same numbers** in the Box, Comparison, and Team
  Analysis (one model, presented by each).

## Guidelines

- **One model, many presenters.** Computed once in the domain; the Box, Comparison, and
  Team Analysis **present** it — none recomputes.
- **Estimate, not simulation.** It is an **expected-value** model (averages and
  probabilities), not a tick-by-tick simulation of a real day.
- **Faithful to the game.** Constants and formulas mirror the game's mechanics;
  changing them is a **domain decision** (an ADR), not a presentation tweak.

## Out of scope

- **How each tool presents the numbers** — that's the Box, Comparison, and Team
  Analysis.
- **Cooking strength & Extra Tasty** — a team-level read-out ([Cooking
  plan](0006-cooking-plan.md)), built on the ingredients this model produces.
- **The exact per-skill amount tables** — those live in the domain catalog.
