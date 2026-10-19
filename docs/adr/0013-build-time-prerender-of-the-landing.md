# 13. Build-time prerender of the landing

Date: 2026-10-18

## Status

Accepted

## Context

The frontend is a single-page app served as static files from S3 behind CloudFront
([ADR-0009](0009-aws-deployment-and-ci-cd.md)). Every path, including tool URLs, is
answered with the same `index.html`, whose `#root` was empty
([ADR-0008](0008-client-side-routing-per-tool-urls.md)). The landing at `/`
([PRD 0023](../prd/0023-landing.md)) is the page search engines, link previews and AI
crawlers should read, but most crawlers do not run JavaScript, so they saw nothing.

Forces:

- There is no server for the frontend; anything generated must exist at build time.
- Both languages share one URL ([ADR-0004](0004-internationalization.md)); the active
  language comes from `localStorage` and then the browser, which a static file cannot know.
- The landing's stories animate with timers and respect `prefers-reduced-motion`; that
  code ran browser APIs during render.
- A visitor in Spanish, or one opening a tool URL, must not see the English landing
  flash before the app loads.

## Decision

We will prerender `/` at build time with React's own server renderer and hydrate it in
the browser:

- **Build:** after the client build, Vite builds a server bundle from
  `src/entry-server.tsx` (`renderToString` of the app at `/`), and
  `scripts/prerender.mjs` writes its HTML into `dist/index.html`'s `#root`, plus the FAQ
  as `FAQPage` JSON-LD in the `<head>`. The server bundle is never deployed. Any failure
  fails the build.
- **One prerendered language: English**, until each language has its own URL. The
  static `<head>` (`lang`, title, description, Open Graph) is English and names
  `https://sleepmon.app/` as canonical.
- **Hydrate only what matches.** An inline script at the top of `<head>` repeats the
  language detection; when the path is not `/` or the language is not English, it marks
  the document so the prerendered markup is hidden, and the client discards it and
  renders from scratch. Otherwise the client calls `hydrateRoot`.
- **Server-safe render.** Code rendered at `/` must not touch `window`, `document`,
  `localStorage` or `navigator` during render: browser state is read in effects, or
  through `useSyncExternalStore` with a server snapshot equal to what the server rendered.
  A test renders the entry in a Node environment (no DOM) and another hydrates its output,
  to catch regressions.

Rejected: a headless-browser snapshot (needs a browser in CI and captures a
mid-animation DOM that does not match React's first render); an SSR framework (a
framework switch for one page); a second empty shell for tool URLs served by a CloudFront
error page (same result, but a manual infrastructure change).

## Consequences

- Crawlers and previews read the landing's full text and FAQ without running JavaScript;
  English visitors see content before the bundle loads.
- `npm run build` gets two more steps; `deploy.yml` is unchanged.
- Every change to what renders at `/` (landing, app bar, footer, providers) must stay
  server-safe and render the same first frame on server and client; the Node render test
  and the hydration test enforce it.
- The language detection exists twice (the inline script and `detectLang`); a test keeps
  them in agreement.
- Spanish visitors and tool URLs still see a blank screen until the app loads, as before.
- Spanish copy is not indexed until per-language URLs exist; that change will revisit
  this record.
- A future Content Security Policy must allow the inline script and its hide rule (by
  hash); if the script is blocked every visitor falls back to hydration plus React's
  mismatch recovery, and if only the style is blocked the English landing flashes.
- Decorative images in the prerendered markup must be lazy, or browsers fetch them even
  while the markup is hidden.
