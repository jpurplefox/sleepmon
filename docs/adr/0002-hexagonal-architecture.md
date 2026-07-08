# 2. Hexagonal architecture (ports and adapters)

Date: 2026-07-07

## Status

Accepted

## Context

[ADR-0001](0001-backend-technology-stack.md) settled the backend technology
stack (Litestar, PostgreSQL, psycopg3 + PyPika). It deliberately left the
question of *how the code is organized around that stack* to a separate
decision — this one.

The backend carries rich domain logic: value objects for the game's data
(natures, sub skills, ingredients), a curated species catalogue, and
aggregation rules for a team's distribution. We want that logic to be the
stable centre of the system, independent of the framework and database that
happen to serve it, and testable without spinning up either.

We also want the substrate to stay legible as it grows: clear boundaries
about what may depend on what, so that swapping an adapter (a different HTTP
framework, a different persistence backend) is a contained change rather than
a rewrite.

## Decision

We will structure the backend as a hexagonal (ports and adapters)
architecture, in three concentric layers:

- **Domain** (`domain/`): entities, value objects, game rules, the species
  catalogue, distribution logic, and the **ports** (abstract interfaces) it
  requires. The domain imports no infrastructure — not Litestar, not psycopg,
  not PyPika.
- **Application** (`application/`): use cases (`TeamService`) and DTOs. Depends
  only on the ports, never on concrete adapters.
- **Adapters**: outbound (`adapters/outbound/`) implements the ports —
  PostgreSQL persistence and the static catalogue; inbound
  (`adapters/inbound/http/`) exposes the application over HTTP with Litestar
  controllers and wires everything together in a composition root.

Dependencies point inwards only: adapters depend on the application, the
application depends on ports, and the domain depends on nothing outside
itself.

## Consequences

- The domain and application layers can be tested without a database or an
  HTTP server; only adapter tests need real infrastructure (marked
  `integration`). This keeps the bulk of the suite fast.
- Replacing an adapter is localized: swapping the web framework touches only
  the inbound HTTP adapter and the composition root; swapping persistence
  touches only the outbound adapter. The domain is untouched.
- We pay an indirection cost: ports must be defined and adapters wired
  explicitly, which is more ceremony than calling the framework or the driver
  directly. We accept this in exchange for the isolation above.
- The boundaries must be enforced by discipline (and review): an accidental
  import of infrastructure from the domain silently erodes the whole benefit.
