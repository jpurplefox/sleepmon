"""Picks the screenshot reader for the configured Bedrock model (ADR 0011)."""

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
from sleepmon.domain.ports import ScreenshotReader, SpeciesCatalog

TIMEOUT_SECONDS = 45


def uses_anthropic_api(model: str) -> bool:
    """Claude ids (``anthropic.…``, ``global.anthropic.…``) go through the Anthropic SDK."""
    return "anthropic." in model


def build_screenshot_reader(model: str, region: str, catalog: SpeciesCatalog) -> ScreenshotReader:
    if uses_anthropic_api(model):
        claude = AnthropicBedrock(aws_region=region, timeout=TIMEOUT_SECONDS, max_retries=1)
        # The SDK's typed ``create`` is narrower than the adapter's protocol.
        return BedrockScreenshotReader(cast(MessagesClient, claude), model, catalog)
    runtime = boto3.client(
        "bedrock-runtime",
        region_name=region,
        config=Config(read_timeout=TIMEOUT_SECONDS, retries={"max_attempts": 2}),
    )
    return ConverseScreenshotReader(cast(ConverseClient, runtime), model, catalog)
