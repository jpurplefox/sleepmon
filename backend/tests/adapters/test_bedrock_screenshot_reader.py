"""Bedrock adapter: request shape and tolerant parsing, without the network."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import anthropic
import httpx2
import pytest
from botocore.exceptions import ClientError, NoCredentialsError

from sleepmon.adapters.outbound.bedrock.screenshot_reader import BedrockScreenshotReader
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.domain.errors import ScreenshotReaderUnavailableError
from sleepmon.domain.screenshot_import import Screenshot, ScreenshotReading

IMAGES = [Screenshot("image/jpeg", b"\xff\xd8jpeg"), Screenshot("image/png", b"\x89PNG")]


class FakeMessages:
    def __init__(self, response: Any = None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.kwargs: dict[str, Any] = {}

    def create(self, **kwargs: Any) -> Any:
        self.kwargs = kwargs
        if self.error is not None:
            raise self.error
        return self.response


def tool_response(payload: dict[str, Any], stop_reason: str = "tool_use") -> Any:
    block = SimpleNamespace(type="tool_use", name="report_pokemon", input=payload)
    return SimpleNamespace(content=[block], stop_reason=stop_reason)


def reader(messages: FakeMessages) -> BedrockScreenshotReader:
    return BedrockScreenshotReader(
        SimpleNamespace(messages=messages), "anthropic.claude-opus-5-5", StaticSpeciesCatalog()
    )


def test_sends_the_images_and_a_tool_with_catalog_enums() -> None:
    messages = FakeMessages(tool_response({"species": "Pikachu"}))
    reader(messages).read(IMAGES)
    kw = messages.kwargs
    assert kw["model"] == "anthropic.claude-opus-5-5"
    assert kw["tool_choice"] == {"type": "auto"}
    assert kw["system"][0]["cache_control"] == {"type": "ephemeral"}
    content = kw["messages"][0]["content"]
    images = [c for c in content if c["type"] == "image"]
    assert [i["source"]["media_type"] for i in images] == ["image/jpeg", "image/png"]
    assert all(i["source"]["type"] == "base64" for i in images)
    schema = kw["tools"][0]["input_schema"]
    assert "Pikachu" in schema["properties"]["species"]["enum"]
    assert "Jolly" in schema["properties"]["nature"]["enum"]
    assert "" in schema["properties"]["ribbon"]["enum"]
    assert "Helping Bonus" in schema["properties"]["sub_skills"]["items"]["enum"]


def test_system_prompt_uses_the_real_sub_skill_unlock_levels() -> None:
    messages = FakeMessages(tool_response({}))
    reader(messages).read(IMAGES)
    assert "10, 25, 50, 70 and 80" in messages.kwargs["system"][0]["text"]


def test_parses_a_full_tool_call() -> None:
    payload = {
        "species": "Pikachu", "level": 25, "nature": "Jolly",
        "ingredients": ["Fancy Apple", None, None], "sub_skills": ["Helping Bonus"],
        "skill_level": 3, "ribbon": "", "versatile_skill": None,
    }
    reading = reader(FakeMessages(tool_response(payload))).read(IMAGES)
    assert reading == ScreenshotReading(
        species="Pikachu", level=25, nature="Jolly", ingredients=("Fancy Apple", None, None),
        sub_skills=("Helping Bonus",), skill_level=3, ribbon="", versatile_skill=None,
    )


def test_wrong_types_become_none() -> None:
    payload = {"species": 7, "level": "25", "sub_skills": "Helping Bonus", "ingredients": "x"}
    reading = reader(FakeMessages(tool_response(payload))).read(IMAGES)
    assert reading.species is None
    assert reading.level is None
    assert reading.sub_skills is None
    assert reading.ingredients == (None, None, None)


def test_no_tool_call_or_a_refusal_reads_nothing() -> None:
    block = SimpleNamespace(type="text", text="hi")
    text = SimpleNamespace(content=[block], stop_reason="end_turn")
    assert reader(FakeMessages(text)).read(IMAGES) == ScreenshotReading()
    refused = tool_response({"species": "Pikachu"}, stop_reason="refusal")
    assert reader(FakeMessages(refused)).read(IMAGES) == ScreenshotReading()


@pytest.mark.parametrize(
    "error",
    [
        anthropic.APIConnectionError(request=httpx2.Request("POST", "https://x")),
        NoCredentialsError(),
        ClientError({"Error": {"Code": "ExpiredToken", "Message": "x"}}, "CreateInference"),
        RuntimeError("Could not resolve AWS credentials from session"),
    ],
)
def test_transport_failures_are_unavailable(error: Exception) -> None:
    with pytest.raises(ScreenshotReaderUnavailableError):
        reader(FakeMessages(error=error)).read(IMAGES)
