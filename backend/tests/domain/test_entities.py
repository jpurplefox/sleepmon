import pytest

from sleepmon.domain.entities import TeamMember
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.value_objects import Ingredient, Nature, SubSkill


def make(**overrides: object) -> TeamMember:
    defaults: dict[str, object] = {
        "species": "Pikachu",
        "level": 30,
        "nature": Nature.ADAMANT,
        "ingredients": (Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER, Ingredient.FANCY_EGG),
        "sub_skills": (SubSkill.HELPING_SPEED_S,),
    }
    defaults.update(overrides)
    return TeamMember(**defaults)  # type: ignore[arg-type]


def test_valid_member_constructs() -> None:
    member = make()
    assert member.species == "Pikachu"
    assert member.id is not None


def test_member_without_nature_is_valid() -> None:
    # naturaleza opcional: None = "sin naturaleza", sin efecto.
    member = make(nature=None)
    assert member.nature is None


def test_empty_species_rejected() -> None:
    with pytest.raises(ValidationError):
        make(species="   ")


def test_empty_string_species_rejected() -> None:
    # String vacío "" (no whitespace): ejercita la rama `not self.species`.
    with pytest.raises(ValidationError):
        make(species="")


@pytest.mark.parametrize("level", [0, -5, 101])
def test_level_out_of_range_rejected(level: int) -> None:
    with pytest.raises(ValidationError):
        make(level=level)


@pytest.mark.parametrize("level", [True, False, 30.0, 30.5])
def test_non_int_level_rejected(level: object) -> None:
    # bool (subtipo de int) y floats deben rechazarse como tipo inválido.
    with pytest.raises(ValidationError):
        make(level=level)


def test_max_level_is_accepted() -> None:
    # Borde superior: nivel 100 (MAX_LEVEL) NO debe rechazarse.
    assert make(level=100).level == 100


def test_low_level_can_have_sub_skills() -> None:
    # Las sub skills ya están definidas para el individuo: se registran aunque el
    # nivel todavía no las haya desbloqueado.
    member = make(
        level=5,
        ingredients=(Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER, Ingredient.FANCY_EGG),
        sub_skills=(SubSkill.HELPING_SPEED_S, SubSkill.INVENTORY_UP_S),
    )
    assert len(member.sub_skills) == 2


def test_zero_ingredients_rejected() -> None:
    with pytest.raises(ValidationError):
        make(ingredients=())


@pytest.mark.parametrize(
    "ingredients",
    [
        (Ingredient.FANCY_APPLE,),
        (Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER),
    ],
)
def test_fewer_than_three_ingredients_rejected(
    ingredients: tuple[Ingredient, ...],
) -> None:
    # Los ingredientes están definidos para los tres slots: ni más ni menos. Un
    # miembro con 1 o 2 ingredientes es inválido (no solo 0 o 4+).
    with pytest.raises(ValidationError, match="exactamente"):
        make(ingredients=ingredients)


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


def test_more_than_five_sub_skills_rejected() -> None:
    with pytest.raises(ValidationError):
        make(
            level=80,
            sub_skills=(
                SubSkill.HELPING_SPEED_S,
                SubSkill.INVENTORY_UP_S,
                SubSkill.SKILL_TRIGGER_S,
                SubSkill.INGREDIENT_FINDER_S,
                SubSkill.BERRY_FINDING_S,
                SubSkill.HELPING_BONUS,
            ),
        )


def test_duplicate_sub_skills_rejected() -> None:
    with pytest.raises(ValidationError):
        make(level=80, sub_skills=(SubSkill.HELPING_SPEED_S, SubSkill.HELPING_SPEED_S))


def test_five_sub_skills_allowed_at_level_80() -> None:
    member = make(
        level=80,
        ingredients=(Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER, Ingredient.FANCY_EGG),
        sub_skills=(
            SubSkill.HELPING_SPEED_S,
            SubSkill.INVENTORY_UP_S,
            SubSkill.SKILL_TRIGGER_S,
            SubSkill.INGREDIENT_FINDER_S,
            SubSkill.BERRY_FINDING_S,
        ),
    )
    assert len(member.sub_skills) == 5


def test_default_skill_level_is_one() -> None:
    assert make().skill_level == 1


def test_skill_level_within_range_is_valid() -> None:
    # 8 es válido: Dream Shard Magnet S llega a nivel 8 (cota absoluta).
    assert make(skill_level=8).skill_level == 8


@pytest.mark.parametrize("bad", [0, 9, -1])
def test_skill_level_out_of_range_rejected(bad: int) -> None:
    with pytest.raises(ValidationError):
        make(skill_level=bad)


def test_skill_level_bool_rejected() -> None:
    # bool es subtipo de int (True == 1): se rechaza explícitamente.
    with pytest.raises(ValidationError):
        make(skill_level=True)
