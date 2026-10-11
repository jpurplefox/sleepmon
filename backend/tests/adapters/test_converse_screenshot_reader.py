"""Converse adapter: request shape and JSON-in-text parsing, without the network."""

from __future__ import annotations

from typing import Any

import pytest
from botocore.exceptions import ClientError, EndpointConnectionError

from sleepmon.adapters.outbound.bedrock.converse_reader import ConverseScreenshotReader
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.domain.errors import ScreenshotReaderUnavailableError
from sleepmon.domain.screenshot_import import Screenshot, ScreenshotReading

MODEL = "google.gemma-3-27b-it"
IMAGES = [Screenshot("image/jpeg", b"\xff\xd8jpeg"), Screenshot("image/webp", b"RIFFwebp")]


class FakeClient:
    def __init__(self, text: str = "{}", error: Exception | None = None, stop: str = "end_turn"):
        self.text, self.error, self.stop = text, error, stop
        self.kwargs: dict[str, Any] = {}

    def converse(self, **kwargs: Any) -> dict[str, Any]:
        self.kwargs = kwargs
        if self.error is not None:
            raise self.error
        return {
            "output": {"message": {"role": "assistant", "content": [{"text": self.text}]}},
            "stopReason": self.stop,
            "usage": {"inputTokens": 10, "outputTokens": 5},
        }


def read(client: FakeClient) -> ScreenshotReading:
    return ConverseScreenshotReader(client, MODEL, StaticSpeciesCatalog()).read(IMAGES)


def test_sends_the_sheet_then_the_screenshots_and_asks_for_json() -> None:
    client = FakeClient()
    read(client)
    kw = client.kwargs
    assert kw["modelId"] == MODEL
    assert kw["inferenceConfig"]["temperature"] == 0
    system = kw["system"][0]["text"]
    assert "single JSON object" in system
    assert '"Pikachu"' in system  # the catalog's enums travel in the schema
    content = kw["messages"][0]["content"]
    images = [c["image"] for c in content if "image" in c]
    assert images[0]["format"] == "png"
    assert images[0]["source"]["bytes"].startswith(b"\x89PNG")
    assert [i["format"] for i in images[1:]] == ["jpeg", "webp"]
    assert [i["source"]["bytes"] for i in images[1:]] == [b"\xff\xd8jpeg", b"RIFFwebp"]


def test_parses_json_even_inside_a_code_fence() -> None:
    answer = '{"species": "Pikachu", "level": 25, "sleep_hours": 81, "sub_skills": null}'
    text = f"```json\n{answer}\n```"
    reading = read(FakeClient(text))
    assert reading.species == "Pikachu"
    assert reading.level == 25
    assert reading.sleep_hours == 81
    assert reading.sub_skills is None


@pytest.mark.parametrize("text", ["no json here", "{not json}", "[1, 2]"])
def test_an_unusable_answer_reads_nothing(text: str) -> None:
    assert read(FakeClient(text)) == ScreenshotReading()


def test_a_cut_off_answer_reads_nothing() -> None:
    assert read(FakeClient('{"species": "Pikachu"}', stop="max_tokens")) == ScreenshotReading()


@pytest.mark.parametrize(
    "error",
    [
        ClientError({"Error": {"Code": "ThrottlingException", "Message": "x"}}, "Converse"),
        EndpointConnectionError(endpoint_url="https://bedrock-runtime.sa-east-1.amazonaws.com"),
    ],
)
def test_transport_failures_are_unavailable(error: Exception) -> None:
    with pytest.raises(ScreenshotReaderUnavailableError):
        read(FakeClient(error=error))
