# Event bonus

Part of [Team Analysis](0005-team-analysis.md).

## Purpose

The **event bonus** answers *"how much does my team produce during this event?"*.
Pokémon Sleep runs limited-time events (e.g. *Packed Portions Cooking Week*, *Pursue
Mewtwo*) that change production for a week: an extra ingredient per help, a higher
skill trigger chance for one type, stronger dishes, a bigger pot. You **build the
active event by hand** from those effects, and Team Analysis's whole aggregate —
berries, skills, ingredients, cooking, and the grand total — recomputes with them.

Events vary in their values (dish strength is ×1.25 one week, ×1.5 another) and in
whom they reach (only Ingredients specialists, only Psychic-type Pokémon), so the
bonus is a set of **effects you compose**, not a pick from a list of named events.

## What it does (scope)

1. **Compose the bonus** — add effects, each with a **kind**, a **value**, and (where
   the kind admits it) a **scope**.
2. **Edit or remove** any effect, or **remove them all** at once.
3. **Apply it to the team** — every team total reflects the active effects.
4. **Preload the running event** — when the repo defines the event running now, its
   effects are already there when Team Analysis opens.
5. **Summarize it** — the Event chip in the page's context bar shows a short read-out
   of its effects, or "No event" when it has none (see [Tool shell](0014-tool-shell.md)).

## How it works

### Where it lives

The bonus has its own place in Team Analysis: the Event field of the context bar, which
opens the Event dialog. There is **no on/off switch**: the bonus is active exactly when it holds at
least one effect, and removing every effect is how you turn it off.

Like the roster, the map, the ticket, and the meals, it is **session state**: it asks
for no account and does not survive a reload.

### The preloaded event

The repo keeps **one current event** (`frontend/src/currentEvent.ts`): its name, its
start and end (local time, as the game announces them), and its effects, maintained
by hand each week. When Team Analysis opens **inside that window**, the bonus starts
with those effects; they are ordinary effects from then on — edit or remove them like
any other. Outside the window, or when no event is defined, the bonus starts empty as
before. Effects that don't change production (see *Out of scope*) are left out.

The bonus holds **the same value all 7 days** of the week: the weekly figure is the
daily one ×7, as everywhere else in the tool.

### An effect

Each effect has:

- **Kind** — one of the eight below.
- **Value** — `+N` or `×X`, depending on the kind.
- **Scope** — for kinds that reach individual Pokémon: **the whole team**, **one
  Pokémon type** (the type of its berry: Psychic, Fire…), or **one specialty**
  (Berries / Ingredients / Skills). Team-wide kinds (dish strength, pot) have no
  scope.

A member is **in scope** when it matches: every member for *the whole team*; members
of that type for *a type*; members with that specialty for *a specialty*. A member
whose specialty is **All** is in scope of **any** specialty.

### The effects

| Kind | Value | Scope | What changes for a member in scope |
|---|---|---|---|
| **Extra ingredients per help** | +N | yes | Every help that yields ingredients yields **N more of that slot's ingredient**. |
| **Extra berries per help** | +N | yes | Every help that yields berries yields **N more**, like Berry Finding S — including the berries-only helps after the night inventory fills. |
| **Skill ingredients** | ×X | yes | The ingredients delivered by **Ingredient Draw S**, **Ingredient Magnet S**, and **Cooking Assist S** (and their variants) are multiplied. Other skills are unaffected. |
| **Skill trigger chance** | ×X | yes | The member's trigger chance — after sub skills and nature — is multiplied: more daytime triggers. The **night cap** is unchanged (1, or 2 for Skills specialists). |
| **Skill level** | +N | yes | Each trigger yields as if the skill were N levels higher, **capped at that skill's max level**. |
| **Carry limit** | +N | yes | N more inventory slots, added **before** the Good Camp Ticket's ×1.2. |
| **Dish strength** | ×X | no | Cooking strength (recipes + fillers) is multiplied, on top of Extra Tasty and the area bonus. |
| **Pot size** | ×X | no | Each meal's pot (base + skill expansion) is multiplied, and **multiplies with** the Good Camp Ticket's ×1.5. |

**Bonus ingredients and berries are carried like any other.** They take inventory
space, so at night they fill the inventory sooner and bring the overflow forward.

### Stacking

Effects of the same kind whose scopes overlap **all apply** to a member in both:
`+N` values **add**, `×X` values **multiply**. (+1 ingredient for the Ingredients
specialty and +1 for the Psychic type give a Psychic Ingredients specialist +2.) The
game does not overlap them, but a hand-built bonus can, so the rule is explicit.

The same rule governs the **weekly bonus of an expert map** (see [Map bonuses &
Snorlax rating](0007-map-bonuses-rating.md)) — a different thing despite the
similar name: it comes with the map, not with an event. Both apply: the map's +1
ingredient and an event's +1 ingredient give a member reached by both **+2**; the
map's ×1.25 skill trigger and an event's ×1.5 give **×1.875**.

The bonus changes **each Pokémon's production before the split**: a split slot then
weights each half's bonused production, exactly as it weights unbonused production
today.

### Allowed values

- **Extra ingredients / extra berries / skill level**: a whole number from **1 to 5**.
- **Carry limit**: a whole number from **1 to 50**.
- **×X kinds**: from **1.05 to 3**, in steps of **0.05**.
- **Type and specialty** are picked from a closed list — no free text.

## Acceptance criteria

- With **no effects**, every team total is **identical**
  to the tool without this feature (empty, not an error).
- **+1 extra ingredient, scope Ingredients specialty**: an Ingredients specialist
  yields more ingredients/day; a Berries specialist on the same team is **unchanged**.
- **Skill trigger ×1.5, scope Psychic**: only Psychic members trigger their skill
  more often; the night cap stays at **1** (**2** for Skills specialists).
- **Skill level +5** on a skill at level 6 of a 7-level max yields as level **7**,
  not 11.
- **Skill ingredients ×1.5**: an Ingredient Draw S delivering **8** per trigger
  delivers **12**; a member whose skill yields no ingredients is unchanged.
- **Dish strength ×1.25**: daily cooking strength rises by exactly **×1.25**, with
  Extra Tasty and the area bonus applied as before.
- **Pot ×2 with the Good Camp Ticket on**: each meal's capacity is **(base + skill
  expansion) × 1.5 × 2**, rounded up.
- **Carry limit +10 with the Good Camp Ticket on**: capacity is **(carry limit + sub
  skills + ribbon + 10) × 1.2**.
- **+1 extra ingredient**: the night inventory fills **no later** than without it
  (fill time drops or stays the same).
- **Overlapping scopes**: +1 ingredient for Ingredients specialty and +1 for Psychic
  give a Psychic Ingredients specialist **+2**; ×1.5 and ×1.2 trigger chance on the
  same member give **×1.8**.
- On an **expert map** with the **+1 ingredient** weekly bonus, an event's **+1
  ingredient** gives a member reached by both **+2**.
- A member with the **All** specialty is affected by an effect scoped to **any**
  specialty.
- A **split slot 60/40** contributes each half's **bonused** production ×**0.60** /
  ×**0.40**.
- A value **out of range** (e.g. +6 ingredients, ×3.5, ×1.0) is **not accepted**: the
  effect is not added and the reason is shown; nothing is ever computed with it.
- **Team-wide kinds** (dish strength, pot) offer **no scope**.
- **Removing all** effects at once leaves the bonus empty and the totals back to
  their unbonused values; there is no separate on/off state.
- **Reloading** discards the bonus: it comes back as the preloaded event (or empty).
- **While the defined event runs**, opening Team Analysis shows its effects already
  in the bonus; **before its start or from its end on**, or with **no event
  defined**, the bonus starts **empty**.
- The **Box and Comparison** show the **same numbers** for a Pokémon whether or not a
  bonus is on in Team Analysis.

## Guidelines

- **The bonus annotates, it doesn't replace.** Like the ticket and the map, it shapes
  the aggregate; no member's configuration changes.
- **The computation lives in the domain**, on the same [Production
  model](0008-production-model.md); the tool presents it and recomputes nothing.
- **Faithful mechanics, free composition.** Each effect kind mirrors how the game
  applies it; which effects make up an event is the user's call.
- **Production only.** An effect earns a place here only if it changes a number the
  tool shows.

## Out of scope

- **A catalog of named events, or saved bonus templates** — beyond the single
  preloaded current event, the bonus is built by hand each session.
- **Persisting the bonus** — not on the account, not in [Player
  profile](0011-player-profile.md), not in the browser.
- **Variation within the week** — Sunday step-ups (e.g. an event's ×4 pot on Sunday is
  the event's ×2 meeting Sunday's own ×2, which the tool doesn't model), event rules
  for Sunday Extra Tasty, and single-day spikes.
- **Effects that don't change production** — Mini Candy Boost, research candy and
  EXP, research dream shards, encounters, Drowsy Power, and the **+5 energy from
  dishes** (the model uses a fixed energy level).
- **A single named skill's effect** (e.g. Berry Burst ×1.4) — may come later.
- **A fixed favorite berry** — set it through the map and favorites in [Map bonuses &
  Snorlax rating](0007-map-bonuses-rating.md).
