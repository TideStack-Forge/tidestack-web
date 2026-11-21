import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const {
  store,
  getBootstrapMode,
  isExternal,
  tabs,
  openMenuAfterLogin,
  resolvePostLoginFallbackPath,
  clearStatisticsDatasetEditorDirty,
  getStatisticsDatasetEditorLeaveMessage,
  installStatisticsDatasetEditorBeforeUnloadGuard,
  shouldConfirmStatisticsDatasetEditorRouteLeave,
  clearStatisticsChartEditorDirty,
  getStatisticsChartEditorLeaveMessage,
  installStatisticsChartEditorBeforeUnloadGuard,
  installStatisticsChartEditorEventBridge,
  shouldConfirmStatisticsChartEditorRouteLeave,
} = vi.hoisted(() => ({
  store: {
    getters: {},
    dispatch: vi.fn(),
  },
  getBootstrapMode: vi.fn(),
  isExternal: vi.fn(),
  tabs: {
    openNotFoundPage: vi.fn(),
    switchTab: vi.fn(),
    updateTab: vi.fn(),
    openOrSwitchTab: vi.fn(),
  },
  openMenuAfterLogin: vi.fn(),
  resolvePostLoginFallbackPath: vi.fn(),
  clearStatisticsDatasetEditorDirty: vi.fn(),
  getStatisticsDatasetEditorLeaveMessage: vi.fn(() => 'leave?'),
  installStatisticsDatasetEditorBeforeUnloadGuard: vi.fn(),
  shouldConfirmStatisticsDatasetEditorRouteLeave: vi.fn(),
  clearStatisticsChartEditorDirty: vi.fn(),
  getStatisticsChartEditorLeaveMessage: vi.fn(() => 'leave chart?'),
  installStatisticsChartEditorBeforeUnloadGuard: vi.fn(),
  installStatisticsChartEditorEventBridge: vi.fn(),
  shouldConfirmStatisticsChartEditorRouteLeave: vi.fn(),
}))

vi.mock('@/store/storeFacade', () => ({
  store,
}))

vi.mock('@/utils', () => ({
  getBootstrapMode,
}))

vi.mock('@/utils/url', () => ({
  isExternal,
}))

vi.mock('@/common/tabs', () => ({
  default: tabs,
}))

vi.mock('@/common/menus', () => ({
  openMenuAfterLogin,
}))

vi.mock('@/common/menus/post-login', () => ({
  resolvePostLoginFallbackPath,
}))

vi.mock('@/utils/statisticsDatasetEditorDirtyGuard', () => ({
  clearStatisticsDatasetEditorDirty,
  getStatisticsDatasetEditorLeaveMessage,
  installStatisticsDatasetEditorBeforeUnloadGuard,
  shouldConfirmStatisticsDatasetEditorRouteLeave,
}))

vi.mock('@/utils/statisticsChartEditorDirtyGuard', () => ({
  clearStatisticsChartEditorDirty,
  getStatisticsChartEditorLeaveMessage,
  installStatisticsChartEditorBeforeUnloadGuard,
  installStatisticsChartEditorEventBridge,
  shouldConfirmStatisticsChartEditorRouteLeave,
}))

import { createNavigationExecutor } from '../../../../src/router/navigationExecution.ts'
import { readNavigationContext } from '../../../../src/router/navigationContextRuntime.ts'
import { createNavigationGuard } from '../../../../src/router/navigationOrchestration.ts'

function createRuntimeExecutor() {
  return createNavigationExecutor({
    openNotFoundPage: (to) => tabs.openNotFoundPage(to),
    openOrSwitchTab: (fullPath, options) => tabs.openOrSwitchTab(fullPath, options),
    openRootMenu: () => openMenuAfterLogin(),
    switchTab: (activeTabId, options) => tabs.switchTab(activeTabId, options),
    updateTab: (activeTabId, fullPath, options) =>
      tabs.updateTab(activeTabId, fullPath, options),
  })
}

function createGuard(updateDocumentTitle, readDecisionContext) {
  return createNavigationGuard(
    updateDocumentTitle,
    readDecisionContext || readNavigationContext,
    createRuntimeExecutor()
  )
}

const originalWindow = globalThis.window

beforeEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: {
      location: { href: 'https://example.test/' },
      confirm: vi.fn(() => true),
    },
    configurable: true,
    writable: true,
  })
  Object.assign(store.getters, {
    'user/isLogin': false,
    'app/whiteList': ['/login'],
    'user/menu': { globalMenu: [] },
    activeTabId: '',
    tabsList: [],
  })
  store.dispatch.mockReset()
  getBootstrapMode.mockReset()
  isExternal.mockReset()
  tabs.openNotFoundPage.mockReset()
  tabs.switchTab.mockReset()
  tabs.updateTab.mockReset()
  tabs.openOrSwitchTab.mockReset()
  openMenuAfterLogin.mockReset()
  resolvePostLoginFallbackPath.mockReset()
  clearStatisticsDatasetEditorDirty.mockReset()
  getStatisticsDatasetEditorLeaveMessage.mockReset()
  getStatisticsDatasetEditorLeaveMessage.mockReturnValue('leave?')
  installStatisticsDatasetEditorBeforeUnloadGuard.mockReset()
  shouldConfirmStatisticsDatasetEditorRouteLeave.mockReset()
  shouldConfirmStatisticsDatasetEditorRouteLeave.mockReturnValue(false)
  clearStatisticsChartEditorDirty.mockReset()
  getStatisticsChartEditorLeaveMessage.mockReset()
  getStatisticsChartEditorLeaveMessage.mockReturnValue('leave chart?')
  installStatisticsChartEditorBeforeUnloadGuard.mockReset()
  installStatisticsChartEditorEventBridge.mockReset()
  shouldConfirmStatisticsChartEditorRouteLeave.mockReset()
  shouldConfirmStatisticsChartEditorRouteLeave.mockReturnValue(false)
  getBootstrapMode.mockReturnValue('host')
  isExternal.mockReturnValue(false)
})

afterEach(() => {
  if (typeof originalWindow === 'undefined') {
    delete globalThis.window
    return
  }

  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
    writable: true,
  })
})

test('unauthenticated protected navigation redirects to login with preserved redirect', async () => {
  const next = vi.fn()
  const updateDocumentTitle = vi.fn()
  const guard = createGuard(updateDocumentTitle)

  await guard(
    {
      path: '/dev/app-list',
      fullPath: '/dev/app-list?tab=todo',
      query: {},
      name: 'app-list',
      meta: { title: '应用列表' },
    },
    { path: '/login', fullPath: '/login' },
    next
  )

  expect(next).toHaveBeenCalledWith({
    path: '/login',
    query: { redirect: '/dev/app-list?tab=todo' },
  })
})

test('legacy iframe mode allows navigation and still updates document title', async () => {
  getBootstrapMode.mockReturnValue('legacyIframe')
  const next = vi.fn()
  const updateDocumentTitle = vi.fn()
  const guard = createGuard(updateDocumentTitle)

  await guard(
    {
      path: '/dev/app-list',
      fullPath: '/dev/app-list',
      query: {},
      name: 'app-list',
      meta: { title: '应用列表' },
    },
    { path: '/login', fullPath: '/login' },
    next
  )

  expect(next).toHaveBeenCalledWith()
  expect(updateDocumentTitle).toHaveBeenCalledWith({
    path: '/dev/app-list',
    fullPath: '/dev/app-list',
    query: {},
    name: 'app-list',
    meta: { title: '应用列表' },
  })
})

test('error route allows navigation and still updates document title', async () => {
  const next = vi.fn()
  const updateDocumentTitle = vi.fn()
  const guard = createGuard(updateDocumentTitle)

  await guard(
    {
      path: '/error',
      fullPath: '/error',
      query: {},
      name: 'error',
      meta: { title: '错误页面' },
    },
    { path: '/login', fullPath: '/login' },
    next
  )

  expect(next).toHaveBeenCalledWith()
  expect(updateDocumentTitle).toHaveBeenCalledWith({
    path: '/error',
    fullPath: '/error',
    query: {},
    name: 'error',
    meta: { title: '错误页面' },
  })
})

test('authenticated navigation to root opens post-login menu flow and aborts current navigation', async () => {
  store.getters['user/isLogin'] = true
  const next = vi.fn()
  const updateDocumentTitle = vi.fn()
  const guard = createGuard(updateDocumentTitle)

  await guard(
    {
      path: '/',
      fullPath: '/',
      query: {},
      name: 'root',
      meta: { title: 'root' },
    },
    { path: '/welcome', fullPath: '/welcome' },
    next
  )

  expect(openMenuAfterLogin).toHaveBeenCalledTimes(1)
  expect(next).toHaveBeenCalledWith(false)
})

test('guard-driven tab execution disables location sync while allowing navigation', async () => {
  store.getters['user/isLogin'] = true
  const next = vi.fn()
  const updateDocumentTitle = vi.fn()
  const guard = createGuard(updateDocumentTitle, () => ({
    isLogin: true,
    toPath: '/dev/app-list',
    toFullPath: '/dev/app-list?tab=todo',
    toQueryRedirect: undefined,
    postLoginFallbackPath: '/welcome',
    whiteList: [],
    routeName: 'app-list',
    activeTabId: '',
    tabsList: [],
    routeTitle: '应用列表',
  }))

  await guard(
    {
      path: '/dev/app-list',
      fullPath: '/dev/app-list?tab=todo',
      query: { tab: 'todo' },
      name: 'app-list',
      meta: { title: '应用列表' },
    },
    { path: '/welcome', fullPath: '/welcome' },
    next
  )

  expect(tabs.openOrSwitchTab).toHaveBeenCalledWith('/dev/app-list?tab=todo', {
    title: '应用列表',
    syncLocation: false,
    isCurrent: expect.any(Function),
  })
  expect(next).toHaveBeenCalledWith()
})

test('statistics dirty guard can abort navigation before route decisions run', async () => {
  shouldConfirmStatisticsDatasetEditorRouteLeave.mockReturnValue(true)
  globalThis.window.confirm = vi.fn(() => false)
  const next = vi.fn()
  const updateDocumentTitle = vi.fn()
  const guard = createGuard(updateDocumentTitle)

  await guard(
    {
      path: '/dev/app-list',
      fullPath: '/dev/app-list',
      query: {},
      name: 'app-list',
      meta: { title: '应用列表' },
    },
    { path: '/statistics/sql', fullPath: '/statistics/sql' },
    next
  )

  expect(next).toHaveBeenCalledWith(false)
})

test('chart dirty guard uses chart confirmation and clears chart state after approval', async () => {
  shouldConfirmStatisticsChartEditorRouteLeave.mockReturnValue(true)
  globalThis.window.confirm = vi.fn(() => true)
  const next = vi.fn()
  const guard = createGuard(vi.fn(), () => ({
    isLogin: true,
    whiteList: [],
    preventTabOperation: false,
    routeName: 'chart-list',
    activeTabId: '',
    tabsList: [],
    routeTitle: '图表',
  }))

  await guard(
    {
      path: '/dev/demo/chart',
      fullPath: '/dev/demo/chart',
      name: 'chart-list',
      meta: {},
    },
    { path: '/dev/demo/chart/demo.sales', fullPath: '/dev/demo/chart/demo.sales' },
    next
  )

  expect(globalThis.window.confirm).toHaveBeenCalledWith('leave chart?')
  expect(clearStatisticsChartEditorDirty).toHaveBeenCalledWith(
    '/dev/demo/chart/demo.sales'
  )
})
