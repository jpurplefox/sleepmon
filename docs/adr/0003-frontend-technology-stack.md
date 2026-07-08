# 3. Frontend technology stack

Date: 2026-07-07

## Status

Accepted

## Context

sleepmon's frontend is a single-page web application: a team page with a
catalogue-driven form (a Pokémon's nature, sub skills and ingredients depend
on the species) and charts that visualize the team's aggregated distribution.

[ADR-0001](0001-backend-technology-stack.md) covered the backend stack; this
record does the same for the frontend. The forces that shaped the choice:

- The UI is driven by data fetched from the backend (the species catalogue,
  the team, the distribution). Server state — caching, invalidation, loading
  and error states — is the dominant concern, more than local UI state.
- The core deliverable includes distribution charts, so charting is a
  first-class need.
- We want a small, legible dependency set that is cheap to keep current,
  matching the seriousness with which the backend is maintained.

## Decision

We will build the frontend on the following stack:

- **Language:** TypeScript.
- **UI library:** React 18.
- **Build tool / dev server:** Vite.
- **Server state:** TanStack Query, as the single source of truth for
  backend data (fetching, caching, invalidation).
- **Charts:** Recharts.
- **Styling:** plain CSS, with no CSS framework or CSS-in-JS library.

## Consequences

- Server data has one consistent handling path through TanStack Query;
  caching and invalidation are not reinvented per view.
- Plain CSS keeps the styling surface transparent and dependency-free, at the
  cost of the conveniences (scoping, design tokens) that a framework would
  provide; we accept this while the UI is small.
- Recharts covers our charting needs out of the box; a substantially more
  custom visualization could eventually strain it and warrant a reassessment.
