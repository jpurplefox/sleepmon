import pytest

from sleepmon.domain.entities import TeamMember
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.value_objects import Ingredient, Nature, SubSkill


def make(**overrides: object) -> TeamMember:
    defaults: dict[str, object] = {
        "species": "Pikachu",
        "level": 30,
        "nature": Nature.ADAMANT,
        "ingredients": (Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER),
        "sub_skills": (SubSkill.HELPING_SPEED_S,),
    }
    defaults.update(overrides)
    return TeamMember(**defaults)  # type: ignore[arg-type]


def test_valid_member_constructs() -> None:
    member = make()
    assert member.species == "Pikachu"
    assert member.id is not None


def test_empty_species_rejected() -> None:
    with pytest.raises(ValidationError):
        make(species="   ")


@pytest.mark.parametrize("level", [0, -5, 101])
def test_level_out_of_range_rejected(level: int) -> None:
    with pytest.raises(ValidationError):
        make(level=level)


def test_zero_ingredients_rejected() -> None:
    with pytest.raises(ValidationError):
        make(ingredients=())


def test_too_many_ingredients_for_level_rejected() -> None:
    # Nivel 10 solo tiene 1 slot de ingrediente.
    with pytest.raises(ValidationError):
        make(level=10, ingredients=(Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER))


def test_too_many_sub_skills_for_level_rejected() -> None:
    # Nivel 30 permite 2 sub skills (desbloqueos 10 y 25).
    with pytest.raises(ValidationError):
        make(
            level=30,
            sub_skills=(
                SubSkill.HELPING_SPEED_S,
                SubSkill.INVENTORY_UP_S,
                SubSkill.SKILL_TRIGGER_S,
            ),
        )


def test_duplicate_sub_skills_rejected() -> None:
    with pytest.raises(ValidationError):
        make(level=80, sub_skills=(SubSkill.HELPING_SPEED_S, SubSkill.HELPING_SPEED_S))


def test_five_sub_skills_allowed_at_level_80() -> None:
    member = make(
        level=80,
        ingredients=(Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER),
        sub_skills=(
            SubSkill.HELPING_SPEED_S,
            SubSkill.INVENTORY_UP_S,
            SubSkill.SKILL_TRIGGER_S,
            SubSkill.INGREDIENT_FINDER_S,
            SubSkill.BERRY_FINDING_S,
        ),
    )
    assert len(member.sub_skills) == 5
