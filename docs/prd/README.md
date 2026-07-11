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
- [0002 — Comparison](0002-comparison.md) — put up to 5 Pokémon side by side and read their estimated daily production as a base plus deltas; ephemeral, persisted to the Box only by explicit save.
- [0003 — Pokémon form](0003-pokemon-form.md) — the shared, catalog-driven modal for creating/editing a Pokémon config; reused by the Box and Comparison, which own persistence.
- [0004 — Box picker](0004-box-picker.md) — the shared "My Pokémon" modal to find and recognize a saved Pokémon by its config and hand it to the calling tool; searchable, config-derived identity, agnostic of its caller.
- [0005 — Team Analysis](0005-team-analysis.md) — assemble a team of up to 5 slots (splittable) from the Box and read its aggregated daily/weekly production and grand total; the core of the Team Analysis page, plus the Good Camp Ticket.
- [0006 — Cooking plan](0006-cooking-plan.md) — plan up to three daily meals, check ingredient balance against team output, fill the pot, and add cooking strength (with Extra Tasty) to the grand total.
- [0007 — Map bonuses & Snorlax rating](0007-map-bonuses-rating.md) — pick a research map to apply favorite-berry ×2 and an area bonus to all strength, and read the Snorlax research rating the team reaches there.
- [0008 — Production model](0008-production-model.md) — the shared estimate behind every number (help cadence, day/night, inventory, berry strength, skill triggers and effects, total strength); computed once in the domain, presented by the Box, Comparison, and Team Analysis.
- [0009 — Language](0009-language.md) — bilingual (ES/EN): a language switcher that localizes both the interface copy and the official game terms, remembers the choice, and defaults to the browser language.
