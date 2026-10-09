import pytest

from sleepmon.domain.errors import ValidationError
from sleepmon.domain.species import SEED_SPECIES, Species
from sleepmon.domain.versatile import (
    DEFAULT_VERSATILE_SKILL,
    VERSATILE_SKILLS,
    resolve_versatile,
)


def _by_name(name: str) -> Species:
    return next(sp for sp in SEED_SPECIES if sp.name == name)


def test_versatile_offers_the_twelve_game_skills() -> None:
    assert VERSATILE_SKILLS == (
        "Charge Strength S (Random)",
        "Charge Strength M",
        "Dream Shard Magnet S (Random)",
        "Ingredient Magnet S",
        "Charge Energy S",
        "Energizing Cheer S",
        "Energy for Everyone S",
        "Tasty Chance S",
        "Cooking Power-Up S",
        "Extra Helpful S",
        "Metronome",
        "Berry Burst",
    )
    assert DEFAULT_VERSATILE_SKILL == "Metronome"


def test_mew_takes_the_chosen_skill_and_its_rate() -> None:
    mew = resolve_versatile(_by_name("Mew"), "Charge Strength S (Random)")
    assert mew.name == "Mew"
    assert mew.main_skill == "Charge Strength S (Random)"
    assert mew.skill_percentage == 6.4


@pytest.mark.parametrize(
    ("skill", "rate"),
    [
        ("Charge Energy S", 6.4),
        ("Energizing Cheer S", 4.39),
        ("Energy for Everyone S", 3.37),
        ("Berry Burst", 2.84),
        ("Ingredient Magnet S", 4),
    ],
)
def test_mew_skill_rate_depends_on_the_chosen_skill(skill: str, rate: float) -> None:
    assert resolve_versatile(_by_name("Mew"), skill).skill_percentage == rate


def test_mew_without_a_choice_uses_metronome() -> None:
    assert resolve_versatile(_by_name("Mew"), None).main_skill == "Metronome"


def test_mew_rejects_a_skill_outside_the_versatile_list() -> None:
    with pytest.raises(ValidationError):
        resolve_versatile(_by_name("Mew"), "Ingredient Draw S")


def test_other_species_are_left_alone() -> None:
    pikachu = _by_name("Pikachu")
    assert resolve_versatile(pikachu, None) is pikachu


def test_other_species_reject_a_versatile_skill() -> None:
    with pytest.raises(ValidationError):
        resolve_versatile(_by_name("Pikachu"), "Charge Strength M")
