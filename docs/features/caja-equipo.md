# Feature: Caja (overview del equipo)

> Documento de producto/diseño. Define para qué existe esta herramienta y los
> lineamientos que debe respetar. El "cómo se ve" se rige por
> [`docs/design-system.md`](../design-system.md). Este doc
> describe el **rediseño** de la herramienta (antes "Equipo"): de simple registro
> a **pantallazo general** del equipo.

## Renombrado: "Equipo" → "Caja"

La herramienta que hoy se llama **Equipo / Team** pasa a llamarse **Caja** en todo
lo visible (nav, título, textos). El nombre **"Team / Equipo" queda reservado**
para una herramienta futura, así que no debe seguir usándose para esto.

> Nota de implementación: el endpoint del backend (`/team`) puede mantenerse; el
> renombrado es de cara al usuario (i18n + nav). No re-significar "team" en la UI.

## Propósito

La **Caja** es el registro **persistente** del equipo (la **fuente de verdad**) y,
sobre eso, un **pantallazo general**: cuánto **produce** cada Pokémon y sus
**métricas más importantes**. **No** busca comparar configuraciones —eso es
[Comparación](./comparacion.md)— sino dar **panorama**: entender de un vistazo
**qué aspectos del juego cubre** el equipo y dónde están los huecos.

Responde a: *"¿qué Pokémon tengo, cuánto rinde cada uno, y qué áreas del juego
(bayas / ingredientes / skills) tengo cubiertas?"*.

### Caja vs. Comparación

- **Comparación**: configuraciones **lado a lado**, con base y deltas, para decidir
  *cuál rinde más*. Efímero.
- **Caja**: el equipo **real y completo**, una entrada por Pokémon, **sin base ni
  deltas**. Cada fila se lee sola. Persistente.

## Qué muestra (alcance)

### 1. Overview por Pokémon

Una entrada por Pokémon de la caja, con base en el **lenguaje visual del selector
desde la Caja** ([`BoxPicker`](../../frontend/src/components/BoxPicker.tsx)) pero con
**objetivo distinto**: no elegir, sino **leer producción**. Cada entrada muestra:

- **Identidad y config** (como ya se hace): sprite, nombre, nivel, naturaleza,
  ingredientes, sub skills, listón, nivel de main skill.
- **Métricas de producción estimada** (el dato nuevo y central):
  - **Producción de bayas** (por día).
  - **Producción de ingredientes** (por día; total y/o por ingrediente).
  - **Cantidad de disparos de habilidad** (skill triggers por día).

> El cálculo de producción es **el mismo del dominio** que usa Comparación; la Caja
> **presenta**, no reimplementa la fórmula. Estas métricas llegan **en la misma
> respuesta del endpoint de la caja** (sin llamadas extra por Pokémon; ver
> *Decisiones tomadas*).

### 2. Orden y filtros

Para hacer el panorama navegable cuando la caja crece:

- **Ordenar por**:
  - Nº de Pokédex.
  - Nivel.
  - Producción total de **bayas**.
  - Producción total de su **ingrediente principal** (el que **más genera** de los
    ingredientes disponibles de la especie).
- **Filtrar por**:
  - **Tipo** (elemental). Se agrega al catálogo de especies (ver *Decisiones tomadas*).
  - **Baya**.
  - **Ingrediente**.
  - **Skill** (main skill).
  - **Especialidad** (Bayas / Ingredientes / Skills).

### 3. Acciones por Pokémon

- **Editar** y **Eliminar**: se **conservan**, pero **reubicados y con otro
  tratamiento** (no como hoy). El diseño concreto lo definen los especialistas
  UX/UI. El borrado sigue **confirmándose** antes de aplicarse.
- **Comparar**: un botón que lleva rápido a [Comparación](./comparacion.md) **con
  ese Pokémon como base** (primera card de la comparación).

### 4. Distribución de la caja (rediseño)

La sección de distribución actual (conteos de ingredientes / sub skills /
naturalezas) se **repiensa** hacia métricas que digan algo sobre **cobertura**, no
solo frecuencias:

- **Distribución por especialidad** (cuántos Bayas / Ingredientes / Skills).
- **Cobertura de bayas de los especialistas en bayas**: qué bayas aportan los
  Pokémon con especialidad **Bayas** (y cuáles faltan).
- **Cobertura de ingredientes de los especialistas en ingredientes**: qué
  ingredientes cubren los Pokémon con especialidad **Ingredientes** (y los huecos).

> Objetivo: responder *"¿qué me falta cubrir?"*, no solo *"¿qué tengo más?"*.

## Interacciones (definición UX/UI)

Definido con los especialistas (frontend-ux-reviewer, frontend-ui-minimalist,
ux-simplifier). Spec para implementar; el detalle visual final lo afina el loop.

### Entrada por Pokémon

- **Una card por Pokémon en lista vertical**, en tres zonas horizontales (en
  pantalla angosta colapsa a columna): **identidad** (sprite + nombre + nivel en
  badge dorado + listón) · **config** (ingredientes, naturaleza con íconos, sub
  skills, ícono+nivel de skill — el **mismo lenguaje del** [picker](../../frontend/src/components/BoxPicker.tsx),
  ligeramente atenuada para que retroceda frente a las métricas) · **producción**
  (las 3 métricas).
- **Tres métricas de igual jerarquía** (mismo peso, ninguna es "el KPI"): **bayas**
  /día (ícono de baya + nº), **ingredientes** (ícono del **ingrediente principal**
  + su nº; el desglose por ingrediente **on-demand** en tooltip), **disparos** de
  habilidad/día (`IconSparkle` + nº). El **único dorado** de la entrada sigue
  siendo el badge de nivel; los números van en color neutro.
- Si la producción de una fila falta/falla, placeholder `—` por métrica sin
  romper la fila (la config sigue legible).

### Orden y filtros

- **Barra de controles** sobre la lista (no sticky): un `<select>` de **orden** +
  los **filtros** + acceso a **Agregar Pokémon** (único lugar del botón global).
- **Orden** (un solo control, default **nº de Pokédex** ascendente, estable —no
  reordena al editar): Pokédex, nivel, producción total de bayas, producción del
  ingrediente principal. Toggle de dirección ↑/↓.
- **Filtros con íconos** (AND entre dimensiones, **vacíos por defecto** = ver
  todo): **Tipo/Baya** (misma dimensión, 1:1 → **un solo control**: panel con la
  grilla de **íconos de baya**, rotulados con el nombre del tipo), **ingrediente**
  (panel con **íconos de ingrediente**), **skill** (con su ícono) y
  **especialidad** (toggles). Nada de selects pelados.
- Filtros activos visibles como **chips** con `×` para quitar + "Limpiar". Estado
  vacío al filtrar: mensaje inline con "Limpiar filtros" (distinto del estado
  caja-vacía). El contador muestra "Mostrando N de M" cuando hay filtros.

### Acciones por Pokémon

- **Comparar / Editar / Eliminar** viven en un **menú overflow `···`** por fila
  (un botón de Comparar siempre visible resultó **invasivo** con muchas filas).
  Orden del menú: **Comparar** (abre [Comparación](./comparacion.md) con ese
  Pokémon como base) → **Editar** → **Eliminar** (confirmado).

### Métricas: todos los ingredientes, incluida la skill

La entrada usa el **ancho completo** (como Comparación) y muestra la producción de
**todos los ingredientes desbloqueados** (no solo el principal). Para los Pokémon
cuya main skill produce ingredientes, esa producción es **visible**: combinada por
ingrediente para *Ingredient Draw* (p. ej. Crustle) y como **"+N al azar"** para
*Ingredient Magnet* (p. ej. Plusle), distinguida de la producción base.

### Distribución → Cobertura

Reemplaza los gráficos de frecuencia actuales por una sección de **cobertura**
(responde "¿qué me falta cubrir?"), calculable en el cliente con los datos del
catálogo + la caja:

- **Especialidades**: conteo por especialidad (Bayas / Ingredientes / Skills);
  un 0 se comunica explícito (la ausencia es información).
- **Cobertura de bayas** de los especialistas en **Bayas**: grilla de íconos de
  baya; las cubiertas normales, las no cubiertas **atenuadas** (opacidad +
  escala de grises, el mismo lenguaje de los slots bloqueados).
- **Cobertura de ingredientes** de los especialistas en **Ingredientes**: misma
  grilla con los íconos de ingrediente.

## Lineamientos

- **Overview, no comparación.** Sin base ni deltas; cada entrada se lee por sí
  sola. Comparar es de [Comparación](./comparacion.md).
- **El cálculo vive en el dominio.** La Caja muestra producción estimada usando el
  mismo cálculo que Comparación; no inventa ni reimplementa números.
- **Fuente de verdad persistente.** Lo que está en la Caja persiste; el alta y la
  edición usan el [Formulario de Pokémon](./formulario-pokemon.md); los cambios
  destructivos se confirman.
- **Reusar el lenguaje visual existente.** La entrada de Pokémon parte del lenguaje
  del picker/cards; respeta el concepto "Luz de luna".
- **Respetar las reglas del juego.** La validación de dominio vive en el backend
  (hexagonal); la UI no la reimplementa ni la contradice.
- **Guiar siempre.** Estados de carga, error y vacío explícitos.

## Decisiones tomadas / dependencias

1. **Tipo en el catálogo.** Se **agrega el tipo elemental** a `species.py`. Aunque
   en Pokémon Sleep el tipo es **1:1 con la baya**, se modela explícito porque a
   veces es más fácil saber el tipo que la baya, y habilita el filtro por tipo. Se
   puede poblar/validar con el mapa tipo→baya y las fuentes del catálogo.
2. **Producción en la respuesta de la caja.** El endpoint que lista los Pokémon de
   la caja (`/team`) **devuelve también la producción** que el overview necesita
   (bayas, ingredientes, disparos de habilidad) por Pokémon. Así **no hay llamadas
   extra** al backend y el orden por producción se resuelve en el cliente sin
   pedidos adicionales. El cálculo sigue siendo el del dominio, reutilizado del
   lado del backend (el mismo que alimenta Comparación).
3. **Especialidad.** El catálogo curado actual tiene **Bayas / Ingredientes /
   Skills** (sin "All-Rounder"); los filtros y la distribución se ciñen a eso.

## Fuera de alcance

- **Comparar** configuraciones o escenarios hipotéticos (es [Comparación](./comparacion.md)).
- **Optimizar**: la Caja no sugiere la "mejor" config ni qué Pokémon agregar; solo
  muestra el panorama actual.

## Relación con Comparación

La Caja **alimenta** a [Comparación](./comparacion.md): desde el selector
[Mis Pokémon](./seleccion-desde-caja.md) se trae una config, y desde el overview el
botón **Comparar** abre Comparación con ese Pokémon como base. La Caja sigue siendo
la fuente de verdad: Comparación sólo la modifica por **acción explícita**.
