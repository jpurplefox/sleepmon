"""Tests of the Postgres progress adapter. Require a real database (docker compose).

Run against the dedicated test database (see ``conftest.py``). Marked ``integration``.
"""

from __future__ import annotations

import contextlib
import threading
from collections.abc import Callable
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from sleepmon.adapters.outbound.postgres.pool import create_pool
from sleepmon.adapters.outbound.postgres.repository import (
    PostgresPlayerProgressRepository,
    PostgresUserRepository,
)
from sleepmon.domain.auth import User
from sleepmon.domain.progress import PlayerProgress
from sleepmon.domain.value_objects import Island, RecipeType

pytestmark = pytest.mark.integration


@pytest.fixture
def user_id(test_dsn: str) -> UUID:
    pool = create_pool(test_dsn)
    with pool.connection() as conn:
        conn.execute("TRUNCATE app_user CASCADE")  # cascades to player_progress
    user = User(
        id=uuid4(),
        google_sub=str(uuid4()),
        email="owner@x.test",
        display_name="Owner",
        avatar_url=None,
        created_at=datetime.now(UTC),
    )
    PostgresUserRepository(pool).add(user)
    return user.id


@pytest.fixture
def repo(test_dsn: str) -> PostgresPlayerProgressRepository:
    return PostgresPlayerProgressRepository(create_pool(test_dsn))


def test_a_missing_row_reads_the_defaults(
    repo: PostgresPlayerProgressRepository, user_id: UUID
) -> None:
    assert repo.get(user_id) == PlayerProgress()


def test_reading_a_missing_row_writes_nothing(
    repo: PostgresPlayerProgressRepository, user_id: UUID, test_dsn: str
) -> None:
    repo.get(user_id)
    with create_pool(test_dsn).connection() as conn:
        rows = conn.execute("SELECT count(*) FROM player_progress").fetchone()
    assert rows is not None and rows[0] == 0


def test_the_first_transform_inserts(
    repo: PostgresPlayerProgressRepository, user_id: UUID
) -> None:
    stored = repo.transform(user_id, lambda _: PlayerProgress(pot_size=33))
    assert stored.pot_size == 33
    assert repo.get(user_id).pot_size == 33


def test_a_second_transform_updates_and_sees_the_first(
    repo: PostgresPlayerProgressRepository, user_id: UUID
) -> None:
    repo.transform(user_id, lambda _: PlayerProgress(pot_size=33))
    stored = repo.transform(
        user_id,
        lambda current: PlayerProgress(
            pot_size=current.pot_size, area_bonuses={Island.CYAN_BEACH: 42}
        ),
    )
    assert stored.pot_size == 33
    bonuses = repo.get(user_id).area_bonuses
    assert bonuses == {Island.CYAN_BEACH: 42}
    # StrEnum members compare equal to their raw string, so the dict equality above
    # would pass even if ``_to_progress`` returned undecoded strings; pin the decode.
    assert isinstance(next(iter(bonuses)), Island)


def test_every_mapping_round_trips(
    repo: PostgresPlayerProgressRepository, user_id: UUID
) -> None:
    saved = PlayerProgress(
        pot_size=36,
        recipe_levels={"Beanburger Curry": 55},
        favorite_recipes={RecipeType.CURRY: "Beanburger Curry"},
        area_bonuses={Island.CYAN_BEACH: 42, Island.GREENGRASS_EXPERT: 35},
    )
    repo.transform(user_id, lambda _: saved)
    fetched = repo.get(user_id)
    assert fetched == saved
    # Same reasoning as above: StrEnum equality would hide a raw-string regression.
    assert isinstance(next(iter(fetched.favorite_recipes)), RecipeType)


def test_two_first_writes_on_a_fresh_user_do_not_clobber_each_other(
    test_dsn: str, user_id: UUID
) -> None:
    """Two concurrent, first-ever ``transform`` calls for the same row-less user must
    both survive. Without the fix, ``SELECT ... FOR UPDATE`` locks nothing when the
    row is absent, so both callers read the defaults and whichever UPSERT commits
    last wins outright, discarding the other caller's field.

    Each thread gets its own repository (and therefore its own pool/connection), and
    the barrier forces both callers past their read before either writes — otherwise
    lucky scheduling could serialize them and the race would never actually trigger.
    Once the fix serializes the two calls for real, only one caller ever reaches the
    barrier at a time, so the wait has a timeout and gives up rather than hang.
    """
    repo_a = PostgresPlayerProgressRepository(create_pool(test_dsn))
    repo_b = PostgresPlayerProgressRepository(create_pool(test_dsn))
    barrier = threading.Barrier(2)
    errors: list[BaseException] = []

    def past_read() -> None:
        with contextlib.suppress(threading.BrokenBarrierError):
            barrier.wait(timeout=2)

    def change_pot(current: PlayerProgress) -> PlayerProgress:
        past_read()
        return PlayerProgress(pot_size=33, favorite_recipes=current.favorite_recipes)

    def change_favorite(current: PlayerProgress) -> PlayerProgress:
        past_read()
        return PlayerProgress(
            pot_size=current.pot_size,
            favorite_recipes={RecipeType.CURRY: "Beanburger Curry"},
        )

    def run(
        repo: PostgresPlayerProgressRepository,
        change: Callable[[PlayerProgress], PlayerProgress],
    ) -> None:
        try:
            repo.transform(user_id, change)
        except BaseException as exc:  # noqa: BLE001 — surfaced via ``errors`` below
            errors.append(exc)

    t1 = threading.Thread(target=run, args=(repo_a, change_pot))
    t2 = threading.Thread(target=run, args=(repo_b, change_favorite))
    t1.start()
    t2.start()
    t1.join(timeout=10)
    t2.join(timeout=10)

    assert not t1.is_alive() and not t2.is_alive()
    assert not errors, errors
    stored = repo_a.get(user_id)
    assert stored.pot_size == 33
    assert stored.favorite_recipes == {RecipeType.CURRY: "Beanburger Curry"}


def test_a_key_removed_really_disappears(
    repo: PostgresPlayerProgressRepository, user_id: UUID
) -> None:
    repo.transform(user_id, lambda _: PlayerProgress(recipe_levels={"Beanburger Curry": 30}))
    repo.transform(user_id, lambda _: PlayerProgress())
    assert repo.get(user_id).recipe_levels == {}


def test_a_raising_change_leaves_the_row_untouched(
    repo: PostgresPlayerProgressRepository, user_id: UUID
) -> None:
    repo.transform(user_id, lambda _: PlayerProgress(pot_size=33))

    def explode(_: PlayerProgress) -> PlayerProgress:
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError):
        repo.transform(user_id, explode)
    assert repo.get(user_id).pot_size == 33


def test_an_unknown_key_in_the_stored_json_is_dropped_on_read(
    repo: PostgresPlayerProgressRepository, user_id: UUID, test_dsn: str
) -> None:
    # A recipe or area the catalogue no longer has must not turn the screen into a 500.
    repo.transform(user_id, lambda _: PlayerProgress(pot_size=33))
    with create_pool(test_dsn).connection() as conn:
        conn.execute(
            "UPDATE player_progress SET area_bonuses = %s::jsonb, "
            "recipe_levels = %s::jsonb, favorite_recipes = %s::jsonb WHERE user_id = %s",
            ('{"Atlantis": 40}', '{"Removed Stew": 30}', '{"Sandwich": "Ghost Sandwich"}', user_id),
        )
    progress = repo.get(user_id)
    assert progress.area_bonuses == {}
    assert progress.recipe_levels == {"Removed Stew": 30}
    assert progress.favorite_recipes == {}


def test_the_row_dies_with_its_user(
    repo: PostgresPlayerProgressRepository, user_id: UUID, test_dsn: str
) -> None:
    repo.transform(user_id, lambda _: PlayerProgress(pot_size=33))
    pool = create_pool(test_dsn)
    with pool.connection() as conn:
        conn.execute("DELETE FROM app_user WHERE id = %s", (user_id,))
        rows = conn.execute("SELECT count(*) FROM player_progress").fetchone()
    assert rows is not None and rows[0] == 0
