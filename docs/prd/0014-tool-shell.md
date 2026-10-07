# Tool shell

A shared building block: the frame every tool sits in — the top menu, the tool's
header, its context bar, and its empty state. Used by the [Box](0001-box.md),
[Comparison](0002-comparison.md) and [Team Analysis](0005-team-analysis.md); the
visual language lives in [`docs/design-system.md`](../design-system.md).

## Purpose

Each tool used to introduce itself with a paragraph on how it works, and to place its
controls wherever there was room: the Box had a clear sort/filter bar, but
Comparison's berry scenario sat alone at the right, and Team Analysis had a loose
Settings button with the active modifiers hanging below it — while the map, the
favorite berries and the area bonus, which reshape every number, were nowhere on
screen until the totals at the bottom.

It answers: *"where am I, and what is shaping these numbers?"* — at a glance, in the
same place, in every tool. Explanations are for when the tool is empty; once there
is data, the page is the data and what shapes it.

## What it does (scope)

1. **Menu** — the app's name, the three tools with the current one clearly marked,
   and the account; it stays at the top while scrolling.
2. **Header** — each tool shows only its title (plus, in the Box, its count and the
   add action).
3. **Context bar** — right under the title, the tool's active context as chips, each
   one the way to change it. Same shape in every tool.
4. **Empty state** — the explanation of what the tool does, with the actions to get
   started, shown only while the tool has nothing in it.

## How it works

### Menu

- Left: **sleepmon** with a sprite; it takes you to the Box.
- Middle: **Box · Comparison · Team Analysis**. The current tool reads as a filled
  pill, not just brighter text.
- Right: the **account**.
  - Signed in: the photo (or initials) **with the first name** opens the account menu —
    name, **language (ES / EN)**, and sign out.
  - Signed out: **Sign in with Google**, and next to it a small **language** button
    that opens ES / EN.
- It stays **fixed at the top** while scrolling, over the page background with a
  hairline below it.
- Under **640px**: name and account on the first row, the three tools on the second,
  full width; the whole menu stays fixed.

### Header

- Only the tool's **title**. No subtitle, and no note on the day assumed by the
  calculation (the 15.5 h awake + 8.5 h asleep rule is about to be redefined; the
  production model keeps describing it, the screen doesn't).
- **Box**: the title row reads **Box (6)** with **+ Add Pokémon** at its right. It
  replaces today's "My Pokémon Sleep box" title plus a separate "Box" section heading.

### Context bar

One row of chips under the title. A chip shows the current value of a setting that
changes the tool's numbers, and touching it changes that setting. How a chip changes
its setting depends on the setting:

- **On/off** settings toggle in place.
- **A choice from a list** opens a dropdown from the chip.
- **Settings with several parts** open **their own dialog** — one dialog per setting,
  titled after it, with no tabs.

Per tool:

- **Box** — the existing sort and filter bar, unchanged, including its rule: it
  appears when the Box holds more than one Pokémon.
- **Comparison** — one chip, **Scenario: No berry bonus** (or the scenario picked),
  a dropdown with the same options and marks as today. Hidden while the comparison is
  empty, since there is nothing for it to apply to.
- **Team Analysis** — four fields, **always shown**, active or not, even with an empty
  team (the map can be chosen before the team is built):
  - **Map** — "No map", or the map's name followed by its favorite berries as icons
    (on an expert map the **main** favorite first), then — on an expert map — the
    **weekly bonus** as a mark with its effect's icon (berries ×2.4, +1 ingredient or
    skill ×1.25, numbers in the active language like the event marks), and **Area +X%**
    when the area bonus is above 0. Opens the **Map** dialog: map, favorite berries, weekly bonus
    (expert maps) and area bonus — no dish type and no Good Camp Ticket, which live in
    the bar. With **No map** the dialog still shows the berry grid, every berry
    disabled, so it is clear what a map would let you pick.
  - **Meals** — the **dish type** as a Curry / Salad / Dessert toggle, switched in place
    (picking a type resets the three meals to that type's favorite recipe, exactly as
    the dish-type toggle did inside the old Settings dialog), followed by the **three chosen dishes** as
    recipe images in order (or "No recipes"). Touching the dishes opens the **Meals**
    dialog (recipe picker, pot size, clear).
  - **Event** — "No event", or the marks of its effects (the same read-out the page
    shows today). Opens the **Event** dialog.
  - **Good Camp Ticket** — a No / Sí toggle, switched in place; **No** when off.
- The standalone **Settings** button and its tabbed dialog go away. The Cooking card
  keeps a **Choose recipes** action that also opens the **Meals** dialog.
- When the chips don't fit the width, the bar **wraps** to a new line; it never makes
  the page scroll sideways.
- A field **never changes size** as its value changes: every control is the same height,
  and the Map and Meals fields reserve the width of their longest possible value (the
  longest map name with three berries, the widest weekly mark and the top area bonus;
  three dishes or "No recipes"), so choosing something never shifts the rest of the bar.

### Empty state

Each tool's explanation moves into its empty state, next to the actions that start it:

- **Box** (signed in, no Pokémon): what the Box is for, and **+ Add Pokémon**.
- **Comparison** (no cards): what comparing does — the first card is the base, the
  rest show the difference — with **+ New** and **+ My Pokémon**.
- **Team Analysis** (no members): what it analyzes — up to 5 Pokémon, daily
  production and team total — with **+ New** and **+ My Pokémon**.

With data, no tool shows an explanation anywhere. Signed out, the Box keeps its
sign-in gate ([Authentication](0010-authentication.md)) in place of all of this.

## Acceptance criteria

- **Header with data:** with at least one Pokémon, a tool shows its title (and, in the
  Box, the count and add action) and no explanatory text; no screen shows "Calculations
  assume a day of 15.5 h awake + 8.5 h asleep".
- **Empty tool:** Comparison with no cards shows its explanation inside the empty state,
  with + New and + My Pokémon, and no context bar. Team Analysis with no members shows
  its explanation in the empty state **and** the context bar.
- **Box header:** a Box with 6 Pokémon reads "Box (6)" with + Add Pokémon in the same
  row; there is no second "Box" heading below it.
- **Menu at scroll:** scrolled to the bottom of Team Analysis, the menu is still at the
  top and the current tool is marked as a filled pill.
- **Brand:** touching "sleepmon" opens the Box.
- **Language, signed in:** ES / EN is in the account menu, the current one marked;
  switching updates the page immediately and is remembered on the next visit.
- **Language, signed out:** the small language button next to sign-in opens ES / EN,
  with the same behavior.
- **Team Analysis, nothing set:** the bar reads **No map · No event · Good Camp Ticket:
  No**.
- **Team Analysis, expert map:** with Greengrass Isle (Expert), Leppa as main favorite
  and Grepa as a sub-favorite, the Map chip shows the map name with **Leppa first**,
  then Grepa.
- **Weekly bonus:** on Greengrass Isle (Expert) with the berries bonus the Map field shows
  a berry-icon mark "×2,4" (Spanish) / "×2.4" (English) after the berries; with +1
  ingredient, "+1" with the ingredient icon; on a regular map, no mark. The bonus is
  named "Bayas ×2,4" / "Berries ×2.4" everywhere it is chosen (Map dialog, Comparison's
  "Experto · bayas" scenario).
- **Area bonus:** with an area bonus of 0, the Map chip shows no area figure; with 35%,
  it shows **Area +35%**.
- **Good Camp Ticket:** touching **Sí** turns the ticket on and the totals recompute,
  without opening anything; touching **No** turns it off.
- **Map / Event chips:** touching the Map chip opens the Map dialog (titled Map, no
  tabs, no dish type, no Good Camp Ticket); the Event chip opens the Event dialog.
- **No map:** the Map dialog shows every favorite berry, all disabled, and none selected.
- **Meals:** with nothing chosen the field reads "No recipes"; picking **Salad** turns the
  toggle to Salad and fills the three meals with the favorite salad (or leaves them empty
  when there is none); with three dishes chosen their images show in order; touching them,
  or Choose recipes on the Cooking card, opens the Meals dialog.
- **Comparison scenario:** with one card, the bar shows **Scenario: No berry bonus**;
  picking **Expert · strength** from the chip applies it to every card, as today.
- **Narrow screen:** at 375px, the menu takes two rows, the Team Analysis bar wraps
  onto as many lines as it needs, and the page never scrolls sideways.

## Guidelines

- **Every tool has the same shape:** title, context bar, content. A new tool follows
  it; it doesn't invent its own header.
- **What changes the numbers is visible.** A setting that changes a tool's results has
  a chip in its context bar, shown even when off — nothing that affects the
  calculation hides only inside a dialog.
- **Explanations belong to the empty state.** Once a tool has data, it doesn't repeat
  how it works.
- **The chip changes its setting the shortest way:** toggle in place for on/off, a
  dropdown for a choice, its own dialog only for settings with several parts.

## Out of scope

- **Redefining the day assumption** (15.5 h + 8.5 h): only the on-screen note goes.
- **The contents of the Map, Event and Meals dialogs** beyond what is listed above
  (removing the dish type and the ticket from Map, the disabled berries with no map) —
  the rest only changes how it is reached.
- **The cards** themselves (production cards, Box entries).
- **A sticky context bar**: only the menu stays fixed.
