"""Entidades del dominio."""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID, uuid4

from sleepmon.domain.catalog_data import MAX_INGREDIENTS, MAX_LEVEL, MAX_SUB_SKILLS
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.value_objects import Ingredient, Nature, SubSkill


@dataclass(frozen=True, slots=True)
class TeamMember:
    """Un Pokémon de tu equipo, con su naturaleza, sub skills e ingredientes.

    Las invariantes que dependen solo del propio miembro (rango de nivel, cantidad
    de ingredientes/sub skills, sub skills distintas) se validan acá. La validación
    que cruza con el catálogo de especies (ingredientes válidos para *esta* especie)
    vive en la capa de aplicación.

    Tanto los ingredientes (slots de nivel 1/30/60) como las sub skills (slots de
    nivel 10/25/50/70/80) ya están definidos para el individuo desde el inicio, así
    que se registran completos (hasta 3 y hasta 5) sin importar el nivel; el nivel
    solo determina cuáles están *activos*. Lo único que se valida acá es la cantidad
    máxima y que las sub skills no se repitan.
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

        # Las sub skills tampoco se acotan por nivel: el individuo ya las tiene
        # definidas, así que se registran hasta las 5 sin importar el nivel.
        if len(self.sub_skills) > MAX_SUB_SKILLS:
            raise ValidationError(
                f"Un Pokémon tiene hasta {MAX_SUB_SKILLS} sub skills; "
                f"llegaron {len(self.sub_skills)}."
            )
        if len(set(self.sub_skills)) != len(self.sub_skills):
            raise ValidationError("Las sub skills no pueden repetirse.")
