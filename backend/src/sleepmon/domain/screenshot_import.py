"""Screenshot import (PRD 0019): turn a model's untrusted reading into a form-ready config."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime, time, timedelta
from enum import StrEnum
from typing import Final, TypeVar

from sleepmon.domain.catalog_data import (
    MAX_LEVEL,
    MAX_SKILL_LEVEL_ABSOLUTE,
    MAX_SUB_SKILLS,
    RIBBON_HOURS,
)
from sleepmon.domain.errors import PokemonNotRecognizedError, ValidationError
from sleepmon.domain.species import Species
from sleepmon.domain.value_objects import Ingredient, Nature, Ribbon, SubSkill
from sleepmon.domain.versatile import VERSATILE, VERSATILE_SKILLS

MAX_SCREENSHOTS: Final = 3
MAX_SCREENSHOT_BYTES: Final = 1_500_000
SCREENSHOT_MEDIA_TYPES: Final = frozenset({"image/png", "image/jpeg", "image/webp"})
DAILY_IMPORT_LIMIT: Final = 50
INGREDIENT_SLOTS: Final = 3

_E = TypeVar("_E", bound=StrEnum)


class ImportField(StrEnum):
    """A form field a reading can leave unread, in the form's order."""

    SPECIES = "species"
    NATURE = "nature"
    LEVEL = "level"
    INGREDIENTS = "ingredients"
    SUB_SKILLS = "sub_skills"
    SKILL_LEVEL = "skill_level"
    RIBBON = "ribbon"


@dataclass(frozen=True, slots=True)
class Screenshot:
    media_type: str
    data: bytes = field(repr=False)

    def __post_init__(self) -> None:
        if self.media_type not in SCREENSHOT_MEDIA_TYPES:
            raise ValidationError("Las imágenes tienen que ser PNG, JPEG o WebP.")
        if not self.data:
            raise ValidationError("Una de las imágenes está vacía.")
        if len(self.data) > MAX_SCREENSHOT_BYTES:
            raise ValidationError("Una de las imágenes es demasiado grande.")


def validate_screenshots(images: Sequence[Screenshot]) -> None:
    if not 1 <= len(images) <= MAX_SCREENSHOTS:
        raise ValidationError(f"Subí entre 1 y {MAX_SCREENSHOTS} imágenes.")


@dataclass(frozen=True, slots=True)
class ScreenshotReading:
    """What the model says it sees. Raw and untrusted; ``None`` means not visible."""

    species: str | None = None
    level: int | None = None
    nature: str | None = None
    ingredients: tuple[str | None, ...] = (None, None, None)
    sub_skills: tuple[str, ...] | None = None
    skill_level: int | None = None
    # Whole hours of "Sleeping Time Shared"; the ribbon is derived from them.
    sleep_hours: int | None = None
    versatile_skill: str | None = None


@dataclass(frozen=True, slots=True)
class ImportedConfig:
    species: str | None
    level: int | None
    nature: Nature | None
    ingredients: tuple[Ingredient | None, ...]
    sub_skills: tuple[SubSkill, ...]
    skill_level: int | None
    ribbon: Ribbon | None
    versatile_skill: str | None
    unread: frozenset[ImportField]


def resolve_reading(
    reading: ScreenshotReading, lookup: Callable[[str], Species | None]
) -> ImportedConfig:
    """Keep only values the catalog accepts; everything else becomes an unread field.

    An unrecognized species still returns what was read, unless nothing was.
    """
    species = lookup(reading.species) if reading.species else None

    unread: set[ImportField] = set()
    if species is None:
        unread.add(ImportField.SPECIES)

    level = _int_in(reading.level, 1, MAX_LEVEL)
    if level is None:
        unread.add(ImportField.LEVEL)

    nature = _enum(Nature, reading.nature)
    if nature is None:
        unread.add(ImportField.NATURE)

    ingredients = _ingredients(species, reading.ingredients)
    if None in ingredients:
        unread.add(ImportField.INGREDIENTS)

    sub_skills, sub_skills_complete = _sub_skills(reading.sub_skills)
    if not sub_skills_complete:
        unread.add(ImportField.SUB_SKILLS)

    skill_level = _int_in(reading.skill_level, 1, MAX_SKILL_LEVEL_ABSOLUTE)
    if skill_level is None:
        unread.add(ImportField.SKILL_LEVEL)

    ribbon = ribbon_for_hours(reading.sleep_hours)
    if ribbon is None:
        unread.add(ImportField.RIBBON)

    versatile = (
        reading.versatile_skill
        if species is not None
        and species.main_skill == VERSATILE
        and reading.versatile_skill in VERSATILE_SKILLS
        else None
    )

    if species is None and _nothing_read(
        level, nature, ingredients, sub_skills, skill_level, ribbon
    ):
        raise PokemonNotRecognizedError("No pudimos reconocer un Pokémon en estas imágenes.")

    return ImportedConfig(
        species=species.name if species is not None else None,
        level=level,
        nature=nature,
        ingredients=ingredients,
        sub_skills=sub_skills,
        skill_level=skill_level,
        ribbon=ribbon,
        versatile_skill=versatile,
        unread=frozenset(unread),
    )


def ribbon_for_hours(hours: int | None) -> Ribbon | None:
    """The ribbon earned after ``hours`` of shared sleep: the highest threshold reached."""
    if isinstance(hours, bool) or not isinstance(hours, int) or hours < 0:
        return None
    return max((r for r, h in RIBBON_HOURS.items() if h <= hours), key=RIBBON_HOURS.__getitem__)


def next_reset(now: datetime) -> datetime:
    """The next 00:00 UTC, when the daily import count starts over."""
    tomorrow = now.astimezone(UTC).date() + timedelta(days=1)
    return datetime.combine(tomorrow, time(), tzinfo=UTC)


def _int_in(value: object, low: int, high: int) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value if low <= value <= high else None


def _enum(kind: type[_E], value: str | None) -> _E | None:
    if value is None:
        return None
    try:
        return kind(value)
    except ValueError:
        return None


def _nothing_read(*values: object) -> bool:
    return all(v is None or (isinstance(v, tuple) and all(x is None for x in v)) for v in values)


def _ingredients(
    species: Species | None, raw: tuple[str | None, ...]
) -> tuple[Ingredient | None, ...]:
    padded = (tuple(raw) + (None,) * INGREDIENT_SLOTS)[:INGREDIENT_SLOTS]
    resolved: list[Ingredient | None] = []
    for slot, name in enumerate(padded):
        ingredient = _enum(Ingredient, name)
        # Without a species the slot pool is unknown; the form checks it once one is picked.
        ok = ingredient is not None and (
            species is None or species.allows_ingredient(slot, ingredient)
        )
        resolved.append(ingredient if ok else None)
    return tuple(resolved)


def _sub_skills(raw: tuple[str, ...] | None) -> tuple[tuple[SubSkill, ...], bool]:
    """The valid sub skills in order, and whether the reading was usable as a whole."""
    if raw is None:
        return (), False
    seen: list[SubSkill] = []
    complete = True
    for name in raw:
        skill = _enum(SubSkill, name)
        if skill is None or skill in seen:
            complete = False
            continue
        seen.append(skill)
    if len(seen) > MAX_SUB_SKILLS:
        complete = False
    return tuple(seen[:MAX_SUB_SKILLS]), complete
