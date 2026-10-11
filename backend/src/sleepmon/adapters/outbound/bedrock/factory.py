"""Wires the two-pass screenshot reader for the configured Bedrock models."""

from __future__ import annotations

from typing import cast

import boto3
from anthropic import AnthropicBedrock
from botocore.config import Config

from sleepmon.adapters.outbound.bedrock.converse_reader import (
    ConverseClient,
    ConverseScreenshotReader,
)
from sleepmon.adapters.outbound.bedrock.screenshot_reader import (
    BedrockScreenshotReader,
    MessagesClient,
)
from sleepmon.adapters.outbound.bedrock.two_pass_reader import (
    LineAwareReader,
    TwoPassScreenshotReader,
)
from sleepmon.domain.ports import ScreenshotReader, SpeciesCatalog

TIMEOUT_SECONDS = 45


def uses_anthropic_api(model: str) -> bool:
    """Claude ids (``anthropic.…``, ``us.anthropic.…``) go through the Anthropic SDK."""
    return "anthropic." in model


def _reader(
    model: str, region: str, runtime: ConverseClient, catalog: SpeciesCatalog
) -> LineAwareReader:
    if uses_anthropic_api(model):
        claude = AnthropicBedrock(aws_region=region, timeout=TIMEOUT_SECONDS, max_retries=1)
        # The SDK's typed ``create`` is narrower than the adapter's protocol.
        return BedrockScreenshotReader(cast(MessagesClient, claude), model, catalog)
    return ConverseScreenshotReader(runtime, model, catalog)


def build_screenshot_reader(
    *,
    triage_model: str,
    model: str,
    other_languages_model: str,
    region: str,
    catalog: SpeciesCatalog,
) -> ScreenshotReader:
    runtime = cast(
        ConverseClient,
        boto3.client(
            "bedrock-runtime",
            region_name=region,
            config=Config(read_timeout=TIMEOUT_SECONDS, retries={"max_attempts": 2}),
        ),
    )
    return TwoPassScreenshotReader(
        runtime,
        triage_model,
        english=_reader(model, region, runtime, catalog),
        other_languages=_reader(other_languages_model, region, runtime, catalog),
    )
