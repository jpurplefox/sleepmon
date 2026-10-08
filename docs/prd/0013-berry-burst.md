# Berry Burst

Part of the [Production model](0008-production-model.md); presented by [Team
Analysis](0005-team-analysis.md), [Comparison](0002-comparison.md) and the
[Box](0001-box.md).

## Purpose

**Berry Burst** is the main skill of ten Pokémon — Treecko/Grovyle/Sceptile,
Chimchar/Monferno/Infernape, Rufflet/Braviary, plus **Mimikyu** (*Disguise*) and
**Latios** (*Draco Meteor*). Each trigger gets **berries**: some of its own, and some
of **each teammate's** berry. Until now the skill contributed nothing, so these
Pokémon read as far weaker than they are.

It answers: *"how much does a Berry Burst Pokémon really yield, and how much of it
depends on its team?"*.

**Cresselia**'s *Energy for Everyone S (Lunar Blessing)* gets berries the same way on
top of its team energy, so everything here applies to it too (see below).

Its peculiarity is that half the effect **depends on the teammates**. Team Analysis
has the real team and values it fully; Comparison and the Box don't, so they show that
half as a **count**, not as strength.

## What it does (scope)

1. **Own berries** — every trigger yields berries of the Pokémon's own type, valued
   like its normal berries.
2. **Teammates' berries** — every trigger yields berries of each teammate's type,
   valued like that teammate's own berries.
3. **Disguise** (Mimikyu) — a once-a-day **Great Success** that triples a trigger.
4. **Draco Meteor** (Latios) — amounts that grow with the number of **Dragon species**
   on the team, plus a bonus when **Latias** is on it.
5. **Lunar Blessing** (Cresselia) — Berry-Burst-like berries, growing with the number
   of species on the team that share **its berry**.
6. **Presentation** — in Team Analysis every berry lands in the **Berries** section, on
   its own berry type; in Comparison and the Box the own part lands in Berries and the
   teammates' part in Skill, as a count.

## How it works

### Per trigger

The skill caps at **level 6**. Per trigger, by skill level (1…6):

| Skill | Own berries | Berries of each teammate |
|---|---|---|
| **Berry Burst** | 11 / 14 / 21 / 24 / 27 / 30 | 1 / 2 / 2 / 3 / 4 / 5 |
| **Berry Burst (Disguise)** | 8 / 10 / 15 / 17 / 19 / 21 | 1 / 2 / 2 / 3 / 4 / 5 |
| **Berry Burst (Draco Meteor)** | depends on Dragon species (below) | depends on Dragon species (below) |
| **Energy for Everyone S (Lunar Blessing)** | depends on same-berry species (below) | depends on same-berry species (below) |

Per day, each amount is multiplied by the **skill triggers/day** the production model
already estimates.

- **Own berries** are worth what the Pokémon's own berries are worth: its berry, at
  **its** level, with whatever map bonus that berry gets (favorite ×2, expert ×2.4).
- **A teammate's berries** are worth what **that teammate's** berries are worth: its
  berry, at **its** level, with the map bonus **its** berry gets.
- The area bonus applies on top of all of it, like any other strength.

### Disguise — Great Success

Each trigger has an **18.5%** chance of a **Great Success**, which **triples** that
trigger's berries (own and teammates'). It can happen **at most once a day**. The
estimate adds the expected value: **P(at least one Great Success that day) × 2 extra
triggers' worth**, where P = 1 − 0.815^(triggers/day).

### Draco Meteor — Dragon species and Latias

Both amounts depend on the number of **distinct Dragon-type species** on the team,
Latios included (1…5). Two copies of the same species count once; Dratini and
Dragonite count as two.

| Skill level | 1 species | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 1 | 12 + 1 | 14 + 1 | 18 + 1 | 18 + 2 | 20 + 2 |
| 2 | 21 + 1 | 24 + 1 | 29 + 1 | 30 + 2 | 33 + 2 |
| 3 | 29 + 1 | 29 + 2 | 35 + 2 | 37 + 3 | 41 + 3 |
| 4 | 38 + 1 | 39 + 2 | 42 + 3 | 45 + 4 | 49 + 4 |
| 5 | 43 + 2 | 44 + 3 | 48 + 4 | 49 + 5 | 53 + 5 |
| 6 | 48 + 3 | 50 + 4 | 55 + 4 | 55 + 5 | 58 + 5 |

(*own + each teammate's*.) With **Latias** on the team, the own berries add **+2 ×
skill level** up to level 4, **+9** at level 5, **+10** at level 6.

### Lunar Blessing — species sharing its berry

Cresselia's skill also restores **3 / 4 / 5 / 7 / 9 / 11** energy to each teammate. Its
berries depend on the number of **distinct species on the team with Cresselia's berry**
(Mago), Cresselia included (1…5), counted like Draco Meteor's Dragon species.

| Skill level | 1 species | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 1 | 5 + 1 | 7 + 1 | 9 + 1 | 12 + 1 | 14 + 2 |
| 2 | 9 + 1 | 12 + 1 | 15 + 1 | 16 + 2 | 19 + 3 |
| 3 | 13 + 1 | 17 + 1 | 18 + 2 | 20 + 3 | 24 + 4 |
| 4 | 17 + 1 | 19 + 2 | 25 + 2 | 28 + 3 | 29 + 5 |
| 5 | 21 + 1 | 24 + 2 | 27 + 3 | 28 + 5 | 30 + 7 |
| 6 | 25 + 1 | 29 + 2 | 30 + 4 | 31 + 6 | 32 + 9 |

(*own + each teammate's*.) Everything below about presentation and composition applies
to Lunar Blessing as well; its energy keeps showing in the Skill block as before.

### Team Analysis (with the real team)

Everything Berry Burst yields is strength, so it all lives with the **berries** — in
line with "whatever yields strength directly is shown in Berries".

**The team's Berries & skills card.**

- Every berry Berry Burst obtains **adds to the row of its own berry type**: the Berry
  Burst Pokémon's own berries to its berry's row, the berries obtained from a teammate
  to that teammate's berry row. There is **no separate Berry Burst row**.
- A row that received berries from the skill shows one amount and one strength; the
  breakdown — **helps** vs **Berry Burst** (naming the Pokémon whose skill it was) —
  lives only in the strength's **tooltip**. A row with nothing from the skill has no
  extra tooltip.
- The **Skill** block adds **no strength** for Berry Burst: it's already counted in
  Berries, and the grand total counts it once.

**The Berry Burst Pokémon's own card** (the member card in the roster).

- **Own berries** show the total with the breakdown **helps / skill**, the same way a
  skill's ingredients are broken down.
- A row with the game's **generic berry** icon shows the **total berries obtained from
  teammates** per day, with no label; its **tooltip** lists each teammate berry with
  its amount and strength.
- **Strength** includes those teammate berries, broken down into **own berry / generic
  berry** — the same breakdown a strength skill (Charge Strength) gets, with the generic
  berry in place of the skill icon.

**Composition.**

- **Empty slots** contribute nothing: with fewer than 5 Pokémon there are fewer
  teammates.
- **Split slots**: each teammate's berries are scaled by **that teammate's weight**
  (a teammate at 40% gives 40% of its berries). The other half of the **Berry Burst
  Pokémon's own** split slot is **not** a teammate — they're never on the team at the
  same time. The Berry Burst Pokémon's whole yield is scaled by its own weight, as
  usual.
- **Draco Meteor** counts the Dragon species and Latias across the whole roster,
  split halves included (excluding the other half of Latios's own slot). **Lunar
  Blessing** counts the species sharing Cresselia's berry the same way.

### Comparison and the Box (no team)

There's no team, so the teammates' part has no berry to value.

- **Own berries** are computed in full and add to the **Berries** block (amount and
  strength, with the breakdown normal / skill), and the map scenario applies to them.
- **Teammates' berries** show in the **Skill** block, with the game's **generic berry**
  icon, **as a count only** — *"+N berries from each teammate / day"* — **not**
  converted to strength. In Comparison it carries
  its delta like any other metric.
- **Draco Meteor** assumes the floor: **Latios is the only Dragon species and Latias
  isn't on the team**. **Lunar Blessing** likewise assumes Cresselia is the only species
  with its berry.
- **Disguise** adds the Great Success to both parts (own berries in Berries, the
  teammate count in Skill).

## Acceptance criteria

- A **Berry Burst** level 1 Pokémon at level 30 with Durin, per trigger: **11** own
  berries worth **61** each (**671**); with its berry as a favorite, **122** each.
- In Team Analysis, a **Pikachu** (Grepa) at level 30 as a teammate adds, per trigger
  of a level-1 Berry Burst, **1** Grepa worth **54** to the team's **Grepa** row; that
  row's tooltip splits **helps** and **Berry Burst**.
- A teammate whose berry is a **favorite** on the chosen map contributes its Berry
  Burst berries at **×2** (×2.4 for the expert main favorite), the same as its own.
- **Team of one** (only the Berry Burst Pokémon) → its card shows **no** "from
  teammates" row; the own berries still add to its berry row.
- In the Berry Burst Pokémon's **own card** (Team Analysis), the "from teammates" row
  shows the generic berry and the daily total, and its tooltip lists one line per
  teammate berry; the card's strength includes them, broken down into own berry /
  generic berry.
- A team berry row that received **nothing** from Berry Burst shows no Berry Burst
  breakdown.
- The **grand total** counts Berry Burst strength **once** — the Skills section adds
  none.
- **Split slot**: a teammate at **60/40** gives **0.6×** / **0.4×** of its Berry Burst
  berries; the other half of the Berry Burst Pokémon's own slot gives **none**.
- **Disguise** with **3** triggers/day → Great Success probability **≈ 45.9%**; the
  daily yield is 3 triggers + 0.459 × 2 triggers' worth.
- **Draco Meteor** level 1: alone → **12** own + **1** per teammate; with **Latias** on
  the team (2 Dragon species) → **14 + 2 = 16** own + **1** per teammate.
- **Lunar Blessing** level 6: alone → **25** own + **1** per teammate and **11** energy
  to each teammate; with **Ralts** and **Gardevoir** on the team (3 Mago species) →
  **30** own + **4** per teammate.
- In **Comparison** and the **Box**, a Berry Burst card shows its own berries inside
  Berries and *"+N berries from each teammate / day"* inside Skill, with **no
  strength** attached to the teammate part; Draco Meteor shows the 1-species,
  no-Latias values.
- A Berry Burst skill level above **6** is not offered; a level that would exceed it
  (e.g. via an event's skill level +N) yields **as level 6**.

## Guidelines

- **Strength lives in Berries.** Whatever Berry Burst yields is berries; it's
  presented in the Berries section, never as a separate "skill strength".
- **Don't invent a team.** Without a real team, the teammates' part is shown as a
  count; it's never converted to strength with assumed teammates.
- **A teammate's berry is worth what that teammate's berry is worth** — same berry,
  same level, same map bonus.
- **One model, many presenters** — computed once in the domain, like the rest of the
  [Production model](0008-production-model.md).

## Out of scope

- **Event bonuses specific to Berry Burst** (e.g. events that boost Berry Burst's
  berry count).
- **Metronome** and **Skill Copy** landing on Berry Burst — they come with modeling
  those skills.
- **Per-teammate breakdown in Comparison/Box** — there's no team there.
