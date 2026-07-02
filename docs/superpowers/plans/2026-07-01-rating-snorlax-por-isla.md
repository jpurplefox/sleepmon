# Rating de Snorlax alcanzable por isla — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: usar superpowers:executing-plans o
> superpowers:subagent-driven-development. Los pasos usan checkbox (`- [ ]`).

**Goal:** Mostrar, cuando hay un mapa seleccionado, hasta qué rating de Snorlax
(ball + número + progreso al siguiente) llega el equipo en esa isla según su
fuerza semanal, con el norte en Master 20.

**Architecture:** Los 35 umbrales por isla viven en el dominio del backend
(`catalog_data.py`), se exponen por el catálogo (`/catalog`), y el frontend hace
el lookup de presentación y pinta un badge en la sección del gran total. No afecta
ningún cálculo de producción.

**Tech Stack:** Backend Python/Litestar/msgspec (hexagonal), frontend React+TS/Vite.

## Global Constraints

- Hexagonal estricto: el dominio no importa infra; la app depende de puertos.
- mypy strict, dataclasses frozen, enums cerrados para datos del juego.
- Cada cambio de comportamiento lleva test. Backend: `pytest -m "not integration"`,
  `mypy src`, `ruff check .`.
- i18n: strings es/en; **no nombrar el tramo con texto traducido** (usar el ícono
  de la ball para el tramo) para no adivinar términos oficiales (memoria `i18n-architecture`).
- Comparación contra fuerza **semanal** = `(total_strength + grandTotalCooking) × 7`.
- Íconos servidos desde `frontend/public/` (como `/good-camp-ticket.png`).

---

### Task 1: Dominio — enum, dataclass y tabla de umbrales

**Files:**
- Modify: `backend/src/sleepmon/domain/value_objects.py` (agregar `RatingTier` + `RatingThreshold`)
- Modify: `backend/src/sleepmon/domain/catalog_data.py` (agregar tabla + `ratings_for`)
- Test: `backend/tests/domain/test_rating_thresholds.py` (crear)

**Interfaces:**
- Produces:
  - `RatingTier(StrEnum)`: `BASIC="basic"`, `GREAT="great"`, `ULTRA="ultra"`, `MASTER="master"`.
  - `@dataclass(frozen=True) RatingThreshold(tier: RatingTier, level: int, required_strength: int)`
  - `ISLAND_RATING_THRESHOLDS: Final[Mapping[Island, tuple[RatingThreshold, ...]]]`
  - `ratings_for(island: Island) -> tuple[RatingThreshold, ...]`

- [ ] **Step 1: Test de invariantes**

```python
# backend/tests/domain/test_rating_thresholds.py
from sleepmon.domain.catalog_data import ISLAND_RATING_THRESHOLDS, ratings_for
from sleepmon.domain.value_objects import Island, RatingTier


def test_every_island_has_35_ratings() -> None:
    assert set(ISLAND_RATING_THRESHOLDS) == set(Island)
    for island in Island:
        assert len(ratings_for(island)) == 35


def test_tier_structure_is_basic_great_ultra_master() -> None:
    expected = (
        [(RatingTier.BASIC, i) for i in range(1, 6)]
        + [(RatingTier.GREAT, i) for i in range(1, 6)]
        + [(RatingTier.ULTRA, i) for i in range(1, 6)]
        + [(RatingTier.MASTER, i) for i in range(1, 21)]
    )
    for island in Island:
        got = [(r.tier, r.level) for r in ratings_for(island)]
        assert got == expected


def test_first_rating_is_zero_and_strengths_strictly_increasing() -> None:
    for island in Island:
        ratings = ratings_for(island)
        assert ratings[0].required_strength == 0
        strengths = [r.required_strength for r in ratings]
        assert all(a < b for a, b in zip(strengths, strengths[1:]))


def test_master_20_known_anchors() -> None:
    def m20(island: Island) -> int:
        return ratings_for(island)[-1].required_strength

    assert m20(Island.GREENGRASS_ISLE) == 3_245_795
    assert m20(Island.GREENGRASS_EXPERT) == 10_981_171
    assert m20(Island.AMBER_CANYON) == 8_528_976
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd backend && pytest tests/domain/test_rating_thresholds.py -q`
Expected: FAIL (ImportError: `RatingTier` / `ratings_for` no existen).

- [ ] **Step 3: Agregar enum + dataclass en `value_objects.py`**

Agregar tras la clase `Island` (después de la línea 246):

```python
class RatingTier(StrEnum):
    """Tramos del rating de Snorlax; cada uno se muestra con su ball."""

    BASIC = "basic"
    GREAT = "great"
    ULTRA = "ultra"
    MASTER = "master"
```

Y en el bloque de imports/dataclasses del módulo (arriba, junto a los demás
`from dataclasses import dataclass` si existe; si no, agregar el import):

```python
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class RatingThreshold:
    """Un rating de investigación y la fuerza (semanal) que exige."""

    tier: RatingTier
    level: int
    required_strength: int
```

> Nota: `value_objects.py` hoy solo importa `from enum import StrEnum`. Agregar
> `from dataclasses import dataclass` arriba. Definir `RatingThreshold` DESPUÉS de
> `RatingTier`.

- [ ] **Step 4: Agregar tabla y `ratings_for` en `catalog_data.py`**

Extender el import de `value_objects` (líneas 17-26) agregando `RatingThreshold` y
`RatingTier`. Luego, tras `ISLAND_USER_PICKS` (línea 248), agregar:

```python
# Estructura fija de los 35 ratings (Basic1-5, Great1-5, Ultra1-5, Master1-20).
_RATING_STRUCTURE: Final[tuple[tuple[RatingTier, int], ...]] = tuple(
    [(RatingTier.BASIC, i) for i in range(1, 6)]
    + [(RatingTier.GREAT, i) for i in range(1, 6)]
    + [(RatingTier.ULTRA, i) for i in range(1, 6)]
    + [(RatingTier.MASTER, i) for i in range(1, 21)]
)

# Fuerza (Snorlax Strength semanal) requerida por rating, por isla. 35 valores por
# isla, ordenados Basic1..Master20. Fuentes: Serebii / game8 / Bulbapedia,
# verificadas contra 2 fuentes (Expert Mode: Bulbapedia wikitext + RaenonX JP).
_ISLAND_RATING_STRENGTHS: Final[Mapping[Island, tuple[int, ...]]] = {
    Island.GREENGRASS_ISLE: (
        0, 3118, 7171, 11693, 17149, 23385, 31492, 41314, 53006, 65634,
        79197, 93540, 109130, 125032, 156121, 187832, 220177, 253169, 286821,
        321146, 356158, 391870, 428296, 465451, 532707, 601308, 742056, 885619,
        1029700, 1199506, 1486800, 1795052, 2165541, 2604280, 3245795,
    ),
    Island.GREENGRASS_EXPERT: (
        0, 41895, 96358, 157104, 228205, 309675, 414995, 539088, 684812, 839478,
        997610, 1178280, 1374658, 1580857, 1797364, 2014314, 2251791, 2501141,
        2760321, 3057187, 3361630, 3667816, 4014149, 4378519, 4778794, 5184989,
        5614239, 6067795, 6541407, 7152862, 7780648, 8414117, 9067058, 9752517,
        10981171,
    ),
    Island.CYAN_BEACH: (
        0, 4822, 11090, 18082, 26520, 36164, 48700, 63889, 81971, 101499,
        122474, 144654, 168763, 195283, 224455, 256544, 291842, 330670, 373381,
        420363, 472043, 528891, 591424, 660210, 735875, 819107, 910662, 1018462,
        1184155, 1379432, 1709820, 2064310, 2490372, 2994922, 3732664,
    ),
    Island.TAUPE_HOLLOW: (
        0, 6885, 15835, 25817, 37865, 51635, 69534, 91221, 117038, 144921,
        174869, 206538, 240961, 278826, 320478, 366295, 416694, 472133, 533116,
        600197, 673986, 755154, 844439, 942653, 1050688, 1169527, 1300250,
        1444045, 1602220, 1776213, 1967605, 2333568, 2815203, 3385564, 4219534,
    ),
    Island.SNOWDROP_TUNDRA: (
        0, 10486, 24118, 39323, 57673, 78645, 105909, 138940, 178262, 220730,
        266344, 314580, 367010, 424683, 488123, 557907, 634669, 719107, 811989,
        914159, 1026546, 1150172, 1286161, 1435749, 1600296, 1781298, 1980400,
        2199412, 2440325, 2705329, 2996833, 3317487, 3670206, 4058197, 4706403,
    ),
    Island.LAPIS_LAKESIDE: (
        0, 14702, 33814, 55131, 80859, 110262, 148486, 194796, 249927, 309469,
        373421, 441048, 514556, 593210, 677370, 767421, 863776, 966876, 1077193,
        1195232, 1321534, 1456677, 1601280, 1756005, 1921561, 2098706, 2288251,
        2491064, 2708074, 2940275, 3188730, 3454577, 3739033, 4166848, 5193272,
    ),
    Island.OLD_GOLD_POWER_PLANT: (
        0, 20142, 46326, 75531, 110779, 151061, 203429, 266875, 342406, 423979,
        511595, 604246, 704953, 810696, 921725, 1038306, 1160717, 1289248,
        1431702, 1582395, 1741777, 1910321, 2088527, 2276921, 2476059, 2686523,
        2908932, 3143935, 3442846, 3744954, 4086475, 4451914, 4909073, 5472793,
        6674166,
    ),
    Island.AMBER_CANYON: (
        0, 26478, 60899, 99293, 145629, 198585, 264456, 344986, 440123, 541880,
        654607, 774923, 900988, 1033561, 1176798, 1325740, 1485571, 1650692,
        1828870, 2015408, 2215366, 2427642, 2655957, 2904897, 3179971, 3470704,
        3774089, 4097770, 4430839, 4815792, 5236414, 5715237, 6304719, 7019168,
        8528976,
    ),
}

ISLAND_RATING_THRESHOLDS: Final[Mapping[Island, tuple[RatingThreshold, ...]]] = {
    island: tuple(
        RatingThreshold(tier=tier, level=level, required_strength=strength)
        for (tier, level), strength in zip(_RATING_STRUCTURE, strengths, strict=True)
    )
    for island, strengths in _ISLAND_RATING_STRENGTHS.items()
}


def ratings_for(island: Island) -> tuple[RatingThreshold, ...]:
    """Los 35 ratings de una isla, ordenados Basic1..Master20."""
    return ISLAND_RATING_THRESHOLDS[island]
```

- [ ] **Step 5: Tests pasan + mypy + ruff**

Run: `cd backend && pytest tests/domain/test_rating_thresholds.py -q && mypy src && ruff check .`
Expected: PASS todo. (`zip(..., strict=True)` garantiza 35 por isla; si algún
tuple no tiene 35, revienta al importar.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/sleepmon/domain/value_objects.py backend/src/sleepmon/domain/catalog_data.py backend/tests/domain/test_rating_thresholds.py
git commit -m "feat(domain): umbrales de rating de Snorlax por isla (35 por isla, 8 islas)"
```

---

### Task 2: HTTP — exponer `ratings` en el catálogo

**Files:**
- Modify: `backend/src/sleepmon/adapters/inbound/http/schemas.py` (`IslandOut` + `RatingOut`)
- Modify: `backend/src/sleepmon/adapters/inbound/http/controllers.py` (poblar `ratings`)
- Test: `backend/tests/http/test_catalog.py` (agregar caso; si no existe el archivo, crearlo)

**Interfaces:**
- Consumes: `ISLAND_RATING_THRESHOLDS` / `ratings_for` (Task 1).
- Produces: `IslandOut.ratings: list[RatingOut]` con `RatingOut(tier: str, level: int, required_strength: int)`.

- [ ] **Step 1: Test HTTP**

```python
# en backend/tests/http/test_catalog.py (crear si no existe)
from litestar.testing import TestClient
from sleepmon.adapters.inbound.http.app import create_app  # ajustar al factory real


def test_catalog_islands_expose_ratings() -> None:
    with TestClient(app=create_app()) as client:
        catalog = client.get("/catalog").json()
    islands = {i["name"]: i for i in catalog["islands"]}
    green = islands["Greengrass Isle"]
    assert len(green["ratings"]) == 35
    first = green["ratings"][0]
    assert first == {"tier": "basic", "level": 1, "required_strength": 0}
    assert green["ratings"][-1] == {
        "tier": "master", "level": 20, "required_strength": 3245795,
    }
```

> Antes de escribir: revisar cómo montan la app los tests HTTP existentes en
> `backend/tests/http/` (factory / fixture) y **replicar ese patrón exacto** en
> lugar de asumir `create_app`.

- [ ] **Step 2: Correr y ver que falla**

Run: `cd backend && pytest tests/http/test_catalog.py -q`
Expected: FAIL (KeyError `ratings`).

- [ ] **Step 3: `RatingOut` + `IslandOut.ratings` en `schemas.py`**

Reemplazar la clase `IslandOut` (líneas 82-85) por:

```python
class RatingOut(msgspec.Struct):
    tier: str
    level: int
    required_strength: int


class IslandOut(msgspec.Struct):
    name: str
    favorite_berries: list[str]
    user_picks: bool
    ratings: list[RatingOut]
```

- [ ] **Step 4: Poblar `ratings` en el controller**

En `controllers.py`, extender el import de `catalog_data` (líneas 44-48) con
`ISLAND_RATING_THRESHOLDS`, importar `RatingOut` en el bloque de schemas, y en la
construcción de `IslandOut` (líneas 244-251) agregar:

```python
                IslandOut(
                    name=island.value,
                    favorite_berries=[b.value for b in ISLAND_FAVORITE_BERRIES[island]],
                    user_picks=island in ISLAND_USER_PICKS,
                    ratings=[
                        RatingOut(
                            tier=r.tier.value,
                            level=r.level,
                            required_strength=r.required_strength,
                        )
                        for r in ISLAND_RATING_THRESHOLDS[island]
                    ],
                )
                for island in Island
```

- [ ] **Step 5: Tests + mypy + ruff**

Run: `cd backend && pytest -m "not integration" -q && mypy src && ruff check .`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/sleepmon/adapters/inbound/http/schemas.py backend/src/sleepmon/adapters/inbound/http/controllers.py backend/tests/http/test_catalog.py
git commit -m "feat(http): exponer ratings de Snorlax por isla en /catalog"
```

---

### Task 3: Frontend — tipos y util de lookup

**Files:**
- Modify: `frontend/src/types.ts` (`Rating` + `Island.ratings`)
- Create: `frontend/src/snorlaxRating.ts` (util puro `resolveRating`)
- Test: `frontend/src/snorlaxRating.test.ts` (si hay vitest; ver Step 0)

**Interfaces:**
- Produces:
  - `type RatingTier = "basic" | "great" | "ultra" | "master"`
  - `interface Rating { tier: RatingTier; level: number; required_strength: number }`
  - `interface ResolvedRating { reached: Rating; next: Rating | null; remaining: number }`
  - `resolveRating(weeklyStrength: number, ratings: Rating[]): ResolvedRating | null`
    (null si `ratings` está vacío).

- [ ] **Step 0: ¿Hay runner de tests en el frontend?**

Run: `cd frontend && cat package.json | grep -E "vitest|\"test\""`
Si hay vitest → escribir el test del Step 1. Si NO hay → omitir Step 1-2 y mantener
`resolveRating` como función pura (se verifica en preview en Task 5).

- [ ] **Step 1: Test de `resolveRating`**

```ts
// frontend/src/snorlaxRating.test.ts
import { describe, expect, it } from "vitest";
import { resolveRating, type Rating } from "./snorlaxRating";

const ratings: Rating[] = [
  { tier: "basic", level: 1, required_strength: 0 },
  { tier: "basic", level: 2, required_strength: 100 },
  { tier: "master", level: 20, required_strength: 1000 },
];

describe("resolveRating", () => {
  it("devuelve Basic 1 con fuerza 0", () => {
    const r = resolveRating(0, ratings)!;
    expect(r.reached).toMatchObject({ tier: "basic", level: 1 });
    expect(r.next).toMatchObject({ level: 2 });
    expect(r.remaining).toBe(100);
  });
  it("toma el rating más alto alcanzado", () => {
    const r = resolveRating(150, ratings)!;
    expect(r.reached).toMatchObject({ tier: "basic", level: 2 });
    expect(r.next).toMatchObject({ tier: "master", level: 20 });
    expect(r.remaining).toBe(850);
  });
  it("en el tope no hay next", () => {
    const r = resolveRating(999999, ratings)!;
    expect(r.reached).toMatchObject({ tier: "master", level: 20 });
    expect(r.next).toBeNull();
    expect(r.remaining).toBe(0);
  });
  it("ratings vacío => null", () => {
    expect(resolveRating(10, [])).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver que falla** (solo si hay vitest)

Run: `cd frontend && npx vitest run src/snorlaxRating.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Tipos en `types.ts`**

Reemplazar `interface Island` (líneas 31-38) agregando `ratings`, y agregar los tipos:

```ts
export type RatingTier = "basic" | "great" | "ultra" | "master";

export interface Rating {
  tier: RatingTier;
  level: number;
  required_strength: number;
}

export interface Island {
  name: string;
  favorite_berries: string[];
  user_picks: boolean;
  // Los 35 ratings de Snorlax de la isla (Basic1..Master20), ascendentes.
  ratings: Rating[];
}
```

- [ ] **Step 4: Implementar `resolveRating`**

```ts
// frontend/src/snorlaxRating.ts
import type { Rating } from "./types";
export type { Rating } from "./types";

export interface ResolvedRating {
  reached: Rating;
  next: Rating | null;
  remaining: number;
}

/**
 * Dado el total semanal y los 35 ratings de una isla (ascendentes), devuelve el
 * rating más alto alcanzado, el siguiente (o null en el tope) y cuánta fuerza
 * falta para el siguiente. `null` si no hay ratings.
 */
export function resolveRating(
  weeklyStrength: number,
  ratings: Rating[],
): ResolvedRating | null {
  if (ratings.length === 0) return null;
  let reachedIdx = 0;
  for (let i = 0; i < ratings.length; i++) {
    if (weeklyStrength >= ratings[i].required_strength) reachedIdx = i;
    else break;
  }
  const reached = ratings[reachedIdx];
  const next = reachedIdx + 1 < ratings.length ? ratings[reachedIdx + 1] : null;
  const remaining = next ? next.required_strength - weeklyStrength : 0;
  return { reached, next, remaining };
}
```

- [ ] **Step 5: Tests pasan** (si hay vitest)

Run: `cd frontend && npx vitest run src/snorlaxRating.test.ts`
Expected: PASS. Además `cd frontend && npx tsc --noEmit` sin errores.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/snorlaxRating.ts frontend/src/snorlaxRating.test.ts
git commit -m "feat(front): tipos Rating + util resolveRating"
```

---

### Task 4: Frontend — assets de balls, componente badge e i18n

**Files:**
- Create: `frontend/public/poke-ball.png`, `great-ball.png`, `ultra-ball.png`, `master-ball.png`
- Create: `frontend/src/components/SnorlaxRatingBadge.tsx`
- Modify: `frontend/src/i18n/ui.ts` (strings es/en)

**Interfaces:**
- Consumes: `resolveRating` (Task 3), `useI18n` del proyecto.
- Produces: `<SnorlaxRatingBadge weeklyStrength={number} ratings={Rating[]} />`

- [ ] **Step 1: Balls a `public/`**

Descargar los 4 sprites de ball de Serebii (mismo criterio que el GCT). Comando de
referencia (ajustar URLs a los sprites reales de Serebii itemdex):

```bash
cd frontend/public
curl -L -o poke-ball.png   "https://www.serebii.net/itemdex/sprites/pokeball.png"
curl -L -o great-ball.png  "https://www.serebii.net/itemdex/sprites/greatball.png"
curl -L -o ultra-ball.png  "https://www.serebii.net/itemdex/sprites/ultraball.png"
curl -L -o master-ball.png "https://www.serebii.net/itemdex/sprites/masterball.png"
file *ball.png   # confirmar que son PNG y no HTML de error
```

- [ ] **Step 2: Strings i18n**

En `frontend/src/i18n/ui.ts`, agregar en el bloque ES y en el bloque EN (mismo
lugar donde viven `teams.*`). **No** se nombra el tramo (lo dice la ball):

```ts
// ES
"teams.rating.aria": "Rating de Snorlax en {island}",
"teams.rating.toNext": "faltan {remaining} para el siguiente rango",
"teams.rating.max": "¡Máximo!",
// EN
"teams.rating.aria": "Snorlax rating on {island}",
"teams.rating.toNext": "{remaining} to next rating",
"teams.rating.max": "Maxed!",
```

- [ ] **Step 3: Componente `SnorlaxRatingBadge`**

```tsx
// frontend/src/components/SnorlaxRatingBadge.tsx
import { useI18n } from "../i18n";
import { resolveRating } from "../snorlaxRating";
import type { Rating, RatingTier } from "../types";

const BALL: Record<RatingTier, string> = {
  basic: "/poke-ball.png",
  great: "/great-ball.png",
  ultra: "/ultra-ball.png",
  master: "/master-ball.png",
};

interface Props {
  weeklyStrength: number;
  ratings: Rating[];
  islandName: string;
}

// Formatea la fuerza restante en forma compacta (12.3k / 1.2M).
function fcompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function SnorlaxRatingBadge({ weeklyStrength, ratings, islandName }: Props) {
  const { t } = useI18n();
  const resolved = resolveRating(weeklyStrength, ratings);
  if (!resolved) return null;
  const { reached, next, remaining } = resolved;
  return (
    <span
      className="snorlax-rating-badge"
      aria-label={t("teams.rating.aria").replace("{island}", islandName)}
    >
      <img className="mini-icon" src={BALL[reached.tier]} alt="" width={18} height={18} />
      <span className="snorlax-rating-badge__level">{reached.level}</span>
      <span className="snorlax-rating-badge__next">
        {next
          ? t("teams.rating.toNext").replace("{remaining}", fcompact(remaining))
          : t("teams.rating.max")}
      </span>
    </span>
  );
}
```

> Verificar la firma real de `useI18n`/`t` y el mecanismo de interpolación en
> `frontend/src/i18n/index.tsx` (el explore mostró interpolación `{var}` por
> split/join); si `t` ya interpola args, pasar `{ remaining, island }` en vez de
> `.replace(...)`.

- [ ] **Step 4: tsc**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add frontend/public/poke-ball.png frontend/public/great-ball.png frontend/public/ultra-ball.png frontend/public/master-ball.png frontend/src/components/SnorlaxRatingBadge.tsx frontend/src/i18n/ui.ts
git commit -m "feat(front): balls + SnorlaxRatingBadge + strings i18n"
```

---

### Task 5: Frontend — montar el badge en el gran total + refinar UI + verificar

**Files:**
- Modify: `frontend/src/pages/Teams.tsx` (montar el badge en la col grand total)
- Modify: `frontend/src/*.css` (estilo del badge, según especialistas de UI)

**Interfaces:**
- Consumes: `SnorlaxRatingBadge` (Task 4), estado `selectedIsland`/`catalog`/`result`.

- [ ] **Step 1: Import y render condicional**

En `Teams.tsx` importar el badge y, dentro de la col grand total (líneas 1164-1178),
después del `<span className="teams-totals__aside">…×7…</span>`, renderizar el badge
solo si hay isla seleccionada:

```tsx
{selectedIsland && (() => {
  const isl = catalog.islands.find((i) => i.name === selectedIsland);
  if (!isl) return null;
  const weekly = (result.total_strength + grandTotalCooking) * 7;
  return (
    <SnorlaxRatingBadge
      weeklyStrength={weekly}
      ratings={isl.ratings}
      islandName={selectedIsland}
    />
  );
})()}
```

> Confirmar que `catalog`, `selectedIsland`, `result` y `grandTotalCooking` están en
> scope en ese punto del render (lo están: son estado/derivados del componente).

- [ ] **Step 2: Verificar en preview (Docker :5173)**

Levantar/usar el frontend del compose (memoria `frontend-preview-verification`):
`docker compose up -d frontend` y abrir preview en `:5173`.
- Sin isla → el badge NO aparece.
- Seleccionar cada isla → aparece ball + número + "faltan …/¡Máximo!".
- Con un equipo fuerte + isla fácil (Greengrass) → sube a Master; con isla dura
  (Amber) → tramo bajo. Sanity: Greengrass semanal ≥ 3.245.795 ⇒ Master 20.
- Confirmar que las 4 balls cargan (no roto).

- [ ] **Step 3: Estilo del badge — especialistas de UI**

Como pidió el usuario ("que los especialistas decidan dónde poner el dato"), correr
en paralelo `frontend-ui-minimalist` y `frontend-ux-reviewer` sobre el badge en la
sección del gran total; que propongan ubicación exacta ("abajo a la derecha") y
estilo coherente con el concepto visual. Aplicar la propuesta (CSS + ajustes de
markup) y re-verificar en preview con un screenshot.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Teams.tsx frontend/src/*.css
git commit -m "feat(front): badge de rating de Snorlax en el gran total (por isla)"
```

---

## Self-review (cobertura del spec)

- Datos por isla en dominio → Task 1. Expuestos en catálogo → Task 2. ✓
- Comparación semanal (×7) → Task 5 Step 1. ✓
- Badge = ball + rating + progreso al siguiente / máximo → Task 4. ✓
- Solo con isla seleccionada → Task 5 Step 1. ✓
- i18n es/en sin adivinar términos (ball en vez de texto de tramo) → Task 4. ✓
- Assets de balls → Task 4 Step 1. ✓
- Verificación preview + refinamiento UI por especialistas → Task 5. ✓
- 8 islas con datos verificados (incl. Expert Mode 10.981.171) → Task 1. ✓
