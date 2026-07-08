# 1. Backend technology stack

Date: 2026-07-07

## Status

Accepted

## Context

sleepmon is a full-stack web application for managing a Pokémon Sleep team:
registering each Pokémon with its nature, sub skills and ingredients, and
viewing the aggregated distribution of the team.

The backend is treated as a codebase we intend to maintain and evolve
seriously: it must be a domain-rich, strictly typed substrate that is cheap
to test and easy to reason about, not a throwaway CRUD layer.

We need to choose the language, the web framework, the database, the
persistence layer, and the quality tooling. The forces that shaped the
choice:

- Rich domain modelling (value objects, closed enums, frozen dataclasses)
  under strict static typing.
- Fast, database-less testing of the domain and application layers.
- Full, transparent control over SQL: the schema is small and
  well-understood, and we value auditability over ORM convenience.
- A codebase that stays legible and teachable as it grows.

## Decision

We will build the backend on the following stack:

- **Language:** Python ≥ 3.11, type-checked with `mypy --strict`.
- **Web framework:** Litestar, for its first-class typing and dependency
  injection.
- **Database:** PostgreSQL.
- **Persistence:** psycopg3 used directly, with no ORM, and PyPika to build
  queries. Every query is parameterized with psycopg `%s` placeholders; user
  data is never interpolated.
- **Quality tooling:** pytest (with an `integration` marker separating
  Postgres-backed tests from pure ones), ruff for linting and formatting, and
  mypy in strict mode.

## Consequences

- We write and maintain SQL by hand. Queries stay explicit and auditable, at
  the cost of ORM conveniences (identity map, lazy loading, automatic
  migrations).
- Choosing psycopg3 + PyPika over SQLAlchemy trades a large feature set for a
  smaller, more transparent surface — a deliberate fit for a codebase we want
  to keep legible.
- Strict typing plus Litestar's dependency injection push us toward clean
  port/adapter boundaries and let the domain be tested without a database.
- Committing to PostgreSQL-specific behaviour may make swapping databases
  costlier later; we accept this, as it is our only target.
