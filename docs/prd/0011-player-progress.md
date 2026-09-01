# Player progress

## Purpose

**Player progress** answers *"what do I actually have in the game?"*, kept apart from
*"what if?"*. The pot you have expanded, the recipes you have levelled, the area bonus
you have unlocked on each map — these are facts about your account that change slowly
and only ever move forward.

You declare them **once**, on your account, and every [Team
Analysis](0005-team-analysis.md) starts from them.

It is the counterpart to the [Box](0001-box.md): the Box records **which Pokémon** you
own, Player progress records **everything else** about your account's standing —
kitchen and areas.

## What it does (scope)

1. **Pot size** — which step of the game's pot ladder you have reached.
2. **Recipe levels** — the level of each recipe you have cooked up.
3. **Favorite recipe per dish type** — one Curry, one Salad, one Dessert.
4. **Area bonus per area** — the bonus you have unlocked on each research area.
5. **Seeds Team Analysis** — the analysis starts from these values; what you change
   there stays in the session and offers to be saved back.

## How it works

### Where it lives

Player progress is its own screen, reached from the **profile menu** — it belongs to
*you*, not to any one tool. Like the Box and Team Analysis, it is available only when
signed in.

It is a **draft**: what you change there is yours to review until you press **Guardar**,
which writes it and closes the screen. Nothing is written as you type — a screen that
saved silently would give you no moment where you confirmed anything, which is the
opposite of the guideline below. Leaving with unsaved changes asks first (see *Leaving
with changes*).

### Pot size

- The pot does not take arbitrary values: it climbs a **fixed ladder** of 23 steps —
  **21, 23, 25, 27, 29, 31, 33**, then **+3** all the way to **81**.
- You **pick a step**; a value off the ladder (22, 40) cannot be entered.
- Untouched, it reads **21**, the game's base pot.
- Skill expansions and the **Good Camp Ticket** still apply on top of this inside the
  analysis. They are not progress: one depends on the team you assembled, the other on
  a ticket you may or may not be running today.

### Recipe levels

- The **full recipe list**, each with its level from **1 to 70**, searchable by name
  and filterable by dish type — the same way the meal picker presents recipes, so the
  two read alike.
- Every recipe starts at **1**. You only touch the ones you have actually levelled.

### Favorite recipe per dish type

- You may mark **one favorite recipe per type**: one Curry, one Salad, one Dessert.
  Each is optional and independent — having a favorite curry does not require having a
  favorite dessert.
- Its purpose is the meal plan: choosing a dish type in the analysis — which happens
  alongside the map, before the plan — fills the day's three meals with that type's
  favorite (see below).

### Area bonus per area

- Each of the nine research areas — the seven normal maps plus the two **expert**
  ones — carries **its own** bonus, from **0% to 85%**.
- Expert areas are separate entries with separate bonuses, matching the game and what
  [Map bonuses & Snorlax rating](0007-map-bonuses-rating.md) already says about expert
  maps carrying their own bonus.
- Untouched, every area reads **0%**.

### The bridge to Team Analysis

Player progress is the analysis's **starting point**, never its master copy:

- The analysis **opens** with your pot size already set.
- Selecting a **map** loads that area's saved bonus.
- Selecting a **dish type** fills the three meal slots with that type's favorite
  recipe, at its saved level — but **only when the plan is empty**. It never
  overwrites a meal you chose.
- Every recipe added to the plan enters at its **saved level**.

What you change inside the analysis belongs to **that session**. A value that differs
from what you saved is marked **unsaved** and offers to be **saved into your progress**;
the saved value itself is one hover or keyboard focus away, not printed beside every
control — at nine areas and seventy recipes, repeating it would be noise. Saving is
always explicit: your progress is never updated on your behalf, and an unsaved change
disappears on reload.

### Leaving with changes

Both screens that hold unsaved values ask before letting them go, and the question is
the same shape in each — **guardar**, **salir sin guardar**, **cancelar** — but it means
different things, because the two screens hold different kinds of "unsaved":

- **Player progress** holds a draft of your progress. Leaving without saving **discards**
  it; nothing about your account changes.
- **Team Analysis** holds session values you are analysing with. Leaving without saving
  **keeps** them for the session — the analysis on screen is unaffected — and only
  declines to write them into your progress. The question exists so a real change you
  meant to keep does not quietly disappear on the next reload.

The question is asked however you leave: the close button, Escape, or a click outside.

## Acceptance criteria

- A **new account** reads: pot **21**, every recipe at level **1**, no favorites, every
  area at **0%**. This is an ordinary starting state, not an empty state or an error.
- The pot control offers **exactly** the 23 ladder steps (21, 23, 25, 27, 29, 31, 33,
  36, …, 81). A value off the ladder cannot be selected.
- A recipe level outside **1–70** and an area bonus outside **0–85%** are **clamped to
  the nearest limit**, not rejected with an error.
- Given saved progress with pot **33** and Cyan Beach at **40%**: opening Team
  Analysis shows pot **33**, and selecting **Cyan Beach** moves the area bonus to
  **40%**. Selecting **Lapis Lakeside** then shows Lapis Lakeside's own saved bonus.
- With **no map** selected, **no area bonus applies** — strength shows its base value,
  the same way no favorite-berry bonus applies with no map.
- Given a favorite Curry saved as **Beanburger Curry at level 55** and an **empty**
  meal plan: choosing dish type **Curry** fills breakfast, lunch and dinner with
  Beanburger Curry at level **55**.
- Choosing a dish type with **at least one meal already planned** changes **nothing**
  in the plan — neither the prefill nor the dish type itself removes a meal you chose.
- Choosing a dish type with **no favorite saved** for it leaves the three meals
  **empty** — no error, no fallback pick.
- Changing a value in the analysis so it **differs** from what you saved marks it
  **unsaved**, and the saved value is readable **on hover or keyboard focus**;
  **saving** it makes your progress read the new value, and the mark disappears.
- A value changed **back** to what you saved is **not** marked unsaved and offers
  nothing to save.
- An unsaved change is **gone** after a reload; a saved one is present on **another
  device**, signed into the same account.
- Editing anything in Player progress writes **nothing** until **Guardar** is pressed;
  Guardar writes every pending change at once and closes the screen.
- Leaving Player progress with changes — by the close button, Escape, or a click outside
  — asks **guardar / salir sin guardar / cancelar**. *Salir sin guardar* discards the
  draft; *cancelar* returns to the screen with the draft intact.
- Leaving Player progress with **nothing** changed closes it immediately, with no question.
- Leaving Team Analysis's settings with values marked unsaved asks the same three
  ways out, and *salir sin guardar* **keeps** those values in the session — only the
  write to your progress is declined.

## Guidelines

- **Progress is what only moves forward.** A setting belongs here when it records
  something you unlocked or levelled in the game, not something you are trying out. If
  it changes week to week or depends on the team you assembled, it stays ephemeral.
- **Progress is never written implicitly.** Every save is an act the user takes.
  The cost of that choice is a record that can fall behind, which is why an unsaved
  value is always **marked** where it happens rather than left to be discovered.
- **One value, one home.** A progress value is edited in Player progress, or overridden
  for a session in the analysis — but Player progress stays the single answer to "what
  do I have".
- **Game data stays honest.** The pot ladder and the recipe level cap are the game's,
  not ours; when the game changes them, the ladder changes with it.

## Out of scope

- **Good Camp Ticket, favorite berries per map, and the expert weekly bonus** — these
  stay ephemeral per session. The ticket is a subscription you may pause, the weekly
  bonus rotates, and favorite berries are part of reading a map, not of progress.
- **Comparison** — it compares Pokémon under a map scenario and uses none of these
  values.
- **Suggesting or optimizing** — it records the favorite you name; it does not pick one
  for you.
- **Importing, exporting, or resetting your progress** — no bulk operations, no factory
  reset.
- **Which Pokémon you own** — that's the [Box](0001-box.md).
