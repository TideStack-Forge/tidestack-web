const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const Module = require('node:module')
const React = require('react')
const ts = require('typescript')

const { mainAppRoot } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)
const repoRoot = path.resolve(mainAppRoot, '..', '..', '..')

function transpileFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
    fileName: filePath,
  }).outputText
}

function loadDashboardEmptyStateSurfaceModule() {
  const filePath = path.join(
    mainAppRoot,
    'src/components/amis/renderers/dashboard/DashboardEmptyStateSurface.tsx'
  )
  const module = { exports: {} }
  const localRequire = Module.createRequire(filePath)
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (request) => {
      if (request === 'react') {
        return React
      }
      return localRequire(request)
    },
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console,
  })

  new vm.Script(transpileFile(filePath), { filename: filePath }).runInContext(context)
  return module.exports
}

function createMockEventBus() {
  const handlers = {}
  return {
    handlers,
    subscribe(event, handler) {
      if (!handlers[event]) {
        handlers[event] = []
      }
      if (!handlers[event].includes(handler)) {
        handlers[event].push(handler)
      }
    },
    unsubscribe(event, handler) {
      if (!handlers[event]) {
        return
      }
      handlers[event] = handlers[event].filter((current) => current !== handler)
    },
    publish(event, data) {
      ;(handlers[event] || []).forEach((handler) => handler(data))
    },
  }
}

function loadDashboardModule() {
  const filePath = path.join(
    mainAppRoot,
    'src/components/amis/renderers/dashboard/Dashboard.tsx'
  )
  const module = { exports: {} }
  const localRequire = Module.createRequire(filePath)
  const emptyStateSurfaceModule = loadDashboardEmptyStateSurfaceModule()
  const eventBus = createMockEventBus()
  const amisMock = {
    FormItem: () => () => undefined,
    toast: {
      error: () => undefined,
      success: () => undefined,
    },
    createObject: (base, extra) => ({ ...(base || {}), ...(extra || {}) }),
    buildApi: (apiConfig) => apiConfig,
  }

  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (request) => {
      if (request === 'react') {
        return React
      }
      if (request === 'amis') {
        return amisMock
      }
      if (request === 'react-grid-layout') {
        return {
          Responsive: 'responsive-grid',
          WidthProvider: (component) => component,
        }
      }
      if (request === './common') {
        return {
          createWidgetInstance: (widgetDefinition, config, styleConfig) => ({
            id: `${widgetDefinition.name}-mock`,
            widgetName: widgetDefinition.name,
            position: { x: 0, y: 0 },
            size: { ...(widgetDefinition.defaultSize || { cols: 1, rows: 1 }) },
            config: { ...(config ?? widgetDefinition.defaultConfig ?? {}) },
            styleConfig: styleConfig ?? widgetDefinition.defaultStyleConfig,
          }),
          getWidgetLayoutConfig: () => ({}),
        }
      }
      if (request === './WidgetEditableWrapper') {
        return {
          WidgetWrapper: ({ children }) => React.createElement('widget-wrapper', null, children),
        }
      }
      if (request === './DashboardEditToolbar') {
        return {
          DashboardEditToolbar: (props) =>
            React.createElement('dashboard-edit-toolbar', props),
        }
      }
      if (request === './DashboardEmptyStateSurface') {
        return emptyStateSurfaceModule
      }
      if (request === '@/common/eventBus') {
        return {
          EventBus: eventBus,
        }
      }
      if (request.endsWith('.scss') || request.endsWith('.css')) {
        return undefined
      }
      return localRequire(request)
    },
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console,
  })

  new vm.Script(transpileFile(filePath), { filename: filePath }).runInContext(context)
  return {
    Dashboard: module.exports.Dashboard,
    DashboardEmptyStateSurface: emptyStateSurfaceModule.DashboardEmptyStateSurface,
    eventBus,
  }
}

function createDashboardInstance(overrides = {}) {
  const { Dashboard, DashboardEmptyStateSurface, eventBus } = loadDashboardModule()
  const props = {
    value: { widgets: [] },
    size: { width: 1200, height: 800 },
    widgetDefinitions: [],
    editable: true,
    render: (name, schema, renderProps) => ({
      name,
      schema,
      props: renderProps,
    }),
    classnames: (...tokens) => tokens.filter(Boolean).join(' '),
    data: { currentUser: 'tester' },
    env: {
      fetcher: async () => ({ status: 0, data: [] }),
    },
    onChange: () => undefined,
    ...overrides,
  }
  const instance = new Dashboard(props)
  instance.setState = function setState(patch) {
    const nextPatch = typeof patch === 'function' ? patch(this.state, this.props) : patch
    this.state = {
      ...this.state,
      ...nextPatch,
    }
  }
  instance.loadWidgetDefinitions = () => undefined
  return { instance, DashboardEmptyStateSurface, eventBus }
}

test('DashboardEmptyStateSurface keeps loading spinner and indicator/content layering behavior', () => {
  const { DashboardEmptyStateSurface } = loadDashboardModule()
  const loadingElement = DashboardEmptyStateSurface({
    loading: true,
    render: (name, schema) => ({ name, schema }),
    placeholderSchema: '<空>',
  })

  assert.equal(loadingElement.props.className, 'empty-placeholder')
  assert.equal(loadingElement.props.children.name, 'loading')
  assert.equal(loadingElement.props.children.schema.type, 'spinner')
  assert.equal(loadingElement.props.children.schema.tip, '正在加载组件定义...')

  const indicatorElement = DashboardEmptyStateSurface({
    loading: false,
    render: (name, schema, renderProps) => ({ name, schema, props: renderProps }),
    placeholderSchema: { type: 'tpl', tpl: 'hello' },
    placeholderData: { dashboardEditEventName: 'dashboard.edit.1' },
    indicator: {
      src: '/tail.svg',
      className: 'user-dashboard-empty-tail',
      style: { top: '12px' },
    },
  })

  assert.equal(indicatorElement.props.className, 'empty-placeholder')
  assert.equal(indicatorElement.props.children[0].type, 'img')
  assert.equal(
    indicatorElement.props.children[0].props.className,
    'empty-placeholder-indicator user-dashboard-empty-tail'
  )
  assert.equal(indicatorElement.props.children[1].props.className, 'empty-placeholder-content')
  assert.equal(indicatorElement.props.children[1].props.children.props.className, 'empty-placeholder-stack')
  assert.equal(
    indicatorElement.props.children[1].props.children.props.children[0].props.className,
    'empty-placeholder-image'
  )
  assert.match(
    indicatorElement.props.children[1].props.children.props.children[0].props.src,
    /^data:image\/svg\+xml/
  )
  assert.equal(
    indicatorElement.props.children[1].props.children.props.children[1].name,
    'render-component'
  )
  assert.equal(
    indicatorElement.props.children[1].props.children.props.children[1].schema.type,
    'tpl'
  )
  assert.equal(
    indicatorElement.props.children[1].props.children.props.children[1].schema.tpl,
    'hello'
  )
  assert.equal(
    indicatorElement.props.children[1].props.children.props.children[1].props.data
      .dashboardEditEventName,
    'dashboard.edit.1'
  )
})

test('empty dashboard injects editable placeholder helper data and keeps default fallback compatibility', () => {
  const { instance, DashboardEmptyStateSurface } = createDashboardInstance({
    editablePlaceholder: {
      type: 'button',
      label: '开始编辑',
    },
    placeholderImage: {
      className: 'user-dashboard-empty-state__art',
    },
    editablePlaceholderIndicator: {
      src: '/tail.svg',
      className: 'user-dashboard-empty-tail',
    },
  })

  const contentTree = instance.renderDashboardContent()
  const emptyStateElement = contentTree.props.children

  assert.equal(contentTree.type, 'div')
  assert.match(contentTree.props.className, /\bdashboard-grid\b/)
  assert.equal(emptyStateElement.type, DashboardEmptyStateSurface)
  assert.equal(emptyStateElement.props.loading, false)
  assert.deepEqual(emptyStateElement.props.placeholderSchema, {
    type: 'button',
    label: '开始编辑',
  })
  assert.deepEqual(emptyStateElement.props.placeholderImage, {
    className: 'user-dashboard-empty-state__art',
  })
  assert.equal(
    emptyStateElement.props.placeholderData.dashboardEmptyState,
    true
  )
  assert.match(
    emptyStateElement.props.placeholderData.dashboardComponentName,
    /^dashboard/
  )
  assert.match(
    emptyStateElement.props.placeholderData.dashboardEditEventName,
    /^dashboard\.edit\./
  )
  assert.deepEqual(emptyStateElement.props.indicator, {
    src: '/tail.svg',
    className: 'user-dashboard-empty-tail',
  })

  const fallback = createDashboardInstance({
    editablePlaceholder: undefined,
    placeholder: undefined,
  })
  const fallbackTree = fallback.instance.renderDashboardContent().props.children
  assert.equal(fallbackTree.props.placeholderSchema, '<空>')
  assert.equal(fallbackTree.props.placeholderImage, undefined)
  assert.equal(fallbackTree.props.indicator, undefined)
})

test('placeholder image uses default asset when omitted and can be explicitly disabled', () => {
  const { DashboardEmptyStateSurface } = loadDashboardModule()

  const defaultImageTree = DashboardEmptyStateSurface({
    loading: false,
    render: (name, schema) => ({ name, schema }),
    placeholderSchema: { type: 'tpl', tpl: 'hello' },
  })
  const defaultImage =
    defaultImageTree.props.children.props.children.props.children[0]

  assert.equal(defaultImage.type, 'img')
  assert.equal(defaultImage.props.className, 'empty-placeholder-image')
  assert.match(defaultImage.props.src, /^data:image\/svg\+xml/)

  const hiddenImageTree = DashboardEmptyStateSurface({
    loading: false,
    render: (name, schema) => ({ name, schema }),
    placeholderSchema: { type: 'tpl', tpl: 'hello' },
    placeholderImage: '',
  })
  const hiddenStack = hiddenImageTree.props.children.props.children
  assert.equal(hiddenStack.props.className, 'empty-placeholder-stack')
  assert.equal(hiddenStack.props.children.length, 2)
  assert.equal(hiddenStack.props.children[0], null)
  assert.equal(hiddenStack.props.children[1].name, 'render-component')
})

test('empty dashboard switches from static empty-state surface to droppable grid after entering edit mode', () => {
  const { instance, DashboardEmptyStateSurface } = createDashboardInstance({
    editablePlaceholder: {
      type: 'button',
      label: '开始编辑',
    },
  })

  const readonlyTree = instance.renderDashboardContent()
  assert.equal(readonlyTree.type, 'div')
  assert.equal(readonlyTree.props.children.type, DashboardEmptyStateSurface)

  instance.handleEditClick()

  const editingTree = instance.renderDashboardContent()
  assert.equal(editingTree.type, 'responsive-grid')
  assert.equal(editingTree.props.children, undefined)
  assert.equal(editingTree.props.isDroppable, true)
})

test('dashboard output normalizes report-view config viewName to top-level widget field', () => {
  let emittedValue
  const { instance } = createDashboardInstance({
    embedSchemaTpl: true,
    onChange: (value) => {
      emittedValue = value
    },
  })
  instance.state.widgetDefinitions = [
    {
      name: 'report-view',
      schemaTpl: {
        type: 'report-view-runtime',
        viewName: '#{viewName}',
      },
    },
  ]
  instance.state.widgets = [
    {
      id: 'widget-1',
      widgetName: 'report-view',
      position: { x: 0, y: 0 },
      size: { cols: 12, rows: 10 },
      config: {
        title: 'Sales',
        viewName: ' demo.salesReport ',
      },
    },
  ]

  instance.notifyChange()

  assert.equal(emittedValue.widgets[0].viewName, 'demo.salesReport')
  assert.equal(emittedValue.widgets[0].config.viewName, ' demo.salesReport ')
  assert.deepEqual(emittedValue.widgets[0].config.schema, {
    type: 'report-view-runtime',
    viewName: '#{viewName}',
  })
})

test('dashboard editor roundtrip preserves report-view selection, layout, and business-model save shape', () => {
  let savedValue
  const reportViewDefinition = {
    name: 'report-view',
    title: '报表视图',
    defaultSize: { rows: 10, cols: 12 },
    defaultConfig: {
      title: '报表视图',
      showHeader: true,
    },
    schemaTpl: {
      type: 'report-view-runtime',
      viewName: '#{viewName}',
    },
  }
  const { instance } = createDashboardInstance({
    embedSchemaTpl: true,
    onChange: (value) => {
      savedValue = value
    },
  })
  instance.state.widgetDefinitions = [reportViewDefinition]

  instance.handleEditClick()
  instance.onDrop(
    [],
    { x: 2, y: 3, w: 12, h: 10 },
    {
      dataTransfer: {
        getData: () => 'report-view',
      },
    }
  )

  assert.equal(instance.state.widgets.length, 1)
  const droppedWidget = instance.state.widgets[0]
  assert.deepEqual(droppedWidget.position, { x: 2, y: 3 })
  assert.deepEqual(droppedWidget.size, { rows: 10, cols: 12 })

  instance.handleUpdateWidget({
    ...droppedWidget,
    config: {
      ...droppedWidget.config,
      viewName: ' demo.sales-metric ',
      title: 'Sales Metric',
    },
  })
  instance.onDragStop([], undefined, {
    i: droppedWidget.id,
    x: 5,
    y: 7,
    w: 14,
    h: 12,
  })
  instance.handleConfirmEdit()

  assert.equal(instance.state.isEditing, false)
  assert.equal(savedValue.widgets.length, 1)
  assert.equal(savedValue.widgets[0].widgetName, 'report-view')
  assert.equal(savedValue.widgets[0].viewName, 'demo.sales-metric')
  assert.equal(savedValue.widgets[0].config.viewName, ' demo.sales-metric ')
  assert.equal(savedValue.widgets[0].config.title, 'Sales Metric')
  assert.equal(savedValue.widgets[0].position.x, 5)
  assert.equal(savedValue.widgets[0].position.y, 7)
  assert.equal(savedValue.widgets[0].size.cols, 14)
  assert.equal(savedValue.widgets[0].size.rows, 12)
  assert.deepEqual(savedValue.widgets[0].config.schema, reportViewDefinition.schemaTpl)

  const reloaded = createDashboardInstance({
    value: savedValue,
  })
  assert.equal(reloaded.instance.state.widgets.length, 1)
  assert.equal(reloaded.instance.state.widgets[0].viewName, 'demo.sales-metric')
  assert.equal(reloaded.instance.state.widgets[0].position.x, 5)
  assert.equal(reloaded.instance.state.widgets[0].position.y, 7)
  assert.equal(reloaded.instance.state.widgets[0].size.cols, 14)
  assert.equal(reloaded.instance.state.widgets[0].size.rows, 12)
})

test('dashboard editor requests form submit only when edit confirmation is explicit', () => {
  let savedValue
  const submitFlags = []
  const { instance } = createDashboardInstance({
    name: 'dashboard',
    submitOnChange: true,
    onBulkChange: (value, submit) => {
      savedValue = value
      submitFlags.push(submit)
    },
  })
  instance.state.widgets = [
    {
      id: 'widget-1',
      widgetName: 'summary',
      position: { x: 0, y: 0 },
      size: { cols: 6, rows: 4 },
      config: {
        title: 'Summary',
      },
    },
  ]

  instance.onDragStop([], undefined, {
    i: 'widget-1',
    x: 2,
    y: 3,
    w: 8,
    h: 5,
  })

  assert.deepEqual(submitFlags, [])

  instance.handleConfirmEdit()

  assert.deepEqual(submitFlags, [true])
  assert.equal(savedValue.dashboard.widgets[0].position.x, 2)
  assert.equal(savedValue.dashboard.widgets[0].position.y, 3)
  assert.equal(savedValue.dashboard.widgets[0].size.cols, 8)
  assert.equal(savedValue.dashboard.widgets[0].size.rows, 5)
  assert.deepEqual(savedValue.widgets, savedValue.dashboard.widgets)
})

test('dashboard editing preview keeps runtime data and does not inject sampleData fallback', () => {
  const { instance } = createDashboardInstance({
    data: {
      appName: 'demo',
      currentUser: 'tester',
    },
    widgetDefinitions: [
      {
        name: 'sample-widget',
        title: 'Sample Widget',
        defaultSize: { cols: 6, rows: 4 },
        sizeConstraints: {
          min: { cols: 1, rows: 1 },
          max: { cols: 24, rows: 24 },
        },
        sampleData: {
          previewOnly: true,
        },
        schemaTpl: {
          type: 'tpl',
          tpl: '${currentUser}',
        },
      },
    ],
  })
  instance.state.isEditing = true
  const widget = {
    id: 'sample-widget-1',
    widgetName: 'sample-widget',
    position: { x: 0, y: 0 },
    size: { cols: 6, rows: 4 },
    config: {},
  }

  const rendered = instance.renderWidgetContent(widget, instance.state.widgetDefinitions[0])

  assert.equal(rendered.props.data.currentUser, 'tester')
  assert.equal(rendered.props.data.previewOnly, undefined)
})

test('dashboard-edit-mode private action enters edit mode without global action registration', async () => {
  const { instance } = createDashboardInstance()

  assert.equal(instance.state.isEditing, false)
  await instance.doAction({ actionType: 'dashboard-edit-mode' }, {})
  assert.equal(instance.state.isEditing, true)

  instance.state.isEditing = false
  await instance.handlePlaceholderAction(
    undefined,
    { actionType: 'dashboard-edit-mode' },
    {}
  )
  assert.equal(instance.state.isEditing, true)
})

test('placeholder CTA event bridge and hover edit button share the same edit-state entry', () => {
  const { instance, eventBus } = createDashboardInstance()

  assert.equal(instance.state.isEditing, false)
  instance.componentDidMount()

  const eventName = instance.dashboardEditEventName
  assert.ok(Array.isArray(eventBus.handlers[eventName]))
  assert.equal(eventBus.handlers[eventName].length, 1)

  eventBus.publish(eventName)
  assert.equal(instance.state.isEditing, true)

  instance.state.isEditing = false
  instance.handleEditClick()
  assert.equal(instance.state.isEditing, true)

  instance.componentWillUnmount()
  assert.equal(eventBus.handlers[eventName].length, 0)
})

test('loading spinner still wins before definitions resolve and non-empty dashboards skip the empty-state surface', () => {
  const loadingCase = createDashboardInstance({
    value: {
      widgets: [{ id: 'widget-1', widgetName: 'summary' }],
    },
  })
  loadingCase.instance.state.widgets = [{ id: 'widget-1', widgetName: 'summary' }]
  loadingCase.instance.state.widgetDefinitions = []

  const loadingWrapper = loadingCase.instance.renderDashboardContent()
  const loadingTree = loadingWrapper.props.children
  assert.equal(loadingWrapper.type, 'div')
  assert.equal(loadingTree.type, loadingCase.DashboardEmptyStateSurface)
  assert.equal(loadingTree.props.loading, true)

  const widgetsCase = createDashboardInstance({
    value: {
      widgets: [{ id: 'widget-1', widgetName: 'summary' }],
    },
  })
  widgetsCase.instance.state.widgets = [{ id: 'widget-1', widgetName: 'summary' }]
  widgetsCase.instance.state.widgetDefinitions = [{ name: 'summary' }]
  widgetsCase.instance.renderWidgets = () => 'widget-content'

  const widgetsTree = widgetsCase.instance.renderDashboardContent()
  assert.equal(widgetsTree.props.children, 'widget-content')
})

test('user-dashboard schema opts into the new empty-state recipe without changing template-management dashboards', () => {
  const userDashboardSchema = JSON.parse(
    fs.readFileSync(
      path.join(
        repoRoot,
        'ability/ouroboros-widget/ouroboros-widget-user-dashboard/src/main/metadata/user-dashboard.ui-schema.json'
      ),
      'utf8'
    )
  )
  const dashboardSchema = userDashboardSchema.schema.body[0].body[0]

  assert.ok(dashboardSchema.editablePlaceholder)
  assert.deepEqual(dashboardSchema.placeholderImage, {
    className: 'user-dashboard-empty-state__art',
  })
  assert.equal(dashboardSchema.editablePlaceholder.body[2].type, 'button')
  assert.equal(dashboardSchema.editablePlaceholder.body[2].label, '开始编辑')
  assert.equal(dashboardSchema.editablePlaceholder.body[2].actionType, 'dashboard-edit-mode')
  assert.equal(dashboardSchema.editablePlaceholder.body[0].type, 'tpl')
  assert.doesNotMatch(dashboardSchema.editablePlaceholder.body[0].tpl, /<img/i)
  assert.ok(dashboardSchema.editablePlaceholderIndicator)
  assert.match(
    dashboardSchema.editablePlaceholder.className,
    /user-dashboard-empty-state/
  )

  const templateSchemaPaths = [
    'ability/ouroboros-widget/ouroboros-widget-user-dashboard/src/main/metadata/system-setting/user-dashboard-template-manage/add.ui-schema.json',
    'ability/ouroboros-widget/ouroboros-widget-user-dashboard/src/main/metadata/system-setting/user-dashboard-template-manage/edit.ui-schema.json',
    'ability/ouroboros-widget/ouroboros-widget-user-dashboard/src/main/metadata/system-setting/user-dashboard-template-manage/detail.ui-schema.json',
  ]

  templateSchemaPaths.forEach((schemaPath) => {
    const schema = JSON.parse(fs.readFileSync(path.join(repoRoot, schemaPath), 'utf8'))
    const dashboardNode = schema.schema.body.find((item) => item.type === 'dashboard')
    assert.ok(dashboardNode)
    assert.equal(dashboardNode.placeholderImage, '')
    assert.equal(dashboardNode.editablePlaceholderIndicator, undefined)
    assert.equal(dashboardNode.editablePlaceholder, undefined)
  })
})
