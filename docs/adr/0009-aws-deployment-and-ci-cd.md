# 0009. AWS deployment and CI/CD

Date: 2026-07-21

## Status

Accepted

## Context

Until now sleepmon only ran locally via Docker Compose (db + backend + frontend).
It needs a hosted deployment. A sibling project (`whos-that`) shares almost the
entire stack — Litestar backend, PostgreSQL with yoyo migrations, a Vite/React
frontend, Google OAuth + JWT sessions — and already runs on AWS with automatic
deploys from GitHub Actions. Reusing that proven topology is cheaper than
designing a new one.

Forces at play:

- **Cost.** The app is low-traffic. A serverless backend that scales to zero
  avoids paying for an idle server. The one cost that is not serverless is the
  database; an RDS instance already exists for `whos-that` and is not saturated.
- **Backend shape.** Litestar is an ASGI app. AWS Lambda does not speak ASGI, so
  an adapter is required to bridge the Lambda proxy event to ASGI.
- **Migrations.** The schema is versioned with yoyo (see
  [ADR-0007](0007-database-migrations-with-yoyo.md)); applying it must be part of
  the deploy, not a manual step.
- **Credentials.** Long-lived AWS access keys stored as CI secrets are a standing
  liability. GitHub's OIDC provider lets Actions assume an IAM role per run with
  no stored keys.
- **Auth across origins.** The session uses an `HttpOnly` refresh cookie. If the
  frontend and the API are served from different domains the cookie is cross-site
  and needs `SameSite=None; Secure`; if they share a domain, `SameSite=Strict`
  is preferable. The deploy topology (single domain vs. split) is an operational
  choice we do not want to hardcode.

## Decision

We will deploy on AWS with continuous delivery driven by GitHub Actions, mirroring
`whos-that`:

- **Backend** runs on **AWS Lambda from a container image**. The Litestar app is
  wrapped with **Mangum** (`lambda_handler.py`) and packaged by
  `backend/Dockerfile.lambda` on the AWS Lambda Python base image, published to
  **ECR**, and the function is updated with `update-function-code`. HTTP is
  exposed via a Lambda **Function URL** (or API Gateway).
- **Frontend** is built statically and hosted on **S3 behind CloudFront**; each
  deploy syncs `dist/` and invalidates the distribution.
- **Migrations** run as a pipeline job (`python -m ...postgres.migrate`) against
  the production `DATABASE_URL`, gated behind the test job and ahead of the
  backend deploy.
- **AWS authentication uses OIDC** — the workflow assumes an IAM role; no
  long-lived keys are stored.
- **Region** is `sa-east-1`. The database is a **dedicated PostgreSQL database on
  the existing `whos-that` RDS instance** (its own DB, not shared tables).
- **CORS origins and the refresh-cookie `SameSite` policy are read from the
  environment** (`CORS_ORIGINS`, `COOKIE_SAMESITE`), defaulting to the local-dev
  values, so both a single-domain and a split frontend/API topology are supported
  without code changes.

## Consequences

- The backend scales to zero and costs nothing when idle; sharing one RDS
  instance across both projects keeps the only always-on cost flat.
- Cold starts and Lambda's freeze/thaw model apply: the `psycopg` connection pool
  lives for the container's lifetime and shutdown hooks do not fire (`lifespan`
  is off in the handler). Connection count is now a shared budget across both apps
  on the RDS instance — if it grows, a small pool per Lambda or RDS Proxy is the
  next step.
- OIDC removes stored AWS keys but requires one-time IAM setup (GitHub OIDC
  provider + a role with an appropriately scoped trust policy and permissions for
  ECR, Lambda, S3 and CloudFront).
- The split-domain default (`COOKIE_SAMESITE=none`) trades the extra CSRF hardening
  of `SameSite=Strict` for cross-site cookie delivery; putting the API under the
  same domain as the frontend (CloudFront path routing) would let us keep `Strict`
  at the cost of more CloudFront configuration.
- Deploy provisioning is manual/imperative (console or CLI), not codified as IaC;
  the one-time resources (ECR repo, Lambda, S3 bucket, CloudFront, IAM role) are
  documented as a runbook rather than reproducible from the repo.
