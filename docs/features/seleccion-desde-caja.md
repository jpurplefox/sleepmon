# Feature: Selección desde la Caja (picker de Comparación)

> Documento de producto. Define cómo debe funcionar el modal **"Mis Pokémon"**
> que abre Comparación para traer una config guardada. Es un refinamiento de
> [Comparación](./comparacion.md) (acción **Caja**). El "cómo se ve" se rige por
> [`frontend/docs/ui-concept.md`](../../frontend/docs/ui-concept.md).

## Propósito

Cuando agregás un Pokémon a la comparación desde la Caja, tenés que poder
**encontrarlo** y **reconocer cuál es** de un vistazo —aunque tengas la Caja llena
o varios ejemplares de la misma especie con configs distintas.

Responde a: *"de mi Caja, ¿cuál de estos quiero comparar?"*.

## El problema que resuelve

Hoy el picker es una lista plana de `sprite + nombre de especie + nivel`. A medida
que la Caja crece aparecen dos fricciones:

- **No se puede buscar.** Con muchos Pokémon hay que recorrer la lista entera a
  ojo para encontrar uno por nombre.
- **Los duplicados son indistinguibles.** Dos ejemplares de la misma especie se
  ven idénticos (mismo sprite y nombre); si difieren en ingredientes, sub skills,
  naturaleza, etc., no hay forma de saber cuál es cuál antes de elegirlo.

## Qué hace (alcance)

- **Buscar por nombre.** Un campo de búsqueda filtra la lista por el nombre de la
  especie en vivo (sin distinguir mayúsculas/acentos), respetando el idioma activo
  (i18n). Si nada coincide, lo dice con un vacío claro.
- **Identificar cada ejemplar por su config.** Cada item del picker muestra lo que
  lo hace único, **derivado solo de la config del Pokémon** (sin apodos ni datos
  nuevos): nivel, naturaleza, ingredientes, sub skills (con su tier), listón y
  nivel de la main skill. Dos ejemplares de la misma especie deben poder
  distinguirse sin abrirlos.
- **Naturaleza con íconos, igual que la comparación.** La naturaleza se expresa
  con los **íconos de stat** (↑ stat que sube / ↓ stat que baja) tal como lo hacen
  las cards de comparación ([`ProductionCard`](../../frontend/src/components/ProductionCard.tsx)
  vía [`statIcon`](../../frontend/src/natures.ts)), **no** con el nombre del stat
  en texto. Una naturaleza neutra (o sin asignar) se comunica con claridad.
- **Listón pegado al nombre.** El listón, si tiene, va junto al nombre del Pokémon
  (no en el extremo opuesto del item).
- **Reusar el lenguaje visual de la app.** Los mismos iconos de ingredientes, sub
  skills (colores de tier) y naturaleza que ya usan la Caja
  ([`MemberCard`](../../frontend/src/components/MemberCard.tsx)) y la comparación
  ([`ProductionCard`](../../frontend/src/components/ProductionCard.tsx)), para que
  un ejemplar se lea igual en todos lados.
- **Elegir = agregar y cerrar.** Seleccionar un item —con click o con **Enter**—
  lo agrega a la comparación (copiando la config, como hoy) y cierra el modal.
- **Marcar lo que ya está.** Un ejemplar que ya está en la comparación (por su id
  de origen) se muestra como tal y no se puede agregar dos veces.

## Requisitos (checklist de implementación)

El loop UX/UI debe dejar el picker cumpliendo todo esto:

1. **Campo de búsqueda** al tope del modal, con foco automático al abrir, que
   filtra por nombre de especie en vivo, insensible a mayúsculas y acentos, y
   sobre el nombre **traducido** (idioma activo).
2. **Estado vacío de búsqueda**: cuando el filtro no deja resultados, un mensaje
   claro (no la lista vacía a secas).
3. **Cada item muestra la config completa derivada**: sprite + nombre (con el
   listón pegado si tiene), nivel, naturaleza con **íconos de stat** (como la
   comparación), ingredientes (iconos), sub skills (iconos con tier) y nivel de
   main skill. Lo suficiente para distinguir duplicados sin abrirlos.
4. **Distinción de duplicados verificable**: dos ejemplares de la misma especie
   con configs distintas se leen como distintos de un vistazo.
5. **Teclado fluido desde la búsqueda**: tras escribir, **Enter** selecciona el
   resultado resaltado (o el único/primero si hay uno solo) y lo agrega; las
   **flechas ↑/↓** mueven el resaltado entre resultados **sin salir del campo de
   búsqueda** (poder seguir tipeando). El resaltado del resultado activo es
   visible.
6. **Conserva el comportamiento actual**: copiar (no acoplar), marcar/deshabilitar
   los que ya están en la comparación, y el aviso cuando la especie no está en el
   catálogo cargado ([Production.tsx](../../frontend/src/pages/Production.tsx)).
7. **Fiel al concepto "Luz de luna"** y accesible: navegable por teclado, foco
   visible, contraste suficiente, labels/aria correctos.

## Lineamientos

- **Identidad solo por config.** Nada de apodos ni campos nuevos: lo que distingue
  a un Pokémon es su configuración, y eso ya existe. (Mantiene el contrato del
  backend intacto.)
- **Reconocer, no recalcular.** El picker ayuda a *elegir*; la *producción* se
  estima recién cuando el Pokémon entra a la comparación. No mostramos números de
  rendimiento acá.
- **Mismo lenguaje en Caja y picker.** Un ejemplar se ve igual donde aparezca; no
  se inventa una segunda forma de representarlo.
- **Denso pero legible.** El picker puede mostrar muchos ejemplares; prioriza la
  lectura en paralelo y el escaneo rápido por sobre el detalle exhaustivo.
- **Sin jerarquía falsa** entre bayas/ingredientes/skill, igual que el resto de la
  app (ver [`ui-concept.md`](../../frontend/docs/ui-concept.md)).

## Fuera de alcance

- Apodos o cualquier dato que no derive de la config (descartado por decisión de
  producto).
- Filtrar/ordenar por algo que no sea el nombre (p. ej. por ingrediente o tier):
  no entra en esta iteración.
- Cambiar las cards ya agregadas a la comparación: esto es **solo** el picker. La
  comparación en sí está en [Comparación](./comparacion.md).
</content>
</invoke>
