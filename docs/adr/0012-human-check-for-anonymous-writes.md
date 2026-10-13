# 12. Cloudflare Turnstile as the human check for anonymous writes

Date: 2026-10-13

## Status

Accepted

## Context

Until now every write to the database came from a signed-in user ([ADR
0006](0006-authentication-and-session-model.md)): the account was both the owner of the
data and the natural limit on abuse. [PRD 0020](../prd/0020-share-comparison.md) changes
that: anyone can create a shared comparison link without an account, and each link stores
a copy of the comparison plus an image ([ADR 0011](0011-shareable-links-with-previews.md)).
An open, unauthenticated write invites scripts to fill the shared RDS instance.

Forces at play:

- The check must not add friction for people: sharing happens mostly from a phone, in
  the middle of a conversation.
- sleepmon promises little tracking: no advertising cookies, usage metrics that store
  nothing in the browser (PRD 0018, [ADR 0010](0010-observability-error-monitoring-and-product-analytics.md)).
- Low traffic and cost sensitivity: a paid tier is not justified.
- The domain stays free of infrastructure ([ADR 0002](0002-hexagonal-architecture.md)).

Options considered:

- **Cloudflare Turnstile** — free, usually invisible (a challenge appears only for
  suspicious traffic), no tracking cookies, a yes/no verdict.
- **Google reCAPTCHA v3** — invisible and free up to a volume, but loads Google scripts
  and cookies on the page, returns a score to threshold, and its data use must be stated
  in the privacy policy.
- **hCaptcha** — privacy-friendly, but its free tier shows image challenges more often.

## Decision

We will use **Cloudflare Turnstile** as the human check for anonymous writes.

- The client loads the Turnstile script **lazily**, only when a signed-out user performs
  a protected write, and renders the widget with `appearance: "interaction-only"`. The
  token travels with the request.
- The server verifies the token with Turnstile's `siteverify` endpoint behind a
  **`HumanVerifier` port**; the adapter uses the standard library (`urllib`, 5 s timeout).
  A failed check answers **403**; an unreachable provider, **503**. Tokens are single-use,
  so a retry fetches a new one.
- **Signed-in users skip the check**: their account already owns and bounds what they write.
- Configuration: `TURNSTILE_SECRET_KEY` (backend) and `VITE_TURNSTILE_SITE_KEY`
  (frontend). Empty means anonymous protected writes are **off**: the server refuses
  them and the client asks the user to sign in. An anonymous write is never accepted
  without a check.

## Consequences

- Anonymous sharing has abuse protection with no visible step for almost everyone, and
  the same port serves any future anonymous write.
- A new runtime dependency: the Lambda must reach `challenges.cloudflare.com`, and an
  outage there turns anonymous writes into a 503 (signed-in writes are unaffected).
- The privacy page names Cloudflare's verification for signed-out links.
- Two more secrets to configure per environment; local development uses Cloudflare's
  published test keys, or leaves them empty and signs in.
- Turnstile's verdict is all we keep: no score, no per-IP limits of our own. If abuse
  gets past it, a per-IP or daily cap is the next step.
