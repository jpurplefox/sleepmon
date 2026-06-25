"""Catálogo de especies servido desde el dataset en código (``SEED_SPECIES``)."""

from __future__ import annotations

from collections.abc import Sequence

from sleepmon.domain.ports import SpeciesCatalog
from sleepmon.domain.species import SEED_SPECIES, Species


class StaticSpeciesCatalog(SpeciesCatalog):
    """Implementación de solo lectura sobre el dataset semilla.

    El lookup por nombre es case-insensitive para tolerar el input del usuario.
    """

    def __init__(self, species: Sequence[Species] = SEED_SPECIES) -> None:
        self._by_name = {s.name.casefold(): s for s in species}
        self._all = tuple(species)

    def get(self, name: str) -> Species | None:
        return self._by_name.get(name.casefold())

    def all(self) -> Sequence[Species]:
        return self._all
