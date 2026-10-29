# Meal coverage

> Product document. The visual language lives in
> [`docs/design-system.md`](../design-system.md). Built on the
> [Production model](0008-production-model.md) and the
> [Sleep schedule](0015-sleep-schedule.md).

## Purpose

Cooking Power-Up S is played **per meal**, not per day: a recipe needs its procs before
*that* meal, and 3 procs in a day are worth little if 2 of them landed before the same
one. Procs/day doesn't answer the question players actually have: *"will this Pokémon
cover every meal?"*

Meal coverage answers it with three numbers per Pokémon: how often it covers **all 3
meals of a day**, how often it gets you through a **perfect week**, and how often a week
costs you **at most one meal**. It also tells a player
whether a Pokémon with fewer procs (say, a Mismagius) is reliable enough to replace a
stronger one (say, a Magnezone) in weeks that need just 1 proc per meal.

## What it does (scope)

1. **Who gets it** — Skill specialists whose main skill is **Cooking Power-Up S** or a
   variant: Magnemite, Magneton, Magnezone, Flareon, Glaceon, Misdreavus, Mismagius and
   Minun. Nobody else shows it.
2. **1 proc per meal** — always shown for those Pokémon: the share of days with all 3
   meals covered, the chance of a perfect week, and the chance of missing at most one
   meal in the week.
3. **2 procs per meal** — the same three numbers, shown only when more than **75%** of days
   are covered with 2 procs per meal.
4. **Everywhere a card is** — the production card's Skill block in Comparison and Team
   Analysis, reading the same for the same Pokémon.

## How it works

### The day it assumes

A fixed way of playing, built around **banking procs**:

- **Meals** are planned at **7:00, 12:00 and 18:00**. A meal that doesn't have its procs
  yet **waits** for them until its window closes: breakfast at **12:00**, lunch at
  **18:00**, dinner at **bedtime** (or 4:00, the game's cut-off, if bedtime is later). If
  the procs still haven't come, the meal is cooked without them and counts as **missed**.
- **Waking up** is at **7:00**. **Bedtime** comes from the night length in the player's
  [sleep schedule](0015-sleep-schedule.md): with the default 8:30, bedtime is 22:30. The
  nap doesn't affect this metric.
- **Hunting**: while the current meal still needs procs, the player collects **every 2
  hours** while awake (7:00, 9:00, 11:00…), plus at each meal and at bedtime. Collecting
  often picks procs up one at a time.
- **Banking**: once the pot has the procs the next meal needs, the player **stops
  collecting**. At the meal they **cook first, then collect**, so whatever the Pokémon
  stored goes to the following meal.
- **Asleep**: no collecting; at most **2 procs** per night (the Skill specialists' cap).
- **Inventory**: when the inventory fills, the Pokémon stops rolling for its skill until
  it is collected. The inventory carries over into the night if the player stopped
  collecting to bank.

### What it reads from the Pokémon

Only two things, both already on the card: its **skill chance per help** (the effective
one, with the pity proc averaged in) together with its **helps per day**, and how long
its **inventory takes to fill**. The skill's level doesn't matter: the metric counts
procs, not how much each one adds to the pot.

### The numbers

- **Days with all 3 meals** — the share of days where breakfast, lunch and dinner all
  got their procs.
- **Perfect week** — the chance that all **18 meals** from Monday to Saturday got their
  procs. Sundays are left out: pot expansions are free on Sundays.
- **At most one miss** — the chance that **no more than one** of those 18 meals went
  without its procs: a week that went fine, if not perfectly.

Misses come in bunches (a missed meal leaves nothing banked for the next one), so the
perfect week is more likely than six independent good days would suggest. That is why
each number is simulated on its own; none is worked out from another.

All three are estimates from simulating many days of this routine, shown as whole
percentages.

## Acceptance criteria

- **Who:** a Magnezone, Flareon, Glaceon, Mismagius, Magnemite, Magneton, Misdreavus or
  Minun shows meal coverage; a Salamence, Luxray or Meowscarada (Cooking Power-Up S, not
  Skill specialists) shows none; a Pokémon with any other main skill shows none.
- **1 proc, reference point:** with Night 8:30, a Pokémon with **5.4** helps/day × skill
  chance and an inventory that fills in **10 h** reads **90%** of days and **57%**
  perfect weeks (±1.5 points each).
- **2 procs shown:** with Night 8:30, **8.3** helps/day × skill chance and a **10 h**
  inventory read **80%** of days with 2 procs per meal, so the 2-proc row shows, with
  **34%** perfect weeks (±1.5 points each).
- **At most one miss, reference point:** with Night 8:30, **5.0** helps/day × skill
  chance and a **10 h** inventory read about **89%** of days, **48%** perfect weeks and
  **74%** weeks with at most one miss, with 1 proc per meal (±1.5 points each).
- **2 procs hidden:** with Night 8:30, **7.0** helps/day × skill chance and a **10 h**
  inventory cover about **62%** of days with 2 procs per meal: the 2-proc row doesn't
  show. Exactly **75%** doesn't show it either; it needs more than 75%.
- **Monotonic:** with everything else equal, a higher skill chance or a
  longer-lasting inventory never lowers any of the three numbers.
- **Skill level:** changing only the main skill's level leaves all three numbers unchanged.
- **Sleep schedule:** changing the night length in the profile changes the numbers;
  turning the nap on or off doesn't.
- **Same everywhere:** the same Pokémon under the same conditions reads the same numbers
  in Comparison and Team Analysis.
- **Perfect week ≤ days:** the perfect-week number is never above the days number.
- **Perfect week ≤ at most one miss:** the perfect-week number is never above the
  at-most-one-miss number.

## Guidelines

- **It reads what the card reads.** Skill chance, helps per day and fill time come from
  the [Production model](0008-production-model.md); when those change (an event bonus, a
  map, a ribbon), meal coverage follows.
- **One routine, stated plainly.** The assumed day (meal times, 2-hour collecting,
  banking) is fixed, not a setting; if it changes, it changes for every card at once.
- **Counts procs, not pot slots.** Whether a proc is enough for a recipe is the player's
  call; this metric only says whether the procs arrive in time.

## Out of scope

- The Box: its rows don't show the production card's Skill block.
- Configurable meal times or collecting frequency.
- Modeling the nap.
- Non-Skill specialists with Cooking Power-Up S.
- What a proc adds to the pot, or which recipe it unlocks.
- Recommending recipes, pot upgrades or builds.
- The pity proc as an exact mechanic (it is averaged into the skill chance).
