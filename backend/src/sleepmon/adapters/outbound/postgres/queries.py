"""SQL construido con PyPika. Todas las queries usan placeholders ``%s`` para que
psycopg parametrice los valores (nunca interpolamos datos del usuario)."""

from __future__ import annotations

from pypika import Order, Parameter, Query, Table

member = Table("team_member")
subskill = Table("team_member_subskill")
ingredient = Table("team_member_ingredient")

_P = Parameter("%s")

INSERT_MEMBER = (
    Query.into(member)
    .columns("id", "species", "level", "nature")
    .insert(_P, _P, _P, _P)
    .get_sql()
)

INSERT_SUBSKILL = (
    Query.into(subskill).columns("member_id", "slot", "sub_skill").insert(_P, _P, _P).get_sql()
)

INSERT_INGREDIENT = (
    Query.into(ingredient).columns("member_id", "slot", "ingredient").insert(_P, _P, _P).get_sql()
)

_MEMBER_COLS = (member.id, member.species, member.level, member.nature)

SELECT_MEMBERS_ALL = (
    Query.from_(member).select(*_MEMBER_COLS).orderby(member.created_at, order=Order.asc).get_sql()
)

SELECT_MEMBER_BY_ID = (
    Query.from_(member).select(*_MEMBER_COLS).where(member.id == _P).get_sql()
)

# El valor (sub_skill / ingredient) se aliasea a ``value`` para que ambas tablas
# de hijos compartan la misma forma de fila tipada en el repositorio.
SELECT_SUBSKILLS_ALL = (
    Query.from_(subskill)
    .select(subskill.member_id, subskill.slot, subskill.sub_skill.as_("value"))
    .orderby(subskill.member_id)
    .orderby(subskill.slot)
    .get_sql()
)

SELECT_SUBSKILLS_BY_MEMBER = (
    Query.from_(subskill)
    .select(subskill.slot, subskill.sub_skill.as_("value"))
    .where(subskill.member_id == _P)
    .orderby(subskill.slot)
    .get_sql()
)

SELECT_INGREDIENTS_ALL = (
    Query.from_(ingredient)
    .select(ingredient.member_id, ingredient.slot, ingredient.ingredient.as_("value"))
    .orderby(ingredient.member_id)
    .orderby(ingredient.slot)
    .get_sql()
)

SELECT_INGREDIENTS_BY_MEMBER = (
    Query.from_(ingredient)
    .select(ingredient.slot, ingredient.ingredient.as_("value"))
    .where(ingredient.member_id == _P)
    .orderby(ingredient.slot)
    .get_sql()
)

UPDATE_MEMBER = (
    Query.update(member)
    .set(member.species, _P)
    .set(member.level, _P)
    .set(member.nature, _P)
    .where(member.id == _P)
    .get_sql()
)

DELETE_SUBSKILLS_BY_MEMBER = (
    Query.from_(subskill).where(subskill.member_id == _P).delete().get_sql()
)

DELETE_INGREDIENTS_BY_MEMBER = (
    Query.from_(ingredient).where(ingredient.member_id == _P).delete().get_sql()
)

DELETE_MEMBER = Query.from_(member).where(member.id == _P).delete().get_sql()
