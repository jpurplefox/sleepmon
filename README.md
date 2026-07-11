# sleepmon

A web app to manage your **Pokémon Sleep** team. Register each Pokémon with its
nature, sub skills, ingredients, level, ribbon and main skill, and see its **estimated
production** — and your team's — the same way the game rewards it: berries, ingredients,
skill effects, cooking, and Snorlax research strength.

## What you can do

- **Box** — your persistent team (the source of truth): one entry per Pokémon, with its
  estimated production and a coverage view of the berries, ingredients and specialties
  your team covers.
- **Comparison** — put up to five configurations side by side as a base plus deltas, to
  see which one yields more and why.
- **Team Analysis** — assemble a team, aggregate its daily/weekly production, plan the
  day's cooking, apply a map's bonuses, and read the Snorlax rating you reach there.
- **Bilingual** — full Spanish / English, including the official in-game terms.

## Tech stack

- **Backend** — Python ≥ 3.11, [Litestar](https://litestar.dev/), PostgreSQL via
  [psycopg3](https://www.psycopg.org/) directly (no ORM) with
  [PyPika](https://github.com/kayak/pypika) for query building. Hexagonal architecture.
- **Frontend** — React + TypeScript (Vite), TanStack Query, Recharts.
- **Infra** — Docker Compose (db + backend + frontend).

## Getting started

The quickest path is Docker — it brings up the database, backend and frontend together.

```bash
cp .env.example .env        # optional; the defaults work as-is
docker compose up --build
```

Then open:

- Frontend — <http://localhost:5173>
- Backend API — <http://localhost:8000>
- PostgreSQL — `localhost:5432`

## Local development

Run the pieces directly when iterating on one of them.

**Backend** (needs a PostgreSQL reachable at `DATABASE_URL` — see `.env.example`):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
python -m sleepmon.adapters.outbound.postgres.migrate
litestar --app sleepmon.adapters.inbound.http.app:create_app run --reload
```

Tests and quality gates:

```bash
pytest -m "not integration"   # domain + application + HTTP, no DB
pytest -m integration         # Postgres repository (needs the DB)
mypy src && ruff check .
```

Integration tests use a **dedicated** database whose name ends in `_test`
(`TEST_DATABASE_URL`); they create it if missing and only ever truncate tables there,
never in your dev database.

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

## Project structure

```
backend/    Litestar + hexagonal: domain (core rules, catalog) · application
            (use cases) · adapters (Postgres, HTTP). Tests split by layer.
frontend/   React app: the Box, Comparison and Team Analysis tools.
docs/       Product requirements (prd/), decision records (adr/), design system.
```

## Documentation

Product, technical and visual documentation lives in **[`docs/`](docs/)** — start at
[`docs/README.md`](docs/README.md) for how it's organized (what belongs in a PRD vs an
ADR, and where the visual language lives).
