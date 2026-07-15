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
    .columns("id", "species", "level", "nature", "ribbon", "skill_level")
    .insert(_P, _P, _P, _P, _P, _P)
    .get_sql()
)

INSERT_SUBSKILL = (
    Query.into(subskill).columns("member_id", "slot", "sub_skill").insert(_P, _P, _P).get_sql()
)

INSERT_INGREDIENT = (
    Query.into(ingredient).columns("member_id", "slot", "ingredient").insert(_P, _P, _P).get_sql()
)

_MEMBER_COLS = (
    member.id,
    member.species,
    member.level,
    member.nature,
    member.ribbon,
    member.skill_level,
)

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
    .set(member.ribbon, _P)
    .set(member.skill_level, _P)
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

app_user = Table("app_user")
refresh_token = Table("refresh_token")

INSERT_USER = (
    Query.into(app_user)
    .columns("id", "google_sub", "email", "display_name", "avatar_url", "created_at")
    .insert(_P, _P, _P, _P, _P, _P)
    .get_sql()
)

_USER_COLS = (
    app_user.id,
    app_user.google_sub,
    app_user.email,
    app_user.display_name,
    app_user.avatar_url,
    app_user.created_at,
)

SELECT_USER_BY_SUB = (
    Query.from_(app_user).select(*_USER_COLS).where(app_user.google_sub == _P).get_sql()
)

SELECT_USER_BY_ID = Query.from_(app_user).select(*_USER_COLS).where(app_user.id == _P).get_sql()

INSERT_REFRESH = (
    Query.into(refresh_token)
    .columns("id", "family_id", "user_id", "token_hash", "consumed", "expires_at", "created_at")
    .insert(_P, _P, _P, _P, _P, _P, _P)
    .get_sql()
)

_REFRESH_COLS = (
    refresh_token.id,
    refresh_token.family_id,
    refresh_token.user_id,
    refresh_token.token_hash,
    refresh_token.consumed,
    refresh_token.expires_at,
    refresh_token.created_at,
)

SELECT_REFRESH_BY_HASH = (
    Query.from_(refresh_token)
    .select(*_REFRESH_COLS)
    .where(refresh_token.token_hash == _P)
    .get_sql()
)

CONSUME_REFRESH = (
    Query.update(refresh_token)
    .set(refresh_token.consumed, True)
    .where(refresh_token.id == _P)
    .get_sql()
)

DELETE_REFRESH_FAMILY = (
    Query.from_(refresh_token).where(refresh_token.family_id == _P).delete().get_sql()
)

DELETE_REFRESH_EXPIRED = (
    Query.from_(refresh_token).where(refresh_token.expires_at <= _P).delete().get_sql()
)
