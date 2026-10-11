# 0011. AI model access through Amazon Bedrock

Date: 2026-10-11

## Status

Accepted

## Context

The screenshot import ([PRD 0019](../prd/0019-screenshot-import.md)) needs a model that
reads game screenshots and returns a Pokémon's configuration. It is the app's first
use of a large language model, and unlikely to be the last, so how the backend reaches
one is a choice that outlives the feature.

Forces at play:

- **Where the backend runs.** The API is an AWS Lambda in `sa-east-1` with an IAM
  execution role, deployed by GitHub Actions over OIDC with no stored keys
  ([ADR-0009](0009-aws-deployment-and-ci-cd.md)). Billing already runs through AWS.
- **Hexagonal architecture** ([ADR-0002](0002-hexagonal-architecture.md)): the domain
  must not know which provider, SDK or transport serves a model.
- **Untrusted output.** A model can misread an image or answer with a value the game
  doesn't have; whatever it returns has to be checked against the catalog before a
  user sees it.
- **User content.** Screenshots are the user's own images and go to a third party; the
  [privacy page](../prd/0018-account-and-privacy.md) has to be able to say they are not
  kept.
- **Available routes to Claude**: Anthropic's first-party API (an API key to store and
  rotate, billing outside AWS); Claude Platform on AWS (Anthropic-operated, AWS
  Marketplace billing); Claude in Amazon Bedrock (the Messages API at
  `bedrock-mantle.{region}.api.aws`); and Bedrock's `InvokeModel` API with inference
  profiles such as `global.anthropic.…`. The last two are billed on the AWS account
  and authenticated with IAM.
- **What the account can reach today** (tried 2026-10-11 from `sa-east-1`): the
  Messages endpoint answers "model does not exist" for every Claude model, and the
  newest Haiku (5.5) is not available to the account; `InvokeModel` with the global
  Claude Haiku 4.5 profile works.
- **Forced tool choice** is rejected by the current models, so a JSON-returning call
  can't rely on it.

## Decision

We will call Claude through **Amazon Bedrock's `InvokeModel` API**, using the official
Anthropic Python SDK's `AnthropicBedrock` client (`anthropic[bedrock]`).

- **In production, auth is the Lambda's execution role** (SigV4, permission
  `bedrock:InvokeModel`); no long-lived key exists there. **For local development**,
  a short-lived Bedrock bearer token in `AWS_BEARER_TOKEN_BEDROCK` (which the SDK picks
  up on its own) lets a developer try the feature without AWS credentials on the
  machine. The token is never set on the Lambda.
- **The model is configuration** (`SCREENSHOT_MODEL`, default the global Claude Haiku
  4.5 profile `global.anthropic.claude-haiku-4-5-20251001-v1:0` — reading labelled
  values off a screenshot doesn't need a larger model), and so is the region
  (`BEDROCK_REGION`, falling back to the Lambda's own `AWS_REGION`). Moving to a newer
  model the account gains access to is an environment change, not a code change.
- **Every model call sits behind a domain port.** Adapters live under
  `adapters/outbound/bedrock/`, and the rest of the app sees only the port and its
  fakes.
- **Model output is untrusted input.** It reaches the domain as raw values, and a pure
  domain function validates each one against the catalog. Anything it can't match is
  treated as "not read", never shown as read.
- **Structured data comes back through a tool** whose JSON schema carries the
  catalog's enums, with `tool_choice: auto` and a system prompt that requires the call.
  The domain validation above is the guarantee; the enums only steer the model.
- **The request uses only parameters every Claude model on Bedrock accepts** (no
  `effort`, which Haiku 4.5 rejects), so swapping the model id stays safe.
- **User content is sent for one request and never stored or logged** by sleepmon.

## Consequences

- No new secret to manage in production, and the cost lands on the same AWS bill.
  Access is granted with IAM, and CloudTrail/CloudWatch already see it.
- The Lambda image gains the `anthropic` SDK and its Bedrock extra (with `botocore`).
- One-time setup outside the repo: the IAM permission on the execution role and a
  Lambda timeout long enough for a model call (≥ 60 s). Model access turns itself on
  at the first invocation (Anthropic may ask once for use-case details).
  [ADR-0009](0009-aws-deployment-and-ci-cd.md)'s runbook grows by these steps.
- The global inference profile may route a request to any commercial region; the
  screenshots are still not stored anywhere.
- The Lambda Function URL's 6 MB request limit applies to anything sent to a model
  through the API; image features shrink images in the browser before upload.
- Local development needs a Bedrock bearer token (or AWS credentials) to reach the
  model; without either the feature answers "unavailable" (503), and tests use the
  port's fakes.
- If the account gains the Messages endpoint or a newer model, switching is an adapter
  client change or a `SCREENSHOT_MODEL` change behind the same port; swapping providers
  (first-party API, Claude Platform on AWS) means a new adapter plus a superseding ADR.
