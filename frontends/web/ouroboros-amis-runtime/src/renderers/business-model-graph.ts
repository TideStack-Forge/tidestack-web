export type Point = { x: number; y: number }
export type GraphGroup = Point & {
  width: number
  height: number
  title: string
  parent: string | null
}
export type GraphViewport = { zoom: number; offset: Point }
export type GraphLayout = {
  nodes: Record<string, Point>
  groups: Record<string, GraphGroup>
  viewport?: GraphViewport | null
}
export type BusinessModelCanvas = {
  id: string
  title: string
  allModels: boolean
  grouped: boolean
  modelIds: string[]
  freeLayout: GraphLayout
  groupedLayout: GraphLayout
  revision: string
}
export interface BusinessModelGraphNode {
  fullName: string
  namespace?: string
  name?: string
  title?: string
  description?: string
  fieldsCount?: number
  lockUser?: string
  lockUserName?: string
}
export interface BusinessModelGraphEdge {
  source: string
  target: string
  name?: string
  title?: string
  type?: string
}
export type BusinessModelGraphData = {
  nodes: BusinessModelGraphNode[]
  edges: BusinessModelGraphEdge[]
}
export type BusinessModelGraphPoint = BusinessModelGraphNode & Point
export type ModelModule = {
  fullName: string
  title?: string
  parentName?: string
  children?: ModelModule[]
}
export const NODE_WIDTH = 180
export const NODE_HEIGHT = 82
const PADDING = 20
const HEADER = 40
const GAP = 36

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
export function readGraphApiData(payload: unknown): unknown {
  if (!object(payload)) throw new Error('服务返回了无效数据')
  const envelope =
    object(payload.data) && ('status' in payload.data || 'code' in payload.data)
      ? payload.data
      : payload
  if (
    envelope.ok === false ||
    (typeof envelope.status === 'number' && envelope.status !== 0) ||
    (typeof envelope.code === 'number' && envelope.code !== 0)
  ) {
    throw new Error(typeof envelope.msg === 'string' ? envelope.msg : '业务模型请求失败')
  }
  return envelope.data ?? envelope
}
export function normalizeBusinessModelGraphPayload(
  payload: unknown
): BusinessModelGraphData {
  const graph = readGraphApiData(payload)
  if (!object(graph)) throw new Error('业务模型关系数据无效')
  return {
    nodes: Array.isArray(graph.nodes)
      ? graph.nodes.filter(
          (node): node is BusinessModelGraphNode =>
            object(node) && typeof node.fullName === 'string' && !!node.fullName
        )
      : [],
    edges: Array.isArray(graph.edges)
      ? graph.edges.filter(
          (edge): edge is BusinessModelGraphEdge =>
            object(edge) &&
            typeof edge.source === 'string' &&
            typeof edge.target === 'string' &&
            !!edge.source &&
            !!edge.target
        )
      : [],
  }
}
export function modelNamespace(model: BusinessModelGraphNode) {
  return (
    model.namespace ??
    model.fullName.slice(0, Math.max(0, model.fullName.lastIndexOf('.')))
  )
}
export function modelMatchesModule(model: BusinessModelGraphNode, module: string) {
  // The existing list filters by the model's exact namespace.
  return !module || modelNamespace(model) === module
}
export function canvasModels(graph: BusinessModelGraphData, canvas: BusinessModelCanvas) {
  const ids = new Set(canvas.modelIds)
  return graph.nodes.filter((node) => canvas.allModels || ids.has(node.fullName))
}
export function canvasRelations(
  graph: BusinessModelGraphData,
  canvas: BusinessModelCanvas
) {
  const ids = new Set(canvasModels(graph, canvas).map((node) => node.fullName))
  return graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
}
export function layoutBusinessModelGraph(graph: BusinessModelGraphData) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(graph.nodes.length)))
  const points = graph.nodes.map((node, index) => ({
    ...node,
    x: 32 + (index % columns) * (NODE_WIDTH + GAP),
    y: 80 + Math.floor(index / columns) * (NODE_HEIGHT + 90),
  }))
  return {
    points,
    width: Math.max(440, columns * (NODE_WIDTH + GAP)),
    height: Math.max(280, Math.ceil(points.length / columns) * (NODE_HEIGHT + 90)),
  }
}
function groupedLayout(
  nodes: BusinessModelGraphNode[],
  modules: ModelModule[],
  edges: BusinessModelGraphEdge[]
): GraphLayout {
  const titles = new Map<string, string>()
  function visit(branches: ModelModule[]) {
    for (const branch of branches) {
      titles.set(branch.fullName, branch.title || branch.fullName)
      visit(branch.children || [])
    }
  }
  visit(modules)
  const groups: Record<string, GraphGroup> = {}
  const positions: Record<string, Point> = {}
  for (const node of nodes) {
    const namespace = modelNamespace(node) || '__unassigned__'
    const parts = namespace.split('.')
    parts.forEach((_, index) => {
      const id = parts.slice(0, index + 1).join('.')
      groups[id] = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        title: titles.get(id) || (id === '__unassigned__' ? '未分组' : parts[index]),
        parent: index ? parts.slice(0, index).join('.') : null,
      }
    })
  }
  function shift(id: string, x: number, y: number) {
    const group = groups[id]
    group.x += x
    group.y += y
    for (const node of nodes.filter(
      (node) => (modelNamespace(node) || '__unassigned__') === id
    )) {
      positions[node.fullName].x += x
      positions[node.fullName].y += y
    }
    Object.keys(groups)
      .filter((child) => groups[child].parent === id)
      .forEach((child) => shift(child, x, y))
  }
  function arrange(ids: string[], startY: number) {
    const columns = Math.max(1, Math.ceil(Math.sqrt(ids.length)))
    let x = PADDING,
      y = startY,
      rowHeight = 0,
      width = 0
    ids.forEach((id, index) => {
      if (index && index % columns === 0) {
        x = PADDING
        y += rowHeight + GAP
        rowHeight = 0
      }
      shift(id, x, y)
      x += groups[id].width + GAP
      rowHeight = Math.max(rowHeight, groups[id].height)
      width = Math.max(width, x - GAP + PADDING)
    })
    return { width, height: y + rowHeight + PADDING }
  }
  function size(id: string) {
    const direct = nodes.filter(
      (node) => (modelNamespace(node) || '__unassigned__') === id
    )
    const selfRelations = Math.max(
      0,
      ...direct.map(
        (node) =>
          edges.filter(
            (edge) => edge.source === node.fullName && edge.target === node.fullName
          ).length
      )
    )
    const headroom = selfRelations * 48
    const columns = Math.max(1, Math.ceil(Math.sqrt(direct.length)))
    direct.forEach((node, index) => {
      positions[node.fullName] = {
        x: PADDING + (index % columns) * (NODE_WIDTH + GAP),
        y:
          HEADER + PADDING + headroom + Math.floor(index / columns) * (NODE_HEIGHT + GAP),
      }
    })
    let width = direct.length ? columns * (NODE_WIDTH + GAP) - GAP + PADDING * 2 : 0
    let height =
      HEADER +
      PADDING +
      headroom +
      Math.ceil(direct.length / columns) * (NODE_HEIGHT + GAP)
    const children = Object.keys(groups).filter((child) => groups[child].parent === id)
    children.forEach(size)
    if (children.length) {
      const bounds = arrange(children, height)
      width = Math.max(width, bounds.width)
      height = bounds.height
    }
    groups[id].width = Math.max(NODE_WIDTH + PADDING * 2, width)
    groups[id].height = Math.max(NODE_HEIGHT + HEADER + PADDING * 2, height)
  }
  const roots = Object.keys(groups).filter((id) => !groups[id].parent)
  roots.forEach(size)
  arrange(roots, PADDING)
  return { nodes: positions, groups }
}
export function createModelCanvas(
  graph: BusinessModelGraphData,
  modules: ModelModule[],
  id = 'overview',
  title = '全局总览'
): BusinessModelCanvas {
  return {
    id,
    title,
    allModels: id === 'overview',
    grouped: id === 'overview',
    modelIds: [],
    revision: '',
    freeLayout: {
      nodes: Object.fromEntries(
        layoutBusinessModelGraph(graph).points.map((node) => [
          node.fullName,
          { x: node.x, y: node.y },
        ])
      ),
      groups: {},
    },
    groupedLayout: groupedLayout(
      id === 'overview' ? graph.nodes : [],
      modules,
      graph.edges
    ),
  }
}
export function syncModelCanvas(
  canvas: BusinessModelCanvas,
  graph: BusinessModelGraphData,
  modules: ModelModule[]
): BusinessModelCanvas {
  const nodes = canvasModels(graph, canvas)
  const generated = groupedLayout(nodes, modules, graph.edges)
  const initialGroups = Object.fromEntries(
    Object.entries(generated.groups).map(([id, group]) => [id, { ...group }])
  )
  const previous = canvas.groupedLayout
  const freeLayout = {
    ...canvas.freeLayout,
    nodes: {
      ...Object.fromEntries(
        layoutBusinessModelGraph(graph).points.map((node) => [
          node.fullName,
          { x: node.x, y: node.y },
        ])
      ),
      ...canvas.freeLayout.nodes,
    },
  }
  for (const [id, group] of Object.entries(generated.groups)) {
    const saved = previous.groups[id]
    if (!saved || saved.parent !== group.parent) continue
    const dx = saved.x - group.x,
      dy = saved.y - group.y
    group.x += dx
    group.y += dy
    group.width = Math.max(group.width, saved.width)
    group.height = Math.max(group.height, saved.height)
  }
  for (const node of nodes) {
    const id = modelNamespace(node) || '__unassigned__'
    const group = generated.groups[id]
    const saved = previous.nodes[node.fullName]
    const headroom =
      graph.edges.filter(
        (edge) => edge.source === node.fullName && edge.target === node.fullName
      ).length * 48
    if (saved)
      generated.nodes[node.fullName] = {
        x: clamp(
          saved.x,
          group.x + PADDING,
          group.x + group.width - NODE_WIDTH - PADDING
        ),
        y: clamp(
          saved.y,
          group.y + HEADER + PADDING + headroom,
          group.y + group.height - NODE_HEIGHT - PADDING
        ),
      }
    else {
      const point = generated.nodes[node.fullName]
      const originalGroup = initialGroups[id]
      generated.nodes[node.fullName] = {
        x: point.x + group.x - originalGroup.x,
        y: point.y + group.y - originalGroup.y,
      }
    }
  }
  // A changed tree is re-laid out if saved groups no longer fit their parents.
  const contains = (outer: GraphGroup, inner: GraphGroup) =>
    inner.x >= outer.x + PADDING &&
    inner.y >= outer.y + HEADER &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  if (
    Object.values(generated.groups).some(
      (group) => group.parent && !contains(generated.groups[group.parent], group)
    ) ||
    canvasGroupsOverlap({ ...canvas, grouped: true, groupedLayout: generated })
  ) {
    const fresh = groupedLayout(nodes, modules, graph.edges)
    return {
      ...canvas,
      freeLayout,
      groupedLayout: {
        ...fresh,
        nodes: { ...previous.nodes, ...fresh.nodes },
        viewport: previous.viewport,
      },
    }
  }
  return {
    ...canvas,
    freeLayout,
    groupedLayout: {
      ...generated,
      nodes: { ...previous.nodes, ...generated.nodes },
      viewport: previous.viewport,
    },
  }
}
export function activeCanvasLayout(canvas: BusinessModelCanvas) {
  return canvas.grouped ? canvas.groupedLayout : canvas.freeLayout
}
export function updateCanvasLayout(canvas: BusinessModelCanvas, layout: GraphLayout) {
  return {
    ...canvas,
    [canvas.grouped ? 'groupedLayout' : 'freeLayout']: layout,
  }
}
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
export function moveCanvasNode(
  canvas: BusinessModelCanvas,
  node: BusinessModelGraphNode,
  point: Point,
  selfRelations = 0
): BusinessModelCanvas {
  const layout = activeCanvasLayout(canvas)
  const group = layout.groups[modelNamespace(node) || '__unassigned__']
  const headroom = selfRelations * 48
  const position =
    canvas.grouped && group
      ? {
          x: clamp(
            point.x,
            group.x + PADDING,
            group.x + group.width - NODE_WIDTH - PADDING
          ),
          y: clamp(
            point.y,
            group.y + HEADER + PADDING + headroom,
            group.y + group.height - NODE_HEIGHT - PADDING
          ),
        }
      : point
  return updateCanvasLayout(canvas, {
    ...layout,
    nodes: { ...layout.nodes, [node.fullName]: position },
  })
}
export function moveCanvasGroup(
  canvas: BusinessModelCanvas,
  id: string,
  delta: Point,
  models: BusinessModelGraphNode[]
): BusinessModelCanvas {
  const layout = activeCanvasLayout(canvas)
  const group = layout.groups[id]
  if (!group) return canvas
  const parent = group.parent ? layout.groups[group.parent] : null
  const dx = parent
    ? clamp(
        delta.x,
        parent.x + PADDING - group.x,
        parent.x + parent.width - PADDING - group.width - group.x
      )
    : delta.x
  const dy = parent
    ? clamp(
        delta.y,
        parent.y + HEADER + PADDING - group.y,
        parent.y + parent.height - PADDING - group.height - group.y
      )
    : delta.y
  const inGroup = (name: string) => name === id || name.startsWith(id + '.')
  return updateCanvasLayout(canvas, {
    ...layout,
    groups: Object.fromEntries(
      Object.entries(layout.groups).map(([key, rect]) => [
        key,
        inGroup(key) ? { ...rect, x: rect.x + dx, y: rect.y + dy } : rect,
      ])
    ),
    nodes: Object.fromEntries(
      Object.entries(layout.nodes).map(([key, point]) => [
        key,
        models.some(
          (node) =>
            node.fullName === key && inGroup(modelNamespace(node) || '__unassigned__')
        )
          ? { x: point.x + dx, y: point.y + dy }
          : point,
      ])
    ),
  })
}
export function canvasGroupsOverlap(canvas: BusinessModelCanvas) {
  const groups = Object.values(activeCanvasLayout(canvas).groups)
  return groups.some((a, index) =>
    groups
      .slice(index + 1)
      .some(
        (b) =>
          a.parent === b.parent &&
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y
      )
  )
}
export function graphEdgeGeometry(
  edge: BusinessModelGraphEdge,
  layout: GraphLayout,
  lane = 0
) {
  const source = layout.nodes[edge.source],
    target = layout.nodes[edge.target]
  if (!source || !target) return null
  const sx = source.x + NODE_WIDTH / 2,
    sy = source.y + NODE_HEIGHT / 2
  const tx = target.x + NODE_WIDTH / 2,
    ty = target.y + NODE_HEIGHT / 2
  if (edge.source === edge.target) {
    const lift = 62 + lane * 24
    return {
      path: `M ${source.x + 40} ${source.y} C ${source.x + 40} ${source.y - lift}, ${source.x + 140} ${source.y - lift}, ${source.x + 140} ${source.y}`,
      x: sx,
      y: source.y - lift * 0.75 - 6,
    }
  }
  const horizontal = Math.abs(tx - sx) >= Math.abs(ty - sy)
  const bend = lane * 28
  if (horizontal) {
    const from = sx + (Math.sign(tx - sx) * NODE_WIDTH) / 2,
      to = tx - (Math.sign(tx - sx) * NODE_WIDTH) / 2
    return {
      path: `M ${from} ${sy} C ${(from + to) / 2} ${sy + bend}, ${(from + to) / 2} ${ty + bend}, ${to} ${ty}`,
      x: (from + to) / 2,
      y: (sy + ty) / 2 + bend * 0.75 - 10,
    }
  }
  const from = sy + (Math.sign(ty - sy) * NODE_HEIGHT) / 2,
    to = ty - (Math.sign(ty - sy) * NODE_HEIGHT) / 2
  return {
    path: `M ${sx} ${from} C ${sx + bend} ${(from + to) / 2}, ${tx + bend} ${(from + to) / 2}, ${tx} ${to}`,
    x: (sx + tx) / 2 + bend * 0.75 + 44,
    y: (from + to) / 2,
  }
}
