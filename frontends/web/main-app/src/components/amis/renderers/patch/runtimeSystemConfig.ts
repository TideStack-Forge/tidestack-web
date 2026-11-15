import { isPlainObject } from 'lodash'

function readNestedSystemConfigValue(source: any, path: string) {
  if (!isPlainObject(source)) {
    return undefined
  }

  return path.split('.').reduce((current, key) => {
    if (!isPlainObject(current)) {
      return undefined
    }

    return current[key]
  }, source)
}

export function readSystemConfigValue(source: any, path: string) {
  if (!isPlainObject(source)) {
    return undefined
  }

  return source[path] ?? readNestedSystemConfigValue(source, path)
}

export function normalizeBooleanConfigValue(value: any) {
  if (value === true || value === false) {
    return value
  }

  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim().toLowerCase()

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false
  }

  return undefined
}

export function normalizePositiveIntegerConfigValue(value: any) {
  const numericValue = typeof value === 'string' ? Number(value.trim()) : Number(value)

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return undefined
  }

  return Math.max(1, Math.round(numericValue))
}
