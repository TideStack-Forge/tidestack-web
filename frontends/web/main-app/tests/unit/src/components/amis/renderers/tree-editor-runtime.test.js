/* @vitest-environment jsdom */

import { beforeEach, expect, test, vi } from 'vitest'

function findTree(nodes, predicate) {
  for (const node of nodes || []) {
    if (predicate(node)) return node
    const result = findTree(node.children, predicate)
    if (result) return result
  }
  return undefined
}

function mapTree(nodes, mapper, path = []) {
  return (nodes || []).map((node, index, siblings) => {
    const indexes = [...path, index]
    const next = mapper(node, index, indexes.length - 1, siblings, indexes)
    return {
      ...next,
      ...(Array.isArray(next.children)
        ? { children: mapTree(next.children, mapper, indexes) }
        : {}),
    }
  })
}

function filterTree(nodes, predicate) {
  return (nodes || [])
    .filter((node) => predicate(node))
    .map((node) => ({
      ...node,
      ...(Array.isArray(node.children)
        ? { children: filterTree(node.children, predicate) }
        : {}),
    }))
}

vi.mock('amis', () => ({
  ActionObject: {},
  ActionSchema: {},
  FormItem: () => (component) => component,
  Icon: () => null,
  ListenerAction: {},
  LocaleProps: {},
  Schema: {},
  SpinnerExtraProps: {},
  ThemeProps: {},
  autobind: () => undefined,
  buildApi: (api, data) => {
    const resolve = (value) => {
      if (typeof value !== 'string') return value
      return value.replace(/\$\{([^}]+)\}/g, (_match, path) => {
        const result = path.split('.').reduce((current, key) => current?.[key], data)
        return result === undefined || result === null ? '' : String(result)
      })
    }
    return {
      ...api,
      url: resolve(api?.url || api),
      data: api?.data
        ? Object.fromEntries(
            Object.entries(api.data).map(([key, value]) => [key, resolve(value)])
          )
        : api?.data,
    }
  },
  createObject: (base, props) => Object.assign(Object.create(base || null), props),
  createObjectFromChain: (chain) => Object.assign({}, ...chain),
  dataMapping: (value, data) => {
    if (typeof value !== 'string') return value
    const pureExpression = value.match(/^\$\{([^}]+)\}$/)
    if (pureExpression) {
      return pureExpression[1].split('.').reduce((current, key) => current?.[key], data)
    }
    return value.replace(/\$\{([^}]+)\}/g, (_match, path) => {
      const result = path.split('.').reduce((current, key) => current?.[key], data)
      return result === undefined || result === null ? '' : String(result)
    })
  },
  eachTree: (nodes, iterator) => {
    const visit = (items) => {
      ;(items || []).forEach((item, index) => {
        iterator(item, index, 0, items)
        visit(item.children)
      })
    }
    visit(nodes)
  },
  evalExpressionWithConditionBuilder: () => true,
  evalExpressionWithConditionBuilderAsync: async () => true,
  evaluate: (value) => value,
  extractObjectChain: (data) => [data],
  filterTree,
  findTree,
  flattenTree: (nodes, mapper) => {
    const values = []
    const visit = (items) => {
      ;(items || []).forEach((item) => {
        values.push(mapper ? mapper(item) : item)
        visit(item.children)
      })
    }
    visit(nodes)
    return values
  },
  getTree: (nodes, path) => path.reduce((items, index) => items?.[index], nodes),
  isApiOutdated: (previous, next) => previous !== next,
  isEffectiveApi: (api) => Boolean(api?.url || (typeof api === 'string' && api)),
  localeable: (component) => component,
  mapTree,
  resolveEventData: (_props, data) => data,
  themeable: (component) => component,
  wrapAdaptor: async (promise) => {
    const response = await promise
    const payload = response?.data
    if (payload && typeof payload === 'object' && 'status' in payload) {
      return {
        ok: payload.status === 0,
        status: payload.status,
        msg: payload.msg,
        data: payload.data,
      }
    }
    return { ok: true, status: 0, data: payload }
  },
}))

vi.mock('amis-ui/lib/components/Tree', () => ({
  TreeSelector: class TreeSelector {},
}))

const { mockAlert, mockConfirm, mockOpenDialog } = vi.hoisted(() => ({
  mockAlert: vi.fn(),
  mockConfirm: vi.fn(),
  mockOpenDialog: vi.fn(),
}))

vi.mock('#ouroboros-host/common/modal', () => ({
  alert: mockAlert,
  confirm: mockConfirm,
  openDialog: mockOpenDialog,
}))

const { default: TreeEditor, TreeEditorTreeSelector } =
  await import('ouroboros-amis-runtime/renderers/TreeEditor.tsx')

function createEditor(overrides = {}) {
  const editor = Object.create(TreeEditor.prototype)
  const events = []
  const onChange = vi.fn()
  const fetcher = vi.fn()

  editor.props = {
    mode: 'command',
    classnames: (className) => `cxd-${className}`,
    data: { tenantId: 'tenant-a' },
    source: { url: '/api/tree' },
    value: [],
    valueField: 'id',
    dispatchEvent: vi.fn(async () => undefined),
    env: { fetcher },
    onChange,
    ...overrides,
  }
  editor.state = {
    value: [],
    loading: false,
    error: null,
  }
  editor.fetchRequestId = 0
  editor.pendingCommandCount = 0
  editor.deferRequestIds = new Map()
  editor.unmounted = false
  editor.skipNextValueSync = false
  editor.runtimeOptionsCache = {}
  editor.setState = (nextState, callback) => {
    const next = typeof nextState === 'function' ? nextState(editor.state) : nextState
    editor.state = { ...editor.state, ...next }
    callback?.()
  }
  editor.dispatchEvent = async (eventName, payload) => {
    events.push({ eventName, payload })
    return false
  }

  return { editor, events, fetcher, onChange }
}

beforeEach(() => {
  mockAlert.mockReset()
  mockConfirm.mockReset()
  mockOpenDialog.mockReset()
})

test('autoFillHeight adds the themed modifier without leaking to TreeSelector', () => {
  const { editor } = createEditor({
    autoFillHeight: true,
    className: 'business-tree',
  })

  const tree = editor.render()

  expect(tree.props.className).toBe('business-tree cxd-TreeEditor--autoFillHeight')
  expect(tree.props).not.toHaveProperty('autoFillHeight')
})

test('default height preserves the custom class without adding a modifier', () => {
  const { editor } = createEditor({ className: 'business-tree' })

  const tree = editor.render()

  expect(tree.props.className).toBe('business-tree')
  expect(tree.props.className).not.toContain('TreeEditor--autoFillHeight')
})

test('command source failures preserve the previous tree and dispatch fetchFail', async () => {
  const oldTree = [{ id: 'old' }]
  const { editor, events, fetcher } = createEditor({
    value: oldTree,
  })
  editor.state.value = oldTree
  fetcher.mockResolvedValue({ ok: false, msg: 'permission denied' })

  const result = await editor.fetchData()

  expect(result).toBe(false)
  expect(editor.state.value).toBe(oldTree)
  expect(editor.state.error).toBeInstanceOf(Error)
  expect(events.map((event) => event.eventName)).toEqual(['fetchFail'])
})

test('raw source responses are adapted before tree extraction', async () => {
  const { editor, fetcher } = createEditor()
  fetcher.mockResolvedValue({ data: { status: 0, data: [{ id: 'fresh' }] } })

  await editor.fetchData()

  expect(editor.state.value).toEqual([{ id: 'fresh' }])
})

test('command moves wait for reload and do not emit local onChange', async () => {
  const { editor, events, fetcher, onChange } = createEditor({
    state: undefined,
    moveApi: { method: 'post', url: '/api/tree/${event.dragNode.id}/move' },
  })
  editor.state.value = [{ id: 'source' }, { id: 'target' }]
  fetcher
    .mockResolvedValueOnce({ ok: true, data: { accepted: true } })
    .mockResolvedValueOnce({ ok: true, data: [{ id: 'target' }, { id: 'source' }] })

  await editor.itemMoveHandler({
    dragNode: { id: 'source' },
    node: { id: 'target' },
    position: 'bottom',
  })

  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher.mock.calls[0][0].url).toBe('/api/tree/source/move')
  expect(editor.state.value).toEqual([{ id: 'target' }, { id: 'source' }])
  expect(onChange).not.toHaveBeenCalled()
  expect(events.map((event) => event.eventName)).toContain('moveSuccess')
})

test('command success is not converted to command failure when reload fails', async () => {
  const { editor, events, fetcher } = createEditor({
    moveApi: { method: 'post', url: '/api/tree/move' },
  })
  fetcher
    .mockResolvedValueOnce({ ok: true, data: { accepted: true } })
    .mockResolvedValueOnce({ ok: false, msg: 'tree refresh rejected' })

  const result = await editor.runCommandApi(
    editor.props.moveApi,
    { item: { id: 'source' } },
    'moveSuccess',
    'moveFail'
  )

  expect(result).toBe(true)
  expect(events.map((event) => event.eventName)).toEqual(['moveSuccess', 'fetchFail'])
})

test('optimistic command moves update state and roll back on failure', async () => {
  const initialTree = [{ id: 'source' }, { id: 'target' }]
  const { editor, fetcher, onChange } = createEditor({
    source: undefined,
    optimistic: true,
    reloadOnSuccess: false,
    moveApi: { method: 'post', url: '/api/tree/move' },
  })
  editor.state.value = initialTree
  fetcher.mockResolvedValue({ ok: false, msg: 'move rejected' })

  await editor.itemMoveHandler({
    dragNode: { id: 'source' },
    node: { id: 'target' },
    position: 'bottom',
  })

  expect(editor.state.value).toEqual(initialTree)
  expect(onChange).not.toHaveBeenCalled()
})

test('local moves use the shared immutable move operation and emit onChange', async () => {
  const { editor, events, onChange } = createEditor({
    mode: 'local',
    source: undefined,
    valueField: 'id',
  })
  editor.state.value = [{ id: 'source' }, { id: 'target' }]

  await editor.itemMoveHandler({
    dragNode: editor.state.value[0],
    node: editor.state.value[1],
    position: 'bottom',
  })

  expect(editor.state.value.map((node) => node.id)).toEqual(['target', 'source'])
  expect(onChange).toHaveBeenCalledWith(editor.state.value)
  expect(events.map((event) => event.eventName)).toEqual([
    'beforeMove',
    'move',
    'moveSuccess',
  ])
})

test('beforeMove prevents both the command API and state changes', async () => {
  const { editor, fetcher, onChange } = createEditor({
    moveApi: { method: 'post', url: '/api/tree/move' },
  })
  editor.state.value = [{ id: 'source' }, { id: 'target' }]
  editor.dispatchEvent = async (eventName) => eventName === 'beforeMove'

  await editor.itemMoveHandler({
    dragNode: { id: 'source' },
    node: { id: 'target' },
    position: 'bottom',
  })

  expect(fetcher).not.toHaveBeenCalled()
  expect(editor.state.value).toEqual([{ id: 'source' }, { id: 'target' }])
  expect(onChange).not.toHaveBeenCalled()
})

test('missing command API enters the fail lifecycle and error state', async () => {
  const { editor, events, fetcher } = createEditor({ moveApi: undefined })
  editor.state.value = [{ id: 'source' }, { id: 'target' }]

  await editor.itemMoveHandler({
    dragNode: { id: 'source' },
    node: { id: 'target' },
    position: 'bottom',
  })

  expect(fetcher).not.toHaveBeenCalled()
  expect(editor.state.error).toBeInstanceOf(Error)
  expect(events.map((event) => event.eventName)).toEqual([
    'beforeMove',
    'move',
    'moveFail',
  ])
})

test('moves into a descendant are rejected before lifecycle move events', async () => {
  const { editor, events, fetcher } = createEditor({
    moveApi: { method: 'post', url: '/api/tree/move' },
  })
  editor.state.value = [
    {
      id: 'parent',
      children: [{ id: 'child' }],
    },
  ]

  await editor.itemMoveHandler({
    dragNode: { id: 'parent' },
    node: { id: 'child' },
    position: 'self',
  })

  expect(fetcher).not.toHaveBeenCalled()
  expect(events.map((event) => event.eventName)).toEqual(['moveFail'])
})

test('stale source responses cannot overwrite the latest request', async () => {
  const { editor, fetcher } = createEditor()
  let resolveFirst
  let resolveSecond
  fetcher
    .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
    .mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)))

  const first = editor.fetchData()
  const second = editor.fetchData()
  resolveSecond({ ok: true, data: [{ id: 'latest' }] })
  await second
  resolveFirst({ ok: true, data: [{ id: 'stale' }] })
  await first

  expect(editor.state.value).toEqual([{ id: 'latest' }])
})

test('source responses are ignored after unmount', async () => {
  const previous = [{ id: 'previous' }]
  const { editor, events, fetcher } = createEditor()
  editor.state.value = previous
  let resolveRequest
  fetcher.mockReturnValue(new Promise((resolve) => (resolveRequest = resolve)))

  const request = editor.fetchData()
  editor.componentWillUnmount()
  resolveRequest({ ok: true, data: [{ id: 'late' }] })
  await request

  expect(editor.state.value).toBe(previous)
  expect(events).toEqual([])
})

test('concurrent commands each finish their lifecycle', async () => {
  const { editor, events, fetcher } = createEditor({
    source: undefined,
    reloadOnSuccess: false,
  })
  let resolveFirst
  let resolveSecond
  fetcher
    .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
    .mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)))

  const first = editor.runCommandApi(
    { method: 'post', url: '/api/tree/first' },
    { item: { id: 'first' } },
    'firstSuccess',
    'firstFail'
  )
  const second = editor.runCommandApi(
    { method: 'post', url: '/api/tree/second' },
    { item: { id: 'second' } },
    'secondSuccess',
    'secondFail'
  )

  expect(editor.pendingCommandCount).toBe(2)
  resolveSecond({ ok: true, data: {} })
  await second
  expect(editor.state.loading).toBe(true)
  resolveFirst({ ok: true, data: {} })
  await first

  expect(events.map((event) => event.eventName)).toEqual([
    'secondSuccess',
    'firstSuccess',
  ])
  expect(editor.pendingCommandCount).toBe(0)
  expect(editor.state.loading).toBe(false)
})

test('defer load failure restores the previous tree', async () => {
  const initialTree = [{ id: 'parent', defer: true }]
  const { editor, events, fetcher } = createEditor({
    source: undefined,
    deferLoad: { method: 'get', url: '/api/tree/${event.item.id}/children' },
  })
  editor.state.value = initialTree
  fetcher.mockResolvedValue({ ok: false, msg: 'children unavailable' })

  await editor.handleDeferLoad(initialTree[0])

  expect(editor.state.value).toBe(initialTree)
  expect(events.map((event) => event.eventName)).toContain('deferLoadFail')
})

test('node drag permission blocks drag start before TreeSelector starts a drag', () => {
  const { editor } = createEditor({ draggableOn: '${item.canMove}' })
  const selector = Object.create(TreeEditorTreeSelector.prototype)
  selector.props = { isNodeDraggable: editor.isNodeDraggable.bind(editor) }
  const handler = selector.onDragStart({ id: 'locked', canMove: false })
  const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() }

  handler(event)

  expect(event.preventDefault).toHaveBeenCalledTimes(1)
  expect(event.stopPropagation).toHaveBeenCalledTimes(1)
})

test('guarded options keep identity when guard results are unchanged', () => {
  const { editor } = createEditor({
    source: undefined,
    creatableOn: '${item.canCreate}',
  })
  editor.state.value = [{ id: 'node', canCreate: true }]

  const first = editor.resolveRuntimeOptions()
  const second = editor.resolveRuntimeOptions()

  expect(second).toBe(first)
  expect(second[0]).toBe(first[0])
})

test('expanded node identities are restored after source replacement', () => {
  const { editor } = createEditor()
  const previous = [{ id: 'parent', children: [{ id: 'child' }] }]
  const next = [{ id: 'parent', children: [{ id: 'child' }] }]
  const unfolded = new WeakMap([
    [previous[0], true],
    [previous[0].children[0], false],
  ])
  const flattenOptions = vi.fn()
  const forceUpdate = vi.fn()
  editor.treeRef = {
    ref: {
      unfolded,
      props: { options: previous },
      flattenOptions,
      forceUpdate,
    },
  }

  const expanded = editor.captureExpandedKeys()
  editor.restoreExpandedKeys(next, expanded)

  expect(unfolded.get(next[0])).toBe(true)
  expect(unfolded.get(next[0].children[0])).toBe(false)
  expect(flattenOptions).toHaveBeenCalledTimes(1)
  expect(forceUpdate).toHaveBeenCalledTimes(1)
})

test('local commits restore expansion on guarded runtime options', async () => {
  const { editor } = createEditor({
    source: undefined,
    creatableOn: '${item.canCreate}',
  })
  editor.state.value = [
    { id: 'parent', canCreate: true, children: [{ id: 'old-child' }] },
  ]
  const previousOptions = editor.resolveRuntimeOptions()
  const unfolded = new WeakMap([[previousOptions[0], true]])
  editor.treeRef = {
    ref: {
      unfolded,
      props: { options: previousOptions },
      flattenOptions: vi.fn(),
      forceUpdate: vi.fn(),
    },
  }

  editor.commitTreeValue(
    [{ id: 'parent', canCreate: true, children: [{ id: 'new-child' }] }],
    false
  )
  await Promise.resolve()
  const nextOptions = editor.resolveRuntimeOptions()

  expect(nextOptions[0]).not.toBe(previousOptions[0])
  expect(unfolded.get(nextOptions[0])).toBe(true)
})

test('AMIS delete actions use deleteApi in command mode', async () => {
  const { editor, events, fetcher, onChange } = createEditor({
    deleteApi: { method: 'delete', url: '/api/tree/${event.item.id}' },
    reloadOnSuccess: false,
  })
  editor.state.value = [{ id: 'remove-me' }]
  fetcher.mockResolvedValue({ ok: true, data: { deleted: true } })

  await editor.doAction({ actionType: 'deleteItem' }, editor.props.data, false, {
    index: [0],
  })

  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0][0].url).toBe('/api/tree/remove-me')
  expect(events.map((event) => event.eventName)).toEqual([
    'beforeDelete',
    'delete',
    'deleteSuccess',
  ])
  expect(editor.state.value).toEqual([{ id: 'remove-me' }])
  expect(onChange).not.toHaveBeenCalled()
})

test('AMIS delete actions cannot bypass removableOn', async () => {
  const { editor, events, fetcher } = createEditor({
    deleteApi: { method: 'delete', url: '/api/tree/${event.item.id}' },
    removableOn: '${item.canDelete}',
  })
  editor.state.value = [{ id: 'locked', canDelete: false }]

  await editor.doAction({ actionType: 'deleteItem' }, editor.props.data, false, {
    index: [0],
  })

  expect(fetcher).not.toHaveBeenCalled()
  expect(events).toEqual([])
})

test('custom childrenField stays synchronized for local tree edits', () => {
  const { editor, onChange } = createEditor({
    mode: 'local',
    source: undefined,
    childrenField: 'nodes',
  })
  editor.state.value = [{ id: 'parent', nodes: [], children: [] }]

  editor.addItem({ id: 'child' }, [0])

  expect(editor.state.value[0].children).toEqual([{ id: 'child' }])
  expect(editor.state.value[0].nodes).toEqual([{ id: 'child' }])
  expect(onChange).toHaveBeenCalledWith(editor.state.value)
})

test('selection callbacks expose selectedValue as the node identity', async () => {
  const onSelect = vi.fn()
  const { editor, events } = createEditor({
    selectedValue: 'node-a',
    onSelect,
  })
  editor.state.value = [{ id: 'node-a', title: 'Node A' }]

  await editor.handleSelectChange(editor.state.value[0])

  expect(onSelect).toHaveBeenCalledWith('node-a', editor.state.value[0])
  expect(events[0].eventName).toBe('select')
  expect(events[0].payload.value).toBe('node-a')
})

test('itemClick event receives the node identity and item', async () => {
  const { editor, events } = createEditor()
  const item = { id: 'node-a' }

  await editor.handleNodeClick(item)

  expect(events).toEqual([
    {
      eventName: 'itemClick',
      payload: { value: 'node-a', item },
    },
  ])
})

test('item rendering honors labelField for business tree nodes', () => {
  const { editor } = createEditor({
    source: undefined,
    labelField: 'name',
    render: vi.fn(),
  })

  const rendered = editor.itemRender({ name: 'Node A', description: 'Description' })

  expect(rendered.props.children[1][0].props.children).toBe('Node A')
})
