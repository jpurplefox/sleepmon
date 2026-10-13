# Deployment runbook (AWS)

How sleepmon ships to AWS and the one-time setup behind it. The **decision** and
its trade-offs live in [ADR-0009](adr/0009-aws-deployment-and-ci-cd.md); this doc
is the operational checklist.

## What deploys, and how

On every push to `main`, `.github/workflows/deploy.yml` runs four jobs:

1. **test** — ruff · mypy · pytest (with a throwaway Postgres service).
2. **migrate** — applies yoyo migrations to the production DB (`DATABASE_URL`).
3. **deploy-backend** — builds `backend/Dockerfile.lambda` for `linux/amd64`,
   pushes to ECR, and points the Lambda function at the new image.
4. **deploy-frontend** — `npm run build`, `aws s3 sync dist/`, CloudFront invalidation.

`migrate` is gated behind `test`; `deploy-backend` behind `migrate`.
AWS auth is via **OIDC** (assumed role), so no AWS keys are stored in GitHub.

The job env at the top of the workflow pins the resource names; change them there
if you name resources differently:

```yaml
AWS_REGION: sa-east-1
ECR_REPOSITORY: sleepmon-lambda
LAMBDA_FUNCTION: sleepmon-api
S3_BUCKET: sleepmon-frontend
```

## One-time AWS setup

Do these once (Console or CLI). Region: `sa-east-1`.

### 1. Database (reuses the existing whos-that RDS instance)

Create a **dedicated database** on that instance — do **not** share `whos-that`'s
database (both apps use yoyo; the migration history tables would collide):

```sql
CREATE DATABASE sleepmon;
CREATE USER sleepmon WITH PASSWORD '<strong-password>';
GRANT ALL PRIVILEGES ON DATABASE sleepmon TO sleepmon;
```

The production DSN is then `postgresql://sleepmon:<password>@<rds-host>:5432/sleepmon`.
The security group that already lets whos-that in covers this too (same instance).
`migrate.py` creates the whole schema on first run.

> Connection budget: the smallest RDS instance caps `max_connections` at a few
> dozen, now shared with whos-that. Each Lambda instance holds **one** connection
> (the entry point sizes the pool to 1), so sleepmon never holds more connections
> than the function's reserved concurrency (step 4). If that saturates, add RDS Proxy.

### 2. ECR repository

```bash
aws ecr create-repository --repository-name sleepmon-lambda --region sa-east-1
```

### 3. IAM: GitHub OIDC provider + deploy role

- Add the GitHub OIDC identity provider if the account doesn't have it yet:
  URL `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`.
- Create a role (e.g. `sleepmon-deploy`) with a **trust policy** restricted to this
  repo, e.g. condition `token.actions.githubusercontent.com:sub` =
  `repo:jpurplefox/sleepmon:ref:refs/heads/main`.
- Attach **permissions** for: ECR (push/pull + auth token), Lambda
  (`UpdateFunctionCode`), S3 (`s3:PutObject`/`DeleteObject`/`ListBucket` on the
  frontend bucket) and CloudFront (`CreateInvalidation`).
- The role ARN goes into the `AWS_ROLE_ARN` GitHub secret.

### 4. Lambda function (container image)

- Create the function `sleepmon-api` **from a container image** (bootstrap it with
  any image, e.g. a first manual push, or `hello-world` — the workflow overwrites
  it on first deploy).
- Create a **Function URL** (auth type `NONE`; the app does its own auth) — this is
  the public API URL. (Or front it with API Gateway.)
- Set the function **environment variables**:
  - `DATABASE_URL` — the production DSN from step 1.
  - `JWT_SECRET` — `openssl rand -hex 32`.
  - `GOOGLE_CLIENT_ID` — the OAuth Web client ID.
  - `COOKIE_SECURE=true`.
  - `CORS_ORIGINS` — the frontend's public origin (e.g. `https://<cloudfront-domain>`).
  - `COOKIE_SAMESITE=none` — **required** when the frontend and API are on different
    domains (CloudFront vs. Function URL); the refresh cookie is cross-site.
    Use `strict` only if you serve the API under the same domain as the frontend.
  - `APP_URL` — the frontend's public origin (e.g. `https://sleepmon.app`). **Required
    for share links**: the link page sends people on to `{APP_URL}/compare?share=<id>`.
    Unset, it falls back to `http://localhost:5173` and the backend logs a warning at
    startup.
  - `SHARE_BASE_URL` — the domain share links are built on. Set it to the app's own
    domain (e.g. `https://sleepmon.app`) once CloudFront routes `/s/*` to the API
    (step 5), so links read `https://sleepmon.app/s/<id>`. Empty uses the API's own
    address. See [ADR-0011](adr/0011-shareable-links-with-previews.md).
  - `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile secret for the human check on
    signed-out sharing ([ADR-0012](adr/0012-human-check-for-anonymous-writes.md)).
    Empty turns signed-out sharing off (people are asked to sign in).
- Set **reserved concurrency** (Configuration → Concurrency) to **5**. The Function
  URL has no rate limiting, so this caps both the cost of abuse and the connections
  sleepmon can open on the shared RDS; requests beyond it get `429`. Setting it to
  `0` is the emergency off switch.
- The function needs **outbound HTTPS** to `challenges.cloudflare.com` (Turnstile's
  `siteverify`). A function outside a VPC has it; one attached to a VPC (e.g. to
  reach RDS privately) needs a NAT gateway or equivalent. If it can't reach it,
  signed-out sharing answers `503` (signed-in sharing is unaffected).
- Give the function enough memory/timeout for a cold start opening the DB pool
  (256–512 MB, ~10 s timeout is a safe start).

### 5. S3 + CloudFront (frontend)

- Create the bucket `sleepmon-frontend`.
- Put a **CloudFront** distribution in front of it (origin = the bucket). Set the
  default root object to `index.html` and add an error-response mapping 403/404 →
  `/index.html` (200) so client-side routes deep-link correctly (see ADR-0008); if you
  add the `/s/*` behavior below, use the S3-only fallback described there instead.
- The distribution ID goes into the `CLOUDFRONT_DISTRIBUTION_ID` secret.
- **Share links (`/s/*`)**: add a second origin (the Lambda Function URL domain) and a
  behavior with path pattern `/s/*` pointing at it, allowing `GET`/`HEAD`. Use a cache
  policy with a **short TTL** (the pages and images are immutable, but a deleted
  account's shares must go away; the API sends `Cache-Control: max-age=3600`) and an
  origin request policy that **does not forward the `Host` header**: a Lambda Function
  URL rejects requests whose `Host` isn't its own. Then set `SHARE_BASE_URL` (step 4).
- **SPA fallback vs. `/s/*`**: custom error responses (the 403/404 → `/index.html`
  mapping above) are **distribution-wide**, so CloudFront would also rewrite the API's
  `404` for an unknown or expired share (an HTML page that sends people on to the app)
  and a missing preview image into the SPA's `index.html` with `200`. Previews and the
  "doesn't exist or has expired" redirect would break. So, when adding `/s/*`, **drop
  the distribution-level error mapping** and do the SPA fallback on the S3 behavior
  only: a CloudFront Function (viewer-request) that rewrites URIs without a file
  extension to `/index.html`. Responses from `/s/*` then pass through untouched. (Do
  not "fix" this by having the API answer `200` for a missing share.)

### 6. Google OAuth

In the Google Cloud console, add the production frontend origin to the OAuth
client's **Authorized JavaScript origins** (and redirect URIs if used).

## GitHub secrets

Set these in the repo (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `AWS_ROLE_ARN` | ARN of the `sleepmon-deploy` role (step 3) |
| `DATABASE_URL` | production DSN (step 1) — used by the `migrate` job |
| `VITE_API_URL` | public API URL (Lambda Function URL / API Gateway) |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Web client ID |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID (step 5) |

`GOOGLE_CLIENT_ID`, `JWT_SECRET`, `COOKIE_SAMESITE`, `CORS_ORIGINS`, `COOKIE_SECURE`,
`APP_URL`, `SHARE_BASE_URL` and `TURNSTILE_SECRET_KEY` live on the **Lambda function**
(step 4), not in GitHub — the backend reads them from its own environment at runtime.

## GitHub variables

Non-secret build settings, under the same page's **Variables** tab. The frontend
build bakes them into the bundle; an unset variable never fails the build.

| Variable | Value |
| --- | --- |
| `CONTACT_EMAIL` | Contact email shown in the footer and on the privacy page (passed to the build as `VITE_CONTACT_EMAIL`). Unset or empty hides the email in both places. See [PRD-0018](prd/0018-account-and-privacy.md). |
| `POSTHOG_HOST` | PostHog ingest host (`VITE_POSTHOG_HOST`); empty uses the default US cloud ([ADR-0010](adr/0010-observability-error-monitoring-and-product-analytics.md)). |
| `SENTRY_TRACES_SAMPLE_RATE` | Browser trace sample rate (`VITE_SENTRY_TRACES_SAMPLE_RATE`). |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile **site** key (`VITE_TURNSTILE_SITE_KEY`, read by `deploy.yml`); the matching secret is the Lambda's `TURNSTILE_SECRET_KEY`. Empty: the human check is off and signed-out people are asked to sign in to share a link ([ADR-0012](adr/0012-human-check-for-anonymous-writes.md)). |

Locally, `docker compose` passes `VITE_CONTACT_EMAIL` through from your shell or `.env`.

## Cost guard

- An **AWS Budget** with an email alert, monthly plus a daily one (e.g. USD 5/day),
  so abuse shows up within hours. A budget only alerts; the off switch is reserved
  concurrency `0` (step 4).
- API responses are gzipped (the catalog is ~100 KB of JSON, ~10 KB compressed),
  which keeps data transfer, the dominant cost of a flood of requests, small.

## Third-party project settings

- **PostHog: "Discard client IP data" must be on** (Project settings). The privacy
  page says the analytics tool does not store IP addresses; that is only true with
  this setting enabled, since the SDK cannot prevent the ingest from recording the
  client IP. See ADR-0010, *Configuration*.
