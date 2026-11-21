const assert = require('node:assert/strict')
const path = require('node:path')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadModule() {
  clearMirroredSrcModuleCache(__filename, 'business-model-graph')
  return requireMirroredSrcModule(__filename, './business-model-graph.ts')
}

test('business model graph normalizes the API envelope and ignores incomplete relations', () => {
  const { normalizeBusinessModelGraphPayload } = loadModule()
  const graph = normalizeBusinessModelGraphPayload({
    data: {
      status: 0,
      data: {
        nodes: [{ fullName: 'crm.order', title: '订单' }],
        edges: [
          { source: 'crm.order', target: 'crm.customer', title: '客户' },
          { source: 'crm.order' },
        ],
      },
    },
  })

  assert.equal(graph.nodes.length, 1)
  assert.equal(graph.edges.length, 1)
  assert.equal(graph.edges[0].target, 'crm.customer')
})

test('business model graph layout gives every model a stable non-overlapping grid position', () => {
  const { layoutBusinessModelGraph, NODE_WIDTH, NODE_HEIGHT } = loadModule()
  const graph = {
    nodes: [
      { fullName: 'crm.order' },
      { fullName: 'crm.customer' },
      { fullName: 'sys.user' },
    ],
    edges: [],
  }

  const layout = layoutBusinessModelGraph(graph)

  assert.equal(layout.points.length, 3)
  assert.deepEqual(layout, layoutBusinessModelGraph(graph))
  for (const [index, node] of layout.points.entries()) {
    for (const other of layout.points.slice(index + 1)) {
      assert.ok(
        node.x + NODE_WIDTH <= other.x ||
          other.x + NODE_WIDTH <= node.x ||
          node.y + NODE_HEIGHT <= other.y ||
          other.y + NODE_HEIGHT <= node.y
      )
    }
  }
  assert.ok(layout.width >= Math.max(...layout.points.map((node) => node.x + NODE_WIDTH)))
  assert.ok(
    layout.height >= Math.max(...layout.points.map((node) => node.y + NODE_HEIGHT))
  )
})

const fixture = {
  nodes: [
    { fullName: 'trade.sales.Order', namespace: 'trade.sales', title: '订单' },
    { fullName: 'trade.sales.Item', namespace: 'trade.sales', title: '明细' },
    { fullName: 'trade.finance.Payment', namespace: 'trade.finance', title: '收款' },
    { fullName: 'catalog.Product', namespace: 'catalog', title: '商品' },
  ],
  edges: [
    { source: 'trade.sales.Order', target: 'trade.sales.Item', type: 'child' },
    { source: 'trade.sales.Item', target: 'catalog.Product', type: 'reference' },
    {
      source: 'catalog.Product',
      target: 'catalog.Product',
      name: 'alternative',
      type: 'reference',
    },
    { source: 'trade.finance.Payment', target: 'removed.Model', type: 'reference' },
  ],
}
const modules = [
  {
    fullName: 'trade',
    title: '交易业务',
    children: [
      { fullName: 'trade.sales', title: '销售管理' },
      { fullName: 'trade.finance', title: '财务管理' },
    ],
  },
]

test('nested groups contain their nodes and group dragging preserves relative positions', () => {
  const {
    createModelCanvas,
    moveCanvasGroup,
    canvasGroupsOverlap,
    NODE_HEIGHT,
    NODE_WIDTH,
  } = loadModule()
  const canvas = createModelCanvas(fixture, modules),
    layout = canvas.groupedLayout
  assert.equal(layout.groups.trade.title, '交易业务')
  assert.equal(layout.groups['trade.sales'].parent, 'trade')
  for (const node of fixture.nodes) {
    const point = layout.nodes[node.fullName],
      group = layout.groups[node.namespace]
    assert.ok(point.x >= group.x && point.y >= group.y)
    assert.ok(point.x + NODE_WIDTH <= group.x + group.width)
    assert.ok(point.y + NODE_HEIGHT <= group.y + group.height)
  }
  assert.equal(canvasGroupsOverlap(canvas), false)
  const moved = moveCanvasGroup(canvas, 'trade', { x: 120, y: 70 }, fixture.nodes)
  assert.equal(
    moved.groupedLayout.nodes['trade.sales.Order'].x,
    layout.nodes['trade.sales.Order'].x + 120
  )
  assert.equal(
    moved.groupedLayout.groups['trade.sales'].y,
    layout.groups['trade.sales'].y + 70
  )
  assert.deepEqual(
    moved.groupedLayout.nodes['catalog.Product'],
    layout.nodes['catalog.Product']
  )
})

test('grouped node dragging clamps to a fixed module while free coordinates survive mode changes', () => {
  const { createModelCanvas, moveCanvasNode, NODE_WIDTH, NODE_HEIGHT } = loadModule()
  const canvas = createModelCanvas(fixture, modules),
    group = canvas.groupedLayout.groups['trade.sales']
  const constrained = moveCanvasNode(canvas, fixture.nodes[0], { x: 9999, y: -9999 })
  assert.deepEqual(constrained.groupedLayout.groups, canvas.groupedLayout.groups)
  const point = constrained.groupedLayout.nodes[fixture.nodes[0].fullName]
  assert.ok(point.x + NODE_WIDTH <= group.x + group.width)
  assert.ok(point.y >= group.y && point.y + NODE_HEIGHT <= group.y + group.height)
  const free = moveCanvasNode({ ...constrained, grouped: false }, fixture.nodes[0], {
    x: 9000,
    y: -2000,
  })
  assert.deepEqual(free.freeLayout.nodes[fixture.nodes[0].fullName], {
    x: 9000,
    y: -2000,
  })
  assert.deepEqual(free.groupedLayout, constrained.groupedLayout)
  assert.deepEqual(
    canvas.freeLayout.nodes[fixture.nodes[0].fullName],
    constrained.freeLayout.nodes[fixture.nodes[0].fullName]
  )
})

test('slice membership limits displayed edges and retains positions for unavailable models', () => {
  const { createModelCanvas, syncModelCanvas, canvasModels, canvasRelations } =
    loadModule()
  let slice = createModelCanvas(fixture, modules, 'slice-1', '订单分析')
  assert.equal(canvasModels(fixture, slice).length, 0)
  slice = syncModelCanvas(
    { ...slice, modelIds: ['trade.sales.Order', 'trade.sales.Item', 'removed.Model'] },
    fixture,
    modules
  )
  assert.equal(canvasModels(fixture, slice).length, 2)
  assert.equal(canvasRelations(fixture, slice).length, 1)
  const freePosition = { x: 789, y: 456 }
  slice.freeLayout.nodes['trade.sales.Order'] = freePosition
  const restored = syncModelCanvas(JSON.parse(JSON.stringify(slice)), fixture, modules)
  assert.deepEqual(restored.freeLayout.nodes['trade.sales.Order'], freePosition)
  assert.ok(restored.modelIds.includes('removed.Model'))
  const removed = syncModelCanvas(
    { ...restored, modelIds: ['trade.sales.Order'] },
    fixture,
    modules
  )
  assert.equal(canvasRelations(fixture, removed).length, 0)
  const readded = syncModelCanvas(
    { ...removed, modelIds: [...removed.modelIds, 'trade.sales.Item'] },
    fixture,
    modules
  )
  assert.equal(canvasRelations(fixture, readded).length, 1)
})

test('module filtering follows the list exact-namespace rule and failed API envelopes propagate', () => {
  const { modelMatchesModule, readGraphApiData, normalizeBusinessModelGraphPayload } =
    loadModule()
  assert.equal(modelMatchesModule(fixture.nodes[0], 'trade.sales'), true)
  assert.equal(modelMatchesModule(fixture.nodes[0], 'trade'), false)
  assert.equal(modelMatchesModule(fixture.nodes[0], ''), true)
  assert.throws(
    () => readGraphApiData({ status: -1, msg: '画布版本冲突' }),
    /画布版本冲突/
  )
  assert.throws(() => readGraphApiData({ ok: false, msg: '锁定失败' }), /锁定失败/)
  assert.throws(() => normalizeBusinessModelGraphPayload(null), /无效/)
})

test('self and parallel relations have visible distinct geometry at node boundaries', () => {
  const { createModelCanvas, graphEdgeGeometry } = loadModule()
  const canvas = createModelCanvas(fixture, modules)
  const self = graphEdgeGeometry(fixture.edges[2], canvas.groupedLayout),
    product = canvas.groupedLayout.nodes['catalog.Product']
  assert.ok(self.y < product.y)
  assert.ok(self.path.startsWith(`M ${product.x + 40} ${product.y}`))
  assert.notEqual(
    graphEdgeGeometry(fixture.edges[0], canvas.groupedLayout, 0).path,
    graphEdgeGeometry(fixture.edges[0], canvas.groupedLayout, 1).path
  )
  assert.equal(graphEdgeGeometry(fixture.edges[3], canvas.groupedLayout), null)
})

test('platform code envelopes reject errors and grouped self loops keep clearance under module headers', () => {
  const { readGraphApiData, createModelCanvas, moveCanvasNode, graphEdgeGeometry } =
    loadModule()
  assert.throws(
    () => readGraphApiData({ data: { code: -1, msg: '保存失败' } }),
    /保存失败/
  )
  assert.deepEqual(readGraphApiData({ data: { code: 0, data: { nodes: [] } } }), {
    nodes: [],
  })
  const canvas = createModelCanvas(fixture, modules)
  const moved = moveCanvasNode(canvas, fixture.nodes[3], { x: -9999, y: -9999 }, 1)
  const self = graphEdgeGeometry(fixture.edges[2], moved.groupedLayout)
  const frame = moved.groupedLayout.groups.catalog
  assert.ok(self.y > frame.y + 40)
})

test('module growth gives new models positions in both layouts even when grouping must be recomputed', () => {
  const { createModelCanvas, syncModelCanvas, canvasModels, canvasGroupsOverlap } =
    loadModule()
  const canvas = createModelCanvas(fixture, modules)
  const expanded = {
    ...fixture,
    nodes: [
      ...fixture.nodes,
      ...Array.from({ length: 6 }, (_, index) => ({
        fullName: `trade.sales.Added${index}`,
        namespace: 'trade.sales',
      })),
    ],
  }
  const synced = syncModelCanvas({ ...canvas, grouped: false }, expanded, modules)
  for (const node of canvasModels(expanded, synced)) {
    assert.ok(synced.freeLayout.nodes[node.fullName])
    assert.ok(synced.groupedLayout.nodes[node.fullName])
  }
  assert.equal(canvasGroupsOverlap({ ...synced, grouped: true }), false)
})
