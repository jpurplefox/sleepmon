"""Reads screenshots with any vision model through Bedrock's Converse API (ADR 0011).

Not every provider supports tools, so the model answers with one JSON object in text;
the same reading rules, reference sheets and domain validation apply as for Claude.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Sequence
from typing import Any, Protocol

from botocore.exceptions import BotoCoreError, ClientError

from sleepmon.adapters.outbound.bedrock.lines import EvolutionLine
from sleepmon.adapters.outbound.bedrock.prompt import (
    INGREDIENT_CAPTION,
    USER_TEXT,
    build_schema,
    ingredient_sheet_png,
    line_caption,
    reading_from,
    system_prompt,
)
from sleepmon.domain.errors import ScreenshotReaderUnavailableError
from sleepmon.domain.ports import ScreenshotReader, SpeciesCatalog
from sleepmon.domain.screenshot_import import Screenshot, ScreenshotReading

log = logging.getLogger(__name__)

MAX_TOKENS = 1024
FORMATS = {"image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp"}


class ConverseClient(Protocol):
    """The slice of boto3's bedrock-runtime client these adapters use."""

    def converse(self, **kwargs: Any) -> dict[str, Any]: ...


def json_system_prompt(catalog: SpeciesCatalog, line: EvolutionLine | None = None) -> str:
    schema = json.dumps(build_schema(catalog, line), separators=(",", ":"))
    rules = system_prompt("by answering with a single JSON object and nothing else", "answer", line)
    return f"{rules}\nThe JSON object must follow this JSON Schema:\n{schema}\n"


def image_block(data: bytes, media_type: str) -> dict[str, Any]:
    return {"image": {"format": FORMATS[media_type], "source": {"bytes": data}}}


def converse(client: ConverseClient, model: str, **kwargs: Any) -> dict[str, Any]:
    """One Converse call; transport failures become ``ScreenshotReaderUnavailableError``."""
    try:
        response = client.converse(modelId=model, **kwargs)
    except (BotoCoreError, ClientError) as exc:
        # Never log the request or images; the error type is enough.
        log.warning("Screenshot reading failed: %s", type(exc).__name__)
        raise ScreenshotReaderUnavailableError(str(exc)) from exc
    usage = response.get("usage", {})
    log.info(
        "Screenshot read: model=%s input=%s output=%s",
        model,
        usage.get("inputTokens"),
        usage.get("outputTokens"),
    )
    return response


def json_answer(response: dict[str, Any]) -> dict[str, Any]:
    """The first ``{...}`` in the answer (models may wrap it in a code fence)."""
    if response.get("stopReason") == "max_tokens":
        return {}
    blocks = response.get("output", {}).get("message", {}).get("content", [])
    text = "".join(b["text"] for b in blocks if isinstance(b, dict) and "text" in b)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return {}
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


class ConverseScreenshotReader(ScreenshotReader):
    def __init__(self, client: ConverseClient, model: str, catalog: SpeciesCatalog) -> None:
        self._client = client
        self._model = model
        self._catalog = catalog
        self._ingredients = ingredient_sheet_png()

    def read(self, images: Sequence[Screenshot]) -> ScreenshotReading:
        return self.read_in_line(images, None)

    def read_in_line(
        self, images: Sequence[Screenshot], line: EvolutionLine | None
    ) -> ScreenshotReading:
        content: list[dict[str, Any]] = [
            {"text": INGREDIENT_CAPTION},
            image_block(self._ingredients, "image/png"),
        ]
        if line is not None:
            content += [{"text": line_caption(line)}, image_block(line.sheet_webp, "image/webp")]
        content += [image_block(i.data, i.media_type) for i in images]
        content.append({"text": USER_TEXT})
        response = converse(
            self._client,
            self._model,
            system=[{"text": json_system_prompt(self._catalog, line)}],
            messages=[{"role": "user", "content": content}],
            inferenceConfig={"maxTokens": MAX_TOKENS, "temperature": 0},
        )
        return reading_from(json_answer(response))
