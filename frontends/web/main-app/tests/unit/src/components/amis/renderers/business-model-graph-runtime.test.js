// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest'
import React, { act } from 'react'
import { Room } from './helpers/collaborationRoom'
import Tabs from '#ouroboros-host/common/tabs'
let room
beforeEach(() => {
  room = new Room()
})
vi.mock('ouroboros-amis-runtime/collaboration/platformTransport', () => ({
  platformCollaborationTransport: () => room.transport(),
}))
vi.mock('#ouroboros-host/common/tabs', () => ({
  default: { beforeLeave: vi.fn(() => vi.fn()) },
}))
import { createRoot } from 'react-dom/client'
vi.mock('amis', async () => {
  const { createContext } = await import('react')
  const { randomUUID } = await import('node:crypto')
  return {
    uuidv4: randomUUID,
    ScopedContext: createContext({
      registerComponent: vi.fn(),
      unRegisterComponent: vi.fn(),
    }),
    Renderer: () => (component) => component,
    buildApi: (api) => (typeof api === 'string' ? { method: 'get', url: api } : api),
  }
})
import { BusinessModelGraph } from 'ouroboros-amis-runtime/renderers/BusinessModelGraph'
import { BusinessModelGraphCanvas } from 'ouroboros-amis-runtime/renderers/BusinessModelGraphCanvas'
import { createModelCanvas } from 'ouroboros-amis-runtime/renderers/business-model-graph'

const graph = {
  nodes: [
    { fullName: 'sales.Order', namespace: 'sales', title: '订单' },
    { fullName: 'finance.Payment', namespace: 'finance', title: '收款单' },
  ],
  edges: [{ source: 'finance.Payment', target: 'sales.Order', type: 'master' }],
}
const response = (data) => ({ ok: true, data })
function control(fetcher = vi.fn()) {
  const instance = new BusinessModelGraph({
    data: { appName: 'demo', userIdentity: 'me' },
    env: { fetcher },
    onAction: vi.fn().mockResolvedValue(true),
  })
  instance.setState = (patch, done) => {
    instance.state = {
      ...instance.state,
      ...(typeof patch === 'function' ? patch(instance.state) : patch),
    }
    done?.()
  }
  instance.state = {
    ...instance.state,
    graph,
    canvases: [createModelCanvas(graph, [])],
    loading: false,
  }
  return instance
}
function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test('editing opens the existing tab only after model locking succeeds', async () => {
  const fetcher = vi.fn().mockResolvedValue(response({})),
    instance = control(fetcher)
  await instance.editModel(graph.nodes[0])
  expect(fetcher).toHaveBeenCalledWith(
    expect.objectContaining({
      method: 'post',
      url: '/api/dev/demo/business-model/sales.Order/lock',
    })
  )
  expect(instance.props.onAction).toHaveBeenCalledWith(
    null,
    expect.objectContaining({
      actionType: 'openOrSwitchTab',
      args: expect.objectContaining({
        url: '/dev/demo/business-model/sales.Order',
        reloadOnReceive: true,
      }),
    }),
    instance.props.data
  )
  fetcher.mockResolvedValue({ ok: false, msg: '模型已被锁定' })
  instance.props.onAction.mockClear()
  await instance.editModel(graph.nodes[0])
  expect(instance.props.onAction).not.toHaveBeenCalled()
  expect(instance.state.error).toContain('模型已被锁定')
})

test('rendered graph selects nodes and disables editing for another developer lock', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div'),
    root = createRoot(container)
  const lockedGraph = {
    ...graph,
    nodes: [
      { ...graph.nodes[0], lockUser: 'another', lockUserName: '其他开发者' },
      graph.nodes[1],
    ],
  }
  const fetcher = vi.fn(({ url }) =>
    Promise.resolve(
      response(
        url.endsWith('/graph')
          ? lockedGraph
          : url.endsWith('/module-tree')
            ? { items: [] }
            : { items: [] }
      )
    )
  )
  await act(async () => {
    root.render(
      React.createElement(BusinessModelGraph, {
        data: { appName: 'demo', userIdentity: 'me' },
        env: { fetcher },
        onAction: vi.fn(),
      })
    )
  })
  const node = container.querySelector('[data-model="sales.Order"]')
  expect(node).not.toBeNull()
  await act(async () => {
    node.click()
  })
  expect(container.querySelector('[aria-label="模型或关系详情"]').textContent).toContain(
    '其他开发者 正在编辑'
  )
  expect(
    [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('模型正在被其他人编辑')
    ).disabled
  ).toBe(true)
  await act(async () => {
    root.unmount()
  })
})

const settled = async () => {
  for (let index = 0; index < 20; index++) await Promise.resolve()
}
const api = ({ url }) =>
  Promise.resolve(response(url.endsWith('/graph') ? graph : { items: [] }))

test('two graph controllers share atomic edits and newly created canvases through the collaboration workspace', async () => {
  const first = control(vi.fn(api)),
    second = control(vi.fn(api))
  await first.load()
  await second.load()
  await settled()
  const original = first.canvas()
  first.changeCanvas({ ...original, title: '共享总览' })
  await settled()
  expect(second.canvas().title).toBe('共享总览')
  first.state.newTitle = '订单分析'
  await first.createCanvas({ preventDefault() {} })
  await settled()
  const slice = first.canvas()
  expect(slice.allModels).toBe(false)
  expect(second.state.canvases.some((canvas) => canvas.id === slice.id)).toBe(true)
  first.addModel('sales.Order')
  await settled()
  expect(first.canvas().modelIds).toEqual(['sales.Order'])
  second.switchCanvas(slice.id)
  expect(second.canvas().modelIds).toEqual(['sales.Order'])
  first.removeModel('sales.Order')
  await settled()
  expect(second.canvas().modelIds).toEqual([])
  first.componentWillUnmount()
  second.componentWillUnmount()
})

test('pending operations survive a failed write, refresh and metadata reload until retry succeeds', async () => {
  const instance = control(vi.fn(api))
  await instance.load()
  room.fail = true
  instance.changeCanvas({ ...instance.canvas(), title: '待同步布局' })
  await settled()
  expect(instance.state.pending).toBe(1)
  await instance.reload()
  expect(instance.canvas().title).toBe('待同步布局')
  expect(instance.state.pending).toBe(1)
  room.fail = false
  await instance.workspace.refresh()
  await settled()
  expect(instance.state.pending).toBe(0)
  expect(instance.canvas().title).toBe('待同步布局')
  instance.componentWillUnmount()
})

test('stale load responses after unmount cannot recreate a collaborative session', async () => {
  const pending = deferred(),
    instance = control(vi.fn().mockReturnValue(pending.promise))
  const loading = instance.load()
  instance.componentWillUnmount()
  pending.resolve(response({ items: [] }))
  await loading
  expect(room.listeners.size).toBe(0)
})

test('dragging previews locally and commits one atomic operation on release while viewers can only pan', () => {
  const canvas = { ...createModelCanvas(graph, []), grouped: false }
  const changed = vi.fn()
  const control = new BusinessModelGraphCanvas({
    canvas,
    models: graph.nodes,
    edges: [],
    readOnly: false,
    onChange: changed,
    onViewportChange: vi.fn(),
    onMessage: vi.fn(),
    onSelect: vi.fn(),
  })
  control.setState = (patch) => {
    control.state = { ...control.state, ...patch }
  }
  const node = document.createElement('button')
  node.dataset.model = 'sales.Order'
  const viewport = { setPointerCapture: vi.fn(), hasPointerCapture: () => false }
  control.pointerDown({
    button: 0,
    target: node,
    currentTarget: viewport,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
  })
  control.pointerMove({ clientX: 40, clientY: 20 })
  control.pointerMove({ clientX: 80, clientY: 40 })
  expect(changed).not.toHaveBeenCalled()
  expect(control.state.preview.freeLayout.nodes['sales.Order'].x).toBe(
    canvas.freeLayout.nodes['sales.Order'].x + 80
  )
  control.pointerUp({ type: 'pointerup', currentTarget: viewport, pointerId: 1 })
  expect(changed).toHaveBeenCalledTimes(1)
  expect(changed.mock.calls[0][1]).toBe(canvas)
  control.props = { ...control.props, readOnly: true }
  control.pointerDown({
    button: 0,
    target: node,
    currentTarget: viewport,
    pointerId: 2,
    clientX: 0,
    clientY: 0,
  })
  control.pointerMove({ clientX: 120, clientY: 60 })
  expect(changed).toHaveBeenCalledTimes(1)
  control.componentWillUnmount()
})

test('fitting grouped models uses the available viewport while keeping controls clear', () => {
  const models = Array.from({ length: 8 }, (_, index) => ({
    fullName: `app.module${Math.floor(index / 2)}.Model${index}`,
    namespace: `app.module${Math.floor(index / 2)}`,
  }))
  const canvas = createModelCanvas({ nodes: models, edges: [] }, [])
  const component = new BusinessModelGraphCanvas({
    canvas,
    models,
    edges: [],
    onViewportChange: vi.fn(),
  })
  component.setState = (patch, done) => {
    component.state = { ...component.state, ...patch }
    done?.()
  }
  component.viewport.current = { clientWidth: 691, clientHeight: 350 }
  component.fit()
  expect(component.state.view.zoom * 180).toBeGreaterThan(95)
  expect(component.props.onViewportChange).toHaveBeenCalledWith(
    expect.objectContaining({
      groupedLayout: expect.objectContaining({ viewport: component.state.view }),
    })
  )
  const { zoom, offset } = component.state.view
  for (const group of Object.values(canvas.groupedLayout.groups)) {
    expect(group.x * zoom + offset.x).toBeGreaterThanOrEqual(0)
    expect(group.y * zoom + offset.y).toBeGreaterThanOrEqual(0)
    expect((group.y + group.height) * zoom + offset.y).toBeLessThanOrEqual(302)
  }
})

test('module visibility uses the page event and keeps the collaborative session open', async () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  const dispatchEvent = vi.fn()
  const props = { env: { fetcher: vi.fn(api) }, onAction: vi.fn(), dispatchEvent }
  await act(async () =>
    root.render(
      React.createElement(BusinessModelGraph, {
        ...props,
        data: { appName: 'demo', moduleTreeVisible: true },
      })
    )
  )
  const listeners = room.listeners.size
  await act(async () => container.querySelector('[aria-label="显示模块树"]').click())
  expect(dispatchEvent).toHaveBeenLastCalledWith('moduleTreeToggle', { visible: false })
  await act(async () =>
    root.render(
      React.createElement(BusinessModelGraph, {
        ...props,
        data: { appName: 'demo', moduleTreeVisible: false },
      })
    )
  )
  expect(
    container.querySelector('[aria-label="显示模块树"]').getAttribute('aria-pressed')
  ).toBe('false')
  await act(async () => container.querySelector('[aria-label="显示模块树"]').click())
  expect(dispatchEvent).toHaveBeenLastCalledWith('moduleTreeToggle', { visible: true })
  expect(room.listeners.size).toBe(listeners)
  await act(async () => root.unmount())
})

test('the host tab leave guard protects pending operations and releases after durable acknowledgement', async () => {
  const instance = control(vi.fn(api))
  instance.props.data.SystemContext = { activeTabId: 'canvas-tab' }
  instance.componentDidMount()
  await settled()
  const guard = Tabs.beforeLeave.mock.calls.find(([id]) => id === 'canvas-tab')[1]
  room.fail = true
  instance.changeCanvas({ ...instance.canvas(), title: '待确认操作' })
  await settled()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  expect(guard()).toBe(false)
  const unload = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(unload)
  expect(unload.defaultPrevented).toBe(true)
  room.fail = false
  await instance.workspace.retry()
  expect(guard()).toBe(true)
  instance.componentWillUnmount()
  confirm.mockRestore()
})
