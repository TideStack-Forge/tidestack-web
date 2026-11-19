function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof RegExp)
  )
}

/**
 * Reorders AMIS schema keys to follow the previous schema where possible.
 * Missing keys stay deleted; new keys keep their order from the new schema.
 */
export function reorderSchemaLike<T>(previous: unknown, next: T): T {
  if (Array.isArray(previous) && Array.isArray(next)) {
    return next.map((item, index) => reorderSchemaLike(previous[index], item)) as T
  }

  if (!isPlainRecord(previous) || !isPlainRecord(next)) {
    return next
  }

  const reordered: Record<string, unknown> = {}

  Object.keys(previous).forEach((key) => {
    if (hasOwn(next, key)) {
      reordered[key] = reorderSchemaLike(previous[key], next[key])
    }
  })

  Object.keys(next).forEach((key) => {
    if (!hasOwn(previous, key)) {
      reordered[key] = reorderSchemaLike(undefined, next[key])
    }
  })

  return reordered as T
}
