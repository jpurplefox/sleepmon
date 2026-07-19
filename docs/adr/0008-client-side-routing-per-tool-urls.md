# 8. Client-side routing with per-tool URLs

Date: 2026-07-19

## Status

Accepted

## Context

The frontend ([ADR 0003](0003-frontend-technology-stack.md)) shipped as a
single-page app whose three tools — Box, Comparison and Team analysis — were
switched by a `useState` tab in `App.tsx`. The URL never changed, so a tool
could not be opened, bookmarked or shared directly, the browser back/forward
buttons did nothing, and a reload always dropped the user back on the first tab.

We want each tool reachable at its own URL. The forces shaping the choice:

- The repo favours a small, legible dependency set and has hand-rolled
  cross-cutting concerns before rather than pulling a heavy library (the custom
  i18n of [ADR 0004](0004-internationalization.md)). A full router framework
  would be oversized for three routes.
- The app is served by the Vite dev server (locally and in the Docker image),
  which falls back to `index.html`, so History-API URLs (no `#`) work without
  extra server config today.
- Auth gating is **per-panel**, not a single wrapper: Comparison is public,
  while Box and Team analysis render a sign-in prompt (`GateCard`) in place —
  they do not redirect. Routing must preserve that.
- One cross-tool hand-off exists: "Compare" from the Box opens Comparison with
  the picked Pokémon as its base.

## Decision

We will introduce **client-side routing with [wouter](https://github.com/molefrog/wouter)** (~2 KB, hook-based).

- **One route per tool**, with English, language-neutral slugs (UI labels stay
  bilingual via i18n). Unmatched paths (including `/`) fall back to a default
  tool.
- The tab bar becomes a `<nav>` of links; the active item is derived from the
  current path (`aria-current="page"`) instead of tablist selection.
- **Per-panel gating is preserved**: reserved tools render `GateCard` in place
  (no redirect); Comparison stays public.
- **Ephemeral page state is not URL-encoded** — deliberately deferred. Existing
  cross-tool behaviour (e.g. the Box → Comparison base hand-off) is preserved.

## Consequences

- Each tool is directly linkable, bookmarkable and shareable, and browser
  back/forward and reload now behave as expected.
- The dependency stays tiny and in the spirit of the frontend stack; wouter is a
  thin set of hooks, not a framework that owns the app.
- Navigation semantics move from an ARIA `tablist`/`tab` pattern to a navigation
  landmark with links and `aria-current`; the tablist's roving-tabindex
  arrow-key behaviour is dropped in favour of standard link tabbing.
- History-API URLs rely on the server serving `index.html` for unknown paths.
  This holds for the Vite dev server we use now; a future static/production host
  would need the same SPA fallback (or a configured `base`).
- Ephemeral page state (the comparison base, a team-analysis configuration) is
  not yet URL-backed, so deep links land on a tool's default state. Making that
  state shareable is a possible future enhancement, not part of this decision.
