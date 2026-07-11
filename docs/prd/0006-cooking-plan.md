# Cooking plan

Part of [Team Analysis](0005-team-analysis.md).

## Purpose

The **Cooking plan** answers *"can my team cook the meals I plan, and how much
strength does cooking add?"*. You pick up to three daily meals; the tool checks the
ingredients your team **produces** against what the recipes **require**, fills the
pot with the surplus, and reports the **cooking strength** that rolls into the
team's grand total.

It answers: *"with what my team produces, how good is this meal plan?"*.

## What it does (scope)

1. **Plan up to three daily meals** — each a recipe at a level, optionally filtered
   by dish type.
2. **Check ingredient balance** — required vs produced, flagging shortages.
3. **Fill the pot** — allocate surplus (and random skill ingredients) as **fillers**
   up to pot capacity.
4. **Report cooking strength** — recipes + fillers, with the **Extra Tasty**
   multiplier, into the grand total.

## How it works

### The meal plan

- **Three meal slots** — breakfast, lunch, dinner. Each is a recipe at a chosen
  level, or empty.
- An optional **dish-type filter** (Curry / Salad / Dessert) narrows the recipe
  choices; it does **not** restrict by map.
- A **pot size** (base capacity) is a user input.

### Ingredient balance

- For each meal, the recipe's required ingredients are compared against what the
  team **produces**.
- If the team can't cover a recipe, the **shortage** is shown — which ingredient,
  and how much is missing.

### Pot capacity & fillers

- Each meal's pot capacity is the base pot, **expanded** by skills and the **Good
  Camp Ticket**, minus what the recipes use.
- The remaining room is filled with **fillers**: the surplus ingredients the team
  produced (plus random ingredients from skills), allocated **by strength** until the
  pot is full.

### Cooking strength

- **Cooking strength = recipes + fillers**, times the **Extra Tasty** multiplier
  (below).
- It is shown **daily and weekly** and rolls into Team Analysis's **grand total**.
  The map's **area bonus** applies to cooking strength like any other.

### How Extra Tasty is modeled

**Extra Tasty** is a *critical cook*: when a meal crits, its cooking strength is
multiplied — **×2** on weekday meals and **×3** on the Sunday meal. The tool doesn't
gamble a single result; it estimates the **expected multiplier over a full week** and
applies that.

The crit chance is **not fixed — it builds up**:

- Each meal starts from a **base chance**: **10%** on weekdays (capped at **80%**),
  **30%** on Sunday (capped at **100%**).
- Every time a team member's **Tasty Chance S** skill procs, it adds percentage
  points to a **shared team stack** that raises the **next** cook's crit chance. The
  amount per proc grows with the skill's level (**+4 pp** at level 1 up to **+10 pp**
  at level 6), and the stack is capped at **+70 pp**.
- When a meal **does** crit, the stack **resets to 0**; when it doesn't, the built-up
  chance carries to the next meal.

To turn that into one number, the tool models the **21 meals of the week** (3 per day
× 7) as a chain and tracks, meal by meal, **how likely each stack level is** —
building on a miss, resetting to 0 on a crit — then averages the resulting per-meal
multiplier. The output is an **expected crit rate** and an **expected multiplier**
(≥ 1.0); the multiplier is what scales cooking strength.

The build-up is treated as **random, not flatly averaged**. A member's daily Tasty
Chance S procs are spread across the day's 3 meals, so any single meal gets **on
average** `procs/day ÷ 3` of them — but the *actual* count varies, and it's modeled
as a **Poisson distribution** (the standard model for independent events arriving at
random around a known average). Each member's proc distribution is combined into the
percentage points a meal's stack might gain (capped at +70 pp). Keeping the whole
distribution — instead of just the average — matters because the crit chance is
**capped** (80% / 100%) and **resets** on a crit: a flat average would misstate how
often the stack actually reaches the high-chance states. With no Tasty Chance S on
the team, the multiplier settles around **~1.17×** (≈ 12.9% crit).

## Acceptance criteria

- With **no meals** planned, cooking contributes **nothing** to the grand total
  (empty, not an error).
- A recipe whose ingredients the team **can't cover** shows a **shortage** (the
  missing ingredient and amount), and the meal is flagged as not fully feasible.
- Filling **never exceeds** pot capacity; fillers are drawn from **surplus + random
  skill ingredients**, ordered **by strength**.
- Turning on the **Good Camp Ticket** increases per-meal pot room (more fillers fit).
- The **dish-type filter** narrows recipe options but does **not** depend on the
  selected map.
- **Cooking strength** includes the **Extra Tasty** multiplier and is shown daily and
  weekly.
- The **Extra Tasty** multiplier reflects the weekly model: ×2 weekday / ×3 Sunday
  crits, a chance that **builds up** with Tasty Chance S procs and **resets on a
  crit**; with no Tasty Chance S it settles around **~1.17×**.
- The **map's area bonus** applies to cooking strength.

## Guidelines

- **A read-out over the team's production.** Cooking **consumes** what the team
  produces; it doesn't change per-member production.
- **Recipes and fillers are one cooking total.** Shown with equal weight, summed with
  the Extra Tasty multiplier.
- **The computation lives in the domain.** Feasibility, fillers, and Extra Tasty are
  computed by the domain; the plan presents them.

## Out of scope

- **Suggesting the best meals** — it evaluates the plan you choose, it doesn't
  optimize it.
- **Map-specific recipe rules** — the dish-type filter is independent of the
  selected map.
- **The team production aggregate itself** — that's [Team
  Analysis](0005-team-analysis.md).
