"""AWS Lambda entrypoint: adapts the Litestar ASGI app for API Gateway / Function URL.

Mangum translates the Lambda proxy event into an ASGI scope and back. ``create_app``
is a *factory*, so it is called once here (at cold start) to build the real stack —
the DB pool and secrets are read from the environment then, exactly as under uvicorn.

``lifespan="off"``: Litestar's shutdown hooks (the pool ``close``) never fire under
Lambda's freeze/thaw model anyway; the pool lives for the container's lifetime.

``flush_after`` sends queued Sentry events before the runtime freezes (ADR-0010).

Deployed via ``Dockerfile.lambda``; the CMD points at ``…lambda_handler.handler``.
"""

from __future__ import annotations

from mangum import Mangum

from sleepmon.adapters.inbound.http.app import create_app
from sleepmon.adapters.inbound.http.observability import flush_after

# Sentry queues events in memory; flush before Lambda freezes the runtime.
handler = flush_after(Mangum(create_app(), lifespan="off"))
