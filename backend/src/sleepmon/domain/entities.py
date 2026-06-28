"""Entidades del dominio."""

from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID, uuid4

from sleepmon.domain.catalog_data import (
    MAX_INGREDIENTS,
    MAX_LEVEL,
    MAX_SKILL_LEVEL_ABSOLUTE,
    MAX_SUB_SKILLS,
)
from sleepmon.domain.errors import ValidationError
from sleepmon.domain.value_objects import Ingredient, Nature, Ribbon, SubSkill

# Invariantes de un miembro que dependen solo de sus propios datos. Viven sueltas
# (no solo dentro de ``TeamMember.__post_init__``) para que la capa de aplicación
# pueda reusarlas EXACTAMENTE —p. ej. al estimar producción de un Pokémon que no se
# persiste— sin que las reglas se bifurquen entre caminos.


def validate_level(level: int) -> None:
    """Nivel: entero real (bool/float fuera) dentro de ``[1, MAX_LEVEL]``."""
    # bool es subtipo de int (True == 1): rechazarlo explícitamente, igual que
    # cualquier valor que no sea un entero real (p. ej. un float colado).
    if isinstance(level, bool) or not isinstance(level, int):
        raise ValidationError(f"El nivel debe ser un entero; llegó {level!r}.")
    if not 1 <= level <= MAX_LEVEL:
        raise ValidationError(f"El nivel debe estar entre 1 y {MAX_LEVEL}; llegó {level}.")


def validate_ingredient_count(ingredients: tuple[Ingredient, ...]) -> None:
    """Un Pokémon tiene EXACTAMENTE un ingrediente por slot (``MAX_INGREDIENTS``).

    Los ingredientes están siempre definidos para los tres slots (el nivel solo
    decide cuáles están activos), así que no puede haber ni más ni menos.
    """
    if len(ingredients) != MAX_INGREDIENTS:
        raise ValidationError(
            f"Un Pokémon tiene exactamente {MAX_INGREDIENTS} ingredientes (uno por slot); "
            f"llegaron {len(ingredients)}."
        )


def validate_sub_skills(sub_skills: tuple[SubSkill, ...]) -> None:
    """Hasta ``MAX_SUB_SKILLS`` sub skills, sin repetir. No se acotan por nivel."""
    if len(sub_skills) > MAX_SUB_SKILLS:
        raise ValidationError(
            f"Un Pokémon tiene hasta {MAX_SUB_SKILLS} sub skills; llegaron {len(sub_skills)}."
        )
    if len(set(sub_skills)) != len(sub_skills):
        raise ValidationError("Las sub skills no pueden repetirse.")


def validate_skill_level(skill_level: int) -> None:
    """Nivel de main skill: entero real (bool/float fuera) en ``[1, MAX_SKILL_LEVEL_ABSOLUTE]``.

    Es la cota absoluta entre todas las skills (Dream Shard Magnet S llega a 8); el tope
    real por skill lo decide cada tabla en ``domain/skills.py``.
    """
    if isinstance(skill_level, bool) or not isinstance(skill_level, int):
        raise ValidationError(f"El nivel de skill debe ser un entero; llegó {skill_level!r}.")
    if not 1 <= skill_level <= MAX_SKILL_LEVEL_ABSOLUTE:
        raise ValidationError(
            f"El nivel de skill debe estar entre 1 y {MAX_SKILL_LEVEL_ABSOLUTE}; "
            f"llegó {skill_level}."
        )


@dataclass(frozen=True, slots=True)
class TeamMember:
    """Un Pokémon de tu equipo, con su naturaleza, sub skills e ingredientes.

    Las invariantes que dependen solo del propio miembro (rango de nivel, cantidad
    de ingredientes/sub skills, sub skills distintas) se validan acá. La validación
    que cruza con el catálogo de especies (ingredientes válidos para *esta* especie)
    vive en la capa de aplicación.

    Tanto los ingredientes (slots de nivel 1/30/60) como las sub skills (slots de
    nivel 10/25/50/70/80) ya están definidos para el individuo desde el inicio, así
    que se registran completos sin importar el nivel; el nivel solo determina cuáles
    están *activos*. Los ingredientes son SIEMPRE los tres (uno por slot); las sub
    skills, hasta cinco y sin repetir.
    """

    species: str
    level: int
    nature: Nature | None
    ingredients: tuple[Ingredient, ...]
    sub_skills: tuple[SubSkill, ...] = ()
    ribbon: Ribbon = Ribbon.NONE
    # Nivel de la main skill (1..MAX_SKILL_LEVEL): se sube aparte del nivel del
    # Pokémon (caramelos, sub skills de Skill Level Up). Determina la salida de las
    # skills que escalan por nivel, como Ingredient Draw S.
    skill_level: int = 1
    id: UUID = field(default_factory=uuid4)

    def __post_init__(self) -> None:
        if not self.species or not self.species.strip():
            raise ValidationError("La especie no puede estar vacía.")
        validate_level(self.level)
        validate_skill_level(self.skill_level)
        validate_ingredient_count(self.ingredients)
        validate_sub_skills(self.sub_skills)
