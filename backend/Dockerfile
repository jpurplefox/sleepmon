FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Instalar dependencias primero para aprovechar la cache de capas.
COPY pyproject.toml ./
COPY src ./src
RUN pip install -e ".[dev]"

EXPOSE 8000

# Aplica el schema y arranca Litestar (factory). Hot-reload para desarrollo.
CMD ["sh", "-c", "python -m sleepmon.adapters.outbound.postgres.migrate && litestar --app sleepmon.adapters.inbound.http.app:create_app run --host 0.0.0.0 --port 8000 --reload"]
