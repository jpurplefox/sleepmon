# Map bonuses & Snorlax rating

Part of [Team Analysis](0005-team-analysis.md).

## Purpose

This answers *"how does the map I play on change my team's output, and what research
rating do I reach there?"*. Choosing a **map** applies its **favorite-berry bonus**
and its **area bonus** to the team's strength, and shows the **Snorlax research
rating** the team achieves on that map.

A **map** is a research area — Greengrass Isle, Cyan Beach, Taupe Hollow, Snowdrop
Tundra, Lapis Lakeside, Old Gold Power Plant, Amber Canyon. Only Greengrass is
literally an *island*; the rest are beaches, tundras, a power plant, a canyon — so
the tool speaks of **maps**, not islands.

It answers: *"given where I play, how much stronger is my team, and what rating do I
hit?"*.

## What it does (scope)

1. **Select a map** (or none).
2. **Favorite berries** — the map's favorite berries get a strength bonus; on
   Greengrass Isle you choose them.
3. **Area bonus** — a percentage boost to all strength.
4. **Snorlax rating** — the research rating the team reaches on the selected map,
   from its weekly strength.

## How it works

### Map & favorite berries

- Pick a map; each map has **favorite berries**. Matching berries get a **×2
  strength** bonus.
- Favorite berries are **at most three**. Most maps have **fixed** favorites
  (e.g. Cyan Beach: Oran, Pamtre, Pecha); **Greengrass Isle** lets you **pick your
  own**.
- With **no map**, no favorite-berry bonus applies.

### Area bonus

- An **area bonus** from **0% to 85%**, adjustable, multiplies **all** strength
  (berries, skills, cooking, fillers).
- Strength values show their **base** and **base + bonus** so the effect is legible
  (e.g. on hover).

### Snorlax rating

- Given a selected map, the tool shows the **research rating** the team reaches on it
  — the tiers **Basic**, **Great**, **Ultra** (1–5 each) and **Master** (1–20), i.e.
  **35 ratings** per map, measured on **weekly** strength (daily × 7).
- It shows the current **tier and level** and the **progress to the next** rating.
- With **no map** selected, the rating is **not shown** (there's nothing to rate
  against).

## Acceptance criteria

- Selecting a map applies its favorite-berry **×2** to matching berries and enables
  its **area bonus** and **rating**.
- Favorite berries are capped at **three**; on **Greengrass Isle** the user chooses
  them, on other maps they are **fixed** by the map.
- The **area bonus** accepts **0–85%** and multiplies **all** strength; strength
  readouts expose **base vs base + bonus**.
- With **no map**, no favorite-berry bonus applies and the Snorlax rating is
  **hidden**.
- The **Snorlax rating** is computed on **weekly** strength (daily × 7) against the
  map's 35 thresholds, and shows the tier, level, and **progress to the next**.
- Raising the **area bonus** raises the grand total and can raise the Snorlax rating
  accordingly.

## Guidelines

- **A modifier plus a read-out.** The map bonuses **shape** the aggregate; the rating
  **reads** it back. Neither changes per-member production.
- **The rating is per map.** There is no map-agnostic rating; it only makes sense
  against a selected map.
- **The computation lives in the domain.** Favorite berries, the ×2, the area bonus,
  and the rating thresholds come from the domain catalog; this presents them.

## Out of scope

- **Recommending a map or the best favorite berries** — it applies what you choose.
- **The core aggregate and cooking** — [Team Analysis](0005-team-analysis.md) and
  [Cooking plan](0006-cooking-plan.md).
