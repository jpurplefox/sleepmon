"""Entidades del dominio."""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID, uuid4

from sleepmon.domain.catalog_data import MAX_INGREDIENTS, MAX_LEVEL, max_sub_skill_slots
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.value_objects import Ingredient, Nature, SubSkill


@dataclass(frozen=True, slots=True)
class TeamMember:
    """Un Pokémon de tu equipo, con su naturaleza, sub skills e ingredientes.

    Las invariantes que dependen solo del propio miembro (rango de nivel, cantidad
    de ingredientes/sub skills, sub skills distintas) se validan acá. La validación
    que cruza con el catálogo de especies (ingredientes válidos para *esta* especie)
    vive en la capa de aplicación.

    Los ingredientes son una tupla ordenada por slot (slot 0 = nivel 1, slot 1 =
    nivel 30, slot 2 = nivel 60). El ingrediente de cada slot ya está definido para
    el individuo desde el inicio, así que se registran los 3 sin importar el nivel
    (el nivel solo determina cuáles están *activos*). Las sub skills, en cambio, sí
    se acotan por el nivel de desbloqueo (10/25/50/70/80).
    """

    species: str
    level: int
    nature: Nature
    ingredients: tuple[Ingredient, ...]
    sub_skills: tuple[SubSkill, ...] = ()
    nickname: str | None = None
    id: UUID = field(default_factory=uuid4)

    def __post_init__(self) -> None:
        if not self.species or not self.species.strip():
            raise ValidationError("La especie no puede estar vacía.")

        if self.nickname is not None and not self.nickname.strip():
            raise ValidationError("El apodo no puede ser vacío o solo espacios.")

        if not 1 <= self.level <= MAX_LEVEL:
            raise ValidationError(f"El nivel debe estar entre 1 y {MAX_LEVEL}; llegó {self.level}.")

        # Los ingredientes NO se acotan por nivel: el individuo ya tiene su
        # ingrediente definido en cada slot, así que se registran hasta los 3
        # (= cantidad de slots de la especie) sin importar el nivel.
        if not 1 <= len(self.ingredients) <= MAX_INGREDIENTS:
            raise ValidationError(
                f"Un Pokémon tiene entre 1 y {MAX_INGREDIENTS} ingredientes; "
                f"llegaron {len(self.ingredients)}."
            )

        allowed_subs = max_sub_skill_slots(self.level)
        if len(self.sub_skills) > allowed_subs:
            raise ValidationError(
                f"Un Pokémon de nivel {self.level} tiene hasta {allowed_subs} "
                f"sub skill(s); llegaron {len(self.sub_skills)}."
            )
        if len(set(self.sub_skills)) != len(self.sub_skills):
            raise ValidationError("Las sub skills no pueden repetirse.")
