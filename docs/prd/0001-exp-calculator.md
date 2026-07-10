# Exp Calculator

> Product document. It defines why this feature exists and the guidelines it must
> respect as it evolves. The "how it looks" lives in
> [`docs/design-system.md`](../design-system.md).

## Purpose

**Exp Calculator** answers a single question: *"to take this Pokémon from one
level to another, how many **candies** and how many **dream shards** do I need?"*

It is a **resource-planning** tool: it never touches the Box or the team, it only
computes the cost of leveling up so you can decide where to invest. It answers
*"can I reach level X? how much more do I need to save up?"*

## What it does (scope)

You enter two values and read one result.

- **Current level** and **desired level** of the Pokémon.
  - With **quick access to the key levels**, the same way the Pokémon Form does:
    jump to the levels where the game unlocks something (ingredients at 30 / 60,
    sub skills at 10 / 25 / 50 / 70 / 80) and to the relevant caps (e.g. the
    current maximum).
- **Growth curve** (optional): the species' experience curve —**normal**,
  **pseudo-legendary**, **legendary**, or **mythical**— as a set of mutually
  exclusive buttons. **Normal** is selected by default (see
  [Experience curves](#1-experience-curves-4-types)).
- **Nature that affects experience** (optional): two mutually exclusive buttons
  —**EXP ⬆** and **EXP ⬇**— to indicate whether the Pokémon has a nature that
  **helps** or **hurts** leveling. Neither is selected by default (neutral nature).
- **Boost mode** (optional): **normal**, **Candy Boost**, or **Mini Candy Boost**
  (see [Boost mechanics](#boost-mechanics)).

The **result** is expressed as two numbers:

- **Candies needed** to cover the span's experience.
- **Dream shards needed** to spend those candies.

## How it works

The calculation has three pieces: **the span's experience** (depends on the
curve), **how many candies** cover that experience (depends on nature and boost),
and **how many shards** those candies cost (depends on level and boost). The
numbers are computed in the domain, candy by candy — the frontend only presents
the two totals.

### 1. Experience curves (4 types)

The total experience a Pokémon needs per level **depends on its species**. There
are **four curves**, all proportional to the **normal** curve through a
multiplier. The user selects the curve as an optional modifier (default normal);
the calculator applies it:

| Curve | Multiplier | Examples |
| --- | --- | --- |
| **Normal** | **×1.0** | Most species |
| **Pseudo-legendary** | **×1.5** | Larvitar→Tyranitar, Dratini→Dragonite lines |
| **Legendary** | **×1.8** | Raikou (and equivalent legendaries) |
| **Mythical** | **×2.2** | Celebi (and equivalent mythicals) |

The experience to go from a level to the next is:

```
exp_to_next(L, curve) = round( exp_base(L) × mult(curve) )
```

where `exp_base(L)` is the **normal-curve** table (e.g. level 1 → 54, level 10 →
345, level 50 → 1362 EXP; it grows with level) and `mult(curve)` is the
multiplier from the table above. The span's **total** experience for
`[current → desired]` is the sum of `exp_to_next(L, curve)` for every level `L`
from `current` up to `desired − 1`.

### 2. Candies: experience per candy

Each candy grants a **base amount of EXP that depends on the Pokémon's level**,
adjusted by **nature**:

- **Base per level** (neutral nature):
  - level **1–24** → **40 EXP**/candy
  - level **25–29** → **35 EXP**/candy
  - level **30+** → **25 EXP**/candy
- **Nature**: **EXP ⬆ ≈ ×1.2** · **EXP ⬇ ≈ ×0.84** · neutral ×1.0.
- **Boost** (Candy / Mini Candy): **×2** on the EXP per candy.

Candies are spent **one at a time**. Each candy contributes its EXP toward the
current level; when a candy pushes past the level's requirement, the **leftover
EXP carries into the next level** rather than being wasted. So the count is *not*
a per-level `ceil` — the overflow of one level reduces the candies the next level
needs.

### 3. Dream shards

Each candy costs **dream shards**, and that cost **grows with the Pokémon's
level** (from ~14 shards per candy at low levels to several hundred near the
current cap). The span's total shard cost is the sum of each spent candy's cost
at the level where it was spent, multiplied by the **boost factor** where the
boost applies.

### Boost mechanics

| Mode | EXP per candy | Dream-shard cost | Candy cap |
| --- | --- | --- | --- |
| **Normal** | ×1 | ×1 | — |
| **Candy Boost** | **×2** | **×5** | — |
| **Mini Candy Boost** | **×2** | **×4** | **350 candies** |

Both boosts grant **double the experience per candy**; the surcharge is in the
**dream shards**. **Mini Candy Boost** is cheaper (×4 vs ×5) but is **capped at
350 boosted candies**: if the span needs more, the calculator applies the boost
to the first 350 candies and charges the remainder at **normal** cost.

## Acceptance criteria

- **Minimal span (happy path).** `current 1 → desired 2`, normal curve, neutral
  nature, no boost → **54 total EXP, 2 candies, 28 dream shards**.
- **Candy Boost.** Same `1 → 2` span with **Candy Boost** → **1 candy, 70 dream
  shards** (double EXP per candy needs fewer candies; each costs 5× the shards).
- **Mini Candy Boost.** Same `1 → 2` span with **Mini Candy Boost** → **1 candy,
  56 dream shards** — cheaper than Candy Boost (×4 vs ×5) for the same candies.
- **Nature reduces candies.** For a given span, **EXP ⬆** never needs more candies
  than neutral, and **EXP ⬇** never needs fewer.
- **Curve scales cost.** A **pseudo-legendary** Pokémon over the same span needs
  strictly more experience (×1.5 per level) and therefore at least as many candies
  as a normal-curve one.
- **Carry, not per-level rounding.** Leftover candy EXP carries forward: the total
  candy count for a multi-level span is at most the sum of the naive per-level
  `ceil`, and can be lower when a level's overflow covers the start of the next.
- **Mini boost cap.** If a span needs more than **350** candies, only the first
  350 receive the ×2 EXP / ×4 shard treatment; the remaining candies are charged
  at normal EXP and shard rates.
- **Instant recompute.** Changing any input (levels, nature, boost) recomputes the
  two totals immediately; nothing is saved.
- **Invalid range — desired ≤ current.** The tool shows a clear message that the
  desired level must be greater than the current level, and produces no cost.
- **Out-of-range levels.** A current level below **1** or a desired level above
  **55** (the maximum levelable level) is rejected with a clear out-of-range
  message, not a silent zero.
- **Empty state.** With no levels entered yet, the result area shows a neutral
  empty state (a prompt to enter the levels), not an error and not `0 / 0`.

## Guidelines

- **Two inputs, two outputs.** The tool is defined by its simplicity: current
  level + desired level → candies + shards. Everything else (nature, boost) is an
  **optional modifier**, never a required step.
- **Shortcuts guide.** Quick access to key levels reuses the same criterion as the
  Pokémon Form: the levels that matter in the game, not an arbitrary scale.
- **The curve is a modifier, not a species lookup.** The calculator is
  standalone and does not select a species, so the user picks the curve (normal /
  pseudo / legendary / mythical) as an optional modifier, defaulting to normal.
  The four multipliers are fixed game values; the calculator only **applies** the
  chosen one.
- **The calculation lives in the domain.** The frontend **presents** candies and
  shards; the candy-by-candy simulation, the EXP tables, and the boost factors
  belong to the backend. The UI never reimplements the formula or invents numbers.
- **Nothing persists.** It is an ephemeral calculator: it neither reads nor writes
  the Box, and keeps no history. Changing the inputs recomputes instantly.

## Out of scope

- **It does not optimize.** It does not suggest the "best" level to reach or when
  to use a boost; it only computes the cost of the goal the user sets.
- **It does not model resource gathering.** It does not estimate how many days of
  sleep it takes to collect the candies or shards (that is a different tool); it
  assumes the resources are already available or will be obtained.
- **It does not cover evolution.** The cost to **evolve** (evolution candies) is a
  separate mechanic; this tool is only about **leveling up**.
