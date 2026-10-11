"""Which reader a configured Bedrock model gets."""

from __future__ import annotations

import pytest

from sleepmon.adapters.outbound.bedrock.converse_reader import ConverseScreenshotReader
from sleepmon.adapters.outbound.bedrock.factory import build_screenshot_reader
from sleepmon.adapters.outbound.bedrock.screenshot_reader import BedrockScreenshotReader
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog


@pytest.mark.parametrize(
    "model,reader",
    [
        ("global.anthropic.claude-haiku-4-5-20251001-v1:0", BedrockScreenshotReader),
        ("anthropic.claude-haiku-5-5", BedrockScreenshotReader),
        ("google.gemma-3-27b-it", ConverseScreenshotReader),
        ("mistral.ministral-3-14b-instruct", ConverseScreenshotReader),
    ],
)
def test_claude_uses_the_anthropic_reader_and_the_rest_converse(model: str, reader: type) -> None:
    assert isinstance(build_screenshot_reader(model, "sa-east-1", StaticSpeciesCatalog()), reader)
