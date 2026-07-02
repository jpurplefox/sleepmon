# Good Camp Ticket (GCT) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Soportar el Good Camp Ticket en el análisis de equipo: los Pokémon ayudan 20% más rápido y cargan 20% más de inventario (backend), y el pote de cocina es 50% más grande, redondeado hacia arriba (frontend).

**Architecture:** El GCT es un booleano global que se activa desde un toggle en la primera pestaña (Island) del modal de settings. Viaja al backend como un campo del request de `POST /teams/production` (DTO → service → dominio) donde afecta `daily_production` (velocidad de ayuda e inventario). El pote NO se calcula en backend: es puramente frontend, así que el efecto ×1.5 se aplica en la capa React.

**Tech Stack:** Backend Python/Litestar (msgspec schemas, dataclasses frozen, pytest). Frontend React + TypeScript (Vite, TanStack Query). El frontend no tiene framework de tests: se verifica con `npm run build` (typecheck con `tsc --noEmit`) y verificación en preview.

## Global Constraints

- **Hexagonal estricto**: el dominio (`domain/`) no importa infraestructura; la aplicación depende de puertos. El flag sigue el mismo camino que `island_bonus` (ya existente) como patrón de referencia.
- **mypy strict + ruff** deben pasar en backend: `mypy src && ruff check .` desde `backend/`.
- **Cada cambio de comportamiento lleva su test** (backend). El default del flag es `False` en todas las capas.
- **Semántica exacta** (copiada del spec):
  - Ayuda: intervalo × `0.8` con GCT, dentro del `math.floor` existente de `seconds_per_help`.
  - Inventario: `round((carry_limit + inventory_bonus + ribbon_bonus) × 1.2)` con GCT (sobre el total, redondeo al más cercano).
  - Pote (frontend, por comida, ceil): con GCT `perMealPot = ceil((potSize + cookingExtra/3) × 1.5)`; sin GCT queda `potSize + floor(cookingExtra/3)` (comportamiento actual sin cambios).
- **i18n es/en**: toda cadena visible se agrega en ambos idiomas en `frontend/src/i18n/ui.ts`.

---

### Task 1: Dominio — GCT en `daily_production` (velocidad + inventario)

**Files:**
- Modify: `backend/src/sleepmon/domain/catalog_data.py` (constantes nuevas)
- Modify: `backend/src/sleepmon/domain/production.py:220-305` (param + aplicación)
- Test: `backend/tests/domain/test_production.py`

**Interfaces:**
- Consumes: `Species`, `daily_production(...)` existente.
- Produces: `daily_production(..., good_camp_ticket: bool = False)` — nuevo parámetro keyword al final de la firma. Constantes `GOOD_CAMP_TICKET_SPEED_FACTOR = 0.8` y `GOOD_CAMP_TICKET_INVENTORY_FACTOR = 1.2` en `catalog_data`.

- [ ] **Step 1: Escribir los tests que fallan**

En `backend/tests/domain/test_production.py`, agregar al final del archivo (usan el helper `_species` y `_INGREDIENTS` ya definidos arriba en el módulo):

```python
def test_good_camp_ticket_speeds_up_helps() -> None:
    # El intervalo se multiplica por 0.8 antes del floor → menos segundos por ayuda.
    without = daily_production(
        _species(help_frequency_seconds=3600), _INGREDIENTS, level=1
    )
    with_gct = daily_production(
        _species(help_frequency_seconds=3600), _INGREDIENTS, level=1,
        good_camp_ticket=True,
    )
    assert with_gct.seconds_per_help == math.floor(without.seconds_per_help * 0.8)
    assert with_gct.helps_per_day > without.helps_per_day


def test_good_camp_ticket_raises_inventory_by_20_percent_rounded() -> None:
    # round(62 * 1.2) = round(74.4) = 74.
    prod = daily_production(
        _species(base_inventory=62), _INGREDIENTS, level=60,
        good_camp_ticket=True,
    )
    assert prod.inventory == 74


def test_good_camp_ticket_inventory_applies_over_total() -> None:
    # El ×1.2 va sobre el total (base + Inventory Up + evoluciones), no solo la base.
    # base 11 + INVENTORY_UP_M(12) + INVENTORY_UP_S(6) = 29 → round(29 * 1.2) = round(34.8) = 35.
    prod = daily_production(
        _species(base_inventory=11), _INGREDIENTS, level=60,
        sub_skills=(SubSkill.INVENTORY_UP_M, SubSkill.INVENTORY_UP_S),
        good_camp_ticket=True,
    )
    assert prod.inventory == 35


def test_no_good_camp_ticket_leaves_values_unchanged() -> None:
    # Sin GCT (default) los valores son idénticos al cálculo actual.
    default = daily_production(_species(base_inventory=50), _INGREDIENTS, level=30)
    explicit_off = daily_production(
        _species(base_inventory=50), _INGREDIENTS, level=30,
        good_camp_ticket=False,
    )
    assert default.seconds_per_help == explicit_off.seconds_per_help
    assert default.inventory == explicit_off.inventory == 50
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && pytest tests/domain/test_production.py -k good_camp_ticket -v`
Expected: FAIL con `TypeError: daily_production() got an unexpected keyword argument 'good_camp_ticket'`.

- [ ] **Step 3: Agregar las constantes en `catalog_data.py`**

Ubicar el bloque de constantes junto a `FREQUENCY_REDUCTION_PER_LEVEL` / `INVENTORY_BONUS_PER_EVOLUTION` y agregar:

```python
# Good Camp Ticket: los Pokémon ayudan 20% más rápido (intervalo × 0.8) y cargan
# 20% más de inventario (carry size × 1.2). El efecto de pote (×1.5) es frontend.
GOOD_CAMP_TICKET_SPEED_FACTOR: Final = 0.8
GOOD_CAMP_TICKET_INVENTORY_FACTOR: Final = 1.2
```

(`Final` ya está importado en el módulo; si no, agregarlo a `from typing import Final`.)

- [ ] **Step 4: Aplicar el flag en `daily_production`**

En `production.py`, agregar el import de las constantes al bloque existente que trae cosas de `catalog_data` (junto a `FREQUENCY_REDUCTION_PER_LEVEL`, `MAX_ENERGY_BONUS`):

```python
from sleepmon.domain.catalog_data import (
    # ...las que ya estén importadas...
    GOOD_CAMP_TICKET_INVENTORY_FACTOR,
    GOOD_CAMP_TICKET_SPEED_FACTOR,
)
```

Agregar el parámetro a la firma (último keyword, después de `favorite_berries`):

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
    good_camp_ticket: bool = False,
) -> DailyProduction:
```

Reemplazar el cálculo de `seconds_per_help` (actualmente en las líneas ~278-280) para incluir el factor de campamento dentro del `floor`:

```python
    camp_speed = GOOD_CAMP_TICKET_SPEED_FACTOR if good_camp_ticket else 1.0
    seconds_per_help = math.floor(
        species.help_frequency_seconds
        * level_factor
        * speed_factor
        * camp_speed
        / MAX_ENERGY_BONUS
    )
```

Reemplazar el cálculo de `inventory` (actualmente la línea ~305) para aplicar el ×1.2 sobre el total con `round`:

```python
    camp_inventory = GOOD_CAMP_TICKET_INVENTORY_FACTOR if good_camp_ticket else 1.0
    inventory = round(
        (species.carry_limit + inventory_bonus + ribbon_inventory_bonus(ribbon))
        * camp_inventory
    )
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `cd backend && pytest tests/domain/test_production.py -v`
Expected: PASS (los 4 tests nuevos y los existentes).

- [ ] **Step 6: mypy + ruff**

Run: `cd backend && mypy src && ruff check .`
Expected: sin errores. (`round(float)` en Python devuelve `int`, compatible con `inventory: int`.)

- [ ] **Step 7: Commit**

```bash
git add backend/src/sleepmon/domain/catalog_data.py backend/src/sleepmon/domain/production.py backend/tests/domain/test_production.py
git commit -m "feat(domain): Good Camp Ticket en daily_production (ayuda +20% rápida, inventario +20%)"
```

---

### Task 2: Aplicación + HTTP — el flag `good_camp_ticket` fluye del request al dominio

**Files:**
- Modify: `backend/src/sleepmon/application/dto.py:146-153` (campo en `TeamProductionInput`)
- Modify: `backend/src/sleepmon/application/services.py:326-335` (pasar el flag a `daily_production`)
- Modify: `backend/src/sleepmon/adapters/inbound/http/schemas.py:170-174` (campo en `TeamProductionIn`)
- Modify: `backend/src/sleepmon/adapters/inbound/http/controllers.py:281-290` (copiar al DTO)
- Test: `backend/tests/http/test_api.py`

**Interfaces:**
- Consumes: `daily_production(..., good_camp_ticket=...)` de Task 1.
- Produces: `TeamProductionInput.good_camp_ticket: bool = False`; `TeamProductionIn.good_camp_ticket: bool = False`. El request JSON acepta `"good_camp_ticket": true`.

- [ ] **Step 1: Escribir el test HTTP que falla**

En `backend/tests/http/test_api.py`, agregar (usa el helper `_create_member` ya presente en el archivo):

```python
def test_team_production_accepts_good_camp_ticket(client: TestClient) -> None:
    member_id = _create_member(client)
    off = client.post(
        "/teams/production",
        json={"member_ids": [member_id], "meals": []},
    )
    on = client.post(
        "/teams/production",
        json={"member_ids": [member_id], "meals": [], "good_camp_ticket": True},
    )
    assert off.status_code == 200
    assert on.status_code == 200
    off_member = off.json()["members"][0]["production"]
    on_member = on.json()["members"][0]["production"]
    # Con GCT ayuda más rápido → menos segundos por ayuda y más ayudas/día.
    assert on_member["seconds_per_help"] < off_member["seconds_per_help"]
    assert on_member["inventory"] > off_member["inventory"]
```

Nota: si la ruta a `production.seconds_per_help`/`inventory` en el JSON de respuesta difiere, ajustar los accesos leyendo la forma real con `off.json()` (el schema de salida ya expone la producción por miembro que la card consume).

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && pytest tests/http/test_api.py::test_team_production_accepts_good_camp_ticket -v`
Expected: FAIL — con `good_camp_ticket` ausente, `on` e `off` dan resultados idénticos (assert `<`/`>` falla). Si `forbid_unknown_fields` rechaza el campo, el status sería 400/422 (también falla). Ambos confirman el fallo esperado.

- [ ] **Step 3: Agregar el campo al DTO de aplicación**

En `dto.py`, en `TeamProductionInput`:

```python
@dataclass(frozen=True, slots=True)
class TeamProductionInput:
    """Datos crudos para computar la producción de un equipo (no se persiste)."""

    member_ids: list[str]
    meals: list[MealSelectionInput | None]
    favorite_berries: list[str] = field(default_factory=list)
    island_bonus: float = 0.0
    good_camp_ticket: bool = False
```

- [ ] **Step 4: Pasar el flag a `daily_production` en el service**

En `services.py`, en `compute_team_production`, la llamada a `daily_production` (líneas ~326-335) pasa a:

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
                good_camp_ticket=data.good_camp_ticket,
            )
```

- [ ] **Step 5: Agregar el campo al schema HTTP de entrada**

En `schemas.py`, en `TeamProductionIn`:

```python
class TeamProductionIn(msgspec.Struct, forbid_unknown_fields=True):
    member_ids: list[str]
    meals: list[MealIn | None] = msgspec.field(default_factory=list)
    favorite_berries: list[str] = msgspec.field(default_factory=list)
    island_bonus: float = 0.0
    good_camp_ticket: bool = False
```

- [ ] **Step 6: Copiar el campo en el controller**

En `controllers.py`, en `compute`, el armado de `TeamProductionInput` (líneas ~282-290):

```python
            TeamProductionInput(
                member_ids=data.member_ids,
                meals=[
                    None if m is None else MealSelectionInput(recipe=m.recipe, level=m.level)
                    for m in data.meals
                ],
                favorite_berries=data.favorite_berries,
                island_bonus=data.island_bonus,
                good_camp_ticket=data.good_camp_ticket,
            )
```

- [ ] **Step 7: Correr el test para verificar que pasa**

Run: `cd backend && pytest tests/http/test_api.py::test_team_production_accepts_good_camp_ticket -v`
Expected: PASS.

- [ ] **Step 8: Correr la suite sin integración + mypy + ruff**

Run: `cd backend && pytest -m "not integration" && mypy src && ruff check .`
Expected: todo verde.

- [ ] **Step 9: Commit**

```bash
git add backend/src/sleepmon/application/dto.py backend/src/sleepmon/application/services.py backend/src/sleepmon/adapters/inbound/http/schemas.py backend/src/sleepmon/adapters/inbound/http/controllers.py backend/tests/http/test_api.py
git commit -m "feat(app,http): propagar good_camp_ticket del request al dominio"
```

---

### Task 3: Frontend — tipo del input + API client

**Files:**
- Modify: `frontend/src/types.ts:160-168` (`TeamProductionInput`)
- Modify: `frontend/src/api/client.ts:44-53` (payload de `computeTeamProduction`)

**Interfaces:**
- Produces: `TeamProductionInput.good_camp_ticket?: boolean` (opcional, default `false` en el cliente). El client manda `good_camp_ticket: data.good_camp_ticket ?? false`.

- [ ] **Step 1: Agregar el campo al tipo**

En `types.ts`, en `TeamProductionInput`:

```typescript
export interface TeamProductionInput {
  member_ids: string[];
  // 3 slots (mañana/mediodía/noche); null = sin receta en ese slot.
  meals: (MealInput | null)[];
  // Bayas favoritas de la isla seleccionada (≤3); opcional, default [] en el cliente.
  favorite_berries?: string[];
  // Bonus de isla aplicado a la fuerza (0.0–0.85); opcional, default 0 en el cliente.
  island_bonus?: number;
  // Good Camp Ticket activo; opcional, default false en el cliente.
  good_camp_ticket?: boolean;
}
```

- [ ] **Step 2: Mandar el campo en el request**

En `client.ts`, en `computeTeamProduction`:

```typescript
  computeTeamProduction: (data: TeamProductionInput) =>
    request<TeamProduction>("/teams/production", {
      method: "POST",
      body: JSON.stringify({
        member_ids: data.member_ids,
        meals: data.meals,
        favorite_berries: data.favorite_berries ?? [],
        island_bonus: data.island_bonus ?? 0,
        good_camp_ticket: data.good_camp_ticket ?? false,
      }),
    }),
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run build`
Expected: compila sin errores de tipos (aún no se usa el campo; solo se declaró).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/client.ts
git commit -m "feat(front): good_camp_ticket en el tipo del input y el API client"
```

---

### Task 4: Frontend — helper de pote compartido (`pot.ts`)

**Files:**
- Create: `frontend/src/pot.ts`

**Interfaces:**
- Produces:
  - `perMealPot(potSize: number, cookingExtra: number, goodCampTicket: boolean): number` — pote efectivo por comida. Con GCT: `Math.ceil((potSize + cookingExtra/3) * 1.5)`. Sin GCT: `potSize + Math.floor(cookingExtra/3)`.
  - `dailyPotCapacity(potSize: number, cookingExtra: number, goodCampTicket: boolean): number` — capacidad diaria. Con GCT: `perMealPot(...) * 3`. Sin GCT: `potSize * 3 + cookingExtra`.

- [ ] **Step 1: Crear el módulo**

Crear `frontend/src/pot.ts`:

```typescript
// Cálculo del pote de cocina. El pote es puramente frontend (el backend no lo
// calcula). El Good Camp Ticket lo hace 50% más grande, redondeado hacia arriba,
// contando la base y el extra por skill; el redondeo ocurre por comida.

/** Pote efectivo por comida (base + parte del extra por skill del equipo). */
export function perMealPot(
  potSize: number,
  cookingExtra: number,
  goodCampTicket: boolean,
): number {
  if (goodCampTicket) {
    return Math.ceil((potSize + cookingExtra / 3) * 1.5);
  }
  return potSize + Math.floor(cookingExtra / 3);
}

/** Capacidad diaria total del pote (3 comidas). */
export function dailyPotCapacity(
  potSize: number,
  cookingExtra: number,
  goodCampTicket: boolean,
): number {
  if (goodCampTicket) {
    return perMealPot(potSize, cookingExtra, goodCampTicket) * 3;
  }
  return potSize * 3 + cookingExtra;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npm run build`
Expected: compila (módulo aislado, aún sin consumidores).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pot.ts
git commit -m "feat(front): helper de pote compartido (perMealPot, dailyPotCapacity)"
```

---

### Task 5: Frontend — estado GCT en Teams, query, y aviso global

**Files:**
- Modify: `frontend/src/pages/Teams.tsx:130-162` (estado + query key + payload)
- Modify: `frontend/src/pages/Teams.tsx:337-338` (aviso global sobre la grilla)

**Interfaces:**
- Consumes: `api.computeTeamProduction` (Task 3), `t("teams.gctActive")` (Task 8).
- Produces: estado `goodCampTicket: boolean` + setter `setGoodCampTicket`, disponibles en el resto del componente para Tasks 6 y 7.

- [ ] **Step 1: Agregar el estado**

En `Teams.tsx`, junto a los otros `useState` (después de `potSize`, línea ~130):

```typescript
  const [goodCampTicket, setGoodCampTicket] = useState(false);
```

- [ ] **Step 2: Agregar el flag a la query key y al payload**

En `Teams.tsx`, el `teamQuery`:

```typescript
  const teamQuery = useQuery({
    queryKey: ["team-production", selectedIds, meals, activeBerries, islandBonus, goodCampTicket],
    queryFn: () =>
      api.computeTeamProduction({
        member_ids: selectedIds,
        meals,
        favorite_berries: activeBerries,
        island_bonus: islandBonus,
        good_camp_ticket: goodCampTicket,
      }),
    enabled: selectedIds.length > 0,
    placeholderData: keepPreviousData,
  });
```

- [ ] **Step 3: Agregar el aviso global sobre la grilla de cards**

En `Teams.tsx`, justo antes de `<div className="prod-cards prod-cards--compact">` (línea ~338):

```tsx
      {goodCampTicket && (
        <div className="teams-gct-notice" role="status">
          <img src="/pot.webp" alt="" className="mini-icon" style={{ width: 16, height: 16 }} />
          {t("teams.gctActive")}
        </div>
      )}
```

- [ ] **Step 4: Agregar el estilo del aviso**

En `frontend/src/styles.css`, agregar (junto a `.teams-config-toolbar` o al final del bloque de teams):

```css
.teams-gct-notice {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.75rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
}
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npm run build`
Expected: compila. (`t("teams.gctActive")` puede renderizar la clave cruda hasta Task 8; el typecheck no falla porque `t` acepta cualquier string.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Teams.tsx frontend/src/styles.css
git commit -m "feat(front): estado GCT, propagación al request y aviso global"
```

---

### Task 6: Frontend — toggle GCT en la pestaña Island

**Files:**
- Modify: `frontend/src/components/IslandTab.tsx:7-15,137-138` (prop + control)
- Modify: `frontend/src/components/SettingsModal.tsx:23-65,172-182` (prop passthrough)
- Modify: `frontend/src/pages/Teams.tsx:1181-1199` (pasar props al modal)

**Interfaces:**
- Consumes: `goodCampTicket` / `setGoodCampTicket` de Task 5; `t("teams.goodCampTicket")`, `t("teams.gctOff")`, `t("teams.gctOn")` (Task 8); estilos `specialty-toggle` existentes.
- Produces: `IslandTab` recibe `goodCampTicket: boolean` + `onGoodCampTicket: (v: boolean) => void`. `SettingsModal` recibe y reenvía las mismas dos props.

- [ ] **Step 1: Extender los props de `IslandTab`**

En `IslandTab.tsx`, en la interfaz `Props` y el destructuring:

```typescript
interface Props {
  catalog: Catalog;
  selectedIsland: string | null;
  favoriteBerries: string[];
  islandBonus: number; // fracción 0.0–0.85
  goodCampTicket: boolean;
  onSelectIsland: (islandName: string | null) => void;
  onFavoriteBerries: (berries: string[]) => void;
  onIslandBonus: (bonus: number) => void;
  onGoodCampTicket: (value: boolean) => void;
}
```

```typescript
export function IslandTab({
  catalog,
  selectedIsland,
  favoriteBerries,
  islandBonus,
  goodCampTicket,
  onSelectIsland,
  onFavoriteBerries,
  onIslandBonus,
  onGoodCampTicket,
}: Props) {
```

- [ ] **Step 2: Renderizar el toggle (segmentado Off/On) al final del tab**

En `IslandTab.tsx`, dentro del `<div className="island-tab">`, después del bloque "Bonus de zona" (antes del cierre del div, línea ~333):

```tsx
      {/* Good Camp Ticket */}
      <div className="island-tab__row">
        <span className="island-tab__label">{t("teams.goodCampTicket")}</span>
        <div className="specialty-toggle" role="group" aria-label={t("teams.goodCampTicket")}>
          <button
            type="button"
            className={"specialty-toggle__btn" + (!goodCampTicket ? " is-on" : "")}
            aria-pressed={!goodCampTicket}
            onClick={() => onGoodCampTicket(false)}
          >
            {t("teams.gctOff")}
          </button>
          <button
            type="button"
            className={"specialty-toggle__btn" + (goodCampTicket ? " is-on" : "")}
            aria-pressed={goodCampTicket}
            onClick={() => onGoodCampTicket(true)}
          >
            {t("teams.gctOn")}
          </button>
        </div>
      </div>
```

- [ ] **Step 3: Pasar los props por `SettingsModal`**

En `SettingsModal.tsx`, agregar a `Props` (junto a los "Island tab props"):

```typescript
  goodCampTicket: boolean;
  onGoodCampTicket: (value: boolean) => void;
```

Agregarlos al destructuring de la función `SettingsModal({ ... })` (junto a `onIslandBonus`):

```typescript
  goodCampTicket,
  onGoodCampTicket,
```

Y reenviarlos al `<IslandTab .../>`:

```tsx
        <IslandTab
          catalog={catalog}
          selectedIsland={selectedIsland}
          favoriteBerries={favoriteBerries}
          islandBonus={islandBonus}
          goodCampTicket={goodCampTicket}
          onSelectIsland={onSelectIsland}
          onFavoriteBerries={onFavoriteBerries}
          onIslandBonus={onIslandBonus}
          onGoodCampTicket={onGoodCampTicket}
        />
```

- [ ] **Step 4: Pasar los props desde `Teams.tsx` al modal**

En `Teams.tsx`, en el render de `<SettingsModal .../>` (líneas ~1181-1199), agregar:

```tsx
          goodCampTicket={goodCampTicket}
          onGoodCampTicket={setGoodCampTicket}
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npm run build`
Expected: compila.

- [ ] **Step 6: Verificar en preview**

Abrir el frontend del compose (`docker compose up`, `:5173`), abrir el modal de settings (botón "Configurar"), pestaña Island, y confirmar que el toggle Off/On aparece y cambia de estado. Con GCT en On, el aviso global aparece sobre la grilla de cards y los números de las cards (cadencia de ayuda, inventario) cambian.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/IslandTab.tsx frontend/src/components/SettingsModal.tsx frontend/src/pages/Teams.tsx
git commit -m "feat(front): toggle Good Camp Ticket en la pestaña Island"
```

---

### Task 7: Frontend — pote con GCT (pot control, plan-rows, capacity table + fila GCT)

**Files:**
- Modify: `frontend/src/pages/Teams.tsx` (imports; `fillerStrengthTotal` ~237-268; `perMealPot` plan-rows ~667; capacity accounting ~754-762; tabla pot capacity ~886-929)
- Modify: `frontend/src/components/SettingsModal.tsx:83-84` (`effectivePot` vía helper)

**Interfaces:**
- Consumes: `perMealPot`, `dailyPotCapacity` de Task 4; `goodCampTicket` de Task 5; `t("teams.potGct")` (Task 8).
- Produces: la capacidad usada por fillers y la tabla usa el helper; nueva fila "GCT (+50%)" en la tabla cuando GCT está activo.

- [ ] **Step 1: Importar el helper en Teams**

En `Teams.tsx`, agregar junto a los imports de `../`:

```typescript
import { perMealPot, dailyPotCapacity } from "../pot";
```

- [ ] **Step 2: Usar el helper en `fillerStrengthTotal`**

En `Teams.tsx`, dentro del `useMemo` `fillerStrengthTotal`, reemplazar la línea `const totalCapacity = potSize * 3 + cookingExtra;` (línea ~237) por:

```typescript
    const totalCapacity = dailyPotCapacity(potSize, cookingExtra, goodCampTicket);
```

Y agregar `goodCampTicket` al array de dependencias del `useMemo` (línea ~268):

```typescript
  }, [result, catalog.isLoading, catalog.data, potSize, cookingExtra, meals, recipeByName, islandBonus, goodCampTicket]);
```

- [ ] **Step 3: Usar el helper en las plan-rows**

En `Teams.tsx`, reemplazar `const perMealPot = potSize + Math.floor(cookingExtra / 3);` (línea ~667) por:

```typescript
                  const perMealPotValue = perMealPot(potSize, cookingExtra, goodCampTicket);
```

y actualizar sus dos usos en ese bloque (`recipeIngs > perMealPot` y `({recipeIngs}/{perMealPot})`) a `perMealPotValue`.

- [ ] **Step 4: Usar el helper en el accounting de capacidad de la cooking card**

En `Teams.tsx`, dentro del IIFE de la cooking card, reemplazar `const totalCapacity = potSize * 3 + cookingExtra;` (línea ~754) por:

```typescript
                const baseCapacity = potSize * 3 + cookingExtra;
                const totalCapacity = dailyPotCapacity(potSize, cookingExtra, goodCampTicket);
                const gctGain = totalCapacity - baseCapacity;
```

(`usedByRecipes` y `totalFillers` quedan igual: siguen restando sobre `totalCapacity`.)

- [ ] **Step 5: Agregar la fila "GCT (+50%)" en la tabla de pot capacity**

En `Teams.tsx`, en la tabla de pot capacity, insertar la fila GCT entre el bloque "Skill expansion" (que termina en `)}` de la línea ~913) y el bloque "Used by recipes" (línea ~914):

```tsx
                        {/* GCT (+50%) — solo con Good Camp Ticket activo */}
                        {goodCampTicket && gctGain > 0 && (
                          <li className="cook-cap-row">
                            <span className="cook-cap-row__label">
                              <img src="/pot.webp" alt="" className="mini-icon" style={{ width: 14, height: 14 }} />
                              {t("teams.potGct")}
                            </span>
                            <span className="cook-cap-row__value">+{fdown(gctGain)}</span>
                          </li>
                        )}
```

(`fdown` ya se usa en esa tabla para formatear los valores.)

- [ ] **Step 6: Usar el helper en `SettingsModal.effectivePot`**

En `SettingsModal.tsx`, agregar el import:

```typescript
import { perMealPot } from "../pot";
```

Reemplazar la línea `const effectivePot = potSize + Math.floor(cookingExtra / 3);` (línea ~84) por:

```typescript
  const effectivePot = perMealPot(potSize, cookingExtra, goodCampTicket);
```

En el pot control (líneas ~254-261), cuando GCT está activo el desglose `+{floor(cookingExtra/3)}` deja de cerrar aritméticamente, así que mostrar solo el total con GCT:

```tsx
            {goodCampTicket ? (
              <span className="meal-picker-pot__effective muted">= {effectivePot}</span>
            ) : cookingExtra > 0 ? (
              <span className="meal-picker-pot__effective muted">
                +{Math.floor(cookingExtra / 3)} = <strong>{effectivePot}</strong>
              </span>
            ) : (
              <span className="meal-picker-pot__effective muted">= {effectivePot}</span>
            )}
```

- [ ] **Step 7: Typecheck**

Run: `cd frontend && npm run build`
Expected: compila. (`SettingsModal` ya recibe `goodCampTicket` desde Task 6.)

- [ ] **Step 8: Verificar en preview**

Con el compose corriendo: seleccionar un equipo con al menos una comida elegida. Con GCT Off, anotar la capacidad de pote y los fillers. Activar GCT: verificar que (a) el pote efectivo del pot control sube (ceil ×1.5), (b) aparece la fila "GCT (+50%)" con la ganancia, (c) la capacidad total y los fillers reflejan el pote más grande, (d) los avisos "no entra en el pote" usan el pote con GCT. Con GCT Off, la tabla y el pote quedan idénticos al comportamiento previo.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/Teams.tsx frontend/src/components/SettingsModal.tsx
git commit -m "feat(front): pote con GCT (×1.5 ceil por comida) y fila GCT en capacidad"
```

---

### Task 8: Frontend — cadenas i18n (es/en)

**Files:**
- Modify: `frontend/src/i18n/ui.ts` (bloques `es` y `en`, sección teams)

**Interfaces:**
- Consumes: nada.
- Produces: claves `teams.goodCampTicket`, `teams.gctOff`, `teams.gctOn`, `teams.gctActive`, `teams.potGct` en ambos idiomas.

- [ ] **Step 1: Agregar las claves en español**

En `ui.ts`, en el bloque `es`, junto a las claves `teams.*` de la sección de cocina/isla (p. ej. después de `"teams.potSize"`), agregar:

```typescript
    "teams.goodCampTicket": "Good Camp Ticket",
    "teams.gctOff": "Apagado",
    "teams.gctOn": "Activo",
    "teams.gctActive": "Good Camp Ticket activo",
    "teams.potGct": "Good Camp Ticket (+50%)",
```

- [ ] **Step 2: Agregar las claves en inglés**

En `ui.ts`, en el bloque `en`, junto a las claves `teams.*` equivalentes, agregar:

```typescript
    "teams.goodCampTicket": "Good Camp Ticket",
    "teams.gctOff": "Off",
    "teams.gctOn": "On",
    "teams.gctActive": "Good Camp Ticket active",
    "teams.potGct": "Good Camp Ticket (+50%)",
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npm run build`
Expected: compila.

- [ ] **Step 4: Verificar en preview**

Con el compose corriendo: cambiar el idioma y confirmar que el toggle, el aviso global y la fila de capacidad muestran los textos correctos en es/en.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/i18n/ui.ts
git commit -m "feat(i18n): cadenas del Good Camp Ticket (es/en)"
```

---

## Self-Review

**Spec coverage:**
- Ayuda +20% rápida → Task 1 (`camp_speed = 0.8` en `seconds_per_help`). ✓
- Inventario +20% (total, round) → Task 1 (`round((total) * 1.2)`). ✓
- Pote +50% ceil por comida → Task 4 (helper) + Task 7 (uso). ✓
- Flag viaja al backend (DTO→service→schema→controller) → Task 2. ✓
- Toggle en primera pestaña (Island) → Task 6. ✓
- Fila nueva en pot capacity → Task 7 Step 5. ✓
- Aviso global sobre las cards → Task 5 Steps 3-4. ✓
- Sin GCT, comportamiento idéntico → cubierto por el helper (Task 4) y el test `test_no_good_camp_ticket_leaves_values_unchanged` (Task 1). ✓
- i18n es/en → Task 8. ✓

**Placeholder scan:** sin "TBD"/"TODO"/handwaving; todos los steps de código muestran el código. La única nota condicional (Task 2 Step 1) indica cómo ajustar el acceso al JSON si la forma difiere, con el criterio concreto (leer `off.json()`).

**Type consistency:** `perMealPot`/`dailyPotCapacity` con firma `(potSize, cookingExtra, goodCampTicket)` se definen en Task 4 y se consumen con esa firma en Tasks 5-7. La variable renombrada `perMealPotValue` (Task 7 Step 3) evita el choque con la función importada `perMealPot`. `good_camp_ticket` es el nombre del campo en snake_case en todo el backend y el payload; `goodCampTicket` en camelCase en el estado/props del frontend. `round()` de Python devuelve `int` (compatible con `inventory: int`).
