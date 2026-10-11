"""Reads Pokémon Sleep screenshots with Claude on Amazon Bedrock (ADR 0011).

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

from sleepmon.domain.errors import ScreenshotReaderUnavailableError
from sleepmon.domain.ports import ScreenshotReader, SpeciesCatalog
from sleepmon.domain.screenshot_import import Screenshot, ScreenshotReading
from sleepmon.domain.value_objects import Ingredient, Nature, Ribbon, SubSkill
from sleepmon.domain.versatile import VERSATILE_SKILLS

log = logging.getLogger(__name__)

TOOL_NAME = "report_pokemon"
MAX_TOKENS = 4096

SYSTEM_PROMPT = """\
You read screenshots of the mobile game Pokémon Sleep and report one Pokémon's \
configuration by calling the report_pokemon tool exactly once.

All screenshots show the same Pokémon, usually its summary screen (name, level, \
main skill and its level, ingredients, ribbon) and its sub skills / nature screen. \
The game may be in any language: always map what you see to the English names \
allowed by the tool's schema.

Rules:
- Report only what is visible. Use null for anything you can't see; never guess.
- ingredients has exactly 3 entries, one per slot in order (unlocked at levels 1, 30 \
and 60). A slot shown locked, as "?", or not visible is null.
- sub_skills lists every sub skill shown, in the game's order (slots unlocked at \
levels 10, 25, 50, 70 and 80), including locked ones. Use null if no screenshot shows \
the sub skills.
- skill_level is the main skill's level ("Lv. N" next to the main skill).
- ribbon is "" only when the ribbon area is visible and empty; null when it isn't shown.
- versatile_skill is only for Mew: the skill currently shown for its Versatile main skill.
- If no screenshot shows a Pokémon Sleep Pokémon, call the tool with species null.
"""


class _Messages(Protocol):
    def create(self, **kwargs: Any) -> Any: ...


class MessagesClient(Protocol):
    """The slice of the Anthropic client this adapter uses."""

    @property
    def messages(self) -> _Messages: ...


def _nullable_enum(values: Sequence[str]) -> dict[str, Any]:
    return {"type": ["string", "null"], "enum": [*values, None]}


def build_tool(catalog: SpeciesCatalog) -> dict[str, Any]:
    nullable_int: dict[str, Any] = {"type": ["integer", "null"]}
    return {
        "name": TOOL_NAME,
        "description": "Report the Pokémon shown in the screenshots.",
        "input_schema": {
            "type": "object",
            "properties": {
                "species": _nullable_enum(sorted(s.name for s in catalog.all())),
                "level": nullable_int,
                "nature": _nullable_enum([n.value for n in Nature]),
                "ingredients": {
                    "type": "array",
                    "items": _nullable_enum([i.value for i in Ingredient]),
                },
                "sub_skills": {
                    "type": ["array", "null"],
                    "items": {"type": "string", "enum": [s.value for s in SubSkill]},
                },
                "skill_level": nullable_int,
                "ribbon": _nullable_enum([r.value for r in Ribbon]),
                "versatile_skill": _nullable_enum(list(VERSATILE_SKILLS)),
            },
            "required": [
                "species", "level", "nature", "ingredients",
                "sub_skills", "skill_level", "ribbon", "versatile_skill",
            ],
            "additionalProperties": False,
        },
    }


class BedrockScreenshotReader(ScreenshotReader):
    def __init__(self, client: MessagesClient, model: str, catalog: SpeciesCatalog) -> None:
        self._client = client
        self._model = model
        # Built once: an identical schema and system prompt keep the prompt cache warm.
        self._tool = build_tool(catalog)

    def read(self, images: Sequence[Screenshot]) -> ScreenshotReading:
        try:
            response = self._client.messages.create(
                model=self._model,
                max_tokens=MAX_TOKENS,
                system=[
                    {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}
                ],
                tools=[self._tool],
                tool_choice={"type": "auto"},
                messages=[{"role": "user", "content": _content(images)}],
            )
        except (anthropic.APIError, BotoCoreError, ClientError, RuntimeError) as exc:
            # Never log the request or images; the error type and HTTP status are enough.
            status = getattr(exc, "status_code", None)
            log.warning("Screenshot reading failed: %s (status %s)", type(exc).__name__, status)
            raise ScreenshotReaderUnavailableError(str(exc)) from exc
        return _parse(response)


def _content(images: Sequence[Screenshot]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": image.media_type,
                "data": base64.standard_b64encode(image.data).decode("ascii"),
            },
        }
        for image in images
    ]
    blocks.append({"type": "text", "text": "Report the Pokémon in these screenshots."})
    return blocks


def _parse(response: Any) -> ScreenshotReading:
    if getattr(response, "stop_reason", None) in ("refusal", "max_tokens"):
        return ScreenshotReading()
    for block in getattr(response, "content", []):
        if getattr(block, "type", None) == "tool_use" and getattr(block, "name", None) == TOOL_NAME:
            data = block.input if isinstance(block.input, dict) else {}
            return _reading(data)
    return ScreenshotReading()


def _str(value: object) -> str | None:
    return value if isinstance(value, str) else None


def _int(value: object) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _reading(data: dict[str, Any]) -> ScreenshotReading:
    raw_ingredients = data.get("ingredients")
    ingredients = (
        tuple(_str(v) for v in raw_ingredients[:3])
        if isinstance(raw_ingredients, list)
        else ()
    )
    raw_sub_skills = data.get("sub_skills")
    sub_skills = (
        tuple(v for v in raw_sub_skills if isinstance(v, str))
        if isinstance(raw_sub_skills, list)
        else None
    )
    return ScreenshotReading(
        species=_str(data.get("species")),
        level=_int(data.get("level")),
        nature=_str(data.get("nature")),
        ingredients=(ingredients + (None, None, None))[:3],
        sub_skills=sub_skills,
        skill_level=_int(data.get("skill_level")),
        ribbon=_str(data.get("ribbon")),
        versatile_skill=_str(data.get("versatile_skill")),
    )
