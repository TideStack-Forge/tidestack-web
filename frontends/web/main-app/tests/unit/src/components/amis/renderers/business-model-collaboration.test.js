import { expect, test } from 'vitest'
import { YjsWorkspace } from 'ouroboros-amis-runtime/collaboration/YjsWorkspace'
import { canvasDocumentCodec } from 'ouroboros-amis-runtime/renderers/business-model-collaboration'
import { createModelCanvas } from 'ouroboros-amis-runtime/renderers/business-model-graph'
import { Room } from './helpers/collaborationRoom'

const graph = {
  nodes: [{ fullName: 'sales.Order' }, { fullName: 'sales.Item' }],
  edges: [],
}
const seed = () => ({ ...createModelCanvas(graph, []), grouped: false })
const settled = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve()
}

function client(room, writable = true) {
  const changes = [],
    statuses = [],
    transport = room.transport(writable)
  const workspace = new YjsWorkspace(
    transport,
    canvasDocumentCodec,
    (canvas) => changes.push(canvas),
    (...status) => statuses.push(status)
  )
  return { workspace, changes, statuses, transport, current: () => changes.at(-1) }
}

test('independent concurrent node edits converge after reversed delivery and duplicate snapshots', async () => {
  const room = new Room(),
    a = client(room),
    b = client(room)
  await a.workspace.start()
  await a.workspace.create('overview', seed())
  await b.workspace.start()
  await settled()
  room.paused = true
  const first = a.current(),
    second = b.current()
  a.workspace.change('overview', first, {
    ...first,
    freeLayout: {
      ...first.freeLayout,
      nodes: { ...first.freeLayout.nodes, 'sales.Order': { x: 400, y: 200 } },
    },
  })
  b.workspace.change('overview', second, {
    ...second,
    freeLayout: {
      ...second.freeLayout,
      nodes: { ...second.freeLayout.nodes, 'sales.Item': { x: 600, y: 300 } },
    },
  })
  room.paused = false
  room.queue.reverse().forEach((apply) => apply())
  await settled()
  expect(a.current().freeLayout.nodes).toEqual(b.current().freeLayout.nodes)
  expect(a.current().freeLayout.nodes['sales.Order']).toEqual({ x: 400, y: 200 })
  expect(a.current().freeLayout.nodes['sales.Item']).toEqual({ x: 600, y: 300 })
  for (const listener of room.listeners)
    listener({ kind: 'document', document: room.documents.get('overview') })
  await settled()
  expect(a.current().freeLayout.nodes).toEqual(b.current().freeLayout.nodes)
  expect(a.workspace.pending + b.workspace.pending).toBe(0)
  a.workspace.destroy()
  b.workspace.destroy()
})

test('same-node concurrency keeps x and y atomic, and a multi-node operation never exposes a partial group move', async () => {
  const room = new Room(),
    a = client(room),
    b = client(room)
  await a.workspace.start()
  await a.workspace.create('overview', seed())
  await b.workspace.start()
  await settled()
  room.paused = true
  for (const [connection, position] of [
    [a, 100],
    [b, 900],
  ]) {
    const before = connection.current()
    connection.workspace.change('overview', before, {
      ...before,
      freeLayout: {
        ...before.freeLayout,
        nodes: {
          'sales.Order': { x: position, y: position },
          'sales.Item': { x: position + 40, y: position + 40 },
        },
      },
    })
  }
  room.paused = false
  room.queue.forEach((apply) => apply())
  await settled()
  expect(a.current().freeLayout.nodes).toEqual(b.current().freeLayout.nodes)
  for (const value of [...a.changes, ...b.changes].slice(4)) {
    const order = value.freeLayout.nodes['sales.Order'],
      item = value.freeLayout.nodes['sales.Item']
    if ([100, 900].includes(order.x)) {
      expect(order.x).toBe(order.y)
      expect(item.x - order.x).toBe(40)
    }
  }
  a.workspace.destroy()
  b.workspace.destroy()
})

test('failed writes remain pending, retry restores them, and a read-only client reconciles missed events', async () => {
  const room = new Room(),
    a = client(room),
    viewer = client(room, false)
  await a.workspace.start()
  await a.workspace.create('overview', seed())
  await viewer.workspace.start()
  await settled()
  viewer.transport.mute()
  room.fail = true
  const before = a.current()
  a.workspace.change('overview', before, { ...before, title: '订单分析' })
  await settled()
  expect(a.workspace.pending).toBe(1)
  expect(a.statuses.at(-1)[2]).toContain('connection unavailable')
  room.fail = false
  await a.workspace.retry()
  await viewer.workspace.refresh()
  expect(a.workspace.pending).toBe(0)
  expect(viewer.current().title).toBe('订单分析')
  expect(() =>
    viewer.workspace.change('overview', viewer.current(), {
      ...viewer.current(),
      title: '越权修改',
    })
  ).toThrow('编辑权限')
  expect(
    room.requests.filter((request) => request.path.endsWith('/updates'))
  ).toHaveLength(2)
  a.workspace.destroy()
  viewer.workspace.destroy()
})

test('each durable checkpoint includes only acknowledged operations and the current queue head', async () => {
  const room = new Room(),
    editor = client(room)
  await editor.workspace.start()
  await editor.workspace.create('overview', seed())
  await settled()
  room.paused = true
  for (const title of ['第一步', '第二步', '第三步']) {
    const before = editor.current()
    editor.workspace.change('overview', before, { ...before, title })
  }
  expect(editor.current().title).toBe('第三步')
  expect(editor.workspace.pending).toBe(3)
  room.queue.shift()()
  await settled()
  room.queue.shift()()
  await settled()
  expect(editor.workspace.pending).toBe(1)
  const viewer = client(room, false)
  await viewer.workspace.start()
  expect(viewer.current().title).toBe('第二步')
  expect(editor.current().title).toBe('第三步')
  room.queue.shift()()
  await settled()
  expect(viewer.current().title).toBe('第三步')
  expect(editor.workspace.pending).toBe(0)
  editor.workspace.destroy()
  viewer.workspace.destroy()
})

test('legacy documents initialize once, newly created slices reach all viewers, and viewport changes stay local', async () => {
  const room = new Room(),
    initial = seed()
  room.documents.set('overview', {
    id: 'overview',
    revision: 0,
    seed: JSON.stringify(initial),
    checkpoint: null,
    updates: [],
  })
  const a = client(room),
    b = client(room)
  await Promise.all([a.workspace.start(), b.workspace.start()])
  await settled()
  expect(a.current().freeLayout).toEqual(b.current().freeLayout)
  const before = a.current(),
    requests = room.requests.length
  a.workspace.change('overview', before, {
    ...before,
    grouped: true,
    freeLayout: { ...before.freeLayout, viewport: { zoom: 2, offset: { x: 50, y: 50 } } },
  })
  await settled()
  expect(room.requests.length).toBe(requests)
  await a.workspace.create('orders', {
    ...initial,
    id: 'orders',
    allModels: false,
    title: '订单切面',
  })
  await settled()
  expect(b.current().id).toBe('orders')
  a.workspace.destroy()
  b.workspace.destroy()
  expect(room.listeners.size).toBe(0)
})

test('reconnect bootstrap replays pending operations, and HTTP success alone cannot hide a disconnected transport', async () => {
  const room = new Room(),
    a = client(room)
  await a.workspace.start()
  await a.workspace.create('overview', seed())
  await settled()
  room.fail = true
  a.workspace.change('overview', a.current(), { ...a.current(), title: '离线前的修改' })
  await settled()
  a.transport.disconnect()
  room.fail = false
  await a.workspace.refresh()
  expect(a.workspace.pending).toBe(1)
  expect(a.statuses.at(-1)[1]).toBe(false)
  expect(a.statuses.at(-1)[2]).toBe('disconnected')
  a.transport.reconnect()
  await settled()
  expect(a.workspace.pending).toBe(0)
  expect(a.current().title).toBe('离线前的修改')
  expect(a.statuses.at(-1)[1]).toBe(true)
  a.workspace.destroy()
})
