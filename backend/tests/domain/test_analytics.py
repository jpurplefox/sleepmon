from sleepmon.domain import analytics
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.value_objects import Ingredient, Nature, NatureStat, SubSkill

_THREE = (Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER, Ingredient.FANCY_EGG)


def member(
    nature: Nature | None,
    ingredients: tuple[Ingredient, ...] = _THREE,
    subs: tuple[SubSkill, ...] = (),
) -> TeamMember:
    return TeamMember(
        species="Pikachu",
        level=80,
        nature=nature,
        ingredients=ingredients,
        sub_skills=subs,
    )


def test_empty_team_distributions_are_empty() -> None:
    assert analytics.nature_distribution([]) == {}
    assert analytics.ingredient_distribution([]) == {}
    assert analytics.sub_skill_distribution([]) == {}
    # nature_stat_balance no devuelve {} sino todos los stats en 0.
    assert analytics.nature_stat_balance([]) == {stat: 0 for stat in NatureStat}


def test_ingredient_distribution_counts_all_slots() -> None:
    team = [
        member(Nature.ADAMANT, _THREE),  # Fancy Apple, Warming Ginger, Fancy Egg
        member(Nature.BOLD, (Ingredient.FANCY_APPLE, Ingredient.FANCY_EGG, Ingredient.FANCY_EGG)),
    ]
    dist = analytics.ingredient_distribution(team)
    assert dist[Ingredient.FANCY_APPLE] == 2  # un slot en cada miembro
    assert dist[Ingredient.WARMING_GINGER] == 1  # solo el primer miembro
    assert dist[Ingredient.FANCY_EGG] == 3  # uno + dos slots


def test_sub_skill_distribution_counts() -> None:
    team = [
        member(Nature.ADAMANT, subs=(SubSkill.HELPING_BONUS,)),
        member(Nature.BOLD, subs=(SubSkill.HELPING_BONUS, SubSkill.INVENTORY_UP_S)),
    ]
    dist = analytics.sub_skill_distribution(team)
    assert dist[SubSkill.HELPING_BONUS] == 2
    assert dist[SubSkill.INVENTORY_UP_S] == 1


def test_nature_distribution_counts_members() -> None:
    team = [
        member(Nature.ADAMANT),
        member(Nature.ADAMANT),
        member(Nature.BOLD),
    ]
    dist = analytics.nature_distribution(team)
    assert dist[Nature.ADAMANT] == 2
    assert dist[Nature.BOLD] == 1


def test_nature_distribution_ignores_members_without_nature() -> None:
    # Los miembros sin naturaleza (None) no se cuentan en la distribución.
    team = [
        member(Nature.ADAMANT),
        member(None),
        member(None),
    ]
    dist = analytics.nature_distribution(team)
    assert dist == {Nature.ADAMANT: 1}


def test_nature_stat_balance_ignores_members_without_nature() -> None:
    # Un miembro sin naturaleza no aporta nada al balance.
    team = [
        member(Nature.ADAMANT),
        member(None),
    ]
    balance = analytics.nature_stat_balance(team)
    # Solo Adamant cuenta: +Speed of Help, -Ingredient Finding.
    assert balance[NatureStat.SPEED_OF_HELP] == 1
    assert balance[NatureStat.INGREDIENT_FINDING] == -1


def test_nature_stat_balance_nets_up_and_down() -> None:
    # Adamant: +Speed of Help, -Ingredient Finding. Modest: +Ingredient Finding, -Speed of Help.
    team = [
        member(Nature.ADAMANT),
        member(Nature.MODEST),
    ]
    balance = analytics.nature_stat_balance(team)
    assert balance[NatureStat.SPEED_OF_HELP] == 0
    assert balance[NatureStat.INGREDIENT_FINDING] == 0


def test_neutral_nature_does_not_move_balance() -> None:
    team = [member(Nature.HARDY)]
    balance = analytics.nature_stat_balance(team)
    assert all(v == 0 for v in balance.values())
