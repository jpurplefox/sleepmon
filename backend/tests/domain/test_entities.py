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


def test_blank_nickname_rejected() -> None:
    with pytest.raises(ValidationError):
        make(nickname="   ")


def test_valid_nickname_is_kept() -> None:
    assert make(nickname="Sparky").nickname == "Sparky"


@pytest.mark.parametrize("level", [0, -5, 101])
def test_level_out_of_range_rejected(level: int) -> None:
    with pytest.raises(ValidationError):
        make(level=level)


def test_max_level_is_accepted() -> None:
    # Borde superior: nivel 100 (MAX_LEVEL) NO debe rechazarse.
    assert make(level=100).level == 100


def test_sub_skills_below_first_unlock_rejected() -> None:
    # Nivel < 10 no tiene slots de sub skill desbloqueados (allowed_subs == 0).
    with pytest.raises(ValidationError):
        make(level=5, ingredients=(Ingredient.FANCY_APPLE,), sub_skills=(SubSkill.HELPING_SPEED_S,))


def test_zero_ingredients_rejected() -> None:
    with pytest.raises(ValidationError):
        make(ingredients=())


def test_low_level_can_have_all_three_ingredients() -> None:
    # Los ingredientes ya están definidos para el individuo: se registran los 3
    # aunque el Pokémon sea de nivel bajo (no se acotan por nivel).
    member = make(
        level=1,
        ingredients=(Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER, Ingredient.FANCY_EGG),
        sub_skills=(),  # nivel 1 no tiene slots de sub skill todavía
    )
    assert len(member.ingredients) == 3


def test_more_than_three_ingredients_rejected() -> None:
    with pytest.raises(ValidationError):
        make(
            level=60,
            ingredients=(
                Ingredient.FANCY_APPLE,
                Ingredient.WARMING_GINGER,
                Ingredient.FANCY_EGG,
                Ingredient.HONEY,
            ),
        )


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
