import type {
  DeserializePopulateResult,
  PopulateNode,
  PopulateParseError,
} from './populate-types'

const KNOWN_RELATION_OPTION_KEYS = new Set([
  'select',
  'omit',
  'where',
  'limit',
  'offset',
  'populate',
])

export function deserializePopulate(value: any): DeserializePopulateResult {
  const errors: PopulateParseError[] = []
  const nodes = deserializePopulateNodes(value, 'populate', errors)
  return {
    nodes,
    errors,
  }
}

export function serializePopulate(nodes: PopulateNode[]): Record<string, any> {
  const result: Record<string, any> = {}

  for (const node of nodes ?? []) {
    if (!node?.relationName) {
      continue
    }
    result[node.relationName] = serializePopulateNode(node)
  }

  return result
}

function deserializePopulateNodes(
  value: any,
  path: string,
  errors: PopulateParseError[]
): PopulateNode[] {
  const nodes: PopulateNode[] = []
  const nodeIndex = new Map<string, PopulateNode>()

  if (value == null || value === '') {
    return nodes
  }

  if (typeof value === 'string') {
    for (const relationName of splitCommaTokens(value)) {
      mergeNode(nodes, nodeIndex, createPopulateNode(relationName))
    }
    return nodes
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`

      if (typeof item === 'string') {
        for (const relationName of splitCommaTokens(item)) {
          mergeNode(nodes, nodeIndex, createPopulateNode(relationName))
        }
        return
      }

      if (isPlainObject(item)) {
        for (const [relationName, relationValue] of Object.entries(item)) {
          const nextNode = deserializePopulateRelation(
            relationName,
            relationValue,
            `${path}.${relationName}`,
            errors
          )
          if (nextNode) {
            mergeNode(nodes, nodeIndex, nextNode)
          }
        }
        return
      }

      errors.push({
        path: itemPath,
        message: 'Populate list members must be strings or relation maps.',
      })
    })
    return nodes
  }

  if (isPlainObject(value)) {
    for (const [relationName, relationValue] of Object.entries(value)) {
      const nextNode = deserializePopulateRelation(
        relationName,
        relationValue,
        `${path}.${relationName}`,
        errors
      )
      if (nextNode) {
        mergeNode(nodes, nodeIndex, nextNode)
      }
    }
    return nodes
  }

  errors.push({
    path,
    message: 'Populate must be a string, list, or map.',
  })
  return nodes
}

function deserializePopulateRelation(
  relationName: string,
  relationValue: any,
  path: string,
  errors: PopulateParseError[]
): PopulateNode | null {
  const normalizedRelationName = String(relationName ?? '').trim()
  if (!normalizedRelationName) {
    errors.push({
      path,
      message: 'Relation name cannot be empty.',
    })
    return null
  }

  const node = createPopulateNode(normalizedRelationName)

  if (relationValue === true || relationValue == null) {
    return node
  }

  if (typeof relationValue === 'string') {
    const select = splitCommaTokens(relationValue)
    if (select.length > 0) {
      node.options.select = select
    }
    return normalizePopulateNode(node)
  }

  if (Array.isArray(relationValue)) {
    const select = parseFieldListValue(relationValue, path, errors)
    if (select) {
      if (select.length > 0) {
        node.options.select = select
      }
      return normalizePopulateNode(node)
    }
    return null
  }

  if (!isPlainObject(relationValue)) {
    errors.push({
      path,
      message: 'Relation value must be true, a string, a list, or a map.',
    })
    return null
  }

  if ('select' in relationValue) {
    const select = parseFieldListValue(relationValue.select, `${path}.select`, errors)
    if (select) {
      if (select.length > 0) {
        node.options.select = select
      }
    }
  }

  if ('omit' in relationValue) {
    const omit = parseFieldListValue(relationValue.omit, `${path}.omit`, errors)
    if (omit) {
      if (omit.length > 0) {
        node.options.omit = omit
      }
    }
  }

  if ('where' in relationValue && relationValue.where !== undefined) {
    node.options.where = relationValue.where
  }

  if ('limit' in relationValue && !isUnsetNumericOption(relationValue.limit)) {
    node.options.limit = relationValue.limit
  }

  if ('offset' in relationValue && !isUnsetNumericOption(relationValue.offset)) {
    node.options.offset = relationValue.offset
  }

  if ('populate' in relationValue) {
    node.children = deserializePopulateNodes(
      relationValue.populate,
      `${path}.populate`,
      errors
    )
  }

  for (const [key, optionValue] of Object.entries(relationValue)) {
    if (KNOWN_RELATION_OPTION_KEYS.has(key)) {
      continue
    }
    if (!node.extras) {
      node.extras = {}
    }
    node.extras[key] = optionValue
  }

  return normalizePopulateNode(node)
}

function serializePopulateNode(node: PopulateNode): any {
  const relationValue: Record<string, any> = {}
  const normalizedNode = normalizePopulateNode({
    ...node,
    options: {
      ...(node.options || {}),
    },
    children: [...(node.children || [])],
    extras: node.extras ? { ...node.extras } : undefined,
  })

  if (normalizedNode.options.select?.length) {
    relationValue.select = [...normalizedNode.options.select]
  }

  if (normalizedNode.options.omit?.length) {
    relationValue.omit = [...normalizedNode.options.omit]
  }

  if ('where' in normalizedNode.options && normalizedNode.options.where !== undefined) {
    relationValue.where = normalizedNode.options.where
  }

  if ('limit' in normalizedNode.options && normalizedNode.options.limit !== undefined) {
    relationValue.limit = normalizedNode.options.limit
  }

  if ('offset' in normalizedNode.options && normalizedNode.options.offset !== undefined) {
    relationValue.offset = normalizedNode.options.offset
  }

  if (normalizedNode.extras) {
    Object.assign(relationValue, normalizedNode.extras)
  }

  if (normalizedNode.children.length > 0) {
    relationValue.populate = serializePopulate(normalizedNode.children)
  }

  return Object.keys(relationValue).length > 0 ? relationValue : true
}

function mergeNode(
  nodes: PopulateNode[],
  nodeIndex: Map<string, PopulateNode>,
  incomingNode: PopulateNode
) {
  const existingNode = nodeIndex.get(incomingNode.relationName)
  if (!existingNode) {
    nodes.push(incomingNode)
    nodeIndex.set(incomingNode.relationName, incomingNode)
    return
  }

  if (incomingNode.relationLabel) {
    existingNode.relationLabel = incomingNode.relationLabel
  }
  if (incomingNode.targetModel) {
    existingNode.targetModel = incomingNode.targetModel
  }
  if (incomingNode.targetModelLabel) {
    existingNode.targetModelLabel = incomingNode.targetModelLabel
  }
  if (incomingNode.relationType) {
    existingNode.relationType = incomingNode.relationType
  }

  mergePopulateOptions(existingNode, incomingNode)

  if (incomingNode.extras && Object.keys(incomingNode.extras).length > 0) {
    existingNode.extras = {
      ...(existingNode.extras || {}),
      ...incomingNode.extras,
    }
  }

  if (incomingNode.children.length > 0) {
    const mergedChildren = mergePopulateChildren(
      existingNode.children,
      incomingNode.children
    )
    existingNode.children = mergedChildren
  }
}

function mergePopulateChildren(
  currentChildren: PopulateNode[],
  nextChildren: PopulateNode[]
): PopulateNode[] {
  const mergedChildren = [...currentChildren]
  const childIndex = new Map<string, PopulateNode>()

  mergedChildren.forEach((child) => {
    childIndex.set(child.relationName, child)
  })

  for (const nextChild of nextChildren) {
    mergeNode(mergedChildren, childIndex, nextChild)
  }

  return mergedChildren
}

function mergePopulateOptions(existingNode: PopulateNode, incomingNode: PopulateNode) {
  const incomingOptions = normalizePopulateNode(incomingNode).options
  const existingOptions = normalizePopulateNode(existingNode).options

  if (incomingOptions.select?.length) {
    existingOptions.select = [...incomingOptions.select]
    delete existingOptions.omit
  } else if (incomingOptions.omit?.length && !existingOptions.select?.length) {
    existingOptions.omit = [...incomingOptions.omit]
  }

  if ('where' in incomingOptions) {
    existingOptions.where = incomingOptions.where
  }

  if ('limit' in incomingOptions) {
    existingOptions.limit = incomingOptions.limit
  }

  if ('offset' in incomingOptions) {
    existingOptions.offset = incomingOptions.offset
  }

  existingNode.options = existingOptions
}

function normalizePopulateNode(node: PopulateNode): PopulateNode {
  const normalizedOptions = {
    ...(node.options || {}),
  }

  if (!normalizedOptions.select?.length) {
    delete normalizedOptions.select
  }

  if (!normalizedOptions.omit?.length) {
    delete normalizedOptions.omit
  }

  if (normalizedOptions.select?.length) {
    delete normalizedOptions.omit
  }

  const normalizedNode: PopulateNode = {
    ...node,
    options: normalizedOptions,
    children: [...(node.children || [])],
    extras:
      node.extras && Object.keys(node.extras).length > 0 ? { ...node.extras } : undefined,
  }

  return normalizedNode
}

function parseFieldListValue(
  value: any,
  path: string,
  errors: PopulateParseError[]
): string[] | null {
  if (value == null || value === '') {
    return []
  }

  if (typeof value === 'string') {
    return splitCommaTokens(value)
  }

  if (!Array.isArray(value)) {
    errors.push({
      path,
      message: 'Field list value must be a string or a string array.',
    })
    return null
  }

  const fields: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') {
      errors.push({
        path,
        message: 'Field list members must be strings.',
      })
      return null
    }
    const normalizedItem = item.trim()
    if (normalizedItem) {
      fields.push(normalizedItem)
    }
  }

  return fields
}

function splitCommaTokens(value: string): string[] {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function createPopulateNode(relationName: string): PopulateNode {
  return {
    id: `populate-node-${createPopulateNode.nextId++}`,
    relationName,
    options: {},
    children: [],
  }
}

createPopulateNode.nextId = 1

function isUnsetNumericOption(value: any) {
  return value === '' || value == null
}

function isPlainObject(value: any): value is Record<string, any> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
