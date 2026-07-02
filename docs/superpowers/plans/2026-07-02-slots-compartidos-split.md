# Slots compartidos (split) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un slot del equipo (página de Equipos) sea compartido por 2 Pokémon con un porcentaje de tiempo cada uno; la producción de cada uno se pondera por su porcentaje al agregar el total.

**Architecture:** El "equipo" es estado de sesión efímero en `Teams.tsx` (nunca se persiste). Se reemplaza la lista `selectedIds: string[]` por un modelo de **slots** (`Slot[]`, cada slot con 1–2 entradas `{memberId, weight}`). El backend recibe los slots, computa la producción diaria normal de cada Pokémon y la **escala linealmente** por su peso *antes* de agregar; devuelve la contribución por miembro ya ponderada, así el front sólo renderiza. **Cero cambios en Postgres.**

**Tech Stack:** Backend Python 3.11 + Litestar + msgspec (sin DB en esta feature); dominio con dataclasses frozen. Frontend React + TypeScript (Vite) + TanStack Query. Tests: `pytest` (dominio/aplicación/HTTP). Front se verifica en el preview Docker (:5173).

## Global Constraints

- **Hexagonal estricto:** el dominio (`domain/`) no importa infraestructura; la aplicación depende de puertos. El escalado por peso vive en `domain/production.py` (función pura) y se orquesta en `application/services.py`.
- **mypy strict + ruff** deben pasar: `cd backend && mypy src && ruff check .`
- **Cada cambio de comportamiento lleva su test** (dominio/aplicación/HTTP sin DB: `pytest -m "not integration"`).
- **Máximo del equipo = 5 _slots_** (no 5 Pokémon): con todos divididos, hasta 10 Pokémon.
- **Peso por entrada ∈ (0, 1]**; los pesos de un slot suman `1.0` (tolerancia `1e-6`).
- **Un mismo `member_id` no puede repetirse** en todo el equipo.
- **i18n:** strings nuevos en `frontend/src/i18n/ui.ts` en `es` y `en`. No se tocan términos de juego (`terms.ts`).
- El endpoint `/teams/production` es efímero y su único consumidor es este front: **no** se mantiene compatibilidad con el payload viejo (`member_ids`).

---

## File Structure

**Backend**
- `backend/src/sleepmon/domain/production.py` — nueva función pura `scale_daily(daily, weight)`.
- `backend/src/sleepmon/application/dto.py` — nuevos `SlotEntryInput`, `SlotInput`; `TeamProductionInput.member_ids` → `slots`.
- `backend/src/sleepmon/application/services.py` — validación por slots + escalado en `compute_team_production`.
- `backend/src/sleepmon/adapters/inbound/http/schemas.py` — `SlotEntryIn`, `SlotIn`; `TeamProductionIn.member_ids` → `slots`.
- `backend/src/sleepmon/adapters/inbound/http/controllers.py` — mapeo `TeamProductionIn` → `TeamProductionInput`.
- Tests: `tests/domain/test_production.py` (o donde vivan los tests de `production.py`), `tests/application/test_team_service.py`, `tests/http/test_api.py`.

**Frontend**
- `frontend/src/types.ts` — tipos `SlotEntry`, `Slot`; `TeamProductionInput` con `slots`.
- `frontend/src/api/client.ts` — body con `slots`.
- `frontend/src/components/ProductionCard.tsx` — prop opcional `slotHeader?: ReactNode` que reemplaza la toolbar readOnly.
- `frontend/src/components/TeamSlotCard.tsx` — **nuevo**: chrome de split (botón/pestañas/slider) + delega en `ProductionCard`.
- `frontend/src/pages/Teams.tsx` — estado `Slot[]`, integración del picker para "nuevo slot" y "dividir slot", armado del payload.
- `frontend/src/i18n/ui.ts` — strings nuevos.
- `frontend/src/styles.css` — clases del split (reusa `.bonus-slider`).

---

## Task 1: Dominio — `scale_daily(daily, weight)`

Función pura que escala una `DailyProduction` por la fracción de tiempo del slot. Escala sólo las magnitudes **extensivas** (cantidades/día y fuerza/día, más `helps_per_day`); deja las **intensivas** (porcentajes, intervalo entre ayudas, probabilidades nocturnas, inventario) intactas, porque describen el ritmo del Pokémon, no su aporte.

**Files:**
- Modify: `backend/src/sleepmon/domain/production.py` (agregar `scale_daily`, junto a `DailyProduction`/`SlotProduction`, ~línea 216)
- Test: `backend/tests/domain/test_production.py`

**Interfaces:**
- Consumes: `DailyProduction`, `SlotProduction` (ya existen en `domain/production.py`).
- Produces: `scale_daily(daily: DailyProduction, weight: float) -> DailyProduction`.

- [ ] **Step 1: Write the failing test**

Añadir a `backend/tests/domain/test_production.py` (si no existe un `_daily(...)` factory en ese archivo, copiar el de `tests/domain/test_team_analytics.py` líneas 11-47):

```python
import dataclasses

from sleepmon.domain.production import SlotProduction, scale_daily
from sleepmon.domain.value_objects import Ingredient


def test_scale_daily_identity_when_weight_is_one() -> None:
    d = _daily(berry_amount=10.0, skill_strength=50.0)
    assert scale_daily(d, 1.0) == d


def test_scale_daily_halves_extensive_fields() -> None:
    d = _daily(
        berry_amount=10.0,
        berry_strength=100.0,
        ingredients=(SlotProduction(Ingredient.HONEY, 8.0),),
        skill_triggers=4.0,
        skill_strength=20.0,
        skill_energy=6.0,
    )
    s = scale_daily(d, 0.5)
    assert s.berry_amount == 5.0
    assert s.berry_strength == 50.0
    assert s.ingredients == (SlotProduction(Ingredient.HONEY, 4.0),)
    assert s.skill_triggers == 2.0
    assert s.skill_strength == 10.0
    assert s.skill_energy == 3.0
    assert s.helps_per_day == d.helps_per_day * 0.5


def test_scale_daily_keeps_intensive_fields() -> None:
    d = _daily()
    s = scale_daily(d, 0.5)
    assert s.berry_percentage == d.berry_percentage
    assert s.seconds_per_help == d.seconds_per_help
    assert s.inventory == d.inventory
    assert s.night_skill_chances == d.night_skill_chances


def test_scale_daily_leaves_none_skill_fields_none() -> None:
    d = _daily(skill_strength=None, skill_energy=None)
    s = scale_daily(d, 0.5)
    assert s.skill_strength is None
    assert s.skill_energy is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pytest tests/domain/test_production.py -k scale_daily -v`
Expected: FAIL con `ImportError: cannot import name 'scale_daily'`.

- [ ] **Step 3: Write minimal implementation**

En `backend/src/sleepmon/domain/production.py`, después de la definición de `DailyProduction` (~línea 216), agregar:

```python
def scale_daily(daily: DailyProduction, weight: float) -> DailyProduction:
    """Escala la producción diaria por ``weight`` (fracción de tiempo del slot).

    Sólo escala magnitudes *extensivas* (cantidades/día, fuerza/día y
    ``helps_per_day``): bayas, ingredientes, disparos y salidas de la main skill.
    Las *intensivas* (porcentajes, ``seconds_per_help``, ``night_skill_chances``,
    ``inventory``, ``inventory_fill_hours``) se dejan igual: describen el ritmo del
    Pokémon, no su aporte al equipo. ``weight == 1.0`` devuelve algo equivalente al
    original (identidad).
    """
    if weight == 1.0:
        return daily

    def _s(value: float | None) -> float | None:
        return None if value is None else value * weight

    return dataclasses.replace(
        daily,
        helps_per_day=daily.helps_per_day * weight,
        berry_amount=daily.berry_amount * weight,
        berry_strength=daily.berry_strength * weight,
        ingredients=tuple(
            SlotProduction(sp.ingredient, sp.amount * weight) for sp in daily.ingredients
        ),
        skill_triggers=daily.skill_triggers * weight,
        skill_ingredients=tuple(
            SlotProduction(sp.ingredient, sp.amount * weight)
            for sp in daily.skill_ingredients
        ),
        skill_energy=_s(daily.skill_energy),
        skill_ingredient_total=_s(daily.skill_ingredient_total),
        skill_cooking_ingredients=_s(daily.skill_cooking_ingredients),
        skill_strength=_s(daily.skill_strength),
        skill_self_energy=_s(daily.skill_self_energy),
        skill_dream_shards=_s(daily.skill_dream_shards),
        skill_tasty_chance=_s(daily.skill_tasty_chance),
        skill_extra_helpful=_s(daily.skill_extra_helpful),
        skill_random_energy=_s(daily.skill_random_energy),
    )
```

Asegurar `import dataclasses` al inicio de `production.py` (si no está ya).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pytest tests/domain/test_production.py -k scale_daily -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify the "split of a poké = one poké" semantic in aggregation**

Añadir a `backend/tests/domain/test_team_analytics.py` (ya importa `team_production` y tiene `_daily`):

```python
from sleepmon.domain.production import scale_daily


def test_two_half_weight_copies_equal_one_full_member() -> None:
    d = _daily(
        berry_amount=10.0,
        berry_strength=100.0,
        ingredients=(SlotProduction(I.HONEY, 8.0),),
        skill_triggers=4.0,
        skill_strength=20.0,
    )
    full = team_production([("a", "X", d)])
    split = team_production(
        [("a", "X", scale_daily(d, 0.5)), ("b", "Y", scale_daily(d, 0.5))]
    )
    assert split.total_strength == pytest.approx(full.total_strength)
    assert split.total_berry_amount == pytest.approx(full.total_berry_amount)
    assert split.total_ingredients == pytest.approx(full.total_ingredients)
    assert split.skill_triggers == pytest.approx(full.skill_triggers)
    assert split.ingredients[I.HONEY] == pytest.approx(full.ingredients[I.HONEY])
```

Run: `cd backend && pytest tests/domain/test_team_analytics.py -k two_half_weight -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd backend && ruff check . && mypy src
git add src/sleepmon/domain/production.py tests/domain/test_production.py tests/domain/test_team_analytics.py
git commit -m "feat(domain): scale_daily pondera la producción diaria por peso de slot"
```

---

## Task 2: Backend — contrato del endpoint por slots + escalado

Se reemplaza el input plano `member_ids` por `slots` en todas las capas backend (DTO de aplicación, schema HTTP, controller) y `compute_team_production` valida los slots, aplana a `(member_id, weight)`, escala cada `DailyProduction` con `scale_daily` y agrega. Todo en un solo task para mantener el árbol compilando y `team_production` **sin cambios de firma**.

**Files:**
- Modify: `backend/src/sleepmon/application/dto.py` (agregar `SlotEntryInput`/`SlotInput`; cambiar `TeamProductionInput`, ~línea 147)
- Modify: `backend/src/sleepmon/application/services.py` (import `scale_daily`; reescribir validación+loop en `compute_team_production`, líneas 285-341)
- Modify: `backend/src/sleepmon/adapters/inbound/http/schemas.py` (agregar `SlotEntryIn`/`SlotIn`; cambiar `TeamProductionIn`, línea 177)
- Modify: `backend/src/sleepmon/adapters/inbound/http/controllers.py` (import + mapeo, líneas 42, 292-299)
- Test: `backend/tests/application/test_team_service.py`, `backend/tests/http/test_api.py`

**Interfaces:**
- Consumes: `scale_daily` (Task 1); `team_production(entries, *, island_bonus)` (sin cambios); `_production_result(daily)` (ya existe).
- Produces:
  - `SlotEntryInput(member_id: str, weight: float = 1.0)`
  - `SlotInput(entries: list[SlotEntryInput])`
  - `TeamProductionInput(slots: list[SlotInput], meals: list[MealSelectionInput | None], favorite_berries: list[str] = [], island_bonus: float = 0.0, good_camp_ticket: bool = False)`
  - HTTP: `SlotEntryIn(member_id: str, weight: float = 1.0)`, `SlotIn(entries: list[SlotEntryIn])`, `TeamProductionIn(slots: list[SlotIn], ...)`

- [ ] **Step 1: Write the failing application tests**

En `backend/tests/application/test_team_service.py`, agregar el import y un helper cerca de los imports:

```python
from sleepmon.application.dto import SlotEntryInput, SlotInput


def _slots(*member_ids: str) -> list[SlotInput]:
    """Un slot simple (peso 1.0) por cada id — para migrar los tests existentes."""
    return [SlotInput(entries=[SlotEntryInput(member_id=mid)]) for mid in member_ids]
```

Agregar los tests nuevos de split y validación:

```python
def test_compute_team_production_split_weights_scale_contribution() -> None:
    svc, mid = _service_with_member()  # usar el mismo patrón de armado que los tests vecinos
    full = svc.compute_team_production(
        TeamProductionInput(slots=_slots(mid), meals=[None, None, None])
    )
    half = svc.compute_team_production(
        TeamProductionInput(
            slots=[SlotInput(entries=[SlotEntryInput(member_id=mid, weight=0.5)])],
            meals=[None, None, None],
        )
    )
    # weight 0.5 ⇒ la mitad de la fuerza total (un solo Pokémon al 50%).
    assert half.total_strength == pytest.approx(full.total_strength * 0.5)
    assert half.members[0].production.berry_amount == pytest.approx(
        full.members[0].production.berry_amount * 0.5
    )


def test_compute_team_production_rejects_more_than_two_per_slot() -> None:
    svc, mid = _service_with_member()
    with pytest.raises(ValidationError):
        svc.compute_team_production(
            TeamProductionInput(
                slots=[
                    SlotInput(
                        entries=[
                            SlotEntryInput(member_id=mid, weight=0.34),
                            SlotEntryInput(member_id=mid, weight=0.33),
                            SlotEntryInput(member_id=mid, weight=0.33),
                        ]
                    )
                ],
                meals=[None, None, None],
            )
        )


def test_compute_team_production_rejects_weights_not_summing_to_one() -> None:
    svc, (a, b) = _service_with_two_members()
    with pytest.raises(ValidationError):
        svc.compute_team_production(
            TeamProductionInput(
                slots=[
                    SlotInput(
                        entries=[
                            SlotEntryInput(member_id=a, weight=0.5),
                            SlotEntryInput(member_id=b, weight=0.4),
                        ]
                    )
                ],
                meals=[None, None, None],
            )
        )


def test_compute_team_production_rejects_zero_weight() -> None:
    svc, mid = _service_with_member()
    with pytest.raises(ValidationError):
        svc.compute_team_production(
            TeamProductionInput(
                slots=[SlotInput(entries=[SlotEntryInput(member_id=mid, weight=0.0)])],
                meals=[None, None, None],
            )
        )
```

> Nota: `_service_with_member()` / `_service_with_two_members()` son helpers de conveniencia. Si el archivo no los tiene, reproducir inline el patrón de armado que ya usan `test_compute_team_production_aggregates_members` (líneas 622-627) y `..._rejects_duplicate_members`.

**Migrar los call sites existentes** en el mismo archivo (regla mecánica):
- `TeamProductionInput(member_ids=[X], meals=...)` → `TeamProductionInput(slots=_slots(X), meals=...)`
- `member_ids=ids` (líneas 694) → `slots=_slots(*ids)`
- `member_ids=[mid, mid]` (línea 702, duplicados) → `slots=_slots(mid, mid)` (sigue disparando "no puede repetir Pokémon")
- `member_ids=member_ids` (771-772, 795-796, 805-806, etc.) → `slots=_slots(*member_ids)`
- Renombrar `test_compute_team_production_rejects_too_many_members` conceptualmente a "too many slots" (el cuerpo con 6 ids ahora son 6 slots; el assert de `ValidationError` no cambia).

- [ ] **Step 2: Run the application tests to verify they fail**

Run: `cd backend && pytest tests/application/test_team_service.py -k team_production -v`
Expected: FAIL (los nuevos por `TypeError: unexpected keyword 'slots'` hasta implementar; los migrados por `member_ids` inexistente una vez cambiado el DTO — se corrige en Step 3).

- [ ] **Step 3: Implement the DTOs**

En `backend/src/sleepmon/application/dto.py`, reemplazar `TeamProductionInput` (líneas 147-154) por:

```python
@dataclass(frozen=True, slots=True)
class SlotEntryInput:
    """Un Pokémon dentro de un slot, con su fracción de tiempo (peso)."""

    member_id: str
    weight: float = 1.0


@dataclass(frozen=True, slots=True)
class SlotInput:
    """Un slot del equipo: 1 Pokémon (peso 1.0) o 2 compartiéndolo (pesos suman 1)."""

    entries: list[SlotEntryInput]


@dataclass(frozen=True, slots=True)
class TeamProductionInput:
    """Datos crudos para computar la producción de un equipo (no se persiste)."""

    slots: list[SlotInput]
    meals: list[MealSelectionInput | None]
    favorite_berries: list[str] = field(default_factory=list)
    island_bonus: float = 0.0
    good_camp_ticket: bool = False
```

- [ ] **Step 4: Implement the service validation + scaling**

En `backend/src/sleepmon/application/services.py`:

Agregar `scale_daily` al import del dominio (junto a `daily_production`, `DailyProduction`):

```python
from sleepmon.domain.production import DailyProduction, daily_production, scale_daily
```

Añadir la constante de tolerancia junto a `_MAX_TEAM` (línea 283):

```python
    _MAX_TEAM = 5
    _WEIGHT_EPS = 1e-6
```

Reemplazar la validación y el loop de carga (líneas 286-341) por:

```python
        # Validación de la selección: 1..5 slots; cada slot 1..2 entradas; pesos de
        # un slot suman 1.0; sin miembros repetidos en todo el equipo.
        if not 1 <= len(data.slots) <= self._MAX_TEAM:
            raise ValidationError(
                f"Un equipo tiene entre 1 y {self._MAX_TEAM} slots; llegaron "
                f"{len(data.slots)}."
            )
        flat: list[tuple[str, float]] = []
        seen: set[str] = set()
        for slot in data.slots:
            if not 1 <= len(slot.entries) <= 2:
                raise ValidationError("Un slot tiene 1 o 2 Pokémon.")
            total_weight = 0.0
            for entry in slot.entries:
                if not 0.0 < entry.weight <= 1.0:
                    raise ValidationError(
                        f"El peso de un Pokémon debe estar en (0, 1]; llegó "
                        f"{entry.weight}."
                    )
                if entry.member_id in seen:
                    raise ValidationError("Un equipo no puede repetir Pokémon.")
                seen.add(entry.member_id)
                total_weight += entry.weight
                flat.append((entry.member_id, entry.weight))
            if abs(total_weight - 1.0) > self._WEIGHT_EPS:
                raise ValidationError("Los pesos de un slot deben sumar 1.")

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

        # Cargar miembros (404 si falta) y computar su producción escalada por peso.
        # Los miembros con especie fuera del catálogo curado se excluyen del agregado.
        entries: list[tuple[str, str, DailyProduction]] = []
        member_productions: dict[str, ProductionResult] = {}
        excluded = 0
        for raw_id, weight in flat:
            try:
                member_uuid = UUID(raw_id)
            except ValueError as exc:
                raise ValidationError(f"Id de miembro inválido: {raw_id!r}.") from exc
            member = self.get_member(member_uuid)  # levanta TeamMemberNotFoundError
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
                favorite_berries=favorite_frozen,
                good_camp_ticket=data.good_camp_ticket,
            )
            scaled = scale_daily(daily, weight)
            member_id_str = str(member.id)
            member_productions[member_id_str] = _production_result(scaled)
            entries.append((member_id_str, member.species, scaled))

        aggregate = team_production(entries, island_bonus=data.island_bonus)
```

El resto de `compute_team_production` (cocina, `TeamProductionResult`) queda **igual**.

- [ ] **Step 5: Run the application tests**

Run: `cd backend && pytest tests/application/test_team_service.py -v`
Expected: PASS (nuevos + migrados).

- [ ] **Step 6: Write the failing HTTP tests**

En `backend/tests/http/test_api.py`, agregar un helper cerca del tope:

```python
def _slots_json(*ids: str) -> list[dict]:
    return [{"entries": [{"member_id": i}]} for i in ids]
```

Migrar los payloads existentes: `{"member_ids": [id], ...}` → `{"slots": _slots_json(id), ...}`; en `test_team_production_endpoint_rejects_too_many` (línea 564-568), `"member_ids": ids` → `"slots": _slots_json(*ids)`.

Agregar un test de split extremo a extremo:

```python
def test_team_production_endpoint_split_slot() -> None:
    a = client.post("/team", json=valid_payload()).json()["id"]
    b = client.post("/team", json=valid_payload()).json()["id"]
    full = client.post(
        "/teams/production",
        json={"slots": _slots_json(a), "meals": [None, None, None]},
    ).json()
    split = client.post(
        "/teams/production",
        json={
            "slots": [
                {"entries": [
                    {"member_id": a, "weight": 0.5},
                    {"member_id": b, "weight": 0.5},
                ]}
            ],
            "meals": [None, None, None],
        },
    ).json()
    # Dos copias al 50% en un slot ≈ un Pokémon completo.
    assert split["total_strength"] == pytest.approx(full["total_strength"])
    assert split["member_count"] == 2


def test_team_production_endpoint_rejects_weights_not_one() -> None:
    a = client.post("/team", json=valid_payload()).json()["id"]
    b = client.post("/team", json=valid_payload()).json()["id"]
    res = client.post(
        "/teams/production",
        json={
            "slots": [
                {"entries": [
                    {"member_id": a, "weight": 0.5},
                    {"member_id": b, "weight": 0.4},
                ]}
            ],
            "meals": [None, None, None],
        },
    )
    assert res.status_code == 400
```

> Ajustar `client`/`valid_payload` al patrón que ya usan los tests del archivo (fixture `client: TestClient`).

- [ ] **Step 7: Implement the HTTP schema + controller**

En `backend/src/sleepmon/adapters/inbound/http/schemas.py`, reemplazar `TeamProductionIn` (líneas 177-183) por:

```python
class SlotEntryIn(msgspec.Struct, forbid_unknown_fields=True):
    member_id: str
    weight: float = 1.0


class SlotIn(msgspec.Struct, forbid_unknown_fields=True):
    entries: list[SlotEntryIn]


class TeamProductionIn(msgspec.Struct, forbid_unknown_fields=True):
    slots: list[SlotIn]
    meals: list[MealIn | None] = msgspec.field(default_factory=list)
    favorite_berries: list[str] = msgspec.field(default_factory=list)
    island_bonus: float = 0.0
    good_camp_ticket: bool = False
```

En `backend/src/sleepmon/adapters/inbound/http/controllers.py`:
- Import (línea ~42): agregar `SlotEntryInput, SlotInput` al import de `application.dto` (o desde donde se importe `TeamProductionInput`).
- Reemplazar el mapeo (líneas 292-299) `member_ids=data.member_ids` por:

```python
            TeamProductionInput(
                slots=[
                    SlotInput(
                        entries=[
                            SlotEntryInput(member_id=e.member_id, weight=e.weight)
                            for e in s.entries
                        ]
                    )
                    for s in data.slots
                ],
                meals=[
                    None if m is None else MealSelectionInput(recipe=m.recipe, level=m.level)
                    for m in data.meals
                ],
                favorite_berries=data.favorite_berries,
                island_bonus=data.island_bonus,
                good_camp_ticket=data.good_camp_ticket,
```

- [ ] **Step 8: Run all backend tests + typecheck**

Run: `cd backend && pytest -m "not integration" -q && mypy src && ruff check .`
Expected: PASS todo.

- [ ] **Step 9: Commit**

```bash
cd backend
git add src/sleepmon/application/dto.py src/sleepmon/application/services.py \
  src/sleepmon/adapters/inbound/http/schemas.py src/sleepmon/adapters/inbound/http/controllers.py \
  tests/application/test_team_service.py tests/http/test_api.py
git commit -m "feat(api): /teams/production acepta slots compartidos con peso"
```

---

## Task 3: Frontend — tipos y payload del cliente

**Files:**
- Modify: `frontend/src/types.ts` (línea 170-172: `TeamProductionInput`)
- Modify: `frontend/src/api/client.ts` (líneas 44-54: body)

**Interfaces:**
- Produces (tipos que consumen Tasks 5-6):
  - `interface SlotEntry { memberId: string; weight: number }`
  - `interface Slot { entries: SlotEntry[] }`
  - `TeamProductionInput` con `slots: { entries: { member_id: string; weight: number }[] }[]`

- [ ] **Step 1: Update the types**

En `frontend/src/types.ts`, reemplazar `TeamProductionInput` (líneas 170-172):

```ts
// Estado efímero del equipo en la página de Equipos. Un slot puede compartirse
// entre 2 Pokémon; los weights de un slot suman 1.
export interface SlotEntry {
  memberId: string;
  weight: number; // (0, 1]
}

export interface Slot {
  entries: SlotEntry[]; // 1 o 2 entradas
}

export interface TeamProductionInput {
  slots: { entries: { member_id: string; weight: number }[] }[];
  meals: (MealSelectionInput | null)[];
  favorite_berries?: string[];
  island_bonus?: number;
  good_camp_ticket?: boolean;
}
```

> Mantener `MealSelectionInput` como está. Si `TeamProductionInput` ya declaraba `meals`/`favorite_berries`/etc., conservar esos campos idénticos salvo el reemplazo de `member_ids` por `slots`.

- [ ] **Step 2: Update the client body**

En `frontend/src/api/client.ts` (líneas 46-53), reemplazar `member_ids: data.member_ids` por `slots: data.slots`:

```ts
      body: JSON.stringify({
        slots: data.slots,
        meals: data.meals,
        favorite_berries: data.favorite_berries ?? [],
        island_bonus: data.island_bonus ?? 0,
        good_camp_ticket: data.good_camp_ticket ?? false,
      }),
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: FALLA en `Teams.tsx` (todavía usa `member_ids`/`selectedIds`) — se corrige en Task 6. Los archivos `types.ts` y `client.ts` en sí deben compilar. (No commitear aún; el árbol front queda rojo hasta Task 6. Si preferís árbol verde por commit, agrupá Tasks 3-7 en un commit al final de Task 7.)

---

## Task 4: `ProductionCard` — prop `slotHeader`

Un único punto de extensión: cuando se pasa `slotHeader`, la card en modo `readOnly` renderiza ese nodo en lugar de su toolbar por defecto (la del botón ×). Sin la prop, comportamiento idéntico al actual (no afecta la página de comparación).

**Files:**
- Modify: `frontend/src/components/ProductionCard.tsx` (props ~línea 77-114; toolbar readOnly líneas 219-232)

**Interfaces:**
- Produces: prop opcional `slotHeader?: React.ReactNode` en `ProductionCard`.

- [ ] **Step 1: Add the prop to the interface**

En la interfaz de props de `ProductionCard` (junto a `readOnly?: boolean;`, ~línea 77), agregar:

```ts
  /** Cabecera de slot (página de Equipos): reemplaza la toolbar readOnly por este
   *  nodo (pestañas de split + slider). Sin efecto fuera de readOnly. */
  slotHeader?: React.ReactNode;
```

Y desestructurarla en la firma del componente (junto a `readOnly = false,`, ~línea 111):

```ts
  slotHeader,
```

- [ ] **Step 2: Render it in the readOnly branch**

Reemplazar el bloque readOnly (líneas 219-232) por:

```tsx
      {readOnly ? (
        slotHeader !== undefined ? (
          <div className="prod-card__toolbar prod-card__toolbar--readonly prod-card__toolbar--slot">
            {slotHeader}
          </div>
        ) : (
          <div className="prod-card__toolbar prod-card__toolbar--readonly">
            <span className="prod-card__toolbar-status" aria-hidden="true" />
            <button
              type="button"
              className="icon-btn prod-card__remove"
              onClick={onRemove}
              title={t("card.remove")}
              aria-label={t("card.remove")}
            >
              <IconClose />
            </button>
          </div>
        )
      ) : (
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos en `ProductionCard.tsx` (los de `Teams.tsx` siguen pendientes hasta Task 6).

---

## Task 5: Nuevo componente `TeamSlotCard`

Dueño de todo el chrome de split. Mantiene sólo el estado de vista `activeTab`; el modelo (`Slot`) vive en `Teams.tsx`. Construye el `slotHeader` (botón Split, o pestañas con ✕ por Pokémon + slider), elige la entrada activa y delega el cuerpo a `ProductionCard` con la producción ya ponderada de esa entrada.

**Files:**
- Create: `frontend/src/components/TeamSlotCard.tsx`

**Interfaces:**
- Consumes: `ProductionCard` (Task 4), `configFromMember` de `Teams.tsx` (exportarla) o replicar el helper; `Slot`/`SlotEntry`/`Member`/`Catalog`/`MemberContribution` de tipos.
- Produces:

```ts
interface TeamSlotCardProps {
  slot: Slot;
  slotIndex: number;
  memberById: Map<string, Member>;
  catalog: Catalog;
  // members[] del resultado del equipo; cada uno con production ya ponderada.
  contributions: TeamProduction["members"] | undefined;
  favBerrySet: Set<string>;
  canSplit: boolean;            // false si el equipo está al máximo de slots o sin pokés libres
  onRequestSplit: (slotIndex: number) => void;    // abre el picker en modo "dividir"
  onRemoveSlot: (slotIndex: number) => void;      // quita el slot entero
  onRemoveEntry: (slotIndex: number, entryIndex: number) => void; // colapsa a single
  onWeightChange: (slotIndex: number, pctA: number) => void;      // pctA en 1..99
}
```

- [ ] **Step 1: Write the component**

Crear `frontend/src/components/TeamSlotCard.tsx`:

```tsx
import { useState } from "react";
import type { Slot, Member, Catalog, TeamProduction } from "../types";
import { ProductionCard } from "./ProductionCard";
import { configFromMember } from "../pages/Teams";
import { useI18n } from "../i18n";
import { IconClose } from "./icons"; // ajustar al módulo real de íconos

interface TeamSlotCardProps {
  slot: Slot;
  slotIndex: number;
  memberById: Map<string, Member>;
  catalog: Catalog;
  contributions: TeamProduction["members"] | undefined;
  favBerrySet: Set<string>;
  canSplit: boolean;
  onRequestSplit: (slotIndex: number) => void;
  onRemoveSlot: (slotIndex: number) => void;
  onRemoveEntry: (slotIndex: number, entryIndex: number) => void;
  onWeightChange: (slotIndex: number, pctA: number) => void;
}

export function TeamSlotCard({
  slot,
  slotIndex,
  memberById,
  catalog,
  contributions,
  favBerrySet,
  canSplit,
  onRequestSplit,
  onRemoveSlot,
  onRemoveEntry,
  onWeightChange,
}: TeamSlotCardProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState(0);
  const split = slot.entries.length === 2;
  const safeTab = Math.min(activeTab, slot.entries.length - 1);
  const active = slot.entries[safeTab];

  const member = memberById.get(active.memberId);
  const config = member ? configFromMember(catalog, member) : null;
  if (!member || !config) return null;

  const contrib = contributions?.find((mc) => mc.member_id === active.memberId);
  const prod = contrib?.production ?? null;

  const speciesEntry = catalog.species.find((s) => s.name === member.species);
  const isFavoriteBerry =
    speciesEntry != null && favBerrySet.has(speciesEntry.berry);

  const nameOf = (id: string) => memberById.get(id)?.species ?? "?";
  const pctA = Math.round(slot.entries[0].weight * 100);

  const header = split ? (
    <div className="team-slot__split">
      <div className="team-slot__tabs" role="tablist">
        {slot.entries.map((e, i) => (
          <div key={e.memberId} className="team-slot__tab-wrap">
            <button
              type="button"
              role="tab"
              aria-selected={i === safeTab}
              className={
                "team-slot__tab" + (i === safeTab ? " team-slot__tab--active" : "")
              }
              onClick={() => setActiveTab(i)}
            >
              {nameOf(e.memberId)}{" "}
              <span className="team-slot__tab-pct">{Math.round(e.weight * 100)}%</span>
            </button>
            <button
              type="button"
              className="icon-btn team-slot__tab-remove"
              onClick={() => onRemoveEntry(slotIndex, i)}
              title={t("teams.splitRemove")}
              aria-label={t("teams.splitRemove")}
            >
              <IconClose />
            </button>
          </div>
        ))}
      </div>
      <div
        className="bonus-slider team-slot__slider"
        style={{ "--ratio": (pctA / 100).toFixed(4) } as React.CSSProperties}
      >
        <div className="bonus-slider__row">
          <span className="team-slot__slider-end">{nameOf(slot.entries[0].memberId)}</span>
          <div className="bonus-slider__track">
            <div className="bonus-slider__fill" />
            <div className="bonus-slider__thumb" />
            <input
              type="range"
              className="bonus-slider__input"
              min={1}
              max={99}
              step={1}
              value={pctA}
              onChange={(e) => onWeightChange(slotIndex, Number(e.target.value))}
              aria-label={t("teams.splitShare")}
              aria-valuetext={`${pctA}%`}
            />
          </div>
          <span className="team-slot__slider-end">{nameOf(slot.entries[1].memberId)}</span>
        </div>
      </div>
    </div>
  ) : (
    <div className="team-slot__single">
      <button
        type="button"
        className="btn btn--ghost team-slot__split-btn"
        onClick={() => onRequestSplit(slotIndex)}
        disabled={!canSplit}
        title={t("teams.split")}
      >
        {t("teams.split")}
      </button>
      <button
        type="button"
        className="icon-btn prod-card__remove"
        onClick={() => onRemoveSlot(slotIndex)}
        title={t("card.remove")}
        aria-label={t("card.remove")}
      >
        <IconClose />
      </button>
    </div>
  );

  return (
    <ProductionCard
      config={config}
      catalog={catalog}
      production={prod}
      productionError={null}
      readOnly
      isFavoriteBerry={isFavoriteBerry}
      slotHeader={header}
      onEdit={() => {}}
      onClone={() => {}}
      onRemove={() => onRemoveSlot(slotIndex)}
      onMakeBase={() => {}}
      onSaveToBox={() => {}}
    />
  );
}
```

> Ajustar los imports reales: el módulo de `IconClose` (ver cómo lo importa `ProductionCard.tsx`), y exportar `configFromMember` desde `Teams.tsx` (Task 6, Step 1). Si `TeamProduction["members"]` no expone el tipo por índice, definir un alias `type MemberContribution = TeamProduction["members"][number]` en `types.ts` y usarlo.

- [ ] **Step 2: Typecheck (parcial)**

Run: `cd frontend && npx tsc --noEmit`
Expected: errores sólo por `configFromMember` no exportada aún (se resuelve en Task 6). Verificar que no haya otros errores en `TeamSlotCard.tsx`.

---

## Task 6: `Teams.tsx` — estado `Slot[]` y cableado

Migra el estado del equipo de `selectedIds: string[]` a `slots: Slot[]`, integra el picker para dos intenciones (nuevo slot / dividir un slot existente), arma el payload y renderiza `TeamSlotCard`.

**Files:**
- Modify: `frontend/src/pages/Teams.tsx` (estado 128; `inTeam` 143; query 155-165; `pickMember`/`removeMember` 280-288; render de cards 350-407; picker 1197-1213; export de `configFromMember` 101)

**Interfaces:**
- Consumes: `TeamSlotCard` (Task 5), `api.computeTeamProduction` con `slots`.
- Produces: `export function configFromMember(...)` (para `TeamSlotCard`).

- [ ] **Step 1: Export `configFromMember`**

En `Teams.tsx` línea 101, anteponer `export`:

```ts
export function configFromMember(catalog: Catalog, m: Member): MemberInput | null {
```

- [ ] **Step 2: Replace team state and derived sets**

Reemplazar el estado (línea 128):

```ts
  // Equipo como lista ordenada de slots (cada uno con 1–2 Pokémon con peso). Efímero.
  const [slots, setSlots] = useState<Slot[]>([]);
  // Intención del picker: agregar un slot nuevo, o dividir un slot existente.
  const [pickerTarget, setPickerTarget] = useState<
    { kind: "new" } | { kind: "split"; slotIndex: number } | null
  >(null);
```

Eliminar `pickerOpen` (línea 130): el picker se abre cuando `pickerTarget !== null`.

Reemplazar `inTeam` (línea 143) por el set de todos los ids usados (para excluir en el picker):

```ts
  const usedIds = useMemo(
    () => new Set(slots.flatMap((s) => s.entries.map((e) => e.memberId))),
    [slots],
  );
```

- [ ] **Step 3: Build the payload from slots**

Reemplazar la query (líneas 155-165):

```ts
  const teamQuery = useQuery({
    queryKey: ["team-production", slots, meals, activeBerries, islandBonus, goodCampTicket],
    queryFn: () =>
      api.computeTeamProduction({
        slots: slots.map((s) => ({
          entries: s.entries.map((e) => ({ member_id: e.memberId, weight: e.weight })),
        })),
        meals,
        favorite_berries: activeBerries,
        island_bonus: islandBonus,
        good_camp_ticket: goodCampTicket,
      }),
    enabled: slots.length > 0,
    placeholderData: keepPreviousData,
  });
```

- [ ] **Step 4: Rewrite mutators**

Reemplazar `pickMember`/`removeMember` (líneas 280-288) por:

```ts
  const atMax = slots.length >= MAX_TEAM;

  const pickMember = (m: Member) => {
    if (usedIds.has(m.id)) return;
    if (pickerTarget?.kind === "split") {
      const i = pickerTarget.slotIndex;
      setSlots((prev) =>
        prev.map((s, idx) =>
          idx === i && s.entries.length === 1
            ? {
                entries: [
                  { memberId: s.entries[0].memberId, weight: 0.5 },
                  { memberId: m.id, weight: 0.5 },
                ],
              }
            : s,
        ),
      );
    } else {
      if (atMax) return;
      setSlots((prev) => [...prev, { entries: [{ memberId: m.id, weight: 1 }] }]);
    }
    setPickerTarget(null);
  };

  const removeSlot = (slotIndex: number) =>
    setSlots((prev) => prev.filter((_, i) => i !== slotIndex));

  // Quita un Pokémon de un slot dividido; el que queda pasa a peso 1 (single).
  const removeEntry = (slotIndex: number, entryIndex: number) =>
    setSlots((prev) =>
      prev.map((s, i) => {
        if (i !== slotIndex) return s;
        const kept = s.entries.filter((_, j) => j !== entryIndex);
        return { entries: kept.map((e) => ({ ...e, weight: 1 })) };
      }),
    );

  // pctA en 1..99 → weights [a, 1-a] del slot dividido.
  const setSplitShare = (slotIndex: number, pctA: number) =>
    setSlots((prev) =>
      prev.map((s, i) => {
        if (i !== slotIndex || s.entries.length !== 2) return s;
        const a = pctA / 100;
        return {
          entries: [
            { ...s.entries[0], weight: a },
            { ...s.entries[1], weight: 1 - a },
          ],
        };
      }),
    );

  // Se puede dividir si hay al menos un Pokémon de la caja libre (no usado ya).
  const canSplit = (members.data ?? []).some((m) => !usedIds.has(m.id));
```

- [ ] **Step 5: Render `TeamSlotCard` per slot**

Reemplazar el bloque de cards (líneas 348-407). El `.map` sobre `selectedIds` pasa a `slots`:

```tsx
      <div className="prod-cards prod-cards--compact">
        {slots.map((slot, i) => (
          <TeamSlotCard
            key={slot.entries.map((e) => e.memberId).join("+")}
            slot={slot}
            slotIndex={i}
            memberById={memberById}
            catalog={catalog.data}
            contributions={result?.members}
            favBerrySet={favBerrySet}
            canSplit={canSplit}
            onRequestSplit={(idx) => setPickerTarget({ kind: "split", slotIndex: idx })}
            onRemoveSlot={removeSlot}
            onRemoveEntry={removeEntry}
            onWeightChange={setSplitShare}
          />
        ))}

        {!atMax && (
          <div className="prod-card-cell">
            <div className="prod-card__toolbar prod-card__toolbar--empty" aria-hidden="true" />
            <article className="prod-card prod-card--add">
              <p className="muted prod-add__hint">
                {slots.length === 0 ? t("teams.empty") : t("teams.addHintMore")}
              </p>
              <div className="prod-add__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setPickerTarget({ kind: "new" })}
                >
                  {t("teams.addPokemon")}
                </button>
              </div>
            </article>
          </div>
        )}
      </div>
```

> `favBerrySet` y `memberById` ya existen en `Teams.tsx` (líneas ~188, y el set de bayas favoritas). Reusar los existentes; no duplicar.

Actualizar las guardas de loading/error (líneas 410, 413) y cualquier otra referencia: `selectedIds.length > 0` → `slots.length > 0`.

- [ ] **Step 6: Wire the picker modal**

Reemplazar el modal del picker (líneas 1197-1213):

```tsx
      {pickerTarget !== null && (
        <Modal
          title={
            pickerTarget.kind === "split"
              ? t("teams.pickSplitPartner")
              : t("teams.pickFromBox")
          }
          onClose={() => setPickerTarget(null)}
        >
          <BoxPicker
            members={members.data}
            isLoading={members.isLoading}
            isError={members.isError}
            onRetry={() => members.refetch()}
            catalog={catalog.data}
            inComparison={usedIds}
            onPick={pickMember}
          />
        </Modal>
      )}
```

Agregar el import de `TeamSlotCard` arriba y quitar el import de `ProductionCard` si ya no se usa directamente en `Teams.tsx` (verificar; si sigue usándose, dejarlo). Importar `Slot` desde `../types`.

- [ ] **Step 7: Typecheck the whole frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS sin errores.

---

## Task 7: i18n + CSS

**Files:**
- Modify: `frontend/src/i18n/ui.ts` (agregar claves en `es` y `en`)
- Modify: `frontend/src/styles.css` (clases del split)

**Interfaces:**
- Consumes: claves usadas en Tasks 5-6 (`teams.split`, `teams.splitRemove`, `teams.splitShare`, `teams.pickSplitPartner`).

- [ ] **Step 1: Add i18n strings**

En `frontend/src/i18n/ui.ts`, agregar en el bloque `es` y en el `en` (respetando el formato `"clave": "texto"`):

```ts
// es
"teams.split": "Dividir",
"teams.splitRemove": "Quitar del slot",
"teams.splitShare": "Reparto del slot",
"teams.pickSplitPartner": "Elegí el segundo Pokémon del slot",
```

```ts
// en
"teams.split": "Split",
"teams.splitRemove": "Remove from slot",
"teams.splitShare": "Slot share",
"teams.pickSplitPartner": "Pick the slot's second Pokémon",
```

- [ ] **Step 2: Add CSS**

En `frontend/src/styles.css` (cerca de `.prod-card__toolbar--readonly`, línea ~2973, y usando `.bonus-slider` línea ~4029 como base), agregar:

```css
.prod-card__toolbar--slot { display: block; height: auto; padding: 0.35rem 0.5rem; }
.team-slot__single { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.team-slot__split { display: flex; flex-direction: column; gap: 0.4rem; }
.team-slot__tabs { display: flex; gap: 0.35rem; }
.team-slot__tab-wrap { display: flex; align-items: center; gap: 0.15rem; }
.team-slot__tab {
  padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid var(--moon-border);
  background: transparent; color: var(--muted); cursor: pointer; font-size: 0.8rem;
}
.team-slot__tab--active { background: var(--moon-border); color: var(--fg); font-weight: 600; }
.team-slot__tab-pct { opacity: 0.7; }
.team-slot__tab-remove { padding: 0; width: 1.1rem; height: 1.1rem; }
.team-slot__slider { min-width: 0; max-width: none; }
.team-slot__slider-end { font-size: 0.72rem; color: var(--muted); white-space: nowrap; }
```

> Usar las CSS custom properties reales del tema (mirar valores existentes: `--moon-border`, `--muted`, `--fg`). Si algún nombre difiere, ajustarlo al que use `styles.css`.

- [ ] **Step 3: Commit the frontend**

```bash
cd frontend && npx tsc --noEmit
git add src/types.ts src/api/client.ts src/components/ProductionCard.tsx \
  src/components/TeamSlotCard.tsx src/pages/Teams.tsx src/i18n/ui.ts src/styles.css
git commit -m "feat(front): slots compartidos (split) con pestañas y reparto por %"
```

---

## Task 8: Verificación en el preview

**Files:** ninguno (verificación manual con las tools de preview sobre el frontend Docker en :5173).

- [ ] **Step 1: Levantar/asegurar el stack**

Run: `docker compose up --build` (db + backend :8000 + frontend :5173). Confirmar que el backend arranca sin error de import.

- [ ] **Step 2: Verificar el flujo con las preview tools**

Sobre :5173 (según [[frontend-preview-verification]]):
1. Ir a la página de Equipos; agregar 2 Pokémon (2 slots).
2. En un slot, tocar **Dividir** → el picker se abre excluyendo los ya usados; elegir un tercero. El slot muestra 2 pestañas 50/50.
3. Cambiar de pestaña por el nombre → la card muestra la producción (ponderada) del otro Pokémon.
4. Mover el slider → los % de las pestañas y el gran total se actualizan; verificar en `preview_console_logs` que no hay errores y en `preview_network` que el POST `/teams/production` manda `slots` y responde 200.
5. Quitar un Pokémon de la pestaña (✕) → el slot colapsa a single con ese Pokémon al 100%.
6. Comprobar que un slot al 50% aporta ~la mitad al `grand_total_strength` respecto de tenerlo solo.

- [ ] **Step 3: Screenshot de evidencia**

`preview_screenshot` de un slot dividido con el slider en un valor no-50 (ej. 70/30) para dejar constancia del resultado.

---

## Notas de alcance (del spec)

- **Efímero:** el split no se persiste; se pierde al refrescar (igual que hoy el resto de la config del equipo). Fuera de alcance persistirlo.
- **Excluido:** modelar día/noche por Pokémon dentro del slot; dividir en más de 2; aplicar splits a la distribución de la caja (`/team/distributions`).
- **Borde aceptado:** si en un slot dividido un Pokémon queda fuera del catálogo curado, se excluye y el otro aporta igual su peso (slot parcialmente lleno). Raro; no se maneja especial.
