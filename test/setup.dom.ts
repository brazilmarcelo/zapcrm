// Setup específico para testes com DOM (React Testing Library, etc.)
// Importa matchers do jest-dom apenas quando existe `document`.

const hasDom = typeof document !== 'undefined'

if (hasDom) {
  // Alguns helpers (ex: @testing-library/user-event) esperam `window`/`navigator`
  // disponíveis na "view" atual.
  const g = globalThis as typeof globalThis & { window?: unknown; navigator?: unknown; IS_REACT_ACT_ENVIRONMENT?: boolean }

  if (typeof g.window === 'undefined') {
    g.window = globalThis
  }

  if (typeof g.navigator === 'undefined') {
    g.navigator = { userAgent: 'vitest' }
  }

  // Top-level await é suportado neste projeto (ESM). Em ambiente node puro, `hasDom` é false.
  await import('@testing-library/jest-dom/vitest')

  // Ajuda a evitar warnings do React sobre act() em alguns cenários.
  g.IS_REACT_ACT_ENVIRONMENT = true
}
