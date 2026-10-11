# 0011. AI model access through Claude in Amazon Bedrock

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
  Marketplace billing, earliest access to new API features); Claude in Amazon Bedrock
  (AWS-operated, IAM/SigV4 auth, billed on the AWS account, the Messages API at
  `bedrock-mantle.{region}.api.aws`); and Bedrock's legacy `InvokeModel` / `Converse`
  APIs with ARN-versioned model IDs. Claude in Amazon Bedrock serves `sa-east-1`
  through its global endpoint type.
- **Feature gaps.** As of this writing the Bedrock Messages endpoint does not support
  structured outputs (`output_config.format`), and the current Opus model rejects a
  forced `tool_choice`.

## Decision

We will call Claude through **Claude in Amazon Bedrock**, using the official Anthropic
Python SDK's `AnthropicBedrockMantle` client (`anthropic[bedrock]`).

- **In production, auth is the Lambda's execution role** (SigV4, permission
  `bedrock-mantle:CreateInference`); no long-lived key exists there. **For local
  development**, a short-lived Bedrock bearer token in `AWS_BEARER_TOKEN_BEDROCK`
  (which the SDK picks up on its own) lets a developer try the feature without AWS
  credentials on the machine. The token is never set on the Lambda.
- **The model is configuration** (`SCREENSHOT_MODEL`, default
  `anthropic.claude-haiku-5-5`, the fastest and cheapest current Claude — reading labelled values off a
  screenshot doesn't need a larger model), and so is the region (`BEDROCK_REGION`, falling back
  to the Lambda's own `AWS_REGION`).
- **Every model call sits behind a domain port.** Adapters live under
  `adapters/outbound/bedrock/`, and the rest of the app sees only the port and its
  fakes.
- **Model output is untrusted input.** It reaches the domain as raw values, and a pure
  domain function validates each one against the catalog. Anything it can't match is
  treated as "not read", never shown as read.
- **Structured data comes back through a tool** whose JSON schema carries the
  catalog's enums, with `tool_choice: auto` and a system prompt that requires the call,
  instead of structured outputs. The domain validation above is the guarantee; the
  enums only steer the model.
- **User content is sent for one request and never stored or logged** by sleepmon.

## Consequences

- No new secret to manage, and the cost lands on the same AWS bill. Access is granted
  with IAM, and CloudTrail/CloudWatch already see it.
- The Lambda image gains the `anthropic` SDK and its Bedrock extra (with `botocore`).
- One-time setup outside the repo: model access in the Bedrock console, the IAM
  permission on the execution role, and a Lambda timeout long enough for a model
  call (≥ 60 s). [ADR-0009](0009-aws-deployment-and-ci-cd.md)'s runbook grows by these
  steps.
- The Lambda Function URL's 6 MB request limit applies to anything sent to a model
  through the API; image features shrink images in the browser before upload.
- New Claude API features arrive on Bedrock later than on Claude Platform on AWS.
  Structured outputs is the visible example; when it lands, the tool can be replaced
  by `output_config.format` without touching the port.
- Local development needs a Bedrock bearer token (or AWS credentials) to reach the
  model; without either the feature answers "unavailable" (503), and tests use the
  port's fakes.
- Swapping providers (first-party API, Claude Platform on AWS) means a new adapter
  behind the same port, plus a superseding ADR.
