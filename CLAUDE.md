# sleepmon

A web app to manage your **Pokémon Sleep** team: register each Pokémon with its
**nature**, **sub skills**, and **ingredients**, and see the team's **aggregate
distribution** and estimated production.

## Stack

- **Backend**: Python ≥ 3.11, **Litestar**, **PostgreSQL** via **psycopg3**
  directly (no ORM) with **PyPika** for building queries. **Hexagonal** + SOLID.
- **Frontend**: **React** + TypeScript (Vite), TanStack Query, Recharts.
- **Infra**: Docker Compose (db + backend + frontend).
- Backend dev: `pytest`, `ruff`, `mypy` (strict).

## Commands

```bash
# Whole stack
docker compose up --build         # db + backend(:8000) + frontend(:5173)

# Backend (local)
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest -m "not integration"   # domain + application + HTTP (no DB)
pytest -m integration         # Postgres repo (needs the compose DB)
mypy src && ruff check .

# Frontend (local)
cd frontend && npm install && npm run dev
```

## Structure

- `backend/src/sleepmon/domain/` — core: entities, value objects (game enums),
  rules (`catalog_data.py`), species catalog (`species.py`), ports (`ports.py`),
  distributions (`analytics.py`). **Does not import infrastructure.**
- `backend/src/sleepmon/application/` — use cases (`TeamService`) + DTOs. Depends
  only on the ports.
- `backend/src/sleepmon/adapters/outbound/` — Postgres (psycopg + PyPika) and the
  static catalog.
- `backend/src/sleepmon/adapters/inbound/http/` — Litestar controllers +
  composition root (`app.py`).
- `backend/tests/` — `domain/`, `application/`, `http/` (no DB) and `integration/`
  (Postgres, marked `integration`).
- `frontend/src/` — React app (team editing, catalog-driven form, distribution
  charts).
- `docs/` — `prd/` (product requirements, one numbered doc per feature), `adr/`
  (architecture decision records), `design-system.md` (the visual language),
  `specs/` (design records).

## Conventions

- **Strict hexagonal**: the domain knows nothing of Litestar/psycopg/pypika; the
  application depends on abstractions (ports), not implementations.
- Strict type hints (mypy strict), frozen dataclasses where applicable, closed
  enums for game data.
- Queries are always parameterized (psycopg `%s` placeholders); never interpolate
  user data.
- Every behavior change ships with its test.
- The species catalog (`domain/species.py`) is a curated v1 subset; extending or
  fixing it means adding entries.
- New docs and code are written in **English** (the repo is migrating from Spanish).
- Product decisions live in `docs/prd/`, technical decisions in `docs/adr/`, and
  the visual language in `docs/design-system.md`. Session scaffolding (plans,
  architecture, visual specs) stays in the scratchpad, not the repo; skills never
  commit on their own.
