export const meta = {
  name: 'audit',
  description: 'Audita src/sleepmon en varias dimensiones y verifica cada hallazgo',
  phases: [
    { title: 'Review', detail: 'una dimensión por agente' },
    { title: 'Verify', detail: 'refutar cada hallazgo' },
  ],
}

// Dimensiones de revisión — corré una por agente, en paralelo.
const DIMENSIONS = [
  { key: 'correctness', prompt: 'Revisá src/sleepmon/analyzer.py buscando bugs de cálculo y edge cases sin cubrir.' },
  { key: 'tests', prompt: 'Revisá tests/ y listá ramas de src/sleepmon sin cobertura de test.' },
  { key: 'typing', prompt: 'Revisá src/sleepmon buscando type hints faltantes, débiles o incorrectos.' },
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
