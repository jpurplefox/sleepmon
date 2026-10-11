"""Two passes per import (ADR 0011): a cheap triage, then the full reading in context.

1. Triage: the level button's text (English or not) and the Pokémon named on the candy
   label, which picks the evolution line.
2. Reading: with that line's sheet and the species limited to its members; English
   screens go to one model, any other language to another.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from sleepmon.adapters.outbound.bedrock.converse_reader import (
    ConverseClient,
    converse,
    image_block,
    json_answer,
)
from sleepmon.adapters.outbound.bedrock.lines import EvolutionLine, find_line
from sleepmon.domain.ports import ScreenshotReader
from sleepmon.domain.screenshot_import import Screenshot, ScreenshotReading

log = logging.getLogger(__name__)

TRIAGE_PROMPT = """\
You look at screenshots of the mobile game Pokémon Sleep and answer with a single JSON \
object and nothing else:
{"button": "<text>", "candy": "<name>"}
- button: the text on the big green button under the Pokémon's level, copied exactly \
("Level Up", "Siguiente nivel"...).
- candy: the Pokémon named on the candies label ("<Name> Candies", "Caramelos <Name>"...), \
copied exactly as written.
Use null for anything you can't see."""
# The level button reads exactly this when the game is in English; it decides the reader
# in code because models guess the language from the nickname, written in any script.
ENGLISH_BUTTON = "level up"
TRIAGE_MAX_TOKENS = 100


@dataclass(frozen=True, slots=True)
class Triage:
    english: bool
    candy: str | None


class LineAwareReader(Protocol):
    def read_in_line(
        self, images: Sequence[Screenshot], line: EvolutionLine | None
    ) -> ScreenshotReading: ...


def triage(client: ConverseClient, model: str, images: Sequence[Screenshot]) -> Triage:
    response = converse(
        client,
        model,
        system=[{"text": TRIAGE_PROMPT}],
        messages=[{"role": "user", "content": [image_block(i.data, i.media_type) for i in images]}],
        inferenceConfig={"maxTokens": TRIAGE_MAX_TOKENS, "temperature": 0},
    )
    answer = json_answer(response)
    button, candy = answer.get("button"), answer.get("candy")
    english = isinstance(button, str) and " ".join(button.lower().split()) == ENGLISH_BUTTON
    return Triage(english=english, candy=candy if isinstance(candy, str) else None)


class TwoPassScreenshotReader(ScreenshotReader):
    def __init__(
        self,
        client: ConverseClient,
        triage_model: str,
        english: LineAwareReader,
        other_languages: LineAwareReader,
    ) -> None:
        self._client = client
        self._triage_model = triage_model
        self._english = english
        self._other = other_languages

    def read(self, images: Sequence[Screenshot]) -> ScreenshotReading:
        seen = triage(self._client, self._triage_model, images)
        line = find_line(seen.candy)
        # Anything not clearly English goes to the stronger multilingual reader.
        reader = self._english if seen.english else self._other
        log.info(
            "Screenshot triage: english=%s candy=%s line=%s reader=%s",
            seen.english,
            seen.candy,
            line.candy if line else None,
            "english" if reader is self._english else "other",
        )
        return reader.read_in_line(images, line)
