# 0010. Observability: error monitoring and product analytics

Date: 2026-10-09

## Status

Accepted

## Context

sleepmon is about to be made public. Today the app has no observability at all:

- **Errors are invisible.** The frontend `ErrorBoundary` only writes to
  `console.error`; API failures surface as per-component messages; the backend
  runs on AWS Lambda ([ADR-0009](0009-aws-deployment-and-ci-cd.md)), where an
  exception is only a line in CloudWatch. Nobody learns that something broke
  unless a player reports it.
- **Usage is unknown.** [PRD-0017](../prd/0017-usage-metrics.md) defines the
  questions the maintainer wants answered (tool mix, where Box Pokémon come from,
  Box vs. new in Comparison and Team Analysis, saved teams, the sign-in funnel)
  as a curated catalogue of usage events.

Forces at play:

- **Two different concerns.** Error/performance monitoring and product analytics
  are read by the same person but answer different questions, have different
  sampling needs (every error vs. every meaningful action), and are best served
  by specialised tools.
- **Cost.** The project is a low-traffic hobby app; both services must fit a free
  tier. Sentry's free plan covers errors and a sampled share of traces;
  PostHog Cloud's free tier covers 1M events a month.
- **Privacy, with no consent banner.** Players sign in with Google
  ([ADR-0006](0006-authentication-and-session-model.md)). Neither service may
  receive an email, a name, a Google identity, or free text the user typed
  (team names included). Avoiding a consent banner requires that analytics
  stores nothing on the device (no cookies, no local storage).
- **Lambda's freeze/thaw model.** Events buffered in memory at the end of an
  invocation are lost unless flushed before the runtime freezes.
- **Architecture.** The backend is strictly hexagonal
  ([ADR-0002](0002-hexagonal-architecture.md)): the domain and application must
  not know about any monitoring SDK. On the frontend, PRD-0017's catalogue must
  stay stable and typed, not scattered as string literals.
- **Forks and local development** must work with no keys at all, sending nothing.

## Decision

We will use **Sentry for error and performance monitoring** and **PostHog for
product analytics**, each configured from the environment and disabled when its
key is absent.

**Sentry (frontend and backend)**

- Frontend: `@sentry/react`, initialised in `main.tsx`; the `ErrorBoundary`
  reports what it catches. Backend: `sentry-sdk` with its Litestar integration,
  initialised in the composition root (`app.py`); the Lambda entry point
  (`lambda_handler.py`) wraps the handler in an explicit flush (`flush_after`)
  so queued events are sent before the runtime freezes. The domain and
  application layers never import it.
- **Every error is reported; traces are sampled**, at a rate set per
  environment by configuration and tuned to traffic. Browser traces
  propagate to the API (`sentry-trace` / `baggage` headers, allowed by CORS), so
  a slow request reads as one trace across the frontend, the Lambda and its
  cold start.
- **Releases are the git commit SHA**, set in CI for both apps. Frontend source
  maps are uploaded to Sentry during the build and **not deployed** to S3.
- **No PII:** `send_default_pii` off; `Authorization`, cookies, request bodies
  and stack-frame local variables are not sent; in the browser, DOM (`ui.*`)
  breadcrumbs and INP spans are off, since both carry element labels (display
  names, team names). The only user attribute is the account's **internal
  opaque id**. Sentry Session Replay is not enabled.
- Hosted in Sentry's **EU** region.

**PostHog (frontend only)**

- `posthog-js` against **PostHog Cloud US** (the region the project lives in; the ingest host is configurable via `VITE_POSTHOG_HOST`), with **in-memory persistence**: no
  cookies or local storage, so an anonymous identity lasts for the open tab.
- **Identity:** PostHog starts once the session check settles. Signed in, it
  starts already identified by the **internal opaque user id** (bootstrapped), so
  a reload does not mint a new anonymous id to merge into the person; signed
  out, it starts with a random per-tab anonymous id (never stored). A sign-in within the tab calls `identify` (merging
  the tab's anonymous events into the account); sign-out calls `reset`. Every
  event carries `signed_in`, `language` and the release.
- **Only the curated catalogue is sent.** Autocapture, automatic pageviews,
  session recording, heatmaps, dead clicks, exception and web-vitals capture,
  surveys, conversations, product tours, feature flags and external script
  loading are off in code, so project settings on the server cannot switch them
  on; a `before_send` allowlist drops any event outside the catalogue (except
  PostHog's own `$identify`). Tool views are sent explicitly by the router as
  `tool_viewed`.
- Components never call PostHog directly: they call a single typed `track`
  function whose event names and properties are a closed TypeScript union
  mirroring PRD-0017. Tests replace it with a recorder.
- Events are sent only from the frontend. The backend does not talk to PostHog;
  writes it performs are reported by the frontend after they succeed.

**Configuration**

- Backend: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`,
  plus `SENTRY_RELEASE` injected by CI.
- Frontend (build-time): `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`,
  `VITE_SENTRY_TRACES_SAMPLE_RATE`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`,
  plus the release (`VITE_RELEASE`) injected by CI. The Sentry auth token
  for source-map upload is a CI secret only.
- An empty value disables the corresponding SDK entirely.
- PostHog project setting (deploy prerequisite): **Discard client IP data** must be
  on. The SDK cannot stop the ingest from recording the client IP, and the privacy
  page ([PRD-0018](../prd/0018-account-and-privacy.md)) states that the analytics
  tool does not store IP addresses; that claim holds only with this setting on.

## Consequences

- Production errors on both sides reach the maintainer with stack traces mapped
  to source and tagged with the release that introduced them; Lambda latency and
  cold starts become visible.
- Usage questions are answered by PostHog's own insights, funnels and retention
  — no dashboards or event storage to build or operate.
- Two more third-party services, two more SDKs, and two sets of keys to
  provision for each environment. Sentry is loaded up front (it must catch
  startup errors) and adds about 55 kB gzipped to the main bundle (234 → 289 kB
  as measured at introduction); PostHog (about 107 kB gzipped) is a separate
  chunk fetched only when a key is configured, after the session check.
- Cookieless analytics means **anonymous visitors cannot be counted across
  visits** (a reload is a new visitor); retention is meaningful only for
  signed-in accounts. Accepted in exchange for needing no consent banner.
- Ad blockers will drop a share of analytics and browser error events; numbers
  are directional, not exact. The app's behaviour must never depend on either
  SDK succeeding.
- Frontend-only analytics means an action is counted when the browser saw it
  succeed. A write that succeeds server-side after the browser gave up is not
  counted — acceptable for usage trends.
- Every new feature must extend the `track` union alongside PRD-0017's
  catalogue; the type system makes a misspelled event or property a build error.
- Backend tracing adds a small per-request overhead and requires the CI release
  to be passed to the Lambda's environment.
