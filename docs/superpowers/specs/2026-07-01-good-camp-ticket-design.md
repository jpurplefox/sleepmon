# Good Camp Ticket (GCT) en el análisis de equipo

Fecha: 2026-07-01

## Objetivo

Soportar el **Good Camp Ticket** en el análisis de equipo. El GCT es un
booleano global (activo / inactivo) que modela el bonus de campamento de
Pokémon Sleep con tres efectos:

1. **Pote 50% más grande** (contando la base y el extra por skill), redondeado
   hacia arriba.
2. **Los Pokémon ayudan 20% más rápido** (intervalo de ayuda × 0.8).
3. **Los Pokémon tienen 20% más de inventario** (carry size × 1.2).

La activación se hace desde un toggle en la **primera pestaña (Island)** del
modal de settings.

## Alcance

- Backend: `daily_production` aplica los efectos de velocidad e inventario; el
  flag viaja por DTO → service → dominio. El pote NO se calcula en backend.
- Frontend: toggle en Island tab, propagación al request, recálculo del pote
  (por comida, ceil), fila nueva en "Pot capacity" y aviso global sobre la
  grilla de cards.

Fuera de alcance: persistencia del setting, badges por card, cambios en el
catálogo de especies.

## Semántica de los tres efectos (decisiones tomadas)

### Ayuda 20% más rápida (backend)

Factor `0.8` sobre el intervalo, aplicado dentro del `math.floor` existente en
`daily_production`:

```
seconds_per_help = floor(
    species.help_frequency_seconds * level_factor * speed_factor * camp_speed
    / MAX_ENERGY_BONUS
)
```

con `camp_speed = 0.8` si GCT está activo, `1.0` si no.

Efecto en cascada (automático, sin código extra): menor `seconds_per_help` →
más `helps_per_day` → más bayas, ingredientes y **disparos de skill**. Las
cards reflejan esto sin lógica adicional.

### Inventario +20% (backend)

Sobre el inventario **total** (base de especie + evoluciones + Inventory Up +
listón), redondeando al entero más cercano:

```
inventory = round(
    (species.carry_limit + inventory_bonus + ribbon_inventory_bonus(ribbon))
    * camp_inventory
)
```

con `camp_inventory = 1.2` si GCT, `1.0` si no. (Sin GCT el `round(x * 1.0)`
es el mismo entero que hoy.)

### Pote +50% (frontend, por comida, ceil)

El pote es un cálculo puramente frontend. Con GCT, el **pote efectivo por
comida** pasa a:

```
perMealPot = ceil((potSize + cookingExtra / 3) * 1.5)
```

donde `cookingExtra` es `skill_cooking_ingredients` (agregado diario del equipo,
proveniente del backend). El redondeo hacia arriba ocurre a nivel de cada plato.

Sin GCT se mantiene el modelo actual: `potSize + floor(cookingExtra / 3)`.

La **capacidad diaria** con GCT es `perMealPot * 3`.

## Backend — cambios

### Constantes (`domain/catalog_data.py`)

```python
GOOD_CAMP_TICKET_SPEED_FACTOR: Final = 0.8
GOOD_CAMP_TICKET_INVENTORY_FACTOR: Final = 1.2
```

### Dominio (`domain/production.py`)

`daily_production(...)` recibe un nuevo parámetro keyword `good_camp_ticket:
bool = False`. Aplica:

- `camp_speed = GOOD_CAMP_TICKET_SPEED_FACTOR if good_camp_ticket else 1.0`,
  multiplicado dentro del `floor` de `seconds_per_help`.
- `camp_inventory = GOOD_CAMP_TICKET_INVENTORY_FACTOR if good_camp_ticket else
  1.0`, aplicado con `round(...)` sobre el inventario total.

### Aplicación (`application/dto.py`, `application/services.py`)

- `TeamProductionInput`: nuevo campo `good_camp_ticket: bool` (default `False`).
- `compute_team_production`: pasa `good_camp_ticket=data.good_camp_ticket` a
  cada llamada de `daily_production`.

### HTTP (`adapters/inbound/http/controllers.py`)

- Schema de entrada de `POST /teams/production`: campo `good_camp_ticket: bool`
  con default `False`.
- El controller lo copia a `TeamProductionInput`.

`island_bonus` sirve de patrón de referencia para todo el flujo del flag.

### Tests

- `tests/domain/`: `daily_production` con GCT — verificar que
  `seconds_per_help` baja (× 0.8 antes del floor), que `inventory` es
  `round(total * 1.2)`, y que `helps_per_day`/skill triggers suben respecto al
  caso sin GCT. Verificar que sin GCT los valores son idénticos a hoy.
- `tests/application/` o `tests/http/`: el flag `good_camp_ticket` fluye del
  request al dominio (default `False` cuando se omite).

## Frontend — cambios

### Estado y propagación (`pages/Teams.tsx`)

- Nuevo estado `const [goodCampTicket, setGoodCampTicket] = useState(false)`.
- Agregar `goodCampTicket` al `queryKey` de `teamQuery`.
- Agregar `good_camp_ticket: goodCampTicket` al payload de
  `api.computeTeamProduction`.

### API client

- Agregar `good_camp_ticket: boolean` al tipo de input de
  `computeTeamProduction`.

### Toggle (`components/SettingsModal.tsx` → `IslandTab`)

- `SettingsModal` recibe y pasa `goodCampTicket` + `onGoodCampTicket` a
  `IslandTab`.
- `IslandTab` renderiza un toggle (control on/off) con label i18n en la primera
  pestaña.

### Pote (`components/SettingsModal.tsx`, `pages/Teams.tsx`)

Definir el pote efectivo por comida en un solo lugar reutilizable:

```
perMealPot = goodCampTicket
  ? Math.ceil((potSize + cookingExtra / 3) * 1.5)
  : potSize + Math.floor(cookingExtra / 3)
```

Usado en:
- El `effectivePot` mostrado en el pot control del meal picker.
- El `perMealPot` de las plan-rows (aviso "no entra en el pote").

### Tabla "Pot capacity" (`pages/Teams.tsx`)

- Sin GCT no cambia nada: la capacidad diaria sigue siendo el modelo actual
  `potSize * 3 + cookingExtra`.
- Con GCT la capacidad diaria pasa a `perMealPot * 3` (coherente con las
  plan-rows y el pot control bajo el modelo "por comida ceil").
- Nueva fila **"GCT (+50%)"** entre la fila de skill expansion y "used by
  recipes", visible solo con GCT on, mostrando `+ganancia`:

  ```
  ganancia = perMealPot * 3 - (potSize * 3 + cookingExtra)
  ```

  De modo que `potSize*3 + cookingExtra + ganancia = perMealPot*3` (las filas
  suman a la capacidad total).
- `usedByRecipes` y `totalFillers` se calculan contra la capacidad con GCT.

### Aviso global (`pages/Teams.tsx`)

- Indicador único sobre la grilla de cards mientras `goodCampTicket` esté on
  (ej. "Good Camp Ticket activo").

### i18n (`frontend/src/i18n`)

Nuevas claves (es/en): label del toggle GCT, etiqueta de la fila "GCT (+50%)",
texto del aviso global.

## Riesgos / notas

- El modelo "por comida ceil" se usa **solo con GCT on**; sin GCT el accounting
  de capacidad queda idéntico a hoy (`potSize*3 + cookingExtra`). Revisar que
  las plan-rows y la tabla queden coherentes en ambos casos.
- El inventario con `round` puede empatar en `.5`; usar el redondeo estándar de
  Python (`round`, banker's rounding) es aceptable — documentar en el test el
  caso elegido.
