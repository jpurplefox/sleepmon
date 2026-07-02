# Slots compartidos (split) en la página de Equipos

**Fecha:** 2026-07-02
**Estado:** Diseño aprobado, pendiente de plan de implementación

## Problema

Los equipos de Pokémon Sleep son de 5, pero rara vez el mismo equipo se mantiene
toda la semana: es común que un día esté un poké y otro día otro en el mismo
puesto. Hoy la página de Equipos (`Teams.tsx`) sólo permite un poké por slot, así
que no se puede modelar ese escenario sin elegir arbitrariamente uno de los dos.

Queremos poder **dividir un slot entre 2 pokés** con un **porcentaje de tiempo**
para cada uno (por defecto 50/50), y que la producción de cada uno se **pondere
por ese porcentaje** al agregar el total del equipo.

## Simplificación deliberada (YAGNI)

Modelamos el reparto como una fracción del **día completo**: la contribución de un
poké al slot es su producción diaria normal **escalada linealmente** por su peso.
No modelamos la dinámica día/noche de "qué poké estaba en qué momento" ni el
llenado de inventario por turno. El caso real que cubrimos es "un día está uno,
otro día está otro", que se aproxima bien con un promedio ponderado del día.

## Decisiones tomadas

1. **Persistencia: efímero.** El split vive sólo en el estado de sesión de la
   página de Equipos, igual que hoy la selección de miembros, la isla, el bonus y
   las recetas. **No se toca Postgres** (ni schema, ni migración, ni repositorio).
2. **Números en la card: ya ponderados.** La pestaña del poké al 60% muestra su
   producción del día × 0.60 — su aporte real al equipo. El backend devuelve la
   contribución por miembro ya escalada, así que el front sólo renderiza.

## Contexto del código actual

- **Equipo = selección efímera.** En `pages/Teams.tsx`, la composición del equipo
  (`selectedIds: string[]`, hasta 5), la isla, el bonus y las recetas son estado
  de sesión (`useState`), no persistido. Los pokés sí se persisten (la "caja"),
  pero *qué 5 armás como equipo* se recalcula contra el backend.
- **Cada slot del equipo hoy** se renderiza como un `ProductionCard` (en
  `components/ProductionCard.tsx`) identificado por el id del miembro
  (`Teams.tsx:350` — `selectedIds.map((id) => <ProductionCard ... />)`). Un slot
  "+" al final abre un picker de miembros (`Teams.tsx:386`).
- **Producción individual** se calcula 100% en el backend:
  `domain/production.py::daily_production()` produce un `DailyProduction`
  (bayas, ingredientes por slot, efectos de skill, energía, etc.), incluyendo día
  (15.5h) y noche (8.5h).
- **Agregado del equipo:** `domain/analytics.py::team_production()` recibe entries
  `(member_id, species_name, DailyProduction)`, suma bayas/ingredientes/skill,
  aplica el bonus de isla a la fuerza y calcula la factibilidad de recetas
  (cocina). Devuelve `TeamProduction` con `members: tuple[MemberContribution, ...]`.
- **Endpoint:** `POST /teams/production` (`TeamProductionController.compute`),
  input `TeamProductionInput` con `member_ids: list[str]`. Validación de tamaño de
  equipo en `application/services.py` (`_MAX_TEAM = 5`).

## Arquitectura de la solución

### Modelo de datos (frontend, efímero)

Reemplazamos `selectedIds: string[]` por un modelo de **slots**:

```ts
type SlotEntry = { memberId: string; weight: number }; // weight ∈ (0,1)
type Slot = { entries: SlotEntry[] };                   // 1 o 2 entries; pesos suman 1
// estado del equipo: Slot[] (hasta 5 slots)
```

- **Slot normal:** 1 entry con `weight = 1.0`. Comportamiento y números idénticos a
  hoy (regresión cero).
- **Slot dividido:** 2 entries; por defecto `0.5 / 0.5`.
- **El máximo pasa a ser 5 _slots_**, no 5 pokés: con todos divididos, hasta 10
  pokés en el equipo.

### Backend

Cambios acotados; `daily_production()` **no se toca**.

1. **`application/dto.py` — `TeamProductionInput`:** `member_ids: list[str]` →
   `slots: list[SlotInput]`, donde cada `SlotInput` lleva sus entries
   `{member_id, weight}`. Es el único consumidor del endpoint; no se necesita
   compatibilidad hacia atrás.
2. **`adapters/inbound/http/schemas.py`:** el schema de entrada del endpoint refleja
   los `slots`.
3. **`domain/analytics.py::team_production()`:** la firma pasa a recibir el `weight`
   por entry. Antes de sumar, **escala linealmente** cada `DailyProduction` por su
   peso (bayas, cantidad y fuerza; ingredientes por slot; fuerza/energía/triggers de
   skill; dream shards; etc.). El resto de la agregación (bonus de isla, cocina) no
   cambia.
4. **`MemberContribution`:** su `production` es la **ya ponderada**, para que la card
   muestre el aporte real sin lógica extra en el front.
5. **Validación (`application/services.py`):**
   - Máximo 5 slots.
   - Cada slot: 1–2 entries.
   - Los pesos de un slot suman 1.0 (±epsilon).
   - Un mismo `member_id` no puede repetirse en todo el equipo.
6. **Cocina:** al escalar los ingredientes por peso antes de agregar, las recetas ven
   la mezcla real del slot automáticamente. Sin trabajo extra.
7. **Persistencia:** sin cambios.

### Frontend — UX de la card

Sobre el `ProductionCard` existente, en la página de Equipos:

- **Botón "Split"** en la toolbar de la card. Abre el **mismo picker de miembros**
  que el slot "+", filtrado para excluir pokés ya usados en el equipo.
- Con 2 pokés, el header de la card se vuelve **dos pestañas** con los nombres
  (poke A | poke B). Click en un nombre → la card muestra la producción (ya
  ponderada) de ese poké.
- **Slider de %** con el mismo patrón visual que el de Area Bonus (`IslandTab.tsx`
  — `input[type=range]`, step 1, default 50): al mover A, B queda en `100 − A`.
  Label tipo `A 60% · 40% B`.
- Una **✕** en la pestaña inactiva quita ese poké y colapsa el slot a single.
- El payload a `/teams/production` se arma desde `Slot[]` (query key de TanStack
  Query incluye los slots+pesos para cachear correctamente).

### Casos borde

- Elegir el segundo poké excluye el mismo miembro y los ya usados en otros slots.
- Quitar el poké activo de un slot dividido → queda el otro como single (weight 1.0).
- Slot single (weight 1.0) = mismo comportamiento y mismos números que hoy.
- Rechazos del backend: >5 slots, slot con 3 entries, pesos que no suman 1, miembro
  duplicado → 400 con mensaje claro.

### i18n

Strings nuevos en `i18n/ui.ts` (es/en): `teams.split`, hint del picker de split,
label del porcentaje del slot. No hay términos de juego nuevos (no se toca
`i18n/terms.ts`).

## Testing

- **Dominio (`tests/domain`):** `team_production` con pesos — 50/50, 60/40, y un
  slot single (w=1) que dé **idéntico** a la agregación actual (test de regresión).
- **Aplicación / HTTP (`tests/http`):** validación de slots — >5 slots, pesos que no
  suman 1, miembro duplicado, slot con 3 entries.
- **Frontend:** verificación manual en el preview Docker (:5173) — split, cambio de
  pestaña, mover el slider, colapsar, y que el gran total y la cocina reflejen la
  mezcla.

## Fuera de alcance

- Persistir el split (sobrevivir al refresh).
- Modelar la dinámica día/noche por poké dentro del slot.
- Dividir un slot entre más de 2 pokés.
- Aplicar splits a la distribución agregada de la caja (`/team/distributions`), que
  es un agregado distinto e independiente del equipo.
