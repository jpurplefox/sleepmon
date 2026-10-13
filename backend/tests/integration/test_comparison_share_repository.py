"""Tests of the Postgres shared-comparison adapter. Require a real database (docker compose).

Run against the dedicated test database (see ``conftest.py``). Marked ``integration``.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import replace
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from psycopg_pool import ConnectionPool

from sleepmon.adapters.outbound.postgres.pool import create_pool
from sleepmon.adapters.outbound.postgres.repository import (
    PostgresComparisonShareRepository,
    PostgresUserRepository,
)
from sleepmon.domain.auth import User
from sleepmon.domain.comparison_share import (
    SharedComparison,
    SharedMap,
    ShareImage,
    ShareLanguage,
)
from sleepmon.domain.entities import TeamMember
from sleepmon.domain.sleep import SleepSchedule
from sleepmon.domain.value_objects import (
    Berry,
    Ingredient,
    Island,
    Nature,
    Ribbon,
    SubSkill,
    WeeklyBonus,
)

pytestmark = pytest.mark.integration

JPEG = ShareImage("image/jpeg", b"\xff\xd8\xff\xe0" + bytes(range(256)))


@pytest.fixture
def pool(test_dsn: str) -> Iterator[ConnectionPool]:
    pool = create_pool(test_dsn)
    with pool.connection() as conn:
        conn.execute("TRUNCATE app_user, comparison_share CASCADE")
    yield pool
    pool.close()


def _user(pool: ConnectionPool) -> UUID:
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


def _share(share_id: str = "share0000001") -> SharedComparison:
    return SharedComparison(
        id=share_id,
        members=(
            TeamMember(
                species="Pikachu",
                level=30,
                nature=Nature.ADAMANT,
                ingredients=(
                    Ingredient.FANCY_APPLE,
                    Ingredient.WARMING_GINGER,
                    Ingredient.FANCY_EGG,
                ),
                sub_skills=(SubSkill.BERRY_FINDING_S,),
                ribbon=Ribbon.NONE,
                skill_level=3,
            ),
            TeamMember(
                species="Pikachu",
                level=10,
                nature=None,
                ingredients=(
                    Ingredient.FANCY_APPLE,
                    Ingredient.FANCY_APPLE,
                    Ingredient.FANCY_APPLE,
                ),
            ),
        ),
        map=SharedMap(
            island=Island.GREENGRASS_EXPERT,
            favorites=(None, Berry.ORAN),
            weekly_bonus=WeeklyBonus.SKILL_TRIGGER,
        ),
        language=ShareLanguage.EN,
        sleep=SleepSchedule(night_minutes=420, nap_minutes=120),
        created_at=datetime(2026, 10, 1, 12, 0, tzinfo=UTC),
        last_opened_at=datetime(2026, 10, 1, 12, 0, tzinfo=UTC),
    )


def _same(a: SharedComparison, b: SharedComparison) -> bool:
    """Equal but for the members' ids, which a share doesn't keep."""
    strip = [(m.species, m.level, m.nature, m.ingredients, m.sub_skills) for m in a.members]
    other = [(m.species, m.level, m.nature, m.ingredients, m.sub_skills) for m in b.members]
    return strip == other and (
        a.id,
        a.map,
        a.language,
        a.sleep,
        a.created_at,
        a.last_opened_at,
    ) == (b.id, b.map, b.language, b.sleep, b.created_at, b.last_opened_at)


def test_round_trips_a_share_and_its_image(pool: ConnectionPool) -> None:
    repo = PostgresComparisonShareRepository(pool)
    repo.add(_share(), JPEG, _user(pool))

    stored = repo.get("share0000001")
    assert stored is not None
    assert _same(stored, _share())
    assert stored.members[0].skill_level == 3
    assert repo.get_image("share0000001") == JPEG


def test_an_unknown_id_reads_as_none(pool: ConnectionPool) -> None:
    repo = PostgresComparisonShareRepository(pool)
    assert repo.get("missing00000") is None
    assert repo.get_image("missing00000") is None


def test_deleting_the_account_deletes_its_shares(pool: ConnectionPool) -> None:
    repo = PostgresComparisonShareRepository(pool)
    user = _user(pool)
    repo.add(_share(), JPEG, user)

    PostgresUserRepository(pool).delete(user)

    assert repo.get("share0000001") is None


def test_a_share_made_signed_out_has_no_owner(pool: ConnectionPool) -> None:
    repo = PostgresComparisonShareRepository(pool)
    repo.add(_share(), JPEG, None)
    stored = repo.get("share0000001")
    assert stored is not None and stored.sleep == SleepSchedule(night_minutes=420, nap_minutes=120)
    with pool.connection() as conn:
        row = conn.execute(
            "SELECT user_id FROM comparison_share WHERE id = %s", ("share0000001",)
        ).fetchone()
    assert row is not None and row[0] is None


def test_a_share_without_a_nap_round_trips(pool: ConnectionPool) -> None:
    repo = PostgresComparisonShareRepository(pool)
    napless = replace(_share(), sleep=SleepSchedule(night_minutes=420, nap_minutes=None))
    repo.add(napless, JPEG, None)
    stored = repo.get("share0000001")
    assert stored is not None and stored.sleep == SleepSchedule(night_minutes=420, nap_minutes=None)


def test_touch_moves_the_last_opening(pool: ConnectionPool) -> None:
    repo = PostgresComparisonShareRepository(pool)
    repo.add(_share(), JPEG, None)
    later = datetime(2026, 11, 1, 9, 0, tzinfo=UTC)
    repo.touch("share0000001", later)
    stored = repo.get("share0000001")
    assert stored is not None and stored.last_opened_at == later


def test_delete_expired_drops_only_old_shares(pool: ConnectionPool) -> None:
    repo = PostgresComparisonShareRepository(pool)
    repo.add(_share("share0000001"), JPEG, None)
    repo.add(_share("share0000002"), JPEG, None)
    repo.touch("share0000002", datetime(2027, 1, 1, tzinfo=UTC))

    assert repo.delete_expired(datetime(2026, 12, 1, tzinfo=UTC)) == 1
    assert repo.get("share0000001") is None
    assert repo.get("share0000002") is not None


def test_deleting_an_account_keeps_shares_made_signed_out(pool: ConnectionPool) -> None:
    repo = PostgresComparisonShareRepository(pool)
    user = _user(pool)
    repo.add(_share("share0000001"), JPEG, user)
    repo.add(_share("share0000002"), JPEG, None)

    PostgresUserRepository(pool).delete(user)

    assert repo.get("share0000001") is None
    assert repo.get("share0000002") is not None
