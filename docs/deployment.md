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
> dozen, now shared with whos-that. Keep the Lambda pool small; if it saturates,
> add RDS Proxy.

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
- Give the function enough memory/timeout for a cold start opening the DB pool
  (256–512 MB, ~10 s timeout is a safe start).

### 5. S3 + CloudFront (frontend)

- Create the bucket `sleepmon-frontend`.
- Put a **CloudFront** distribution in front of it (origin = the bucket). Set the
  default root object to `index.html` and add an error-response mapping 403/404 →
  `/index.html` (200) so client-side routes deep-link correctly (see ADR-0008).
- The distribution ID goes into the `CLOUDFRONT_DISTRIBUTION_ID` secret.

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

`GOOGLE_CLIENT_ID`, `JWT_SECRET`, `COOKIE_SAMESITE`, `CORS_ORIGINS` and
`COOKIE_SECURE` live on the **Lambda function** (step 4), not in GitHub — the
backend reads them from its own environment at runtime.
