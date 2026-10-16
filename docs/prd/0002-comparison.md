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
   from the [Box](0001-box.md), or a **clone** of a card already present — with
   **suggestions** of the Box Pokémon most comparable to the base, one tap away.
2. **Estimate and show** each card's daily production: help cadence, helps/day,
   inventory and fill time, and three equal-weight blocks — **berries, ingredients,
   and skill** — including the chance of triggering the skill **while asleep**.
3. **Compare with a base and deltas** — the first card is the base; the rest show
   the difference against it. The base can be reordered or changed.
4. **Act on each card** — edit, clone, remove, reorder, and save to the Box.
5. **Set the map scenario** — a map (any of the game's, normal or expert), up to
   three favorite berries and, on an expert map, the weekly bonus — applied to
   every card alike.
6. **Set a comparison level** — an optional target level that raises every card
   below it, so Pokémon at different levels compare on equal footing; each raised
   card shows the candies and dream shards that stretch costs.
7. **Persist by explicit action only** — save a config to the Box (as new, or
   updating the origin Pokémon a card came from).
8. **Share** — the whole comparison as a picture or a link
   ([Sharing a comparison](0020-share-comparison.md)).

## How it works

### Adding cards

- **New** — an ad-hoc configuration built with the [Pokémon
  form](0003-pokemon-form.md). Ephemeral to this comparison; it is not saved
  anywhere until you ask.
- **From screenshots** — the same form, opened pre-filled from game screenshots
  ([Screenshot import](0019-screenshot-import.md)).
- **My Pokémon** — brings a saved config **from the Box** through the searchable
  [Box picker](0004-box-picker.md), which **excludes** members already in the
  comparison. The config is **copied** in.
- **Clone** — duplicates a card already present, **untied** to any Box Pokémon.
  Meant for comparing **variants** of a similar Pokémon (bump the level, swap a sub
  skill or an ingredient, and read the effect).

While there is room (fewer than 5 cards), the ways to add live in an **add card** after
the last card; at 5 cards the add card is not shown.

Entering Comparison from the Box's **Compare** action starts a comparison about that
Pokémon: it becomes the only card (the base), replacing whatever the comparison held.

### Suggestions

Once the comparison holds a card, the add card opens with **up to 3 shortcuts** to Box
Pokémon comparable to the **base**, before the other ways to add. One tap adds that
Pokémon as a card, exactly as if it had been picked in the Box picker. They are only
shortcuts: they add nothing on their own, rank nothing and change no delta.

**Comparable** means the same [role](0022-pokemon-role.md) as the base, of the same
species or not, and the same thing produced:

| Base's role | Comparable Box Pokémon |
|---|---|
| **Berries** | role Berries, **same berry** — so a Charge Strength base brings in the Berries specialists of its berry, and the other way round |
| **Ingredients** | role Ingredients, **same main ingredient** — so an Ingredient Draw base brings in the Ingredients specialists of its main ingredient, and the other way round |
| **Skills** | role Skills, **same main skill**, its variants counting as one (Cooking Power-Up S and Cooking Power-Up S (Minus)) |

- Here a mythical takes the single role its main skill gives it (see the role).
- The **main ingredient** is the one with the highest combined production (normal +
  skill), taken **at level 60** — every ingredient unlocked — for the base and for each
  candidate alike, so a low-level Pokémon is matched by what it will produce, not by a
  slot it hasn't unlocked yet.
- **Order** — strongest first, by the metric that defines the role, at each Pokémon's
  own level: **strength / day** for Berries, its **main ingredient / day** for
  Ingredients, **skill triggers / day** for Skills. Ties go by Pokédex order.
- They **follow the base**: making another card the base changes them; adding one
  recomputes the list, so the next comparable takes its place.
- Box Pokémon **already in the comparison** never appear, the base included when it
  came from the Box.
- Anyone not in the top 3 is still one step away through **My Pokémon**.

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
It sets the **terms** the cards are compared under, shared by the whole comparison,
with Team analysis's own **Map** field and dialog — minus the area bonus and the "No
map" option. It exists so that Pokémon the map treats differently can be read
side by side — e.g. on Cyan Beach (Expert), one whose berry is the main favorite
against one whose berry isn't a favorite at all.

- **Map** — every map in the game, by name: **Greengrass Isle** (the default), the
  normal maps (Cyan Beach, Taupe Hollow, …) and the expert ones (**Greengrass Isle
  (Expert)**, **Cyan Beach (Expert)**). On a normal map the map only decides which
  berries are favorites: where the game sets them (Cyan Beach, Taupe Hollow, …) they
  are shown, not picked; on Greengrass Isle and the expert maps they are chosen below.
- **Favorite berries** — from **none** to **three**, any berry, no repeats. On an
  expert map the berry in **slot 1** is the **main favorite** and the others are
  **sub-favorites**. The three slots keep their places: removing any berry — the main
  or a sub — leaves its slot open (shown as "?" where it was), and the next berry
  chosen fills the first open slot, as in Team analysis. On a normal map there is no
  main: they are all just favorites.
- **Weekly bonus** — only on an expert map: **berries ×2.4** (the default), **+1
  ingredient** per gather, or **skill ×1.25**.

What each card gets depends on its own berry:

| Card's berry | Normal map | Expert map |
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
- **Switching maps works as in Team analysis**: a map whose favorites the game sets
  brings its own; any other starts with none to pick.
- The other map effects — **area bonus** and **Snorlax rating** — stay in Team
  analysis: the area bonus multiplies every card alike, so it moves no delta.

### Comparison level

Comparing Pokémon at different levels is unfair — a level 12 one always loses to a
level 55 one. The **comparison level** is a hypothesis on top of the terms: *"what if
every card were at least at this level?"*, without touching any card's own level.

- **Choices:** **Off** (the default) or one of the unlock levels **10, 25, 30, 50, 60,
  70** — nothing in between; 70 is the highest the leveling data covers.
- **It only raises.** Each card is computed at **the higher of its own level and the
  comparison level**. With the comparison level at 60, a level 45 card is computed at
  60, and a level 62 one stays at 62. It reaches **every card, the base included**, so
  the deltas keep comparing like with like.
- **What the level unlocks counts.** The ingredients (30, 60) and sub skills (10, 25,
  50, 70) the card already has recorded as locked take part in the estimate once its
  computed level reaches them, and the card shows them **unlocked**. An **empty** sub
  skill slot adds nothing: the gain comes from the level alone.
- **A raised card** shows its level as an arrow from its own level to the target —
  **Lv. 45 → 60**. Hovering, focusing or tapping it shows the **candies and dream
  shards** for that stretch, exact, from the [Level-up cost](0021-level-up-cost.md)
  calculation (species category and nature included, species candies only, counted
  from the start of the card's level).
- **A card not raised** — already at the comparison level or above it — shows its
  level as it does today, with no arrow and no cost.
- **The card keeps its own level.** **Save to Box** saves the card's own level,
  **Edit** opens the form on it, and **Clone** copies it; the clone follows the same
  rule as any card, so it is raised too when below the comparison level. Editing a
  card's level re-evaluates it against the comparison level.
- **Ephemeral, like the map terms.** It is part of the comparison, not the account: a
  reload turns it **Off**; moving to another tool and back, or bringing a Pokémon with
  the Box's **Compare**, keeps it; opening a [shared link](0020-share-comparison.md)
  turns it **Off** (the link's cards already come at their target level). It has
  nothing to do with the Box's *minimum target level* in the Player profile and never
  starts from it.

## Calculation assumptions

The per-card estimate comes from the shared [Production model](0008-production-model.md)
— a day of **15.5 h awake + 8.5 h asleep**, and a **cap on the skill while asleep** (1
for non-Skill Pokémon, 2 for Skill specialists). Comparison surfaces that night cap as
a **probability** on each card — P(exactly 1) and P(2) for specialists, P(at least 1)
for the rest.

## Acceptance criteria

- **Empty comparison** → a hint to add a Pokémon, with **"+ New"**, **"+ From
  screenshots"** and **"+ My Pokémon"** buttons, and no suggestions — not an error.
- **Catalog loading** → "Loading catalog…"; **catalog error** → a message with a
  **retry** option.
- **Per-card computing** → "Calculating…"; a **per-card error** (e.g. a species not
  in the catalog) shows on that card and **does not break the others**.
- **Max 5 Pokémon**: at 5, the add card (suggestions and add buttons) is **not shown**,
  and **Clone is disabled**. Removing a card brings it back.
- **Suggestions, Berries:** base a Noivern (Skills, Charge Strength M, Yache); the Box
  holds a Salamence (Berries, Yache), a Dragonite (Ingredients, Yache), a Sceptile (Berry
  Burst, Durin) and a Golem (Ingredients, Charge Strength S (Random)) → only the
  Salamence is suggested.
- **Suggestions, symmetric:** base a Salamence → a Box Noivern is suggested.
- **Suggestions, Ingredients:** base a Crustle whose main ingredient at level 60 is
  Glossy Avocado → Box Ingredients specialists and Ingredient Draw Pokémon whose main
  ingredient at level 60 is Glossy Avocado are suggested; a Plusle (Ingredient Magnet) is
  not.
- **Suggestions, level 60:** a level 20 candidate whose main ingredient at 60 matches the
  base is suggested, even if at 20 it produces more of another ingredient.
- **Suggestions, Skills:** base a Minun (Cooking Power-Up S (Minus)) → Box Pokémon with
  Cooking Power-Up S are suggested; ones with Energy for Everyone S are not.
- **Suggestions, top 3:** with 5 comparable Box Pokémon, the 3 with the highest metric
  for the role show, strongest first; adding one brings in the 4th.
- **Suggestions follow the base:** "Make base" on another card replaces them with that
  card's comparables.
- **Suggestions exclude** Box Pokémon already in the comparison.
- **No suggestions** when signed out, while the Box loads or if it fails to load, or
  when the Box has no comparable Pokémon — the add card shows only its buttons.
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
- **Greengrass Isle, Pikachu's berry (Grepa) as a favorite** → its berry strength **doubles**
  and nothing else moves (a Pikachu at level 60 with no nature or sub skills goes from
  **14,469** to **28,937**); a card whose berry isn't a favorite doesn't move at all.
- **A normal map never penalizes**: with any favorites, a non-favorite card's numbers are
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
- **Cyan Beach** → its favorites are **Oran, Pamtre and Pecha**, set by the game and
  not pickable; a card whose berry is one of them gets the ×2. Switching to
  **Greengrass Isle** clears them, ready to pick.
- The **Map** field shows the map's name, its favorites in their slots and, on an
  expert map, the weekly bonus mark; it opens the same dialog as in Team analysis,
  with **no area bonus** and **no "No map"**.
- The terms apply to **every card, the base included**, so the deltas keep comparing
  like with like.
- The comparison **starts on Greengrass Isle with no favorites** on every visit — reloading
  resets it, and with those terms every card shows its plain production. Moving to
  another tool and back keeps the terms, like the cards.

**Comparison level**

- The control offers exactly **Off, 10, 25, 30, 50, 60, 70**; it starts at **Off**, and
  with it Off every card is computed and shown at its own level, as today.
- **Comparison level 60** with cards at levels **45**, **60** and **62** → they are
  computed at **60**, **60** and **62**; only the first shows **Lv. 45 → 60**, the
  other two show their level with no arrow.
- The raised card's cost: a normal species with a neutral nature, **Lv. 15 → 60** →
  **1,803 candies · 535,149 dream shards**; with an EXP-up nature the figure is lower,
  as in [Level-up cost](0021-level-up-cost.md).
- A level **25** card with three ingredients recorded, comparison level **30** → its
  second ingredient (the slot that unlocks at 30) joins the ingredients per day and shows unlocked; at comparison
  level **Off** it is locked again and out of the estimate.
- A level **40** card with no sub skill recorded for 50, comparison level **50** →
  computed at 50 with no added sub skill.
- Changing the comparison level recomputes **every metric and every delta**; when the
  base is raised, the deltas are read against the raised base.
- **Save to Box** on a level 45 card with the comparison level at 60 → the Box Pokémon
  stays (or is created) at **45**. **Edit** opens the form at **45**. **Clone** → a
  card at level 45, shown **Lv. 45 → 60**.
- A reload → the comparison level is **Off**. Moving to Team analysis and back, or
  using the Box's **Compare** → it stays as it was. Opening a shared link → **Off**.

## Guidelines

- **Comparing is the goal.** Everything is arranged to put configurations in
  parallel and read the differences at a glance.
- **Max 5 Pokémon** — the team size in the game. Comparing more has no product
  meaning and breaks parallel reading.
- **Ephemeral by default, persistent by explicit action.** Configs are local to the
  session; they only touch the Box when the user saves. The session survives moving
  to another tool and back (the cards and the map terms are still there); only a
  reload starts it over.
- **Copy without coupling.** "My Pokémon" and "Clone" **copy** the config; editing a
  copy never affects its origin unless the user explicitly saves onto that origin.
- **No false hierarchy.** Berries, ingredients, and skill are shown with **equal
  weight**; none is "the main thing".
- **One set of terms for the whole comparison**, never per card — and the map
  controls are **secondary**: they set the terms, the cards remain the tool.
- **The same rules as Team analysis.** Favorites, the main favorite and the expert
  effects behave exactly as on the map there; Comparison only lets you set them
  without building a team.
- **A hypothesis never overwrites the record.** The comparison level changes what a
  card is computed at, never the card's own level: what is saved, edited or cloned is
  always the real config.
- **The computation lives in the domain.** The card only **presents** the shared
  [Production model](0008-production-model.md); it may **derive** values (e.g.
  P(exactly 1) = P(≥1) − P(≥2)) but does not reimplement the formula or invent numbers.

## Out of scope

- **Optimization**: Comparison does not suggest the "best" config; it only estimates
  and compares. The suggestions pick **rivals** to compare against, never a winner.
- **Suggesting Pokémon outside the Box**, or more than 3: the rest are chosen through
  **My Pokémon**.
- **Being the team record** — that's the [Box](0001-box.md). Comparison touches the
  Box only by explicit save.
- **The area bonus and the Snorlax rating** belong to [Team
  analysis](0007-map-bonuses-rating.md): they move no delta.
- **Lowering a card's level** or a **target level per card** — the comparison level
  only raises, and applies to every card alike.
- **Levels above 70**, Candy Boost and owned candies — the cost is the base one, as
  in [Level-up cost](0021-level-up-cost.md).
- **Restricting Cyan Beach (Expert)'s main favorite** to Oran, Pamtre or Pecha — as in
  Team analysis, any berry can be chosen.
