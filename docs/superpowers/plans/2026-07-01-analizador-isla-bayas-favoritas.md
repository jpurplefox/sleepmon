# Analizador de equipos: isla, bayas favoritas y bonus de isla — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar al analizador de equipos la selección de isla (que fija 3 bayas favoritas con ×2 de fuerza), un bonus de isla (0–85%) que amplifica toda la fuerza, y un modal de settings de 2 tabs (Isla | Meals) con selección de tipo de plato sin mezclar tipos.

**Architecture:** La data de islas vive en el dominio (`Island` enum + `ISLAND_FAVORITE_BERRIES`) y se expone por `/catalog`. El frontend resuelve las favoritas y el bonus y los manda **ya resueltos** en el request (`favorite_berries: list[str]` ≤3, `island_bonus: float` 0.0–0.85). El dominio aplica el ×2 a las bayas favoritas en la producción y el bonus como factor `(1 + bonus)` sobre cada total de fuerza. El backend devuelve, por cada total de fuerza, `*_base` (sin bonus) y el valor con bonus, para que el frontend arme el tooltip base/con-bonus. El tipo de plato es puramente frontend.

**Tech Stack:** Backend Python 3.11+, Litestar, msgspec structs, dataclasses frozen, pytest, mypy strict, ruff. Frontend React + TypeScript (Vite), TanStack Query.

## Global Constraints

- Hexagonal estricto: el dominio no importa Litestar/psycopg/msgspec. La aplicación depende de puertos, no implementaciones.
- Type hints estrictos (mypy strict). Dataclasses `frozen=True, slots=True`. Enums cerrados `StrEnum` para data del juego.
- Cada cambio de comportamiento lleva su test. Correr `pytest -m "not integration"`, `mypy src`, `ruff check .` en backend.
- i18n: strings nuevos en es **y** en. Términos del juego con traducción oficial (Pokéxperto/WikiDex), no adivinados.
- Config del análisis es **efímera**: viaja en cada request, no se persiste en DB.
- Orden de cálculo de una baya favorita: `base × 2 × (1 + bonus)` (×2 primero, bonus después, ambos multiplicativos).
- Bonus válido: `0.0 ≤ island_bonus ≤ 0.85`. Favoritas: `len ≤ 3`, sin duplicados, cada una un `Berry` válido. Fuera de rango → `ValidationError` (HTTP 422/400).

### Tabla de islas validada (data del juego, fuente nerolis-lab)

| Island enum | Valor (name) | Favoritas | user_picks |
|---|---|---|---|
| `CYAN_BEACH` | "Cyan Beach" | Oran, Pamtre, Pecha | no |
| `TAUPE_HOLLOW` | "Taupe Hollow" | Figy, Leppa, Sitrus | no |
| `SNOWDROP_TUNDRA` | "Snowdrop Tundra" | Persim, Rawst, Wiki | no |
| `LAPIS_LAKESIDE` | "Lapis Lakeside" | Cheri, Durin, Mago | no |
| `OLD_GOLD_POWER_PLANT` | "Old Gold Power Plant" | Belue, Bluk, Grepa | no |
| `AMBER_CANYON` | "Amber Canyon" | Chesto, Lum, Yache | no |
| `GREENGRASS_ISLE` | "Greengrass Isle" | () | sí |
| `GREENGRASS_EXPERT` | "Greengrass Isle (Expert Mode)" | () | sí |

## File Structure

**Backend — crear/modificar:**
- Modificar `backend/src/sleepmon/domain/value_objects.py` — nuevo enum `Island`.
- Modificar `backend/src/sleepmon/domain/catalog_data.py` — `ISLAND_FAVORITE_BERRIES`, `ISLAND_USER_PICKS`, helper `berry_strength_for_level` gana parámetro `favorite`.
- Modificar `backend/src/sleepmon/domain/production.py` — `daily_production` acepta `favorite_berries` y aplica ×2 a `berry_strength`.
- Modificar `backend/src/sleepmon/domain/analytics.py` — `team_production` acepta `island_bonus` y expone totales `*_base` + con-bonus.
- Modificar `backend/src/sleepmon/application/dto.py` — `TeamProductionInput` gana `favorite_berries`, `island_bonus`; `TeamProductionResult` gana campos `*_base` y `island_bonus`; `MemberContributionDTO` gana `strength_base`.
- Modificar `backend/src/sleepmon/application/services.py` — resolver favoritas, pasar a producción/agregado, armar los nuevos campos del result.
- Modificar `backend/src/sleepmon/adapters/inbound/http/schemas.py` — `IslandOut`, `CatalogOut.islands`, `TeamProductionIn.favorite_berries` + `.island_bonus`, `TeamProductionOut` con campos `*_base` + `island_bonus`, `MemberContributionOut.strength_base`.
- Modificar `backend/src/sleepmon/adapters/inbound/http/controllers.py` — poblar `islands` en `/catalog`; convertir nuevos campos en `/teams/production`.
- Tests: `tests/domain/test_production.py`, `tests/domain/test_team_analytics.py`, nuevo `tests/domain/test_islands.py`, `tests/http/test_api.py`.

**Frontend — crear/modificar:**
- Modificar `frontend/src/types.ts` — tipos `Island`, `favoriteBerries`/`islandBonus`/`*_base` en request/response.
- Modificar `frontend/src/api/client.ts` — pasar `favorite_berries` + `island_bonus` en `computeTeamProduction`.
- Renombrar/refactor `frontend/src/components/MealPickerModal.tsx` → `SettingsModal.tsx` con tabs; extraer `MealsTab`; crear `IslandTab`.
- Modificar `frontend/src/pages/Teams.tsx` — estado `favoriteBerries`, `islandBonus`, `dishType`; resaltado de cards favoritas; tooltip base/con-bonus.
- Crear `frontend/src/components/StrengthValue.tsx` — componente que muestra un valor de fuerza con tooltip base/con-bonus.
- Modificar `frontend/src/i18n/ui.ts` — strings es/en.

---

## FASE 1 — Backend: dominio

### Task 1: Enum `Island` y catálogo de bayas favoritas

**Files:**
- Modify: `backend/src/sleepmon/domain/value_objects.py` (después del enum `RecipeType`, ~línea 234)
- Modify: `backend/src/sleepmon/domain/catalog_data.py` (después de `BERRY_BASE_STRENGTH`, ~línea 227)
- Test: `backend/tests/domain/test_islands.py` (crear)

**Interfaces:**
- Produces:
  - `class Island(StrEnum)` con los 8 miembros de la tabla.
  - `ISLAND_FAVORITE_BERRIES: Final[Mapping[Island, tuple[Berry, ...]]]` — islas normales → 3 bayas; Greengrass/experto → `()`.
  - `ISLAND_USER_PICKS: Final[frozenset[Island]]` = `{Island.GREENGRASS_ISLE, Island.GREENGRASS_EXPERT}`.

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/tests/domain/test_islands.py`:

```python
from sleepmon.domain.catalog_data import (
    ISLAND_FAVORITE_BERRIES,
    ISLAND_USER_PICKS,
)
from sleepmon.domain.value_objects import Berry, Island


def test_every_island_is_mapped() -> None:
    assert set(ISLAND_FAVORITE_BERRIES) == set(Island)


def test_normal_islands_have_exactly_three_favorites() -> None:
    for island in Island:
        favorites = ISLAND_FAVORITE_BERRIES[island]
        if island in ISLAND_USER_PICKS:
            assert favorites == ()
        else:
            assert len(favorites) == 3
            assert len(set(favorites)) == 3


def test_greengrass_islands_pick_berries() -> None:
    assert ISLAND_USER_PICKS == {Island.GREENGRASS_ISLE, Island.GREENGRASS_EXPERT}


def test_cyan_beach_favorites() -> None:
    assert ISLAND_FAVORITE_BERRIES[Island.CYAN_BEACH] == (
        Berry.ORAN,
        Berry.PAMTRE,
        Berry.PECHA,
    )


def test_amber_canyon_favorites() -> None:
    assert ISLAND_FAVORITE_BERRIES[Island.AMBER_CANYON] == (
        Berry.CHESTO,
        Berry.LUM,
        Berry.YACHE,
    )
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && pytest tests/domain/test_islands.py -v`
Expected: FAIL con `ImportError` / `AttributeError: Island` (no existe).

- [ ] **Step 3: Agregar el enum `Island`**

En `backend/src/sleepmon/domain/value_objects.py`, después del enum `RecipeType`:

```python
class Island(StrEnum):
    """Islas / áreas de investigación de Pokémon Sleep."""

    GREENGRASS_ISLE = "Greengrass Isle"
    GREENGRASS_EXPERT = "Greengrass Isle (Expert Mode)"
    CYAN_BEACH = "Cyan Beach"
    TAUPE_HOLLOW = "Taupe Hollow"
    SNOWDROP_TUNDRA = "Snowdrop Tundra"
    LAPIS_LAKESIDE = "Lapis Lakeside"
    OLD_GOLD_POWER_PLANT = "Old Gold Power Plant"
    AMBER_CANYON = "Amber Canyon"
```

- [ ] **Step 4: Agregar la data de favoritas**

En `backend/src/sleepmon/domain/catalog_data.py`, después de `BERRY_BASE_STRENGTH`. Asegurar que `Island` esté importado desde `.value_objects` (agregar al import existente de `value_objects`):

```python
ISLAND_FAVORITE_BERRIES: Final[Mapping[Island, tuple[Berry, ...]]] = {
    Island.GREENGRASS_ISLE: (),
    Island.GREENGRASS_EXPERT: (),
    Island.CYAN_BEACH: (Berry.ORAN, Berry.PAMTRE, Berry.PECHA),
    Island.TAUPE_HOLLOW: (Berry.FIGY, Berry.LEPPA, Berry.SITRUS),
    Island.SNOWDROP_TUNDRA: (Berry.PERSIM, Berry.RAWST, Berry.WIKI),
    Island.LAPIS_LAKESIDE: (Berry.CHERI, Berry.DURIN, Berry.MAGO),
    Island.OLD_GOLD_POWER_PLANT: (Berry.BELUE, Berry.BLUK, Berry.GREPA),
    Island.AMBER_CANYON: (Berry.CHESTO, Berry.LUM, Berry.YACHE),
}

ISLAND_USER_PICKS: Final[frozenset[Island]] = frozenset(
    {Island.GREENGRASS_ISLE, Island.GREENGRASS_EXPERT}
)
```

- [ ] **Step 5: Correr tests + mypy + ruff**

Run: `cd backend && pytest tests/domain/test_islands.py -v && mypy src && ruff check .`
Expected: PASS, sin errores de tipos ni lint.

- [ ] **Step 6: Commit**

```bash
git add backend/src/sleepmon/domain/value_objects.py backend/src/sleepmon/domain/catalog_data.py backend/tests/domain/test_islands.py
git commit -m "feat(domain): enum Island y bayas favoritas por isla"
```

---

### Task 2: ×2 de baya favorita en la producción

**Files:**
- Modify: `backend/src/sleepmon/domain/catalog_data.py` — `berry_strength_for_level` gana `favorite: bool`.
- Modify: `backend/src/sleepmon/domain/production.py` — `daily_production` gana `favorite_berries` y lo usa en el cálculo de `berry_strength` (~línea 437).
- Test: `backend/tests/domain/test_production.py`

**Interfaces:**
- Consumes: `Island`, `ISLAND_FAVORITE_BERRIES` (Task 1) — no directamente; recibe el set de bayas ya resuelto.
- Produces:
  - `berry_strength_for_level(berry: Berry, level: int, *, favorite: bool = False) -> int` — si `favorite`, devuelve el doble.
  - `daily_production(..., favorite_berries: frozenset[Berry] = frozenset())` — el último parámetro keyword, con default vacío (compatibilidad hacia atrás).

- [ ] **Step 1: Escribir el test que falla**

Agregar a `backend/tests/domain/test_production.py` (usa el fixture `_species(...)` existente en ese archivo; ver los tests actuales para la firma exacta del helper). Reemplazar `<BERRY_DE_LA_ESPECIE_FIXTURE>` por la baya que carga la especie del fixture (mirar el helper `_species` del archivo):

```python
def test_favorite_berry_doubles_berry_strength() -> None:
    species = _species()  # usar el helper del archivo
    base = daily_production(species, _INGREDIENTS, level=10)
    favored = daily_production(
        species,
        _INGREDIENTS,
        level=10,
        favorite_berries=frozenset({species.berry}),
    )
    assert favored.berry_strength == base.berry_strength * 2


def test_non_favorite_berry_unchanged() -> None:
    species = _species()
    base = daily_production(species, _INGREDIENTS, level=10)
    other = daily_production(
        species,
        _INGREDIENTS,
        level=10,
        favorite_berries=frozenset({Berry.YACHE})  # baya distinta a la del fixture
        if species.berry is not Berry.YACHE
        else frozenset({Berry.ORAN}),
    )
    assert other.berry_strength == base.berry_strength
```

> Nota: si el fixture pasa `nature`/`sub_skills` como posicionales, `favorite_berries` debe ir como keyword. Asegurar que `Berry` esté importado en el test.

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && pytest tests/domain/test_production.py -k favorite -v`
Expected: FAIL con `TypeError: unexpected keyword argument 'favorite_berries'`.

- [ ] **Step 3: Extender `berry_strength_for_level`**

En `backend/src/sleepmon/domain/catalog_data.py`:

```python
def berry_strength_for_level(berry: Berry, level: int, *, favorite: bool = False) -> int:
    """Fuerza que aporta UNA baya de ``berry`` para un Pokémon de nivel ``level``.

    Si la baya es favorita de la isla activa, aporta el doble.
    """
    base = BERRY_BASE_STRENGTH[berry]
    linear = base + (level - 1)
    exponential = base * _BERRY_STRENGTH_GROWTH_RATE ** (level - 1)
    strength = round(max(linear, exponential))
    return strength * 2 if favorite else strength
```

- [ ] **Step 4: Extender `daily_production`**

En `backend/src/sleepmon/domain/production.py`, agregar el parámetro al final de la firma:

```python
def daily_production(
    species: Species,
    ingredients: tuple[Ingredient, ...],
    level: int,
    nature: Nature | None = None,
    sub_skills: tuple[SubSkill, ...] = (),
    ribbon: Ribbon = Ribbon.NONE,
    skill_level: int = 1,
    favorite_berries: frozenset[Berry] = frozenset(),
) -> DailyProduction:
```

Y en la línea del cálculo de `berry_strength` (~437):

```python
    berry_strength = berry_amount * berry_strength_for_level(
        species.berry, level, favorite=species.berry in favorite_berries
    )
```

- [ ] **Step 5: Correr tests + mypy + ruff**

Run: `cd backend && pytest tests/domain/test_production.py -v && mypy src && ruff check .`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/sleepmon/domain/catalog_data.py backend/src/sleepmon/domain/production.py backend/tests/domain/test_production.py
git commit -m "feat(domain): x2 de fuerza para bayas favoritas de la isla"
```

---

### Task 3: Bonus de isla en el agregado del equipo

**Files:**
- Modify: `backend/src/sleepmon/domain/analytics.py` — `team_production` gana `island_bonus`; `TeamProduction` gana campos `*_base` y `island_bonus`; `MemberContribution` gana `strength_base`.
- Test: `backend/tests/domain/test_team_analytics.py`

**Interfaces:**
- Consumes: `DailyProduction.berry_strength` ya con el ×2 aplicado (Task 2).
- Produces:
  - `team_production(entries, *, island_bonus: float = 0.0) -> TeamProduction`.
  - `TeamProduction` nuevos campos: `island_bonus: float`, `total_strength_base: float`, `total_berry_strength_base: float`, `total_skill_strength_base: float`. Los campos existentes `total_strength`, `total_berry_strength`, `total_skill_strength` pasan a ser **con bonus** (`base × (1 + island_bonus)`).
  - `MemberContribution` nuevo campo: `strength_base: float` (sin bonus). `strength` pasa a ser con bonus.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `backend/tests/domain/test_team_analytics.py` (usar el/los helpers de construcción de `DailyProduction` ya presentes en ese archivo; si arma entries a mano, replicar ese patrón):

```python
def test_island_bonus_scales_all_strength() -> None:
    entries = _sample_entries()  # helper del archivo: lista de (id, species, daily)
    base = team_production(entries)
    boosted = team_production(entries, island_bonus=0.5)

    assert boosted.total_berry_strength_base == base.total_berry_strength
    assert boosted.total_berry_strength == pytest.approx(base.total_berry_strength * 1.5)
    assert boosted.total_skill_strength == pytest.approx(base.total_skill_strength * 1.5)
    assert boosted.total_strength == pytest.approx(base.total_strength * 1.5)
    assert boosted.island_bonus == 0.5


def test_member_strength_has_base_and_boosted() -> None:
    entries = _sample_entries()
    boosted = team_production(entries, island_bonus=0.85)
    for member in boosted.members:
        assert member.strength == pytest.approx(member.strength_base * 1.85)


def test_zero_bonus_is_identity() -> None:
    entries = _sample_entries()
    base = team_production(entries)
    assert base.island_bonus == 0.0
    assert base.total_strength == base.total_strength_base
    for member in base.members:
        assert member.strength == member.strength_base
```

Asegurar `import pytest` en el archivo.

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && pytest tests/domain/test_team_analytics.py -k "bonus or base or identity" -v`
Expected: FAIL con `TypeError: unexpected keyword argument 'island_bonus'`.

- [ ] **Step 3: Extender `MemberContribution`**

En `backend/src/sleepmon/domain/analytics.py`, agregar el campo a la dataclass `MemberContribution` (después de `strength`):

```python
    strength: float          # con bonus de isla
    strength_base: float     # sin bonus de isla
```

- [ ] **Step 4: Extender `TeamProduction`**

En la dataclass `TeamProduction`, agregar campos (después de `total_skill_strength`):

```python
    total_strength_base: float
    total_berry_strength_base: float
    total_skill_strength_base: float
    island_bonus: float
```

- [ ] **Step 5: Aplicar el bonus en `team_production`**

Cambiar la firma y el cuerpo. La firma:

```python
def team_production(
    entries: Iterable[tuple[str, str, DailyProduction]],
    *,
    island_bonus: float = 0.0,
) -> TeamProduction:
```

Antes de construir `members`, calcular el factor y las bases:

```python
    factor = 1.0 + island_bonus

    total_berry_strength_base = sum(d.berry_strength for d in dailies)
    total_skill_strength_base = sum(d.skill_strength or 0.0 for d in dailies)
    total_strength_base = total_berry_strength_base + total_skill_strength_base
```

Construir `members` con base y con-bonus:

```python
    members = tuple(
        MemberContribution(
            member_id=member_id,
            species=species,
            strength=(daily.berry_strength + (daily.skill_strength or 0.0)) * factor,
            strength_base=daily.berry_strength + (daily.skill_strength or 0.0),
            berry_amount=daily.berry_amount,
            ingredients_total=sum(slot.amount for slot in daily.ingredients),
            skill_triggers=daily.skill_triggers,
        )
        for member_id, species, daily in entries_list
    )
```

En el `return`, cambiar los tres totales de fuerza a con-bonus y agregar los base + `island_bonus`:

```python
    return TeamProduction(
        member_count=len(entries_list),
        total_strength=total_strength_base * factor,
        total_berry_amount=sum(d.berry_amount for d in dailies),
        total_berry_strength=total_berry_strength_base * factor,
        total_skill_strength=total_skill_strength_base * factor,
        total_strength_base=total_strength_base,
        total_berry_strength_base=total_berry_strength_base,
        total_skill_strength_base=total_skill_strength_base,
        island_bonus=island_bonus,
        ingredients=ingredients,
        total_ingredients=sum(ingredients.values()),
        skill_triggers=sum(d.skill_triggers for d in dailies),
        skill_effects=tuple(skill_effects_list),
        members=members,
        **optional,
    )
```

> Los ingredientes y skill_effects NO se multiplican por el bonus (el bonus es de **fuerza**; los ingredientes son cantidades). La fuerza de cocina se escala por bonus en la capa de aplicación (Task 4).

- [ ] **Step 6: Correr tests + mypy + ruff**

Run: `cd backend && pytest tests/domain/test_team_analytics.py -v && mypy src && ruff check .`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/sleepmon/domain/analytics.py backend/tests/domain/test_team_analytics.py
git commit -m "feat(domain): bonus de isla escala la fuerza agregada y por miembro"
```

---

## FASE 2 — Backend: aplicación + HTTP

### Task 4: Servicio resuelve favoritas + bonus y arma el result

**Files:**
- Modify: `backend/src/sleepmon/application/dto.py` — `TeamProductionInput` (+`favorite_berries`, +`island_bonus`); `TeamProductionResult` (+`island_bonus` y campos `*_base`); `MemberContributionDTO` (+`strength_base`).
- Modify: `backend/src/sleepmon/application/services.py` — `compute_team_production`: validar y resolver favoritas/bonus, pasarlos a `daily_production` y `team_production`, escalar la fuerza de cocina por el bonus, poblar los nuevos campos.
- Test: `backend/tests/application/test_team_service.py`

**Interfaces:**
- Consumes: `daily_production(..., favorite_berries=...)` (Task 2), `team_production(..., island_bonus=...)` (Task 3).
- Produces:
  - `TeamProductionInput(member_ids, meals, favorite_berries: list[str] = [], island_bonus: float = 0.0)`.
  - `TeamProductionResult` nuevos campos: `island_bonus: float`, `total_strength_base: float`, `total_berry_strength_base: float`, `total_skill_strength_base: float`, `cooking_strength_base: float`, `grand_total_strength_base: float`.
  - `MemberContributionDTO.strength_base: float`.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `backend/tests/application/test_team_service.py` (reutilizar los helpers/fixtures del archivo para crear un service con miembros; ver los tests existentes de `compute_team_production` para el patrón de alta de miembros):

```python
def test_favorite_berries_and_bonus_flow(service_with_members) -> None:
    service, member_ids = service_with_members  # helper del archivo
    base = service.compute_team_production(
        TeamProductionInput(member_ids=member_ids, meals=[])
    )
    boosted = service.compute_team_production(
        TeamProductionInput(
            member_ids=member_ids,
            meals=[],
            favorite_berries=[],       # sin favoritas para aislar el efecto del bonus
            island_bonus=0.2,
        )
    )
    assert boosted.island_bonus == 0.2
    assert boosted.total_berry_strength_base == base.total_berry_strength
    assert boosted.total_berry_strength == pytest.approx(base.total_berry_strength * 1.2)
    assert boosted.grand_total_strength == pytest.approx(
        boosted.grand_total_strength_base * 1.2
    )


def test_bonus_out_of_range_rejected(service_with_members) -> None:
    service, member_ids = service_with_members
    with pytest.raises(ValidationError):
        service.compute_team_production(
            TeamProductionInput(member_ids=member_ids, meals=[], island_bonus=0.9)
        )


def test_too_many_favorites_rejected(service_with_members) -> None:
    service, member_ids = service_with_members
    with pytest.raises(ValidationError):
        service.compute_team_production(
            TeamProductionInput(
                member_ids=member_ids,
                meals=[],
                favorite_berries=["Oran", "Pecha", "Wiki", "Mago"],
            )
        )
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && pytest tests/application/test_team_service.py -k "favorite or bonus" -v`
Expected: FAIL (`TypeError` por args nuevos / falta validación).

- [ ] **Step 3: Extender los DTOs**

En `backend/src/sleepmon/application/dto.py`:

`TeamProductionInput`:

```python
@dataclass(frozen=True, slots=True)
class TeamProductionInput:
    """Datos crudos para computar la producción de un equipo (no se persiste)."""

    member_ids: list[str]
    meals: list[MealSelectionInput | None]
    favorite_berries: list[str] = field(default_factory=list)
    island_bonus: float = 0.0
```

> Asegurar `from dataclasses import dataclass, field` en el import del módulo.

`MemberContributionDTO` — agregar `strength_base: float` después de `strength`.

`TeamProductionResult` — agregar, junto a los totales de fuerza:

```python
    total_strength_base: float
    total_berry_strength_base: float
    total_skill_strength_base: float
    island_bonus: float
    cooking_strength_base: float
    grand_total_strength_base: float
```

- [ ] **Step 4: Extender el servicio**

En `backend/src/sleepmon/application/services.py`, dentro de `compute_team_production`, después de validar `member_ids` y antes del loop de miembros, resolver favoritas y bonus:

```python
        if not 0.0 <= data.island_bonus <= 0.85:
            raise ValidationError(
                f"El bonus de isla debe estar entre 0 y 0.85; llegó {data.island_bonus}."
            )
        if len(data.favorite_berries) > 3:
            raise ValidationError("Como máximo 3 bayas favoritas.")
        if len(set(data.favorite_berries)) != len(data.favorite_berries):
            raise ValidationError("Las bayas favoritas no pueden repetirse.")
        favorites: set[Berry] = set()
        for name in data.favorite_berries:
            try:
                favorites.add(Berry(name))
            except ValueError as exc:
                raise ValidationError(f"Baya desconocida: {name!r}.") from exc
        favorite_frozen = frozenset(favorites)
```

> Importar `Berry` desde `..domain.value_objects` si no está ya importado.

En la llamada a `daily_production` dentro del loop, pasar las favoritas:

```python
        daily = daily_production(
            species,
            member.ingredients,
            member.level,
            member.nature,
            member.sub_skills,
            member.ribbon,
            member.skill_level,
            favorite_berries=favorite_frozen,
        )
```

Cambiar la agregación para pasar el bonus:

```python
    aggregate = team_production(entries, island_bonus=data.island_bonus)
```

La fuerza de cocina se escala por el bonus (los `MemberContributionDTO` toman `strength_base` de `m.strength_base`):

```python
    factor = 1.0 + data.island_bonus
    cooking_strength = cooking.cooking_strength * factor
```

En el `return TeamProductionResult(...)`, cambiar/agregar:

- `total_strength=aggregate.total_strength` (ya con bonus desde Task 3).
- `total_berry_strength=aggregate.total_berry_strength`.
- `total_skill_strength=aggregate.total_skill_strength`.
- Agregar `total_strength_base=aggregate.total_strength_base`, `total_berry_strength_base=aggregate.total_berry_strength_base`, `total_skill_strength_base=aggregate.total_skill_strength_base`, `island_bonus=data.island_bonus`.
- `cooking_strength=cooking_strength` (con bonus), y agregar `cooking_strength_base=cooking.cooking_strength`.
- `grand_total_strength=aggregate.total_strength + cooking_strength`, y agregar `grand_total_strength_base=aggregate.total_strength_base + cooking.cooking_strength`.
- En cada `MemberContributionDTO(...)`, agregar `strength_base=m.strength_base`.

- [ ] **Step 5: Correr tests + mypy + ruff**

Run: `cd backend && pytest -m "not integration" && mypy src && ruff check .`
Expected: PASS (toda la suite sin DB).

- [ ] **Step 6: Commit**

```bash
git add backend/src/sleepmon/application/dto.py backend/src/sleepmon/application/services.py backend/tests/application/test_team_service.py
git commit -m "feat(app): resolver favoritas y bonus, exponer fuerza base y con-bonus"
```

---

### Task 5: HTTP — `/catalog.islands` y campos nuevos en `/teams/production`

**Files:**
- Modify: `backend/src/sleepmon/adapters/inbound/http/schemas.py` — `IslandOut`, `CatalogOut.islands`, `TeamProductionIn` (+campos), `TeamProductionOut` (+campos), `MemberContributionOut.strength_base`.
- Modify: `backend/src/sleepmon/adapters/inbound/http/controllers.py` — poblar `islands` en `/catalog`; convertir campos nuevos en `/teams/production`.
- Test: `backend/tests/http/test_api.py`

**Interfaces:**
- Consumes: `ISLAND_FAVORITE_BERRIES`, `ISLAND_USER_PICKS`, `Island` (Task 1); `TeamProductionResult` con campos nuevos (Task 4).
- Produces:
  - `CatalogOut.islands: list[IslandOut]` con `IslandOut(name: str, favorite_berries: list[str], user_picks: bool)`.
  - `TeamProductionIn.favorite_berries: list[str] = []`, `.island_bonus: float = 0.0`.
  - `TeamProductionOut` con `island_bonus`, `total_strength_base`, `total_berry_strength_base`, `total_skill_strength_base`, `cooking_strength_base`, `grand_total_strength_base`; `MemberContributionOut.strength_base`.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `backend/tests/http/test_api.py` (usar el fixture `client` existente):

```python
def test_catalog_lists_islands(client: TestClient) -> None:
    body = client.get("/catalog").json()
    islands = {i["name"]: i for i in body["islands"]}
    assert len(islands) == 8
    assert islands["Cyan Beach"]["favorite_berries"] == ["Oran", "Pamtre", "Pecha"]
    assert islands["Cyan Beach"]["user_picks"] is False
    assert islands["Greengrass Isle"]["favorite_berries"] == []
    assert islands["Greengrass Isle"]["user_picks"] is True


def test_production_accepts_island_bonus_and_favorites(client: TestClient) -> None:
    # Crear un miembro para tener equipo (reutilizar el helper de alta del archivo).
    member_id = _create_member(client)  # helper del archivo
    res = client.post(
        "/teams/production",
        json={
            "member_ids": [member_id],
            "meals": [],
            "favorite_berries": ["Oran"],
            "island_bonus": 0.3,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["island_bonus"] == 0.3
    assert body["total_berry_strength"] == pytest.approx(
        body["total_berry_strength_base"] * 1.3
    )


def test_production_rejects_bonus_over_max(client: TestClient) -> None:
    member_id = _create_member(client)
    res = client.post(
        "/teams/production",
        json={"member_ids": [member_id], "meals": [], "island_bonus": 0.9},
    )
    assert res.status_code in (400, 422)
```

> Si no existe un helper `_create_member`, mirar cómo otros tests del archivo crean un miembro vía `POST` y replicar ese armado inline.

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && pytest tests/http/test_api.py -k "island or bonus or favorite" -v`
Expected: FAIL (`KeyError: 'islands'` / campos ausentes).

- [ ] **Step 3: Agregar `IslandOut` y extender `CatalogOut`**

En `backend/src/sleepmon/adapters/inbound/http/schemas.py`:

```python
class IslandOut(msgspec.Struct):
    name: str
    favorite_berries: list[str]
    user_picks: bool
```

Agregar a `CatalogOut` el campo `islands: list[IslandOut]`.

- [ ] **Step 4: Extender `TeamProductionIn`, `TeamProductionOut`, `MemberContributionOut`**

`TeamProductionIn`:

```python
class TeamProductionIn(msgspec.Struct, forbid_unknown_fields=True):
    member_ids: list[str]
    meals: list[MealIn | None] = msgspec.field(default_factory=list)
    favorite_berries: list[str] = msgspec.field(default_factory=list)
    island_bonus: float = 0.0
```

`MemberContributionOut` — agregar `strength_base: float` después de `strength`.

`TeamProductionOut` — agregar junto a los totales:

```python
    total_strength_base: float
    total_berry_strength_base: float
    total_skill_strength_base: float
    island_bonus: float
    cooking_strength_base: float
    grand_total_strength_base: float
```

- [ ] **Step 5: Poblar `/catalog` en el controller**

En `backend/src/sleepmon/adapters/inbound/http/controllers.py`, dentro de `get_catalog`, importar `ISLAND_FAVORITE_BERRIES`, `ISLAND_USER_PICKS`, `Island` y agregar al `CatalogOut(...)`:

```python
            islands=[
                IslandOut(
                    name=island.value,
                    favorite_berries=[b.value for b in ISLAND_FAVORITE_BERRIES[island]],
                    user_picks=island in ISLAND_USER_PICKS,
                )
                for island in Island
            ],
```

- [ ] **Step 6: Pasar y devolver los campos nuevos en `/teams/production`**

En el handler `compute`, pasar los campos nuevos al `TeamProductionInput`:

```python
            TeamProductionInput(
                member_ids=data.member_ids,
                meals=[
                    None if m is None else MealSelectionInput(recipe=m.recipe, level=m.level)
                    for m in data.meals
                ],
                favorite_berries=data.favorite_berries,
                island_bonus=data.island_bonus,
            )
```

En el `TeamProductionOut(...)` de retorno, agregar los campos base/bonus (`total_strength_base=result.total_strength_base`, etc., `island_bonus=result.island_bonus`, `cooking_strength_base=result.cooking_strength_base`, `grand_total_strength_base=result.grand_total_strength_base`) y en cada `MemberContributionOut(...)` agregar `strength_base=m.strength_base`.

- [ ] **Step 7: Correr suite + mypy + ruff**

Run: `cd backend && pytest -m "not integration" && mypy src && ruff check .`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/sleepmon/adapters/inbound/http/schemas.py backend/src/sleepmon/adapters/inbound/http/controllers.py backend/tests/http/test_api.py
git commit -m "feat(http): islas en /catalog y favoritas/bonus en /teams/production"
```

---

## FASE 3 — Frontend

> Verificar en el preview con el frontend del Docker en `:5173` (CORS + HMR del host); un dev server aparte falla por CORS.

### Task 6: Tipos y cliente API

**Files:**
- Modify: `frontend/src/types.ts` — tipo `Island`, campos nuevos en request/response.
- Modify: `frontend/src/api/client.ts` — mandar `favorite_berries` + `island_bonus`.

**Interfaces:**
- Produces:
  - `type Island = { name: string; favoriteBerries: string[]; userPicks: boolean }` (mapear desde `favorite_berries`/`user_picks` del JSON, o mantener snake_case si el resto del archivo lo hace — seguir el patrón existente del archivo).
  - `computeTeamProduction(args: { member_ids: string[]; meals: (MealInput | null)[]; favorite_berries?: string[]; island_bonus?: number })`.
  - Campos nuevos en el tipo de respuesta: `island_bonus`, `total_strength_base`, `total_berry_strength_base`, `total_skill_strength_base`, `cooking_strength_base`, `grand_total_strength_base`; en cada member, `strength_base`. Catálogo: `islands`.

- [ ] **Step 1: Extender los tipos**

En `frontend/src/types.ts`, seguir el estilo existente (mirar cómo están tipados hoy `Catalog`, la respuesta de producción y `MemberContribution`). Agregar:
- Al tipo del catálogo: `islands: { name: string; favorite_berries: string[]; user_picks: boolean }[]`.
- Al tipo de la respuesta de producción: `island_bonus: number; total_strength_base: number; total_berry_strength_base: number; total_skill_strength_base: number; cooking_strength_base: number; grand_total_strength_base: number`.
- Al tipo de member contribution: `strength_base: number`.

- [ ] **Step 2: Extender el cliente**

En `frontend/src/api/client.ts`, en `computeTeamProduction`, aceptar y enviar `favorite_berries` e `island_bonus` en el body (con defaults `[]` y `0`). Mirar la firma actual y extenderla sin romper llamadas existentes.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run build` (o `npx tsc --noEmit` si está disponible)
Expected: Sin errores de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/client.ts
git commit -m "feat(front): tipos y cliente para islas, favoritas y bonus"
```

---

### Task 7: Modal de settings con tabs (Isla | Meals)

**Files:**
- Rename/refactor: `frontend/src/components/MealPickerModal.tsx` → `frontend/src/components/SettingsModal.tsx`.
- Create: `frontend/src/components/IslandTab.tsx`.
- Modify: `frontend/src/pages/Teams.tsx` — usar `SettingsModal`, pasar estado nuevo.
- Modify: `frontend/src/i18n/ui.ts` — strings de tabs, isla, bayas favoritas, bonus.

**Interfaces:**
- Consumes: catálogo con `islands` (Task 6).
- Produces:
  - `SettingsModal` con dos tabs internos: **Isla** (primera) y **Meals** (contenido actual del `MealPickerModal`, extraído a un `MealsTab` interno o inline).
  - Props nuevas: `island`, `onIslandChange`, `favoriteBerries`, `onFavoriteBerriesChange`, `islandBonus`, `onIslandBonusChange`, `dishType`, `onDishTypeChange` (además de las de meals actuales).

- [ ] **Step 1: Renombrar el modal y envolver en tabs**

Renombrar el archivo a `SettingsModal.tsx` (y el componente exportado a `SettingsModal`). Envolver el contenido actual en una estructura de tabs con dos pestañas: "Isla" (Task 8 la llena) y "Meals" (el contenido actual, movido a la segunda pestaña). La primera pestaña activa por defecto es Isla.

- [ ] **Step 2: Actualizar Teams.tsx**

Actualizar el import y el uso en `frontend/src/pages/Teams.tsx` (líneas ~16 y ~1075-1086): renombrar a `SettingsModal`, mantener el estado `mealPickerOpen`/`setMealPickerOpen` (o renombrar a `settingsOpen`). El botón "Configuración" (línea ~282) abre el modal.

- [ ] **Step 3: Strings de i18n de las tabs**

En `frontend/src/i18n/ui.ts`, agregar en es y en: `"teams.tabIsland"` ("Isla" / "Island"), `"teams.tabMeals"` ("Comidas" / "Meals").

- [ ] **Step 4: Verificar en el preview**

Levantar el frontend del Docker (`:5173`), abrir el modal desde "Configuración", confirmar que aparecen las dos pestañas y que "Meals" muestra lo de antes. Tomar screenshot.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SettingsModal.tsx frontend/src/pages/Teams.tsx frontend/src/i18n/ui.ts
git rm frontend/src/components/MealPickerModal.tsx
git commit -m "feat(front): modal de settings con tabs Isla | Meals"
```

---

### Task 8: Tab de Isla — selección, favoritas y bonus

**Files:**
- Modify: `frontend/src/components/IslandTab.tsx`.
- Modify: `frontend/src/pages/Teams.tsx` — estado `favoriteBerries`, `islandBonus`, `selectedIsland`; pasar al request.
- Modify: `frontend/src/i18n/ui.ts` — strings de islas y controles.

**Interfaces:**
- Consumes: `SettingsModal` (Task 7), catálogo `islands` (Task 6).
- Produces: estado en Teams `selectedIsland: string | null`, `favoriteBerries: string[]`, `islandBonus: number`; se agregan `favorite_berries` + `island_bonus` al `computeTeamProduction`.

- [ ] **Step 1: Controles de la tab de Isla**

En `IslandTab.tsx`:
- Selector de isla (dropdown con las `islands` del catálogo; nombres traducidos vía i18n).
- Al elegir una isla con `user_picks === false`: setear `favoriteBerries` a sus `favorite_berries` (solo lectura, mostradas como chips).
- Al elegir una isla con `user_picks === true` (Greengrass / experto): mostrar 3 selectores de baya (1 principal + 2 secundarias) entre las 18 bayas; sin duplicados. El valor resultante son las 3 bayas elegidas (todas cuentan igual para el ×2).
- Control de bonus de isla: input 0–85% (%). Guardar como fracción `0.0–0.85` en el estado (`islandBonus`). Clamp a ese rango.

- [ ] **Step 2: Estado en Teams.tsx**

Agregar estado efímero: `selectedIsland`, `favoriteBerries`, `islandBonus`. Pasar `favorite_berries: favoriteBerries` e `island_bonus: islandBonus` al `computeTeamProduction` (Task 6). Sin isla → `favoriteBerries=[]`, `islandBonus=0`.

- [ ] **Step 3: i18n de islas y controles**

Agregar en es/en los nombres de islas (traducción oficial: p. ej. "Playa Cian", "Cueva Taupe"… usar la fuente oficial WikiDex/Pokéxperto; si no hay traducción oficial confiable para alguna, dejar el nombre en inglés y anotarlo), y `"teams.islandBonus"`, `"teams.favoriteBerries"`, `"teams.mainBerry"`, `"teams.secondaryBerry"`, `"teams.selectIsland"`.

- [ ] **Step 4: Verificar en el preview**

En `:5173`: elegir Cyan Beach → ver 3 chips (Oran/Pamtre/Pecha). Elegir Greengrass → 3 selectores. Cambiar bonus a 50% → confirmar que los valores del análisis suben ×1.5. Screenshot.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/IslandTab.tsx frontend/src/pages/Teams.tsx frontend/src/i18n/ui.ts
git commit -m "feat(front): tab de Isla con favoritas y bonus"
```

---

### Task 9: Tipo de plato en la tab de Meals (sin mezclar tipos)

**Files:**
- Modify: `frontend/src/components/SettingsModal.tsx` (la parte de Meals).
- Modify: `frontend/src/pages/Teams.tsx` — estado `dishType`.
- Modify: `frontend/src/i18n/ui.ts`.

**Interfaces:**
- Consumes: la tab de Meals de Task 7.
- Produces: estado `dishType: 'Curry' | 'Salad' | 'Dessert' | null` en Teams; filtra la lista de recetas y limpia meals de otro tipo.

- [ ] **Step 1: Selector de tipo de plato**

En la tab de Meals, agregar un selector de tipo (Curry / Ensalada / Postre), selección única. El filtro de tipo existente del modal pasa a estar controlado por `dishType`. Al fijar/cambiar `dishType`, filtrar la lista a ese tipo y **limpiar** los meals ya elegidos cuyo tipo no coincida.

- [ ] **Step 2: Estado en Teams.tsx**

Agregar `dishType` (efímero, solo frontend; no viaja al backend). Handler de cambio: setear el tipo y limpiar `meals` incompatibles (comparar contra el tipo de cada receta elegida usando el catálogo de recetas).

- [ ] **Step 3: i18n**

Agregar `"teams.dishType"` ("Tipo de plato" / "Dish type") y las etiquetas de tipo si no existen ya en i18n.

- [ ] **Step 4: Verificar en el preview**

En `:5173`: elegir "Curry", agregar un curry, cambiar a "Ensalada" → confirmar que el curry se limpió y la lista solo muestra ensaladas. Screenshot.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SettingsModal.tsx frontend/src/pages/Teams.tsx frontend/src/i18n/ui.ts
git commit -m "feat(front): tipo de plato en tab Meals, sin mezclar tipos"
```

---

### Task 10: Resaltado de cards de baya favorita

**Files:**
- Modify: `frontend/src/pages/Teams.tsx` — marcar las cards cuyos Pokémon producen una baya favorita.
- Modify: `frontend/src/styles.css` — estilo de resaltado.
- (Opcional) Modify: `frontend/src/components/ProductionCard.tsx` si el resaltado va en esa card.

**Interfaces:**
- Consumes: `favoriteBerries` (Task 8); el catálogo de especies para saber qué baya produce cada miembro.
- Produces: clase CSS de resaltado aplicada a las cards de miembros con baya favorita.

- [ ] **Step 1: Determinar qué cards resaltar**

En `Teams.tsx`, para cada miembro del roster, mirar la baya de su especie (del catálogo) y comparar con `favoriteBerries`. Si coincide, marcar la card (prop/clase).

- [ ] **Step 2: Estilo de resaltado**

En `styles.css`, agregar una clase de resaltado coherente con el concepto visual existente (borde/acento; **el tratamiento visual concreto lo definen los agentes de frontend** — ver Task 12). Placeholder mínimo funcional: un borde de acento y un badge "×2". Refinar en Task 12.

- [ ] **Step 3: Verificar en el preview**

En `:5173`: con Cyan Beach elegida, los Pokémon que cargan Oran/Pamtre/Pecha se ven resaltados; el resto no. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Teams.tsx frontend/src/styles.css frontend/src/components/ProductionCard.tsx
git commit -m "feat(front): resaltar cards con baya favorita de la isla"
```

---

### Task 11: Tooltip base / con-bonus en los valores de fuerza

**Files:**
- Create: `frontend/src/components/StrengthValue.tsx`.
- Modify: `frontend/src/pages/Teams.tsx` — usar `StrengthValue` en los valores de fuerza (bayas, cocina, fillers, totales).
- Modify: `frontend/src/i18n/ui.ts` — labels del tooltip.
- Modify: `frontend/src/styles.css` — estilo del tooltip.

**Interfaces:**
- Consumes: los campos `*_base` y con-bonus del response (Task 6): `total_strength`/`total_strength_base`, `total_berry_strength`/`_base`, `cooking_strength`/`_base`, `grand_total_strength`/`_base`, y `strength`/`strength_base` por miembro.
- Produces: `StrengthValue({ value: number; base: number; bonus: number })` — muestra `value` y, al hover, el desglose base vs con-bonus.

- [ ] **Step 1: Componente `StrengthValue`**

Crear `StrengthValue.tsx`: renderiza el número (con bonus) y un tooltip al hover que muestra dos líneas: **Base** (`base`) y **Con bonus (+X%)** (`value`). Si `bonus === 0` o `base === value`, mostrar solo el número sin tooltip (o un tooltip simple). Formatear números con el helper de formato existente del proyecto (buscar cómo se formatean hoy las fuerzas en Teams.tsx y reusarlo).

- [ ] **Step 2: Usarlo en Teams.tsx**

Reemplazar los renders de valores de fuerza (fuerza de bayas total, por tipo, cocina, fillers, totales diarios/semanales, y por miembro) por `<StrengthValue value={...} base={...} bonus={islandBonus} />`, tomando los pares `*` / `*_base` del response.

> Para el desglose por tipo de baya (berryBreakdown, ~líneas 182-203): el backend hoy no manda `*_base` por baya individual. Derivar el base dividiendo por `(1 + islandBonus)` cuando `islandBonus > 0`, o (preferible) mostrar el tooltip base/con-bonus solo en los totales que tienen `*_base` explícito. Elegir la segunda opción para no inventar bases: aplicar `StrengthValue` con desglose donde hay `*_base`; en el resto, render simple.

- [ ] **Step 3: i18n + estilo**

Agregar `"teams.strengthBase"` ("Base" / "Base") y `"teams.strengthWithBonus"` ("Con bonus (+{bonus}%)" / "With bonus (+{bonus}%)"). Estilo del tooltip en `styles.css` coherente con los tooltips existentes.

- [ ] **Step 4: Verificar en el preview**

En `:5173`: con bonus 30%, pasar el cursor sobre el total de fuerza → ver "Base: N" y "Con bonus (+30%): N×1.3". Screenshot.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StrengthValue.tsx frontend/src/pages/Teams.tsx frontend/src/i18n/ui.ts frontend/src/styles.css
git commit -m "feat(front): tooltip base/con-bonus en valores de fuerza"
```

---

### Task 12: Pulido visual (agentes de frontend)

**Files:**
- Modify: `frontend/src/styles.css`, `frontend/src/components/IslandTab.tsx`, `frontend/src/components/StrengthValue.tsx`, `frontend/src/pages/Teams.tsx` (según recomienden).

**Interfaces:**
- Consumes: todo lo anterior ya funcional.
- Produces: tratamiento visual final del resaltado de favoritas, el control de bonus y el tooltip, coherente con el concepto visual único del frontend.

- [ ] **Step 1: Revisión de diseño**

Despachar los agentes `frontend-ui-minimalist` y `frontend-ux-reviewer` sobre `frontend/src` para que propongan (con archivo:línea): (a) cómo debe resaltarse una card de baya favorita frente al resto; (b) el mejor control para el bonus de isla (slider vs stepper) y su ubicación; (c) el diseño del tooltip base/con-bonus. Coherente con `styles.css` existente.

- [ ] **Step 2: Aplicar las recomendaciones**

Implementar los cambios propuestos que mejoren claridad sin romper comportamiento. Mantener el badge "×2" o reemplazarlo por lo que recomienden.

- [ ] **Step 3: Verificar en el preview**

En `:5173`: revisar resaltado, control de bonus y tooltip en claro y oscuro (`preview_resize` para responsive). Screenshots antes/después.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "style(front): pulido visual de resaltado, bonus y tooltip"
```

---

## Cierre

- [ ] **Backend completo:** `cd backend && pytest -m "not integration" && mypy src && ruff check .` → todo verde.
- [ ] **Frontend build:** `cd frontend && npm run build` → sin errores.
- [ ] **Verificación end-to-end en `:5173`:** elegir isla → favoritas resaltadas y ×2; bonus 85% → todos los valores suben y el tooltip muestra el desglose; tipo de plato limpia meals incompatibles. Screenshot final.
- [ ] **Finalizar la rama** con la skill `superpowers:finishing-a-development-branch` (merge/PR).

## Cobertura del spec

- Modal 2 tabs (Isla | Meals) → Task 7.
- Islas en catálogo del dominio + `/catalog` → Tasks 1, 5.
- Favoritas ×2 → Tasks 2 (dominio), 5/6 (contrato), 10 (resaltado).
- Green Grass / experto eligen bayas → Task 8.
- Bonus 0–85% sobre toda la fuerza → Tasks 3 (agregado), 4 (cocina + result), 5/6 (contrato).
- Orden `base × 2 × (1 + bonus)` → Tasks 2 + 3.
- Response con `*_base` + con-bonus → Tasks 3, 4, 5.
- Tooltip base/con-bonus → Task 11.
- Tipo de plato en Meals, sin mezclar → Task 9.
- i18n es/en → Tasks 7, 8, 9, 11.
- Efímero (sin persistencia) → todo el flujo viaja en el request; no hay tareas de DB.
