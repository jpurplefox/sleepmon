# Saved teams

> Product document. The visual language lives in
> [`docs/design-system.md`](../design-system.md).

## Purpose

**Saved teams** answers *"which teams have I put together, and how do I get back to
one without building it again?"*.

[Team Analysis](0005-team-analysis.md) is a workbench: every visit used to start from
nothing — five slots, the meals and the map, rebuilt by hand. Most players run a
handful of recurring line-ups (one per research area, or one per dish type), so the
rebuild is the same friction every time.

A saved team is a **named line-up**: which Box Pokémon sit in which slots (with
their split weights), the map, and the meals. It is kept on your account and
reopened in Team Analysis with one action.

It is its own tool, **Teams**, the fourth in the menu: the place to see, find, open,
delete your teams. Team Analysis stays where a team is built and read;
Teams is where it is kept.

## What it does (scope)

1. **Save a team from Team Analysis** — under a name, as a new team or over the one
   you opened.
2. **List your saved teams** in the **Teams** tool, each card showing what it is.
3. **Filter the list** — by map, by dish type, and by a Box Pokémon it contains.
4. **Open a team** — Team Analysis loads it.
5. **Rename** the open team in Team Analysis, and **delete** a team from Teams.
6. **Keep teams honest with the Box** — a team's members follow their Box entries;
   deleting a Box Pokémon removes it from the teams it is in.
7. **Account only** — like the Box, saved teams belong to a signed-in account.

## How it works

### What a team holds

- A **name** — required, unique within your account (ignoring case), up to 40
  characters, surrounding spaces trimmed.
- **Up to 5 slots**, each a single Pokémon or a **split** of two with their weights
  (as in Team Analysis).
- The **map**, its **favorite berries**, and — on an expert map — the **weekly bonus**.
  "No map" is a valid saved value.
- The **dish type** and the **three meals** (each a recipe or empty).

What a team does **not** hold:

- The **event** and the **Good Camp Ticket**. They change week to week; opening a team
  leaves them as they are in your session.
- **Pot size, recipe levels and area bonus**. They are your
  [Player profile](0011-player-profile.md)'s; opening a team applies them exactly as
  Team Analysis always does (the map loads its saved area bonus, each recipe enters at
  its saved level).

### Members are Box Pokémon

Every member of a saved team **is a Box entry**. The team records *which* entry sits
in which slot, not a copy of its configuration. Opening a team loads each member **as
it is in the Box now**: level a Pokémon up in the Box and every team it is in shows
the new level.

Duplicates stay allowed: the same Box entry may sit in two slots.

### Saving from Team Analysis

- With a team **not yet saved**, Team Analysis offers **Save team**, which asks for a
  name.
- With a **saved team open**, its name shows next to the title — touching it
  **renames** the team (same name rules) — and Team Analysis offers **Save** (over that
  team) and **Save as…** (a new team under another name,
  leaving the original as it was; from then on the new one is the open team).
- **Every member must be in the Box.** When the team has members created on the spot,
  or members whose configuration was changed in the session, saving first lists what
  will go to the Box — e.g. *"Pikachu — new"*, *"Bulbasaur — update (level 30 → 50)"* —
  and asks to confirm. Confirming writes those Pokémon to the Box and then the team;
  cancelling writes nothing. This is the same write **Save to Box** does per member,
  done for all of them at once.
- A team with **no members** cannot be saved.
- An invalid name (empty, too long, or already used by another of your teams) is
  refused with a message at the name field; nothing is saved.

### Unsaved changes

With a saved team open, any change to what the team holds — a slot added or removed,
a member swapped or edited, a weight moved, the map, a favorite berry, the weekly
bonus, the dish type, a meal — marks the team's name **unsaved**. Undoing the change
by hand, or saving, clears the mark. Changing the event or the Good Camp Ticket does
not mark it.

Unsaved changes are session state, like everything in Team Analysis: moving between
tools keeps them, a reload drops them (the saved team is intact). Opening a team
replaces the session, so when that would lose work — the open team has unsaved
changes, or the session holds a team never saved — it asks first: **save / discard /
cancel**. **Save** saves (naming the team if it is new) and then opens the other one.

**Save** is available only while the open team is **unsaved**; **Save as…** is always
available. Next to the open team's name, **Close team** empties Team Analysis (asking
the same question first when it would lose work) — the way back to building a new team
without reloading.

### Entering Team Analysis

On a fresh load Team Analysis still **starts empty**; within a visit its session
survives moving to another tool and back. Its empty state gains an **Open a team**
action (when signed in) that goes to Teams.

### The Teams tool

- One **row per team**, most recently saved first, under a header — **Team · Slots ·
  Map · Meals · Saved** — so teams compare down the columns. On a phone each row becomes
  a card with the same order (map and meals labelled).
- **Slots** are five equal boxes, empty ones dashed. A split stacks its two Pokémon in
  its box with a vertical bar beside them: the top length is the top Pokémon's share,
  the bottom length the other's, in two distinct colors. The percentages are a hover
  (and the screen reader's text) away, not printed.
- Each row's actions live in a **···** menu, like the Box's: **Open in Analysis**
  (loads it into Team Analysis and takes you there) and, set apart, **Delete** (asks
  for confirmation; the Box is untouched).
- A team is **renamed only in Team Analysis**, from its name (see *Saving from Team
  Analysis*); the list does not rename.
- Deleting the team that is open in Team Analysis keeps its roster there, as a team
  not yet saved.
- Signed out, Teams shows its explanation and the contextual sign-in prompt (see
  [Authentication](0010-authentication.md)); nothing else.
- Signed in with no teams, Teams shows what saved teams are for and a way to Team
  Analysis to build one.

### Filters

A filter bar above the list, shown when there is **more than one team** (the Box's
rule). Three filters, combined with **AND**; none active shows every team.

- **Map** — any of the game's maps, plus **No map**. A map no team uses can be
  chosen; it simply matches nothing.
- **Dish type** — the Box's segmented toggle: **Curry / Salad / Dessert**; pressing
  the active type again clears it.
- **Pokémon** — opens the [Box picker](0004-box-picker.md); keeps the teams that
  contain **that Box entry**, in a single slot or a split. The chip shows its sprite
  and name.

When the filters match nothing, the list reads **"No team matches"** with **Clear
filters** — not an error, and not the tool's empty state. Filters are not remembered:
coming back to Teams starts unfiltered.

### Deleting a Box Pokémon that is in teams

Deleting from the Box warns which teams it is in before confirming, e.g. *"It is in
Cyan curry and Taupe desserts. Taupe desserts will be deleted because it would be
left without members."* Confirming removes it from every team:

- From a **single** slot: the slot goes.
- From a **split**: the other Pokémon stays, at **100%**.
- If it was a team's **only** member (in every slot it occupied): the **team is
  deleted** too. A saved team is never empty.

A Box Pokémon in no team is deleted with the Box's usual confirmation, unchanged.

## Acceptance criteria

- **Signed out**: the Teams tool shows its explanation and the sign-in prompt; Team
  Analysis offers no Save team. Everything else in Team Analysis works as before.
- **Signed in, no teams**: Teams shows an empty state explaining saved teams, with a
  way to Team Analysis — not an error.
- Saving a team of **3 slots** (one split **60/40**), map **Cyan Beach** with its three
  favorites, dish type **Curry** and three curries; then reloading and opening it —
  here or **on another device** — shows the same slots, weights, map, favorites, dish
  type and meals. The event and the Good Camp Ticket are whatever the session had.
- A member saved at **level 30** that is raised to **50 in the Box** opens at **50**.
- Saving a team with a member **created on the spot** and one **edited in the
  session** lists both (*new* / *update*) before writing. **Cancel** leaves the Box and
  the teams unchanged; **confirm** writes both Pokémon to the Box and the team.
- Save team is **unavailable** with no members.
- A name that is **empty**, over **40** characters, or equal to another team's ignoring
  case (*"cyan curry"* vs *"Cyan Curry"*) is refused with a message; nothing is saved.
  Saving a team **under its own name** is fine.
- **Save** writes over the open team; **Save as…** creates a new team and leaves the
  original exactly as it was.
- Moving a split weight marks the open team **unsaved**; moving it back clears the
  mark; saving clears it. Toggling the Good Camp Ticket does **not** mark it.
- Opening a team while the session has **unsaved** changes (or an unsaved new team
  with members) asks **save / discard / cancel**; otherwise it opens directly. The
  same applies to **Close team**.
- Going from Team Analysis to the Box and back keeps the roster, map and meals.
- **Delete** asks for confirmation and leaves the Box unchanged. Deleting the team open
  in Team Analysis leaves its roster there, unsaved.
- **Rename**, from the open team's name in Team Analysis, follows the same name rules;
  the Teams list offers no rename.
- Cards are ordered **most recently saved first**.
- **Filters**: with teams on Cyan, Cyan and Taupe, filtering by **Cyan** shows 2;
  **Cyan + Curry** shows only the Cyan teams whose dish type is Curry. Filtering by a
  Box Pikachu shows every team holding **that entry**, including in a split, and not a
  team holding a **different** Box Pikachu.
- Filters that match nothing show **"No team matches"** with **Clear filters**, which
  brings back the whole list.
- With **0 or 1** team the filter bar is not shown.
- Deleting a Box Pokémon in **no team** shows the usual confirmation only.
- Deleting a Box Pokémon in teams names them in the confirmation; confirming removes
  its single slots, collapses its splits to the other member at **100%**, and
  **deletes** any team it was the only member of — the confirmation says which.
- If the Box Pokémon the Pokémon filter points to is deleted, that filter clears.

## Guidelines

- **The Box is the truth about Pokémon; a team is a line-up.** A saved team records
  which Box entries, in which slots, at which weights — plus the map and the meals.
  It never holds its own copy of a Pokémon.
- **Nothing is saved on your behalf.** Not the team, not the Pokémon it sends to the
  Box. Every write is an action you take, and what goes to the Box is listed first.
- **Team Analysis stays a workbench.** Changing a member there is a session trial; it
  reaches the team and the Box only through Save.
- **What changes weekly is not saved.** Event and Good Camp Ticket stay session inputs;
  pot, recipe levels and area bonus stay the profile's.
- **A saved team is never empty.**

## Out of scope

- **Sharing** a team or a public link to it.
- **Duplicating** from the list — *Save as…* covers it.
- **Reopening the last team** automatically on entering Team Analysis.
- **Suggesting or optimizing** teams.
- **Sorting** the list, **searching by name**, and filtering by **species** (any
  Pikachu) rather than a Box entry.
- Saving the **event** or the **Good Camp Ticket** with a team.
- A limit on how many teams an account keeps.
