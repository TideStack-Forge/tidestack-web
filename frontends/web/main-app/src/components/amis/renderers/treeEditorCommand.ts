import {
  buildApi,
  createObject,
  dataMapping,
  evalExpressionWithConditionBuilder,
  isEffectiveApi,
  resolveVariableAndFilter,
  wrapAdaptor,
} from 'amis'

export type TreeEditorMode = 'local' | 'command'
export type TreeDropPosition = 'top' | 'bottom' | 'self'
export type TreeDropMode = 'BEFORE' | 'AFTER' | 'INNER'

export interface TreeEditorDropInfo {
  dragNode: any
  node: any
  targetNode?: any
  position: TreeDropPosition
  [key: string]: any
}

export interface TreeEditorMovePayload extends TreeEditorDropInfo {
  targetNode: any
  dropMode: TreeDropMode
  sourceParentId: any
  targetParentId: any
  sourceIndex: number
  targetIndex: number
}

export interface TreeEditorMoveOptions {
  valueField?: string
  childrenField?: string
}

interface NodeLocation {
  node: any
  parent: any
  index: number
  path: number[]
}

const POSITION_TO_DROP_MODE: Record<TreeDropPosition, TreeDropMode> = {
  top: 'BEFORE',
  bottom: 'AFTER',
  self: 'INNER',
}

export function normalizeTreeEditorMode(mode?: string): TreeEditorMode {
  return mode === 'command' ? 'command' : 'local'
}

export function resolveTreeEditorValue(value: any, data: any) {
  if (typeof value === 'string') {
    return dataMapping(value, data)
  }

  return value
}

export function resolveTreeEditorBoolean(value: any, data: any, defaultValue: boolean) {
  if (value === undefined || value === null) return defaultValue
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value.includes('${')) return !!dataMapping(value, data)
    if (value === 'true') return true
    if (value === 'false') return false

    try {
      return !!evalExpressionWithConditionBuilder(value, data)
    } catch (error) {
      console.error(error)
      return defaultValue
    }
  }

  return !!value
}

export function normalizeTreeEditorApi(api: any) {
  if (!api || typeof api === 'string') return api

  const normalized = { ...api }
  if (normalized.responseAdaptor && !normalized.adaptor) {
    normalized.adaptor = normalized.responseAdaptor
  }

  return normalized
}

export function buildTreeEditorApi(api: any, data: any) {
  const normalized = normalizeTreeEditorApi(api)
  return normalized ? buildApi(normalized, data) : normalized
}

export async function normalizeTreeEditorResponse(result: any, api: any, data: any) {
  if (typeof result?.ok === 'boolean') return result

  return wrapAdaptor(Promise.resolve(result), api, data)
}

export function resolveTreeEditorSource(source: any, data: any) {
  if (typeof source !== 'string') return source

  return resolveVariableAndFilter(source, data, '| raw') ?? source
}

export function isTreeEditorApi(source: any, data: any) {
  const resolved = normalizeTreeEditorApi(resolveTreeEditorSource(source, data))
  return !!resolved && isEffectiveApi(resolved, data)
}

export function extractTreeEditorItems(result: any) {
  const data = result?.data ?? result
  const items = data?.options ?? data?.items ?? data?.rows ?? data
  return Array.isArray(items) ? items : []
}

export function assertTreeEditorResponse(result: any, fallbackMessage: string) {
  if (result?.ok === false) {
    throw new Error(result.msg || fallbackMessage)
  }

  return result
}

export async function requestTreeEditorApi(
  api: any,
  data: any,
  env: { fetcher?: (api: any, data?: any, options?: any) => Promise<any> } | undefined,
  options: {
    fallbackMessage: string
    invalidApiMessage?: string
    missingFetcherMessage?: string
  }
) {
  const normalizedApi = normalizeTreeEditorApi(api)
  if (!normalizedApi || !isEffectiveApi(normalizedApi, data)) {
    throw new Error(
      options.invalidApiMessage || 'TreeEditor command api is not configured'
    )
  }
  if (!env?.fetcher) {
    throw new Error(
      options.missingFetcherMessage || 'TreeEditor command api requires env.fetcher'
    )
  }

  const requestApi = buildTreeEditorApi(normalizedApi, data)
  const result = await normalizeTreeEditorResponse(
    await env.fetcher(requestApi, data),
    requestApi,
    data
  )
  return assertTreeEditorResponse(result, options.fallbackMessage)
}

export function normalizeTreeEditorNodes(nodes: any, childrenField: string = 'children') {
  if (!Array.isArray(nodes)) return []

  return nodes.map((node) => {
    if (!node || typeof node !== 'object') return node

    const sourceChildren = Array.isArray(node[childrenField])
      ? node[childrenField]
      : Array.isArray(node.children)
        ? node.children
        : undefined

    const normalized = { ...node }
    if (sourceChildren) {
      const children = normalizeTreeEditorNodes(sourceChildren, childrenField)
      normalized.children = children
      if (childrenField !== 'children') {
        normalized[childrenField] = children
      }
    }

    return normalized
  })
}

export function applyTreeEditorNodeGuards(
  nodes: any[],
  options: {
    data: any
    childrenField?: string
    creatableOn?: any
    editableOn?: any
    removableOn?: any
  }
) {
  const childrenField = options.childrenField || 'children'
  if (!options.creatableOn && !options.editableOn && !options.removableOn) {
    return nodes
  }

  return nodes.map((node) => {
    if (!node || typeof node !== 'object') return node

    const data = createObject(options.data, { item: node, node })
    let nextNode = node
    if (options.creatableOn !== undefined) {
      const creatable = resolveTreeEditorBoolean(options.creatableOn, data, true)
      if (node.creatable !== creatable) {
        nextNode = { ...nextNode, creatable }
      }
    }
    if (options.editableOn !== undefined) {
      const editable = resolveTreeEditorBoolean(options.editableOn, data, true)
      if (node.editable !== editable) {
        nextNode = { ...nextNode, editable }
      }
    }
    if (options.removableOn !== undefined) {
      const removable = resolveTreeEditorBoolean(options.removableOn, data, true)
      if (node.removable !== removable) {
        nextNode = { ...nextNode, removable }
      }
    }
    if (Array.isArray(nextNode[childrenField])) {
      const children = applyTreeEditorNodeGuards(nextNode[childrenField], options)
      if (children !== nextNode[childrenField]) {
        nextNode = setTreeEditorChildren(nextNode, children, childrenField)
      }
    }

    return nextNode
  })
}

export function setTreeEditorChildren(
  node: any,
  children: any[],
  childrenField = 'children'
) {
  return {
    ...node,
    children,
    ...(childrenField !== 'children' ? { [childrenField]: children } : {}),
  }
}

export function appendTreeEditorChild(node: any, child: any, childrenField = 'children') {
  return setTreeEditorChildren(
    node,
    [...getTreeEditorChildren(node, childrenField), child],
    childrenField
  )
}

export function resolveTreeEditorSelection(value: any, valueField = 'value') {
  if (Array.isArray(value)) {
    return value.map((item) =>
      item && typeof item === 'object' && item[valueField] !== undefined
        ? item[valueField]
        : item
    )
  }

  if (value && typeof value === 'object' && value[valueField] !== undefined) {
    return value[valueField]
  }

  return value
}

export function createTreeEditorCommandData(baseData: any, payload: any) {
  return createObject(baseData, {
    ...payload,
    event: payload,
  })
}

export function buildTreeEditorMovePayload(
  dropInfo: TreeEditorDropInfo,
  tree: any[],
  options: TreeEditorMoveOptions = {}
): TreeEditorMovePayload {
  const valueField = options.valueField || 'value'
  const childrenField = options.childrenField || 'children'
  const targetNode = dropInfo.targetNode || dropInfo.node
  const sourceLocation = findNodeLocation(
    tree,
    dropInfo.dragNode,
    childrenField,
    valueField
  )
  const targetLocation = findNodeLocation(tree, targetNode, childrenField, valueField)
  const dropMode = POSITION_TO_DROP_MODE[dropInfo.position]
  const targetParent = dropInfo.position === 'self' ? targetNode : targetLocation?.parent
  const targetParentId = targetParent ? targetParent[valueField] : null
  const targetIndex = getTargetIndex(
    dropInfo.position,
    targetNode,
    targetLocation,
    childrenField
  )

  return {
    ...dropInfo,
    targetNode,
    dropMode,
    sourceParentId: sourceLocation?.parent ? sourceLocation.parent[valueField] : null,
    targetParentId,
    sourceIndex: sourceLocation?.index ?? -1,
    targetIndex,
  }
}

/**
 * Apply a tree move without knowing anything about the business meaning of the move.
 * Command mode uses it for optimistic previews and local mode uses it as its
 * canonical immutable tree update.
 */
export function moveTreeEditorNodes(
  tree: any[],
  dropInfo: TreeEditorDropInfo,
  options: TreeEditorMoveOptions = {}
) {
  if (
    !Array.isArray(tree) ||
    !dropInfo?.dragNode ||
    !dropInfo?.node ||
    !POSITION_TO_DROP_MODE[dropInfo.position]
  ) {
    return tree
  }

  const valueField = options.valueField || 'value'
  const childrenField = options.childrenField || 'children'
  const sourceLocation = findNodeLocation(
    tree,
    dropInfo.dragNode,
    childrenField,
    valueField
  )
  const targetNode = dropInfo.targetNode || dropInfo.node
  const targetLocation = findNodeLocation(tree, targetNode, childrenField, valueField)
  if (!sourceLocation || !targetLocation || sourceLocation.node === targetLocation.node) {
    return tree
  }

  const remaining = removeTreeNode(tree, sourceLocation.path, childrenField)
  const remainingTarget = findNodeLocation(
    remaining,
    targetNode,
    childrenField,
    valueField
  )
  if (!remainingTarget) return tree

  const movedNode = { ...sourceLocation.node }
  if (dropInfo.position === 'self') {
    const children = getTreeEditorChildren(remainingTarget.node, childrenField)
    return updateTreeNode(
      remaining,
      remainingTarget.path,
      (node) => setTreeEditorChildren(node, [...children, movedNode], childrenField),
      childrenField
    )
  }

  const parentPath = remainingTarget.path.slice(0, -1)
  const targetIndex = remainingTarget.path[remainingTarget.path.length - 1]
  const insertIndex = targetIndex + (dropInfo.position === 'bottom' ? 1 : 0)
  return insertTreeNode(remaining, parentPath, insertIndex, movedNode, childrenField)
}

export function isTreeEditorNodeDraggable(node: any, draggableOn: any, data: any) {
  return isTreeEditorNodeAllowed(node, draggableOn, data)
}

export function isTreeEditorNodeAllowed(node: any, guard: any, data: any) {
  if (guard === undefined) return true
  return resolveTreeEditorBoolean(guard, createObject(data, { item: node, node }), true)
}

export function isTreeEditorDescendant(
  tree: any[],
  ancestor: any,
  target: any,
  childrenField = 'children',
  valueField = 'value'
) {
  const ancestorLocation = findNodeLocation(tree, ancestor, childrenField, valueField)
  if (!ancestorLocation) return false

  return Boolean(
    findNodeLocation(
      ancestorLocation.node?.[childrenField],
      target,
      childrenField,
      valueField,
      ancestorLocation.node
    )
  )
}

function findNodeLocation(
  nodes: any[],
  target: any,
  childrenField: string,
  valueField: string,
  parent: any = null,
  parentPath: number[] = []
): NodeLocation | null {
  if (!Array.isArray(nodes)) return null

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (isSameTreeEditorNode(node, target, valueField)) {
      return { node, parent, index, path: [...parentPath, index] }
    }

    const childLocation = findNodeLocation(
      node?.[childrenField],
      target,
      childrenField,
      valueField,
      node,
      [...parentPath, index]
    )
    if (childLocation) return childLocation
  }

  return null
}

function getTreeEditorChildren(node: any, childrenField: string) {
  return Array.isArray(node?.[childrenField])
    ? node[childrenField]
    : Array.isArray(node?.children)
      ? node.children
      : []
}

function updateTreeNode(
  nodes: any[],
  path: number[],
  updater: (node: any) => any,
  childrenField: string
): any[] {
  if (!path.length) return nodes

  const [index, ...rest] = path
  if (index < 0 || index >= nodes.length) return nodes

  const node = nodes[index]
  const updated = rest.length
    ? setTreeEditorChildren(
        node,
        updateTreeNode(
          getTreeEditorChildren(node, childrenField),
          rest,
          updater,
          childrenField
        ),
        childrenField
      )
    : updater(node)
  return nodes.map((item, itemIndex) => (itemIndex === index ? updated : item))
}

function removeTreeNode(nodes: any[], path: number[], childrenField: string): any[] {
  if (!path.length) return nodes

  const [index, ...rest] = path
  if (index < 0 || index >= nodes.length) return nodes
  if (!rest.length) return nodes.filter((_item, itemIndex) => itemIndex !== index)

  const node = nodes[index]
  const updated = setTreeEditorChildren(
    node,
    removeTreeNode(getTreeEditorChildren(node, childrenField), rest, childrenField),
    childrenField
  )
  return nodes.map((item, itemIndex) => (itemIndex === index ? updated : item))
}

function insertTreeNode(
  nodes: any[],
  parentPath: number[],
  index: number,
  node: any,
  childrenField: string
): any[] {
  if (!parentPath.length) {
    const next = [...nodes]
    next.splice(Math.max(0, Math.min(index, next.length)), 0, node)
    return next
  }

  return updateTreeNode(
    nodes,
    parentPath,
    (parent) => {
      const children = [...getTreeEditorChildren(parent, childrenField)]
      children.splice(Math.max(0, Math.min(index, children.length)), 0, node)
      return setTreeEditorChildren(parent, children, childrenField)
    },
    childrenField
  )
}

function isSameTreeEditorNode(node: any, target: any, valueField: string) {
  if (node === target) return true
  if (!node || !target) return false

  const nodeValue = node[valueField]
  const targetValue = target[valueField]
  return nodeValue !== undefined && targetValue !== undefined && nodeValue === targetValue
}

function getTargetIndex(
  position: TreeDropPosition,
  targetNode: any,
  targetLocation: NodeLocation | null,
  childrenField: string
) {
  if (position === 'self') {
    return Array.isArray(targetNode?.[childrenField])
      ? targetNode[childrenField].length
      : 0
  }

  if (!targetLocation) return -1
  return position === 'bottom' ? targetLocation.index + 1 : targetLocation.index
}
