from sleepmon.domain import analytics
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.value_objects import Ingredient, Nature, NatureStat, SubSkill


def member(
    nature: Nature, ingredients: tuple[Ingredient, ...], subs: tuple[SubSkill, ...]
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


def test_ingredient_distribution_counts_all_slots() -> None:
    team = [
        member(Nature.ADAMANT, (Ingredient.FANCY_APPLE, Ingredient.WARMING_GINGER), ()),
        member(Nature.BOLD, (Ingredient.FANCY_APPLE,), ()),
    ]
    dist = analytics.ingredient_distribution(team)
    assert dist[Ingredient.FANCY_APPLE] == 2
    assert dist[Ingredient.WARMING_GINGER] == 1


def test_sub_skill_distribution_counts() -> None:
    team = [
        member(Nature.ADAMANT, (Ingredient.FANCY_APPLE,), (SubSkill.HELPING_BONUS,)),
        member(
            Nature.BOLD,
            (Ingredient.FANCY_APPLE,),
            (SubSkill.HELPING_BONUS, SubSkill.INVENTORY_UP_S),
        ),
    ]
    dist = analytics.sub_skill_distribution(team)
    assert dist[SubSkill.HELPING_BONUS] == 2
    assert dist[SubSkill.INVENTORY_UP_S] == 1


def test_nature_distribution_counts_members() -> None:
    team = [
        member(Nature.ADAMANT, (Ingredient.FANCY_APPLE,), ()),
        member(Nature.ADAMANT, (Ingredient.FANCY_APPLE,), ()),
        member(Nature.BOLD, (Ingredient.FANCY_APPLE,), ()),
    ]
    dist = analytics.nature_distribution(team)
    assert dist[Nature.ADAMANT] == 2
    assert dist[Nature.BOLD] == 1


def test_nature_stat_balance_nets_up_and_down() -> None:
    # Adamant: +Speed of Help, -Ingredient Finding. Modest: +Ingredient Finding, -Speed of Help.
    team = [
        member(Nature.ADAMANT, (Ingredient.FANCY_APPLE,), ()),
        member(Nature.MODEST, (Ingredient.FANCY_APPLE,), ()),
    ]
    balance = analytics.nature_stat_balance(team)
    assert balance[NatureStat.SPEED_OF_HELP] == 0
    assert balance[NatureStat.INGREDIENT_FINDING] == 0


def test_neutral_nature_does_not_move_balance() -> None:
    team = [member(Nature.HARDY, (Ingredient.FANCY_APPLE,), ())]
    balance = analytics.nature_stat_balance(team)
    assert all(v == 0 for v in balance.values())
