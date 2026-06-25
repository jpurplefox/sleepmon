# Loop engineering con Claude Code

Cuatro herramientas para correr trabajo "en bucle", de menos a más autónomas.
Todas operan sobre el sustrato Python de este repo.

## 1. Subagentes (`.claude/agents/`)

Un loop interno: el agente principal delega una tarea acotada a un subagente con
su propio contexto y devuelve solo la conclusión. Útil para fan-out (revisar N
archivos en paralelo) sin contaminar tu contexto.

- Definición de ejemplo: [`sleep-data-reviewer`](../.claude/agents/sleep-data-reviewer.md).
- Probalo: pedile a Claude *"usá el subagente sleep-data-reviewer sobre analyzer.py"*.

## 2. Workflows (`.claude/workflows/`)

Orquestación multi-agente **determinista**: un script JS que decide qué corre en
paralelo, qué se verifica y qué se sintetiza. El control de flujo es código, no
lo decide el modelo.

- Ejemplo: [`audit.js`](../.claude/workflows/audit.js) — revisa en 3 dimensiones
  y verifica adversarialmente cada hallazgo (patrón find → verify).
- Probalo: *"corré el workflow audit"* (requiere opt-in explícito a orquestación
  multi-agente).
- Patrones clave: `pipeline()` (sin barrera, por defecto), `parallel()` (barrera),
  verificación adversarial, loop-until-dry.

## 3. `/loop` — bucle pautado por intervalo o por el modelo

Corre un prompt o slash command de forma recurrente.

```
/loop 5m corré pytest y reportá si algo falla
/loop          # sin intervalo: el modelo se auto-pautea
```

Bueno para: polling de estado, vigilar CI, iterar hasta que una condición se
cumpla. Es un loop del agente principal, no multi-agente.

## 4. `/schedule` — agentes en la nube por cron

Tareas recurrentes que corren solas en un schedule (cron), incluso con la sesión
cerrada. Ej: una auditoría nocturna del repo.

---

## Idea de progresión para experimentar

1. **Subagente** sobre `analyzer.py` → entendé el fan-out de contexto.
2. **Workflow `audit`** → mismo objetivo pero orquestado y verificado.
3. **`/loop`** → meté un bug a propósito y loopeá *"arreglá lo que rompa pytest"*.
4. **`/schedule`** → automatizá la auditoría para que corra sola.

Cada paso sube un escalón de autonomía. Empezá por el 1.
