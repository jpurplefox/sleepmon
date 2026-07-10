# sleepmon

Gestor web de tu **equipo en Pokémon Sleep**, usado también como sandbox de
**loop engineering** con el tooling de Claude Code.

## Qué es esto

Una app full-stack para registrar los Pokémon de tu equipo —con su **naturaleza**,
sus **sub skills** y sus **ingredientes**— y ver la **distribución agregada** del
equipo. El backend es un sustrato realista (arquitectura hexagonal, validación de
dominio rica) sobre el que practicar loops: auditarlo, refactorizarlo o ampliarlo
en bucle.

## Stack

- **Backend**: Python ≥ 3.11, **Litestar**, **PostgreSQL** con **psycopg3** directo
  (sin ORM) y **PyPika** para construir queries. Arquitectura **hexagonal** + SOLID.
- **Frontend**: **React** + TypeScript (Vite), TanStack Query, Recharts.
- **Infra**: Docker Compose (db + backend + frontend).
- Dev backend: `pytest`, `ruff`, `mypy` (strict).

## Comandos

```bash
# Todo el stack
docker compose up --build         # db + backend(:8000) + frontend(:5173)

# Backend (local)
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest -m "not integration"   # dominio + aplicación + HTTP (sin DB)
pytest -m integration         # repo Postgres (necesita la DB del compose)
mypy src && ruff check .

# Frontend (local)
cd frontend && npm install && npm run dev
```

## Estructura

- `backend/src/sleepmon/domain/` — núcleo: entidades, value objects (enums del
  juego), reglas (`catalog_data.py`), catálogo de especies (`species.py`),
  puertos (`ports.py`), distribuciones (`analytics.py`). **No importa
  infraestructura.**
- `backend/src/sleepmon/application/` — casos de uso (`TeamService`) + DTOs.
  Depende solo de los puertos.
- `backend/src/sleepmon/adapters/outbound/` — Postgres (psycopg + PyPika) y
  catálogo estático.
- `backend/src/sleepmon/adapters/inbound/http/` — controllers Litestar +
  composition root (`app.py`).
- `backend/tests/` — `domain/`, `application/`, `http/` (sin DB) e `integration/`
  (Postgres, marcados `integration`).
- `frontend/src/` — app React (Team page, formulario dependiente del catálogo,
  gráficos de distribución).
- `.claude/agents/`, `.claude/workflows/` — tooling de loops apuntando al backend.

## Convenciones

- **Hexagonal estricto**: el dominio no conoce Litestar/psycopg/pypika; la
  aplicación depende de abstracciones (puertos), no de implementaciones.
- Type hints estrictos (mypy strict), dataclasses frozen donde aplique, enums
  cerrados para los datos del juego.
- Queries siempre parametrizadas (placeholders `%s` de psycopg); nunca interpolar
  datos del usuario.
- Cada cambio de comportamiento lleva su test.
- El catálogo de especies (`domain/species.py`) es un subconjunto curado v1;
  ampliarlo/corregirlo es agregar entradas.
