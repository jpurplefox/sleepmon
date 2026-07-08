# Architecture Decision Records

This directory records the significant architectural decisions made on
sleepmon, using the lightweight [Nygard ADR](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions.html)
format: **Title / Status / Context / Decision / Consequences**.

## Conventions

- One decision per file, named `NNNN-kebab-case-title.md` with an incremental
  four-digit number that is never reused. A "decision" may be a single choice
  or a cohesive set of tightly related ones — for example, the initial backend
  stack (language, web framework, database library, tooling) is recorded as one
  ADR.
- Once a record is **Accepted** it is immutable. A decision that changes is
  captured by a new ADR that supersedes the old one — wholly, or **partially**
  when only one piece of a bundled record changes (e.g. swapping just the web
  framework). The superseded record's `Status` is updated to point forward, but
  its `Decision` is never rewritten or deleted — the log is history.
- Copy [`0000-template.md`](0000-template.md) to start a new record.

## Index

| ADR | Title | Status |
| --- | ----- | ------ |
| [0001](0001-backend-technology-stack.md) | Backend technology stack | Accepted |
| [0002](0002-hexagonal-architecture.md) | Hexagonal architecture (ports and adapters) | Accepted |
| [0003](0003-frontend-technology-stack.md) | Frontend technology stack | Accepted |
