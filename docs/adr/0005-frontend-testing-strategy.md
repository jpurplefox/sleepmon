# 5. Frontend testing strategy

Date: 2026-07-13

## Status

Accepted

## Context

The frontend, chosen in [ADR-0003](0003-frontend-technology-stack.md), is not
purely presentational: several small modules compute user-facing results —
estimated ingredient production, the Snorlax rating, cooking-pot capacity and
recipe math — and the team form is catalogue-driven, so a Pokémon's available
natures, sub skills and ingredients depend on its species. A regression in that
logic is not caught by TypeScript and reaches the user directly.

The backend already establishes the project's stance: *every behavior change
ships with its test*. This record defines how that stance is realized on the
frontend and with which tools.

The forces shaping the choice:

- The build runs on **Vite** (ADR-0003), so the test runner reuses that
  toolchain and config rather than introducing a parallel one.
- The behaviour worth protecting is the calculation logic and the
  catalogue-driven form, not the many presentational components.
- We keep a small, legible dependency set, consistent with the rest of the
  project.

## Decision

The frontend is tested with:

- **Test runner:** **Vitest**, reusing the existing Vite configuration.
- **Component testing:** **React Testing Library** on a **jsdom** environment,
  with `@testing-library/user-event` for interactions.

The convention *every behavior change ships with its test* applies to the
frontend as it does to the backend. Its scope on the frontend is:

- **Logic modules are tested** — the pure functions that compute user-facing
  results (ingredient production, Snorlax rating, cooking-pot and recipe math,
  formatting) have unit tests.
- **Meaningful interactive behaviour is tested** — the catalogue-driven form
  and its dependent selects have integration-style tests covering how a
  species drives the available natures, sub skills and ingredients.
- **Purely presentational components are not tested** — components whose only
  job is markup (badges, icons, placeholders) are verified by review, not by
  tests.

End-to-end browser automation (e.g. Playwright) is **not** part of this stack.
Introducing it is a separate decision, recorded as its own ADR if and when
cross-view flows justify the maintenance cost.

## Consequences

- User-facing calculations and the form's catalogue behaviour carry a
  regression safety net that TypeScript alone does not provide, at negligible
  runtime cost.
- The test toolchain stays within the Vite ecosystem: one config, no second
  build pipeline to maintain.
- Scoping tests to logic and meaningful interaction keeps the suite focused;
  the trade-off is that pure-markup regressions are caught by review, not by
  tests.
- Without an E2E layer, full-page cross-view flows are not covered by automated
  browser tests; this is accepted until a future ADR decides otherwise.
- A testing dependency set (Vitest, React Testing Library, jsdom,
  user-event) and a `test` script are part of the frontend.
