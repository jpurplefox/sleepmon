"""Planificador de cocina del equipo (función pura, sin infraestructura).

Dadas las recetas elegidas para las comidas del día y los ingredientes que produce
el equipo, calcula: ingredientes requeridos vs producidos (con su balance), los
sobrantes (producidos que ninguna receta usa) y la fuerza aportada por las recetas.

La fuerza se cuenta SE CUMPLAN O NO los requisitos de ingredientes.

El cumplimiento (``met``) se evalúa con asignación **greedy en orden de slot**:
se parte de ``remaining = dict(produced)`` y se itera cada comida elegida en orden.
Si ``remaining`` tiene suficientes ingredientes para esa receta, la comida se marca
``met=True`` y se restan los ingredientes de ``remaining`` (para que no los puedan
usar las comidas siguientes). Si no alcanza, ``met=False`` y ``remaining`` no cambia
(una receta más barata posterior aún puede cubrirse). Esto responde "¿cuántas de las
comidas asignadas podré cocinar realmente hoy?".

Los balances de ingredientes (``ingredients``) se calculan contra la **demanda
agregada total**: la suma de todos los slots elegidos (3× la misma receta requiere
3× los ingredientes). Esto garantiza el invariante:
``all(s.met for s in result.slots)`` ⟺ no hay ``IngredientBalance`` con
``balance < 0``.

Los sobrantes (``surplus``) son ingredientes producidos cuyo balance vs la demanda
agregada es positivo, incluyendo los producidos que ninguna receta usa.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from sleepmon.domain.recipes import Recipe, recipe_strength
from sleepmon.domain.value_objects import Ingredient


@dataclass(frozen=True, slots=True)
class MealSelection:
    """Una comida elegida: qué receta y a qué nivel."""

    recipe: Recipe
    level: int


@dataclass(frozen=True, slots=True)
class IngredientBalance:
    """Balance de un ingrediente: requerido vs producido."""

    ingredient: Ingredient
    required: float
    produced: float
    balance: float  # produced - required (negativo = falta)


@dataclass(frozen=True, slots=True)
class SlotIngredientStatus:
    """Disponibilidad de un ingrediente para una comida concreta bajo asignación greedy.

    ``available`` es el mínimo entre ``remaining_before`` (lo que quedaba antes de
    intentar cocinar este slot) y ``required`` (lo que pide la receta). Así refleja
    cuánto de ese ingrediente PODRÍA consumir esta comida, sin contar lo que ya fue
    comprometido por comidas previas.
    """

    ingredient: Ingredient
    required: int
    available: float  # min(remaining_before, required)


@dataclass(frozen=True, slots=True)
class SlotFeasibility:
    """Si una comida tiene cubiertos sus ingredientes bajo asignación greedy.

    ``met`` es ``True`` cuando ``remaining`` (producción menos lo ya comprometido
    por comidas anteriores en el día) cubre los ingredientes de esta receta.
    Al marcar ``met=True`` se descuentan los ingredientes de ``remaining`` para
    las siguientes comidas.

    ``ingredients`` captura el snapshot de disponibilidad ANTES de intentar esta
    comida (capped a required), útil para mostrar "X/Y" en la UI.

    Garantiza el invariante: ``all(s.met for s in result.slots)`` ⟺ no hay
    ``IngredientBalance`` con ``balance < 0`` (vs la demanda agregada total).
    """

    recipe_name: str
    met: bool
    level: int
    strength: int
    ingredients: tuple[SlotIngredientStatus, ...]


@dataclass(frozen=True, slots=True)
class CookingResult:
    """Resultado del plan de cocina del día."""

    cooking_strength: float
    ingredients: tuple[IngredientBalance, ...]  # los requeridos por alguna receta
    surplus: tuple[IngredientBalance, ...]  # producidos no usados / sobrantes
    slots: tuple[SlotFeasibility, ...]


def plan_cooking(
    meals: Sequence[MealSelection | None],
    produced: Mapping[Ingredient, float],
) -> CookingResult:
    """Planifica la cocina del día con las comidas elegidas y lo producido.

    Modelo greedy secuencial:
    - ``required[ing]`` = demanda AGREGADA total: suma de todos los slots elegidos.
      3× la misma receta requiere 3× los ingredientes.
    - ``met`` por comida (greedy, en orden): se parte de remaining=produced y se
      descuentan ingredientes sólo cuando la comida se puede costear. Una comida
      posterior más barata puede aún cumplirse si la producción alcanza.
    - ``cooking_strength`` = suma sobre TODOS los slots elegidos (3× la misma
      receta sigue sumando 3× la fuerza, independientemente de met).
    """
    chosen = [m for m in meals if m is not None]

    # Demanda agregada: suma de todos los slots (3× la misma receta = 3× ingredientes)
    required: dict[Ingredient, float] = {}
    for meal in chosen:
        for ingredient, count in meal.recipe.ingredients:
            required[ingredient] = required.get(ingredient, 0.0) + float(count)

    ingredients = tuple(
        IngredientBalance(
            ingredient=ingredient,
            required=req,
            produced=produced.get(ingredient, 0.0),
            balance=produced.get(ingredient, 0.0) - req,
        )
        for ingredient, req in required.items()
    )

    # Sobrantes: ingredientes producidos con balance positivo vs la demanda agregada,
    # incluyendo los producidos que ninguna receta usa.
    surplus = tuple(
        IngredientBalance(
            ingredient=ingredient,
            required=required.get(ingredient, 0.0),
            produced=amount,
            balance=amount - required.get(ingredient, 0.0),
        )
        for ingredient, amount in produced.items()
        if amount - required.get(ingredient, 0.0) > 0
    )

    # Greedy en orden de slot: restamos ingredientes de remaining cuando met=True.
    remaining: dict[Ingredient, float] = dict(produced)
    slot_results: list[SlotFeasibility] = []
    for meal in chosen:
        # Snapshot de disponibilidad ANTES de intentar esta comida (capped a required).
        ing_statuses = tuple(
            SlotIngredientStatus(
                ingredient=ing,
                required=count,
                available=min(remaining.get(ing, 0.0), count),
            )
            for ing, count in meal.recipe.ingredients
        )
        can_cook = all(s.available == s.required for s in ing_statuses)
        if can_cook:
            for ing, count in meal.recipe.ingredients:
                remaining[ing] = remaining.get(ing, 0.0) - count
        slot_results.append(
            SlotFeasibility(
                recipe_name=meal.recipe.name,
                met=can_cook,
                level=meal.level,
                strength=recipe_strength(meal.recipe, meal.level),
                ingredients=ing_statuses,
            )
        )

    slots = tuple(slot_results)

    cooking_strength = sum((recipe_strength(m.recipe, m.level) for m in chosen), 0.0)

    return CookingResult(
        cooking_strength=cooking_strength,
        ingredients=ingredients,
        surplus=surplus,
        slots=slots,
    )
