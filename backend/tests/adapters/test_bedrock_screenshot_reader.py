"""Bedrock adapter: request shape and tolerant parsing, without the network."""

from __future__ import annotations

import base64
from types import SimpleNamespace
from typing import Any

import anthropic
import httpx2
import pytest
from botocore.exceptions import ClientError, NoCredentialsError

from sleepmon.adapters.outbound.bedrock.lines import find_line
from sleepmon.adapters.outbound.bedrock.prompt import system_prompt
from sleepmon.adapters.outbound.bedrock.screenshot_reader import BedrockScreenshotReader
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.domain.errors import ScreenshotReaderUnavailableError
from sleepmon.domain.screenshot_import import Screenshot, ScreenshotReading

MODEL = "global.anthropic.claude-haiku-4-5-20251001-v1:0"
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
        SimpleNamespace(messages=messages), MODEL, StaticSpeciesCatalog()
    )


def test_sends_the_images_and_a_tool_with_catalog_enums() -> None:
    messages = FakeMessages(tool_response({"species": "Pikachu"}))
    reader(messages).read(IMAGES)
    kw = messages.kwargs
    assert kw["model"] == MODEL
    assert "output_config" not in kw
    assert kw["tool_choice"] == {"type": "auto"}
    assert kw["system"][0]["cache_control"] == {"type": "ephemeral"}
    content = kw["messages"][0]["content"]
    images = [c for c in content if c["type"] == "image"]
    # The ingredient reference sheet goes first, cached; then the user's screenshots.
    sheet, *shots = images
    assert sheet["source"]["media_type"] == "image/png"
    assert sheet["cache_control"] == {"type": "ephemeral"}
    assert base64.b64decode(sheet["source"]["data"]).startswith(b"\x89PNG")
    assert [i["source"]["media_type"] for i in shots] == ["image/jpeg", "image/png"]
    assert all(i["source"]["type"] == "base64" for i in images)
    schema = kw["tools"][0]["input_schema"]
    assert "Pikachu" in schema["properties"]["species"]["enum"]
    assert "Jolly" in schema["properties"]["nature"]["enum"]
    assert schema["properties"]["sleep_hours"] == {"type": ["integer", "null"]}
    assert "ribbon" not in schema["properties"]
    sub_skill = schema["properties"]["sub_skills"]["items"]["properties"]
    assert "Helping Bonus" in sub_skill["name"]["enum"]
    assert sub_skill["slot"]["enum"] == [10, 25, 50, 70, 80]


def test_system_prompt_uses_the_real_sub_skill_unlock_levels() -> None:
    messages = FakeMessages(tool_response({}))
    reader(messages).read(IMAGES)
    prompt = messages.kwargs["system"][0]["text"]
    assert "10, 25, 50, 70 and 80" in prompt
    assert "row by row" in prompt


def test_system_prompt_asks_for_the_shared_sleep_hours_not_the_ribbon() -> None:
    messages = FakeMessages(tool_response({}))
    reader(messages).read(IMAGES)
    prompt = messages.kwargs["system"][0]["text"]
    assert "Sleeping Time Shared" in prompt
    assert "sleep_hours" in prompt
    assert "ribbon is" not in prompt


def test_within_a_line_the_sheet_goes_along_and_species_is_limited_to_it() -> None:
    line = find_line("Dwebble")
    assert line is not None
    messages = FakeMessages(tool_response({}))
    reader(messages).read_in_line(IMAGES, line)
    kw = messages.kwargs
    images = [c for c in kw["messages"][0]["content"] if c["type"] == "image"]
    assert [i["source"]["media_type"] for i in images] == [
        "image/png", "image/webp", "image/jpeg", "image/png"
    ]
    species = kw["tools"][0]["input_schema"]["properties"]["species"]["enum"]
    assert species == ["Dwebble", "Crustle", None]
    assert "evolution-line reference sheet" in kw["system"][0]["text"]


def test_parses_a_full_tool_call() -> None:
    payload = {
        "species": "Pikachu", "level": 25, "nature": "Jolly",
        "ingredients": ["Fancy Apple", None, None],
        "sub_skills": [{"slot": 10, "name": "Helping Bonus"}],
        "skill_level": 3, "sleep_hours": 81, "versatile_skill": None,
    }
    reading = reader(FakeMessages(tool_response(payload))).read(IMAGES)
    assert reading == ScreenshotReading(
        species="Pikachu", level=25, nature="Jolly", ingredients=("Fancy Apple", None, None),
        sub_skills=("Helping Bonus",), skill_level=3, sleep_hours=81, versatile_skill=None,
    )


def test_sub_skills_are_put_in_slot_order() -> None:
    # A two-column grid read column by column: 10, 50, 80, 25, 70.
    payload = {"sub_skills": [
        {"slot": 10, "name": "Ingredient Finder S"}, {"slot": 50, "name": "Skill Trigger S"},
        {"slot": 80, "name": "Inventory Up S"}, {"slot": 25, "name": "Helping Speed S"},
        {"slot": 70, "name": "Skill Trigger M"},
    ]}
    reading = reader(FakeMessages(tool_response(payload))).read(IMAGES)
    assert reading.sub_skills == (
        "Ingredient Finder S", "Helping Speed S", "Skill Trigger S", "Skill Trigger M",
        "Inventory Up S",
    )


def test_sub_skills_without_usable_slots_keep_the_order_given() -> None:
    payload = {"sub_skills": [
        {"slot": 25, "name": "Helping Bonus"}, {"slot": 25, "name": "Skill Trigger S"},
        {"name": "Inventory Up S"}, "Helping Speed S", {"slot": 10, "name": 3},
    ]}
    reading = reader(FakeMessages(tool_response(payload))).read(IMAGES)
    assert reading.sub_skills == ("Helping Bonus", "Skill Trigger S", "Inventory Up S")


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


def test_system_prompt_carries_the_nature_table_and_spanish_names() -> None:
    prompt = system_prompt("report", "answer")
    assert "Sassy: ▲ Main Skill Chance / ▼ EXP Gains" in prompt
    assert "Sassy = Grosera" in prompt
    assert "Skill Trigger M = Activación M" in prompt
    assert "Candies" in prompt  # the species rule against reading the candy label
