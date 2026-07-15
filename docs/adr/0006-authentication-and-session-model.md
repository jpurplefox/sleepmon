# 6. Authentication and session model

Date: 2026-07-14

## Status

Accepted

## Context

sleepmon is moving from a prototype toward production. Until now the team data
(the Box) is **global and shared** — there is no notion of a user, and a single
`team_member` table serves everyone. The [Authentication PRD](../prd/0010-authentication.md)
turns this into an app of **personal** data: each person signs in and owns their
Box, their teams, and everything they save.

The forces that shape the decision:

- **Product goal:** sign in with Google (only), stay signed in with a session that
  renews itself invisibly, and keep a strict **per-user isolation** of data.
- **Security was an explicit part of the request** ("that tokens expire and renew
  themselves, and improve security"), so the token model is judged on its exposure,
  not only on convenience.
- **The stack ([ADR-0001](0001-backend-technology-stack.md)) and hexagonal boundaries
  ([ADR-0002](0002-hexagonal-architecture.md)) stand:** the domain imports no
  infrastructure, the application depends on ports, queries are parameterized, and the
  frontend is the React/Vite SPA of [ADR-0003](0003-frontend-technology-stack.md).
- **The client is a browser SPA**, which makes token storage the central
  security question: any credential reachable by JavaScript is reachable by an XSS.

The choice is non-obvious in several places: how the OAuth handshake is shaped, where
each token lives, whether refresh is stateful, and how the isolation invariant is
enforced so it cannot be forgotten.

## Decision

We will build authentication as a cross-cutting layer with the following model.

**Google Identity, verified server-side.** The frontend uses Google Identity Services
to obtain a Google-signed **ID token** and posts it to the backend. The backend
**verifies** it server-side (Google JWKS; `aud == GOOGLE_CLIENT_ID`, `iss`, `exp`) via
`google-auth`, then registers or looks up the user by their Google `sub`. We do **not**
run an authorization-code/redirect flow.

**The backend issues its own tokens.** On a verified login it mints:

- A short-lived **access token** — a HS256 **JWT** (~15 min) carrying the user id.
  The frontend keeps it in `localStorage` and sends it as `Authorization: Bearer`.
  It is verified **statelessly** in an HTTP guard, with no database hit per request.
- A long-lived **refresh token** — an **opaque** random string (~30 days, an
  inactivity limit), **rotated** on every use, stored **hashed** (SHA-256) in a
  server-side store. It is delivered to the client in an **httpOnly, Secure,
  SameSite=Strict** cookie scoped to `/auth/refresh` — never in a response body, never
  readable by JavaScript.

**Refresh is stateful, with full reuse detection.** Every issued refresh token is
tracked (hashed) as a row in its **family** — the chain of tokens descending from one
login — and marked *consumed* when it is rotated out. Presenting an unconsumed token
rotates it (consume it, issue its successor); presenting an **already-consumed** token,
*any* token in the family's history, is treated as **theft** and revokes the **whole
family**; an unknown token is rejected. Silent renewal is a `401 → /auth/refresh →
retry` cycle in the frontend api client, single-flighted so concurrent 401s share one
refresh.

**Per-user isolation is threaded explicitly.** The authenticated `user_id` is passed
through the application use cases and the persistence **port** — it appears in the
method signatures, so a Box query cannot be written unscoped by accident. `team_member`
gains a `user_id` owner column; every Box read/write filters by it, and a `member_id`
that is not the caller's is treated as not-found.

**The gate lives at the HTTP boundary.** Reserved controllers (everything that reads or
writes the Box) carry a `require_user` guard; ephemeral and catalog controllers stay
open, matching the PRD's capability gate.

This decision **extends the dependency set of [ADR-0001](0001-backend-technology-stack.md)**
with `pyjwt` (our access tokens) and `google-auth` (ID-token verification); it does not
supersede that record — the stack it chose stands.

## Consequences

- **XSS cannot exfiltrate the long-lived credential.** The refresh token is httpOnly;
  the worst an XSS can do is act while the victim is on the page, not walk away with a
  30-day credential. We accept that the short-lived access token in `localStorage` is
  reachable by JS — a deliberate, bounded exposure, the pragmatic half of the SPA
  trade-off.
- **Sessions are revocable and renewal is invisible.** The server-side store gives us
  explicit sign-out, revocation, reuse detection, and an inactivity limit; rotation
  plus single-flight refresh keeps the user signed in without ever seeing a login again.
- **Stateless access checks stay cheap.** Verifying the access JWT needs no database,
  so guarding every reserved request costs a signature check, not a query.
- **The isolation invariant is visible in the types.** Because `user_id` is a required
  parameter, forgetting to scope a query is a type error, not a silent leak — at the
  cost of touching every `TeamRepository`/`TeamService` signature.
- **Reuse detection is complete within a family.** Replaying *any* previously-issued
  refresh token — not just the last one — revokes the whole login family, so a stolen
  token cannot yield a persistent session even if it is used long after the theft. The
  cost is a per-token store that grows with active use and needs periodic pruning of
  expired rows (expiry is enforced on use regardless, so pruning is housekeeping, not
  correctness).
- **We depend on Google as the only identity provider (v1)** and on two new libraries
  (`pyjwt`, `google-auth`). Adding another provider later is additive, but there is no
  username/password fallback today.
- **Clean slate.** Introducing the non-null `user_id` owner discards the prototype's
  global `team_member` rows; there is no migration of pre-auth data (per the PRD).
