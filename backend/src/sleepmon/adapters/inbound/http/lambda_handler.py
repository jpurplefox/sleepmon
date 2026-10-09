"""AWS Lambda entrypoint: adapts the Litestar ASGI app for API Gateway / Function URL.

Mangum translates the Lambda proxy event into an ASGI scope and back. ``create_app``
is a *factory*, so it is called once here (at cold start) to build the real stack —
the DB pool and secrets are read from the environment then, exactly as under uvicorn.

``lifespan="off"``: Litestar's shutdown hooks (the pool ``close``) never fire under
Lambda's freeze/thaw model anyway; the pool lives for the container's lifetime.

One DB connection per instance: Lambda hands an instance a single request at a time,
so a bigger pool would only hold idle connections on the shared RDS (with reserved
concurrency N, sleepmon never holds more than N).

``flush_after`` sends queued Sentry events before the runtime freezes (ADR-0010).

Deployed via ``Dockerfile.lambda``; the CMD points at ``…lambda_handler.handler``.
"""

from __future__ import annotations

from dataclasses import replace

from mangum import Mangum

from sleepmon.adapters.inbound.http.app import create_app
from sleepmon.adapters.inbound.http.observability import flush_after
from sleepmon.config import Settings

# Sentry queues events in memory; flush before Lambda freezes the runtime.
app = create_app(settings=replace(Settings.from_env(), db_pool_size=1))
# Litestar is a valid ASGI app; mangum's structural ASGI protocol just types the
# receive/send callables differently.
handler = flush_after(Mangum(app, lifespan="off"))  # type: ignore[arg-type]
