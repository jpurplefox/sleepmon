export const meta = {
  name: 'audit',
  description: 'Audita el backend (backend/src/sleepmon) en varias dimensiones y verifica cada hallazgo',
  phases: [
    { title: 'Review', detail: 'una dimensión por agente' },
    { title: 'Verify', detail: 'refutar cada hallazgo' },
  ],
}

// Dimensiones de revisión — corré una por agente, en paralelo.
const DIMENSIONS = [
  { key: 'correctness', prompt: 'Revisá backend/src/sleepmon/domain y application buscando bugs de validación, invariantes flojas y edge cases sin cubrir (niveles, slots según nivel, sub skills duplicadas, ingredientes inválidos para la especie).' },
  { key: 'hexagonal', prompt: 'Revisá backend/src/sleepmon: verificá que domain/ no importe infraestructura (litestar, psycopg, pypika) ni adapters/, y que la aplicación dependa solo de los puertos. Reportá cada violación de la arquitectura hexagonal.' },
  { key: 'tests', prompt: 'Revisá backend/tests/ y listá ramas de domain/application sin cobertura de test.' },
  { key: 'typing', prompt: 'Revisá backend/src/sleepmon buscando type hints faltantes, débiles o incorrectos (mypy corre en modo strict).' },
]

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'number' },
          severity: { type: 'string', enum: ['alta', 'media', 'baja'] },
        },
        required: ['title', 'file', 'severity'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    isReal: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['isReal', 'reason'],
}

// Pipeline: cada dimensión verifica sus hallazgos apenas termina su review,
// sin esperar a las demás.
const results = await pipeline(
  DIMENSIONS,
  (d) => agent(d.prompt, { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS }),
  (review) =>
    parallel(
      review.findings.map((f) => () =>
        agent(`Intentá refutar este hallazgo: "${f.title}" en ${f.file}. Si dudás, marcá isReal=false.`, {
          label: `verify:${f.file}`,
          phase: 'Verify',
          schema: VERDICT,
        }).then((v) => ({ ...f, verdict: v }))
      )
    )
)

const confirmed = results
  .flat()
  .filter(Boolean)
  .filter((f) => f.verdict?.isReal)

log(`${confirmed.length} hallazgos confirmados`)
return { confirmed }
