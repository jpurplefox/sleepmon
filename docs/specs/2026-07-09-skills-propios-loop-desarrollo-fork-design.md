# Skills propios: fork del loop de desarrollo de superpowers

**Fecha:** 2026-07-09
**Estado:** aprobado (diseño), pendiente de plan de implementación

## Contexto y motivación

Usamos los skills de la librería **superpowers** y nos gusta el workflow, pero
tiene detalles que no encajan con nuestra forma de trabajar. El disparador fue
la **persistencia de andamiaje en el repo versionado** (`writing-plans` guarda
cada plan en `docs/superpowers/plans/` y lo commitea; el plan es andamiaje de
una sesión, no documentación de decisiones), y el `git commit` automático de la
spec.

Al auditar, el problema se generaliza: queremos **ser dueños de nuestro loop de
desarrollo** — mismos buenos hábitos de superpowers, pero con nuestras
decisiones sobre persistencia, commits y handoffs. Por eso forkeamos la cadena
completa, no solo un skill.

Lo que **sí** queremos conservar en el repo son las **specs** (documentan
decisiones), pero en `docs/specs/` y sin commit automático.

## Hallazgos de la auditoría

Se auditaron los 14 skills de superpowers (v6.0.3):

- **Escriben andamiaje en el árbol versionado:** `brainstorming` (spec +
  `git commit`), `writing-plans` (plan → `docs/superpowers/plans/`),
  `subagent-driven-development` (ledger/reports → `.superpowers/sdd/`).
- **Leen el plan como input (ruta parametrizable, no hardcodeada):**
  `executing-plans`, `requesting-code-review`, `subagent-driven-development`.
- **La cadena está encadenada por nombre:** `writing-plans` → SDD (sub-skill
  requerido) → `requesting-code-review` (review final) →
  `finishing-a-development-branch` (terminal). Forkear a medias deja el loop
  "goteando" a superpowers.
- **Git legítimo (infra):** `finishing-a-development-branch` (merge/PR/worktree),
  `using-git-worktrees`, `test-driven-development` (commits del ciclo).
- **Proceso puro:** `dispatching-parallel-agents`, `systematic-debugging`,
  `using-superpowers`, `verification-before-completion`, `receiving-code-review`.
- **Meta-tooling:** `writing-skills`.

## Decisiones tomadas

1. **Specs → repo, en `docs/specs/`** (ruta propia). Se conservan en git.
2. **Planes → scratchpad de sesión**, efímero, fuera de git.
3. **Ejecución en la misma sesión** vía el fork de `subagent-driven-development`.
   No se soporta el flujo de sesión aparte (`executing-plans`).
4. **Forkear el loop completo** (8 skills), no solo el cluster de planes.
5. **Sin commits automáticos** en ningún skill del loop; el usuario controla
   cuándo commitear (alineado con `CLAUDE.md`: "commit solo cuando se pida").
6. **Técnica de fork mixta** (thin fork vs. copia de directorio) según los
   archivos de soporte de cada skill (ver tabla).
7. **Nombres propios** distintos de los originales, evitando colisión con skills
   existentes (`review`, `code-review`, `verify`, `branch`, `audit`…).

## Alcance

Se crean **10** skills en `.claude/skills/` (nivel proyecto, versionados): 8 forks
de superpowers + `architect` y `adr` (composiciones nuevas). La cadena resultante:

```
design → architect → plan → prepare → build → request-review → finish
                                        (receive-review, tdd y adr son sub-skills de apoyo)
```

`adr` es sub-skill: lo invoca `architect` (o el usuario) cuando hay que registrar
una decisión transversal; `architect` solo detecta la necesidad.

**Fuera de alcance:** visual-companion, `executing-plans` (sesión aparte),
y forkear cualquier otro skill del listado.

## Nombres propuestos

| Original (superpowers)          | Fork propio        | Nota                                   |
|---------------------------------|--------------------|----------------------------------------|
| `brainstorming`                 | `design`           | decidido                               |
| — (nuevo)                       | `architect`        | decisiones de arquitectura → doc al scratchpad; detecta ADRs |
| — (nuevo)                       | `adr`              | escribe un ADR en docs/adr (Nygard, índice, supersession) |
| `writing-plans`                 | `plan`             | decidido                               |
| `using-git-worktrees`           | `prepare`          | prepara workspace aislado + setup/baseline propios |
| `subagent-driven-development`   | `build`            | ejecuta el plan con subagentes         |
| `requesting-code-review`        | `request-review`   | evita colisión con `review`/`code-review` |
| `receiving-code-review`         | `receive-review`   | compañero del anterior                 |
| `finishing-a-development-branch`| `finish`           | paso terminal del loop                 |
| `test-driven-development`       | `tdd`              | disciplina de apoyo                    |

(Nombres de los 5 nuevos: propuestos, ajustables en la revisión de la spec.)

## Técnica de fork por skill

| Fork             | Técnica                | Archivos a copiar                                              |
|------------------|------------------------|---------------------------------------------------------------|
| `design`         | thin fork              | `SKILL.md` (sin visual-companion)                             |
| `plan`           | thin fork              | `SKILL.md`                                                     |
| `prepare`        | thin fork              | `SKILL.md`                                                     |
| `build`          | copia de directorio    | `SKILL.md` + `implementer-prompt.md` + `task-reviewer-prompt.md` + `scripts/` |
| `request-review` | copia de directorio    | `SKILL.md` + `code-reviewer.md`                               |
| `receive-review` | thin fork              | `SKILL.md`                                                     |
| `finish`         | thin fork              | `SKILL.md`                                                     |
| `tdd`            | copia + 1 archivo      | `SKILL.md` + `testing-anti-patterns.md`                       |

## Diseño por skill (qué cambia vs. el original)

### `design` (← `brainstorming`)
**Revisión (2026-07-09): separa funcionalidad de arquitectura.** El skill solo
persiste lo **funcional/producto**, no la arquitectura.
- Salida → **`docs/prd/NNNN-<slug>.md`** (numerado 4 dígitos estilo ADR, **no
  fechado**; el skill calcula el siguiente número escaneando `docs/prd/`), con el
  formato de producto del repo (Purpose · What it does · How it works ·
  **Acceptance criteria** · Guidelines · Out of scope), **en inglés** (el repo
  migra a inglés). Los acceptance criteria son observables y concretos (semilla
  de los tests) e incluyen edge/error/empty. Además
  añade la línea de índice en `docs/prd/README.md`. Ya **no** escribe a
  `docs/specs/` ni a `docs/features/`.
- **Foco funcional:** las preguntas y secciones de diseño exploran propósito,
  usuarios, alcance, reglas y fuera-de-alcance — no arquitectura. Lo técnico
  queda fuera de alcance de `design`: el `plan` decide arquitectura y decisiones
  técnicas por su cuenta (a partir del PRD y del código), nadie se las pasa.
- **Sin `git commit` automático:** escribe el doc + índice y avisa; commitea el
  usuario.
- **Handoff terminal → `plan`** (no `superpowers:writing-plans`).
- Se elimina la sección de Visual Companion y sus referencias.
- Se conserva: preguntas de a una, 2-3 enfoques (funcionales), secciones con
  aprobación incremental, self-review del documento, gate de revisión de usuario.

### `architect` (nuevo — extraído de `plan`)
- **Dueño de la arquitectura.** Toma el documento de diseño (el *qué*) y decide
  el *cómo*. El doc de arquitectura captura: file structure, interfaces, data
  flow, error handling, **test seams** (cómo se verifica cada pieza), **constraints
  & invariantes** (destiladas de los ADRs activos + el diseño → alimentan las
  *Global Constraints* de `plan`), **trazabilidad AC → componente**, y **puntos
  de integración** con el código existente. Para decisiones significativas con
  alternativas, propone 2-3 opciones y pide aprobación.
- **Respeta los ADRs en vigor.** Antes de diseñar lee el índice `docs/adr/README.md`
  y los ADRs con estado **Accepted** (saltea Deprecated/Superseded); no los
  contradice por lo bajo.
- **Self-review + user gate** (como `design`): tras escribir el doc, chequea con
  "fresh eyes" (sin TODOs/placeholders, cada AC trazado a un componente,
  interfaces concretas, seams presentes, constraints/ADRs); luego el usuario
  revisa antes del handoff.
- Salida → **doc de arquitectura al scratchpad** (`<scratchpad>/architecture/…`),
  efímero, sin commit.
- **Detecta** decisiones transversales, **se lo informa al usuario** (dice que
  podría ameritar un ADR y por qué) y **el usuario decide**: solo con su OK
  invoca al skill `adr`. Nunca lo crea por su cuenta ni escribe el ADR él mismo.
- Handoff → **`plan`**.

### `adr` (nuevo)
- Escribe **un** ADR en `docs/adr/` con formato Nygard (Title/Status/Context/
  Decision/Consequences), siguiendo `0000-template.md`.
- Numeración incremental que nunca se reutiliza (cuenta también superseded/
  deprecated); estado `Accepted` por defecto.
- Maneja **supersession** sin reescribir el ADR viejo (solo actualiza su Status
  a "Superseded by / Partially superseded by") y actualiza el índice del README.
- Ofrece commitear el ADR + índice (+ el superseded tocado), staged solo.
- Sub-skill: lo invoca `architect` o el usuario directo.

### `plan` (← `writing-plans`)
- **Ya no decide arquitectura** (eso es de `architect`). Lee el **doc de
  arquitectura** (el *cómo*) + el documento de diseño (el *qué*) y los convierte
  en un plan de tareas ejecutable, ordenado. No re-decide la arquitectura: la
  sigue; si falta o contradice al diseño, lo plantea.
- Plan → **scratchpad de sesión** (`<scratchpad>/plans/YYYY-MM-DD-<feature>.md`),
  sin `git add`/`commit` del plan.
- Cierre y handoff → **`build`** (mismo hilo); se elimina la opción de sesión
  aparte.
- Se conserva: tareas bite-sized, DRY/YAGNI/TDD, commits frecuentes **del código**,
  estructura y criterios de calidad del plan.

### `prepare` (← `using-git-worktrees`)
- **Motivo del fork: Steps 2-3 propios**, no la mecánica de worktree (esa se
  conserva).
- **Step 2 (setup)** con los comandos de sleepmon: `pip install -e ".[dev]"` en
  venv para el backend; `npm install` en `frontend/` cuando aplique. Se sustituye
  el `pip install -r requirements.txt` / `poetry install` genérico.
- **Step 3 (baseline)**: `pytest -m "not integration"` (dominio + aplicación +
  HTTP, sin DB), no `pytest` a secas.
- **Preferencia de directorio de worktree**: `.claude/worktrees/` (ya existente),
  no el `.worktrees/` por defecto.
- **Se conserva:** Step 0 (detección de aislamiento), guard de submódulos,
  deferir a la herramienta nativa (`EnterWorktree`) antes que a `git worktree`, y
  los red flags. El `git commit` del `.gitignore` (línea 86 original) vive en el
  fallback 1b, que no se alcanza con tooling nativo; se deja documentado como
  código muerto en nuestro setup.

### `build` (← `subagent-driven-development`)
- **Andamiaje al scratchpad:** ledger (`progress.md`) y reports de tarea
  (`task-N-brief.md`, `task-N-report.md`) van a `<scratchpad>/build/` en vez de
  `.superpowers/sdd/`. Se ajustan las rutas en `SKILL.md` y en `scripts/`.
- Lee la ruta del plan desde el scratchpad (input que le pasa `plan`).
- **Handoffs reescritos:** aislamiento → `prepare`; disciplina → `tdd`; review
  final → `request-review`; terminal → `finish` (ninguno `superpowers:*`).
- Se conserva: bucle implementer → task-reviewer → fix, self-review, commits del
  código por tarea.

### `request-review` (← `requesting-code-review`)
- **No persiste andamiaje** (el reviewer es read-only); el fork es por
  consistencia de la cadena y tono, no por el tema del repo.
- Recibe la ruta del plan (scratchpad) como `PLAN_OR_REQUIREMENTS`.
- Handoff de vuelta / triage → `receive-review`.
- Se copia y adapta `code-reviewer.md` (rutas de ejemplo al scratchpad).

### `receive-review` (← `receiving-code-review`)
- Proceso puro; fork para ajustar tono/rigor a nuestro criterio.
- Sin cambios de persistencia.

### `finish` (← `finishing-a-development-branch`)
- **Sin commit/merge automático:** presenta las opciones (merge / PR / limpieza)
  y **espera confirmación**; no ejecuta `git commit`/`git merge`/`gh pr` por su
  cuenta. Alinea con `CLAUDE.md` y con el skill `branch` (convención RealTrends).
- Se conserva: detección de merge-base, limpieza de worktree (`git worktree
  remove`/`prune`) como pasos ofrecidos, checklist de cierre.

### `tdd` (← `test-driven-development`)
- Se adapta la rigidez del ciclo red-green-refactor a nuestra forma de trabajar
  (matiz exacto a definir en el plan; por defecto se conserva el ciclo estricto).
- Se copia `testing-anti-patterns.md` sin cambios salvo referencias.

## Cadena de handoffs (reescrita)

Cada fork apunta a **forks propios**, nunca a `superpowers:*`:

- `design` → `plan`
- `plan` → `build`
- `build` → (aislamiento) `prepare` · (disciplina) `tdd` · (review final) `request-review` · (terminal) `finish`
- `request-review` → `receive-review`

## Validación (checklist de humo)

Sobre una feature de juguete, ejercitando el loop:

1. `design`: escribe spec en `docs/specs/`, **no** commitea, hace handoff a `plan`.
2. `plan`: escribe en el **scratchpad**, no aparece en `git status`, entrega a `build`.
3. `build`: ledger/reports en `<scratchpad>/build/` (no en `.superpowers/`);
   handoffs finales apuntan a `request-review` y `finish`.
4. `prepare`: usa `.claude/worktrees/`, corre `pip install -e ".[dev]"` y
   `pytest -m "not integration"` como baseline; defiere a `EnterWorktree`.
5. `finish`: no ejecuta commit/merge sin confirmación.
6. Ningún fork del loop invoca `superpowers:*` en sus handoffs.

## Riesgos y notas

- **Deriva del upstream:** los forks no heredan fixes de superpowers. Coste
  asumido (son skills propios).
- **Superficie de mantenimiento mayor:** 10 skills, algunos con archivos de
  soporte y scripts. A cambio, control total del loop.
- **`prepare` hereda lógica genérica valiosa** (detección de aislamiento, guard
  de submódulos). El fork solo diverge en Steps 2-3; mantener sincronizado el
  resto con upstream es un coste menor a vigilar.
- **`scripts/` de `build`:** hay que revisar que `review-package` no asuma rutas
  de `.superpowers/`; ajustar a scratchpad.
- **Colisión de nombres:** evitada con nombres propios; verificar que no choquen
  con skills ya instalados al crearlos.
- **Ruta del scratchpad:** específica de sesión, la inyecta el harness; los
  skills la referencian de forma genérica.
- **`docs/superpowers/plans/` y `.superpowers/` existentes:** quedan como legado;
  el flujo nuevo no escribe ahí.
