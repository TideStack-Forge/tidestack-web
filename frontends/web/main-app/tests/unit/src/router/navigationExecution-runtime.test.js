import { expect, test, vi } from 'vitest'

const { store, resolvePostLoginFallbackPath } = vi.hoisted(() => ({
  store: {
    getters: {
      'user/menu': { globalMenu: [] },
      'user/isLogin': false,
      'app/whiteList': [],
      activeTabId: '',
      tabsList: [],
    },
    dispatch: vi.fn(),
  },
  resolvePostLoginFallbackPath: vi.fn(),
}))

vi.mock('@/store/storeFacade', () => ({
  store,
}))

vi.mock('@/common/tabs', () => ({
  default: {
    openNotFoundPage: vi.fn(),
    switchTab: vi.fn(),
    updateTab: vi.fn(),
    openOrSwitchTab: vi.fn(),
  },
}))

vi.mock('@/common/menus', () => ({
  openMenuAfterLogin: vi.fn(),
}))

vi.mock('@/common/menus/post-login', () => ({
  resolvePostLoginFallbackPath,
}))

vi.mock('@/utils/url', () => ({
  isExternal: () => false,
}))

const navigationExecutionModule = await import('../../../../src/router/navigationExecution.ts')
const navigationContextRuntimeModule = await import('../../../../src/router/navigationContextRuntime.ts')

function createExecutionDependencies() {
  return {
    openNotFoundPage: vi.fn(),
    openOrSwitchTab: vi.fn(),
    openRootMenu: vi.fn(),
    switchTab: vi.fn(),
    updateTab: vi.fn(),
  }
}

function createExecutor(dependencies = createExecutionDependencies()) {
  const createNavigationExecutor = navigationExecutionModule.createNavigationExecutor

  expect(typeof createNavigationExecutor).toBe('function')
  if (!createNavigationExecutor) {
    return { executeNavigationDecision: null, dependencies }
  }

  return {
    executeNavigationDecision: createNavigationExecutor(dependencies),
    dependencies,
  }
}

test('open-root-menu opens the post-login menu flow and aborts navigation', async () => {
  const { executeNavigationDecision, dependencies } = createExecutor()
  if (!executeNavigationDecision) {
    return
  }

  const next = vi.fn()
  const to = { path: '/', fullPath: '/', meta: {} }

  await executeNavigationDecision({ type: 'open-root-menu' }, { to, next })

  expect(dependencies.openRootMenu).toHaveBeenCalledTimes(1)
  expect(next).toHaveBeenCalledWith(false)
})

test('switch-tab activates the current tab and allows navigation', async () => {
  const { executeNavigationDecision, dependencies } = createExecutor()
  if (!executeNavigationDecision) {
    return
  }

  const next = vi.fn()
  const to = { path: '/dev/app-list', fullPath: '/dev/app-list', meta: {} }

  await executeNavigationDecision({ type: 'switch-tab', activeTabId: 'tab-1' }, { to, next })

  expect(dependencies.switchTab).toHaveBeenCalledWith('tab-1', { syncLocation: false, isCurrent: expect.any(Function) })
  expect(next).toHaveBeenCalledWith()
})

test('allow accepts navigation without applying a second tab projection', async () => {
  const { executeNavigationDecision, dependencies } = createExecutor()
  if (!executeNavigationDecision) {
    return
  }

  const next = vi.fn()
  const to = { path: '/dev/app-list', fullPath: '/dev/app-list', meta: {} }

  await executeNavigationDecision({ type: 'allow' }, { to, next })

  expect(dependencies.openOrSwitchTab).not.toHaveBeenCalled()
  expect(dependencies.switchTab).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledWith()
})

test('open-not-found opens the dedicated not-found tab and allows navigation', async () => {
  const { executeNavigationDecision, dependencies } = createExecutor()
  if (!executeNavigationDecision) {
    return
  }

  const next = vi.fn()
  const to = {
    path: '/missing',
    fullPath: '/missing',
    query: {},
    name: 'notFound',
    meta: { title: '页面未找到' },
  }

  await executeNavigationDecision({ type: 'open-not-found' }, { to, next })

  expect(dependencies.openNotFoundPage).toHaveBeenCalledWith(to)
  expect(next).toHaveBeenCalledWith()
})

test('update-tab refreshes the active tab fullPath and allows navigation', async () => {
  const { executeNavigationDecision, dependencies } = createExecutor()
  if (!executeNavigationDecision) {
    return
  }

  const next = vi.fn()
  const to = { path: '/dev/app-list', fullPath: '/dev/app-list?tab=done', meta: {} }

  await executeNavigationDecision(
    { type: 'update-tab', activeTabId: 'tab-1', fullPath: '/dev/app-list?tab=done' },
    { to, next }
  )

  expect(dependencies.updateTab).toHaveBeenCalledWith('tab-1', '/dev/app-list?tab=done', { syncLocation: false, isCurrent: expect.any(Function) })
  expect(next).toHaveBeenCalledWith()
})

test('open-or-switch-tab opens or reuses a tab with the resolved title and allows navigation', async () => {
  const { executeNavigationDecision, dependencies } = createExecutor()
  if (!executeNavigationDecision) {
    return
  }

  const next = vi.fn()
  const to = { path: '/dev/app-list', fullPath: '/dev/app-list?tab=todo', meta: { title: '应用列表' } }

  await executeNavigationDecision(
    { type: 'open-or-switch-tab', fullPath: '/dev/app-list?tab=todo', title: '应用列表' },
    { to, next }
  )

  expect(dependencies.openOrSwitchTab).toHaveBeenCalledWith('/dev/app-list?tab=todo', {
    title: '应用列表',
    syncLocation: false,
    isCurrent: expect.any(Function),
  })
  expect(next).toHaveBeenCalledWith()
})

test('readNavigationContext defaults unset whitelist and tabs getters for control-loop safety', () => {
  store.getters['user/menu'] = { globalMenu: [] }
  store.getters['user/isLogin'] = true
  store.getters['app/whiteList'] = undefined
  store.getters.activeTabId = undefined
  store.getters.tabsList = undefined
  resolvePostLoginFallbackPath.mockReturnValue('/errorAfterLogin')

  const context = navigationContextRuntimeModule.readNavigationContext({
    path: '/dev/app-list',
    fullPath: '/dev/app-list?tab=todo',
    query: {},
    name: 'appList',
    meta: { title: '应用列表' },
  })

  expect(context.whiteList).toEqual([])
  expect(context.activeTabId).toBe('')
  expect(context.tabsList).toEqual([])
})
