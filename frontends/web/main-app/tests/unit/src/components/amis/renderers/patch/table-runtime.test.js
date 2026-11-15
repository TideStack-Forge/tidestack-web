/* @vitest-environment jsdom */

const assert = require('node:assert/strict')
const path = require('node:path')
const test = globalThis.test || require('node:test')

const {
  clearMirroredSrcModuleCache,
  readRootFile,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

// The existing CommonJS runtime harness injects host-only dependencies before loading renderers.
const Module = require('node:module')
const originalLoad = Module._load
const i18nMessages = {}
Module._load = function loadHostDependency(request, parent, isMain) {
  if (request === '@/common/i18n') {
    return {
      i18nService: {
        getManager: () => ({
          tCommon: (key, fallback, params) =>
            (i18nMessages[key] || fallback).replace(
              /\{\{(\w+)\}\}/g,
              (match, name) => params?.[name] ?? match
            ),
        }),
      },
    }
  }
  return originalLoad.call(this, request, parent, isMain)
}
afterAll(() => {
  Module._load = originalLoad
})

globalThis.__OUROBOROS_TABLE_LAZY_RENDER__ = true

const noop = () => undefined
const ignoreScss = () => undefined
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function createPlainRows(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${index + 1}`,
    name: `Row ${index + 1}`,
  }))
}

async function waitForCooperativeMaterialization(store) {
  const deadline = Date.now() + 1000

  while (Date.now() < deadline) {
    if (!store.materializationPending) {
      return
    }
    await wait(20)
  }
}

function createStorage() {
  const values = new Map()
  return {
    clear: () => values.clear(),
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  }
}

function createElementStub() {
  return {
    addEventListener: noop,
    appendChild: noop,
    className: '',
    closest: () => null,
    getAttribute: () => null,
    querySelector: () => null,
    removeChild: noop,
    removeEventListener: noop,
    setAttribute: noop,
    style: {},
  }
}

function cx(...tokens) {
  return tokens
    .flatMap((token) => {
      if (!token) {
        return []
      }

      if (typeof token === 'string') {
        return [token]
      }

      if (Array.isArray(token)) {
        return token.filter(Boolean)
      }

      if (typeof token === 'object') {
        return Object.keys(token).filter((key) => token[key])
      }

      return []
    })
    .join(' ')
}

function installBrowserLikeGlobals() {
  global.window = global.window || global
  global.window.Event = global.window.Event || class Event {}
  global.Event = global.Event || global.window.Event
  global.MouseEvent = global.MouseEvent || class MouseEvent extends global.Event {}
  global.KeyboardEvent =
    global.KeyboardEvent || class KeyboardEvent extends global.Event {}
  global.WheelEvent = global.WheelEvent || class WheelEvent extends global.Event {}
  global.location = global.location || { search: '' }
  if (!global.window.location) {
    global.window.location = global.location
  }
  global.window.addEventListener = global.window.addEventListener || noop
  global.window.removeEventListener = global.window.removeEventListener || noop
  global.Element = global.Element || class Element {}
  global.HTMLElement = global.HTMLElement || class HTMLElement extends global.Element {}
  global.HTMLAnchorElement =
    global.HTMLAnchorElement || class HTMLAnchorElement extends global.HTMLElement {}
  global.HTMLDivElement =
    global.HTMLDivElement || class HTMLDivElement extends global.HTMLElement {}
  global.HTMLInputElement =
    global.HTMLInputElement || class HTMLInputElement extends global.HTMLElement {}
  global.HTMLMediaElement =
    global.HTMLMediaElement || class HTMLMediaElement extends global.HTMLElement {}
  global.HTMLTableRowElement =
    global.HTMLTableRowElement || class HTMLTableRowElement extends global.HTMLElement {}
  global.sessionStorage = global.sessionStorage || createStorage()
  if (!global.window.sessionStorage) {
    global.window.sessionStorage = global.sessionStorage
  }
  global.localStorage = global.localStorage || createStorage()
  if (!global.window.localStorage) {
    global.window.localStorage = global.localStorage
  }
  global.document = global.document || {
    addEventListener: noop,
    body: createElementStub(),
    createElement: () => createElementStub(),
    documentElement: createElementStub(),
    documentMode: false,
    head: createElementStub(),
    querySelector: () => null,
    removeEventListener: noop,
  }
  if (!global.document.documentElement) {
    global.document.documentElement = createElementStub()
  }
  if (!global.window.document) {
    global.window.document = global.document
  }
  global.self = global.window
  global.requestAnimationFrame = (callback) => setTimeout(callback, 0)
  global.cancelAnimationFrame = (id) => clearTimeout(id)
  global.window.requestAnimationFrame =
    global.window.requestAnimationFrame || global.requestAnimationFrame
  global.window.cancelAnimationFrame =
    global.window.cancelAnimationFrame || global.cancelAnimationFrame
  global.ResizeObserver =
    global.ResizeObserver ||
    class ResizeObserver {
      observe() {
        return undefined
      }
      unobserve() {
        return undefined
      }
      disconnect() {
        return undefined
      }
    }
  global.DragEvent = global.DragEvent || class DragEvent extends global.window.Event {}
  global.DataTransfer = global.DataTransfer || class DataTransfer {}
}

installBrowserLikeGlobals()

function loadEnhancedTableStore() {
  installBrowserLikeGlobals()
  require.extensions['.scss'] = ignoreScss

  const amisCore = require('amis-core')
  const originalRegisterStore = amisCore.registerStore
  let capturedStore = null

  amisCore.registerStore = (store) => {
    capturedStore = store
    return originalRegisterStore(store)
  }

  try {
    delete globalThis.__OUROBOROS_TABLE_STORE_PATCHED__
    clearMirroredSrcModuleCache(__filename, '.')
    require(path.join(process.cwd(), 'src/components/amis/renderers/patch/Table.tsx'))
  } finally {
    amisCore.registerStore = originalRegisterStore
  }

  assert.ok(capturedStore, 'expected Table.tsx to register an enhanced TableStore')
  return capturedStore
}

function createEnhancedStore(persistKey = 'table-key') {
  const EnhancedTableStore = loadEnhancedTableStore()
  return EnhancedTableStore.create(
    {
      id: 'table-1',
      storeType: 'TableStore',
      rows: [],
      columns: [],
      persistKey,
      path: '/demo/table',
      data: {},
      selectable: false,
      multiple: false,
      footable: false,
      primaryField: 'id',
      orderBy: '',
      orderDir: '',
    },
    {
      fetcher: () => Promise.resolve({ data: { rows: [] } }),
      notify: noop,
      isCancel: () => false,
      translate: (value) => value,
      getPageId: () => 'page-1',
    }
  )
}

function loadTableRendererClass() {
  installBrowserLikeGlobals()
  require.extensions['.scss'] = ignoreScss
  delete globalThis.__OUROBOROS_TABLE_STORE_PATCHED__
  clearMirroredSrcModuleCache(__filename, '.')

  const WrappedRenderer = require(
    path.join(process.cwd(), 'src/components/amis/renderers/patch/Table.tsx')
  ).default

  return WrappedRenderer.ComposedComponent
}

function loadInputTableRenderModule() {
  clearMirroredSrcModuleCache(__filename, './InputTable')
  return requireMirroredSrcModule(__filename, './InputTable/inputTableRender.tsx')
}

function loadInputTableInlineEditPresentationModule() {
  clearMirroredSrcModuleCache(__filename, './InputTable')
  return requireMirroredSrcModule(
    __filename,
    './InputTable/inputTableInlineEditPresentation.ts'
  )
}

function loadTableColumnSizingModule() {
  clearMirroredSrcModuleCache(__filename, './tableColumnSizing.ts')
  return requireMirroredSrcModule(__filename, './tableColumnSizing.ts')
}

function loadEnhancedColumnTogglerModule() {
  installBrowserLikeGlobals()
  require.extensions['.scss'] = ignoreScss
  clearMirroredSrcModuleCache(__filename, '.')
  return require(
    path.join(
      process.cwd(),
      'src/components/amis/renderers/patch/EnhancedColumnToggler.tsx'
    )
  )
}

function collectReactPropValues(node, propName, values = []) {
  if (!node || typeof node !== 'object') {
    return values
  }

  if (Object.prototype.hasOwnProperty.call(node.props || {}, propName)) {
    values.push(node.props[propName])
  }

  const children = node.props?.children
  if (typeof children === 'function') {
    collectReactPropValues(children(noop), propName, values)
    return values
  }

  if (Array.isArray(children)) {
    children.forEach((child) => collectReactPropValues(child, propName, values))
    return values
  }

  collectReactPropValues(children, propName, values)
  return values
}

function createRendererInstance(props = {}) {
  const Renderer = loadTableRendererClass()
  const defaultStore = {
    filteredColumns: [],
    exportExcelLoading: false,
    page: 1,
    perPage: 20,
    total: 0,
    rows: [],
    tableLayout: 'auto',
    update: noop,
    getExpandedRows: () => [],
    getStickyStyles: () => [{}, ''],
    orderBy: '',
    orderDir: '',
    isNested: false,
  }
  const mergedProps = {
    render: (name, schema, renderProps) => ({
      name,
      schema,
      props: renderProps,
    }),
    translate: (value) => value,
    classnames: cx,
    data: {},
    query: {},
    autoGenerateFilter: false,
    dispatchEvent: async () => ({}),
    onQuery: () => true,
    resizable: true,
    store: {
      ...defaultStore,
      ...(props.store || {}),
    },
    SystemContext: {
      hasAuth: () => true,
      ...(props.SystemContext || {}),
    },
    ...Object.fromEntries(
      Object.entries(props).filter(([key]) => key !== 'store' && key !== 'SystemContext')
    ),
  }

  const instance = new Renderer(mergedProps, {
    registerComponent: noop,
    unRegisterComponent: noop,
  })
  instance.getPopOverContainer = () => null
  instance.forceUpdate = noop
  instance.renderedToolbars = []

  return instance
}

test('enhanced table store restores persisted column order, fixed side, and width from configPersistKey', () => {
  sessionStorage.clear()
  sessionStorage.setItem(
    'table-key',
    JSON.stringify({
      columnOrder: ['col-b', 'col-a'],
      columnWidth: { 'col-b': 180, 'col-a': 120 },
      fixedColumns: { 'col-b': 'right', 'col-a': 'none' },
    })
  )

  const store = createEnhancedStore('table-key')

  store.update({
    columns: [
      {
        uid: 'col-a',
        name: 'a',
        label: 'A',
        index: 0,
        rawIndex: 0,
        toggled: true,
        searchable: true,
        pristine: { uid: 'col-a' },
      },
      {
        uid: 'col-b',
        name: 'b',
        label: 'B',
        index: 1,
        rawIndex: 1,
        toggled: true,
        searchable: true,
        pristine: { uid: 'col-b' },
      },
    ],
  })

  assert.equal(store.configPersistKey, 'table-key')
  assert.deepEqual(
    store.columnsData.map((column) => column.name),
    ['b', 'a']
  )
  assert.deepEqual(
    store.columnsData.map((column) => column.fixed || 'none'),
    ['right', 'none']
  )
  assert.deepEqual(
    store.columnsData.map((column) => column.pristine?.width ?? column.width),
    [180, 120]
  )
})

test('enhanced table store applies loading max duration config', () => {
  const store = createEnhancedStore('loading-duration-key')

  assert.equal(store.loadingMaxDuration, 2000)

  store.update({ loadingMaxDuration: '0' })
  assert.equal(store.loadingMaxDuration, 0)

  store.update({ loadingMaxDuration: -1 })
  assert.equal(store.loadingMaxDuration, -1)

  store.update({ loadingMaxDuration: 'invalid' })
  assert.equal(store.loadingMaxDuration, 2000)
})

test('enhanced table store suppresses cooperative loading after max duration without cancelling materialization', async () => {
  const store = createEnhancedStore('loading-duration-suppression-key')
  const originalRequestAnimationFrame = window.requestAnimationFrame

  window.requestAnimationFrame = () => 0

  try {
    store.update({ lazyRenderAfter: 1, loadingMaxDuration: 20 })
    store.initRows(createPlainRows(4), (item) => item.id)

    assert.equal(store.materializationPending, true)
    assert.equal(store.cooperativeLoadingVisible, true)

    await wait(40)

    assert.equal(store.materializationPending, true)
    assert.equal(store.cooperativeLoadingVisible, false)
    assert.equal(store.cooperativeLoadingSuppressed, true)
  } finally {
    store.cancelCooperativeRendering()
    window.requestAnimationFrame = originalRequestAnimationFrame
  }
})

test('enhanced table store treats non-positive and null lazyRenderAfter as explicit disable', () => {
  const store = createEnhancedStore('lazy-disable-key')

  ;[0, -1, null].forEach((lazyRenderAfter) => {
    store.update({ lazyRenderAfter })

    assert.equal(store.lazyRenderAfterExplicit, true)
    assert.equal(store.lazyRenderAfter, Number.MAX_SAFE_INTEGER)
  })
})

test('enhanced table store infers lazy rendering for small but wide tables', () => {
  const store = createEnhancedStore('wide-table-lazy-key')
  const columns = Array.from({ length: 59 }, (_, index) => ({
    name: `field${index}`,
    label: `Field ${index}`,
    type: 'text',
  }))

  store.update({ columns })
  store.initRows(createPlainRows(20), (item) => item.id)

  assert.equal(store.lazyRenderAfterExplicit, false)
  assert.ok(
    store.lazyRenderAfter > 0 && store.lazyRenderAfter < 20,
    `expected inferred lazyRenderAfter to activate for 20x59 table, got ${store.lazyRenderAfter}`
  )
  assert.equal(store.materializationPending, true)
  store.cancelCooperativeRendering()
})

test('enhanced table store treats AMIS default lazyRenderAfter 100 as inferable', () => {
  const store = createEnhancedStore('wide-table-default-lazy-key')
  const columns = Array.from({ length: 59 }, (_, index) => ({
    name: `field${index}`,
    label: `Field ${index}`,
    type: 'text',
  }))

  store.update({ lazyRenderAfter: 100 })
  store.update({ columns })
  store.initRows(createPlainRows(20), (item) => item.id)

  assert.equal(store.lazyRenderAfterExplicit, false)
  assert.ok(
    store.lazyRenderAfter > 0 && store.lazyRenderAfter < 20,
    `expected AMIS default 100 to remain inferable, got ${store.lazyRenderAfter}`
  )
  store.cancelCooperativeRendering()
})

test('enhanced table store re-infers when AMIS default 100 is applied during row publish', async () => {
  const store = createEnhancedStore('wide-table-default-rerender-key')
  const columns = Array.from({ length: 59 }, (_, index) => ({
    name: `field${index}`,
    label: `Field ${index}`,
    type: 'text',
  }))

  store.update({ columns })
  store.initRows(createPlainRows(100), (item) => item.id)
  store.update({ lazyRenderAfter: 100 })
  await waitForCooperativeMaterialization(store)

  assert.equal(store.lazyRenderAfterExplicit, false)
  assert.ok(
    store.lazyRenderAfter > 0 && store.lazyRenderAfter < 100,
    `expected AMIS default 100 re-render update to re-infer, got ${store.lazyRenderAfter}`
  )
  store.cancelCooperativeRendering()
})

test('enhanced table store cooperatively materializes each row once and publishes once', async () => {
  const tableStoreModule = require('amis-core/lib/store/table')
  const store = createEnhancedStore('materialization-complete-key')
  const originalCreate = tableStoreModule.Row.create
  let rowCreateCount = 0

  store.cancelCooperativeRendering()
  tableStoreModule.Row.create = (...args) => {
    rowCreateCount += 1
    return originalCreate.apply(tableStoreModule.Row, args)
  }

  try {
    store.update({ lazyRenderAfter: 1 })
    assert.equal(store.lazyRenderAfter, 1)
    assert.equal(store.lazyRenderAfterExplicit, true)
    assert.equal(store.rows.length, 0)
    assert.equal(store.combineNum || 0, 0)
    store.initRows(createPlainRows(4), (item) => item.id)
    assert.equal(store.materializationPending, true)
    await waitForCooperativeMaterialization(store)

    assert.equal(store.materializationLastError, null)
    assert.equal(store.materializationFailureCount, 0)
    assert.equal(store.materializationRowCreateCount, 4)
    assert.ok(rowCreateCount <= 4)
    assert.equal(store.materializationPublishCount, 1)
    assert.equal(store.rows.length, 4)
  } finally {
    tableStoreModule.Row.create = originalCreate
  }
})

test('enhanced table store cancelled materialization does not publish rows', async () => {
  const tableStoreModule = require('amis-core/lib/store/table')
  const store = createEnhancedStore('materialization-cancel-key')
  const originalCreate = tableStoreModule.Row.create
  let rowCreateCount = 0

  store.cancelCooperativeRendering()
  tableStoreModule.Row.create = (...args) => {
    rowCreateCount += 1
    return originalCreate.apply(tableStoreModule.Row, args)
  }

  try {
    store.update({ lazyRenderAfter: 1 })
    store.initRows(createPlainRows(4), (item) => item.id)
    store.cancelCooperativeRendering()
    await waitForCooperativeMaterialization(store)

    assert.ok(rowCreateCount <= 4)
    assert.equal(store.materializationPublishCount, 0)
    assert.equal(store.materializationLastError, null)
    assert.equal(store.materializationPending, false)
    assert.equal(store.rows.length, 0)
  } finally {
    tableStoreModule.Row.create = originalCreate
  }
})

test('enhanced table store beforeDestroy cancels active cooperative materialization', async () => {
  const store = createEnhancedStore('materialization-before-destroy-key')

  store.update({ lazyRenderAfter: 1 })
  store.initRows(createPlainRows(4), (item) => item.id)
  assert.equal(store.materializationPending, true)

  store.beforeDestroy()
  await waitForCooperativeMaterialization(store)

  assert.equal(store.materializationPending, false)
  assert.equal(store.viewportHydrationPending, false)
  assert.equal(store.cooperativeLoadingSuppressed, false)
  assert.equal(store.pendingMaterializationCount, 0)
  assert.equal(store.materializationPublishCount, 0)
  assert.equal(store.materializationLastError, null)
})

test('enhanced table store reuses matched rows instead of rematerializing editable updates', async () => {
  const tableStoreModule = require('amis-core/lib/store/table')
  const store = createEnhancedStore('materialization-reuse-match-key')
  const originalCreate = tableStoreModule.Row.create
  let rowCreateCount = 0

  store.cancelCooperativeRendering()
  tableStoreModule.Row.create = (...args) => {
    rowCreateCount += 1
    return originalCreate.apply(tableStoreModule.Row, args)
  }

  try {
    store.update({ lazyRenderAfter: 1 })
    store.initRows(createPlainRows(4), (item) => item.id)
    await waitForCooperativeMaterialization(store)

    const initialRows = store.rows.slice()
    const initialRowCreateCount = rowCreateCount
    assert.equal(store.materializationPublishCount, 1)
    assert.equal(store.rows.length, 4)

    store.initRows(
      createPlainRows(4).map((row, index) => ({
        ...row,
        name: `Updated ${index + 1}`,
      })),
      (item) => item.id,
      'match'
    )

    assert.equal(store.materializationPending, false)
    assert.equal(store.materializationPublishCount, 1)
    assert.equal(rowCreateCount, initialRowCreateCount)
    assert.deepEqual(
      store.rows.map((row, index) => row === initialRows[index]),
      [true, true, true, true]
    )
    assert.deepEqual(
      store.rows.map((row) => row.data.name),
      ['Updated 1', 'Updated 2', 'Updated 3', 'Updated 4']
    )
  } finally {
    tableStoreModule.Row.create = originalCreate
  }
})

test('enhanced table store cooperative materialization publishes snapshots, not Row instances', async () => {
  const tableStoreModule = require('amis-core/lib/store/table')
  const originalCreate = tableStoreModule.Row.create
  const store = createEnhancedStore('materialization-snapshot-publish-key')
  let rowCreateCount = 0

  store.cancelCooperativeRendering()
  tableStoreModule.Row.create = (...args) => {
    rowCreateCount += 1
    throw new Error('direct Row.create should not be called')
  }

  try {
    store.update({ lazyRenderAfter: 1 })
    store.initRows(createPlainRows(4), (item) => item.id)
    await waitForCooperativeMaterialization(store)

    assert.equal(rowCreateCount, 0)
    assert.equal(store.materializationPublishCount, 1)
    assert.equal(store.materializationFailureCount, 0)
    assert.equal(store.materializationLastError, null)
    assert.equal(store.materializationPending, false)
    assert.equal(store.pendingMaterializationCount, 0)
    assert.deepEqual(
      store.rows.map((row) => row.id),
      ['row-1', 'row-2', 'row-3', 'row-4']
    )
  } finally {
    tableStoreModule.Row.create = originalCreate
  }
})

test('enhanced table store falls back to canonical initRows when cooperative materialization fails', async () => {
  const store = createEnhancedStore('materialization-fallback-key')
  const rows = createPlainRows(4)
  let shouldFailCooperativeSnapshot = true

  store.update({ lazyRenderAfter: 1 })
  store.initRows(rows, (item) => {
    if (shouldFailCooperativeSnapshot) {
      shouldFailCooperativeSnapshot = false
      throw new Error('cooperative snapshot failed')
    }

    return item.id
  })
  await waitForCooperativeMaterialization(store)

  assert.equal(store.materializationPending, false)
  assert.equal(store.materializationFailureCount, 1)
  assert.equal(store.materializationPublishCount, 0)
  assert.equal(store.pendingMaterializationCount, 0)
  assert.deepEqual(
    store.rows.map((row) => row.id),
    ['row-1', 'row-2', 'row-3', 'row-4']
  )
})

test('enhanced table store snapshot replacement updates rows and fullItems atomically', async () => {
  const store = createEnhancedStore('materialization-replace-snapshot-key')

  store.update({ lazyRenderAfter: 0 })
  store.initRows(createPlainRows(2), (item) => item.id, undefined, [
    { id: 'old-full-item' },
  ])
  store.toggle(store.rows[0], true)

  store.update({ lazyRenderAfter: 1 })
  store.initRows(createPlainRows(4), (item) => item.id, undefined, [
    { id: 'new-full-item' },
  ])
  await waitForCooperativeMaterialization(store)

  assert.equal(store.materializationPublishCount, 1)
  assert.equal(store.materializationFailureCount, 0)
  assert.equal(store.materializationPending, false)
  assert.deepEqual(
    store.rows.map((row) => row.id),
    ['row-1', 'row-2', 'row-3', 'row-4']
  )
  assert.deepEqual(store.selectedRows.slice(), [])
  assert.deepEqual(store.fullItems.slice(), [{ id: 'new-full-item' }])
})

test('enhanced table store persists and clears table config through the shared sessionStorage and fetcher chain', async () => {
  sessionStorage.clear()
  const fetchCalls = []
  const EnhancedTableStore = loadEnhancedTableStore()
  const store = EnhancedTableStore.create(
    {
      id: 'table-2',
      storeType: 'TableStore',
      rows: [],
      columns: [],
      persistKey: 'persist-key',
      path: '/demo/table',
      data: {},
      selectable: false,
      multiple: false,
      footable: false,
      primaryField: 'id',
      orderBy: '',
      orderDir: '',
    },
    {
      fetcher: async (request) => {
        fetchCalls.push(request)
        return { data: { rows: [] } }
      },
      notify: noop,
      isCancel: () => false,
      translate: (value) => value,
      getPageId: () => 'page-1',
    }
  )

  store.update({
    columns: [
      {
        uid: 'col-a',
        name: 'a',
        label: 'A',
        index: 0,
        rawIndex: 0,
        toggled: true,
        searchable: true,
        pristine: { uid: 'col-a' },
      },
      {
        uid: 'col-b',
        name: 'b',
        label: 'B',
        index: 1,
        rawIndex: 1,
        toggled: true,
        searchable: true,
        pristine: { uid: 'col-b' },
      },
    ],
  })

  store.columnsData[0].setWidth(180)
  store.columnsData[1].setToggled(false)
  store.columnsData[1].setEnableSearch(false, true)
  store.persistSaveToggledColumns()

  await wait(350)

  const persistedConfig = JSON.parse(sessionStorage.getItem('persist-key'))
  assert.deepEqual(persistedConfig.columnOrder, ['col-a', 'col-b'])
  assert.deepEqual(persistedConfig.unToggledColumns, ['col-b'])
  assert.deepEqual(persistedConfig.disabledSearchableColumn, ['col-b'])
  assert.deepEqual(persistedConfig.fixedColumns, {
    'col-a': 'none',
    'col-b': 'none',
  })
  assert.deepEqual(persistedConfig.columnWidth, { 'col-a': 180 })
  assert.equal(fetchCalls[0].method, 'patch')
  assert.equal(fetchCalls[0].url, '/api/user-setting')
  assert.equal(fetchCalls[0].data.settingName, 'persist-key')

  store.clearPersistSavedConfig()
  await wait(0)

  assert.equal(sessionStorage.getItem('persist-key'), null)
  assert.equal(fetchCalls[1].method, 'delete')
  assert.equal(fetchCalls[1].url, '/api/user-setting?settingName=persist-key')
})

test('table unmount releases an active column resize session', () => {
  const removeListenerCalls = []
  const originalRemoveEventListener = document.removeEventListener
  const resizeLine = document.createElement('div')
  resizeLine.setAttribute('data-index', '0')
  resizeLine.setAttribute('data-side', 'right')
  const store = createEnhancedStore('resize-unmount-key')
  store.update({
    columns: [
      {
        uid: 'col-a',
        name: 'a',
        label: 'A',
        index: 0,
        rawIndex: 0,
        toggled: true,
        searchable: true,
        width: 120,
        pristine: { uid: 'col-a', width: 120 },
      },
    ],
  })
  const instance = createRendererInstance()
  instance.props = { ...instance.props, store }
  instance.context = {
    registerComponent: noop,
    unRegisterComponent: noop,
  }

  document.removeEventListener = function removeEventListener(type, listener, options) {
    removeListenerCalls.push([type, listener])
    return originalRemoveEventListener.call(this, type, listener, options)
  }

  try {
    instance.handleColResizeMouseDown({
      clientX: 20,
      currentTarget: resizeLine,
      preventDefault: noop,
      stopPropagation: noop,
    })

    assert.equal(resizeLine.classList.contains('is-resizing'), true)
    assert.equal(instance.resizeLine, resizeLine)
    const widthBeforeUnmount = store.columns[0].width

    instance.componentWillUnmount()

    assert.equal(resizeLine.classList.contains('is-resizing'), false)
    assert.equal(instance.resizeLine, undefined)
    assert.ok(
      removeListenerCalls.some(
        ([type, listener]) =>
          type === 'mousemove' && listener === instance.handleColResizeMouseMove
      )
    )
    assert.ok(
      removeListenerCalls.some(
        ([type, listener]) =>
          type === 'mouseup' && listener === instance.handleColResizeMouseUp
      )
    )

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 80 }))
    assert.equal(store.columns[0].width, widthBeforeUnmount)
  } finally {
    originalRemoveEventListener.call(
      document,
      'mousemove',
      instance.handleColResizeMouseMove
    )
    originalRemoveEventListener.call(document, 'mouseup', instance.handleColResizeMouseUp)
    document.removeEventListener = originalRemoveEventListener
  }
})

test('table renderer syncs affix-header gutter after mount and update', () => {
  const instance = createRendererInstance()
  const basePrototype = Object.getPrototypeOf(Object.getPrototypeOf(instance))
  const originalBaseLifecycle = {
    componentDidMount: basePrototype.componentDidMount,
    componentDidUpdate: basePrototype.componentDidUpdate,
  }
  const calls = []

  basePrototype.componentDidMount = () => calls.push('super:mount')
  basePrototype.componentDidUpdate = () => calls.push('super:update')
  instance.tableDomLifecycle.syncAffixHeaderScrollbarGutter = () =>
    calls.push('gutter:sync')

  try {
    instance.componentDidMount()
    instance.componentDidUpdate(instance.props)

    assert.deepEqual(calls, ['super:mount', 'gutter:sync', 'super:update', 'gutter:sync'])
  } finally {
    Object.assign(basePrototype, originalBaseLifecycle)
  }
})

test('table column sizing schema lowers inner form-control minimum width', () => {
  const {
    normalizeTableColumnSizing,
    TABLE_COLUMN_CONTROL_MIN_WIDTH_VAR,
    TABLE_COLUMN_EXPLICIT_CONTROL_MIN_WIDTH_CLASS,
  } = loadTableColumnSizingModule()

  const column = normalizeTableColumnSizing({
    name: 'amount',
    className: 'amount-col',
    style: { color: 'red' },
    width: 80,
  })
  const minWidthColumn = normalizeTableColumnSizing({
    name: 'dict',
    minWidth: '90px',
  })

  assert.match(column.className, /amount-col/)
  assert.match(
    column.className,
    new RegExp(TABLE_COLUMN_EXPLICIT_CONTROL_MIN_WIDTH_CLASS)
  )
  assert.equal(column.style.color, 'red')
  assert.equal(column.minWidth, undefined)
  assert.equal(column.style[TABLE_COLUMN_CONTROL_MIN_WIDTH_VAR], '80px')
  assert.equal(minWidthColumn.minWidth, 90)
  assert.equal(minWidthColumn.style[TABLE_COLUMN_CONTROL_MIN_WIDTH_VAR], '90px')
})

test('table renderer reapplies explicit minWidth without capping expanded width', () => {
  const calls = []
  const column = {
    width: 200,
    minWidth: 200,
    pristine: {
      width: 80,
      minWidth: 60,
    },
    setMinWidth(nextMinWidth) {
      calls.push(['minWidth', nextMinWidth])
      this.minWidth = nextMinWidth
    },
    setWidth(nextWidth) {
      calls.push(['width', nextWidth])
      this.width = nextWidth
    },
  }
  const instance = createRendererInstance({
    store: {
      columns: [column],
    },
  })
  const basePrototype = Object.getPrototypeOf(Object.getPrototypeOf(instance))
  const originalUpdateTableInfo = basePrototype.updateTableInfo

  basePrototype.updateTableInfo = (callback) => {
    column.minWidth = 200
    column.width = 200
    callback?.()
  }

  try {
    instance.updateTableInfo()

    assert.deepEqual(calls, [
      ['minWidth', 60],
      ['minWidth', 60],
    ])
    assert.equal(column.minWidth, 60)
    assert.equal(column.width, 200)
  } finally {
    basePrototype.updateTableInfo = originalUpdateTableInfo
  }
})

test('table renderer leaves width-only columns resizable without runtime minWidth', () => {
  const calls = []
  const column = {
    width: 200,
    minWidth: 200,
    pristine: {
      width: 80,
    },
    setMinWidth(nextMinWidth) {
      calls.push(['minWidth', nextMinWidth])
      this.minWidth = nextMinWidth
    },
    setWidth(nextWidth) {
      calls.push(['width', nextWidth])
      this.width = nextWidth
    },
  }
  const instance = createRendererInstance({
    store: {
      columns: [column],
    },
  })
  const basePrototype = Object.getPrototypeOf(Object.getPrototypeOf(instance))
  const originalUpdateTableInfo = basePrototype.updateTableInfo

  basePrototype.updateTableInfo = (callback) => {
    column.minWidth = 200
    column.width = 200
    callback?.()
  }

  try {
    instance.updateTableInfo()

    assert.deepEqual(calls, [])
    assert.equal(column.minWidth, 200)
    assert.equal(column.width, 200)
  } finally {
    basePrototype.updateTableInfo = originalUpdateTableInfo
  }
})

test('table completes left and right resize sessions through the AMIS mouseup cleanup path', () => {
  const removeListenerCalls = []
  const originalRemoveEventListener = document.removeEventListener
  const column = {
    width: 120,
    minWidth: 30,
    setWidth(nextWidth) {
      this.width = nextWidth
    },
  }
  let persistCalls = 0
  const instance = createRendererInstance({
    store: {
      columns: [column],
      persistSaveToggledColumns: () => {
        persistCalls += 1
      },
    },
  })

  document.removeEventListener = function removeEventListener(type, listener, options) {
    removeListenerCalls.push([type, listener])
    return originalRemoveEventListener.call(this, type, listener, options)
  }

  try {
    for (const [side, expectedWidth] of [
      ['right', 150],
      ['left', 90],
    ]) {
      column.width = 120
      const resizeLine = document.createElement('div')
      resizeLine.setAttribute('data-index', '0')
      resizeLine.setAttribute('data-side', side)

      instance.handleColResizeMouseDown({
        clientX: 20,
        currentTarget: resizeLine,
        preventDefault: noop,
        stopPropagation: noop,
      })
      instance.handleColResizeMouseMove(new MouseEvent('mousemove', { clientX: 50 }))
      instance.handleColResizeMouseUp(new MouseEvent('mouseup'))

      assert.equal(column.width, expectedWidth)
      assert.equal(resizeLine.classList.contains('is-resizing'), false)
      assert.equal(instance.resizeLine, undefined)
    }

    assert.equal(persistCalls, 2)
    assert.equal(
      removeListenerCalls.filter(
        ([type, listener]) =>
          type === 'mousemove' && listener === instance.handleColResizeMouseMove
      ).length,
      2
    )
    assert.equal(
      removeListenerCalls.filter(
        ([type, listener]) =>
          type === 'mouseup' && listener === instance.handleColResizeMouseUp
      ).length,
      2
    )
  } finally {
    originalRemoveEventListener.call(
      document,
      'mousemove',
      instance.handleColResizeMouseMove
    )
    originalRemoveEventListener.call(document, 'mouseup', instance.handleColResizeMouseUp)
    document.removeEventListener = originalRemoveEventListener
  }
})

test('normalizeColumnStates keeps left, normal, right, and locked columns in stable groups', () => {
  installBrowserLikeGlobals()
  require.extensions['.scss'] = ignoreScss
  clearMirroredSrcModuleCache(__filename, '.')

  const { normalizeColumnStates } = require(
    path.join(
      process.cwd(),
      'src/components/amis/renderers/patch/EnhancedColumnToggler.tsx'
    )
  )

  const normalized = normalizeColumnStates([
    {
      id: 'normal-1',
      name: 'normal-1',
      label: 'Normal 1',
      toggled: true,
      fixed: 'none',
      originalIndex: 0,
      currentIndex: 0,
    },
    {
      id: 'right-1',
      name: 'right-1',
      label: 'Right 1',
      toggled: true,
      fixed: 'right',
      originalIndex: 1,
      currentIndex: 1,
    },
    {
      id: 'left-1',
      name: 'left-1',
      label: 'Left 1',
      toggled: true,
      fixed: 'left',
      originalIndex: 2,
      currentIndex: 2,
    },
    {
      id: 'locked-1',
      name: 'locked-1',
      label: 'Locked 1',
      toggled: true,
      fixed: 'none',
      originalIndex: 3,
      currentIndex: 3,
      locked: true,
    },
  ])

  assert.deepEqual(
    normalized.map((column) => column.id),
    ['left-1', 'normal-1', 'right-1', 'locked-1']
  )
  assert.deepEqual(
    normalized.map((column) => column.currentIndex),
    [0, 1, 2, 3]
  )
})

test('rendered column toggler rewrites column order and fixed state through the shared persist chain', () => {
  const persistCalls = []
  const updateColumnsCalls = []
  const storeColumns = [
    {
      id: 'col-a',
      columnKey: 'col-a',
      name: 'a',
      toggled: true,
      fixed: '',
      width: 120,
      setWidth: noop,
    },
    {
      id: 'col-b',
      columnKey: 'col-b',
      name: 'b',
      toggled: true,
      fixed: '',
      width: 180,
      setWidth: noop,
    },
  ]
  const syncedColumns = [
    {
      columnKey: 'col-a',
      name: 'a',
      toggled: true,
      fixed: '',
      width: 120,
      setWidth: noop,
    },
    {
      columnKey: 'col-b',
      name: 'b',
      toggled: true,
      fixed: '',
      width: 180,
      setWidth: noop,
    },
  ]
  const instance = createRendererInstance({
    store: {
      columns: storeColumns,
      columnsTogglable: true,
      toggableColumns: storeColumns,
      updateColumns: (columns) => {
        updateColumnsCalls.push(columns)
        storeColumns.splice(0, storeColumns.length, ...columns)
      },
      initTableWidth: noop,
      syncTableWidth: noop,
      persistSaveToggledColumns: () => {
        persistCalls.push('persisted')
      },
      columnsData: syncedColumns,
    },
  })

  const renderedToggler = instance.renderColumnsToggler().props.children[1]
  renderedToggler.props.onConfirm([
    {
      id: 'col-b',
      name: 'b',
      label: 'B',
      toggled: true,
      fixed: 'left',
      originalIndex: 1,
      currentIndex: 0,
    },
    {
      id: 'col-a',
      name: 'a',
      label: 'A',
      toggled: false,
      fixed: 'none',
      originalIndex: 0,
      currentIndex: 1,
    },
  ])

  assert.equal(updateColumnsCalls.length, 1)
  assert.deepEqual(
    updateColumnsCalls[0].map((column) => ({
      name: column.name,
      toggled: column.toggled,
      fixed: column.fixed ?? 'none',
      index: column.index,
    })),
    [
      { name: 'b', toggled: true, fixed: 'left', index: 0 },
      { name: 'a', toggled: false, fixed: 'none', index: 1 },
    ]
  )
  assert.deepEqual(persistCalls, ['persisted'])
})

test('rendered column toggler clears persisted config and restores schema column defaults', () => {
  const clearCalls = []
  const persistCalls = []
  const updateColumnsCalls = []
  const storeColumns = [
    {
      id: 'col-a',
      columnKey: 'col-a',
      name: 'a',
      label: 'A',
      toggled: false,
      fixed: 'right',
      index: 1,
      width: 120,
      setWidth: noop,
    },
    {
      id: 'col-b',
      columnKey: 'col-b',
      name: 'b',
      label: 'B',
      toggled: true,
      fixed: '',
      index: 0,
      width: 180,
      setWidth: noop,
    },
  ]
  const instance = createRendererInstance({
    $schema: {
      columns: [
        {
          id: 'col-a',
          columnKey: 'col-a',
          name: 'a',
          label: 'A',
          toggled: true,
          fixed: '',
        },
        {
          id: 'col-b',
          columnKey: 'col-b',
          name: 'b',
          label: 'B',
          toggled: false,
          fixed: 'left',
        },
      ],
    },
    store: {
      columns: storeColumns,
      columnsTogglable: true,
      toggableColumns: storeColumns,
      updateColumns: (columns) => {
        updateColumnsCalls.push(columns)
        storeColumns.splice(0, storeColumns.length, ...columns)
      },
      initTableWidth: noop,
      syncTableWidth: noop,
      clearPersistSavedConfig: () => {
        clearCalls.push('cleared')
      },
      persistSaveToggledColumns: () => {
        persistCalls.push('persisted')
      },
    },
  })

  const renderedToggler = instance.renderColumnsToggler().props.children[1]
  renderedToggler.props.onReset()

  assert.deepEqual(clearCalls, ['cleared'])
  assert.deepEqual(persistCalls, [])
  assert.equal(updateColumnsCalls.length, 2)
  assert.deepEqual(
    updateColumnsCalls.at(-1).map((column) => ({
      name: column.name,
      toggled: column.toggled,
      fixed: column.fixed ?? 'none',
      index: column.index,
    })),
    [
      { name: 'b', toggled: false, fixed: 'left', index: 0 },
      { name: 'a', toggled: true, fixed: 'none', index: 1 },
    ]
  )
})

test('renderExportExcel collapses grouped export-excel toolbars into a dropdown button', () => {
  const instance = createRendererInstance({
    data: { foo: 'bar' },
    query: { status: 'enabled' },
    headerToolbar: [
      { type: 'export-excel', label: '导出当前页' },
      { type: 'export-excel', label: '导出全部' },
    ],
    store: {
      filteredColumns: [{ name: 'id' }],
      exportExcelLoading: false,
      page: 2,
      perPage: 20,
      total: 88,
    },
  })

  const rendered = instance.renderExportExcel({
    type: 'export-excel',
    label: '导出',
    buttons: [
      { type: 'export-excel', label: '当前页' },
      { type: 'export-excel', label: '全部' },
    ],
  })

  assert.equal(rendered.name, 'exportExcel')
  assert.equal(rendered.schema.type, 'dropdown-button')
  assert.equal(rendered.schema.closeOnClick, true)
  assert.equal(rendered.schema.icon, 'filetype-xlsx')
  assert.equal(rendered.schema.label, '导出')
  assert.deepEqual(
    rendered.schema.buttons.map((button) => button.label),
    ['当前页', '全部']
  )
  assert.deepEqual(
    rendered.schema.buttons.map((button) => button.type),
    ['button', 'button']
  )
})

test('renderExportExcel keeps a single export toolbar as a plain button', () => {
  const instance = createRendererInstance({
    store: {
      filteredColumns: [{ name: 'id' }],
      exportExcelLoading: false,
    },
  })

  const rendered = instance.renderExportExcel({
    type: 'export-excel',
    label: '导出',
  })

  assert.equal(rendered.name, 'exportExcel')
  assert.equal(rendered.schema.type, 'button')
  assert.equal(rendered.schema.icon, 'filetype-xlsx')
  assert.equal(rendered.schema.label, '导出')
})

test('renderExportExcel renders grouped current-page and all-rows exports as a dropdown button', () => {
  const instance = createRendererInstance({
    data: { foo: 'bar' },
    query: { status: 'enabled' },
    store: {
      filteredColumns: [{ name: 'id' }],
      exportExcelLoading: false,
      page: 1,
      perPage: 20,
      total: 20,
    },
  })

  const grouped = instance.renderExportExcel({
    type: 'export-excel',
    buttons: [
      { type: 'export-excel', label: '导出当前页' },
      { type: 'export-excel', label: '导出全部' },
    ],
  })

  assert.equal(grouped.name, 'exportExcel')
  assert.equal(grouped.schema.type, 'dropdown-button')
  assert.equal(grouped.schema.icon, 'filetype-xlsx')
  assert.equal(grouped.schema.label, '导出')
  assert.deepEqual(
    grouped.schema.buttons.map((button) => button.label),
    ['导出当前页', '导出全部']
  )
})

test('exportTableExcel wires selected, fetched, and latest current-page rows through the renderer seam', async () => {
  const exportExcelModule = require('amis/lib/renderers/Table/exportExcel')
  const originalExportExcel = exportExcelModule.exportExcel
  const exportedRows = []
  let resolveFetch
  const store = createEnhancedStore('excel-renderer-seam-key')
  store.update({
    columns: [
      {
        uid: 'id',
        name: 'id',
        label: 'ID',
        index: 0,
        rawIndex: 0,
        toggled: true,
        pristine: { uid: 'id', name: 'id', label: 'ID' },
      },
    ],
  })
  store.initRows([{ id: 'before-fetch' }], (item) => item.id)
  const instance = createRendererInstance({
    env: {
      fetcher: () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    },
  })
  instance.props = { ...instance.props, store }
  const toolbar = {
    type: 'export-excel',
    api: '/api/demo/export',
    exportColumns: [{ name: 'id', label: 'ID' }],
  }

  exportExcelModule.exportExcel = async (_ExcelJS, props) => {
    exportedRows.push(props.store.rows.map((row) => row.data.id))
  }

  try {
    instance.getSelected = () => []
    const currentPageExport = instance.exportTableExcel({}, toolbar)
    store.initRows([{ id: 'after-fetch' }], (item) => item.id)
    resolveFetch({ data: { rows: [] } })
    await currentPageExport

    instance.getSelected = () => [{ id: 'selected-row' }]
    await instance.exportTableExcel(
      {},
      { ...toolbar, api: undefined, exportSelected: true }
    )

    instance.getSelected = () => []
    instance.props.env.fetcher = async () => ({
      data: {
        rows: [{ id: 'fetched-row' }],
      },
    })
    await instance.exportTableExcel({}, toolbar)

    assert.deepEqual(exportedRows, [['after-fetch'], ['selected-row'], ['fetched-row']])
  } finally {
    exportExcelModule.exportExcel = originalExportExcel
  }
})

test('exportTableExcel formats numeric columns only when precision is configured', async () => {
  const ExcelJS = require('exceljs')
  const fileSaver = require('file-saver')
  const originalSaveAs = fileSaver.saveAs
  let savedBlob = null
  const store = createEnhancedStore('excel-numeric-column-format-key')
  store.update({
    columns: [
      {
        uid: 'amount',
        name: 'amount',
        label: 'Static Number With Precision',
        type: 'static-number',
        precision: 3,
        index: 0,
        rawIndex: 0,
        toggled: true,
        pristine: {
          uid: 'amount',
          name: 'amount',
          label: 'Static Number With Precision',
          type: 'static-number',
          precision: 3,
        },
      },
      {
        uid: 'price',
        name: 'price',
        label: 'Number With Precision',
        type: 'number',
        precision: 2,
        index: 1,
        rawIndex: 1,
        toggled: true,
        pristine: {
          uid: 'price',
          name: 'price',
          label: 'Number With Precision',
          type: 'number',
          precision: 2,
        },
      },
      {
        uid: 'quantity',
        name: 'quantity',
        label: 'Input Number With Precision',
        type: 'input-number',
        precision: 1,
        index: 2,
        rawIndex: 2,
        toggled: true,
        pristine: {
          uid: 'quantity',
          name: 'quantity',
          label: 'Input Number With Precision',
          type: 'input-number',
          precision: 1,
        },
      },
      {
        uid: 'score',
        name: 'score',
        label: 'Number Without Precision',
        type: 'static-number',
        index: 3,
        rawIndex: 3,
        toggled: true,
        pristine: {
          uid: 'score',
          name: 'score',
          label: 'Number Without Precision',
          type: 'static-number',
        },
      },
    ],
  })
  store.initRows(
    [
      { id: 'integer-row', amount: 12, price: 5, quantity: 3, score: 8 },
      { id: 'decimal-row', amount: 12.34, price: 5.6, quantity: 3.4, score: 8.5 },
    ],
    (item) => item.id
  )
  const instance = createRendererInstance()
  instance.props = { ...instance.props, store }

  fileSaver.saveAs = (blob) => {
    savedBlob = blob
  }

  try {
    await instance.exportTableExcel(ExcelJS, {
      type: 'export-excel',
    })

    const deadline = Date.now() + 1000
    while (!savedBlob && Date.now() < deadline) {
      await wait(10)
    }

    assert.ok(savedBlob, 'expected export to save a workbook blob')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Buffer.from(await savedBlob.arrayBuffer()))
    const worksheet = workbook.getWorksheet('sheet')

    assert.equal(worksheet.getCell('A2').value, 12)
    assert.equal(worksheet.getCell('A2').numFmt, '0.000')
    assert.equal(worksheet.getCell('A3').value, 12.34)
    assert.equal(worksheet.getCell('A3').numFmt, '0.000')
    assert.equal(worksheet.getCell('B2').value, 5)
    assert.equal(worksheet.getCell('B2').numFmt, '0.00')
    assert.equal(worksheet.getCell('B3').value, 5.6)
    assert.equal(worksheet.getCell('B3').numFmt, '0.00')
    assert.equal(worksheet.getCell('C2').value, 3)
    assert.equal(worksheet.getCell('C2').numFmt, '0.0')
    assert.equal(worksheet.getCell('C3').value, 3.4)
    assert.equal(worksheet.getCell('C3').numFmt, '0.0')
    assert.equal(worksheet.getCell('D2').value, 8)
    assert.equal(worksheet.getCell('D2').numFmt, undefined)
    assert.equal(worksheet.getCell('D3').value, 8.5)
    assert.equal(worksheet.getCell('D3').numFmt, undefined)
  } finally {
    fileSaver.saveAs = originalSaveAs
  }
})

test('renderCell directly emits safe static text cells without invoking amis renderer lookup', () => {
  let renderCalls = 0
  const instance = createRendererInstance({
    classnames: cx,
    render: () => {
      renderCalls += 1
      return null
    },
    store: {
      filteredColumns: [{ name: 'status', type: 'static-text' }],
      getStickyStyles: () => [{ left: 12 }, 'is-left-fixed'],
    },
  })

  const cell = instance.renderCell(
    '0/0',
    {
      id: 'status',
      name: 'status',
      type: 'static-text',
      pristine: {
        name: 'status',
        type: 'static-text',
        popOver: undefined,
        style: {},
      },
    },
    {
      locals: {
        status: 'enabled',
      },
      rowSpans: {},
    },
    {
      key: 'status',
    }
  )

  assert.equal(cell.type, 'td')
  assert.equal(cell.props.children, 'enabled')
  assert.equal(cell.props.style.left, 12)
  assert.match(cell.props.className, /is-left-fixed/)
  assert.equal(renderCalls, 0)
})

test('renderCell keeps test id metadata when directly emitting safe static text cells', () => {
  let renderCalls = 0
  const instance = createRendererInstance({
    classnames: cx,
    render: () => {
      renderCalls += 1
      return null
    },
    testIdBuilder: {
      getChild: (key) => ({
        getTestId: () => ({
          'data-testid': key,
        }),
      }),
    },
    store: {
      filteredColumns: [{ name: 'status', type: 'static-text' }],
      getStickyStyles: () => [{}, ''],
    },
  })

  const cell = instance.renderCell(
    '0/0',
    {
      id: 'status',
      index: 3,
      name: 'status',
      type: 'static-text',
      pristine: {
        name: 'status',
        type: 'static-text',
      },
    },
    {
      locals: {
        status: 'enabled',
      },
      rowSpans: {},
    },
    {
      key: 'status',
      rowPath: '0',
    }
  )

  assert.equal(cell.type, 'td')
  assert.equal(cell.props.children, 'enabled')
  assert.equal(cell.props['data-testid'], 'cell-0-3')
  assert.equal(renderCalls, 0)
})

test('renderCell directly emits plain cells normalized from static text columns', () => {
  let renderCalls = 0
  const instance = createRendererInstance({
    classnames: cx,
    render: () => {
      renderCalls += 1
      return null
    },
    store: {
      filteredColumns: [{ name: 'status', type: 'plain' }],
      getStickyStyles: () => [{}, ''],
    },
  })

  const cell = instance.renderCell(
    '0/0',
    {
      id: 'status',
      name: 'status',
      type: 'plain',
      pristine: {
        name: 'status',
        placeholder: '-',
      },
    },
    {
      locals: {
        status: 'enabled',
      },
      rowSpans: {},
    },
    {
      key: 'status',
    }
  )

  assert.equal(cell.type, 'td')
  assert.equal(cell.props.children, 'enabled')
  assert.equal(renderCalls, 0)
})

test('renderCell directly emits simple static tpl cells without invoking amis renderer lookup', () => {
  let renderCalls = 0
  const instance = createRendererInstance({
    classnames: cx,
    render: () => {
      renderCalls += 1
      return null
    },
    store: {
      filteredColumns: [{ name: 'status' }],
      getStickyStyles: () => [{}, ''],
    },
  })

  const cell = instance.renderCell(
    '0/0',
    {
      id: 'status',
      name: 'status',
      pristine: {
        name: 'status',
        tpl: '${status}',
      },
    },
    {
      locals: {
        status: 'enabled',
      },
      rowSpans: {},
    },
    {
      key: 'status',
    }
  )

  assert.equal(cell.type, 'td')
  assert.equal(cell.props.children, 'enabled')
  assert.equal(renderCalls, 0)
})

test('renderCell directly emits static placeholders and classNameExpr cells', () => {
  const instance = createRendererInstance({
    classnames: cx,
    store: {
      filteredColumns: [{ name: 'score' }],
      getStickyStyles: () => [{}, 'is-sticky'],
    },
  })

  const emptyCell = instance.renderCell(
    '0/0',
    {
      id: 'score',
      name: 'score',
      pristine: {
        name: 'score',
        placeholder: '--',
      },
    },
    {
      locals: {
        score: '',
      },
      rowSpans: {},
    },
    {
      key: 'score-empty',
    }
  )
  const scaledCell = instance.renderCell(
    '0/1',
    {
      id: 'score',
      name: 'score',
      pristine: {
        name: 'score',
        className: 'score-cell',
        classNameExpr: "${scale == '2' ? 'raw-check-cell-alert' : ''}",
      },
    },
    {
      locals: {
        score: '42',
        scale: '2',
      },
      rowSpans: {},
    },
    {
      key: 'score-scaled',
    }
  )

  assert.equal(emptyCell.type, 'td')
  assert.equal(emptyCell.props.children.type, 'span')
  assert.equal(emptyCell.props.children.props.className, 'text-muted')
  assert.equal(emptyCell.props.children.props.children, '--')
  assert.equal(scaledCell.type, 'td')
  assert.match(scaledCell.props.className, /score-cell/)
  assert.match(scaledCell.props.className, /is-sticky/)
  assert.match(scaledCell.props.className, /raw-check-cell-alert/)
})

test('renderCell directly emits number, date and mapping display cells with matching text', () => {
  const instance = createRendererInstance({
    classnames: cx,
    store: {
      filteredColumns: [
        { name: 'amount', type: 'static-number' },
        { name: 'date', type: 'static-date' },
        { name: 'time', type: 'static-datetime' },
        { name: 'status', type: 'mapping' },
      ],
      getStickyStyles: () => [{}, ''],
    },
  })
  const render = (name, type, extra = {}) => instance.renderCell(
    `0/${name}`,
    {
      id: name,
      name,
      type,
      pristine: { name, type, ...extra },
    },
    {
      locals: {
        amount: 8,
        date: '2026-11-11',
        time: '2026-11-11T11:14:44',
        status: 'SALE',
      },
      rowSpans: {},
    },
    { key: name }
  )

  const amountCell = render('amount', 'static-number', { precision: 2 })
  assert.equal(amountCell.type, 'td')
  assert.equal(amountCell.props.children, '8.00')

  const dateCell = render('date', 'static-date')
  assert.equal(dateCell.type, 'td')
  assert.equal(dateCell.props.children, '2026-11-11')

  const timeCell = render('time', 'static-datetime', { format: 'YYYY-MM-DD HH:mm:ss' })
  assert.equal(timeCell.type, 'td')
  assert.equal(timeCell.props.children, '2026-11-11 11:14:44')

  const mappingCell = render('status', 'mapping', { map: { SALE: '销售正单' } })
  assert.equal(mappingCell.type, 'td')
  assert.equal(mappingCell.props.children, '销售正单')

  const emptyCell = instance.renderCell(
    '0/amount',
    {
      id: 'amount',
      name: 'amount',
      type: 'static-number',
      precision: 2,
      pristine: { name: 'amount', type: 'static-number', precision: 2 },
    },
    { locals: { amount: null }, rowSpans: {} },
    { key: 'amount-empty' }
  )
  assert.equal(emptyCell.type, 'td')
  assert.equal(emptyCell.props.children.type, 'span')
  assert.equal(emptyCell.props.children.props.className, 'text-muted')
  assert.equal(emptyCell.props.children.props.children, '-')
})

test('renderCell preserves column style when directly emitting display cells', () => {
  const instance = createRendererInstance({
    classnames: cx,
    store: {
      filteredColumns: [{ name: 'amount', type: 'static-number' }],
      getStickyStyles: () => [{ top: 0 }, 'is-sticky'],
    },
  })
  const cell = instance.renderCell(
    '0/amount',
    {
      id: 'amount',
      name: 'amount',
      type: 'static-number',
      precision: 2,
      className: 'amount-column',
      style: { '--table-cell-control-min-width': '110px' },
      pristine: {
        name: 'amount',
        type: 'static-number',
        precision: 2,
        className: 'amount-column',
        style: { '--table-cell-control-min-width': '110px' },
      },
    },
    { locals: { amount: 1 }, rowSpans: {} },
    { key: 'amount' }
  )

  assert.equal(cell.type, 'td')
  assert.match(cell.props.className, /amount-column/)
  assert.match(cell.props.className, /is-sticky/)
  assert.equal(cell.props.style['--table-cell-control-min-width'], '110px')
  assert.equal(cell.props.style.top, 0)
})

test('renderCell keeps complex tpl cells on the original amis cell path', () => {
  const instance = createRendererInstance({
    classnames: cx,
    store: {
      filteredColumns: [{ name: 'status' }],
      getStickyStyles: () => [{}, ''],
    },
  })

  const complexCell = instance.renderCell(
    '0/0',
    {
      id: 'status',
      name: 'status',
      pristine: {
        name: 'status',
        tpl: '状态：${status}',
      },
    },
    {
      locals: {
        status: 'enabled',
      },
      rowSpans: {},
    },
    {
      key: 'status-complex',
    }
  )
  const tplCell = instance.renderCell(
    '0/1',
    {
      id: 'status',
      name: 'status',
      type: 'tpl',
      pristine: {
        name: 'status',
        type: 'tpl',
        tpl: '${status}',
      },
    },
    {
      locals: {
        status: '<strong>enabled</strong>',
      },
      rowSpans: {},
    },
    {
      key: 'status-tpl',
    }
  )

  assert.notEqual(complexCell.type, 'td')
  assert.notEqual(tplCell.type, 'td')
})

test('renderCell keeps rich static-looking cells on the original amis cell path', () => {
  const instance = createRendererInstance({
    classnames: cx,
    store: {
      filteredColumns: [{ name: 'status', type: 'text' }],
      getStickyStyles: () => [{}, ''],
    },
  })

  const cell = instance.renderCell(
    '0/0',
    {
      id: 'status',
      name: 'status',
      type: 'text',
      pristine: {
        name: 'status',
        type: 'text',
        popOver: {
          body: 'detail',
        },
      },
    },
    {
      locals: {
        status: 'enabled',
      },
      rowSpans: {},
    },
    {
      key: 'status',
    }
  )

  assert.notEqual(cell.type, 'td')
})

test('renderCell keeps configured control columns on the original amis cell path', () => {
  const instance = createRendererInstance({
    classnames: cx,
    store: {
      filteredColumns: [
        { name: 'name', type: 'input-text' },
        { name: 'status', type: 'select' },
        { name: 'enabled', type: 'switch' },
      ],
      getStickyStyles: () => [{}, ''],
    },
  })

  ;[
    { name: 'name', type: 'input-text', value: 'Alice' },
    { name: 'status', type: 'select', value: 'enabled' },
    { name: 'enabled', type: 'switch', value: true },
  ].forEach((column, index) => {
    const cell = instance.renderCell(
      `0/${index}`,
      {
        id: column.name,
        index,
        name: column.name,
        type: column.type,
        pristine: {
          name: column.name,
          type: column.type,
        },
      },
      {
        locals: {
          [column.name]: column.value,
        },
        rowSpans: {},
      },
      {
        key: column.name,
        rowPath: '0',
      }
    )

    assert.notEqual(cell.type, 'td', `${column.type} should render through AMIS cell`)
  })
})

test('renderCell uses the AMIS native cell path for wide non-fixed columns when row lazy rendering is disabled', () => {
  const columns = Array.from({ length: 24 }, (_, index) => ({
    id: `field-${index}`,
    name: `field${index}`,
    type: 'text',
    index,
    fixed: '',
    pristine: {
      name: `field${index}`,
      type: 'text',
      popOver: {
        body: 'detail',
      },
    },
  }))
  const instance = createRendererInstance({
    classnames: cx,
    store: {
      filteredColumns: columns,
      rows: createPlainRows(2),
      lazyRenderAfter: Number.MAX_SAFE_INTEGER,
      multiple: false,
      getStickyStyles: () => [{}, ''],
    },
  })
  const column = {
    ...columns[21],
    pristine: {
      ...columns[21].pristine,
      popOver: {
        body: 'detail',
      },
    },
  }

  const cell = instance.renderCell(
    '0/21',
    column,
    {
      locals: {
        field21: 'enabled',
      },
      data: {
        field21: 'enabled',
      },
      rowSpans: {},
    },
    {
      key: 'field21',
      rowPath: '0',
    }
  )

  assert.equal(cell.props.cellKey, undefined)
  assert.equal(cell.props.deferRender, undefined)
})

test('renderCell renders wide non-fixed cells directly when row lazy rendering is active', () => {
  const columns = Array.from({ length: 24 }, (_, index) => ({
    id: `field-${index}`,
    name: `field${index}`,
    type: 'text',
    index,
    fixed: '',
    pristine: {
      name: `field${index}`,
      type: 'text',
    },
  }))
  const instance = createRendererInstance({
    classnames: cx,
    store: {
      filteredColumns: columns,
      rows: [{ id: 'row-1' }, { id: 'row-2' }],
      lazyRenderAfter: 1,
      multiple: false,
      getStickyStyles: () => [{}, ''],
    },
  })
  const column = {
    ...columns[21],
    pristine: {
      ...columns[21].pristine,
      popOver: {
        body: 'detail',
      },
    },
  }

  const cell = instance.renderCell(
    '0/21',
    column,
    {
      locals: {
        field21: 'enabled',
      },
      data: {
        field21: 'enabled',
      },
      rowSpans: {},
    },
    {
      key: 'field21',
      rowPath: '0',
    }
  )

  assert.equal(cell.props.cellKey, undefined)
  assert.equal(cell.props.deferRender, undefined)
  assert.equal(cell.props.column, column)
})

test('renderCell keeps operation cells immediate when row lazy rendering is active', () => {
  const columns = Array.from({ length: 24 }, (_, index) => ({
    id: `field-${index}`,
    name: `field${index}`,
    type: 'text',
    index,
    fixed: '',
    pristine: {
      name: `field${index}`,
      type: 'text',
    },
  }))
  const operationColumn = {
    id: 'operation',
    type: 'operation',
    index: 24,
    fixed: '',
    pristine: {
      type: 'operation',
      buttons: [{ type: 'button', label: 'Delete' }],
    },
  }
  const instance = createRendererInstance({
    classnames: cx,
    store: {
      filteredColumns: columns.concat(operationColumn),
      rows: [{ id: 'row-1' }, { id: 'row-2' }],
      lazyRenderAfter: 1,
      multiple: false,
      getStickyStyles: () => [{}, ''],
    },
  })

  const cell = instance.renderCell(
    '0/24',
    operationColumn,
    {
      locals: {
        name: 'enabled',
      },
      data: {
        name: 'enabled',
      },
      rowSpans: {},
    },
    {
      key: 'operation',
      rowPath: '0',
      rowIndexPath: '0',
    }
  )

  assert.notEqual(cell.props.cellKey, '0:24')
  assert.equal(cell.props.deferRender, undefined)
})

test('renderCell keeps styled static text cells on the original amis cell path', () => {
  const instance = createRendererInstance({
    classnames: cx,
    store: {
      filteredColumns: [{ name: 'status', type: 'text' }],
      getStickyStyles: () => [{}, ''],
    },
  })

  const styledCell = instance.renderCell(
    '0/0',
    {
      id: 'status',
      name: 'status',
      type: 'text',
      pristine: {
        name: 'status',
        type: 'text',
        align: 'right',
      },
    },
    {
      locals: {
        status: 'enabled',
      },
      rowSpans: {},
    },
    {
      key: 'status',
    }
  )

  const scaledCell = instance.renderCell(
    '0/1',
    {
      id: 'score',
      name: 'score',
      type: 'text',
      pristine: {
        name: 'score',
        type: 'text',
        backgroundScale: {
          min: 0,
          max: 100,
        },
      },
    },
    {
      locals: {
        score: 42,
      },
      rowSpans: {},
    },
    {
      key: 'score',
    }
  )

  assert.notEqual(styledCell.type, 'td')
  assert.notEqual(scaledCell.type, 'td')
})

test('renderHeadCell keeps search, sort, and filter affordances on the patched table head', () => {
  const instance = createRendererInstance({
    classnames: cx,
    render: (name, schema) => ({ name, schema }),
    onQuery: () => true,
    store: {
      filteredColumns: [],
      exportExcelLoading: false,
      getStickyStyles: () => [{}, 'sticky-class'],
      orderBy: '',
      orderDir: '',
      isNested: false,
    },
  })

  const headerCell = instance.renderHeadCell(
    {
      name: 'status',
      label: '状态',
      searchable: { type: 'input-text' },
      sortable: true,
      type: 'text',
      pristine: {
        className: 'status-col',
        labelClassName: 'status-label',
      },
    },
    {
      style: {},
      className: 'head',
    }
  )

  const headContent = headerCell.props.children[1]
  const affix = headContent.props.children[2]

  assert.equal(headerCell.type, 'th')
  assert.match(headerCell.props.className, /TableCell--sortable/)
  assert.match(headerCell.props.className, /TableCell--searchable/)
  assert.equal(affix.length, 2)
})

test('Table.scss keeps operation icon link buttons readable and targetable', () => {
  const source = readRootFile('src/components/amis/renderers/patch/Table.scss')

  assert.match(source, /--table-operation-button-gap:\s*4px/)
  assert.match(source, /--table-operation-icon-button-gap:\s*4px/)
  assert.match(source, /--table-operation-icon-button-size:\s*22px/)
  assert.match(
    source,
    /\.cxd-Table-table\s+\.cxd-OperationField\s*\{[\s\S]*?gap:\s*var\(--table-operation-button-gap\)/
  )
  assert.match(
    source,
    /\.cxd-OperationField:has\([\s\S]*?\.cxd-Button--iconOnly[\s\S]*?\)\s*\{[\s\S]*?gap:\s*var\(--table-operation-icon-button-gap\)/
  )
  assert.match(
    source,
    /\.cxd-OperationField:has\([\s\S]*?\.cxd-Button--link\s*>\s*\.cxd-Button-icon:only-child[\s\S]*?\)\s*\{[\s\S]*?gap:\s*var\(--table-operation-icon-button-gap\)/
  )
  assert.match(
    source,
    /\.cxd-Button--link:has\(>\s*\.cxd-Button-icon:only-child\)[\s\S]*?width:\s*var\(--table-operation-icon-button-size\)/
  )
  assert.match(
    source,
    /\.cxd-Button--link:has\(>\s*\.cxd-Button-icon:only-child\)[\s\S]*?height:\s*var\(--table-operation-icon-button-size\)/
  )
  assert.match(
    source,
    /tr:hover\s*>\s*td\.cxd-Table-operationCell[\s\S]*?background:\s*var\(--Table-onHover-bg\)/
  )
  assert.match(
    source,
    /tr\.is-hovered\s*>\s*td\.cxd-Table-operationCell[\s\S]*?background:\s*var\(--Table-onHover-bg\)/
  )
  assert.match(
    source,
    /td:has\(>\s*\.cxd-OperationField\)[\s\S]*?background:\s*var\(--Table-bg\)/
  )
  assert.match(
    source,
    /tr:hover\s*>\s*td:has\(>\s*\.cxd-OperationField\)[\s\S]*?background:\s*var\(--Table-onHover-bg\)/
  )
})

test('renderHeadCell keeps filter dropdown support on non-searchable filterable columns', () => {
  const instance = createRendererInstance({
    classnames: cx,
    render: (name, schema) => ({ name, schema }),
    onQuery: () => true,
    store: {
      filteredColumns: [],
      exportExcelLoading: false,
      getStickyStyles: () => [{}, 'sticky-class'],
      orderBy: '',
      orderDir: '',
      isNested: false,
    },
  })

  const headerCell = instance.renderHeadCell(
    {
      name: 'status',
      label: '状态',
      filterable: {
        options: [
          { label: '启用', value: 'enabled' },
          { label: '停用', value: 'disabled' },
        ],
      },
      type: 'text',
      pristine: {
        className: 'status-col',
        labelClassName: 'status-label',
      },
    },
    {
      style: {},
      className: 'head',
    }
  )

  const headContent = headerCell.props.children[1]
  const affix = headContent.props.children[2]

  assert.match(headerCell.props.className, /TableCell--filterable/)
  assert.equal(affix.length, 1)
})

test('input-table passes cooperative loading duration into nested table schema', () => {
  const { buildInputTablePatchedTableSchema } = loadInputTableRenderModule()
  const { INPUT_TABLE_SCROLL_CONTAINER_CLASS } =
    loadInputTableInlineEditPresentationModule()
  const inputTableSchema = buildInputTablePatchedTableSchema({
    addButtonPosition: 'bottom-left',
    columnsTogglable: false,
    lazyRenderAfter: 10,
    loadingMaxDuration: 2000,
    renderProps: {},
    schema: {
      tableContentClassName: 'table-body',
    },
    shouldRenderTopAddButton: false,
  })

  assert.equal(
    inputTableSchema.tableContentClassName,
    `table-body ${INPUT_TABLE_SCROLL_CONTAINER_CLASS}`
  )
  assert.equal(inputTableSchema.lazyRenderAfter, 10)
  assert.equal(inputTableSchema.lazyRenderAfterExplicit, true)
  assert.equal(inputTableSchema.loadingMaxDuration, 2000)
})

test('performance fingerprint tracks every input-table runtime source file', () => {
  const fs = require('node:fs')
  const inputTableDir = 'src/components/amis/renderers/patch/InputTable'
  const { collectInputTableRuntimeSourceFiles } = require(
    path.join(process.cwd(), 'scripts/write-amis-main-thread-performance-fingerprint.js')
  )

  assert.deepEqual(
    collectInputTableRuntimeSourceFiles(),
    fs
      .readdirSync(path.join(process.cwd(), inputTableDir))
      .filter((fileName) => /\.(ts|tsx)$/.test(fileName))
      .map((fileName) => `${inputTableDir}/${fileName}`)
      .sort()
  )
})

test('table selection notifications are deferred until after checkbox paint', () => {
  const source = readRootFile(
    'src/components/amis/renderers/patch/Table.tsx'
  )

  assert.match(source, /function deferSelectionNotification\(/)
  assert.match(source, /deferSelectionNotification\(async \(\) => \{[\s\S]*this\.syncSelected\(\)/)
  assert.match(source, /deferSelectionNotification\(async \(\) => \{[\s\S]*dispatchEvent\(/)
})

test('enhanced column toggler renders the lts-v1 svg icon contract', () => {
  const fs = require('node:fs')
  const { EnhancedColumnToggler } = loadEnhancedColumnTogglerModule()
  const instance = new EnhancedColumnToggler({
    classnames: cx,
    classPrefix: 'cxd',
    columns: [
      {
        id: 'name',
        name: 'name',
        label: 'Name',
        toggled: true,
        fixed: 'left',
        originalIndex: 0,
        currentIndex: 0,
      },
    ],
    env: {},
    isOpened: true,
    onCancel: noop,
    onClose: noop,
    onConfirm: noop,
    onReset: noop,
    render: noop,
    translate: (value) => value,
  })
  const rendered = instance.render()
  const icons = collectReactPropValues(rendered, 'icon')

  assert.ok(icons.includes('vxe-drag-handle'))
  assert.ok(icons.includes('fixed-left-fill'))
  assert.ok(icons.includes('fixed-left'))
  assert.ok(fs.existsSync(path.join(process.cwd(), 'src/icons/svg/vxe-drag-handle.svg')))
  assert.ok(fs.existsSync(path.join(process.cwd(), 'src/icons/svg/fixed-left.svg')))
  assert.ok(fs.existsSync(path.join(process.cwd(), 'src/icons/svg/fixed-left-fill.svg')))
})

test('column reset uses the current public translation and preserves cancellation', async () => {
  const { EnhancedColumnToggler } = loadEnhancedColumnTogglerModule()
  let didReset = false
  const confirmations = []
  const instance = new EnhancedColumnToggler({
    columns: [],
    env: {
      confirm: async (...args) => {
        confirmations.push(args)
        return false
      },
    },
    onReset: () => {
      didReset = true
    },
  })
  i18nMessages['table.columns.resetConfirm'] = 'Restore default columns?'
  try {
    await instance.handleReset()
    assert.deepEqual(confirmations, [['Restore default columns?']])
    assert.equal(didReset, false)
  } finally {
    delete i18nMessages['table.columns.resetConfirm']
  }
})

test('table lazy rendering defaults off and requires explicit enable', () => {
  const {
    isTableLazyRenderGloballyDisabled,
    syncTableLazyRenderSystemConfig,
  } = requireMirroredSrcModule(__filename, './tableLazyRenderSwitch.ts')

  try {
    globalThis.__OUROBOROS_TABLE_LAZY_RENDER__ = undefined
    if (globalThis.localStorage && typeof globalThis.localStorage.removeItem === 'function') {
      globalThis.localStorage.removeItem('ouroboros.table.lazyRender')
    }

    syncTableLazyRenderSystemConfig(undefined)
    assert.equal(isTableLazyRenderGloballyDisabled(), true)

    syncTableLazyRenderSystemConfig({
      'ui.table.lazyRender.enabled': true,
    })
    assert.equal(isTableLazyRenderGloballyDisabled(), false)

    syncTableLazyRenderSystemConfig({
      'ui.table.lazyRender.enabled': false,
    })
    assert.equal(isTableLazyRenderGloballyDisabled(), true)
  } finally {
    globalThis.__OUROBOROS_TABLE_LAZY_RENDER__ = true
    syncTableLazyRenderSystemConfig({
      'ui.table.lazyRender.enabled': true,
    })
  }
})
