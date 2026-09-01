"""SQL construido con PyPika. Todas las queries usan placeholders ``%s`` para que
psycopg parametrice los valores (nunca interpolamos datos del usuario)."""

from __future__ import annotations

from typing import cast

from pypika import Order, Parameter, PostgreSQLQuery, Query, Table
from pypika.dialects import PostgreSQLQueryBuilder
from pypika.terms import Function

member = Table("team_member")
subskill = Table("team_member_subskill")
ingredient = Table("team_member_ingredient")

_P = Parameter("%s")

INSERT_MEMBER = (
    Query.into(member)
    .columns("id", "species", "level", "nature", "ribbon", "skill_level", "user_id")
    .insert(_P, _P, _P, _P, _P, _P, _P)
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
    Query.from_(member)
    .select(*_MEMBER_COLS)
    .where(member.user_id == _P)
    .orderby(member.created_at, order=Order.asc)
    .get_sql()
)

SELECT_MEMBER_BY_ID = (
    Query.from_(member)
    .select(*_MEMBER_COLS)
    .where((member.id == _P) & (member.user_id == _P))
    .get_sql()
)

# El valor (sub_skill / ingredient) se aliasea a ``value`` para que ambas tablas
# de hijos compartan la misma forma de fila tipada en el repositorio. Scopeadas al
# usuario vía subquery sobre los miembros que le pertenecen.
SELECT_SUBSKILLS_ALL = (
    Query.from_(subskill)
    .select(subskill.member_id, subskill.slot, subskill.sub_skill.as_("value"))
    .where(
        subskill.member_id.isin(
            Query.from_(member).select(member.id).where(member.user_id == _P)
        )
    )
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
    .where(
        ingredient.member_id.isin(
            Query.from_(member).select(member.id).where(member.user_id == _P)
        )
    )
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
    .where((member.id == _P) & (member.user_id == _P))
    .get_sql()
)

DELETE_SUBSKILLS_BY_MEMBER = (
    Query.from_(subskill).where(subskill.member_id == _P).delete().get_sql()
)

DELETE_INGREDIENTS_BY_MEMBER = (
    Query.from_(ingredient).where(ingredient.member_id == _P).delete().get_sql()
)

DELETE_MEMBER = (
    Query.from_(member).where((member.id == _P) & (member.user_id == _P)).delete().get_sql()
)

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

progress = Table("player_progress")

_PROGRESS_COLS = (
    progress.pot_size,
    progress.recipe_levels,
    progress.favorite_recipes,
    progress.area_bonuses,
)

SELECT_PROGRESS = (
    Query.from_(progress).select(*_PROGRESS_COLS).where(progress.user_id == _P).get_sql()
)

# Locks the row for the read-modify-write in ``transform``: two tabs saving at once
# serialize instead of one clobbering the other's update.
SELECT_PROGRESS_FOR_UPDATE = (
    Query.from_(progress)
    .select(*_PROGRESS_COLS)
    .where(progress.user_id == _P)
    .for_update()
    .get_sql()
)

# Make the row exist before locking it: SELECT ... FOR UPDATE locks nothing when
# it is absent, so two concurrent first-writes would race instead of serializing.

# cast: PyPika's insert() types as the base QueryBuilder, but on_conflict/do_update/
# do_nothing only exist on PostgreSQLQueryBuilder, which is what runs at runtime.
ENSURE_PROGRESS_ROW = (
    cast(
        PostgreSQLQueryBuilder,
        PostgreSQLQuery.into(progress).columns("user_id").insert(_P),
    )
    .on_conflict(progress.user_id)
    .do_nothing()
    .get_sql()
)

UPSERT_PROGRESS = (
    cast(
        PostgreSQLQueryBuilder,
        PostgreSQLQuery.into(progress)
        .columns("user_id", "pot_size", "recipe_levels", "favorite_recipes", "area_bonuses")
        .insert(_P, _P, _P, _P, _P),
    )
    .on_conflict(progress.user_id)
    .do_update("pot_size")
    .do_update("recipe_levels")
    .do_update("favorite_recipes")
    .do_update("area_bonuses")
    .do_update("updated_at", Function("now"))
    .get_sql()
)
