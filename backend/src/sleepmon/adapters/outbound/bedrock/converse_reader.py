"""Reads screenshots with any vision model through Bedrock's Converse API (ADR 0011).

Not every provider supports tools, so the model answers with one JSON object in text;
the same reading rules, reference sheet and domain validation apply as for Claude.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Sequence
from typing import Any, Protocol

from botocore.exceptions import BotoCoreError, ClientError

from sleepmon.adapters.outbound.bedrock.screenshot_reader import (
    SHEET_CAPTION,
    USER_TEXT,
    build_schema,
    reading_from,
    reference_sheet_png,
    system_prompt,
)
from sleepmon.domain.errors import ScreenshotReaderUnavailableError
from sleepmon.domain.ports import ScreenshotReader, SpeciesCatalog
from sleepmon.domain.screenshot_import import Screenshot, ScreenshotReading

log = logging.getLogger(__name__)

MAX_TOKENS = 1024
_FORMATS = {"image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp"}


class ConverseClient(Protocol):
    """The slice of boto3's bedrock-runtime client this adapter uses."""

    def converse(self, **kwargs: Any) -> dict[str, Any]: ...


def json_system_prompt(catalog: SpeciesCatalog) -> str:
    schema = json.dumps(build_schema(catalog), separators=(",", ":"))
    rules = system_prompt("by answering with a single JSON object and nothing else", "answer")
    return f"{rules}\nThe JSON object must follow this JSON Schema:\n{schema}\n"


class ConverseScreenshotReader(ScreenshotReader):
    def __init__(self, client: ConverseClient, model: str, catalog: SpeciesCatalog) -> None:
        self._client = client
        self._model = model
        self._system = json_system_prompt(catalog)
        self._sheet = reference_sheet_png()

    def read(self, images: Sequence[Screenshot]) -> ScreenshotReading:
        content: list[dict[str, Any]] = [
            {"text": SHEET_CAPTION},
            {"image": {"format": "png", "source": {"bytes": self._sheet}}},
            *(
                {"image": {"format": _FORMATS[i.media_type], "source": {"bytes": i.data}}}
                for i in images
            ),
            {"text": USER_TEXT},
        ]
        try:
            response = self._client.converse(
                modelId=self._model,
                system=[{"text": self._system}],
                messages=[{"role": "user", "content": content}],
                inferenceConfig={"maxTokens": MAX_TOKENS, "temperature": 0},
            )
        except (BotoCoreError, ClientError) as exc:
            # Never log the request or images; the error type is enough.
            log.warning("Screenshot reading failed: %s", type(exc).__name__)
            raise ScreenshotReaderUnavailableError(str(exc)) from exc
        usage = response.get("usage", {})
        log.info(
            "Screenshot read: model=%s input=%s output=%s",
            self._model,
            usage.get("inputTokens"),
            usage.get("outputTokens"),
        )
        if response.get("stopReason") == "max_tokens":
            return ScreenshotReading()
        return reading_from(_json_object(_text(response)))


def _text(response: dict[str, Any]) -> str:
    blocks = response.get("output", {}).get("message", {}).get("content", [])
    return "".join(b["text"] for b in blocks if isinstance(b, dict) and "text" in b)


def _json_object(text: str) -> dict[str, Any]:
    """The first ``{...}`` in the answer (models may wrap it in a code fence)."""
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return {}
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}
