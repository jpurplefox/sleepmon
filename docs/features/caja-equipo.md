# Feature: Caja (pestaña "Equipo")

> Documento de producto. Define para qué existe esta feature y los lineamientos
> que debe respetar al evolucionar. El "cómo se ve" está en
> [`frontend/docs/ui-concept.md`](../../frontend/docs/ui-concept.md).

## Propósito

La **Caja** es el registro **persistente** del equipo de Pokémon Sleep del
usuario: la **fuente de verdad**. Cada Pokémon se guarda con su configuración
completa —especie, nivel, naturaleza, sub skills e ingredientes— y la pantalla
muestra además la **distribución agregada** de toda la caja.

Responde a: *"¿qué Pokémon tengo, cómo están armados, y cómo se reparte mi equipo
en ingredientes / sub skills / naturalezas?"*.

## Qué hace (alcance)

- **Listar** los Pokémon guardados, cada uno con su config completa.
- **Agregar / editar / eliminar** un Pokémon (persistido vía API). El alta y la
  edición usan el [Formulario de Pokémon](./formulario-pokemon.md). El borrado se
  confirma en dos pasos; la edición es en el lugar.
- **Distribución de la caja**: gráficos agregados de ingredientes, sub skills y
  naturalezas.

Fuera de alcance: no estima producción ni compara escenarios hipotéticos —de eso
se ocupa [Comparación](./comparacion.md).

## Lineamientos

- **Es la fuente de verdad.** Lo que está en la Caja persiste; los cambios
  destructivos se confirman antes de aplicarse.
- **Editar en el lugar.** Corregir un dato de un Pokémon no debe obligar a
  borrarlo y volver a crearlo.
- **El catálogo manda.** Especies, naturalezas, sub skills e ingredientes salen
  del catálogo del dominio. El formulario es dependiente: las opciones de cada
  slot dependen de la especie y los desbloqueos dependen del nivel.
- **Respetar las reglas del juego.** La validación de dominio (slots por nivel,
  cantidad de sub skills, ingredientes válidos por especie) vive en el backend
  (arquitectura hexagonal); la UI no las reimplementa ni las contradice.
- **Guiar siempre.** Estados de carga, error y vacío explícitos ("la caja está
  vacía, agregá tu primer Pokémon").

## Relación con Comparación

La Caja **alimenta** a [Comparación](./comparacion.md): desde ahí se puede traer
un Pokémon con el botón **Caja**. La Caja sigue siendo la fuente de verdad:
Comparación sólo la modifica por **acción explícita** del usuario —guardar una
config nueva en la Caja, o editar el Pokémon de origen—, nunca de forma implícita.
