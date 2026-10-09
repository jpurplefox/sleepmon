# Usage metrics

> Product document. The visual language lives in
> [`docs/design-system.md`](../design-system.md). This feature has no UI of its own.

## Purpose

**Usage metrics** answers *"how is sleepmon actually used?"* — for whoever maintains
it, not for players.

Before the project goes public there is no way to know which tools people reach for,
whether the Box is the hub it was designed to be, or where signed-out visitors stop.
Decisions about what to build next are guesses.

The feature records a **curated catalogue of usage events** — each tied to a question
the maintainer wants answered — and sends them to a product-analytics service where
they are read as counts, breakdowns, funnels and retention. Players see nothing and
give up nothing personal.

## What it does (scope)

1. **Which tools are used** — every arrival on Comparison, Team Analysis, Box and
   Teams.
2. **Where Box Pokémon come from** — created in the Box itself, saved from Comparison,
   saved from Team Analysis, or written when saving a team.
3. **Box vs. new in Comparison** — every Pokémon added to a comparison, by source.
4. **Box vs. new in Team Analysis** — every Pokémon added to a team, by source and
   whether it filled a slot or a split.
5. **Saved teams** — how many are created, overwritten, opened, renamed, deleted, and
   what they are made of.
6. **What shapes the numbers** — map, dish type and meals, event effects, Good Camp
   Ticket, Player profile, language.
7. **The way in** — how often the sign-in prompt appears, why, and how often it ends in
   a signed-in account.
8. **Lists** — how the Box and the Teams lists are filtered and sorted.
9. **Gaps** — species people look for that the catalog lacks, and hitting the
   Comparison limit.

## How it works

### Identity

- **Signed out**: the visitor is anonymous. The anonymous identity lasts for the open
  tab only — nothing is stored on the device (no cookies, no local storage), so a
  reload or a new tab is a new anonymous visitor.
- **Signed in**: events carry the account's **internal opaque id** — never the email,
  name or Google identity. Signing in links the visit's earlier anonymous events to
  the account, so "signed out → prompted → signed in" reads as one path. Signing out
  returns to a fresh anonymous identity.

### What every event carries

- Whether the visitor is **signed in**.
- The interface **language** (`es` / `en`).
- The **app version** that sent it.

### The event catalogue

Names are English, `snake_case`, and stable: a renamed button does not rename its
event. Property values are closed sets (listed here) or numbers.

**Tools**

| Event | When | Properties |
|---|---|---|
| `tool_viewed` | Arriving on a tool: first load or navigation to it. Re-renders and filter changes do not count. | `tool`: `compare` / `team_analysis` / `box` / `teams` |

**Adding Pokémon to a tool** (Comparison and Team Analysis)

| Event | When | Properties |
|---|---|---|
| `pokemon_added` | A Pokémon lands in a comparison or a team. Editing an existing one does not count. | `tool`: `compare` / `team_analysis`; `source`: `new` (MemberForm), `box` (picked with "My Pokémon"), `box_compare` (the Box's "Compare" action), `clone` (cloned card); `slot`: `single` / `split` (Team Analysis only); `species` |

Opening a saved team does **not** emit `pokemon_added` for its members — that is
`team_opened`.

**The Box**

| Event | When | Properties |
|---|---|---|
| `box_pokemon_saved` | A Pokémon is written to the Box (one event per Pokémon). | `origin`: `box` / `compare` / `team_analysis` / `team_save`; `action`: `create` / `update`; `species` |
| `box_pokemon_deleted` | A Box Pokémon is deleted. | `teams_affected`: number of saved teams it was in |
| `list_filtered` | A filter is turned on in a list. Clearing does not count. | `list`: `box` / `teams`; `filter`: `type` / `ingredient` / `skill` / `specialty` (Box) or `map` / `dish_type` / `pokemon` (Teams) |
| `list_sorted` | The Box's sort key or direction changes. | `list`: `box`; `key`: `dex` / `level` / `berries` / `strength` / `ingredients`; `direction`: `asc` / `desc` |

**Saved teams**

| Event | When | Properties |
|---|---|---|
| `team_saved` | A team is saved successfully. | `kind`: `new` / `overwrite` / `save_as`; `slots`; `split_slots`; `members_from_box` (already in the Box); `members_created` (written to the Box by this save); `has_map`; `expert_map`; `meals` (0–3) |
| `team_opened` | A saved team loads into Team Analysis. | `members_missing`: members skipped because they no longer exist |
| `team_renamed` | The open team is renamed. | — |
| `team_deleted` | A saved team is deleted. | — |

**What shapes the numbers**

| Event | When | Properties |
|---|---|---|
| `map_set` | The map changes. | `tool`: `compare` / `team_analysis`; `island` (or `none`); `expert` |
| `dish_type_set` | The dish type changes. | `dish_type` |
| `meals_set` | The meals dialog closes with the meals changed. | `meals` (0–3) |
| `event_effect_added` | An event effect is confirmed. | `effect` (its kind); `scope`: `team` / `type` / `specialty` |
| `good_camp_ticket_set` | The Good Camp Ticket is toggled. | `on` |
| `profile_saved` | Player profile values are saved. | `from`: `profile` (the profile dialog) / `team_analysis` (inline save); `sections`: any of `kitchen` / `recipes` / `areas` / `sleep` |
| `language_changed` | The language is switched. | `language` |

**The way in**

| Event | When | Properties |
|---|---|---|
| `sign_in_prompted` | The sign-in prompt appears. | `reason`: `page_gate` (Box or Teams signed out) / `my_pokemon` / `save_to_box` |
| `sign_in_completed` | Sign-in succeeds. | `reason`: the prompt's reason, or `app_bar` when started from the menu |
| `sign_in_abandoned` | The sign-in dialog is closed without signing in. | `reason` |
| `sign_in_failed` | Google sign-in fails. | — |
| `signed_out` | The user signs out. | — |
| `account_deleted` | The account is deleted ([Account & privacy](0018-account-and-privacy.md)). | `box_size`; `saved_teams` |

**Gaps**

| Event | When | Properties |
|---|---|---|
| `species_missing` | A Box Pokémon can't be added to a tool because its species isn't in the catalog. | `species`; `tool` |
| `compare_limit_reached` | A comparison reaches 5 Pokémon. | — |

### What is read from the events

The analytics service — not sleepmon — turns the events into:

- **Activity**: daily and weekly active visitors, and the share signed in.
- **Tool mix**: `tool_viewed` by tool.
- **Box origin**: `box_pokemon_saved` (`action=create`) by `origin`.
- **Box vs. new**: `pokemon_added` by `source`, split by `tool`.
- **Teams**: `team_saved` (`kind=new`) per week, average size, share of members that
  were already in the Box, and how often a team is reopened.
- **Sign-in funnel**: `sign_in_prompted` → `sign_in_completed`, by `reason`.
- **Retention**: signed-in accounts returning after 1 and 7 days.
- **Catalog gaps**: `species_missing` by `species`.

### When nothing is sent

- With no analytics key configured (local development, tests, a fork), no event is
  sent and the app behaves exactly the same.
- If the analytics service is unreachable or blocked (e.g. an ad blocker), events are
  lost silently; the app never waits for it, shows an error, or behaves differently.

## Acceptance criteria

- Navigating Comparison → Team Analysis → Box → Teams sends four `tool_viewed`, with
  `tool` = `compare`, `team_analysis`, `box`, `teams`; changing a Box filter sends
  `list_filtered`, not another `tool_viewed`.
- Adding a Pokémon in Comparison with "New" → `pokemon_added` `{tool: compare,
  source: new}`; with "My Pokémon" → `{source: box}`; via the Box's "Compare" →
  `{source: box_compare}`; cloning a card → `{source: clone}`. Editing a card sends
  no `pokemon_added`.
- In Team Analysis, filling an empty slot from the Box → `pokemon_added`
  `{tool: team_analysis, source: box, slot: single}`; adding a new one as a split →
  `{source: new, slot: split}`.
- Saving a Comparison card that is not in the Box → `box_pokemon_saved`
  `{origin: compare, action: create}`; saving one that came from the Box →
  `{action: update}`.
- Creating a Pokémon with the Box's "Add" → `box_pokemon_saved` `{origin: box,
  action: create}`.
- Saving a new team of 5 slots, 3 already in the Box and 2 created on the spot →
  one `team_saved` `{kind: new, slots: 5, members_from_box: 3, members_created: 2}`
  plus two `box_pokemon_saved` `{origin: team_save, action: create}`.
- A failed save (team or Box) sends no `team_saved` / `box_pokemon_saved`.
- Opening a saved team with one deleted member → `team_opened`
  `{members_missing: 1}` and no `pokemon_added`.
- Turning on the Teams list's map filter → `list_filtered` `{list: teams,
  filter: map}`; picking a Pokémon filter → `{filter: pokemon}`.
- Signed out, pressing "My Pokémon" → `sign_in_prompted` `{reason: my_pokemon}`;
  closing the dialog → `sign_in_abandoned` `{reason: my_pokemon}`; signing in
  instead → `sign_in_completed` `{reason: my_pokemon}`, and the visit's earlier
  events belong to that account from then on.
- Opening /box signed out → `sign_in_prompted` `{reason: page_gate}`.
- No event, under any action, carries an email, a person's name, a saved team's
  name, or any other text the user typed.
- No cookie or local-storage entry is created by analytics, signed in or out.
- Without an analytics key, using every tool sends no network request to the
  analytics service and nothing changes on screen.
- With the analytics service blocked, every tool works and no error is shown.

## Guidelines

- **Question first.** An event exists because it answers a question in this document;
  a new feature adds its events (and the question) here, a removed feature removes
  them.
- **Semantic, not clicks.** Events describe what the user achieved (a Pokémon added,
  a team saved), not which button was pressed; they survive UI redesigns.
- **Only after success.** Events that record a write fire when the write succeeded.
- **Nothing personal, nothing typed.** No email, name, Google identity, or free text
  (team names included). Game data (species, maps, recipes) is fine.
- **No device storage.** Analytics never stores cookies or local data; accepting
  anonymous visitors as per-tab is the price.
- **Invisible.** Analytics never blocks, slows, or changes what the user sees, and
  its absence or failure is indistinguishable from a working install.
- **Closed values.** Properties use the closed sets listed here, so breakdowns stay
  clean.

## Out of scope

- **Error and performance monitoring** — a separate technical concern (crash and
  latency reporting), not usage.
- An in-app dashboard or any metric shown to players.
- Session recordings, heatmaps, autocaptured clicks.
- A/B tests and feature flags.
- A consent banner — not needed while nothing is stored on the device; revisited if
  that ever changes.
- A per-user opt-out setting.
- Counting anonymous visitors across visits (a reload is a new visitor).
- Metrics derived from the database (e.g. total Box size) — the analytics service
  sees only events.
