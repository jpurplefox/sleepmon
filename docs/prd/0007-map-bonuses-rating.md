# Map bonuses & Snorlax rating

Part of [Team Analysis](0005-team-analysis.md).

## Purpose

This answers *"how does the map I play on change my team's output, and what research
rating do I reach there?"*. Choosing a **map** applies its **favorite-berry bonus**
and its **area bonus** to the team's strength, and shows the **Snorlax research
rating** the team achieves on that map.

A **map** is a research area — Greengrass Isle, Cyan Beach, Taupe Hollow, Snowdrop
Tundra, Lapis Lakeside, Old Gold Power Plant, Amber Canyon — plus the two **expert**
areas, Greengrass Isle (Expert) and Cyan Beach (Expert).

Maps come in two classes. A **normal** map is a modifier and a read-out: it changes
what the team's output is worth, never how each member produces. An **expert** map
also rewrites the team's rules — which berry a Pokémon gathers now decides how fast
it helps and which bonus it carries.

## What it does (scope)

1. **Select a map** (or none), normal or expert.
2. **Favorite berries** — the map's favorite berries get a strength bonus; on
   Greengrass Isle and on both expert maps you choose them.
3. **Area bonus** — a percentage boost to all strength.
4. **Snorlax rating** — the research rating the team reaches on the selected map,
   from its weekly strength.
5. **Expert effects** — on an expert map the favorites split into a **main favorite**
   and two **sub-favorites**, which reshape each member's production.
6. **Weekly bonus** — on an expert map, which of the three weekly bonuses is active.

## How it works

### Map & favorite berries

- Pick a map; each map has **favorite berries**. Matching berries get a **×2
  strength** bonus.
- Favorite berries are **at most three**. Most maps have **fixed** favorites
  (e.g. Cyan Beach: Oran, Pamtre, Pecha); **Greengrass Isle** and both **expert**
  maps let you **pick your own**.
- With **no map**, no favorite-berry bonus applies.

### Area bonus

- An **area bonus** from **0% to 85%**, adjustable, multiplies **all** strength
  (berries, skills, cooking, fillers).
- The bonus belongs to the **area**: each map carries its own, saved in [Player
  progress](0011-player-progress.md) and loaded when that map is selected. With **no
  map** selected there is no area, and so **no area bonus** — the same way no
  favorite-berry bonus applies.
- Strength values show their **base** and **base + bonus** so the effect is legible
  (e.g. on hover).
- Expert maps carry their own bonus, separate from the normal one, but it behaves
  identically here: a percentage the user sets.

### Snorlax rating

- Given a selected map, the tool shows the **research rating** the team reaches on it
  — the tiers **Basic**, **Great**, **Ultra** (1–5 each) and **Master** (1–20), i.e.
  **35 ratings** per map, measured on **weekly** strength (daily × 7).
- It shows the current **tier and level** and the **progress to the next** rating.
- With **no map** selected, the rating is **not shown** (there's nothing to rate
  against).

### Expert maps

**The favorites split in two.** On an expert map you choose all three favorites. The
**first** you pick is the **main favorite**; the other two are **sub-favorites**.
Removing the main favorite leaves its slot vacant and keeps the sub-favorites; the
next berry you pick fills it.

**Four effects, active from the moment you select the map** — whatever you have
chosen so far:

| Who it reaches | Effect |
| --- | --- |
| Gathers the **main favorite** | Helps **10% faster** (help interval ×0.9), and its **Main Skill acts one level higher** |
| Gathers **any** of the three favorites | The **active weekly bonus** |
| Gathers **none** of them | Helps **15% slower** (help interval ×1.15) |

**The weekly bonus.** Exactly one of three is always active, and you pick which:

- **Berry strength ×2.4** — favorite berries yield 2.4× their base strength *instead
  of* ×2. It replaces the doubling; it does not stack on it.
- **+1 ingredient** — each ingredient find brings one extra, whatever the member's
  specialty.
- **Main Skill trigger ×1.25** — the member's skill fires 25% more often.

Berry strength ×2.4 is the default.

**How the effects combine.**

- The help-interval changes **cascade** the way the Good Camp Ticket's do — more helps
  a day means more berries, more ingredients and more skill triggers — and they
  **multiply** with it: with the ticket on, a main-favorite member helps at
  **×0.8 × 0.9** of its base interval.
- The **+1 Main Skill level** stops at each skill's own maximum; a member already
  there gains nothing from it.
- With **no favorites chosen**, every member gathers none of them: the whole team
  takes the **−15%** penalty and nobody receives the weekly bonus.

## Acceptance criteria

- Selecting a map applies its favorite-berry **×2** to matching berries and enables
  its **area bonus** and **rating**.
- Favorite berries are capped at **three**; on **Greengrass Isle** and both **expert**
  maps the user chooses them, on other maps they are **fixed** by the map.
- The **area bonus** accepts **0–85%** and multiplies **all** strength; strength
  readouts expose **base vs base + bonus**. Switching maps switches to that map's
  own saved bonus.
- With **no map**, no favorite-berry bonus applies, **no area bonus** applies, and
  the Snorlax rating is **hidden**.
- The **Snorlax rating** is computed on **weekly** strength (daily × 7) against the
  map's 35 thresholds, and shows the tier, level, and **progress to the next**.
- Raising the **area bonus** raises the grand total and can raise the Snorlax rating
  accordingly.
- On **Cyan Beach (Expert)**, a team at **2,194,292** weekly strength reads
  **Master 1**; at **2,194,291** it reads **Ultra 5**.
- On an expert map the **first** favorite chosen is shown as the **main favorite** and
  the other two as sub-favorites; removing the main keeps the sub-favorites and the
  next berry chosen becomes the new main.
- A member gathering the **main favorite** helps **10% faster** than the same member
  on a normal map with the same favorites (help interval ×0.9), and its Main Skill
  acts **one level higher**.
- A member already at its skill's **maximum level** gains no level from the main
  favorite: its skill output is unchanged.
- With the **×2.4** weekly bonus, a favorite berry yields **2.4×** its base strength —
  not 4.8×.
- With the **+1 ingredient** weekly bonus, every member gathering any of the three
  favorites brings one extra ingredient per find, **whatever its specialty**.
- With the **×1.25** weekly bonus, those same members trigger their Main Skill **25%
  more often**.
- A member gathering **none** of the three favorites helps **15% slower** (help
  interval ×1.15) and receives **no** weekly bonus.
- With **no favorites chosen** on an expert map, **every** member takes the −15%
  penalty and none receives a weekly bonus.
- With the **Good Camp Ticket** on, the interval effects combine: a main-favorite
  member helps at **×0.8 × 0.9** of its base interval.
- Switching from an expert map to a **normal** one drops all four expert effects;
  favorites and the area bonus behave as documented for normal maps.

## Guidelines

- **On a normal map, a modifier plus a read-out.** The map bonuses **shape** the
  aggregate; the rating **reads** it back. Neither changes per-member production.
- **Expert maps are the exception, and the only one.** They are the single place where
  the chosen map reaches into per-member production. Everywhere else the invariant
  above holds.
- **An expert map is a map, not a mode.** Choosing the area is the only switch; there
  is no separate toggle that could contradict it.
- **The rating is per map.** There is no map-agnostic rating; it only makes sense
  against a selected map.
- **Published data only.** Where the game does not publish a number, the tool leaves
  the effect out rather than estimating it.
- **The computation lives in the domain.** Favorite berries, the ×2, the area bonus,
  the expert effects, and the rating thresholds come from the domain catalog; this
  presents them.

## Out of scope

- **The +2 ingredients for Ingredients specialists** — the game gives them a *chance*
  at +2, but does not publish the probability; modeling it would mean inventing the
  number. Every member gets **+1**.
- **The Expert Ticket economy and the unlock requirements** (Master 18 on both
  Greengrass Isle and Cyan Beach) — the tool does not track your progress.
- **Expert-exclusive rewards** — shiny and special Pokémon encounter rates, expert
  missions, research EXP, Dream Shards and candy.
- **Expert bonus carry-over** — that surplus expert bonus does not transfer to the
  regular area bonus. Here the bonus is an input, not something that accumulates.
- **Rolling the weekly bonus or the favorites** — you choose them.
- **Recommending a map or the best favorite berries** — it applies what you choose.
- **The core aggregate and cooking** — [Team Analysis](0005-team-analysis.md) and
  [Cooking plan](0006-cooking-plan.md).
