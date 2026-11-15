/* @vitest-environment jsdom */

const assert = require('node:assert/strict')
const path = require('node:path')

const { clearMirroredSrcModuleCache, registerTypescriptRequire } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

registerTypescriptRequire()

const noop = () => undefined
const ignoreScss = () => undefined
const translations = {
  search: '搜索',
  reset: '重置',
  'CRUD.filter': '筛选',
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
  global.self = window
  global.requestAnimationFrame = (callback) => setTimeout(callback, 0)
  global.cancelAnimationFrame = (id) => clearTimeout(id)
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
}

function loadCrudRendererClass() {
  installBrowserLikeGlobals()
  require.extensions['.scss'] = ignoreScss
  clearMirroredSrcModuleCache(__filename, '.')

  const WrappedRenderer = require(
    path.join(process.cwd(), 'src/components/amis/renderers/patch/CRUD.tsx')
  ).default

  return WrappedRenderer.ComposedComponent
}

function createRendererInstance(props = {}) {
  const Renderer = loadCrudRendererClass()
  const defaultStore = {
    filterTogglable: false,
    filterVisible: true,
    filterData: {},
    query: {},
    setFilterTogglable: noop,
    setFilterVisible: noop,
    changePage: noop,
    updateData: noop,
    updateQuery: noop,
  }
  const mergedProps = {
    render: (name, schema, renderProps) => ({
      name,
      schema,
      props: renderProps,
    }),
    translate: (value) => translations[value] || value,
    classnames: cx,
    data: {},
    query: {},
    store: {
      ...defaultStore,
      ...(props.store || {}),
    },
    ...Object.fromEntries(Object.entries(props).filter(([key]) => key !== 'store')),
  }

  const instance = new Renderer(mergedProps, {
    registerComponent: noop,
    unRegisterComponent: noop,
  })

  instance.renderToolbar = (toolbar) => toolbar
  instance.forceUpdate = noop

  return instance
}

function createRenderBodyStore(overrides = {}) {
  return {
    columns: [{ name: 'title', label: '标题' }],
    data: {
      items: [],
    },
    itemsAsArray: [],
    mergedData: {},
    query: {},
    selectedItemsAsArray: [],
    loading: false,
    offset: 0,
    ...overrides,
  }
}

test('renderHeaderToolbar injects columns-toggler and collapses current/all export toolbars for table crud', () => {
  const instance = createRendererInstance({
    mode: 'table',
    headerToolbar: [
      { type: 'export-excel', label: '导出当前页' },
      { type: 'export-excel', label: '导出全部' },
    ],
  })

  const toolbars = instance.renderHeaderToolbar({})

  assert.deepEqual(toolbars[0], { type: 'columns-toggler' })
  assert.equal(toolbars[1].type, 'export-excel')
  assert.equal(Array.isArray(toolbars[1].buttons), true)
  assert.deepEqual(
    toolbars[1].buttons.map((item) => item.label),
    ['导出当前页', '导出全部']
  )
})

test('renderBody keeps direct page-body crud autoFillHeight on by default', () => {
  const instance = createRendererInstance({
    $path: 'page/body/0/crud',
    store: createRenderBodyStore(),
  })

  const rendered = instance.renderBody()

  assert.equal(rendered.props.autoFillHeight, true)
})

test('renderBody leaves nested crud out of autoFillHeight by default but preserves explicit opt-in', () => {
  const nestedInstance = createRendererInstance({
    $path: 'page/body/0/form/0/amis-schema/wrapper/body/1/tabs/tab/0/1/panel/body/2/crud',
    store: createRenderBodyStore(),
  })

  assert.equal(nestedInstance.renderBody().props.autoFillHeight, false)

  const explicitOptInInstance = createRendererInstance({
    $path: 'page/body/0/form/0/amis-schema/wrapper/body/1/tabs/tab/0/1/panel/body/2/crud',
    autoFillHeight: true,
    store: createRenderBodyStore(),
  })

  assert.equal(explicitOptInInstance.renderBody().props.autoFillHeight, true)
})

test('renderBody leaves crud without a direct page-body path out of autoFillHeight by default', () => {
  const instance = createRendererInstance({
    store: createRenderBodyStore(),
  })

  assert.equal(instance.renderBody().props.autoFillHeight, false)
})

test('renderBody preserves configured control columns for table crud body', () => {
  const columns = [
    {
      name: 'name',
      type: 'input-text',
    },
    {
      name: 'status',
      type: 'select',
      options: [
        {
          label: 'Enabled',
          value: 'enabled',
        },
      ],
      textOverflow: 'ellipsis',
    },
    {
      name: 'enabled',
      type: 'switch',
    },
  ]
  const instance = createRendererInstance({
    mode: 'table',
    store: createRenderBodyStore({
      columns,
    }),
  })

  const rendered = instance.renderBody()

  assert.equal(rendered.schema.type, 'table')
  assert.equal(rendered.schema.columns[0].type, 'input-text')
  assert.equal(rendered.schema.columns[0].static, undefined)
  assert.equal(rendered.schema.columns[1].type, 'select')
  assert.equal(rendered.schema.columns[1].static, undefined)
  assert.equal(rendered.schema.columns[2].type, 'switch')
  assert.equal(rendered.schema.columns[2].static, undefined)
})

test('filterBodySchema recursively patches ellipsis columns without mutating the input schema', () => {
  const nestedColumn = {
    name: 'profile.name',
    type: 'static-text',
    textOverflow: 'ellipsis',
    width: 160,
  }
  const schema = {
    type: 'table',
    columns: [
      {
        name: 'group',
        children: [nestedColumn],
      },
      {
        name: 'disabled',
        textOverflow: 'ellipsis',
        popOver: false,
      },
    ],
  }
  const instance = createRendererInstance()

  const patched = instance.filterBodySchema(schema)
  const patchedNestedColumn = patched.columns[0].children[0]

  assert.notEqual(patched, schema)
  assert.notEqual(patched.columns[0], schema.columns[0])
  assert.equal(nestedColumn.popOver, undefined)
  assert.equal(patchedNestedColumn.popOverEnableOn, '${profile.name}')
  assert.deepEqual(patchedNestedColumn.popOver, {
    trigger: 'hover',
    showIcon: false,
    popOverClassName: 'table-cell-popover',
    position:
      'center-bottom-center-top center-top-center-bottom left-bottom-left-top right-bottom-right-top left-top-left-bottom right-top-right-bottom',
    body: {
      ...nestedColumn,
      label: false,
      static: true,
      textOverflow: undefined,
      popOver: undefined,
      width: undefined,
    },
  })
  assert.equal(patched.columns[1].popOver, false)
})

test('renderHeaderToolbar keeps non-table crud free of columns-toggler injection and export regrouping', () => {
  const headerToolbar = [
    { type: 'export-excel', label: '导出当前页' },
    { type: 'export-excel', label: '导出全部' },
  ]
  const instance = createRendererInstance({
    mode: 'cards',
    headerToolbar,
  })

  const toolbars = instance.renderHeaderToolbar({})

  assert.deepEqual(toolbars, headerToolbar)
})

test('renderFilter moves filter actions into a trailing button-toolbar', () => {
  const instance = createRendererInstance({
    filter: {
      actions: [{ type: 'submit', label: '立即查' }],
      body: [{ type: 'input-text', name: 'keyword' }],
    },
  })

  const rendered = instance.renderFilter()
  const body = rendered.schema.body

  assert.equal(body.length, 2)
  assert.equal(body[0].type, 'input-text')
  assert.equal(body[0].name, 'keyword')
  assert.match(body[0].columnClassName, /crud-filter-item--field/)
  assert.equal(body[1].type, 'button-toolbar')
  assert.deepEqual(body[1].buttons, [{ type: 'submit', label: '立即查' }])
  assert.match(body[1].columnClassName, /crud-filter-item--toolbar/)
  assert.deepEqual(rendered.schema.actions, [])
})

test('renderFilter adds default search/reset only when no action control exists and forces smartLayout off', () => {
  const instance = createRendererInstance({
    filter: {
      controls: [{ type: 'input-text', name: 'keyword' }],
    },
  })

  const rendered = instance.renderFilter()
  const toolbar = rendered.schema.body[1]

  assert.equal(toolbar.type, 'button-toolbar')
  assert.deepEqual(
    toolbar.buttons.map((button) => button.label),
    ['搜索', '重置']
  )
  assert.equal(rendered.schema.smartLayout, false)
  assert.equal(rendered.schema.className, 'crud-filter-form')
  assert.equal(rendered.props.panelClassName, 'Crud-filter Crud-filter--flat')
})

test('renderFilter does not duplicate default buttons when the body already owns an action control', () => {
  const instance = createRendererInstance({
    filter: {
      body: [
        { type: 'input-text', name: 'keyword' },
        { type: 'button-toolbar', buttons: [{ type: 'submit', label: '已有搜索' }] },
      ],
    },
  })

  const rendered = instance.renderFilter()

  assert.equal(rendered.schema.body.length, 2)
  assert.equal(rendered.schema.body[1].type, 'button-toolbar')
  assert.deepEqual(rendered.schema.body[1].buttons, [
    { type: 'submit', label: '已有搜索' },
  ])
  assert.match(rendered.schema.body[1].columnClassName, /crud-filter-item--toolbar/)
})

test('renderBody passes table lazy loading duration config through schema output', () => {
  const instance = createRendererInstance({
    mode: 'table',
    lazyRenderAfter: 10,
    loadingMaxDuration: 2000,
    store: createRenderBodyStore(),
  })

  const rendered = instance.renderBody()

  assert.equal(rendered.schema.lazyRenderAfter, 10)
  assert.equal(rendered.schema.lazyRenderAfterExplicit, true)
  assert.equal(rendered.schema.loadingMaxDuration, 2000)
})

test('renderFilter treats explicit empty actions as toolbar opt-out and clears stale layout render-state', () => {
  const instance = createRendererInstance({
    filter: {
      actions: [],
      body: [{ type: 'input-text', name: 'keyword' }],
    },
  })

  const rendered = instance.renderFilter()

  assert.deepEqual(rendered.schema.body, [
    {
      type: 'input-text',
      name: 'keyword',
      columnClassName:
        'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--span-1 crud-filter-item--first-compact',
    },
  ])
  assert.equal(rendered.schema.className, 'crud-filter-form')
  assert.deepEqual(rendered.schema.style, { '--crud-filter-columns': '5' })
})

test('CRUD renderer delegates filter lifecycle and schema rendering through smart layout runtime', () => {
  const instance = createRendererInstance({
    data: {
      SystemConfig: {
        ui: {
          crud: {
            filter: {
              smartLayout: {
                enabled: true,
              },
            },
          },
        },
      },
    },
    filter: {
      body: [{ type: 'input-text', name: 'keyword' }],
    },
  })
  const basePrototype = Object.getPrototypeOf(Object.getPrototypeOf(instance))
  const originalBaseLifecycle = {
    componentDidMount: basePrototype.componentDidMount,
    componentDidUpdate: basePrototype.componentDidUpdate,
    componentWillUnmount: basePrototype.componentWillUnmount,
  }
  const calls = []

  basePrototype.componentDidMount = () => calls.push('super:mount')
  basePrototype.componentDidUpdate = () => calls.push('super:update')
  basePrototype.componentWillUnmount = () => calls.push('super:unmount')
  instance.filterSmartLayoutRuntime.syncLifecycle = (filter, systemConfig) =>
    calls.push({ type: 'runtime:sync', filter, systemConfig })
  instance.filterSmartLayoutRuntime.dispose = () => calls.push('runtime:dispose')
  instance.filterSmartLayoutRuntime.renderFilter = ({
    filter,
    systemConfig,
    translate,
  }) => {
    calls.push({ type: 'runtime:render', filter, systemConfig })

    return {
      title: translate('CRUD.filter'),
      mode: 'inline',
      submitText: translate('search'),
      className: 'crud-filter-form runtime-class',
      style: {
        '--crud-filter-columns': '3',
      },
      body: [{ type: 'input-text', name: 'keyword' }],
      actions: [],
      smartLayout: false,
      type: 'form',
      api: null,
      snapshotMarker: 'runtime-snapshot',
    }
  }

  try {
    instance.componentDidMount()
    instance.componentDidUpdate(instance.props)
    const rendered = instance.renderFilter()
    instance.componentWillUnmount()

    assert.deepEqual(calls, [
      'super:mount',
      {
        type: 'runtime:sync',
        filter: instance.props.filter,
        systemConfig: instance.props.data.SystemConfig,
      },
      'super:update',
      {
        type: 'runtime:sync',
        filter: instance.props.filter,
        systemConfig: instance.props.data.SystemConfig,
      },
      {
        type: 'runtime:render',
        filter: instance.props.filter,
        systemConfig: instance.props.data.SystemConfig,
      },
      'runtime:dispose',
      'super:unmount',
    ])
    assert.equal(rendered.schema.snapshotMarker, 'runtime-snapshot')
    assert.match(rendered.schema.className, /runtime-class/)
    assert.equal(rendered.schema.style['--crud-filter-columns'], '3')
  } finally {
    Object.assign(basePrototype, originalBaseLifecycle)
  }
})

test('renderFilter uses system config as the default smart layout enable switch', () => {
  const instance = createRendererInstance({
    data: {
      SystemConfig: {
        ui: {
          crud: {
            filter: {
              smartLayout: {
                enabled: false,
              },
            },
          },
        },
      },
    },
    filter: {
      body: [{ type: 'input-text', name: 'keyword' }],
    },
  })

  const rendered = instance.renderFilter()

  assert.equal(rendered.schema.body[0].columnClassName, undefined)
})

test('renderFilter treats wrapWithPanel=false as a default toolbar opt-out', () => {
  const instance = createRendererInstance({
    filter: {
      wrapWithPanel: false,
      body: [{ type: 'input-text', name: 'keyword' }],
    },
  })

  const rendered = instance.renderFilter()

  assert.deepEqual(rendered.schema.body, [
    {
      type: 'input-text',
      name: 'keyword',
      columnClassName:
        'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--span-1 crud-filter-item--first-compact',
    },
  ])
  assert.equal(rendered.schema.wrapWithPanel, false)
  assert.equal(rendered.schema.className, 'crud-filter-form')
  assert.deepEqual(rendered.schema.style, { '--crud-filter-columns': '5' })
})

test('renderFilter keeps explicit filter actions when wrapWithPanel=false', () => {
  const instance = createRendererInstance({
    filter: {
      wrapWithPanel: false,
      actions: [{ type: 'submit', label: '仅查询', level: 'primary' }],
      body: [{ type: 'input-text', name: 'keyword' }],
    },
  })

  const rendered = instance.renderFilter()

  assert.deepEqual(rendered.schema.body, [
    {
      type: 'input-text',
      name: 'keyword',
      columnClassName:
        'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--span-1 crud-filter-item--first-compact',
    },
    {
      className: 'crud-filter-toolbar',
      type: 'button-toolbar',
      label: false,
      buttons: [{ type: 'submit', label: '仅查询', level: 'primary' }],
      columnClassName:
        'crud-filter-item crud-filter-item--index-1 crud-filter-item--span-1 crud-filter-item--toolbar',
    },
  ])
})

test('handleFilterInit searches with the finalized form store data after filter init hooks', () => {
  const submitCalls = []
  const instance = createRendererInstance({
    defaultParams: {
      tenant: 'default',
    },
    orderBy: 'createdAt',
    orderDir: 'desc',
    initFetch: true,
    store: {
      query: {
        page: 3,
      },
      setPristineQuery: noop,
    },
  })

  instance.handleFilterSubmit = (...args) => {
    submitCalls.push(args)
  }

  instance.handleFilterInit(
    {
      keyword: 'before-hook',
    },
    {
      store: {
        data: {
          keyword: 'after-hook',
          status: 'enabled',
        },
      },
    }
  )

  assert.equal(submitCalls.length, 1)
  assert.deepEqual(submitCalls[0][0], {
    tenant: 'default',
    keyword: 'after-hook',
    status: 'enabled',
    orderBy: 'createdAt',
    orderDir: 'desc',
    page: 3,
  })
  assert.equal(submitCalls[0][1], false)
  assert.equal(submitCalls[0][2], true)
  assert.equal(submitCalls[0][3], true)
  assert.equal(submitCalls[0][4], true)
})

test('handleFilterReset clears query and only triggers search for plain reset actions', () => {
  const updateCalls = []
  const instance = createRendererInstance({
    store: {
      query: { keyword: 'before' },
      updateQuery: (...args) => {
        updateCalls.push(args)
        instance.props.store.query = { keyword: '' }
      },
    },
  })
  let searchCalls = 0
  instance.search = () => {
    searchCalls += 1
  }

  instance.handleFilterReset({ keyword: 'abc', status: 'enabled' }, {})
  assert.equal(searchCalls, 1)
  assert.deepEqual(updateCalls[0][0], { keyword: '', status: '' })

  instance.handleFilterReset({ keyword: 'abc' }, { actionType: 'clear-and-submit' })
  assert.equal(searchCalls, 1)
  assert.deepEqual(updateCalls[1][0], { keyword: '' })
})

test('filterBodySchema defaults checkOnItemClick when CRUD is selectable', () => {
  const instance = createRendererInstance({
    selectable: true,
  })

  assert.deepEqual(
    instance.filterBodySchema({
      type: 'table',
      columns: [],
    }),
    {
      type: 'table',
      columns: [],
      checkOnItemClick: true,
    }
  )
})

test('filterBodySchema preserves explicit checkOnItemClick and raw schemas', () => {
  const instance = createRendererInstance({
    selectable: true,
  })

  assert.deepEqual(
    instance.filterBodySchema({
      type: 'table',
      columns: [],
      checkOnItemClick: false,
    }),
    {
      type: 'table',
      columns: [],
      checkOnItemClick: false,
    }
  )
  assert.equal(instance.filterBodySchema('raw-schema'), 'raw-schema')
})

test('filterBodySchema only treats active bulk action toolbars as selectable defaults', () => {
  const activeBulkRenderer = createRendererInstance({
    selectable: false,
  })
  activeBulkRenderer.hasBulkActionsToolbar = () => true
  activeBulkRenderer.hasBulkActions = () => true

  assert.deepEqual(
    activeBulkRenderer.filterBodySchema({
      type: 'table',
      columns: [],
    }),
    {
      type: 'table',
      columns: [],
      checkOnItemClick: true,
    }
  )

  const hiddenBulkRenderer = createRendererInstance({
    selectable: false,
  })
  hiddenBulkRenderer.hasBulkActionsToolbar = () => false
  hiddenBulkRenderer.hasBulkActions = () => true

  assert.deepEqual(
    hiddenBulkRenderer.filterBodySchema({
      type: 'table',
      columns: [],
    }),
    {
      type: 'table',
      columns: [],
    }
  )
})
