# Feature: Caja (overview del equipo)

> Documento de producto/diseño. Define para qué existe esta herramienta y los
> lineamientos que debe respetar. El "cómo se ve" se rige por
> [`frontend/docs/ui-concept.md`](../../frontend/docs/ui-concept.md). Este doc
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

> El cálculo de producción es **el mismo del dominio** que usa Comparación
> (`POST /production`); la Caja **presenta**, no reimplementa la fórmula.

### 2. Orden y filtros

Para hacer el panorama navegable cuando la caja crece:

- **Ordenar por**:
  - Nº de Pokédex.
  - Nivel.
  - Producción total de **bayas**.
  - Producción total de su **ingrediente principal** (el que **más genera** de los
    ingredientes disponibles de la especie).
- **Filtrar por**:
  - **Tipo** (ver *Decisiones abiertas*: hoy no está en el catálogo).
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

## Decisiones abiertas / dependencias

1. **"Tipo" (elemental) no existe en el catálogo.** `species.py` tiene `specialty`,
   `berry`, `sleep_type`, `main_skill`, `ingredients` — pero no el tipo elemental.
   En Pokémon Sleep la **baya es 1:1 con el tipo**. Opciones: (a) agregar el tipo a
   `species.py` y filtrar por él; (b) usar la **baya como proxy** del tipo y no
   sumar el campo. **A definir** antes de implementar el filtro por tipo.
2. **Producción de toda la caja.** Hoy solo Comparación computa producción
   (`POST /production` por config). El overview la necesita para **todos** los
   miembros (para mostrarla y para ordenar por producción). Evaluar: calcular por
   miembro (N llamadas) vs. un **endpoint batch** de producción de la caja.
   Decisión de arquitectura (fuera de este doc de producto, pero condiciona el
   orden por producción).
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
