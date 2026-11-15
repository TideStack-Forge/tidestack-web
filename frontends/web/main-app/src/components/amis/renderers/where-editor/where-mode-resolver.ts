const SCALAR_OPERATORS = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte'])

const RANGE_OPERATORS = new Set(['$between', '$notBetween'])
const STRING_OPERATORS = new Set(['$like', '$notLike', '$startsWith', '$endsWith'])
const COLLECTION_OPERATORS = new Set(['$in', '$notIn'])
const EMPTY_OPERATORS = new Set(['$isNull', '$isNotNull'])
const LOGIC_OPERATORS = new Set(['$and', '$or'])

export type WhereEditorModeResolution = {
  mode: 'visual' | 'raw'
  reason: null | 'list-expression' | 'unsupported-operator' | 'unsupported-shape'
}

export function resolveWhereEditorMode(value: any): WhereEditorModeResolution {
  if (value == null) {
    return {
      mode: 'visual',
      reason: null,
    }
  }
  if (Array.isArray(value)) {
    return {
      mode: 'raw',
      reason: 'list-expression',
    }
  }
  if (!isPlainObject(value)) {
    return {
      mode: 'raw',
      reason: 'unsupported-shape',
    }
  }

  const result = inspectWhereNode(value)
  if (result === null) {
    return {
      mode: 'visual',
      reason: null,
    }
  }

  return {
    mode: 'raw',
    reason: result,
  }
}

function inspectWhereNode(
  value: Record<string, any>
): WhereEditorModeResolution['reason'] {
  const entries = Object.entries(value)
  for (const [key, clause] of entries) {
    if (LOGIC_OPERATORS.has(key)) {
      if (!Array.isArray(clause)) {
        return 'unsupported-shape'
      }
      for (const child of clause) {
        if (!isPlainObject(child)) {
          return 'unsupported-shape'
        }
        const childResult = inspectWhereNode(child)
        if (childResult) {
          return childResult
        }
      }
      continue
    }

    if (key.startsWith('$')) {
      return 'unsupported-operator'
    }

    const fieldResult = inspectFieldClause(clause)
    if (fieldResult) {
      return fieldResult
    }
  }

  return null
}

function inspectFieldClause(value: any): WhereEditorModeResolution['reason'] {
  if (value == null) {
    return 'unsupported-shape'
  }
  if (Array.isArray(value)) {
    return 'unsupported-shape'
  }
  if (!isPlainObject(value)) {
    return null
  }

  const entries = Object.entries(value)
  if (entries.length !== 1) {
    return 'unsupported-shape'
  }

  const [operator, right] = entries[0]
  if (!isSupportedOperator(operator)) {
    return 'unsupported-operator'
  }

  if (SCALAR_OPERATORS.has(operator)) {
    return isScalar(right) ? null : 'unsupported-shape'
  }
  if (RANGE_OPERATORS.has(operator)) {
    return isRangeValue(right) ? null : 'unsupported-shape'
  }
  if (STRING_OPERATORS.has(operator)) {
    return typeof right === 'string' && right.length > 0 ? null : 'unsupported-shape'
  }
  if (COLLECTION_OPERATORS.has(operator)) {
    return Array.isArray(right) && right.length > 0 ? null : 'unsupported-shape'
  }
  if (EMPTY_OPERATORS.has(operator)) {
    return right === true ? null : 'unsupported-shape'
  }

  return 'unsupported-operator'
}

function isSupportedOperator(operator: string) {
  return (
    SCALAR_OPERATORS.has(operator) ||
    RANGE_OPERATORS.has(operator) ||
    STRING_OPERATORS.has(operator) ||
    COLLECTION_OPERATORS.has(operator) ||
    EMPTY_OPERATORS.has(operator)
  )
}

function isRangeValue(value: any) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => item != null && !isPlainObject(item) && !Array.isArray(item))
  )
}

function isScalar(value: any) {
  return value != null && !isPlainObject(value) && !Array.isArray(value)
}

function isPlainObject(value: any): value is Record<string, any> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
