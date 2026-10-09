# PRDs — sleepmon

One document per feature: its **purpose** and the **guidelines** it must respect
as it evolves — not the implementation detail, which lives in the code. The
cross-cutting **visual** direction lives in
[`docs/design-system.md`](../design-system.md); durable
**technical decisions** live in [`docs/adr/`](../adr/).

PRDs are **numbered, not dated** (`NNNN-<slug>.md`, e.g. `0001-exp-calculator.md`),
in the same style as the ADRs. Each is produced by the `design` skill.

<!-- index — one line per PRD, most recent last -->

- [0001 — Box](0001-box.md) — the persistent team record (source of truth) with a per-Pokémon production overview, sorting/filters, and berry/ingredient/specialty coverage.
- [0002 — Comparison](0002-comparison.md) — put up to 5 Pokémon side by side and read their estimated daily production as a base plus deltas; under shared map terms (Normal or an expert map, chosen favorite berries, weekly bonus); ephemeral, persisted to the Box only by explicit save.
- [0003 — Pokémon form](0003-pokemon-form.md) — the shared, catalog-driven modal for creating/editing a Pokémon config; reused by the Box, Comparison and Team Analysis, which own persistence.
- [0004 — Box picker](0004-box-picker.md) — the shared "My Pokémon" modal to find and recognize a saved Pokémon by its config and hand it to the calling tool; searchable, config-derived identity, agnostic of its caller.
- [0005 — Team Analysis](0005-team-analysis.md) — assemble a team of up to 5 slots (splittable) from Pokémon created on the spot or copied from the Box, edit them in place, and read the team's aggregated daily/weekly production and grand total; open to anyone, plus the Good Camp Ticket.
- [0006 — Cooking plan](0006-cooking-plan.md) — plan up to three daily meals, check ingredient balance against team output, fill the pot, and add cooking strength (with Extra Tasty) to the grand total.
- [0007 — Map bonuses & Snorlax rating](0007-map-bonuses-rating.md) — pick a research map to apply favorite-berry ×2 and an area bonus to all strength, and read the Snorlax research rating the team reaches there; on an **expert** map the favorites split into a main and two sub-favorites that reshape each member's production.
- [0008 — Production model](0008-production-model.md) — the shared estimate behind every number (help cadence, day/night, inventory, berry strength, skill triggers and effects, total strength); computed once in the domain, presented by the Box, Comparison, and Team Analysis.
- [0009 — Language](0009-language.md) — bilingual (ES/EN): a language switcher that localizes both the interface copy and the official game terms, remembers the choice, and defaults to the browser language.
- [0010 — Authentication](0010-authentication.md) — sign in with Google to own your data: a persistence-based capability gate (ephemeral tools open, Box-backed ones reserved), a contextual prompt that returns you to context, and an invisible self-renewing session; per-user isolation, clean slate over the prototype's data.
- [0011 — Player profile](0011-player-profile.md) — declare once, on your account, what you actually have in the game and how you play it: pot step, recipe levels, a favorite recipe per dish type, an area bonus per area, and your sleep schedule; Team Analysis starts from the progress values and offers to save back what you change there.
- [0012 — Event bonus](0012-event-bonus.md) — compose the active event's production effects by hand (extra ingredients/berries per help, skill trigger/level/ingredients, carry limit, dish strength, pot), each scoped to the team, a type, or a specialty; Team Analysis's aggregate recomputes with them. Ephemeral, same value all week.
- [0013 — Berry Burst](0013-berry-burst.md) — model the Berry Burst family (incl. Disguise and Draco Meteor): own berries plus each teammate's berry per trigger; valued in full in Team Analysis (each berry adds to its own type's row, skill share in a tooltip), and as a teammate berry count in Comparison and the Box.
- [0014 — Tool shell](0014-tool-shell.md) — the frame every tool shares: a fixed menu (name, tools with the current one marked, account with the language inside), a title-only header, a context bar whose chips show and change what shapes the numbers, and explanations only in the empty state.
- [0015 — Sleep schedule](0015-sleep-schedule.md) — your night sleep (8:30 by default) and an optional nap, saved in the Player profile and applied to every production number: each sleep fills and overflows on its own with its own skill cap; cards mark a fill time that overflows a sleep and read sleep skill chances per sleep.
- [0016 — Saved teams](0016-saved-teams.md) — name and keep Team Analysis line-ups (Box Pokémon in slots with their splits, the map, the meals) on your account; a fourth tool, Teams, lists, filters (map, dish type, Box Pokémon), opens, renames and deletes them; members follow the Box.
- [0017 — Usage metrics](0017-usage-metrics.md) — a curated catalogue of anonymous usage events (tools used, where Box Pokémon come from, Box vs. new in Comparison and Team Analysis, saved teams, list filters, the sign-in funnel, catalog gaps) sent to a product-analytics service; nothing personal, nothing stored on the device, invisible to players.
- [0018 — Account & privacy](0018-account-and-privacy.md) — delete your account from the account menu (typed-email confirmation, everything removed at once), a short public privacy page with the contact email, and a footer with the non-affiliation notice on every screen.
