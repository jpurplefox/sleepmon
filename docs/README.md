# sleepmon docs

This directory holds the durable knowledge about sleepmon — **what** it does, **why**
it's built the way it is, and **how** it looks. Implementation detail is not here: it
lives in the code. These docs are the layer above it, the part that doesn't fall out
of reading the source.

## Layout

- **[`prd/`](prd/)** — **Product Requirements.** One numbered doc per feature (or
  shared building block): its purpose, scope, behavior, and the guidelines it must
  keep respecting as it evolves. The *what*, not the *how*. Start at
  [`prd/README.md`](prd/README.md).
- **[`adr/`](adr/)** — **Architecture Decision Records.** Cross-cutting or recurring
  technical decisions, in the lightweight [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions.html)
  format (Title / Status / Context / Decision / Consequences). Start at
  [`adr/README.md`](adr/README.md).
- **[`design-system.md`](design-system.md)** — the **visual language** ("Luz de
  luna"): the identity and the reusable tokens/components that implement it.

## PRD vs ADR — which goes where

The rule of thumb, so there's no doubt:

- A **feature** — what a user can do, and the guidelines around it — is a **PRD**. One
  per feature or shared building block. A PRD carries the plain-language mechanics of a
  calculation when that behavior is user-facing, but never code.
- A **cross-cutting or recurring technical decision** — one that applies to, or
  affects, more than one feature (the stack, the hexagonal architecture, the i18n
  approach) — is an **ADR**.
- A decision or calculation that lives in a **single** feature is **just code**; its
  user-facing behavior belongs in that feature's PRD, not an ADR.
- The **visual identity** is the **design system**.

## Conventions

- **PRDs are numbered, not dated** (`NNNN-slug.md`), like ADRs; a number is never
  reused. The index lives in [`prd/README.md`](prd/README.md).
- **ADRs are immutable once Accepted.** A decision that changes is captured by a *new*
  ADR that supersedes the old one (wholly or partially); the old record's `Status`
  points forward and its `Decision` is never rewritten — the log is history. Copy
  [`adr/0000-template.md`](adr/0000-template.md) to start one.
- **The *what*, not the *how*.** Product docs describe behavior and intent; the
  implementation is the code. If a doc needs the implementation to make sense, its
  scope needs work.

## Authoring

PRDs are usually drafted with the `design` skill and ADRs with the `adr` skill, but
any maintainer can add one by hand following the existing docs and the ADR template.
Keep each doc's sibling index (`prd/README.md`, `adr/README.md`) in sync when adding
one.
