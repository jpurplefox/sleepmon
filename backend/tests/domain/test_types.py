"""Tests del tipo elemental y su bijección con la baya."""

from sleepmon.domain.species import SEED_SPECIES
from sleepmon.domain.value_objects import BERRY_TYPE, Berry, Type


def test_type_enum_has_the_18_game_types() -> None:
    assert len(Type) == 18


def test_berry_type_is_a_bijection() -> None:
    # Una baya por tipo: el mapa es inyectivo y cubre los 18 tipos.
    assert len(set(BERRY_TYPE.values())) == len(BERRY_TYPE) == len(Type)


def test_every_seeded_berry_has_a_type() -> None:
    used = {sp.berry for sp in SEED_SPECIES}
    missing = used - BERRY_TYPE.keys()
    assert not missing, f"bayas sin tipo en BERRY_TYPE: {missing}"


def test_species_type_is_derived_from_berry() -> None:
    for sp in SEED_SPECIES:
        assert sp.type is BERRY_TYPE[sp.berry]


def test_known_berry_types() -> None:
    # Anclas verificadas contra fuentes (serebii/RaenonX) y la consistencia del seed.
    assert BERRY_TYPE[Berry.DURIN] is Type.GRASS
    assert BERRY_TYPE[Berry.LEPPA] is Type.FIRE
    assert BERRY_TYPE[Berry.ORAN] is Type.WATER
    assert BERRY_TYPE[Berry.BLUK] is Type.GHOST
    assert BERRY_TYPE[Berry.BELUE] is Type.STEEL
