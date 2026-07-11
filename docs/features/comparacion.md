# Feature: Comparación (pestaña "Comparación")

> Documento de producto. Define para qué existe esta feature y los lineamientos
> que debe respetar al evolucionar. El "cómo se ve" está en
> [`docs/design-system.md`](../design-system.md).

## Propósito

**Comparación** permite poner **varios Pokémon lado a lado** y leer las
diferencias en su **producción diaria estimada**. El objetivo es **comparar**: la
estimación de producción es el insumo, no el fin.

> La "producción" es un concepto compartido que otras herramientas también
> usarán; la identidad de **esta** herramienta es la comparación.

Responde a: *"de estas configuraciones, ¿cuál rinde más y por qué?"*.

## Qué hace (alcance)

- **Agregar** Pokémon a comparar, de tres formas:
  - **Nuevo**: una configuración ad-hoc, con el
    [Formulario de Pokémon](./formulario-pokemon.md).
  - **Caja**: trae una config ya guardada (copiándola). Cómo se busca e identifica
    un ejemplar en ese picker está en
    [Selección desde la Caja](./seleccion-desde-caja.md).
  - **Clonar**: duplica una card ya presente. Pensado para comparar **variantes
    de un Pokémon similar** (cambiar nivel, una sub skill o un ingrediente y ver
    el efecto).
- **Estimar y mostrar** por card: cadencia de ayuda, ayudas/día, inventario y
  tiempo de llenado, y tres bloques —**bayas, ingredientes y skill**— con la
  probabilidad de activar la skill **mientras dormís**.
- **Editar / quitar** cada card de la comparación.
- **Persistir por acción explícita**: **guardar** una config en la Caja; y si la
  card vino de la Caja, **editar el Pokémon de origen** (persistiendo el cambio).

## Supuestos del cálculo

- Un día = **15.5 h despierto** (atendés al Pokémon: vaciás su inventario, etc.)
  **+ 8.5 h de sueño** (no lo atendés: el inventario se llena y puede desbordar).
- La **skill mientras dormís** tiene **tope de activaciones**: 1 para Pokémon
  no-skill, 2 para los de especialidad Skill. Se comunica como **probabilidad**
  (para los de skill: P(exactamente 1) y P(2)).

## Lineamientos

- **Comparar es el objetivo.** Todo se ordena alrededor de poner configuraciones
  en paralelo y leer las diferencias de un vistazo.
- **Máximo 5 Pokémon** en la comparación: es el tamaño máximo del equipo en el
  juego. Comparar más no tiene sentido de producto y rompe la lectura en paralelo.
- **Efímero por defecto, persistente por acción explícita.** Las configs son
  locales a la sesión; sólo tocan la Caja si el usuario lo pide (guardar / editar).
- **Copiar sin acoplar.** "Caja" y "Clonar" **copian** la config; editar una copia
  no afecta el origen, salvo que se use explícitamente "editar en la caja".
- **Sin jerarquía falsa.** Bayas, ingredientes y skill se muestran con **igual
  peso**; ninguno es "lo principal" (ver
  [`design-system.md`](../design-system.md)).
- **El cálculo vive en el dominio.** La card sólo **presenta**; puede **derivar**
  valores (p. ej. `P(=1) = P(≥1) − P(≥2)`) pero no reimplementa la fórmula ni
  inventa números.

## Fuera de alcance

No es una calculadora de optimización (no sugiere la "mejor" config), sólo estima
y compara. El registro del equipo es la [Caja](./caja-equipo.md).
