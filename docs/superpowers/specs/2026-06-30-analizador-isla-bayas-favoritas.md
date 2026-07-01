# Analizador de equipos: selección de isla, bayas favoritas y bonus de isla

Fecha: 2026-06-30

## Contexto

El analizador de equipos ya tiene un modal (`MealPickerModal`) para elegir las
recetas del día. Esta mejora agrega la noción de **isla** al análisis: la isla
determina las bayas favoritas del equipo (que reciben ×2 de fuerza), y el usuario
ingresa un **bonus de isla** que amplifica toda la fuerza. El modal pasa a tener
dos tabs: **Isla** y **Meals** (la actual).

Toda la configuración es **efímera** (vive en el estado del frontend y viaja en
cada request), igual que los meals hoy. No se persiste en DB.

## Reglas de dominio (Pokémon Sleep)

### Bayas favoritas (×2)

- Cada isla tiene **3 bayas favoritas**.
- Si un Pokémon del equipo produce una baya que es favorita de la isla, la fuerza
  de esa baya se multiplica por **2**.
- Las 3 favoritas dan el mismo ×2; no hay diferencia mecánica entre "principal" y
  "secundarias" (esa distinción es solo la estructura de selección en Green Grass).
- **Green Grass Isle** y su **versión experto** no tienen bayas fijas: el usuario
  elige 1 baya principal + 2 secundarias. Para el cálculo, las 3 son equivalentes.

### Bonus de isla (0%–85%)

- El usuario ingresa el bonus de isla como un valor entre **0% y 85%**.
- El bonus multiplica **toda** la fuerza mostrada: bayas, recetas cocinadas,
  fillers y totales diarios/semanales.
- Fórmula por valor de fuerza: `valor_con_bonus = valor_base × (1 + bonus)`.
- Para una baya favorita: `base × 2 × (1 + bonus)`.
  - Orden confirmado: primero el ×2 de favorita, luego el bonus (ambos
    multiplicativos).

### Tipo de plato

- El tipo de plato (curry / ensalada / postre) se elige en la **tab de Meals**.
  **No** depende de la isla seleccionada.
- **No se pueden mezclar tipos**: los 3 slots de meal deben ser todos del mismo
  tipo. Al fijar/cambiar el tipo, la tab de meals se filtra a ese tipo y se
  **limpian** los meals ya elegidos que no coincidan.
- El tipo de plato es puramente frontend: no viaja al backend (la cocina ya se
  calcula a partir de las recetas concretas elegidas).

## Datos de islas

- Fuente: **nerolis-lab** (ver [[catalog-data-sources]]). **Primer paso de
  implementación**: derivar la tabla `isla → 3 bayas favoritas` desde nerolis-lab,
  mapear nombres a las bayas oficiales (traducción i18n vía Pokéxperto/WikiDex, no
  adivinar — ver [[i18n-architecture]]) y **validar la tabla con el usuario** antes
  de codificar el catálogo.
- Green Grass Isle y su versión experto se marcan como "el usuario elige las
  bayas" (sin favoritas fijas).
- El bonus de isla **no** es dato de isla: es input del usuario.

## Arquitectura

### Backend (dominio → catálogo → aplicación)

**1. `domain/value_objects.py`** — nuevo enum cerrado:

```python
class Island(StrEnum):
    GREENGRASS = "Greengrass Isle"
    GREENGRASS_EXPERT = "Greengrass Isle (Expert)"
    # ... resto de islas, nombres canónicos a validar con nerolis-lab
```

**2. `domain/catalog_data.py`** — data de isla:

```python
ISLAND_FAVORITE_BERRIES: Mapping[Island, tuple[Berry, ...]]
# Islas normales → 3 bayas fijas.
# GREENGRASS y GREENGRASS_EXPERT → () (el usuario elige).

ISLAND_USER_PICKS_BERRIES: frozenset[Island]  # {GREENGRASS, GREENGRASS_EXPERT}
```

**3. Endpoint `/catalog`** (`controllers.py` + `schemas.py`) — exponer las islas
para que el frontend pueble el picker y autocomplete las favoritas:

```json
"islands": [
  { "id": "Cyan Beach", "favorite_berries": ["ORAN", "..."], "user_picks": false },
  { "id": "Greengrass Isle", "favorite_berries": [], "user_picks": true }
]
```

**4. Contrato de producción** (`schemas.py` / `dto.py`) — el frontend manda los
valores **ya resueltos**, no la isla:

```python
class TeamProductionIn:  # extendido
    member_ids: list[str]
    meals: list[MealIn | None]
    favorite_berries: list[str] = []     # ≤ 3 nombres de Berry
    island_bonus: float = 0.0            # 0.0 – 0.85
```

- El backend valida: `len(favorite_berries) ≤ 3`, sin duplicados, cada uno un
  `Berry` válido; `0.0 ≤ island_bonus ≤ 0.85`. Fuera de rango → error de
  validación (422).

**5. Cálculo de fuerza** — el ×2 y el bonus se aplican en el dominio.

- El ×2 de favorita es específico de bayas y depende de qué baya produce cada
  especie → se aplica donde hoy se calcula `berry_strength`
  (`domain/production.py:437`), pasando el set de favoritas hacia abajo.
- El bonus de isla afecta **todo** valor de fuerza → se aplica en la capa de
  agregación/analytics (`domain/analytics.py` `team_production()` y en el armado
  del `TeamProductionResult`), como factor `(1 + bonus)` sobre cada total de
  fuerza (bayas, cocina, fillers, diarios/semanales).
- **Response con desglose**: para poder mostrar el tooltip base/con-bonus, el
  backend devuelve, por cada valor de fuerza relevante, **ambos números**:
  `strength_base` (sin bonus de isla) y `strength` (con bonus). El ×2 de favorita
  ya está incluido en `strength_base` (es intrínseco a la producción de la baya).

### Frontend

**1. `MealPickerModal` → `SettingsModal`** con dos tabs:

- Refactor: extraer el contenido actual del modal a un componente `MealsTab`
  (recetas, búsqueda, nivel, pote, momentos). Nuevo `IslandTab`. Un contenedor
  con selector de tabs (Isla | Meals). La tab de Isla es la primera.

**2. `IslandTab`** — controles:

- Selector de isla (dropdown o grid).
- Al elegir isla normal: autocompleta y muestra las 3 bayas favoritas (solo
  lectura). Al elegir Green Grass / experto: inputs para elegir 1 principal + 2
  secundarias (de las 18 bayas).
- Input de bonus de isla (0–85%). El diseño del control (slider / stepper) lo
  deciden los agentes de frontend.

**2b. `MealsTab`** — el selector de **tipo de plato** (curry / ensalada / postre,
selección única) vive acá. Al fijar/cambiar el tipo, la lista se filtra a ese tipo
y se limpian los meals ya elegidos de otro tipo. No se pueden mezclar tipos entre
los 3 slots.

**3. `Teams.tsx`** — estado nuevo (efímero):

- `favoriteBerries: Berry[]` (≤3), `islandBonus: number` (0–0.85),
  `dishType: RecipeType | null`.
- `favoriteBerries` + `islandBonus` se agregan al payload de
  `computeTeamProduction`; `dishType` es solo frontend.
- `dishType` filtra la tab de meals; al cambiarlo se limpian meals incompatibles.

**4. Resaltado de cards de baya favorita** — las cards de Pokémon que producen una
baya favorita se destacan del resto (el tratamiento visual lo definen los agentes
de frontend: `frontend-ui-minimalist` / `premium-ui-designer`), coherente con el
concepto visual único ya existente en `styles.css`.

**5. Tooltip base/con-bonus** — cada valor de fuerza mostrado (bayas, recetas,
fillers, totales) muestra al hover el desglose: **base** (sin bonus de isla) y
**con bonus de isla**. Usa `strength_base` + `strength` del response.

**6. i18n** (`frontend/src/i18n/ui.ts`) — nuevos strings en es/en: tabs (Isla /
Meals), nombres de islas, "bayas favoritas", "baya principal/secundaria", "bonus
de isla", "tipo de plato", labels del tooltip (base / con bonus). Traducciones de
términos del juego con fuente oficial, no adivinadas.

## Defaults

- Isla **opcional**. Sin isla: `favorite_berries = []`, `island_bonus = 0.0`,
  todos los tipos de plato permitidos. El análisis funciona igual que hoy.
- Tipo de plato: selección única; al fijarlo se limpian meals incompatibles.

## Testing

- **Dominio** (`tests/domain/`):
  - `berry_strength` con baya favorita = 2× el valor sin favorita, a varios
    niveles.
  - Baya no favorita sin cambios.
  - Bonus de isla aplicado a bayas, cocina, fillers y totales: cada uno
    `× (1 + bonus)`.
  - Orden favorita+bonus: `base × 2 × (1 + bonus)`.
  - Bonus 0 → resultados idénticos a hoy (regresión).
  - Catálogo: cada isla normal tiene exactamente 3 favoritas; Green Grass y
    experto tienen 0.
- **Aplicación** (`tests/application/`):
  - `compute_team_production` con favoritas + bonus produce `strength_base` y
    `strength` correctos y coherentes entre sí.
- **HTTP** (`tests/http/`):
  - `/catalog` incluye las islas con sus favoritas y flag `user_picks`.
  - `/teams/production` acepta `favorite_berries` + `island_bonus`; valida
    ≤3 favoritas, sin duplicados, bonus en [0, 0.85]; fuera de rango → 422.

## Fuera de alcance

- Persistencia de la config del análisis en DB.
- Derivar el bonus de isla automáticamente del progreso del jugador (es input
  manual).
- Restringir el tipo de plato según la isla (el tipo es elección libre del
  usuario).
