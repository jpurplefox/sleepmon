"""Evolution lines: lookup by the candy label or by any member, and their sheets."""

from __future__ import annotations

import pytest

from sleepmon.adapters.outbound.bedrock.lines import _lines, find_line
from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog


@pytest.mark.parametrize(
    "name", ["Dwebble", "dwebble", " Crustle ", "Dweeble", "Dweeble Candies", "Caramelos Dwebble"]
)
def test_finds_a_line_by_its_candy_or_any_member(name: str) -> None:
    line = find_line(name)
    assert line is not None
    assert line.candy == "Dwebble"
    assert line.members == ("Dwebble", "Crustle")
    assert line.sheet_webp[:4] == b"RIFF"


def test_costume_forms_join_their_species_line() -> None:
    line = find_line("Pikachu")
    assert line is not None
    assert {"Pichu", "Pikachu", "Raichu", "Pikachu (Halloween)"} <= set(line.members)


@pytest.mark.parametrize("name", [None, "", "Agumon", "Dunsparce"])
def test_an_unknown_candy_has_no_line(name: str | None) -> None:
    assert find_line(name) is None


def test_every_catalog_species_is_in_exactly_one_line() -> None:
    members = [m for line in _lines().values() for m in line]
    assert sorted(members) == sorted(s.name for s in StaticSpeciesCatalog().all())


def test_every_line_has_its_sheet() -> None:
    # find_line reads the sheet from disk: a line added to the JSON without one would
    # crash the screenshot import (as Misdreavus did).
    for candy in _lines():
        line = find_line(candy)
        assert line is not None
        assert line.sheet_webp[:4] == b"RIFF", candy
