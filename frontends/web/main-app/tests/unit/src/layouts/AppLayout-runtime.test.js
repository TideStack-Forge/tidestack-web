import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'

const {
  readCurrentRoute,
  readGetters,
  readState,
  resolveLayoutProjection,
  useHostSnapshot,
  useMicroLayoutApps,
  setRoute,
  setGetters,
  setState,
  getAmisComponentProps,
  recordAmisComponentProps,
  resetMocks,
} = vi.hoisted(() => {
  let currentRoute = null
  let currentGetters = {}
  let currentState = {}
  const amisComponentProps = []

  return {
    readCurrentRoute: vi.fn(() => currentRoute),
    readGetters: vi.fn(() => currentGetters),
    readState: vi.fn(() => currentState),
    resolveLayoutProjection: vi.fn(() => null),
    useHostSnapshot: vi.fn(),
    useMicroLayoutApps: vi.fn(),
    setRoute(route) {
      currentRoute = route
    },
    setGetters(getters) {
      currentGetters = getters
    },
    setState(state) {
      currentState = state
    },
    getAmisComponentProps() {
      return amisComponentProps
    },
    recordAmisComponentProps(props) {
      amisComponentProps.push(props)
    },
    resetMocks() {
      currentRoute = null
      currentGetters = {}
      currentState = {}
      amisComponentProps.length = 0
      readCurrentRoute.mockClear()
      readGetters.mockClear()
      readState.mockClear()
      resolveLayoutProjection.mockClear()
      useHostSnapshot.mockClear()
      useMicroLayoutApps.mockClear()
    },
  }
})

vi.mock('../../../../src/router/routerFacade.ts', () => ({
  readCurrentRoute,
}))

vi.mock('../../../../src/store/storeFacade.ts', () => ({
  readGetters,
  readState,
}))

vi.mock('../../../../src/layouts/layout-projection.js', () => ({
  resolveLayoutProjection,
}))

vi.mock('../../../../src/layouts/useHostSnapshot.ts', () => ({
  useHostSnapshot,
}))

vi.mock('../../../../src/layouts/useMicroLayoutApps.ts', () => ({
  useMicroLayoutApps,
}))

vi.mock('../../../../src/layouts/devWorkspaceMenuSync.ts', () => ({
  useDevWorkspaceMenuSync: vi.fn(),
}))

vi.mock('amis', () => ({
  alert: vi.fn(),
  confirm: vi.fn(),
  prompt: vi.fn(),
  registerLocale: vi.fn(),
  registerIcon: vi.fn(),
  registerFormula: vi.fn(),
  addRule: vi.fn(),
  addSchemaFilter: vi.fn(),
  dataMapping: vi.fn((template) => template),
  qsstringify: vi.fn(() => ''),
  extractObjectChain: vi.fn(),
  createObjectFromChain: vi.fn(),
}))

vi.mock('@/common/modal', () => ({
  init: vi.fn(),
  openDialog: vi.fn(),
  openDrawer: vi.fn(),
  alert: vi.fn(),
  confirm: vi.fn(),
  prompt: vi.fn(),
}))

vi.mock('../../../../src/common/modal/index.ts', () => ({
  init: vi.fn(),
  openDialog: vi.fn(),
  openDrawer: vi.fn(),
  alert: vi.fn(),
  confirm: vi.fn(),
  prompt: vi.fn(),
}))

vi.mock('../../../../src/layouts/Header', () => ({
  Header: function HeaderMock() {
    return React.createElement('header', { 'data-testid': 'header-mock' })
  },
}))

vi.mock('../../../../src/layouts/Sidebar', () => ({
  Sidebar: function SidebarMock() {
    return React.createElement('aside', { 'data-testid': 'sidebar-mock' })
  },
}))

vi.mock('../../../../src/layouts/Tabs', () => ({
  Tabs: function TabsMock() {
    return React.createElement('div', { 'data-testid': 'tabs-mock' })
  },
}))

vi.mock('@/components/amis/AmisComponent', () => ({
  default: function AmisComponentMock(props) {
    recordAmisComponentProps(props)
    return React.createElement('div', { 'data-testid': 'amis-component-mock' })
  },
}))

vi.mock('../../../../src/components/amis/AmisComponent', () => ({
  default: function AmisComponentMock(props) {
    recordAmisComponentProps(props)
    return React.createElement('div', { 'data-testid': 'amis-component-mock' })
  },
}))

vi.mock('../../../../src/components/amis/AmisComponent.tsx', () => ({
  default: function AmisComponentMock(props) {
    recordAmisComponentProps(props)
    return React.createElement('div', { 'data-testid': 'amis-component-mock' })
  },
}))

vi.mock('../../../../src/layouts/ContentViewport', () => ({
  ContentViewport: function ContentViewportMock() {
    return React.createElement('div', { 'data-testid': 'content-viewport-mock' })
  },
}))

const bootstrapDom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
})

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window,
})
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.document,
})
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.navigator,
})
Object.defineProperty(globalThis, 'location', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.location,
})
Object.defineProperty(globalThis, 'HTMLElement', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.HTMLElement,
})
Object.defineProperty(globalThis, 'Element', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.Element,
})
Object.defineProperty(globalThis, 'Node', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.Node,
})
Object.defineProperty(globalThis, 'Event', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.Event,
})
Object.defineProperty(globalThis, 'CustomEvent', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.CustomEvent,
})
Object.defineProperty(globalThis, 'MouseEvent', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.MouseEvent,
})
Object.defineProperty(globalThis, 'KeyboardEvent', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.KeyboardEvent,
})
Object.defineProperty(globalThis, 'WheelEvent', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.WheelEvent,
})
Object.defineProperty(globalThis, 'PointerEvent', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.PointerEvent,
})
Object.defineProperty(globalThis, 'HTMLAnchorElement', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.HTMLAnchorElement,
})
Object.defineProperty(globalThis, 'HTMLInputElement', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.HTMLInputElement,
})
Object.defineProperty(globalThis, 'HTMLTextAreaElement', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.HTMLTextAreaElement,
})
Object.defineProperty(globalThis, 'HTMLSelectElement', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.HTMLSelectElement,
})
Object.defineProperty(globalThis, 'HTMLButtonElement', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.HTMLButtonElement,
})
Object.defineProperty(globalThis, 'SVGElement', {
  configurable: true,
  writable: true,
  value: bootstrapDom.window.SVGElement,
})

const { AppLayout } = await import('../../../../src/layouts/AppLayout.tsx')

function buildRoute(fullPath) {
  return {
    fullPath,
    query: fullPath.includes('?')
      ? Object.fromEntries(new URLSearchParams(fullPath.split('?')[1]))
      : {},
    matched: [{ path: '/' }],
    meta: {
      type: 'internal',
    },
  }
}

function createLayoutProjection(overrides = {}) {
  const layoutType = overrides.layoutType || 'header-sidebar'
  const layoutConfig = overrides.layoutConfig || {
    header: {
      enabled: true,
    },
    sidebar: {
      enabled: true,
    },
    tabs: {
      enabled: false,
    },
  }
  const appConfig = overrides.appConfig || {}

  return {
    layoutType,
    layoutConfig,
    breadcrumb: [],
    loadMicroTopbar: false,
    loadMicroSidebar: false,
    themeClass: 'theme-default',
    densityClass: 'density-normal',
    layoutClass: layoutType,
    themeList: ['default'],
    isLockTheme: false,
    lockTheme: '',
    appConfig,
    layoutProps: {
      config: layoutConfig,
      appName: 'Platform Shell',
      logo: 'platform-logo.svg',
      menu: {
        globalMenu: [],
        globalSubNav: [],
      },
      theme: 'default',
      userInfo: {
        userIdentity: '张三',
      },
      breadcrumb: [],
      tabsList: [],
      activeTabId: '',
      loadMicroTopbar: false,
      loadMicroSidebar: false,
      themeList: ['default'],
      isLockTheme: false,
      lockTheme: '',
      appConfig,
      themeClass: 'theme-default',
      densityClass: 'density-normal',
      layoutClass: layoutType,
      ...overrides.layoutProps,
    },
  }
}

let dom
let root
let container

beforeEach(() => {
  resetMocks()
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })
  container = dom.window.document.getElementById('root')

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: dom.window,
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: dom.window.document,
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: dom.window.navigator,
  })
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    writable: true,
    value: dom.window.location,
  })
  Object.defineProperty(globalThis, 'HTMLElement', {
    configurable: true,
    writable: true,
    value: dom.window.HTMLElement,
  })
  Object.defineProperty(globalThis, 'Element', {
    configurable: true,
    writable: true,
    value: dom.window.Element,
  })
  Object.defineProperty(globalThis, 'Node', {
    configurable: true,
    writable: true,
    value: dom.window.Node,
  })
  Object.defineProperty(globalThis, 'Event', {
    configurable: true,
    writable: true,
    value: dom.window.Event,
  })
  Object.defineProperty(globalThis, 'CustomEvent', {
    configurable: true,
    writable: true,
    value: dom.window.CustomEvent,
  })
  Object.defineProperty(globalThis, 'MouseEvent', {
    configurable: true,
    writable: true,
    value: dom.window.MouseEvent,
  })
  Object.defineProperty(globalThis, 'KeyboardEvent', {
    configurable: true,
    writable: true,
    value: dom.window.KeyboardEvent,
  })
  Object.defineProperty(globalThis, 'WheelEvent', {
    configurable: true,
    writable: true,
    value: dom.window.WheelEvent,
  })
  Object.defineProperty(globalThis, 'PointerEvent', {
    configurable: true,
    writable: true,
    value: dom.window.PointerEvent,
  })
  Object.defineProperty(globalThis, 'HTMLAnchorElement', {
    configurable: true,
    writable: true,
    value: dom.window.HTMLAnchorElement,
  })
  Object.defineProperty(globalThis, 'HTMLInputElement', {
    configurable: true,
    writable: true,
    value: dom.window.HTMLInputElement,
  })
  Object.defineProperty(globalThis, 'HTMLTextAreaElement', {
    configurable: true,
    writable: true,
    value: dom.window.HTMLTextAreaElement,
  })
  Object.defineProperty(globalThis, 'HTMLSelectElement', {
    configurable: true,
    writable: true,
    value: dom.window.HTMLSelectElement,
  })
  Object.defineProperty(globalThis, 'HTMLButtonElement', {
    configurable: true,
    writable: true,
    value: dom.window.HTMLButtonElement,
  })
  Object.defineProperty(globalThis, 'SVGElement', {
    configurable: true,
    writable: true,
    value: dom.window.SVGElement,
  })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    writable: true,
    value: true,
  })

  root = createRoot(container)
})

afterEach(async () => {
  if (root) {
    await act(async () => {
      root.unmount()
    })
  }

  delete globalThis.window
  delete globalThis.document
  delete globalThis.navigator
  delete globalThis.location
  delete globalThis.HTMLElement
  delete globalThis.Element
  delete globalThis.Node
  delete globalThis.Event
  delete globalThis.CustomEvent
  delete globalThis.MouseEvent
  delete globalThis.KeyboardEvent
  delete globalThis.WheelEvent
  delete globalThis.PointerEvent
  delete globalThis.HTMLAnchorElement
  delete globalThis.HTMLInputElement
  delete globalThis.HTMLTextAreaElement
  delete globalThis.HTMLSelectElement
  delete globalThis.HTMLButtonElement
  delete globalThis.SVGElement
  delete globalThis.IS_REACT_ACT_ENVIRONMENT

  dom?.window.close()
  dom = null
  root = null
  container = null
})

afterAll(() => {
  bootstrapDom.window.close()
})

test('keeps micro layout shell entries global while forwarding route changes to the topbar', async () => {
  setGetters({
    appName: 'Platform Shell',
    logo: 'platform-logo.svg',
    menu: {
      globalMenu: [{ title: '平台菜单' }],
      globalSubNav: [{ title: '平台子菜单' }],
    },
    theme: 'default',
    userInfo: {
      userIdentity: '张三',
    },
    tabsList: [],
    activeTabId: '',
    'app/headerEntry': '/debug-console-header/',
    'app/sidebarEntry': '/debug-console-sidebar/',
  })
  setState({
    user: {
      userInfo: {
        userIdentity: '张三',
      },
    },
    app: {},
  })
  setRoute(buildRoute('/dev/demo/helper-control-regression'))

  await act(async () => {
    root.render(React.createElement(AppLayout))
  })

  expect(resolveLayoutProjection).toHaveBeenCalledTimes(1)
  expect(resolveLayoutProjection).toHaveBeenLastCalledWith(
    expect.objectContaining({
      fullPath: '/dev/demo/helper-control-regression',
      storeGetters: expect.objectContaining({
        'app/headerEntry': '/debug-console-header/',
        'app/sidebarEntry': '/debug-console-sidebar/',
      }),
    })
  )
  expect(useMicroLayoutApps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      currentPath: '/dev/demo/helper-control-regression',
      headerEntry: '/debug-console-header/',
      sidebarEntry: '/debug-console-sidebar/',
    })
  )

  setRoute(buildRoute('/user-dashboard?page=1'))

  await act(async () => {
    root.render(React.createElement(AppLayout))
  })

  expect(resolveLayoutProjection).toHaveBeenCalledTimes(2)
  expect(resolveLayoutProjection).toHaveBeenLastCalledWith(
    expect.objectContaining({
      fullPath: '/user-dashboard?page=1',
      storeGetters: expect.objectContaining({
        'app/headerEntry': '/debug-console-header/',
        'app/sidebarEntry': '/debug-console-sidebar/',
      }),
    })
  )
  expect(useMicroLayoutApps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      currentPath: '/user-dashboard?page=1',
      headerEntry: '/debug-console-header/',
      sidebarEntry: '/debug-console-sidebar/',
    })
  )
})

test('applies the resolved sidebar width CSS variables before sidebar layouts render', async () => {
  setGetters({
    appName: 'Platform Shell',
    logo: 'platform-logo.svg',
    menu: {
      globalMenu: [],
      globalSubNav: [],
    },
    theme: 'default',
    userInfo: {
      userIdentity: '张三',
    },
    tabsList: [],
    activeTabId: '',
    'app/headerEntry': '',
    'app/sidebarEntry': '',
  })
  setState({
    user: {
      userInfo: {
        userIdentity: '张三',
      },
    },
    app: {},
  })
  setRoute(buildRoute('/user-dashboard'))
  window.sessionStorage.setItem('sidebar-width', '280')
  resolveLayoutProjection.mockReturnValue(
    createLayoutProjection({
      appConfig: {
        'sidebar.width': 240,
        'sidebar.minWidth': 180,
        'sidebar.maxWidth': 320,
        'sidebar.resizable': true,
      },
    })
  )

  await act(async () => {
    root.render(React.createElement(AppLayout))
  })

  expect(container.firstChild.style.getPropertyValue('--layout-sidebar-width-open')).toBe(
    '280px'
  )
  expect(container.firstChild.style.getPropertyValue('--sidebar-width-open')).toBe(
    '280px'
  )
})

test('passes backend app config into the global modal scope host', async () => {
  const appConfig = {
    'ui.dialog.resize.enabled': true,
    'ui.dialog.resize.sizeSwitchable': true,
    'ui.dialog.resize.sizes': 'md,lg',
  }

  setGetters({
    appName: 'Platform Shell',
    logo: 'platform-logo.svg',
    menu: {
      globalMenu: [],
      globalSubNav: [],
    },
    theme: 'default',
    userInfo: {
      userIdentity: '张三',
    },
    tabsList: [],
    activeTabId: '',
    'app/headerEntry': '',
    'app/sidebarEntry': '',
  })
  setState({
    user: {
      userInfo: {
        userIdentity: '张三',
      },
    },
    app: {},
  })
  setRoute(buildRoute('/user-dashboard'))
  resolveLayoutProjection.mockReturnValue(createLayoutProjection({ appConfig }))

  await act(async () => {
    root.render(React.createElement(AppLayout))
  })

  const modalScopeProps = getAmisComponentProps().find(
    (props) => props.amisSchema?.type === 'page'
  )

  expect(modalScopeProps?.amisProps?.data?.SystemConfig).toEqual(appConfig)
  expect(modalScopeProps?.amisProps?.data?.SystemContext?.config).toEqual(appConfig)
})

test('skips sidebar width CSS variables when the active layout has no sidebar', async () => {
  setGetters({
    appName: 'Platform Shell',
    logo: 'platform-logo.svg',
    menu: {
      globalMenu: [],
      globalSubNav: [],
    },
    theme: 'default',
    userInfo: {
      userIdentity: '张三',
    },
    tabsList: [],
    activeTabId: '',
    'app/headerEntry': '',
    'app/sidebarEntry': '',
  })
  setState({
    user: {
      userInfo: {
        userIdentity: '张三',
      },
    },
    app: {},
  })
  setRoute(buildRoute('/user-dashboard'))
  window.sessionStorage.setItem('sidebar-width', '280')
  resolveLayoutProjection.mockReturnValue(
    createLayoutProjection({
      layoutType: 'header-only',
      layoutConfig: {
        header: {
          enabled: true,
        },
        sidebar: {
          enabled: false,
        },
        tabs: {
          enabled: false,
        },
      },
    })
  )

  await act(async () => {
    root.render(React.createElement(AppLayout))
  })

  expect(container.firstChild.style.getPropertyValue('--layout-sidebar-width-open')).toBe(
    ''
  )
  expect(container.firstChild.style.getPropertyValue('--sidebar-width-open')).toBe('')
})
