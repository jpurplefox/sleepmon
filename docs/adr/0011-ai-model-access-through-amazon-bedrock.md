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
  ([ADR-0009](0009-aws-deployment-and-ci-cd.md)). Billing already runs through AWS, and
  the role can call Bedrock in any region.
- **Hexagonal architecture** ([ADR-0002](0002-hexagonal-architecture.md)): the domain
  must not know which provider, SDK or transport serves a model.
- **Untrusted output.** A model can misread an image or answer with a value the game
  doesn't have; whatever it returns has to be checked against the catalog before a
  user sees it.
- **User content.** Screenshots are the user's own images and go to a third party; the
  [privacy page](../prd/0018-account-and-privacy.md) has to be able to say they are not
  kept.
- **What the account can reach** (tried 2026-10-11): Claude 4.7 and later (Haiku 5.5
  included) and the newer Bedrock Messages endpoint are not available to the account;
  Claude Haiku 4.5, Qwen3-VL, Amazon Nova, Llama 4, Gemma 3 and Mistral models are.
  Amazon Nova 2 Lite is only served in `us-east-1`.
- **Measured on real screenshots** (3 Pokémon, one captured in Spanish, 2 runs per
  model, scored field by field):
  - Single calls: Qwen3-VL 235B was the best (38/39, ~USD 3 per 1,000 reads). Claude
    Haiku 4.5 cost three times as much and read species worse. Nova 2 Lite was cheap
    (~USD 1.30) and good on English screens, but failed on the Spanish one. Gemma,
    Ministral, Mistral Large and Llama 4 missed ingredients, sub skills or species.
  - Every model shared two systematic errors: taking the species from the candies
    label, which names the line's first stage (Crustle read as Dwebble), and guessing
    the language from nicknames, which players write in any script.
- **Forced tool choice** is rejected by the current Claude models, and not every
  provider supports tools, so a JSON-returning call can't rely on them.

## Decision

We will read screenshots on **Amazon Bedrock in `us-east-1`** (`BEDROCK_REGION`), in
**two passes** behind one domain port:

1. **Triage** (`SCREENSHOT_TRIAGE_MODEL`, default Amazon Nova 2 Lite): the text of the
   level button and the name on the candies label. The code decides the language from
   the button's text, and finds the evolution line from the candy name, tolerating a
   misread.
2. **Reading**: English screens go to `SCREENSHOT_MODEL` (default Nova 2 Lite), any
   other language to `SCREENSHOT_MODEL_OTHER_LANGUAGES` (default Qwen3-VL 235B). Within
   a known line the request carries that line's sheet (Pokémon Sleep's own sprites with
   names), and the schema limits `species` to its members.

- **Transport.** Models are called through Bedrock's Converse API (`boto3`) and answer
  one JSON object in text. Claude ids (`anthropic.` in the id) keep their own adapter:
  the Anthropic SDK's `AnthropicBedrock` client over `InvokeModel`, with a tool. Any of
  the three slots can take a Claude model the account gains access to.
- **Auth.** In production, auth is the Lambda's execution role (SigV4, permission
  `bedrock:InvokeModel`, which covers Converse); no long-lived key exists there. For
  local development, a short-lived Bedrock bearer token in `AWS_BEARER_TOKEN_BEDROCK`
  (which boto3 and the Anthropic SDK pick up on their own) lets a developer try the
  feature without AWS credentials on the machine. The token is never set on the Lambda.
- **Models and region are configuration.** Moving to another model is an environment
  change, not a code change.
- **Every model call sits behind a domain port.** Adapters live under
  `adapters/outbound/bedrock/`, and the rest of the app sees only the port and its
  fakes.
- **Model output is untrusted input.** It reaches the domain as raw values, and a pure
  domain function validates each one against the catalog. Anything it can't match is
  treated as "not read", never shown as read. The model reports the hours of shared
  sleep, never the ribbon: the domain derives the ribbon from the game's thresholds.
- **All readers share the reading rules.** They use the same system prompt (with the
  catalog's nature table and the game's official Spanish names), the same JSON schema
  built from the catalog's enums, and the same reference sheets (ingredients and the
  evolution line) sent ahead of the screenshots. The domain validation is the
  guarantee; the schema only steers the model.
- **Reference data is generated, not hand-edited.** `backend/scripts/ingredient_sheet.py`
  and `backend/scripts/evolution_lines.py` write committed files, to re-run after
  catalog changes. Lines come from nitoyon/pokesleep-tool's data; the sprites are
  Pokémon Sleep art from Neroli's Lab (Apache-2.0, credited in the README), supplied by
  hand as a local folder: the scripts never fetch anything.
- **The Claude request uses only parameters every Claude model on Bedrock accepts.**
  It sends no `effort`, which Haiku 4.5 rejects, so swapping its model id stays safe.
- **User content is sent for the request and never stored or logged** by sleepmon.

## Consequences

- No new secret to manage in production, and the cost lands on the same AWS bill.
  Access is granted with IAM, and CloudTrail/CloudWatch already see it.
- **Cost:** two calls per import cost less than one Qwen call alone, ~USD 1.90 per
  1,000 reads against ~3.00, with 39/39 on the test screenshots. Each call logs its
  token counts, so the cost can be checked against real traffic.
- **Data location:** screenshots are processed in `us-east-1` (Nova's `us.` profile may
  route within the US), never where the Lambda runs. They are never stored.
- **Lambda image:** it gains the `anthropic` SDK and its Bedrock extra (with `boto3`),
  plus ~1 MB of reference sheets.
- **One-time setup outside the repo:** the IAM permission on the execution role for
  `us-east-1`, and a Lambda timeout long enough for two model calls (≥ 60 s). Model
  access turns itself on at the first invocation.
  [ADR-0009](0009-aws-deployment-and-ci-cd.md)'s runbook grows by these steps.
- **Request size:** the Lambda Function URL's 6 MB request limit applies to anything
  sent to a model through the API, so image features shrink images in the browser
  before upload.
- **Local development:** it needs a Bedrock bearer token created in `BEDROCK_REGION`
  (short-term tokens are regional). Without one the feature answers "unavailable"
  (503), and tests use the port's fakes.
- **Changing providers:** swapping to the first-party API or Claude Platform on AWS
  means a new adapter behind the same port, plus a superseding ADR.
