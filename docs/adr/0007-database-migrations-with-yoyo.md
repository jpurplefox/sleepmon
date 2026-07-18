# 7. Database schema migrations with yoyo

Date: 2026-07-18

## Status

Accepted

## Context

The backend owns its PostgreSQL schema directly, with no ORM: psycopg3 and
hand-written SQL ([ADR 0001](0001-backend-technology-stack.md)). That ADR
knowingly accepted the loss of "automatic migrations" as part of the no-ORM
trade-off, but did not settle *how* schema changes are applied over time.

Until now the schema was a single idempotent `schema.sql` executed in full by a
hand-rolled runner at container start and in the integration-test fixture. It
leaned on `CREATE TABLE IF NOT EXISTS` plus inline `ALTER TABLE ... ADD COLUMN
IF NOT EXISTS` statements acting as pseudo-migrations, and even a guarded
`DO $$ ... DELETE $$` block to clear legacy rows before adding a `NOT NULL`
foreign key. This approach has real limits:

- **No history.** Nothing records which changes have been applied; every boot
  re-runs the whole file and infers state from `IF NOT EXISTS` guards.
- **No ordering or rollback.** Destructive or dependency-ordered changes can't
  be expressed safely, and there is no way to revert one.
- **Accumulating cruft.** Each evolution (the auth tables, the `team_member.
  user_id` column and its clean-slate delete) adds another conditional clause
  to a file that only grows and becomes harder to read.

We want migration tooling that stays consistent with ADR 0001: explicit,
hand-written, auditable SQL — not an ORM or a schema-diffing framework. It must
keep using psycopg3 (we do not want to pull in psycopg2) and preserve the
existing "apply at container boot and in the test fixture" workflow.

## Decision

We will manage the PostgreSQL schema with **[yoyo-migrations](https://ollycope.com/software/yoyo/)**.

- Migrations are **versioned SQL files** (each with a `.rollback.sql`
  counterpart) under
  `backend/src/sleepmon/adapters/outbound/postgres/migrations/`, applied in
  order. yoyo records what has been applied in its own `_yoyo_migration` table
  and applies only the pending ones.
- The runner (`migrate.py`) applies pending migrations programmatically via
  yoyo, forcing the **psycopg3 backend** by rewriting the DSN scheme to
  `postgresql+psycopg://`. It keeps its `run(dsn)` / `python -m ... migrate`
  entry points, so the Docker `CMD` and the integration-test fixture are
  unchanged.
- Migration `0001` is a **clean baseline** of the current schema (team +
  authentication) written as plain DDL with a rollback. Future schema changes
  are new numbered migrations; applied migrations are never edited.

## Consequences

- We gain ordered, recorded, reversible migrations, and can express destructive
  or dependency-ordered changes safely. The `IF NOT EXISTS` /
  `information_schema` scaffolding disappears from the schema definition.
- This stays within the ADR 0001 philosophy: still hand-written SQL, no ORM.
  yoyo is a thin runner over our own migration files, not a framework that owns
  the schema.
- We take on a new dependency (`yoyo-migrations`) and a small DSN-scheme
  translation to keep psycopg3 without adding psycopg2. yoyo ships no type
  stubs, so it needs a `mypy` override.
- Bug fixes to the schema ship as new migrations rather than edits to applied
  ones, which is more disciplined but slightly more verbose than editing a
  single file.
