export type WhereVisualOperator =
  | 'equal'
  | 'not_equal'
  | 'greater'
  | 'greater_or_equal'
  | 'less'
  | 'less_or_equal'
  | 'between'
  | 'not_between'
  | 'like'
  | 'not_like'
  | 'starts_with'
  | 'ends_with'
  | 'select_any_in'
  | 'select_not_any_in'
  | 'is_empty'
  | 'is_not_empty'

export interface WhereVisualRule {
  left: string
  op: WhereVisualOperator
  right?: any
}

export interface WhereVisualGroup {
  conjunction: 'and' | 'or'
  children: Array<WhereVisualGroup | WhereVisualRule>
}

export type WhereVisualNode = WhereVisualGroup | WhereVisualRule

const OPERATOR_TO_VISUAL: Record<string, WhereVisualOperator> = {
  $eq: 'equal',
  $ne: 'not_equal',
  $gt: 'greater',
  $gte: 'greater_or_equal',
  $lt: 'less',
  $lte: 'less_or_equal',
  $between: 'between',
  $notBetween: 'not_between',
  $like: 'like',
  $notLike: 'not_like',
  $startsWith: 'starts_with',
  $endsWith: 'ends_with',
  $in: 'select_any_in',
  $notIn: 'select_not_any_in',
  $isNull: 'is_empty',
  $isNotNull: 'is_not_empty',
}

const VISUAL_TO_OPERATOR: Record<WhereVisualOperator, string> = {
  equal: '$eq',
  not_equal: '$ne',
  greater: '$gt',
  greater_or_equal: '$gte',
  less: '$lt',
  less_or_equal: '$lte',
  between: '$between',
  not_between: '$notBetween',
  like: '$like',
  not_like: '$notLike',
  starts_with: '$startsWith',
  ends_with: '$endsWith',
  select_any_in: '$in',
  select_not_any_in: '$notIn',
  is_empty: '$isNull',
  is_not_empty: '$isNotNull',
}

const SCALAR_OPERATORS = new Set(['$eq', '$ne', '$gt', '$gte', '$lt', '$lte'])

const RANGE_OPERATORS = new Set(['$between', '$notBetween'])
const STRING_OPERATORS = new Set(['$like', '$notLike', '$startsWith', '$endsWith'])
const COLLECTION_OPERATORS = new Set(['$in', '$notIn'])
const EMPTY_OPERATORS = new Set(['$isNull', '$isNotNull'])
const GROUP_OPERATORS = new Set(['$and', '$or'])
const EMPTY_VISUAL_OPERATORS = new Set<WhereVisualOperator>(['is_empty', 'is_not_empty'])

export function deserializeWhereToVisualTree(value: any): WhereVisualGroup {
  if (value == null) {
    return {
      conjunction: 'and',
      children: [],
    }
  }
  if (!isPlainObject(value)) {
    throw new Error('Unsupported where shape for visual mode.')
  }
  return deserializeGroup(value)
}

export function serializeVisualTreeToWhere(group: WhereVisualGroup): any {
  assertVisualGroup(group)

  const serializedChildren = group.children
    .map((child) => serializeNode(child))
    .filter((child) => child != null)

  if (serializedChildren.length === 0) {
    return null
  }
  if (serializedChildren.length === 1) {
    return serializedChildren[0]
  }

  return {
    [group.conjunction === 'or' ? '$or' : '$and']: serializedChildren,
  }
}

function deserializeGroup(value: Record<string, any>): WhereVisualGroup {
  const groupChildren: WhereVisualNode[] = []
  const entries = Object.entries(value)

  if (entries.length === 1 && GROUP_OPERATORS.has(entries[0][0])) {
    const [operator, children] = entries[0]
    if (!Array.isArray(children)) {
      throw new Error(`Unsupported where group shape: ${operator}`)
    }
    return {
      conjunction: operator === '$or' ? 'or' : 'and',
      children: children.map((child) => deserializeNode(child)),
    }
  }

  for (const [key, clause] of entries) {
    if (GROUP_OPERATORS.has(key)) {
      if (!Array.isArray(clause)) {
        throw new Error(`Unsupported where group shape: ${key}`)
      }
      groupChildren.push({
        conjunction: key === '$or' ? 'or' : 'and',
        children: clause.map((child) => deserializeNode(child)),
      })
      continue
    }

    if (key.startsWith('$')) {
      throw new Error(`Unsupported where operator: ${key}`)
    }

    groupChildren.push(deserializeRule(key, clause))
  }

  return {
    conjunction: 'and',
    children: groupChildren,
  }
}

function deserializeNode(value: any): WhereVisualNode {
  if (!isPlainObject(value)) {
    throw new Error('Unsupported where child shape for visual mode.')
  }

  const entries = Object.entries(value)
  if (entries.length === 1 && GROUP_OPERATORS.has(entries[0][0])) {
    return deserializeGroup(value)
  }

  if (entries.length !== 1) {
    return deserializeGroup(value)
  }

  const [key, clause] = entries[0]
  if (key.startsWith('$')) {
    throw new Error(`Unsupported where operator: ${key}`)
  }

  return deserializeRule(key, clause)
}

function deserializeRule(fieldName: string, clause: any): WhereVisualRule {
  if (!isPlainObject(clause)) {
    if (isScalar(clause)) {
      return {
        left: fieldName,
        op: 'equal',
        right: clause,
      }
    }
    throw new Error(`Unsupported where rule shape for field: ${fieldName}`)
  }

  const entries = Object.entries(clause)
  if (entries.length !== 1) {
    throw new Error(`Unsupported where rule shape for field: ${fieldName}`)
  }

  const [operator, right] = entries[0]
  const visualOperator = OPERATOR_TO_VISUAL[operator]
  if (!visualOperator) {
    throw new Error(`Unsupported where operator: ${operator}`)
  }

  assertOperatorValueShape(operator, right)

  if (EMPTY_OPERATORS.has(operator)) {
    return {
      left: fieldName,
      op: visualOperator,
    }
  }

  return {
    left: fieldName,
    op: visualOperator,
    right,
  }
}

function serializeNode(node: WhereVisualNode): any {
  if (isVisualGroup(node)) {
    return serializeVisualTreeToWhere(node)
  }
  return serializeRule(node)
}

function serializeRule(rule: WhereVisualRule): Record<string, any> {
  assertVisualRule(rule)

  const operator = VISUAL_TO_OPERATOR[rule.op]
  if (!operator) {
    throw new Error(`Unsupported visual operator: ${rule.op}`)
  }

  if (EMPTY_VISUAL_OPERATORS.has(rule.op)) {
    return {
      [rule.left]: {
        [operator]: true,
      },
    }
  }

  assertOperatorValueShape(operator, rule.right)

  return {
    [rule.left]: {
      [operator]: rule.right,
    },
  }
}

function assertOperatorValueShape(operator: string, value: any) {
  if (SCALAR_OPERATORS.has(operator)) {
    if (isScalar(value)) {
      return
    }
    throw new Error(`Unsupported value shape for operator: ${operator}`)
  }

  if (RANGE_OPERATORS.has(operator)) {
    if (
      Array.isArray(value) &&
      value.length === 2 &&
      value.every((item) => isScalar(item))
    ) {
      return
    }
    throw new Error(`Unsupported value shape for operator: ${operator}`)
  }

  if (STRING_OPERATORS.has(operator)) {
    if (typeof value === 'string' && value.length > 0) {
      return
    }
    throw new Error(`Unsupported value shape for operator: ${operator}`)
  }

  if (COLLECTION_OPERATORS.has(operator)) {
    if (Array.isArray(value) && value.length > 0) {
      return
    }
    throw new Error(`Unsupported value shape for operator: ${operator}`)
  }

  if (EMPTY_OPERATORS.has(operator)) {
    if (value === true) {
      return
    }
    throw new Error(`Unsupported value shape for operator: ${operator}`)
  }

  throw new Error(`Unsupported where operator: ${operator}`)
}

function assertVisualGroup(value: any): asserts value is WhereVisualGroup {
  if (!isVisualGroup(value)) {
    throw new Error('Unsupported visual group shape.')
  }
}

function assertVisualRule(value: any): asserts value is WhereVisualRule {
  if (!isVisualRule(value)) {
    throw new Error('Unsupported visual rule shape.')
  }
}

function isVisualGroup(value: any): value is WhereVisualGroup {
  return (
    isPlainObject(value) &&
    (value.conjunction === 'and' || value.conjunction === 'or') &&
    Array.isArray(value.children)
  )
}

function isVisualRule(value: any): value is WhereVisualRule {
  return (
    isPlainObject(value) &&
    typeof value.left === 'string' &&
    value.left.length > 0 &&
    typeof value.op === 'string'
  )
}

function isScalar(value: any) {
  return value != null && !Array.isArray(value) && !isPlainObject(value)
}

function isPlainObject(value: any): value is Record<string, any> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
