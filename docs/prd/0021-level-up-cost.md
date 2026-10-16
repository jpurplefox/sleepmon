# Level-up cost

> Product document. The visual language lives in
> [`docs/design-system.md`](../design-system.md).

## Purpose

The **level-up cost** answers *"what does it take to level this Pokémon to the next
thing that matters, and what does it get me?"*, right where the Pokémon lives: in the
[Box](0001-box.md).

Levels are not earned by playing; they are bought with **candies**, and every candy
costs **dream shards**. Deciding which Pokémon to level next means knowing, for each
one, the price of its next unlock and what that unlock changes. Without it, the Box
shows what each Pokémon produces today but not what investing in it would buy.

It replaces the standalone candy/EXP calculator once proposed (PRs #46, #48, #57): the
same calculation, but read off the Pokémon you actually own, with no inputs to fill.

## What it does (scope)

1. **A target level per Box entry** — the next unlock level, or the account's
   **minimum target level** when the Pokémon is still below it.
2. **The cost to reach it** — candies and dream shards from the current level to the
   target, with no configuration.
3. **What the target buys** — at a glance, the gain in the metric that defines the
   Pokémon; on demand, every unlock in the span and the entry's production now vs. at the
   target, with the delta.
4. **A minimum target level** — an optional setting in the [Player
   profile](0011-player-profile.md).

## How it works

### The target level

The **unlock levels** are **10, 25, 30, 50, 60 and 70**: a sub skill unlocks at 10, 25,
50 and 70; an ingredient at 30 and 60.

- **No minimum set** (the default): the target is the **first unlock level above** the
  Pokémon's current level. Level 15 → 25; level 25 → 30; level 9 → 10.
- **A minimum set** (one of 10, 25, 30, 50, 60, 70): if the Pokémon is **below** it, the
  target is the minimum; otherwise, the first unlock level above its current level.
  With a minimum of 60, a level 15 Pokémon targets **60**, and one already at 60
  targets **70**.
- **At level 70 or above** there is no target and the entry shows no cost: 70 is the
  last level the cost tables cover.

The entry shows the span — **current level → target level** — and its cost. What each
unlock level brings is already visible in the entry's build (locked slots are shown,
dimmed); the comparison lists it in full.

Figures from 10,000 up read **abbreviated** in the entry (535K, 1.14M shards) so the row
stays compact; below that they read exact, since "1.23K" takes the room of "1,227". The
comparison opens with the **exact** figures.

### How many candies

A Pokémon needs a fixed amount of **EXP** to go from each level to the next, tabulated
level by level up to 70 (54 EXP at level 1, 579 at level 23, 3,255 at level 69). The
species' **category** scales that amount, rounded to the nearest whole number at each
level:

| Category | Multiplier |
| --- | --- |
| Normal | ×1.0 |
| Pseudo-legendary | ×1.5 |
| Legendary | ×1.8 |
| Mythical | ×2.2 |

Each candy gives EXP according to the **level where it is spent**, adjusted by the
**nature**:

| Level | EXP per candy (neutral) |
| --- | --- |
| 1–24 | 40 |
| 25–29 | 35 |
| 30+ | 25 |

A nature that **speeds up EXP** gives ×1.2 per candy, one that **slows it down** ×0.84
(rounded to the nearest whole number). The category does not change what a candy gives;
it changes what a level asks for.

Candies are spent **one at a time**, and the **EXP left over** when a candy completes a
level **carries into the next one**. So the count is not rounded up level by level: a
level 23 Pokémon (579 EXP to go) takes 15 candies (600 EXP) and starts level 24 with 21
EXP already in.

### How many dream shards

Each candy costs **dream shards** at the price of the **level where it is spent** — from
14 at level 1 to 1,272 at level 69, tabulated level by level. Neither the category nor
the nature changes the price; they only change how many candies land on each level. The
total is the sum of every candy at its level's price.

### Where the count starts

The Box records the level, not the EXP already earned within it, so the count starts
at the **beginning of the current level**. A Pokémon partway through a level needs a
little less than shown: the figure always suffices, never falls short.

### What the target buys

**At a glance**, beside the span, one gain: the metric that defines the Pokémon, from now
to the target. The Pokémon's **role** decides it — the same rule Box coverage uses, so a
Skills specialist that is really a berry or ingredient Pokémon reads as one:

- **Strength / day** — a Berries specialist, or a Skills specialist whose main skill adds strength or
  berries (Charge Strength, Berry Burst). An "All" specialist (Darkrai, Mew) reads here too.
- **Its main ingredient / day** — an Ingredients specialist, or a Skills specialist whose main skill yields
  ingredients. The main ingredient is the one it produces most at the target, skill
  included. When the span **unlocks an ingredient**, the gain is that **new** ingredient
  and its amount instead: a new slot splits the existing ones, so the main ingredient's own
  figure usually falls even as the Pokémon gains.
- **Skill triggers / day** — every other Skills specialist.

**On demand** (hover, keyboard focus or a tap on the span), the comparison opens. It first
lists **every unlock the span crosses**, in level order — each sub skill (or *not recorded*,
for an empty slot) and each ingredient — then compares its **production now** with its
**production at the target level** — the same Pokémon, same config, only the level
raised — in the same order as the entry's production:

- **Helps / day** — now › at target, and the delta.
- **Strength / day** — the single total the entry reports (berries + skill), not split.
- **Ingredients / day** — one row per ingredient (skill ingredients combined, as the
  entry does), now › at target, and the delta. An ingredient the target unlocks reads
  **—** now and is marked **new**.
- **Skill triggers / day** — now › at target, and the delta.

Because the Box stores every slot — all three ingredients and the sub skills for every
unlock level — the comparison counts what the target unlocks: the ingredient at 30/60,
the sub skill at 10/25/50/70. If the sub skill slot the target unlocks is **empty** in
the config, it says so (*not recorded*) and the gain comes from the level alone.
The same holds when the span crosses several unlocks: the rows add them all up.

The estimate is the shared [Production model](0008-production-model.md), under the same
terms as the entry's own production (sleep schedule included).

### The minimum target level

An optional value on the account, in the Player profile's **Leveling** tab: **None**
(the default) or one of **10, 25, 30, 50, 60, 70** — the unlock levels, nothing in
between. It applies to every Box entry; changing it changes every entry's target.

## Acceptance criteria

All costs below are for species candies, with no boost.

- **Verified against the game:** normal, neutral nature, **23 → 24** → **15 candies ·
  1,320 shards**.
- **Base case:** normal, neutral, **1 → 10** → **39 candies · 1,384 shards**.
- **Next unlock:** a normal, neutral level **15** Pokémon with no minimum targets **25**
  (sub skill) → **129 candies · 9,987 shards**.
- **Nature:** the same 15 → 25 with an EXP-up nature → **107 · 8,273**; EXP-down →
  **151 · 11,680**.
- **Category:** neutral, 15 → 25 → pseudo-legendary **193 · 14,935**; legendary
  **231 · 17,879**; mythical **283 · 21,913**.
- **Ingredient unlock:** normal, neutral, level **25** → targets **30** (ingredient) →
  **95 · 10,054**.
- **Minimum target:** with the minimum at **60**, a normal, neutral level **15** Pokémon
  targets **60** → **1,803 · 535,149**; one at level **60** targets **70** →
  **1,227 · 1,141,655**.
- **Last span:** normal, neutral, **69 → 70** → **131 · 166,632**.
- **Abbreviated cost:** 1,227 candies and 1,141,655 shards read **1,227 · 1.14M** in the
  entry; the comparison shows **1,227 · 1,141,655**. Below 10,000 a figure reads exact.
- **Level 70 or above** → the entry shows **no cost** and no comparison, not an error.
- **No minimum set** (a new account) → every entry targets its next unlock level.
- **Span:** the entry reads its current and target level, e.g. **Lv. 15 → 25**.
- **Gain by role:** a Berries specialist shows its strength gain; a Skills specialist with
  Charge Strength shows its strength gain too; a Skills specialist with Energy for Everyone
  shows its skill-trigger gain; an Ingredients specialist shows its main ingredient's gain.
- **Gain on an ingredient unlock:** an Ingredients specialist at level 25 targeting 30 shows
  the ingredient that unlocks at 30 with its amount at 30 — not a fall in its main
  ingredient. The phone section and the comparison call it **new**; the desktop row keeps
  just the ingredient's icon and **+amount** to stay compact.
- **Abbreviated strength gain:** a strength gain of 12,300 reads **▲12.3K** in the entry;
  one of 2,048 reads **▲2,048**.
- **Several unlocks:** with the minimum at **60**, a level 15 Pokémon's comparison lists the
  unlocks at **25, 30, 50 and 60**, in that order, and its rows add up all of them.
- **Comparison:** a level 25 Pokémon with three recorded ingredients targets 30; its
  comparison lists the third ingredient as **—** now, with its amount at 30, marked
  **new**.
- **Empty slot:** a level 40 Pokémon with only three sub skills recorded targets 50; its
  comparison notes the 50 sub skill as *not recorded*, and the deltas reflect the level
  alone.
- **Metric order** in the comparison: helps, strength, ingredients, skill.
- **Minimum control:** offers exactly **None, 10, 25, 30, 50, 60, 70**; a value off that
  list cannot be selected.
- **Empty Box** → the Box's existing empty state, unchanged.

## Guidelines

- **The calculation lives in the domain**, like every number in the app. The Box
  presents it; it does not reimplement it.
- **Conservative.** The candy count always suffices: it starts at the beginning of the
  level and rounds up where it must.
- **Each modifier in its place.** The category raises what a level asks for, the nature
  changes what a candy gives, and the shard price depends only on the level where the
  candy is spent. None leaks into another's ground.
- **The cap is the data's, not the design's.** 70 is where the verified tables stop;
  if they are extended, values are added and the mechanics do not change.
- **No configuration to read it.** The cost shows on every entry by default; the
  minimum only reshapes the target.
- **One computation, many readers.** The same cost is meant to be reused by other tools
  (e.g. a target level in Comparison) without a second formula.

## Out of scope

- **Candy Boost / Mini Candy Boost, EXP events, and Handy Candy** — base cost with
  species candies only.
- **Sorting or filtering the Box by cost.**
- **Levels above 70**, including the sub skill that unlocks at 80.
- **EXP already earned within a level** — the Box does not record it.
- **The inverse question** (*"I have N candies, how far do they take me?"*) and the
  candies or shards you own.
- **Recommending which Pokémon to level** — it shows cost and gain, not the decision.
- **A target level in Comparison** — tracked separately (#136); it reuses this
  calculation.
