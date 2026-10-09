# Sleep schedule

Part of the [Player profile](0011-player-profile.md); it reshapes the [Production
model](0008-production-model.md) behind every tool. The visual language lives in
[`docs/design-system.md`](../design-system.md).

## Purpose

Every number in sleepmon used to assume one way of playing: **8.5 h of sleep at night**,
the minimum that gives a 100-point sleep score. But players reach 100 in other ways —
**6.5 h at night plus a 2 h nap** is common — and that changes what their Pokémon
produce: the inventory fills and overflows in each sleep separately, and each sleep has
its own cap on skill activations.

The sleep schedule answers *"how do I sleep?"*, once, on your account, so that the Box,
Comparison and Team Analysis estimate **your** day instead of an assumed one.

## What it does (scope)

1. **Night sleep** — how long you sleep at night; **8:30** by default.
2. **Nap** — optionally, one nap and how long it lasts.
3. **Applies everywhere** — every production number, in every tool, uses the schedule.
4. **Shows its effect on the cards** — the inventory fill time is marked when the
   inventory fills inside a sleep, and the skill-while-asleep chances read per sleep.

## How it works

### Where it lives

The schedule is the **Sleep** tab of the [Player profile](0011-player-profile.md),
reached from the account menu. Like the rest of the profile it needs a session, it is a
draft until **Guardar**, and it is saved on the account (present on another device).

Signed out — or signed in without ever saving a schedule — every number uses the
**default: 8:30 at night, no nap**, which is exactly the day the tools assumed before
this feature.

There is **no session override and no chip**: unlike the pot, recipes, and area bonus,
which Team Analysis starts from and can change for a session, the schedule is applied
as saved in every tool. Changing it means changing the profile.

### The controls

- **Night** — a duration from **1:30 to 12:00**.
- **Nap** (toggle) — off by default. Turned on, a **Nap** duration appears, starting at
  **2:00**, from **1:30 to 4:00**. Turned off, the nap is not counted at all.
- Every duration moves in **15-minute steps** (8:30, 8:45…). Under 1:30 a sleep does not
  count in the game, so it cannot be entered.
- Night plus nap can be at most **14:00**. Each control only offers the steps that keep
  the total within it, given the other's current value; a combination over 14:00 cannot
  be reached.

### The day

A day is **awake time + one or two sleeps**:

- **Awake** = 24 h − night − nap. You tend the Pokémon, so the inventory never fills;
  every help yields berries, ingredients, or a skill trigger — as before.
- **Each sleep is its own session.** You empty the inventory when you wake up, so every
  sleep **starts with an empty inventory**: it fills and overflows on its own (once
  full, berries only), and it has its own **cap on skill activations** — **1**, or **2**
  for Skill specialists.
- **Helps per day don't change**; only how they split between awake and asleep does.
- **Skill triggers per day** = awake triggers + each sleep's (capped) triggers.

Since every sleep starts empty and the Pokémon helps at the same pace, the **fill time
is the same in every sleep**. A sleep **overflows** when it lasts longer than the fill
time; the excess is the overflow time.

Example — a Pokémon whose inventory fills in **5:00**:

| Schedule | Night overflow | Nap overflow |
|---|---|---|
| 8:30, no nap | 3:30 | — |
| 6:30 + 2:00 nap | 1:30 | none |

### On the cards

- **Fill time (⏳)** — shows how long the inventory takes to fill, as today. It is
  **marked** when the inventory fills before some sleep ends, i.e. when some sleep
  overflows. Its tooltip lists each sleep (*Night 6:30*, *Nap 2:00*) and what happens
  in it: it fills, and how long it then collects berries only, or it doesn't fill. A
  Pokémon whose inventory never fills is never marked.
- **Skill while asleep (🌙)** — a small table with **one row per sleep** (with no nap,
  a single row, as today) and two columns: the chance of triggering **at least once**,
  and, for Skill specialists, the chance of triggering **twice**. *At least once*
  replaces today's *exactly once*: it never drops when a Pokémon gets more active, so
  in a comparison a stronger Pokémon never reads as triggering "less" just because more
  of its chance moved to *twice*. Non-specialists (capped at 1) show a single column,
  **once**, and no *twice*. Since the schedule is the same for every card, every card has the same rows.

These read the same in the Box, Comparison and Team Analysis.

## Acceptance criteria

- **Default:** signed out, or signed in with no saved schedule, every number in every
  tool is **identical** to the tool before this feature (8:30 at night, no nap).
- **A new account** reads Night **8:30**, Nap **off**.
- **Night only:** with Night **7:00**, a Pokémon that fills in **5:00** overflows **2:00**
  at night instead of 3:30, and so yields more ingredients/day than at 8:30; its helps/day
  are unchanged.
- **Nap:** with Night **6:30** and Nap **2:00**, a Pokémon that fills in **5:00**
  overflows **1:30** at night and **none** in the nap.
- **Nap overflow:** with Night **6:30** and Nap **2:00**, a Pokémon that fills in
  **1:45** overflows in **both** sleeps (4:45 and 0:15).
- **Skill cap per sleep:** with a nap, a non-specialist can add up to **2** sleep
  activations per day (1 per sleep), a Skill specialist up to **4** (2 per sleep).
- **Fill mark:** with Night **6:30** and Nap **2:00**, a fill time of **5:00** is marked
  (the night overflows) and its tooltip reads *Night 6:30 · Nap 2:00* naming the night;
  a fill time of **7:00** is not marked. A fill time **equal** to a sleep's length is
  not marked.
- **Skill table:** with no nap, the 🌙 table has one row; with a nap, one per sleep. A
  Skill specialist with P(1 or more) = **63.3%** and P(2) = **22.3%** at night reads
  **63.3%** under *at least once* — not 41.0% (exactly once) — and **22.3%** under
  *twice*; a non-specialist's table has only a *once* column.
- **Steps and limits:** Night offers exactly **1:30 to 12:00** in 15-minute steps; Nap
  **1:30 to 4:00**. A value under 1:30, off the 15-minute grid, or above a limit cannot
  be entered.
- **Total limit:** with Night **11:00**, Nap offers up to **3:00**; with Nap **4:00**,
  Night offers up to **10:00**.
- **Nap toggle:** turning the Nap toggle on shows the Nap duration at **2:00**; turning it off removes the nap
  from every number once saved.
- **Saving:** nothing changes in any tool until **Guardar**; after it, every open tool
  recomputes with the new schedule, and the schedule is present on another device signed
  into the same account.
- **No session override:** Team Analysis offers no way to change the schedule and marks
  nothing about it as unsaved.
- **Same everywhere:** a Pokémon shows the same numbers in the Box, Comparison and Team
  Analysis under the same schedule.

## Guidelines

- **The default is the game's 100-point night.** Without a schedule, the numbers are the
  ones the tools always showed; the feature only ever refines them.
- **A sleep is a session.** Anything modeled as happening while asleep (inventory fill,
  overflow, the skill cap) happens per sleep, never across sleeps.
- **One schedule for every tool.** It is part of the profile, not of a tool; no tool
  overrides it.
- **The effect shows where it lands.** The schedule has no chip; what it changes is made
  visible on the numbers it changes — the fill time and the sleep skill chances.

## Out of scope

- **Energy from sleep** — the model keeps its fixed energy level.
- **The sleep score**, more than one nap, the time of day you sleep, and schedules that
  vary by day of the week.
- **A schedule without an account** — signed out, the default applies.
- **Changing the schedule per tool or per session.**
