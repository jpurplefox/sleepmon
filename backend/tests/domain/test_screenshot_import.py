"""Pure resolution of a model's screenshot reading against the catalog."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
from sleepmon.domain.errors import PokemonNotRecognizedError, ValidationError
from sleepmon.domain.screenshot_import import (
    MAX_SCREENSHOT_BYTES,
    ImportField,
    Screenshot,
    ScreenshotReading,
    next_reset,
    resolve_reading,
    validate_screenshots,
)
from sleepmon.domain.value_objects import Ingredient, Nature, Ribbon, SubSkill

CATALOG = StaticSpeciesCatalog()
PIKACHU = CATALOG.get("Pikachu")
assert PIKACHU is not None
SLOT0 = PIKACHU.ingredient_slots[0][0].value
SLOT1 = PIKACHU.ingredient_slots[1][-1].value
SLOT2 = PIKACHU.ingredient_slots[2][-1].value


def full_reading(**overrides: object) -> ScreenshotReading:
    base: dict[str, object] = {
        "species": "Pikachu",
        "level": 25,
        "nature": "Jolly",
        "ingredients": (SLOT0, SLOT1, SLOT2),
        "sub_skills": ("Helping Bonus", "Ingredient Finder M"),
        "skill_level": 3,
        "ribbon": "",
        "versatile_skill": None,
    }
    base.update(overrides)
    return ScreenshotReading(**base)  # type: ignore[arg-type]


def test_a_full_reading_resolves_with_nothing_unread() -> None:
    cfg = resolve_reading(full_reading(), CATALOG.get)
    assert cfg.species == "Pikachu"
    assert cfg.level == 25
    assert cfg.nature is Nature.JOLLY
    assert cfg.ingredients == (Ingredient(SLOT0), Ingredient(SLOT1), Ingredient(SLOT2))
    assert cfg.sub_skills == (SubSkill.HELPING_BONUS, SubSkill.INGREDIENT_FINDER_M)
    assert cfg.skill_level == 3
    assert cfg.ribbon is Ribbon.NONE
    assert cfg.unread == frozenset()


@pytest.mark.parametrize("species", [None, "", "Agumon"])
def test_an_unknown_species_is_not_recognized(species: str | None) -> None:
    with pytest.raises(PokemonNotRecognizedError):
        resolve_reading(full_reading(species=species), CATALOG.get)


@pytest.mark.parametrize("level", [None, 0, 101])
def test_a_missing_or_out_of_range_level_is_unread(level: int | None) -> None:
    cfg = resolve_reading(full_reading(level=level), CATALOG.get)
    assert cfg.level is None
    assert ImportField.LEVEL in cfg.unread


@pytest.mark.parametrize("nature", [None, "Grumpy"])
def test_a_missing_or_unknown_nature_is_unread(nature: str | None) -> None:
    cfg = resolve_reading(full_reading(nature=nature), CATALOG.get)
    assert cfg.nature is None
    assert ImportField.NATURE in cfg.unread


def test_locked_ingredient_slots_are_unread_but_keep_the_read_ones() -> None:
    cfg = resolve_reading(full_reading(ingredients=(SLOT0, None, None)), CATALOG.get)
    assert cfg.ingredients == (Ingredient(SLOT0), None, None)
    assert ImportField.INGREDIENTS in cfg.unread


def test_an_ingredient_the_slot_cannot_hold_is_unread() -> None:
    cfg = resolve_reading(full_reading(ingredients=("Slowpoke Tail", SLOT1, SLOT2)), CATALOG.get)
    assert cfg.ingredients[0] is None
    assert ImportField.INGREDIENTS in cfg.unread


def test_a_short_ingredient_list_is_padded_and_unread() -> None:
    cfg = resolve_reading(full_reading(ingredients=(SLOT0,)), CATALOG.get)
    assert len(cfg.ingredients) == 3
    assert ImportField.INGREDIENTS in cfg.unread


def test_sub_skills_not_shown_are_unread() -> None:
    cfg = resolve_reading(full_reading(sub_skills=None), CATALOG.get)
    assert cfg.sub_skills == ()
    assert ImportField.SUB_SKILLS in cfg.unread


def test_an_unknown_sub_skill_is_dropped_and_marks_the_field() -> None:
    cfg = resolve_reading(full_reading(sub_skills=("Helping Bonus", "Lucky")), CATALOG.get)
    assert cfg.sub_skills == (SubSkill.HELPING_BONUS,)
    assert ImportField.SUB_SKILLS in cfg.unread


def test_repeated_sub_skills_keep_the_first_and_cap_at_five() -> None:
    names = ("Helping Bonus", "Helping Bonus", "Berry Finding S", "Skill Trigger M",
             "Inventory Up L", "Helping Speed M", "Dream Shard Bonus")
    cfg = resolve_reading(full_reading(sub_skills=names), CATALOG.get)
    assert cfg.sub_skills == (
        SubSkill.HELPING_BONUS, SubSkill.BERRY_FINDING_S, SubSkill.SKILL_TRIGGER_M,
        SubSkill.INVENTORY_UP_L, SubSkill.HELPING_SPEED_M,
    )
    assert ImportField.SUB_SKILLS in cfg.unread


@pytest.mark.parametrize("skill_level", [None, 0, 9])
def test_a_missing_or_out_of_range_skill_level_is_unread(skill_level: int | None) -> None:
    cfg = resolve_reading(full_reading(skill_level=skill_level), CATALOG.get)
    assert cfg.skill_level is None
    assert ImportField.SKILL_LEVEL in cfg.unread


def test_an_empty_ribbon_is_a_read_none_but_a_missing_one_is_unread() -> None:
    assert resolve_reading(full_reading(ribbon=""), CATALOG.get).ribbon is Ribbon.NONE
    cfg = resolve_reading(full_reading(ribbon=None), CATALOG.get)
    assert cfg.ribbon is None
    assert ImportField.RIBBON in cfg.unread
    assert resolve_reading(full_reading(ribbon="500h"), CATALOG.get).ribbon is Ribbon.SLEEP_500


def test_versatile_skill_only_sticks_to_a_versatile_species() -> None:
    pikachu_reading = full_reading(versatile_skill="Metronome")
    assert resolve_reading(pikachu_reading, CATALOG.get).versatile_skill is None
    mew = CATALOG.get("Mew")
    assert mew is not None
    reading = full_reading(
        species="Mew",
        ingredients=tuple(slot[0].value for slot in mew.ingredient_slots),
        versatile_skill="Metronome",
    )
    assert resolve_reading(reading, CATALOG.get).versatile_skill == "Metronome"
    reading = full_reading(species="Mew", ingredients=reading.ingredients, versatile_skill="Nope")
    assert resolve_reading(reading, CATALOG.get).versatile_skill is None


def test_screenshot_rejects_bad_types_empty_and_oversized() -> None:
    Screenshot("image/jpeg", b"x")
    with pytest.raises(ValidationError):
        Screenshot("image/gif", b"x")
    with pytest.raises(ValidationError):
        Screenshot("image/png", b"")
    with pytest.raises(ValidationError):
        Screenshot("image/png", b"x" * (MAX_SCREENSHOT_BYTES + 1))


@pytest.mark.parametrize("count,ok", [(0, False), (1, True), (3, True), (4, False)])
def test_validate_screenshots_counts(count: int, ok: bool) -> None:
    images = [Screenshot("image/png", b"x")] * count
    if ok:
        validate_screenshots(images)
    else:
        with pytest.raises(ValidationError):
            validate_screenshots(images)


def test_next_reset_is_the_next_utc_midnight() -> None:
    now = datetime(2026, 10, 11, 23, 59, tzinfo=UTC)
    assert next_reset(now) == datetime(2026, 10, 12, tzinfo=UTC)
