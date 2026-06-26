# Loop de mejora UX/UI del frontend

Loop de **aplicar-e-iterar** sobre `frontend/src`: dos agentes proponen en
paralelo, el loop consolida y aplica todo, verifica y commitea. **Exactamente 3
rondas**, cada una iterando sobre el resultado de la anterior.

## Piezas

- Agente UX: [`frontend-ux-reviewer`](../.claude/agents/frontend-ux-reviewer.md) —
  reduce fricción, pasos y confusión. Read-only (propone, no edita).
- Agente UI: [`frontend-ui-minimalist`](../.claude/agents/frontend-ui-minimalist.md)
  — minimalismo con identidad; sostiene UN concepto en todo el proyecto. Read-only.
- Concepto vivo: `frontend/docs/ui-concept.md` (lo crea/actualiza el agente de UI
  en la ronda 1; ambos agentes lo respetan en las rondas siguientes).
- Rama de trabajo: `feature/ux-ui-loop` (no se itera sobre `main`).

## Cómo se dispara

Parado en `feature/ux-ui-loop`, con el working tree limpio, corré `/loop` (sin
intervalo, auto-pautado) con este prompt:

```
Loop de mejora UX/UI del frontend, modo aplicar-e-iterar, EXACTAMENTE 3 rondas.

Estás en la rama feature/ux-ui-loop. Determiná la ronda actual contando los commits
cuyo mensaje empieza con "UX/UI loop ronda". Si ya hay 3, TERMINÁ el loop (no
agendes otra iteración) y resumí lo hecho en las 3 rondas.

Para la ronda N (N = commits previos con ese prefijo + 1):

1. Lanzá EN PARALELO (una sola tanda de tool calls) los subagentes:
   - frontend-ux-reviewer sobre frontend/src
   - frontend-ui-minimalist sobre frontend/src
   Cada uno devuelve propuestas priorizadas; no editan.

2. Consolidá las propuestas de ambos. Si el agente de UI propuso o ajustó el
   concepto, escribí/actualizá frontend/docs/ui-concept.md primero. Resolvé
   conflictos a favor de la simplicidad y del concepto; descartá lo que lo
   contradiga.

3. Aplicá TODAS las propuestas consolidadas editando los archivos del frontend.

4. Verificá que el frontend levanta sin errores (preview): build/HMR y consola
   limpios. Si algo rompe, arreglalo antes de seguir.

5. Commiteá con mensaje "UX/UI loop ronda N: <resumen corto>".

6. Si N < 3, agendá la próxima ronda. Si N == 3, terminá y resumí.

No mergees a main ni pushees; solo commiteá en la rama.
```

## Notas de diseño

- **Por qué read-only los agentes**: UX y UI tocan los mismos archivos
  (`styles.css`, componentes). Editando en paralelo se pisarían. Proponen; el loop
  (agente principal) aplica de forma secuencial y coherente.
- **Parada determinista**: 3 rondas fijas, contadas por los commits. Un diseñador
  siempre encuentra "algo más"; el tope evita iterar infinito.
- **El concepto persiste** entre rondas vía `frontend/docs/ui-concept.md`, así la
  identidad no se reinventa en cada vuelta.
