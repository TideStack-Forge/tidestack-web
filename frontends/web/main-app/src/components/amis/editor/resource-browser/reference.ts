export const FRONTEND_RESOURCE_REFERENCE_PREFIX = 'resource:'

function normalizeFrontendResourceKey(key?: string | null): string | null {
  if (!key) {
    return null
  }
  const normalized = key.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  return normalized || null
}

export function buildFrontendResourceReference(key?: string | null): string | undefined {
  const normalized = normalizeFrontendResourceKey(key)
  if (!normalized) {
    return undefined
  }
  return `${FRONTEND_RESOURCE_REFERENCE_PREFIX}${normalized}`
}

export function parseFrontendResourceReference(
  value?: string | null
): { key: string } | null {
  if (!value || !value.startsWith(FRONTEND_RESOURCE_REFERENCE_PREFIX)) {
    return null
  }
  const normalized = normalizeFrontendResourceKey(
    value.slice(FRONTEND_RESOURCE_REFERENCE_PREFIX.length)
  )
  return normalized ? { key: normalized } : null
}

export function isFrontendResourceReference(value?: string | null): boolean {
  return !!parseFrontendResourceReference(value)
}
