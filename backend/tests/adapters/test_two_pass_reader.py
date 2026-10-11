"""Two-pass reader: triage picks the line and the reader; the reading gets the line."""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Any

import pytest

from sleepmon.adapters.outbound.bedrock.lines import EvolutionLine
from sleepmon.adapters.outbound.bedrock.two_pass_reader import TwoPassScreenshotReader
from sleepmon.domain.screenshot_import import Screenshot, ScreenshotReading

IMAGES = [Screenshot("image/jpeg", b"\xff\xd8jpeg")]


class FakeTriageClient:
    def __init__(self, answer: str) -> None:
        self.answer = answer
        self.kwargs: dict[str, Any] = {}

    def converse(self, **kwargs: Any) -> dict[str, Any]:
        self.kwargs = kwargs
        return {
            "output": {"message": {"content": [{"text": self.answer}]}},
            "stopReason": "end_turn",
            "usage": {"inputTokens": 1, "outputTokens": 1},
        }


class SpyReader:
    def __init__(self, name: str) -> None:
        self.name = name
        self.line: EvolutionLine | None = None
        self.called = False

    def read_in_line(
        self, images: Sequence[Screenshot], line: EvolutionLine | None
    ) -> ScreenshotReading:
        self.called, self.line = True, line
        return ScreenshotReading(species=self.name)


def run(answer: dict[str, Any] | str) -> tuple[ScreenshotReading, SpyReader, SpyReader, Any]:
    text = answer if isinstance(answer, str) else json.dumps(answer)
    client = FakeTriageClient(text)
    english, other = SpyReader("english"), SpyReader("other")
    reading = TwoPassScreenshotReader(client, "nova", english, other).read(IMAGES)
    return reading, english, other, client


def test_english_goes_to_the_english_reader_with_the_candy_line() -> None:
    reading, english, other, client = run({"button": "Level Up", "candy": "Dwebble"})
    assert reading.species == "english"
    assert not other.called
    assert english.line is not None and english.line.members == ("Dwebble", "Crustle")
    # The triage sends only the screenshots, to the triage model.
    assert client.kwargs["modelId"] == "nova"
    assert len(client.kwargs["messages"][0]["content"]) == len(IMAGES)


@pytest.mark.parametrize("button", ["Siguiente nivel", "レベルアップ", "", None])
def test_any_other_or_unknown_language_goes_to_the_other_reader(button: str | None) -> None:
    reading, english, other, _ = run({"button": button, "candy": "Magnemite"})
    assert reading.species == "other"
    assert not english.called
    assert other.line is not None and "Magnezone" in other.line.members


def test_an_unknown_candy_reads_without_a_line() -> None:
    _, english, _, _ = run({"button": "level  up", "candy": "Agumon"})
    assert english.called and english.line is None


def test_an_unusable_triage_falls_back_to_the_other_reader_without_a_line() -> None:
    _, english, other, _ = run("no json")
    assert not english.called
    assert other.called and other.line is None
