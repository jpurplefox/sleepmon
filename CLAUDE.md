# sleepmon

Sandbox para experimentar con **loop engineering** usando el tooling de Claude Code.

## Qué es esto

Un proyecto Python mínimo (`src/sleepmon`) que sirve de sustrato: tiene la lógica
justa para que valga la pena auditarlo, refactorizarlo o ampliarlo **en bucle**.
El objetivo no es el código de sueño en sí, sino practicar los loops.

## Stack

- Python ≥ 3.11, sin dependencias de runtime.
- Dev: `pytest`, `ruff`.

## Comandos

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

pytest          # tests
ruff check .    # lint
```

## Estructura

- `src/sleepmon/analyzer.py` — lógica de análisis (el sustrato).
- `tests/` — pytest.
- `.claude/agents/` — subagentes custom para los loops.
- `.claude/workflows/` — scripts de orquestación multi-agente.
- `docs/loop-engineering.md` — guía de las 4 herramientas de loop.

## Convenciones

- Type hints estrictos, dataclasses frozen donde aplique.
- Cada cambio de comportamiento lleva su test.
