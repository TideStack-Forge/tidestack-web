/* @vitest-environment jsdom */

const assert = require('node:assert/strict')
const path = require('node:path')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadTreeEditorCommandModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './treeEditorCommand.ts')
}

test('tree-editor builds a stable business move payload', () => {
  const { buildTreeEditorMovePayload } = loadTreeEditorCommandModule()
  const parent = {
    id: 'parent',
    children: [{ id: 'target' }, { id: 'source' }],
  }
  const tree = [parent, { id: 'outside' }]

  const payload = buildTreeEditorMovePayload(
    {
      dragNode: { id: 'source' },
      node: { id: 'target' },
      position: 'bottom',
    },
    tree,
    { valueField: 'id' }
  )

  assert.equal(payload.dropMode, 'AFTER')
  assert.equal(payload.sourceParentId, 'parent')
  assert.equal(payload.targetParentId, 'parent')
  assert.equal(payload.sourceIndex, 1)
  assert.equal(payload.targetIndex, 1)
  assert.equal(payload.targetNode.id, 'target')
})

test('tree-editor reports inner drops against the target node', () => {
  const { buildTreeEditorMovePayload } = loadTreeEditorCommandModule()
  const tree = [{ id: 'source' }, { id: 'target', children: [{ id: 'child' }] }]

  const payload = buildTreeEditorMovePayload(
    {
      dragNode: tree[0],
      node: tree[1],
      position: 'self',
    },
    tree,
    { valueField: 'id' }
  )

  assert.equal(payload.dropMode, 'INNER')
  assert.equal(payload.sourceParentId, null)
  assert.equal(payload.targetParentId, 'target')
  assert.equal(payload.sourceIndex, 0)
  assert.equal(payload.targetIndex, 1)
})

test('tree-editor applies all move positions through one immutable tree operation', () => {
  const { moveTreeEditorNodes } = loadTreeEditorCommandModule()
  const tree = [{ id: 'a' }, { id: 'b', nodes: [{ id: 'b-child' }] }, { id: 'c' }]

  const moved = moveTreeEditorNodes(
    tree,
    { dragNode: tree[0], node: tree[2], position: 'bottom' },
    { valueField: 'id', childrenField: 'nodes' }
  )

  assert.deepEqual(
    moved.map((node) => node.id),
    ['b', 'c', 'a']
  )
  assert.deepEqual(moved[0].nodes, tree[1].nodes)
  assert.deepEqual(
    tree.map((node) => node.id),
    ['a', 'b', 'c']
  )
})

test('tree-editor moves a node into a custom children field', () => {
  const { moveTreeEditorNodes } = loadTreeEditorCommandModule()
  const source = { id: 'source' }
  const target = { id: 'target', nodes: [] }

  const moved = moveTreeEditorNodes(
    [source, target],
    { dragNode: source, node: target, position: 'self' },
    { valueField: 'id', childrenField: 'nodes' }
  )

  assert.deepEqual(moved, [
    { id: 'target', nodes: [{ id: 'source' }], children: [{ id: 'source' }] },
  ])
})

test('tree-editor moves nodes across parents without mutating the source tree', () => {
  const { moveTreeEditorNodes } = loadTreeEditorCommandModule()
  const source = { id: 'source' }
  const target = { id: 'target' }
  const tree = [
    { id: 'source-parent', nodes: [source] },
    { id: 'target-parent', nodes: [target] },
  ]

  const moved = moveTreeEditorNodes(
    tree,
    { dragNode: source, node: target, position: 'top' },
    { valueField: 'id', childrenField: 'nodes' }
  )

  assert.deepEqual(moved[0].nodes, [])
  assert.deepEqual(
    moved[1].nodes.map((node) => node.id),
    ['source', 'target']
  )
  assert.deepEqual(tree[0].nodes, [source])
  assert.deepEqual(tree[1].nodes, [target])
})

test('tree-editor normalizes custom children fields for AMIS Tree rendering', () => {
  const { normalizeTreeEditorNodes } = loadTreeEditorCommandModule()

  const nodes = normalizeTreeEditorNodes(
    [
      {
        id: 'root',
        nodes: [{ id: 'child' }],
      },
    ],
    'nodes'
  )

  assert.deepEqual(nodes[0].children, [{ id: 'child' }])
  assert.deepEqual(nodes[0].nodes, [{ id: 'child' }])
})

test('tree-editor resolves node guards and command api adaptor aliases', () => {
  const { applyTreeEditorNodeGuards, normalizeTreeEditorApi, isTreeEditorNodeDraggable } =
    loadTreeEditorCommandModule()
  const source = [{ id: 'locked' }, { id: 'open' }]

  const guarded = applyTreeEditorNodeGuards(source, {
    data: {},
    removableOn: 'item.id === "open"',
  })

  assert.equal(guarded[0].removable, false)
  assert.equal(guarded[1].removable, true)
  assert.equal(
    isTreeEditorNodeDraggable({ canMove: false }, '${item.canMove}', {}),
    false
  )

  const adaptor = () => ({})
  assert.equal(
    normalizeTreeEditorApi({ url: '/api/tree', responseAdaptor: adaptor }).adaptor,
    adaptor
  )
})

test('tree-editor command data exposes both payload fields and event alias', () => {
  const { createTreeEditorCommandData } = loadTreeEditorCommandModule()
  const payload = { dropMode: 'BEFORE', targetNodeId: 'target' }
  const data = createTreeEditorCommandData({ tenantId: 'tenant-a' }, payload)

  assert.equal(data.tenantId, 'tenant-a')
  assert.equal(data.dropMode, 'BEFORE')
  assert.equal(data.event.dropMode, 'BEFORE')
  assert.equal(data.event.targetNodeId, 'target')
})

test('tree-editor builds command APIs with the command event context', () => {
  const { buildTreeEditorApi } = loadTreeEditorCommandModule()
  const api = buildTreeEditorApi(
    {
      method: 'post',
      url: '/api/nodes/${event.dragNode.id}/move',
      data: {
        dropMode: '${event.dropMode}',
      },
    },
    {
      event: {
        dragNode: { id: 'node-a' },
        dropMode: 'INNER',
      },
    }
  )

  assert.equal(api.url, '/api/nodes/node-a/move')
  assert.equal(api.data.dropMode, 'INNER')
})

test('tree-editor preserves literal sources and resolves variable sources', () => {
  const { resolveTreeEditorSource } = loadTreeEditorCommandModule()
  const data = { sourceUrl: '/api/resolved-tree' }

  assert.equal(resolveTreeEditorSource('/api/literal-tree', data), '/api/literal-tree')
  assert.equal(resolveTreeEditorSource('${sourceUrl}', data), '/api/resolved-tree')
})
