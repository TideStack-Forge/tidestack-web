import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const {
  store,
  getBootstrapMode,
  isExternal,
  tabs,
  openMenuAfterLogin,
  resolvePostLoginFallbackPath,
  clearStatisticsStudioDirty,
  getStatisticsStudioLeaveMessage,
  installStatisticsStudioBeforeUnloadGuard,
  shouldConfirmStatisticsStudioRouteLeave,
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
  clearStatisticsStudioDirty: vi.fn(),
  getStatisticsStudioLeaveMessage: vi.fn(() => 'leave?'),
  installStatisticsStudioBeforeUnloadGuard: vi.fn(),
  shouldConfirmStatisticsStudioRouteLeave: vi.fn(),
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

vi.mock('@/utils/statisticsStudioDirtyGuard', () => ({
  clearStatisticsStudioDirty,
  getStatisticsStudioLeaveMessage,
  installStatisticsStudioBeforeUnloadGuard,
  shouldConfirmStatisticsStudioRouteLeave,
}))

import { createNavigationExecutor } from '../../../../src/router/navigationExecution.ts'
import { readNavigationContext } from '../../../../src/router/navigationContextRuntime.ts'
import { createNavigationGuard } from '../../../../src/router/navigationOrchestration.ts'

function createRuntimeExecutor() {
  return createNavigationExecutor({
    clearPreventTabOperation: () => store.dispatch('tabs/clearPreventTabOperation'),
    openNotFoundPage: (to) => tabs.openNotFoundPage(to),
    openOrSwitchTab: (fullPath, options) => tabs.openOrSwitchTab(fullPath, options),
    openRootMenu: () => openMenuAfterLogin(),
    switchTab: (activeTabId, options) => tabs.switchTab(activeTabId, options),
    updateTab: (activeTabId, fullPath, options) => tabs.updateTab(activeTabId, fullPath, options),
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
    preventTabOperation: false,
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
  clearStatisticsStudioDirty.mockReset()
  getStatisticsStudioLeaveMessage.mockReset()
  getStatisticsStudioLeaveMessage.mockReturnValue('leave?')
  installStatisticsStudioBeforeUnloadGuard.mockReset()
  shouldConfirmStatisticsStudioRouteLeave.mockReset()
  shouldConfirmStatisticsStudioRouteLeave.mockReturnValue(false)
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
    preventTabOperation: false,
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
  })
  expect(next).toHaveBeenCalledWith()
})

test('statistics dirty guard can abort navigation before route decisions run', async () => {
  shouldConfirmStatisticsStudioRouteLeave.mockReturnValue(true)
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
