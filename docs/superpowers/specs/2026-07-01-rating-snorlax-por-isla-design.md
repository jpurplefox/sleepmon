# Rating de Snorlax alcanzable por isla — diseño

Fecha: 2026-07-01

## Objetivo

Cuando hay un **mapa seleccionado**, mostrar en la sección del **Grand Total
Strength** hasta qué **rating de investigación** (rating de Snorlax) se puede
llegar con la fuerza del equipo en esa isla. El norte del jugador es **Master 20**.
Se muestra la **ball del tramo** correspondiente + el **número de rating**
alcanzado, más el **progreso al siguiente rating**.

## Contexto del juego (verificado)

- Cada isla tiene **35 ratings** agrupados en 4 tramos, cada tramo con su ball:
  - **Basic 1–5** → Poké Ball
  - **Great 1–5** → Great Ball
  - **Ultra 1–5** → Ultra Ball
  - **Master 1–20** → Master Ball
- Cada rating exige un umbral de **Snorlax Strength** distinto **por isla**
  (ej. Greengrass Master 1 = 187.832; Master 20 = 3.245.795).
- El rating de Snorlax se mide sobre la **fuerza semanal acumulada** (lunes–domingo),
  no la diaria. `Basic 1 = 0` en todas las islas (siempre hay al menos Basic 1).
- Fuentes: game8 (tabla de ratings por área), Serebii/RaenonX para cruzar. Ver
  memoria `catalog-data-sources`; **verificar los 8 sets contra una segunda
  fuente antes de hardcodear** (hábito del proyecto).

## Decisiones

1. **Contra qué se compara:** el **total semanal** = `(total_strength +
   grandTotalCooking) × 7` — el valor `×7` que ya se muestra junto al gran total.
2. **Badge:** ball del tramo + rating alcanzado, **más progreso al siguiente**
   (fuerza restante para el próximo rating). En Master 20 se muestra estado "máximo".
3. **Dónde viven los datos:** en el **backend/domain** (convención del proyecto:
   los datos del juego viven en `domain`, testeables y con una sola fuente de
   verdad). Se exponen por el catálogo. El frontend solo hace el lookup de
   presentación. (Alternativa descartada: hardcodear la tabla en el frontend.)

## Arquitectura

### Backend — dominio (`backend/src/sleepmon/domain/`)

- `value_objects.py`: nuevo `RatingTier(StrEnum)` con `BASIC="basic"`,
  `GREAT="great"`, `ULTRA="ultra"`, `MASTER="master"`.
- Un dataclass frozen `RatingThreshold(tier: RatingTier, level: int,
  required_strength: int)` (en `value_objects.py`, junto a `Island`).
- `catalog_data.py`: nuevo
  `ISLAND_RATING_THRESHOLDS: Final[Mapping[Island, tuple[RatingThreshold, ...]]]`
  con los 35 ratings por isla (las 8), ordenados ascendente por
  `required_strength`. Función de acceso `ratings_for(island) -> tuple[...]`.
- **Invariantes / tests de dominio:**
  - Cada isla tiene exactamente 35 entradas (Basic×5 + Great×5 + Ultra×5 + Master×20).
  - `required_strength` estrictamente creciente dentro de cada isla.
  - El primer rating de cada isla es `Basic 1` con `required_strength == 0`.
  - Los tramos aparecen en orden Basic→Great→Ultra→Master con `level` 1..N por tramo.

### Backend — HTTP (`adapters/inbound/http/`)

- `schemas.py`: `RatingOut(msgspec.Struct)` con `tier: str`, `level: int`,
  `required_strength: int`. `IslandOut` gana `ratings: list[RatingOut]`.
- `controllers.py`: al construir cada `IslandOut`, poblar `ratings` desde
  `ISLAND_RATING_THRESHOLDS`.
- Test HTTP: el catálogo expone `ratings` (35 por isla, `basic` primero con 0).

### Frontend (`frontend/src/`)

- `types.ts`: `Rating { tier: "basic"|"great"|"ultra"|"master"; level: number;
  required_strength: number }`; `Island` gana `ratings: Rating[]`.
- Util puro `resolveRating(weeklyStrength, ratings)`:
  - `reached`: el rating de mayor `required_strength ≤ weeklyStrength`.
  - `next`: el primer rating con `required_strength > weeklyStrength` (o `null` si
    ya está en Master 20).
  - `remaining`: `next ? next.required_strength - weeklyStrength : 0`.
- Componente `SnorlaxRatingBadge`:
  - Ícono de ball según `reached.tier` (`/poke-ball.png`, `/great-ball.png`,
    `/ultra-ball.png`, `/master-ball.png` en `public/`, de Serebii como el GCT).
  - Muestra `tier`+`level` alcanzado y, si hay `next`, el progreso (fuerza restante
    para el siguiente rating). Si no hay `next`, estado "máximo".
- **Ubicación / estilo del badge:** "abajo a la derecha" de la sección del gran
  total (`.teams-totals__col--grand`, aprox. `Teams.tsx:1163–1178`), solo cuando
  `selectedIsland != null`. El **detalle visual fino lo definen los especialistas
  de UI** (frontend-ui-minimalist / premium-ui-designer). El badge recibe el
  `weeklyStrength = (total_strength + grandTotalCooking) × 7` ya calculado.

### i18n (`src/i18n/ui.ts`)

- Strings es/en para: nombres de tramo (usar traducción oficial de Pokémon Sleep
  es — **verificar en Pokéxperto/WikiDex, no adivinar**; ver memoria
  `i18n-architecture`), etiqueta de progreso ("faltan {remaining} para {tier}
  {level}") y estado máximo ("¡Máximo!").

## Assets

- 4 PNG de balls en `frontend/public/`: `poke-ball.png`, `great-ball.png`,
  `ultra-ball.png`, `master-ball.png` (de Serebii, mismo criterio que el GCT).

## Fuera de alcance (YAGNI)

- No afecta ningún cálculo de producción del backend (es una capa de display).
- No se persiste nada nuevo (el rating se deriva en vivo del total, como meals/isla).
- Sin barra de progreso animada ni histórico; solo el badge con el dato.

## Verificación

- Backend: `pytest -m "not integration"` (dominio + HTTP), `mypy src`, `ruff check .`.
- Frontend: preview Docker en `:5173` (memoria `frontend-preview-verification`);
  probar cada isla con distintos totales y confirmar ball + número + progreso, y
  que sin isla seleccionada el badge no aparece.
