"""Reads Pokémon Sleep screenshots with Claude on Amazon Bedrock.

The model reports through a tool whose schema carries the catalog's enums; the domain
re-validates every value. Only parameters every Claude model on Bedrock accepts are sent.
"""

from __future__ import annotations

import base64
import logging
from collections.abc import Sequence
from typing import Any, Protocol

import anthropic
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

TOOL_NAME = "report_pokemon"
MAX_TOKENS = 4096
SYSTEM_PROMPT = system_prompt("by calling the report_pokemon tool exactly once", "call the tool")


class _Messages(Protocol):
    def create(self, **kwargs: Any) -> Any: ...


class MessagesClient(Protocol):
    """The slice of the Anthropic client this adapter uses."""

    @property
    def messages(self) -> _Messages: ...


def build_tool(catalog: SpeciesCatalog, line: EvolutionLine | None = None) -> dict[str, Any]:
    return {
        "name": TOOL_NAME,
        "description": "Report the Pokémon shown in the screenshots.",
        "input_schema": build_schema(catalog, line),
    }


class BedrockScreenshotReader(ScreenshotReader):
    def __init__(self, client: MessagesClient, model: str, catalog: SpeciesCatalog) -> None:
        self._client = client
        self._model = model
        self._catalog = catalog
        self._ingredients = _image_block(ingredient_sheet_png(), "image/png")

    def read(self, images: Sequence[Screenshot]) -> ScreenshotReading:
        return self.read_in_line(images, None)

    def read_in_line(
        self, images: Sequence[Screenshot], line: EvolutionLine | None
    ) -> ScreenshotReading:
        system = SYSTEM_PROMPT if line is None else system_prompt(
            "by calling the report_pokemon tool exactly once", "call the tool", line
        )
        # The ingredient sheet closes the cached prefix (tool + system + sheet).
        content: list[dict[str, Any]] = [
            {"type": "text", "text": INGREDIENT_CAPTION},
            {**self._ingredients, "cache_control": {"type": "ephemeral"}},
        ]
        if line is not None:
            content += [
                {"type": "text", "text": line_caption(line)},
                _image_block(line.sheet_webp, "image/webp"),
            ]
        content += [_image_block(i.data, i.media_type) for i in images]
        content.append({"type": "text", "text": USER_TEXT})
        try:
            response = self._client.messages.create(
                model=self._model,
                max_tokens=MAX_TOKENS,
                system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
                tools=[build_tool(self._catalog, line)],
                tool_choice={"type": "auto"},
                messages=[{"role": "user", "content": content}],
            )
        except (anthropic.APIError, BotoCoreError, ClientError, RuntimeError) as exc:
            # Never log the request or images; the error type and HTTP status are enough.
            status = getattr(exc, "status_code", None)
            log.warning("Screenshot reading failed: %s (status %s)", type(exc).__name__, status)
            raise ScreenshotReaderUnavailableError(str(exc)) from exc
        usage = getattr(response, "usage", None)
        log.info(
            "Screenshot read: model=%s input=%s cache_write=%s cache_read=%s output=%s",
            self._model,
            getattr(usage, "input_tokens", None),
            getattr(usage, "cache_creation_input_tokens", None),
            getattr(usage, "cache_read_input_tokens", None),
            getattr(usage, "output_tokens", None),
        )
        return _parse(response)


def _image_block(data: bytes, media_type: str) -> dict[str, Any]:
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": media_type,
            "data": base64.standard_b64encode(data).decode("ascii"),
        },
    }


def _parse(response: Any) -> ScreenshotReading:
    if getattr(response, "stop_reason", None) in ("refusal", "max_tokens"):
        return ScreenshotReading()
    for block in getattr(response, "content", []):
        if getattr(block, "type", None) == "tool_use" and getattr(block, "name", None) == TOOL_NAME:
            data = block.input if isinstance(block.input, dict) else {}
            return reading_from(data)
    return ScreenshotReading()
