"""AWS Lambda entrypoint: adapts the Litestar ASGI app for API Gateway / Function URL.

Mangum translates the Lambda proxy event into an ASGI scope and back. ``create_app``
is a *factory*, so it is called once here (at cold start) to build the real stack —
the DB pool and secrets are read from the environment then, exactly as under uvicorn.

``lifespan="off"``: Litestar's shutdown hooks (the pool ``close``) never fire under
Lambda's freeze/thaw model anyway; the pool lives for the container's lifetime.

Deployed via ``Dockerfile.lambda``; the CMD points at ``…lambda_handler.handler``.
"""

from __future__ import annotations

from mangum import Mangum

from sleepmon.adapters.inbound.http.app import create_app

handler = Mangum(create_app(), lifespan="off")
