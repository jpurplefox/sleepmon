# Diseño — Herramienta de equipos: producción (bayas/skills) + cocina

**Fecha:** 2026-06-29
**Branch sugerida:** a definir al implementar (este trabajo es nuevo, no parte de `feature/caja-box-responsive`).
**Estado:** aprobado el diseño; pendiente revisión del spec escrito.

## 1. Resumen

Nueva herramienta para **armar un equipo de hasta 5 Pokémon** (referenciados desde la
Caja existente) y ver su **producción diaria y semanal** en dos categorías:

1. **Bayas y skills** — agregado de la producción por miembro que ya calcula el dominio
   (fuerza por bayas, fuerza de Charge Strength, disparos de skill, energía repartida,
   etc.).
2. **Cocina** — planificás **3 comidas/día** (mañana / mediodía / noche), elegís una
   receta y su nivel en cada slot, y ves los ingredientes **requeridos vs producidos vs
   sobrantes** y la **fuerza aportada por las recetas** elegidas.

El **gran total** de fuerza del equipo = fuerza (bayas + skills) + fuerza (cocina).

El equipo es **efímero**: se arma al vuelo desde la Caja, no se persiste (no hay tabla
ni CRUD de equipos). La vista **semanal** es la diaria ×7.

La herramienta introduce un subsistema de **recetas** que hoy **no existe** en el código
(solo existe el lado *skills* de cocina: `Cooking Power-Up S` agranda el pote). Por eso
el spec incluye, como cimiento, un **catálogo de recetas** de dominio (estilo
`species.py`).

## 2. Decisiones de diseño (cerradas con el usuario)

- **Fuente de miembros:** un equipo es una selección de hasta 5 Pokémon **de la Caja**,
  referenciados por id. Editar un Pokémon en la Caja se refleja en el equipo.
- **Persistencia:** ninguna. Equipo efímero; al recargar se pierde la selección.
- **Métricas de "bayas y skills":** fuerza total, bayas e ingredientes (totales y por
  tipo), skills/energía y otros agregados, **y** desglose por miembro.
- **Semanal:** diaria × 7 (se resuelve en el frontend).
- **Agregación:** en el **backend** (función pura de dominio + endpoint). El frontend
  selecciona y renderiza; no contiene lógica de agregación.
- **Recetas:** **catálogo completo** de los 3 tipos. Fuerza de una receta = **valor base
  fijo del catálogo × bonus por nivel de receta** (el nivel se elige por slot en la UI).
- **Cocina:** 3 slots/día (mañana/mediodía/noche); **cualquier receta de cualquier tipo
  entra en cualquier slot** (los slots no están atados a un tipo). La fuerza de cada
  receta se cuenta **se cumplan o no** los requisitos de ingredientes; el cumplimiento es
  solo un indicador informativo.
- **Un solo spec** cubre catálogo + herramienta + frontend.

## 3. Arquitectura (hexagonal, como el resto del repo)

Se respeta la regla del proyecto: el dominio no conoce Litestar/psycopg; la aplicación
depende de puertos; cada cambio de comportamiento lleva test.

### 3.1 Dominio

**`domain/value_objects.py`**
- Nuevo `RecipeType(StrEnum)`: `CURRY` / `SALAD` / `DESSERT` (valores en inglés, como
  `Ingredient`, `Berry`). Etiquetas legibles (curries/stews, salads, desserts/drinks) van
  por i18n en el front.

**`domain/recipes.py`** (nuevo — molde de `species.py`)
- `Recipe` frozen + slots:
  - `name: str`
  - `type: RecipeType`
  - `ingredients: tuple[tuple[Ingredient, int], ...]` (ingrediente → cantidad; inmutable
    y ordenado)
  - `base_strength: int`
- `recipe_strength(recipe: Recipe, level: int) -> int`: `base_strength × bonus(level)`,
  validando el rango de nivel (igual que `berry_strength_for_level`).
- `SEED_RECIPES`: **dataset completo** de los 3 tipos. Ampliar/corregir = agregar o
  editar entradas (igual que `SEED_SPECIES`).

**`domain/catalog_data.py`** (tablas del juego)
- `MAX_RECIPE_LEVEL: int`.
- `RECIPE_LEVEL_BONUS`: tabla nivel → multiplicador (≥ 1.0, monótona creciente,
  `bonus(1) = 1.0`). Sourceada con la data de recetas.

**`domain/analytics.py`** (agregación del equipo — hermana de las distribuciones)
- `TeamProduction` frozen dataclass con:
  - `member_count: int`, `excluded_count: int` (miembros con especie fuera del catálogo
    curado: se excluyen del agregado y se informan).
  - `total_strength: float` = Σ `berry_strength` + Σ `skill_strength` (los `None` no
    suman). **Solo bayas + skills**; la fuerza de cocina se suma aparte en la capa de
    aplicación para el gran total.
  - `total_berry_amount: float`, `total_berry_strength: float`.
  - `total_skill_strength: float`.
  - `ingredients: dict[Ingredient, float]` — agregado **por tipo**, sumando slots
    normales (`ingredients`) + main skill (`skill_ingredients`). `total_ingredients`.
  - `skill_triggers: float` y agregados opcionales (`skill_energy`, `skill_self_energy`,
    `skill_dream_shards`, `skill_tasty_chance`, `skill_extra_helpful`,
    `skill_random_energy`, `skill_cooking_ingredients`, `skill_ingredient_total`): suma de
    los presentes; `None` si ningún miembro la aporta.
  - `members: tuple[MemberContribution, ...]` — `{id, species, strength, berry_amount,
    ingredients_total, skill_triggers}` por miembro (desglose).
- `team_production(members: Iterable[tuple[member_id, species_name, DailyProduction]]) ->
  TeamProduction`: función pura. (La firma exacta se ajusta para llevar id + especie del
  desglose; no recibe `TeamMember` para no acoplar a producción.)

**`domain/cooking.py`** (nuevo — planificador puro)
- `CookingPlan`: las 3 selecciones, cada una `(recipe, level)` o vacía.
- `CookingResult` frozen:
  - `cooking_strength: float` = Σ `recipe_strength(recipe, level)` de los slots elegidos.
  - `ingredients: tuple[IngredientBalance, ...]` con, por ingrediente,
    `required` (Σ de las recetas), `produced` (del equipo), `balance` (sobra/falta).
  - `surplus: tuple[IngredientBalance, ...]` — producidos que ninguna receta usa
    (derivable del anterior; se expone para la UI).
  - `slots: tuple[SlotFeasibility, ...]` — por slot, flag `met` (alcanzan los
    ingredientes del día) — **informativo**, no altera la fuerza.
- `plan_cooking(plan: CookingPlan, produced: Mapping[Ingredient, float]) -> CookingResult`:
  función pura. `produced` viene del agregado del equipo.

### 3.2 Aplicación

**`application/ports.py`** (puertos secundarios)
- `RecipeCatalog(ABC)`: `get(name) -> Recipe | None`, `all() -> Sequence[Recipe]`.

**`application/services.py` (`TeamService`)**
- `list_recipes() -> list[RecipeDTO]` — expone el catálogo para los selectores del front.
- `compute_team_production(input: TeamProductionInput) -> TeamProductionResult`:
  - `input`: `member_ids` (1–5, **sin duplicados**) + `meals` (3 slots, cada uno
    `(recipe_name, level)` opcional).
  - Carga cada miembro del repo (reusa `_member_production` / `daily_production`); un id
    inexistente → `TeamMemberNotFoundError` (404). Miembros con especie fuera del catálogo
    se excluyen (cuentan en `excluded_count`).
  - Agrega con `team_production`, planifica cocina con `plan_cooking`, y arma el
    resultado con el **gran total** = `total_strength` (bayas+skills) + `cooking_strength`.
  - Validaciones: 1–5 ids únicos; recetas existentes en el catálogo; nivel de receta en
    `[1, MAX_RECIPE_LEVEL]`. Se reusan helpers de validación del estilo de
    `_parse_enum`/`validate_*`.

**`application/dto.py`**
- `RecipeDTO`, `IngredientCountDTO`.
- `TeamProductionInput`, `MealSelectionDTO`.
- `TeamProductionResult` (bayas/skills + cocina + `grand_total_strength` + desglose).

### 3.3 HTTP (`adapters/inbound/http/`)

- `GET /recipes` → lista de `RecipeDTO` (`{name, type, ingredients:[{ingredient,count}],
  base_strength}`). Va en `CatalogController` (junto a especies/ingredientes) o en uno
  propio; decisión menor de implementación.
- `POST /teams/production` con body `{ member_ids: [...], meals: [{recipe, level}|null ×3] }`
  → `TeamProductionResult`. Stateless, no persiste nada.
- Schemas de entrada/salida en `schemas.py`; controllers cableados en `app.py` con el
  `RecipeCatalog` inyectado en el composition root.

### 3.4 Frontend (`frontend/src/`)

- **Nueva tab "Equipos"** (tercera, junto a Caja y Comparación) en `App.tsx`
  (`type Tab = "team" | "production" | "teams"`, navegación por flechas ya existente).
- Nueva página `pages/Teams.tsx`:
  - **Selección** de hasta 5 miembros reusando `BoxPicker` (ya usado por Comparación).
  - **Toggle diario / semanal** (×7 sobre todas las métricas).
  - **Panel "Bayas y skills":** hero de fuerza total, totales de bayas e ingredientes (con
    íconos, reusando `sprites`/íconos de ingrediente), agregados de skills/energía, y una
    tabla de **desglose por miembro**.
  - **Panel "Cocina":** 3 selectores de comida (dropdown de recetas **agrupado por tipo**
    + selector de nivel por slot), tabla de **ingredientes requeridos vs producidos vs
    balance**, lista de **sobrantes**, y la **fuerza de cocina**. Indicador por slot de si
    los ingredientes del día alcanzan (informativo).
  - **Gran total** de fuerza (bayas+skills + cocina).
- `api/client.ts`: `getRecipes()` y `computeTeamProduction(input)`.
- **i18n:** etiquetas nuevas en `i18n/ui.ts` (es/en), incluyendo `nav.teams`, tipos de
  receta y nombres de receta. Términos del juego con su traducción oficial
  (Pokéxperto/WikiDex), no inventar (ver convención de i18n del repo).
- Datos vía TanStack Query (catálogo de recetas cacheado; recomputar el agregado al
  cambiar selección/comidas).

## 4. Flujo de datos

```
Caja (TeamRepository)  ──┐
                         ├─►  POST /teams/production { member_ids, meals }
RecipeCatalog (estático) ┘
        │
        ▼  TeamService.compute_team_production
  por miembro: daily_production (reusa cálculo existente)
        │
        ├─► analytics.team_production  → agregado bayas/skills + desglose
        └─► cooking.plan_cooking       → requeridos/sobrantes + fuerza de cocina
        │
        ▼
  TeamProductionResult { bayas/skills, cocina, grand_total_strength }
        │
        ▼  frontend renderiza; ×7 para la vista semanal
```

## 5. Manejo de errores

- **Selección vacía:** el front no llama al endpoint; muestra estado vacío ("elegí hasta
  5 Pokémon de tu Caja").
- **id inexistente** (miembro borrado entre selección y cómputo): 404
  `TeamMemberNotFoundError`; el front re-sincroniza la selección con la Caja.
- **>5 ids o ids duplicados:** error de validación (400) con mensaje claro.
- **Receta inexistente / nivel fuera de rango:** error de validación (400).
- **Especie fuera del catálogo curado:** no es error; el miembro se excluye del agregado y
  se informa (`excluded_count`).
- **Sin comidas elegidas:** cocina con fuerza 0 y sin requeridos; válido.

## 6. Testing

Backend (`pytest`, sin DB salvo donde aplique):
- **Dominio recetas:** `recipe_strength` (nivel 1 = base, sube con nivel, rango inválido
  falla); integridad de `SEED_RECIPES` (`base_strength > 0`, tipos/ingredientes válidos,
  nombres únicos); `RECIPE_LEVEL_BONUS` monótona y `bonus(1)=1.0`.
- **Dominio agregación:** `team_production` suma fuerza/bayas/ingredientes por tipo;
  maneja métricas opcionales (`None` si nadie aporta); equipo vacío; exclusión de especies
  fuera del catálogo.
- **Dominio cocina:** `plan_cooking` calcula requeridos, balance (sobra/falta), sobrantes;
  fuerza contada aunque no alcancen los ingredientes; slots vacíos.
- **Aplicación:** `compute_team_production` carga miembros, 404 en id faltante, valida
  1–5 únicos y recetas/niveles, arma el gran total; `list_recipes`.
- **HTTP:** `GET /recipes` y `POST /teams/production` cumplen el contrato (status + shape).

Frontend: verificación manual en el preview (Docker frontend en :5173, según la convención
del repo); no hay suite de tests de front en el proyecto.

## 7. Fuentes de datos (recetas)

Mismas fuentes que el catálogo de especies: **nitoyon** (`pokesleep-tool`) y
**nerolis-lab** (sleepapi) para recetas, ingredientes requeridos, fuerza base y la tabla de
bonus por nivel de receta. La data se sourcea durante la implementación y queda validada
por los tests de integridad del dataset. Si las fuentes difieren, se documenta la elegida.

## 8. Orden de implementación sugerido

1. **Cimiento recetas:** `RecipeType`, `Recipe`, `RECIPE_LEVEL_BONUS`, `recipe_strength`,
   `SEED_RECIPES` (data), `RecipeCatalog` + adapter estático, `GET /recipes`, tests.
2. **Agregación equipo:** `team_production` en `analytics.py` + DTOs + tests.
3. **Cocina:** `cooking.py` (`plan_cooking`) + tests.
4. **Aplicación + HTTP:** `compute_team_production`, `POST /teams/production`, cableado en
   `app.py`, tests.
5. **Frontend:** tab "Equipos", `Teams.tsx`, cliente API, i18n, verificación en preview.

## 9. Fuera de alcance (v1)

- Persistir equipos / múltiples equipos guardados.
- Modelo temporal fino (reset semanal, variación día a día más allá de ×7).
- Atar slots de comida a tipos de receta.
- Crítico Extra Tasty, Area Bonus, baya favorita ×2, pote (Cooking Power-Up) afectando la
  fuerza de cocina: la fuerza de receta v1 es `base × bonus de nivel`.
