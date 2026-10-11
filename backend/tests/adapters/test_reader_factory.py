"""Which readers the configured Bedrock models get."""

from __future__ import annotations

import pytest

from sleepmon.adapters.outbound.bedrock.converse_reader import ConverseScreenshotReader
from sleepmon.adapters.outbound.bedrock.factory import build_screenshot_reader
from sleepmon.adapters.outbound.bedrock.screenshot_reader import BedrockScreenshotReader
from sleepmon.adapters.outbound.bedrock.two_pass_reader import TwoPassScreenshotReader
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog


@pytest.mark.parametrize(
    "model,reader",
    [
        ("us.anthropic.claude-haiku-4-5-20251001-v1:0", BedrockScreenshotReader),
        ("us.amazon.nova-2-lite-v1:0", ConverseScreenshotReader),
        ("qwen.qwen3-vl-235b-a22b", ConverseScreenshotReader),
    ],
)
def test_claude_uses_the_anthropic_reader_and_the_rest_converse(model: str, reader: type) -> None:
    built = build_screenshot_reader(
        triage_model="us.amazon.nova-2-lite-v1:0",
        model=model,
        other_languages_model=model,
        region="us-east-1",
        catalog=StaticSpeciesCatalog(),
    )
    assert isinstance(built, TwoPassScreenshotReader)
    assert isinstance(built._english, reader)
    assert isinstance(built._other, reader)
