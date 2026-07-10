# PRDs — sleepmon

One document per feature: its **purpose** and the **guidelines** it must respect
as it evolves — not the implementation detail, which lives in the code. The
cross-cutting **visual** direction lives in
[`docs/design-system.md`](../design-system.md); durable
**technical decisions** live in [`docs/adr/`](../adr/).

PRDs are **numbered, not dated** (`NNNN-<slug>.md`, e.g. `0001-exp-calculator.md`),
in the same style as the ADRs. Each is produced by the `design` skill.

<!-- index — one line per PRD, most recent last -->

- [0001 — Exp Calculator](0001-exp-calculator.md) — from a current and desired
  level, computes how many candies and dream shards it costs to level a Pokémon,
  with optional nature and candy-boost modifiers.
