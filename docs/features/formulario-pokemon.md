# Formulario de Pokémon (crear / editar)

> Documento de producto. El "cómo se ve" está en
> [`frontend/docs/ui-concept.md`](../../frontend/docs/ui-concept.md).

## Propósito

Un único formulario para **armar o corregir la configuración de un Pokémon**,
respetando las reglas del juego (qué se desbloquea a qué nivel). Es el **mismo
componente** en sus dos usos —la [Caja](./caja-equipo.md) (crear/editar un
miembro) y [Comparación](./comparacion.md) (crear/editar una config)—; sólo cambia
el destino (la Caja persiste; la Comparación es efímera).

## Campos

- **Especie** (obligatoria): buscador con sprites. Al cambiar de especie, los
  ingredientes se reinician a la primera opción válida de cada slot.
- **Naturaleza** (opcional): por defecto **Sin naturaleza**. Muestra el efecto de
  cada una (el stat que sube y el que baja).
- **Nivel**: con **accesos rápidos a los niveles relevantes** — los niveles donde
  se desbloquea algo: ingredientes (1 / 30 / 60) y sub skills (10 / 25 / 50 / 70 /
  80).
- **Ingredientes**: la **distribución** de ingredientes por slot. Cada slot se
  desbloquea a un nivel (1 / 30 / 60); en cada uno se elige una de las opciones
  que ofrece la especie.
- **Sub skills**: hasta 5, que se desbloquean a 10 / 25 / 50 / 70 / 80.

## Reglas

- **Un slot bloqueado por nivel se puede editar igual.** Si un ingrediente todavía
  no está desbloqueado para el nivel actual, igual se puede **definir**: el dato ya
  queda asignado al Pokémon y simplemente **se activará cuando alcance ese nivel**.
  Por eso el slot se muestra atenuado pero **interactivo** (no deshabilitado). La
  misma lógica aplica a las sub skills.
- **El catálogo manda.** Las opciones de cada slot, las naturalezas y las sub
  skills salen del catálogo del dominio; el formulario es **dependiente**: la
  especie define los slots de ingrediente y el nivel define los desbloqueos.
- **La validación vive en el dominio.** El formulario refleja las reglas (espejo de
  los niveles de desbloqueo) para guiar, pero la verdad la impone el backend.

## Variantes según el contexto

- **Caja**: registra tu Pokémon real; al guardar, persiste.
- **Comparación**: la config es efímera; una nota al pie aclara que no se guarda en
  la Caja (o que los cambios son sólo para la comparación, al editar).
