# Herramienta de equipos: producción (bayas/skills) + cocina — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Armar un equipo efímero de hasta 5 Pokémon de la Caja y ver su producción diaria/semanal en dos categorías (bayas/skills y cocina) más el gran total de fuerza, sobre un catálogo de recetas nuevo.

**Architecture:** Hexagonal estricto (igual que el resto del repo). Dominio puro: catálogo de recetas (`recipes.py`), agregación de equipo (`analytics.py`) y planificador de cocina (`cooking.py`). Aplicación: un caso de uso `compute_team_production` que reusa `daily_production` por miembro. HTTP: `GET /recipes` y `POST /teams/production` (stateless, sin persistencia). Frontend: tab "Equipos" que selecciona ≤5 de la Caja y renderiza el agregado.

**Tech Stack:** Backend Python ≥3.11, Litestar, msgspec, pytest, mypy strict, ruff. Frontend React + TypeScript (Vite), TanStack Query.

## Global Constraints

- **Hexagonal estricto:** el dominio NO importa Litestar/psycopg/msgspec. La aplicación depende de puertos (`RecipeCatalog`, `TeamRepository`, `SpeciesCatalog`), no de implementaciones.
- **Tipado:** mypy strict. `from __future__ import annotations` en cada módulo Python. Dataclasses `frozen=True, slots=True` donde aplique. Enums cerrados (`StrEnum`) para datos del juego.
- **Tests:** cada cambio de comportamiento lleva test. Correr `pytest -m "not integration"` (sin DB). Lint/типos: `mypy src && ruff check .` desde `backend/`.
- **Commits frecuentes**, uno por tarea como mínimo. Mensajes en el estilo del repo (prefijo de área en español, p. ej. `Equipos: ...` / `Recetas: ...`).
- **i18n:** la prosa va en `frontend/src/i18n/ui.ts` (es/en). Términos del juego con traducción oficial (Pokéxperto/WikiDex), no inventar.
- **Valores del enum del juego en inglés** (como `Ingredient`, `Berry`): `RecipeType` = `"Curry"`, `"Salad"`, `"Dessert"`.
- **Sin persistir equipos:** `POST /teams/production` es stateless.
- **Fuerza de cocina v1** = `base_strength × bonus(nivel)`; sin Extra Tasty crítico, Area Bonus, baya favorita ×2 ni efecto del pote.

**Comandos base** (desde la raíz del repo salvo que se indique):
```bash
cd backend && source .venv/bin/activate   # entorno backend
pytest -m "not integration" -q
mypy src && ruff check .
```

---

## File Structure

**Backend (crear):**
- `backend/src/sleepmon/domain/recipes.py` — `Recipe`, `SEED_RECIPES`, `recipe_strength`.
- `backend/src/sleepmon/domain/cooking.py` — `CookingPlan`, `CookingResult`, `plan_cooking`.
- `backend/src/sleepmon/adapters/outbound/catalog/static_recipe_catalog.py` — `StaticRecipeCatalog`.
- `backend/tests/domain/test_recipes.py`, `test_cooking.py`, `test_team_analytics.py`.

**Backend (modificar):**
- `domain/value_objects.py` — enum `RecipeType`.
- `domain/catalog_data.py` — `MAX_RECIPE_LEVEL`, `RECIPE_LEVEL_BONUS`.
- `domain/analytics.py` — `TeamProduction`, `MemberContribution`, `team_production`.
- `domain/ports.py` — puerto `RecipeCatalog`.
- `application/dto.py` — DTOs de recetas y de team production.
- `application/services.py` — `list_recipes`, `compute_team_production` (+ inyección del catálogo de recetas).
- `adapters/inbound/http/schemas.py` — schemas in/out nuevos.
- `adapters/inbound/http/controllers.py` — endpoints nuevos.
- `adapters/inbound/http/app.py` — cablear `RecipeCatalog` + controllers.
- `backend/tests/http/test_api.py`, `backend/tests/application/test_team_service.py` — tests nuevos.
- `backend/tests/fakes.py` — fake de `RecipeCatalog` si hace falta.

**Frontend (crear):**
- `frontend/src/pages/Teams.tsx` — la página.

**Frontend (modificar):**
- `frontend/src/types.ts`, `frontend/src/api/client.ts`, `frontend/src/App.tsx`, `frontend/src/i18n/ui.ts`.

---

## Task 1: `RecipeType`, `Recipe`, tabla de bonus y `recipe_strength`

**Files:**
- Modify: `backend/src/sleepmon/domain/value_objects.py`
- Modify: `backend/src/sleepmon/domain/catalog_data.py`
- Create: `backend/src/sleepmon/domain/recipes.py`
- Test: `backend/tests/domain/test_recipes.py`

**Interfaces:**
- Produces:
  - `RecipeType(StrEnum)` con miembros `CURRY = "Curry"`, `SALAD = "Salad"`, `DESSERT = "Dessert"`.
  - `MAX_RECIPE_LEVEL: int` y `RECIPE_LEVEL_BONUS: tuple[float, ...]` (largo `MAX_RECIPE_LEVEL`, índice `nivel-1`, multiplicador; `[0] == 1.0`).
  - `recipe_level_bonus(level: int) -> float`.
  - `Recipe` frozen dataclass: `name: str`, `type: RecipeType`, `ingredients: tuple[tuple[Ingredient, int], ...]`, `base_strength: int`; propiedad `total_ingredients: int`.
  - `recipe_strength(recipe: Recipe, level: int) -> int`.

- [ ] **Step 1: Añadir el enum `RecipeType`**

En `domain/value_objects.py`, después del enum `Ribbon` (al final del archivo), agregar:

```python
class RecipeType(StrEnum):
    """Los tres tipos de receta de Pokémon Sleep."""

    CURRY = "Curry"  # curries y guisos
    SALAD = "Salad"
    DESSERT = "Dessert"  # postres y bebidas
```

- [ ] **Step 2: Añadir la tabla de bonus por nivel de receta**

En `domain/catalog_data.py`, junto a las otras tablas del juego (cerca de `berry_strength_for_level`), agregar. **La tabla se sourcea de nerolis-lab (sleepapi, `recipeLevelBonus`/`RECIPE_LEVELS`), misma familia de fuentes que la fórmula de baya.** Reemplazar el cuerpo de la tupla por los valores reales sourceados durante el Step de datos; acá va su forma y contrato:

```python
# Multiplicador de fuerza de una receta según su nivel (1..MAX_RECIPE_LEVEL).
# Índice = nivel-1. RECIPE_LEVEL_BONUS[0] == 1.0 (nivel 1 = sin bonus). Monótona
# creciente. Fuente: nerolis-lab (sleepapi, bonus de nivel de receta), expresado
# como multiplicador = 1 + bonus%/100.
MAX_RECIPE_LEVEL: Final[int] = 65
RECIPE_LEVEL_BONUS: Final[tuple[float, ...]] = (
    1.00, 1.02, 1.04, 1.06, 1.08, 1.09, 1.11, 1.13, 1.15, 1.17,
    1.18, 1.19, 1.21, 1.23, 1.25, 1.27, 1.29, 1.31, 1.33, 1.35,
    1.37, 1.39, 1.41, 1.43, 1.45, 1.47, 1.48, 1.49, 1.51, 1.53,
    1.55, 1.57, 1.59, 1.61, 1.63, 1.65, 1.67, 1.69, 1.71, 1.73,
    1.75, 1.77, 1.79, 1.81, 1.83, 1.85, 1.87, 1.89, 1.91, 2.04,
    2.06, 2.08, 2.10, 2.12, 2.14, 2.16, 2.18, 2.20, 2.22, 2.24,
    2.26, 2.28, 2.30, 2.32, 2.48,
)
assert len(RECIPE_LEVEL_BONUS) == MAX_RECIPE_LEVEL


def recipe_level_bonus(level: int) -> float:
    """Multiplicador de fuerza de una receta de nivel ``level`` (1..MAX_RECIPE_LEVEL)."""
    if not 1 <= level <= MAX_RECIPE_LEVEL:
        raise ValueError(f"El nivel de receta debe estar entre 1 y {MAX_RECIPE_LEVEL}; llegó {level}.")
    return RECIPE_LEVEL_BONUS[level - 1]
```

> Nota de datos: si la tabla real difiere en longitud, ajustar `MAX_RECIPE_LEVEL` y los valores; los tests solo exigen `[0]==1.0`, monotonía y longitud coherente.

Verificar que `Final` ya está importado en `catalog_data.py` (lo está; lo usan otras constantes).

- [ ] **Step 3: Escribir el test que falla (`recipe_strength` y `Recipe`)**

Crear `backend/tests/domain/test_recipes.py`:

```python
import pytest

from sleepmon.domain.catalog_data import MAX_RECIPE_LEVEL, recipe_level_bonus
from sleepmon.domain.recipes import Recipe, recipe_strength
from sleepmon.domain.value_objects import Ingredient, RecipeType

I = Ingredient  # noqa: E741


def _recipe(base: int = 100) -> Recipe:
    return Recipe(
        name="Test Curry",
        type=RecipeType.CURRY,
        ingredients=((I.HONEY, 7), (I.BEAN_SAUSAGE, 5)),
        base_strength=base,
    )


def test_recipe_strength_at_level_1_is_base() -> None:
    assert recipe_strength(_recipe(base=100), 1) == 100


def test_recipe_strength_grows_with_level() -> None:
    r = _recipe(base=100)
    assert recipe_strength(r, MAX_RECIPE_LEVEL) > recipe_strength(r, 1)


def test_recipe_strength_uses_level_bonus_multiplier() -> None:
    r = _recipe(base=200)
    assert recipe_strength(r, 10) == round(200 * recipe_level_bonus(10))


def test_recipe_strength_rejects_out_of_range_level() -> None:
    with pytest.raises(ValueError):
        recipe_strength(_recipe(), 0)
    with pytest.raises(ValueError):
        recipe_strength(_recipe(), MAX_RECIPE_LEVEL + 1)


def test_recipe_total_ingredients() -> None:
    assert _recipe().total_ingredients == 12
```

- [ ] **Step 4: Correr el test para verlo fallar**

Run: `cd backend && pytest tests/domain/test_recipes.py -q`
Expected: FAIL (`ModuleNotFoundError: sleepmon.domain.recipes`).

- [ ] **Step 5: Implementar `recipes.py`**

Crear `backend/src/sleepmon/domain/recipes.py`:

```python
"""Catálogo de recetas (datos de referencia que viajan con el código).

Cada receta fija su tipo (curry/salad/dessert), los ingredientes requeridos con su
cantidad y su fuerza base. La fuerza efectiva de un plato es la base por el
multiplicador del nivel de la receta (``recipe_strength``).

Dataset completo del juego, sourceado de nitoyon (``pokesleep-tool``) y nerolis-lab
(sleepapi). Ampliarlo o corregirlo es agregar/editar entradas de ``SEED_RECIPES``.
"""

from __future__ import annotations

from dataclasses import dataclass

from sleepmon.domain.catalog_data import recipe_level_bonus
from sleepmon.domain.value_objects import Ingredient, RecipeType

I = Ingredient  # noqa: E741 — alias local para que el dataset se lea compacto


@dataclass(frozen=True, slots=True)
class Recipe:
    """Entrada del catálogo para una receta."""

    name: str
    type: RecipeType
    # Ingredientes requeridos con su cantidad, en orden de display del juego.
    ingredients: tuple[tuple[Ingredient, int], ...]
    base_strength: int  # fuerza base a nivel 1 (sin bonus)

    @property
    def total_ingredients(self) -> int:
        """Total de unidades de ingrediente que pide la receta."""
        return sum(count for _, count in self.ingredients)


def recipe_strength(recipe: Recipe, level: int) -> int:
    """Fuerza de ``recipe`` cocinada a nivel ``level`` (1..MAX_RECIPE_LEVEL)."""
    return round(recipe.base_strength * recipe_level_bonus(level))


# Dataset semilla. Completar con el catálogo completo en la Task 2.
SEED_RECIPES: tuple[Recipe, ...] = ()
```

- [ ] **Step 6: Correr los tests para verlos pasar**

Run: `cd backend && pytest tests/domain/test_recipes.py -q && mypy src && ruff check .`
Expected: PASS; mypy y ruff limpios.

- [ ] **Step 7: Commit**

```bash
git add backend/src/sleepmon/domain/value_objects.py backend/src/sleepmon/domain/catalog_data.py backend/src/sleepmon/domain/recipes.py backend/tests/domain/test_recipes.py
git commit -m "Recetas: Recipe, tabla de bonus por nivel y recipe_strength"
```

---

## Task 2: Dataset completo `SEED_RECIPES` + puerto y adapter de catálogo

**Files:**
- Modify: `backend/src/sleepmon/domain/recipes.py` (poblar `SEED_RECIPES`)
- Modify: `backend/src/sleepmon/domain/ports.py` (puerto `RecipeCatalog`)
- Create: `backend/src/sleepmon/adapters/outbound/catalog/static_recipe_catalog.py`
- Test: `backend/tests/domain/test_recipes.py` (integridad del dataset)

**Interfaces:**
- Consumes: `Recipe`, `RecipeType`, `Ingredient`, `SEED_RECIPES`.
- Produces:
  - `RecipeCatalog(ABC)` con `get(name: str) -> Recipe | None` y `all() -> Sequence[Recipe]`.
  - `StaticRecipeCatalog(RecipeCatalog)` que sirve `SEED_RECIPES` (lookup case-insensitive).

- [ ] **Step 1: Escribir los tests de integridad del dataset (fallan)**

Añadir a `backend/tests/domain/test_recipes.py`:

```python
from sleepmon.domain.recipes import SEED_RECIPES


def test_seed_recipes_cover_the_three_types() -> None:
    types = {r.type for r in SEED_RECIPES}
    assert types == {RecipeType.CURRY, RecipeType.SALAD, RecipeType.DESSERT}


def test_seed_recipes_have_unique_names() -> None:
    names = [r.name for r in SEED_RECIPES]
    assert len(names) == len(set(names))


def test_seed_recipes_are_well_formed() -> None:
    assert SEED_RECIPES, "el dataset no puede estar vacío"
    for r in SEED_RECIPES:
        assert r.base_strength > 0, r.name
        assert r.ingredients, r.name
        for ingredient, count in r.ingredients:
            assert isinstance(ingredient, Ingredient), r.name
            assert count > 0, r.name
```

- [ ] **Step 2: Correr para ver fallar**

Run: `cd backend && pytest tests/domain/test_recipes.py -q`
Expected: FAIL (`SEED_RECIPES` vacío → falla `cover_the_three_types`, `well_formed`).

- [ ] **Step 3: Poblar `SEED_RECIPES` con el dataset completo**

En `domain/recipes.py`, reemplazar la línea `SEED_RECIPES: tuple[Recipe, ...] = ()` por el dataset completo. **Procedimiento de sourcing** (mecánico, mismas fuentes que `species.py`):

1. Tomar la lista de recetas de nerolis-lab (sleepapi, `recipe/` — `curry.ts`, `salad.ts`, `dessert.ts`) y/o nitoyon (`pokesleep-tool`, datos de cocina).
2. Por cada receta: `name`, `type`, `base_strength` (campo de "value"/"power" base a nivel 1), y los ingredientes con cantidad (mapear cada ingrediente al miembro de `Ingredient`).
3. Cargar como entradas usando el alias `I`. Formato (entradas de ejemplo ya verificables del juego — completar con TODAS las recetas):

```python
SEED_RECIPES: tuple[Recipe, ...] = (
    # --- Curries y guisos ---
    Recipe("Mixed Curry", RecipeType.CURRY, ((I.FANCY_APPLE, 7), (I.FANCY_EGG, 5)), 350),
    Recipe(
        "Spore Mushroom Curry",
        RecipeType.CURRY,
        ((I.TASTY_MUSHROOM, 14), (I.SOFT_POTATO, 9)),
        2521,
    ),
    Recipe(
        "Dream Eater Butter Curry",
        RecipeType.CURRY,
        ((I.SOFT_POTATO, 18), (I.BEAN_SAUSAGE, 15), (I.FANCY_EGG, 12), (I.MOOMOO_MILK, 10)),
        7483,
    ),
    # --- Ensaladas ---
    Recipe("Mixed Salad", RecipeType.SALAD, ((I.FANCY_APPLE, 7), (I.MOOMOO_MILK, 5)), 350),
    Recipe(
        "Snoozy Tomato Salad",
        RecipeType.SALAD,
        ((I.SNOOZY_TOMATO, 8), (I.PURE_OIL, 6)),
        1576,
    ),
    Recipe(
        "Ninja Salad",
        RecipeType.SALAD,
        ((I.GREENGRASS_SOYBEANS, 15), (I.WARMING_GINGER, 12), (I.SNOOZY_TOMATO, 9), (I.LARGE_LEEK, 5)),
        5040,
    ),
    # --- Postres y bebidas ---
    Recipe("Mixed Juice", RecipeType.DESSERT, ((I.FANCY_APPLE, 7), (I.HONEY, 5)), 350),
    Recipe(
        "Fancy Apple Juice",
        RecipeType.DESSERT,
        ((I.FANCY_APPLE, 8),),
        678,
    ),
    Recipe(
        "Jigglypuff's Fruity Flan",
        RecipeType.DESSERT,
        ((I.HONEY, 18), (I.FANCY_EGG, 15), (I.MOOMOO_MILK, 12), (I.SOOTHING_CACAO, 10)),
        7594,
    ),
    # … COMPLETAR con el resto del catálogo (todas las curries/salads/desserts).
)
```

> Las cantidades/fuerzas de arriba son del formato real del juego; al sourcear el dataset completo, verificar cada `base_strength` contra la fuente y agregar TODAS las recetas. El test de integridad (Step 1) protege la forma; no hay test de valor exacto por receta (data de referencia, como `SEED_SPECIES`).

- [ ] **Step 4: Añadir el puerto `RecipeCatalog`**

En `domain/ports.py`, importar `Recipe` y agregar el puerto (debajo de `SpeciesCatalog`):

```python
from sleepmon.domain.recipes import Recipe
```

```python
class RecipeCatalog(ABC):
    """Acceso de solo lectura al catálogo de recetas."""

    @abstractmethod
    def get(self, name: str) -> Recipe | None:
        """Devuelve la receta por nombre, o ``None`` si no está en el catálogo."""

    @abstractmethod
    def all(self) -> Sequence[Recipe]:
        """Todas las recetas del catálogo."""
```

(`Sequence` ya está importado en `ports.py`.)

- [ ] **Step 5: Implementar el adapter estático**

Crear `backend/src/sleepmon/adapters/outbound/catalog/static_recipe_catalog.py`:

```python
"""Catálogo de recetas servido desde el dataset en código (``SEED_RECIPES``)."""

from __future__ import annotations

from collections.abc import Sequence

from sleepmon.domain.ports import RecipeCatalog
from sleepmon.domain.recipes import SEED_RECIPES, Recipe


class StaticRecipeCatalog(RecipeCatalog):
    """Implementación de solo lectura sobre el dataset semilla.

    El lookup por nombre es case-insensitive para tolerar el input del usuario.
    """

    def __init__(self, recipes: Sequence[Recipe] = SEED_RECIPES) -> None:
        self._by_name = {r.name.casefold(): r for r in recipes}
        self._all = tuple(recipes)

    def get(self, name: str) -> Recipe | None:
        return self._by_name.get(name.casefold())

    def all(self) -> Sequence[Recipe]:
        return self._all
```

- [ ] **Step 6: Correr tests + tipos + lint**

Run: `cd backend && pytest tests/domain/test_recipes.py -q && mypy src && ruff check .`
Expected: PASS; mypy y ruff limpios.

- [ ] **Step 7: Commit**

```bash
git add backend/src/sleepmon/domain/recipes.py backend/src/sleepmon/domain/ports.py backend/src/sleepmon/adapters/outbound/catalog/static_recipe_catalog.py backend/tests/domain/test_recipes.py
git commit -m "Recetas: dataset completo, puerto RecipeCatalog y adapter estático"
```

---

## Task 3: Endpoint `GET /recipes`

**Files:**
- Modify: `backend/src/sleepmon/application/dto.py`
- Modify: `backend/src/sleepmon/application/services.py`
- Modify: `backend/src/sleepmon/adapters/inbound/http/schemas.py`
- Modify: `backend/src/sleepmon/adapters/inbound/http/controllers.py`
- Modify: `backend/src/sleepmon/adapters/inbound/http/app.py`
- Test: `backend/tests/http/test_api.py`

**Interfaces:**
- Consumes: `RecipeCatalog`, `Recipe`.
- Produces:
  - DTOs `IngredientCountDTO(ingredient: str, count: int)`, `RecipeDTO(name, type, ingredients: list[IngredientCountDTO], base_strength)`.
  - `TeamService.list_recipes() -> list[RecipeDTO]`.
  - `DefaultTeamService.__init__(self, repository, catalog, recipe_catalog)`.
  - Schemas `IngredientCountOut`, `RecipeOut`.
  - Ruta HTTP `GET /recipes` → `list[RecipeOut]`.

- [ ] **Step 1: Escribir el test HTTP (falla)**

Añadir a `backend/tests/http/test_api.py`. Notar que el fixture `client` debe pasar el catálogo de recetas; actualizar el fixture y agregar el test:

```python
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
```

Reemplazar el fixture `client` por:

```python
@pytest.fixture
def client() -> TestClient:
    service = DefaultTeamService(
        InMemoryTeamRepository(), StaticSpeciesCatalog(), StaticRecipeCatalog()
    )
    app = create_app(
        service=service, catalog=StaticSpeciesCatalog(), recipe_catalog=StaticRecipeCatalog()
    )
    with TestClient(app=app) as client:
        yield client
```

Agregar el test:

```python
def test_recipes_endpoint_lists_recipes(client: TestClient) -> None:
    res = client.get("/recipes")
    assert res.status_code == 200
    body = res.json()
    assert body, "debe devolver al menos una receta"
    types = {r["type"] for r in body}
    assert types == {"Curry", "Salad", "Dessert"}
    first = body[0]
    assert {"name", "type", "ingredients", "base_strength"} <= first.keys()
    assert all({"ingredient", "count"} <= ing.keys() for ing in first["ingredients"])
```

- [ ] **Step 2: Correr para ver fallar**

Run: `cd backend && pytest tests/http/test_api.py::test_recipes_endpoint_lists_recipes -q`
Expected: FAIL (`DefaultTeamService` no acepta 3er arg / no existe `/recipes`).

- [ ] **Step 3: Añadir los DTOs**

En `application/dto.py`, agregar:

```python
@dataclass(frozen=True, slots=True)
class IngredientCountDTO:
    """Un ingrediente requerido por una receta, con su cantidad."""

    ingredient: str
    count: int


@dataclass(frozen=True, slots=True)
class RecipeDTO:
    """Una receta del catálogo, lista para serializar."""

    name: str
    type: str
    ingredients: list[IngredientCountDTO]
    base_strength: int
```

- [ ] **Step 4: Inyectar `RecipeCatalog` y añadir `list_recipes` al service**

En `application/services.py`:

1. Importes:
```python
from sleepmon.application.dto import (
    Distributions,
    IngredientCountDTO,
    MemberProduction,
    ProductionInput,
    ProductionResult,
    RecipeDTO,
    SlotAmount,
    TeamMemberInput,
)
from sleepmon.domain.ports import RecipeCatalog, SpeciesCatalog, TeamRepository
```

2. Método abstracto en `TeamService` (junto a los otros `@abstractmethod`):
```python
    @abstractmethod
    def list_recipes(self) -> list[RecipeDTO]: ...
```

3. `DefaultTeamService.__init__` y la implementación:
```python
    def __init__(
        self,
        repository: TeamRepository,
        catalog: SpeciesCatalog,
        recipe_catalog: RecipeCatalog,
    ) -> None:
        self._repo = repository
        self._catalog = catalog
        self._recipes = recipe_catalog

    def list_recipes(self) -> list[RecipeDTO]:
        return [
            RecipeDTO(
                name=r.name,
                type=r.type.value,
                ingredients=[
                    IngredientCountDTO(ingredient=ing.value, count=count)
                    for ing, count in r.ingredients
                ],
                base_strength=r.base_strength,
            )
            for r in self._recipes.all()
        ]
```

- [ ] **Step 5: Añadir schemas de salida**

En `adapters/inbound/http/schemas.py`, agregar:

```python
class IngredientCountOut(msgspec.Struct):
    ingredient: str
    count: int


class RecipeOut(msgspec.Struct):
    name: str
    type: str
    ingredients: list[IngredientCountOut]
    base_strength: int
```

- [ ] **Step 6: Añadir el controller `GET /recipes`**

En `adapters/inbound/http/controllers.py`:

1. Importar los schemas y el puerto:
```python
from sleepmon.adapters.inbound.http.schemas import (
    CatalogOut,
    DistributionsOut,
    IngredientCountOut,
    MemberIn,
    MemberOut,
    MemberProductionOut,
    NatureOut,
    ProductionIn,
    ProductionOut,
    RecipeOut,
    SlotProductionOut,
    SpeciesOut,
    SubSkillOut,
)
```

2. Agregar un controller nuevo al final del archivo:
```python
class RecipeController(Controller):
    path = "/recipes"

    @get("/", sync_to_thread=True)
    def list_recipes(self, service: NamedDependency[TeamService]) -> list[RecipeOut]:
        return [
            RecipeOut(
                name=r.name,
                type=r.type,
                ingredients=[
                    IngredientCountOut(ingredient=i.ingredient, count=i.count)
                    for i in r.ingredients
                ],
                base_strength=r.base_strength,
            )
            for r in service.list_recipes()
        ]
```

- [ ] **Step 7: Cablear en el composition root**

En `adapters/inbound/http/app.py`:

1. Importes:
```python
from sleepmon.adapters.inbound.http.controllers import (
    CatalogController,
    ProductionController,
    RecipeController,
    TeamController,
)
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.domain.ports import RecipeCatalog, SpeciesCatalog
```

2. Firma y cuerpo de `create_app`:
```python
def create_app(
    *,
    service: TeamService | None = None,
    catalog: SpeciesCatalog | None = None,
    recipe_catalog: RecipeCatalog | None = None,
    settings: Settings | None = None,
) -> Litestar:
    on_shutdown: list[Callable[[], object]] = []

    if catalog is None:
        catalog = StaticSpeciesCatalog()
    if recipe_catalog is None:
        recipe_catalog = StaticRecipeCatalog()

    if service is None:
        settings = settings or Settings.from_env()
        pool = create_pool(settings.database_url)
        repository = PostgresTeamRepository(pool)
        service = DefaultTeamService(repository, catalog, recipe_catalog)
        on_shutdown.append(lambda: pool.close())

    bound_service = service
    bound_catalog = catalog
```

3. Registrar el controller:
```python
        route_handlers=[TeamController, CatalogController, ProductionController, RecipeController],
```

- [ ] **Step 8: Correr todo el backend**

Run: `cd backend && pytest -m "not integration" -q && mypy src && ruff check .`
Expected: PASS. (El cambio de firma de `DefaultTeamService` rompe llamadas existentes en `tests/application/test_team_service.py`; arreglarlas pasando `StaticRecipeCatalog()` como 3er argumento. Buscar con `grep -rn "DefaultTeamService(" backend/tests` y actualizar cada construcción.)

- [ ] **Step 9: Commit**

```bash
git add backend/src/sleepmon/application backend/src/sleepmon/adapters/inbound/http backend/tests
git commit -m "Recetas: endpoint GET /recipes y catálogo inyectado en el service"
```

---

## Task 4: Agregación del equipo (`team_production`)

**Files:**
- Modify: `backend/src/sleepmon/domain/analytics.py`
- Test: `backend/tests/domain/test_team_analytics.py`

**Interfaces:**
- Consumes: `DailyProduction` (de `domain.production`), `Ingredient`.
- Produces:
  - `MemberContribution` frozen: `member_id: str`, `species: str`, `strength: float`, `berry_amount: float`, `ingredients_total: float`, `skill_triggers: float`.
  - `TeamProduction` frozen (campos abajo).
  - `team_production(entries: Iterable[tuple[str, str, DailyProduction]]) -> TeamProduction` — cada entry es `(member_id, species_name, daily)`.

- [ ] **Step 1: Escribir el test (falla)**

Crear `backend/tests/domain/test_team_analytics.py`:

```python
from sleepmon.domain.analytics import TeamProduction, team_production
from sleepmon.domain.production import DailyProduction, SlotProduction
from sleepmon.domain.value_objects import Berry, Ingredient

I = Ingredient  # noqa: E741


def _daily(
    *,
    berry_amount: float = 10.0,
    berry_strength: float = 100.0,
    ingredients: tuple[SlotProduction, ...] = (),
    skill_triggers: float = 2.0,
    skill_strength: float | None = None,
    skill_energy: float | None = None,
) -> DailyProduction:
    return DailyProduction(
        helps_per_day=50.0,
        seconds_per_help=3000,
        berry=Berry.BELUE,
        berry_amount=berry_amount,
        berry_strength=berry_strength,
        berry_percentage=80.0,
        ingredient_percentage=20.0,
        skill_percentage=5.0,
        effective_skill_percentage=6.0,
        ingredients=ingredients,
        skill_triggers=skill_triggers,
        skill_ingredients=(),
        skill_energy=skill_energy,
        skill_ingredient_total=None,
        skill_cooking_ingredients=None,
        skill_strength=skill_strength,
        skill_self_energy=None,
        skill_dream_shards=None,
        skill_tasty_chance=None,
        skill_extra_helpful=None,
        skill_random_energy=None,
        night_skill_chances=(),
        inventory=100,
        inventory_fill_hours=5.0,
    )


def test_team_production_empty() -> None:
    result = team_production([])
    assert result.member_count == 0
    assert result.total_strength == 0
    assert result.ingredients == {}


def test_team_production_sums_strength_and_berries() -> None:
    a = _daily(berry_strength=100.0, skill_strength=50.0)
    b = _daily(berry_strength=200.0, skill_strength=None)
    result = team_production([("id-a", "Pikachu", a), ("id-b", "Bulbasaur", b)])
    assert result.member_count == 2
    assert result.total_berry_strength == 300.0
    assert result.total_skill_strength == 50.0
    assert result.total_strength == 350.0  # 300 bayas + 50 skill


def test_team_production_aggregates_ingredients_by_type() -> None:
    a = _daily(ingredients=(SlotProduction(I.HONEY, 3.0), SlotProduction(I.FANCY_EGG, 2.0)))
    b = _daily(ingredients=(SlotProduction(I.HONEY, 5.0),))
    result = team_production([("a", "X", a), ("b", "Y", b)])
    assert result.ingredients[I.HONEY] == 8.0
    assert result.ingredients[I.FANCY_EGG] == 2.0
    assert result.total_ingredients == 10.0


def test_team_production_optional_metric_none_when_nobody_contributes() -> None:
    result = team_production([("a", "X", _daily(skill_energy=None))])
    assert result.skill_energy is None


def test_team_production_optional_metric_sums_present() -> None:
    result = team_production(
        [("a", "X", _daily(skill_energy=10.0)), ("b", "Y", _daily(skill_energy=5.0))]
    )
    assert result.skill_energy == 15.0


def test_team_production_member_breakdown() -> None:
    result = team_production([("id-a", "Pikachu", _daily(berry_strength=100.0, skill_strength=20.0))])
    member = result.members[0]
    assert member.member_id == "id-a"
    assert member.species == "Pikachu"
    assert member.strength == 120.0
```

- [ ] **Step 2: Correr para ver fallar**

Run: `cd backend && pytest tests/domain/test_team_analytics.py -q`
Expected: FAIL (`ImportError: cannot import name 'team_production'`).

- [ ] **Step 3: Implementar en `analytics.py`**

Añadir al final de `domain/analytics.py` (con los importes que falten arriba):

```python
from dataclasses import dataclass

from sleepmon.domain.production import DailyProduction
from sleepmon.domain.value_objects import Ingredient


@dataclass(frozen=True, slots=True)
class MemberContribution:
    """Aporte de un miembro al agregado del equipo (para el desglose)."""

    member_id: str
    species: str
    strength: float  # berry_strength + skill_strength (None cuenta 0)
    berry_amount: float
    ingredients_total: float
    skill_triggers: float


@dataclass(frozen=True, slots=True)
class TeamProduction:
    """Producción diaria agregada de un equipo (bayas + skills)."""

    member_count: int
    total_strength: float
    total_berry_amount: float
    total_berry_strength: float
    total_skill_strength: float
    ingredients: dict[Ingredient, float]
    total_ingredients: float
    skill_triggers: float
    skill_energy: float | None
    skill_self_energy: float | None
    skill_dream_shards: float | None
    skill_tasty_chance: float | None
    skill_extra_helpful: float | None
    skill_random_energy: float | None
    skill_cooking_ingredients: float | None
    skill_ingredient_total: float | None
    members: tuple[MemberContribution, ...]


# Métricas opcionales de la main skill que se agregan sumando los presentes (None si
# ningún miembro la aporta). Nombre del atributo en DailyProduction.
_OPTIONAL_SKILL_FIELDS: tuple[str, ...] = (
    "skill_energy",
    "skill_self_energy",
    "skill_dream_shards",
    "skill_tasty_chance",
    "skill_extra_helpful",
    "skill_random_energy",
    "skill_cooking_ingredients",
    "skill_ingredient_total",
)


def _sum_optional(dailies: list[DailyProduction], field: str) -> float | None:
    """Suma los valores no-None de ``field``; None si ninguno aporta."""
    present = [v for d in dailies if (v := getattr(d, field)) is not None]
    return sum(present) if present else None


def team_production(
    entries: Iterable[tuple[str, str, DailyProduction]],
) -> TeamProduction:
    """Agrega la producción diaria de los miembros de un equipo.

    Cada entry es ``(member_id, species_name, daily)``. La fuerza total es la suma de
    la fuerza directa de bayas más la de Charge Strength (los ``None`` cuentan 0). Los
    ingredientes se agregan por tipo (slots normales + main skill).
    """
    entries = list(entries)
    dailies = [daily for _, _, daily in entries]

    ingredients: dict[Ingredient, float] = {}
    for daily in dailies:
        for slot in (*daily.ingredients, *daily.skill_ingredients):
            ingredients[slot.ingredient] = ingredients.get(slot.ingredient, 0.0) + slot.amount

    total_berry_strength = sum(d.berry_strength for d in dailies)
    total_skill_strength = sum(d.skill_strength or 0.0 for d in dailies)

    members = tuple(
        MemberContribution(
            member_id=member_id,
            species=species,
            strength=daily.berry_strength + (daily.skill_strength or 0.0),
            berry_amount=daily.berry_amount,
            ingredients_total=sum(slot.amount for slot in daily.ingredients),
            skill_triggers=daily.skill_triggers,
        )
        for member_id, species, daily in entries
    )

    optional = {field: _sum_optional(dailies, field) for field in _OPTIONAL_SKILL_FIELDS}

    return TeamProduction(
        member_count=len(entries),
        total_strength=total_berry_strength + total_skill_strength,
        total_berry_amount=sum(d.berry_amount for d in dailies),
        total_berry_strength=total_berry_strength,
        total_skill_strength=total_skill_strength,
        ingredients=ingredients,
        total_ingredients=sum(ingredients.values()),
        skill_triggers=sum(d.skill_triggers for d in dailies),
        members=members,
        **optional,
    )
```

> Nota: mover los `import` al bloque de imports del módulo (arriba), no dejarlos en medio del archivo. `Iterable` ya está importado en `analytics.py`.

- [ ] **Step 4: Correr tests + tipos + lint**

Run: `cd backend && pytest tests/domain/test_team_analytics.py -q && mypy src && ruff check .`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/sleepmon/domain/analytics.py backend/tests/domain/test_team_analytics.py
git commit -m "Equipos: agregación de producción del equipo (team_production)"
```

---

## Task 5: Planificador de cocina (`plan_cooking`)

**Files:**
- Create: `backend/src/sleepmon/domain/cooking.py`
- Test: `backend/tests/domain/test_cooking.py`

**Interfaces:**
- Consumes: `Recipe`, `recipe_strength`, `Ingredient`.
- Produces:
  - `MealSelection` frozen: `recipe: Recipe`, `level: int`.
  - `IngredientBalance` frozen: `ingredient: Ingredient`, `required: float`, `produced: float`, `balance: float` (`produced - required`).
  - `SlotFeasibility` frozen: `recipe_name: str`, `met: bool`.
  - `CookingResult` frozen: `cooking_strength: float`, `ingredients: tuple[IngredientBalance, ...]`, `surplus: tuple[IngredientBalance, ...]`, `slots: tuple[SlotFeasibility, ...]`.
  - `plan_cooking(meals: Sequence[MealSelection | None], produced: Mapping[Ingredient, float]) -> CookingResult`.

- [ ] **Step 1: Escribir el test (falla)**

Crear `backend/tests/domain/test_cooking.py`:

```python
from sleepmon.domain.cooking import MealSelection, plan_cooking
from sleepmon.domain.recipes import Recipe, recipe_strength
from sleepmon.domain.value_objects import Ingredient, RecipeType

I = Ingredient  # noqa: E741


def _recipe(name: str = "R", ings=((I.HONEY, 7),), base: int = 100) -> Recipe:
    return Recipe(name=name, type=RecipeType.CURRY, ingredients=tuple(ings), base_strength=base)


def test_plan_cooking_no_meals_is_zero() -> None:
    result = plan_cooking([None, None, None], {I.HONEY: 10.0})
    assert result.cooking_strength == 0.0
    assert result.ingredients == ()


def test_plan_cooking_sums_recipe_strength() -> None:
    meals = [MealSelection(_recipe(base=100), 1), MealSelection(_recipe(base=200), 1), None]
    result = plan_cooking(meals, {})
    assert result.cooking_strength == recipe_strength(_recipe(base=100), 1) + recipe_strength(
        _recipe(base=200), 1
    )


def test_plan_cooking_strength_counts_even_if_ingredients_missing() -> None:
    # Sin ingredientes producidos, la fuerza igual se cuenta.
    result = plan_cooking([MealSelection(_recipe(ings=((I.HONEY, 7),), base=100), 1)], {})
    assert result.cooking_strength == 100
    assert result.slots[0].met is False


def test_plan_cooking_required_vs_produced_balance() -> None:
    meals = [MealSelection(_recipe(ings=((I.HONEY, 7), (I.FANCY_EGG, 5)), base=100), 1)]
    result = plan_cooking(meals, {I.HONEY: 10.0, I.FANCY_EGG: 2.0})
    by_ing = {b.ingredient: b for b in result.ingredients}
    assert by_ing[I.HONEY].required == 7.0
    assert by_ing[I.HONEY].produced == 10.0
    assert by_ing[I.HONEY].balance == 3.0
    assert by_ing[I.FANCY_EGG].balance == -3.0  # falta
    assert result.slots[0].met is False  # falta fancy egg


def test_plan_cooking_surplus_lists_unused_produced() -> None:
    meals = [MealSelection(_recipe(ings=((I.HONEY, 2),), base=100), 1)]
    result = plan_cooking(meals, {I.HONEY: 5.0, I.MOOMOO_MILK: 4.0})
    surplus = {b.ingredient: b.balance for b in result.surplus}
    assert surplus[I.MOOMOO_MILK] == 4.0  # no usado por ninguna receta
    assert surplus[I.HONEY] == 3.0  # sobrante tras requerir 2
```

- [ ] **Step 2: Correr para ver fallar**

Run: `cd backend && pytest tests/domain/test_cooking.py -q`
Expected: FAIL (`ModuleNotFoundError: sleepmon.domain.cooking`).

- [ ] **Step 3: Implementar `cooking.py`**

Crear `backend/src/sleepmon/domain/cooking.py`:

```python
"""Planificador de cocina del equipo (función pura, sin infraestructura).

Dadas las recetas elegidas para las comidas del día y los ingredientes que produce
el equipo, calcula: ingredientes requeridos vs producidos (con su balance), los
sobrantes (producidos que ninguna receta usa) y la fuerza aportada por las recetas.

La fuerza se cuenta SE CUMPLAN O NO los requisitos de ingredientes; el cumplimiento
por comida es solo un indicador informativo (``met``).
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
class SlotFeasibility:
    """Si una comida tiene cubiertos sus ingredientes con lo producido en el día."""

    recipe_name: str
    met: bool


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
    """Planifica la cocina del día con las comidas elegidas y lo producido."""
    chosen = [m for m in meals if m is not None]

    required: dict[Ingredient, float] = {}
    for meal in chosen:
        for ingredient, count in meal.recipe.ingredients:
            required[ingredient] = required.get(ingredient, 0.0) + count

    ingredients = tuple(
        IngredientBalance(
            ingredient=ingredient,
            required=req,
            produced=produced.get(ingredient, 0.0),
            balance=produced.get(ingredient, 0.0) - req,
        )
        for ingredient, req in required.items()
    )

    # Sobrantes: por ingrediente producido, lo que queda tras cubrir lo requerido
    # (>0). Incluye los producidos que ninguna receta usa.
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

    slots = tuple(
        SlotFeasibility(
            recipe_name=meal.recipe.name,
            met=all(
                produced.get(ingredient, 0.0) >= count
                for ingredient, count in meal.recipe.ingredients
            ),
        )
        for meal in chosen
    )

    cooking_strength = sum(recipe_strength(m.recipe, m.level) for m in chosen)

    return CookingResult(
        cooking_strength=cooking_strength,
        ingredients=ingredients,
        surplus=surplus,
        slots=slots,
    )
```

> Nota de modelo: `met` compara el requerimiento del plato contra el producido del día completo (no descuenta lo que consumen las otras comidas). Es un indicador informativo, coherente con el alcance v1.

- [ ] **Step 4: Correr tests + tipos + lint**

Run: `cd backend && pytest tests/domain/test_cooking.py -q && mypy src && ruff check .`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/sleepmon/domain/cooking.py backend/tests/domain/test_cooking.py
git commit -m "Cocina: planificador plan_cooking (requeridos/sobrantes/fuerza)"
```

---

## Task 6: Caso de uso `compute_team_production`

**Files:**
- Modify: `backend/src/sleepmon/application/dto.py`
- Modify: `backend/src/sleepmon/application/services.py`
- Test: `backend/tests/application/test_team_service.py`

**Interfaces:**
- Consumes: `team_production`, `plan_cooking`, `MealSelection`, `daily_production`, `RecipeCatalog`, `TeamRepository`.
- Produces:
  - DTOs de entrada: `MealSelectionInput(recipe: str, level: int)`, `TeamProductionInput(member_ids: list[str], meals: list[MealSelectionInput | None])`.
  - DTOs de salida: `IngredientBalanceDTO`, `MealFeasibilityDTO`, `MemberContributionDTO`, `TeamProductionResult` (con `grand_total_strength`).
  - `TeamService.compute_team_production(data: TeamProductionInput) -> TeamProductionResult`.

- [ ] **Step 1: Escribir los tests de aplicación (fallan)**

Añadir a `backend/tests/application/test_team_service.py`. Revisar primero cómo el archivo construye el service y un miembro (helpers existentes); seguir ese patrón. Tests nuevos:

```python
from sleepmon.application.dto import (
    MealSelectionInput,
    TeamMemberInput,
    TeamProductionInput,
)
from sleepmon.adapters.outbound.catalog.static_recipe_catalog import StaticRecipeCatalog
from sleepmon.domain.errors import TeamMemberNotFoundError, ValidationError


def _service():
    from sleepmon.adapters.outbound.catalog.static_catalog import StaticSpeciesCatalog
    from sleepmon.application.services import DefaultTeamService
    from tests.fakes import InMemoryTeamRepository

    return DefaultTeamService(
        InMemoryTeamRepository(), StaticSpeciesCatalog(), StaticRecipeCatalog()
    )


def _add_pikachu(service) -> str:
    member = service.add_member(
        TeamMemberInput(
            species="Pikachu",
            level=30,
            nature="Adamant",
            ingredients=["Fancy Apple", "Warming Ginger", "Fancy Egg"],
            sub_skills=[],
        )
    )
    return str(member.id)


def test_compute_team_production_aggregates_members() -> None:
    service = _service()
    mid = _add_pikachu(service)
    result = service.compute_team_production(
        TeamProductionInput(member_ids=[mid], meals=[None, None, None])
    )
    assert result.member_count == 1
    assert result.total_strength >= 0
    assert result.grand_total_strength == result.total_strength  # sin cocina


def test_compute_team_production_adds_cooking_to_grand_total() -> None:
    service = _service()
    mid = _add_pikachu(service)
    # Tomar una receta cualquiera del catálogo.
    recipe = service.list_recipes()[0]
    result = service.compute_team_production(
        TeamProductionInput(
            member_ids=[mid],
            meals=[MealSelectionInput(recipe=recipe.name, level=1), None, None],
        )
    )
    assert result.cooking_strength == recipe.base_strength  # nivel 1 = base
    assert result.grand_total_strength == result.total_strength + result.cooking_strength


def test_compute_team_production_rejects_missing_member() -> None:
    service = _service()
    with pytest.raises(TeamMemberNotFoundError):
        service.compute_team_production(
            TeamProductionInput(
                member_ids=["00000000-0000-0000-0000-000000000000"], meals=[None, None, None]
            )
        )


def test_compute_team_production_rejects_too_many_members() -> None:
    service = _service()
    ids = [_add_pikachu(service) for _ in range(6)]
    with pytest.raises(ValidationError):
        service.compute_team_production(TeamProductionInput(member_ids=ids, meals=[None, None, None]))


def test_compute_team_production_rejects_duplicate_members() -> None:
    service = _service()
    mid = _add_pikachu(service)
    with pytest.raises(ValidationError):
        service.compute_team_production(
            TeamProductionInput(member_ids=[mid, mid], meals=[None, None, None])
        )


def test_compute_team_production_rejects_unknown_recipe() -> None:
    service = _service()
    mid = _add_pikachu(service)
    with pytest.raises(ValidationError):
        service.compute_team_production(
            TeamProductionInput(
                member_ids=[mid], meals=[MealSelectionInput(recipe="No Existe", level=1)]
            )
        )
```

- [ ] **Step 2: Correr para ver fallar**

Run: `cd backend && pytest tests/application/test_team_service.py -q`
Expected: FAIL (no existen los DTOs ni `compute_team_production`).

- [ ] **Step 3: Añadir los DTOs**

En `application/dto.py`, agregar:

```python
@dataclass(frozen=True, slots=True)
class MealSelectionInput:
    """Una comida elegida (receta + nivel) para el planificador."""

    recipe: str
    level: int = 1


@dataclass(frozen=True, slots=True)
class TeamProductionInput:
    """Datos crudos para computar la producción de un equipo (no se persiste)."""

    member_ids: list[str]
    meals: list["MealSelectionInput | None"]


@dataclass(frozen=True, slots=True)
class IngredientBalanceDTO:
    ingredient: str
    required: float
    produced: float
    balance: float


@dataclass(frozen=True, slots=True)
class MealFeasibilityDTO:
    recipe_name: str
    met: bool


@dataclass(frozen=True, slots=True)
class MemberContributionDTO:
    member_id: str
    species: str
    strength: float
    berry_amount: float
    ingredients_total: float
    skill_triggers: float


@dataclass(frozen=True, slots=True)
class TeamProductionResult:
    """Producción diaria agregada de un equipo: bayas/skills + cocina + gran total."""

    member_count: int
    excluded_count: int
    # Bayas y skills
    total_strength: float
    total_berry_amount: float
    total_berry_strength: float
    total_skill_strength: float
    ingredients: list[SlotAmount]  # agregados por tipo (reusa SlotAmount: ingredient+amount)
    total_ingredients: float
    skill_triggers: float
    skill_energy: float | None
    skill_self_energy: float | None
    skill_dream_shards: float | None
    skill_tasty_chance: float | None
    skill_extra_helpful: float | None
    skill_random_energy: float | None
    skill_cooking_ingredients: float | None
    skill_ingredient_total: float | None
    members: list[MemberContributionDTO]
    # Cocina
    cooking_strength: float
    cooking_ingredients: list[IngredientBalanceDTO]
    cooking_surplus: list[IngredientBalanceDTO]
    cooking_meals: list[MealFeasibilityDTO]
    # Gran total
    grand_total_strength: float
```

- [ ] **Step 4: Implementar `compute_team_production` en el service**

En `application/services.py`:

1. Importes nuevos:
```python
from uuid import UUID

from sleepmon.application.dto import (
    Distributions,
    IngredientBalanceDTO,
    IngredientCountDTO,
    MealFeasibilityDTO,
    MealSelectionInput,
    MemberContributionDTO,
    MemberProduction,
    ProductionInput,
    ProductionResult,
    RecipeDTO,
    SlotAmount,
    TeamMemberInput,
    TeamProductionInput,
    TeamProductionResult,
)
from sleepmon.domain.analytics import team_production
from sleepmon.domain.cooking import MealSelection, plan_cooking
from sleepmon.domain.production import DailyProduction, daily_production
```

2. Método abstracto en `TeamService`:
```python
    @abstractmethod
    def compute_team_production(self, data: TeamProductionInput) -> TeamProductionResult: ...
```

3. Constantes y la implementación en `DefaultTeamService`:
```python
    _MAX_TEAM = 5

    def compute_team_production(self, data: TeamProductionInput) -> TeamProductionResult:
        # Validación de la selección: 1..5 ids, sin duplicados.
        if not 1 <= len(data.member_ids) <= self._MAX_TEAM:
            raise ValidationError(
                f"Un equipo tiene entre 1 y {self._MAX_TEAM} miembros; llegaron "
                f"{len(data.member_ids)}."
            )
        if len(set(data.member_ids)) != len(data.member_ids):
            raise ValidationError("Un equipo no puede repetir miembros.")

        # Cargar miembros (404 si falta) y computar su producción. Los miembros con
        # especie fuera del catálogo curado se excluyen del agregado.
        entries: list[tuple[str, str, DailyProduction]] = []
        excluded = 0
        for raw_id in data.member_ids:
            member = self.get_member(UUID(raw_id))  # levanta TeamMemberNotFoundError
            species = self._catalog.get(member.species)
            if species is None:
                excluded += 1
                continue
            daily = daily_production(
                species,
                member.ingredients,
                member.level,
                member.nature,
                member.sub_skills,
                member.ribbon,
                member.skill_level,
            )
            entries.append((str(member.id), member.species, daily))

        aggregate = team_production(entries)

        # Cocina: resolver cada comida (receta + nivel) contra el catálogo.
        meals: list[MealSelection | None] = []
        for meal in data.meals:
            if meal is None:
                meals.append(None)
                continue
            recipe = self._recipes.get(meal.recipe)
            if recipe is None:
                raise ValidationError(f"Receta desconocida: {meal.recipe!r}.")
            if not 1 <= meal.level <= MAX_RECIPE_LEVEL:
                raise ValidationError(
                    f"El nivel de receta debe estar entre 1 y {MAX_RECIPE_LEVEL}; "
                    f"llegó {meal.level}."
                )
            meals.append(MealSelection(recipe=recipe, level=meal.level))

        cooking = plan_cooking(meals, aggregate.ingredients)

        return TeamProductionResult(
            member_count=aggregate.member_count,
            excluded_count=excluded,
            total_strength=aggregate.total_strength,
            total_berry_amount=aggregate.total_berry_amount,
            total_berry_strength=aggregate.total_berry_strength,
            total_skill_strength=aggregate.total_skill_strength,
            ingredients=[
                SlotAmount(ingredient=ing.value, amount=amount)
                for ing, amount in aggregate.ingredients.items()
            ],
            total_ingredients=aggregate.total_ingredients,
            skill_triggers=aggregate.skill_triggers,
            skill_energy=aggregate.skill_energy,
            skill_self_energy=aggregate.skill_self_energy,
            skill_dream_shards=aggregate.skill_dream_shards,
            skill_tasty_chance=aggregate.skill_tasty_chance,
            skill_extra_helpful=aggregate.skill_extra_helpful,
            skill_random_energy=aggregate.skill_random_energy,
            skill_cooking_ingredients=aggregate.skill_cooking_ingredients,
            skill_ingredient_total=aggregate.skill_ingredient_total,
            members=[
                MemberContributionDTO(
                    member_id=m.member_id,
                    species=m.species,
                    strength=m.strength,
                    berry_amount=m.berry_amount,
                    ingredients_total=m.ingredients_total,
                    skill_triggers=m.skill_triggers,
                )
                for m in aggregate.members
            ],
            cooking_strength=cooking.cooking_strength,
            cooking_ingredients=[
                IngredientBalanceDTO(
                    ingredient=b.ingredient.value,
                    required=b.required,
                    produced=b.produced,
                    balance=b.balance,
                )
                for b in cooking.ingredients
            ],
            cooking_surplus=[
                IngredientBalanceDTO(
                    ingredient=b.ingredient.value,
                    required=b.required,
                    produced=b.produced,
                    balance=b.balance,
                )
                for b in cooking.surplus
            ],
            cooking_meals=[
                MealFeasibilityDTO(recipe_name=s.recipe_name, met=s.met) for s in cooking.slots
            ],
            grand_total_strength=aggregate.total_strength + cooking.cooking_strength,
        )
```

4. Importar `MAX_RECIPE_LEVEL` arriba:
```python
from sleepmon.domain.catalog_data import MAX_RECIPE_LEVEL
```

- [ ] **Step 5: Correr tests + tipos + lint**

Run: `cd backend && pytest -m "not integration" -q && mypy src && ruff check .`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/sleepmon/application backend/tests/application/test_team_service.py
git commit -m "Equipos: caso de uso compute_team_production (bayas/skills + cocina + gran total)"
```

---

## Task 7: Endpoint `POST /teams/production`

**Files:**
- Modify: `backend/src/sleepmon/adapters/inbound/http/schemas.py`
- Modify: `backend/src/sleepmon/adapters/inbound/http/controllers.py`
- Modify: `backend/src/sleepmon/adapters/inbound/http/app.py`
- Test: `backend/tests/http/test_api.py`

**Interfaces:**
- Consumes: `TeamService.compute_team_production`, DTOs de Task 6.
- Produces:
  - Schemas in: `MealIn(recipe: str, level: int = 1)`, `TeamProductionIn(member_ids: list[str], meals: list[MealIn | None])`.
  - Schemas out: `IngredientBalanceOut`, `MealFeasibilityOut`, `MemberContributionOut`, `TeamProductionOut`.
  - Ruta `POST /teams/production` → `TeamProductionOut`.

- [ ] **Step 1: Escribir el test HTTP (falla)**

Añadir a `backend/tests/http/test_api.py`:

```python
def test_team_production_endpoint(client: TestClient) -> None:
    created = client.post("/team", json=valid_payload()).json()
    res = client.post(
        "/teams/production",
        json={"member_ids": [created["id"]], "meals": [None, None, None]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["member_count"] == 1
    assert "grand_total_strength" in body
    assert isinstance(body["ingredients"], list)
    assert isinstance(body["members"], list)


def test_team_production_endpoint_rejects_too_many(client: TestClient) -> None:
    ids = [client.post("/team", json=valid_payload()).json()["id"] for _ in range(6)]
    res = client.post(
        "/teams/production", json={"member_ids": ids, "meals": [None, None, None]}
    )
    assert res.status_code == 400


def test_team_production_endpoint_with_recipe(client: TestClient) -> None:
    created = client.post("/team", json=valid_payload()).json()
    recipe = client.get("/recipes").json()[0]
    res = client.post(
        "/teams/production",
        json={
            "member_ids": [created["id"]],
            "meals": [{"recipe": recipe["name"], "level": 1}, None, None],
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["cooking_strength"] == recipe["base_strength"]
    assert body["grand_total_strength"] == body["total_strength"] + body["cooking_strength"]
```

- [ ] **Step 2: Correr para ver fallar**

Run: `cd backend && pytest tests/http/test_api.py::test_team_production_endpoint -q`
Expected: FAIL (no existe la ruta).

- [ ] **Step 3: Añadir los schemas**

En `adapters/inbound/http/schemas.py`, agregar:

```python
class MealIn(msgspec.Struct, forbid_unknown_fields=True):
    recipe: str
    level: int = 1


class TeamProductionIn(msgspec.Struct, forbid_unknown_fields=True):
    member_ids: list[str]
    meals: list[MealIn | None] = msgspec.field(default_factory=list)


class IngredientBalanceOut(msgspec.Struct):
    ingredient: str
    required: float
    produced: float
    balance: float


class MealFeasibilityOut(msgspec.Struct):
    recipe_name: str
    met: bool


class MemberContributionOut(msgspec.Struct):
    member_id: str
    species: str
    strength: float
    berry_amount: float
    ingredients_total: float
    skill_triggers: float


class TeamProductionOut(msgspec.Struct):
    member_count: int
    excluded_count: int
    total_strength: float
    total_berry_amount: float
    total_berry_strength: float
    total_skill_strength: float
    ingredients: list[SlotProductionOut]
    total_ingredients: float
    skill_triggers: float
    skill_energy: float | None
    skill_self_energy: float | None
    skill_dream_shards: float | None
    skill_tasty_chance: float | None
    skill_extra_helpful: float | None
    skill_random_energy: float | None
    skill_cooking_ingredients: float | None
    skill_ingredient_total: float | None
    members: list[MemberContributionOut]
    cooking_strength: float
    cooking_ingredients: list[IngredientBalanceOut]
    cooking_surplus: list[IngredientBalanceOut]
    cooking_meals: list[MealFeasibilityOut]
    grand_total_strength: float
```

- [ ] **Step 4: Añadir el controller**

En `adapters/inbound/http/controllers.py`:

1. Ampliar el import de schemas con: `IngredientBalanceOut, MealFeasibilityOut, MealIn, MemberContributionOut, TeamProductionIn, TeamProductionOut`.
2. Ampliar el import de DTOs:
```python
from sleepmon.application.dto import (
    MealSelectionInput,
    MemberProduction,
    ProductionInput,
    TeamMemberInput,
    TeamProductionInput,
)
```
3. Agregar el controller:
```python
class TeamProductionController(Controller):
    path = "/teams/production"

    @post("/", status_code=HTTP_200_OK, sync_to_thread=True)
    def compute(
        self, service: NamedDependency[TeamService], data: TeamProductionIn
    ) -> TeamProductionOut:
        result = service.compute_team_production(
            TeamProductionInput(
                member_ids=data.member_ids,
                meals=[
                    None if m is None else MealSelectionInput(recipe=m.recipe, level=m.level)
                    for m in data.meals
                ],
            )
        )
        return TeamProductionOut(
            member_count=result.member_count,
            excluded_count=result.excluded_count,
            total_strength=result.total_strength,
            total_berry_amount=result.total_berry_amount,
            total_berry_strength=result.total_berry_strength,
            total_skill_strength=result.total_skill_strength,
            ingredients=[
                SlotProductionOut(ingredient=s.ingredient, amount=s.amount)
                for s in result.ingredients
            ],
            total_ingredients=result.total_ingredients,
            skill_triggers=result.skill_triggers,
            skill_energy=result.skill_energy,
            skill_self_energy=result.skill_self_energy,
            skill_dream_shards=result.skill_dream_shards,
            skill_tasty_chance=result.skill_tasty_chance,
            skill_extra_helpful=result.skill_extra_helpful,
            skill_random_energy=result.skill_random_energy,
            skill_cooking_ingredients=result.skill_cooking_ingredients,
            skill_ingredient_total=result.skill_ingredient_total,
            members=[
                MemberContributionOut(
                    member_id=m.member_id,
                    species=m.species,
                    strength=m.strength,
                    berry_amount=m.berry_amount,
                    ingredients_total=m.ingredients_total,
                    skill_triggers=m.skill_triggers,
                )
                for m in result.members
            ],
            cooking_strength=result.cooking_strength,
            cooking_ingredients=[
                IngredientBalanceOut(
                    ingredient=b.ingredient,
                    required=b.required,
                    produced=b.produced,
                    balance=b.balance,
                )
                for b in result.cooking_ingredients
            ],
            cooking_surplus=[
                IngredientBalanceOut(
                    ingredient=b.ingredient,
                    required=b.required,
                    produced=b.produced,
                    balance=b.balance,
                )
                for b in result.cooking_surplus
            ],
            cooking_meals=[
                MealFeasibilityOut(recipe_name=m.recipe_name, met=m.met)
                for m in result.cooking_meals
            ],
            grand_total_strength=result.grand_total_strength,
        )
```

- [ ] **Step 5: Registrar el controller en `app.py`**

En `adapters/inbound/http/app.py`, ampliar el import y `route_handlers`:
```python
from sleepmon.adapters.inbound.http.controllers import (
    CatalogController,
    ProductionController,
    RecipeController,
    TeamController,
    TeamProductionController,
)
```
```python
        route_handlers=[
            TeamController,
            CatalogController,
            ProductionController,
            RecipeController,
            TeamProductionController,
        ],
```

- [ ] **Step 6: Correr todo el backend**

Run: `cd backend && pytest -m "not integration" -q && mypy src && ruff check .`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/sleepmon/adapters/inbound/http backend/tests/http/test_api.py
git commit -m "Equipos: endpoint POST /teams/production"
```

---

## Task 8: Tipos y cliente API en el frontend

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/client.ts`

**Interfaces:**
- Produces: tipos `Recipe`, `IngredientCount`, `TeamProductionInput`, `MealInput`, `TeamProduction` (+ sub-tipos), y `api.getRecipes()`, `api.computeTeamProduction(input)`.

- [ ] **Step 1: Añadir los tipos**

En `frontend/src/types.ts`, agregar (espejo de los schemas del backend):

```typescript
export interface IngredientCount {
  ingredient: string;
  count: number;
}

export interface Recipe {
  name: string;
  type: "Curry" | "Salad" | "Dessert";
  ingredients: IngredientCount[];
  base_strength: number;
}

export interface MealInput {
  recipe: string;
  level: number;
}

export interface TeamProductionInput {
  member_ids: string[];
  // 3 slots (mañana/mediodía/noche); null = sin receta en ese slot.
  meals: (MealInput | null)[];
}

export interface IngredientBalance {
  ingredient: string;
  required: number;
  produced: number;
  balance: number;
}

export interface MealFeasibility {
  recipe_name: string;
  met: boolean;
}

export interface MemberContribution {
  member_id: string;
  species: string;
  strength: number;
  berry_amount: number;
  ingredients_total: number;
  skill_triggers: number;
}

export interface TeamProduction {
  member_count: number;
  excluded_count: number;
  total_strength: number;
  total_berry_amount: number;
  total_berry_strength: number;
  total_skill_strength: number;
  ingredients: SlotProduction[];
  total_ingredients: number;
  skill_triggers: number;
  skill_energy: number | null;
  skill_self_energy: number | null;
  skill_dream_shards: number | null;
  skill_tasty_chance: number | null;
  skill_extra_helpful: number | null;
  skill_random_energy: number | null;
  skill_cooking_ingredients: number | null;
  skill_ingredient_total: number | null;
  members: MemberContribution[];
  cooking_strength: number;
  cooking_ingredients: IngredientBalance[];
  cooking_surplus: IngredientBalance[];
  cooking_meals: MealFeasibility[];
  grand_total_strength: number;
}
```

- [ ] **Step 2: Añadir los métodos al cliente**

En `frontend/src/api/client.ts`:

1. Ampliar el import de tipos:
```typescript
import type {
  Catalog,
  Member,
  MemberInput,
  Production,
  ProductionInput,
  Recipe,
  TeamProduction,
  TeamProductionInput,
} from "../types";
```

2. Agregar al objeto `api`:
```typescript
  getRecipes: () => request<Recipe[]>("/recipes"),
  computeTeamProduction: (data: TeamProductionInput) =>
    request<TeamProduction>("/teams/production", {
      method: "POST",
      body: JSON.stringify(data),
    }),
```

- [ ] **Step 3: Verificar build de tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/client.ts
git commit -m "Equipos (front): tipos y cliente para /recipes y /teams/production"
```

---

## Task 9: Página "Equipos" + tab + i18n + verificación en preview

**Files:**
- Create: `frontend/src/pages/Teams.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/i18n/ui.ts`

**Interfaces:**
- Consumes: `api.listMembers`, `api.getRecipes`, `api.computeTeamProduction`, `BoxPicker`, `useI18n`.

> Esta tarea no tiene tests automatizados (el front no tiene suite). Se verifica en el preview (Docker frontend en :5173, según la convención del repo).

- [ ] **Step 1: Añadir claves i18n**

En `frontend/src/i18n/ui.ts`, agregar en el bloque `es` y su equivalente en `en` (usar traducción oficial para términos del juego). Claves nuevas:

```
es:
  "nav.teams": "Equipos",
  "teams.title": "Armá tu equipo",
  "teams.subtitle": "Elegí hasta 5 Pokémon de tu Caja y mirá su producción diaria y semanal.",
  "teams.empty": "Elegí hasta 5 Pokémon de tu Caja.",
  "teams.daily": "Diario",
  "teams.weekly": "Semanal",
  "teams.berriesSkills": "Bayas y skills",
  "teams.cooking": "Cocina",
  "teams.totalStrength": "Fuerza total",
  "teams.grandTotal": "Gran total de fuerza",
  "teams.berries": "Bayas",
  "teams.ingredients": "Ingredientes",
  "teams.skillTriggers": "Disparos de skill",
  "teams.perMember": "Aporte por miembro",
  "teams.breakfast": "Mañana",
  "teams.lunch": "Mediodía",
  "teams.dinner": "Noche",
  "teams.recipe": "Receta",
  "teams.recipeLevel": "Nivel de receta",
  "teams.noRecipe": "Sin receta",
  "teams.required": "Requerido",
  "teams.produced": "Producido",
  "teams.balance": "Balance",
  "teams.surplus": "Sobrantes",
  "teams.cookingStrength": "Fuerza de cocina",
  "teams.met": "Alcanzan los ingredientes",
  "teams.notMet": "Faltan ingredientes",
  "teams.excluded": "{count} miembro(s) fuera del catálogo no se cuentan.",

en (mismas claves):
  "nav.teams": "Teams",
  "teams.title": "Build your team",
  "teams.subtitle": "Pick up to 5 Pokémon from your Box and see daily and weekly output.",
  "teams.empty": "Pick up to 5 Pokémon from your Box.",
  "teams.daily": "Daily",
  "teams.weekly": "Weekly",
  "teams.berriesSkills": "Berries & skills",
  "teams.cooking": "Cooking",
  "teams.totalStrength": "Total strength",
  "teams.grandTotal": "Grand total strength",
  "teams.berries": "Berries",
  "teams.ingredients": "Ingredients",
  "teams.skillTriggers": "Skill triggers",
  "teams.perMember": "Per-member contribution",
  "teams.breakfast": "Morning",
  "teams.lunch": "Midday",
  "teams.dinner": "Night",
  "teams.recipe": "Recipe",
  "teams.recipeLevel": "Recipe level",
  "teams.noRecipe": "No recipe",
  "teams.required": "Required",
  "teams.produced": "Produced",
  "teams.balance": "Balance",
  "teams.surplus": "Surplus",
  "teams.cookingStrength": "Cooking strength",
  "teams.met": "Ingredients covered",
  "teams.notMet": "Missing ingredients",
  "teams.excluded": "{count} member(s) outside the catalog are not counted.",
```

- [ ] **Step 2: Crear la página `Teams.tsx`**

Crear `frontend/src/pages/Teams.tsx`. Patrón: como `Production.tsx`, pero agregando en vez de comparar. Reusa `BoxPicker` para elegir miembros, mantiene 3 slots de comida y un toggle diario/semanal, y muestra dos paneles + gran total.

```tsx
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { api } from "../api/client";
import { BoxPicker } from "../components/BoxPicker";
import { useI18n } from "../i18n";
import type { MealInput, Recipe } from "../types";

const MAX_TEAM = 5;
const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;

export function Teams() {
  const { t } = useI18n();
  const members = useQuery({ queryKey: ["members"], queryFn: api.listMembers });
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: api.getRecipes });

  const [selected, setSelected] = useState<string[]>([]);
  const [meals, setMeals] = useState<(MealInput | null)[]>([null, null, null]);
  const [weekly, setWeekly] = useState(false);

  const teamQuery = useQuery({
    queryKey: ["team-production", selected, meals],
    queryFn: () => api.computeTeamProduction({ member_ids: selected, meals }),
    enabled: selected.length > 0,
  });

  const factor = weekly ? 7 : 1;
  const result = teamQuery.data;

  // Recetas agrupadas por tipo para los selectores.
  const byType = useMemo(() => {
    const groups: Record<string, Recipe[]> = { Curry: [], Salad: [], Dessert: [] };
    for (const r of recipes.data ?? []) groups[r.type]?.push(r);
    return groups;
  }, [recipes.data]);

  const setMeal = (slot: number, recipeName: string, level: number) => {
    setMeals((prev) => {
      const next = [...prev];
      next[slot] = recipeName ? { recipe: recipeName, level } : null;
      return next;
    });
  };

  return (
    <section className="teams">
      <header>
        <h1>{t("teams.title")}</h1>
        <p>{t("teams.subtitle")}</p>
      </header>

      <BoxPicker
        members={members.data ?? []}
        selected={selected}
        max={MAX_TEAM}
        onChange={setSelected}
      />

      {selected.length === 0 ? (
        <p className="teams__empty">{t("teams.empty")}</p>
      ) : (
        <>
          <div className="teams__toggle" role="group" aria-label={t("teams.daily")}>
            <button type="button" aria-pressed={!weekly} onClick={() => setWeekly(false)}>
              {t("teams.daily")}
            </button>
            <button type="button" aria-pressed={weekly} onClick={() => setWeekly(true)}>
              {t("teams.weekly")}
            </button>
          </div>

          {result && (
            <>
              <p className="teams__grandtotal">
                {t("teams.grandTotal")}: {Math.round(result.grand_total_strength * factor)}
              </p>

              <section className="teams__panel">
                <h2>{t("teams.berriesSkills")}</h2>
                <p>
                  {t("teams.totalStrength")}: {Math.round(result.total_strength * factor)}
                </p>
                <p>
                  {t("teams.berries")}: {Math.round(result.total_berry_amount * factor)}
                </p>
                <p>
                  {t("teams.skillTriggers")}: {(result.skill_triggers * factor).toFixed(1)}
                </p>
                <h3>{t("teams.ingredients")}</h3>
                <ul>
                  {result.ingredients.map((i) => (
                    <li key={i.ingredient}>
                      {i.ingredient}: {(i.amount * factor).toFixed(1)}
                    </li>
                  ))}
                </ul>
                <h3>{t("teams.perMember")}</h3>
                <ul>
                  {result.members.map((m) => (
                    <li key={m.member_id}>
                      {m.species}: {Math.round(m.strength * factor)}
                    </li>
                  ))}
                </ul>
                {result.excluded_count > 0 && (
                  <p className="teams__excluded">
                    {t("teams.excluded").replace("{count}", String(result.excluded_count))}
                  </p>
                )}
              </section>

              <section className="teams__panel">
                <h2>{t("teams.cooking")}</h2>
                {MEAL_SLOTS.map((slot, idx) => (
                  <div key={slot} className="teams__meal">
                    <label>
                      {t(`teams.${slot}`)}
                      <select
                        value={meals[idx]?.recipe ?? ""}
                        onChange={(e) => setMeal(idx, e.target.value, meals[idx]?.level ?? 1)}
                      >
                        <option value="">{t("teams.noRecipe")}</option>
                        {Object.entries(byType).map(([type, list]) => (
                          <optgroup key={type} label={type}>
                            {list.map((r) => (
                              <option key={r.name} value={r.name}>
                                {r.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    {meals[idx] && (
                      <input
                        type="number"
                        min={1}
                        max={65}
                        value={meals[idx]?.level ?? 1}
                        aria-label={t("teams.recipeLevel")}
                        onChange={(e) =>
                          setMeal(idx, meals[idx]!.recipe, Number(e.target.value))
                        }
                      />
                    )}
                  </div>
                ))}

                <p>
                  {t("teams.cookingStrength")}: {Math.round(result.cooking_strength * factor)}
                </p>
                <h3>{t("teams.ingredients")}</h3>
                <table>
                  <thead>
                    <tr>
                      <th>{t("teams.ingredients")}</th>
                      <th>{t("teams.required")}</th>
                      <th>{t("teams.produced")}</th>
                      <th>{t("teams.balance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.cooking_ingredients.map((b) => (
                      <tr key={b.ingredient}>
                        <td>{b.ingredient}</td>
                        <td>{(b.required * factor).toFixed(1)}</td>
                        <td>{(b.produced * factor).toFixed(1)}</td>
                        <td>{(b.balance * factor).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3>{t("teams.surplus")}</h3>
                <ul>
                  {result.cooking_surplus.map((b) => (
                    <li key={b.ingredient}>
                      {b.ingredient}: {(b.balance * factor).toFixed(1)}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </>
      )}
    </section>
  );
}
```

> Antes de implementar, abrir `frontend/src/components/BoxPicker.tsx` y `pages/Production.tsx` para usar las props REALES de `BoxPicker` (nombres de `members`/`selected`/`onChange`/`max` pueden diferir). Ajustar el uso a la interfaz real; el resto de la página no depende de eso.

- [ ] **Step 3: Añadir la tab en `App.tsx`**

En `frontend/src/App.tsx`:
1. `import { Teams } from "./pages/Teams";`
2. `type Tab = "team" | "production" | "teams";`
3. `const TABS: Tab[] = ["team", "production", "teams"];`
4. Añadir un `<button role="tab">` para `teams` (copiando el patrón de los existentes, con `id="tab-teams"`, `aria-controls="tabpanel-teams"`, label `t("nav.teams")`).
5. Añadir el `tabpanel` correspondiente que renderiza `<Teams />`.

- [ ] **Step 4: Verificar el build de tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores. Corregir nombres de props de `BoxPicker` si `tsc` se queja.

- [ ] **Step 5: Verificar en el preview**

Levantar el stack (`docker compose up --build`) y verificar en el frontend de Docker (`:5173`, según la convención del repo — el dev server aparte falla por CORS):
1. Aparece la tab "Equipos".
2. Seleccionar 1–5 Pokémon de la Caja → se muestran los paneles de bayas/skills y cocina.
3. Elegir una receta en un slot y un nivel → cambia `cooking_strength` y el gran total.
4. Toggle diario/semanal → todos los números ×7.
5. Sin errores en consola.

Tomar screenshot como prueba.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Teams.tsx frontend/src/App.tsx frontend/src/i18n/ui.ts
git commit -m "Equipos (front): página de equipo con producción de bayas/skills y cocina"
```

---

## Self-Review (hecho al escribir el plan)

- **Cobertura del spec:**
  - §3.1 dominio recetas → Tasks 1–2. Agregación → Task 4. Cocina → Task 5. ✅
  - §3.2 aplicación (`list_recipes`, `compute_team_production`) → Tasks 3, 6. ✅
  - §3.3 HTTP (`GET /recipes`, `POST /teams/production`) → Tasks 3, 7. ✅
  - §3.4 frontend (tab, página, cliente, i18n) → Tasks 8–9. ✅
  - §5 manejo de errores (vacío, 404, >5/duplicados, receta/nivel inválidos, excluidos) → cubierto en Tasks 6–7 (validaciones + tests) y Task 9 (estado vacío). ✅
  - §6 testing → tests en cada task backend; front por preview. ✅
- **Placeholder scan:** el único punto de datos pendiente es poblar `SEED_RECIPES` con el catálogo completo (Task 2, Step 3) y la tabla `RECIPE_LEVEL_BONUS` con valores sourceados (Task 1, Step 2); ambos con procedimiento, formato y entradas verificables — es data de referencia (como `SEED_SPECIES`), no un placeholder de lógica.
- **Consistencia de tipos:** `team_production` entries `(member_id, species, DailyProduction)`; `TeamProduction.ingredients: dict[Ingredient, float]` → DTO/HTTP como `list[SlotAmount/SlotProductionOut]` (ingredient+amount); `MealSelectionInput`→`MealSelection`; nombres de campos del resultado consistentes entre dominio → DTO → schema. ✅

## Notas de implementación

- El cambio de firma de `DefaultTeamService.__init__` (3er parámetro `recipe_catalog`) rompe construcciones existentes en tests; la Task 3, Step 8 lo señala (buscar con `grep -rn "DefaultTeamService(" backend/tests`).
- `daily_production` ya valida nivel y conteo de ingredientes; en `compute_team_production` los miembros vienen del repo (ya validados al crearse), así que no se re-valida.
- Vista semanal (×7) vive solo en el front; el endpoint siempre devuelve diario.
