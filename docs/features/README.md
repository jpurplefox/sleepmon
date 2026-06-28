# Features de sleepmon

Un documento por funcionalidad de la app: su **propósito** y los **lineamientos**
que debe respetar al evolucionar (no el detalle de implementación, que vive en el
código). El norte **visual** transversal está en
[`frontend/docs/ui-concept.md`](../../frontend/docs/ui-concept.md).

- [Caja](./caja-equipo.md) — registro persistente del equipo (la fuente de verdad)
  y **pantallazo general**: cuánto produce cada Pokémon y qué aspectos del juego
  cubre el equipo. Antes "Equipo"; ese nombre queda libre para otra herramienta.
- [Comparación](./comparacion.md) — pone varios Pokémon lado a lado y compara su
  producción diaria estimada. Análisis efímero (con guardado a la Caja opcional).
- [Selección desde la Caja](./seleccion-desde-caja.md) — el picker "Mis Pokémon"
  de Comparación: buscar por nombre y distinguir duplicados por su config.
- [Formulario de Pokémon](./formulario-pokemon.md) — el modal compartido para
  crear/editar un Pokémon (especie, naturaleza, nivel, ingredientes, sub skills);
  lo usan la Caja y Comparación.
