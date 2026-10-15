"""What every screenshot reader tells the model, and how its answer is read back.

Shared by the Claude and the Converse readers: the reading rules, the JSON
schema with the catalog's enums, the reference sheets and the tolerant parsing.
"""

from __future__ import annotations

from collections.abc import Sequence
from importlib.resources import files
from typing import Any

from sleepmon.adapters.outbound.bedrock.game_terms_es import (
    NATURE_STATS_ES,
    NATURES_ES,
    SUB_SKILLS_ES,
)
from sleepmon.adapters.outbound.bedrock.lines import EvolutionLine
from sleepmon.domain.catalog_data import NATURE_EFFECTS, SUB_SKILL_UNLOCK_LEVELS
from sleepmon.domain.ports import SpeciesCatalog
from sleepmon.domain.screenshot_import import ScreenshotReading
from sleepmon.domain.value_objects import Ingredient, Nature, SubSkill
from sleepmon.domain.versatile import VERSATILE_SKILLS

# Every ingredient's game icon with its name (regenerate with backend/scripts/ingredient_sheet.py).
INGREDIENT_SHEET = "ingredient_reference.png"
INGREDIENT_CAPTION = "Reference sheet (not a screenshot): ingredient icons and names."
USER_TEXT = "Report the Pokémon in these screenshots."

_TEMPLATE = """\
You read screenshots of the mobile game Pokémon Sleep and report one Pokémon's \
configuration {report}.

All screenshots show the same Pokémon, usually its summary screen (name, level, \
main skill and its level, ingredients, ribbon) and its sub skills / nature screen. \
The game may be in any language: always map what you see to the English names \
allowed by the schema.

Rules:
- Report only what is visible. Use null for anything you can't see; never guess.
- species is the Pokémon shown in the artwork. The "<Name> Candies" label names the \
first stage of its evolution line, and the name next to the level is a nickname: \
neither is the species. If you can't tell which Pokémon it is, use null for species \
and still report everything else.{line_rule}
- nature: when its name isn't in English, identify it by the stats it raises (▲) \
and lowers (▼), as listed in the nature table below. A nature with no effect must \
be told apart by its name.
- ingredients has exactly 3 entries, one per slot in order (unlocked at levels 1, 30 \
and 60). A locked slot still shows its ingredient, dimmed: report it. Only a slot \
shown as "?" or not visible is null. The game shows ingredients as icons only: \
identify each one by matching it against the ingredient reference sheet, which is not \
a screenshot of the Pokémon.
- sub_skills lists every sub skill shown, including locked ones, each with its slot: \
the level that unlocks it (10, 25, 50, 70 and 80). The game lays them out in two \
columns read row by row: 10 left and 25 right on the first row, 50 left and 70 right \
on the second, 80 alone on the third. A locked slot also carries a "Lv. N" badge \
naming its slot. Use null if no screenshot shows the sub skills.
- skill_level is the main skill's level ("Lv. N" next to the main skill).
- sleep_hours is the whole number of hours in "Sleeping Time Shared" (or its \
translation), ignoring the minutes: "1521 hrs 17 mins" is 1521. Null if not shown.
- versatile_skill is only for Mew: the skill currently shown for its Versatile main skill.
- If no screenshot shows a Pokémon Sleep Pokémon, {empty} with species null.

Nature table (raised / lowered):
{natures}

Spanish game names (map them to the English name before the "="):
{spanish}
"""

_LINE_RULE = """ The evolution-line reference sheet shows every Pokémon of this \
line with its name: species is the one whose artwork matches the screenshot."""


def system_prompt(report: str, empty: str, line: EvolutionLine | None = None) -> str:
    """The reading rules; ``report`` and ``empty`` say how the model answers."""
    return _TEMPLATE.format(
        report=report,
        empty=empty,
        line_rule=_LINE_RULE if line is not None else "",
        natures=_nature_table(),
        spanish=_spanish_names(),
    )


def _nature_table() -> str:
    """One line per nature, from the catalog's own effects so the prompt never drifts."""
    rows = []
    for nature, effect in NATURE_EFFECTS.items():
        if effect.is_neutral:
            rows.append(f"- {nature.value}: no effect")
        else:
            rows.append(f"- {nature.value}: ▲ {effect.increased} / ▼ {effect.decreased}")
    return "\n".join(rows)


def _spanish_names() -> str:
    groups = (
        ("Natures", NATURES_ES),
        ("Nature stats", NATURE_STATS_ES),
        ("Sub skills", SUB_SKILLS_ES),
    )
    return "\n".join(
        f"- {title}: " + "; ".join(f"{en} = {es}" for en, es in names.items())
        for title, names in groups
    )


def _nullable_enum(values: Sequence[str]) -> dict[str, Any]:
    return {"type": ["string", "null"], "enum": [*values, None]}


def build_schema(catalog: SpeciesCatalog, line: EvolutionLine | None = None) -> dict[str, Any]:
    """The reading's JSON schema; within a known line, species is limited to its members."""
    species = list(line.members) if line is not None else sorted(s.name for s in catalog.all())
    nullable_int: dict[str, Any] = {"type": ["integer", "null"]}
    return {
        "type": "object",
        "properties": {
            "species": _nullable_enum(species),
            "level": nullable_int,
            "nature": _nullable_enum([n.value for n in Nature]),
            "ingredients": {
                "type": "array",
                "items": _nullable_enum([i.value for i in Ingredient]),
            },
            "sub_skills": {
                "type": ["array", "null"],
                "items": {
                    "type": "object",
                    "properties": {
                        "slot": {"type": "integer", "enum": list(SUB_SKILL_UNLOCK_LEVELS)},
                        "name": {"type": "string", "enum": [s.value for s in SubSkill]},
                    },
                    "required": ["slot", "name"],
                    "additionalProperties": False,
                },
            },
            "skill_level": nullable_int,
            "sleep_hours": nullable_int,
            "versatile_skill": _nullable_enum(list(VERSATILE_SKILLS)),
        },
        "required": [
            "species", "level", "nature", "ingredients",
            "sub_skills", "skill_level", "sleep_hours", "versatile_skill",
        ],
        "additionalProperties": False,
    }


def ingredient_sheet_png() -> bytes:
    return files(__package__).joinpath(INGREDIENT_SHEET).read_bytes()


def line_caption(line: EvolutionLine) -> str:
    return f"Reference sheet (not a screenshot): the {line.candy} evolution line."


def _str(value: object) -> str | None:
    return value if isinstance(value, str) else None


def _int(value: object) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _sub_skills(raw: list[Any]) -> tuple[str, ...]:
    """The names in slot order; without one valid slot each, in the order given."""
    entries = [e for e in raw if isinstance(e, dict) and isinstance(e.get("name"), str)]
    slots = [e.get("slot") for e in entries]
    if all(s in SUB_SKILL_UNLOCK_LEVELS for s in slots) and len(set(slots)) == len(slots):
        entries.sort(key=lambda e: SUB_SKILL_UNLOCK_LEVELS.index(e["slot"]))
    return tuple(e["name"] for e in entries)


def reading_from(data: dict[str, Any]) -> ScreenshotReading:
    """Coerces the model's answer into a reading; wrong types become ``None``."""
    raw_ingredients = data.get("ingredients")
    ingredients = (
        tuple(_str(v) for v in raw_ingredients[:3]) if isinstance(raw_ingredients, list) else ()
    )
    raw_sub_skills = data.get("sub_skills")
    sub_skills = _sub_skills(raw_sub_skills) if isinstance(raw_sub_skills, list) else None
    return ScreenshotReading(
        species=_str(data.get("species")),
        level=_int(data.get("level")),
        nature=_str(data.get("nature")),
        ingredients=(ingredients + (None, None, None))[:3],
        sub_skills=sub_skills,
        skill_level=_int(data.get("skill_level")),
        sleep_hours=_int(data.get("sleep_hours")),
        versatile_skill=_str(data.get("versatile_skill")),
    )
