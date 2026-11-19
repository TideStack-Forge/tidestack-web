import { beforeEach, expect, test, vi } from 'vitest'

const {
  store,
  readRouterTopology,
  tabs,
  getBootstrapMode,
  clearStatisticsStudioDirty,
  getStatisticsStudioLeaveMessage,
  installStatisticsStudioBeforeUnloadGuard,
  shouldConfirmStatisticsStudioRouteLeave,
  i18nManager,
  resolvePostLoginFallbackPath,
  isExternal,
} = vi.hoisted(() => ({
  store: {
    getters: {
      'user/isLogin': true,
      'user/menu': { globalMenu: [] },
      'app/whiteList': [],
      activeTabId: '',
      tabsList: [],
      getAppName: vi.fn(() => '测试平台'),
    },
    dispatch: vi.fn(),
  },
  readRouterTopology: vi.fn(() => [
    {
      path: '/dev/orgrbacdemo/builtin-position',
      name: 'builtinPosition',
      meta: { title: '内置岗位' },
      pageComponent: 'AmisPageRoute',
      children: [],
    },
  ]),
  tabs: {
    openNotFoundPage: vi.fn(),
    switchTab: vi.fn(),
    updateTab: vi.fn(),
    openOrSwitchTab: vi.fn(async (fullPath, options) => {
      store.getters.activeTabId = 'tab-1'
      store.getters.tabsList = [
        {
          id: 'tab-1',
          path: '/dev/orgrbacdemo/builtin-position',
          fullPath,
          title: options?.title || '内置岗位',
        },
      ]
      return 'tab-1'
    }),
  },
  getBootstrapMode: vi.fn(() => 'host'),
  clearStatisticsStudioDirty: vi.fn(),
  getStatisticsStudioLeaveMessage: vi.fn(() => 'leave?'),
  installStatisticsStudioBeforeUnloadGuard: vi.fn(),
  shouldConfirmStatisticsStudioRouteLeave: vi.fn(() => false),
  i18nManager: {
    tn: vi.fn((path, key) => {
      if (key !== 'title') {
        return `${path}.${key}`
      }

      if (path === '/login') {
        return '登录'
      }

      return '内置岗位'
    }),
    tCommon: vi.fn((key, fallback) => fallback || key),
    onLocaleChange: vi.fn(),
  },
  resolvePostLoginFallbackPath: vi.fn(() => '/welcome'),
  isExternal: vi.fn(() => false),
}))

vi.mock('@/store/storeFacade', () => ({
  store,
  readGetters: () => store.getters,
}))

vi.mock('../../../../src/store/storeFacade.ts', () => ({
  store,
  readGetters: () => store.getters,
}))

vi.mock('@/common/tabs', () => ({
  default: tabs,
}))

vi.mock('@/utils', () => ({
  getBootstrapMode,
}))

vi.mock('@/utils/url', () => ({
  isExternal,
}))

vi.mock('@/common/menus', () => ({
  openMenuAfterLogin: vi.fn(),
}))

vi.mock('@/common/menus/post-login', () => ({
  resolvePostLoginFallbackPath,
}))

vi.mock('../../../../src/common/i18n/index.ts', () => ({
  i18nManager,
  i18nService: {
    init: vi.fn(),
  },
}))

vi.mock('@/common/i18n', () => ({
  i18nManager,
  i18nService: {
    init: vi.fn(),
  },
}))

vi.mock('@/utils/statisticsStudioDirtyGuard', () => ({
  clearStatisticsStudioDirty,
  getStatisticsStudioLeaveMessage,
  installStatisticsStudioBeforeUnloadGuard,
  shouldConfirmStatisticsStudioRouteLeave,
}))

vi.mock('../../../../src/layouts/AppLayoutOutlet.tsx', () => ({
  default: { name: 'AppLayoutOutlet' },
}))

vi.mock('../../../../src/router/routerTopologyRuntime.ts', () => ({
  readRouterTopology,
}))

const { installHostRouter } = await import('../../../../src/router/installRouter.ts')
installHostRouter()

const routerEngineModule = await import('../../../../src/router/engines/routerEngine.ts')

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  store.getters['user/isLogin'] = true
  store.getters['user/menu'] = { globalMenu: [] }
  store.getters['app/whiteList'] = []
  store.getters.activeTabId = ''
  store.getters.tabsList = []
  store.getters.getAppName = vi.fn(() => '测试平台')
  store.dispatch.mockReset()
  readRouterTopology.mockClear()
  tabs.openNotFoundPage.mockReset()
  tabs.switchTab.mockReset()
  tabs.updateTab.mockReset()
  tabs.openOrSwitchTab.mockClear()
  getBootstrapMode.mockClear()
  clearStatisticsStudioDirty.mockClear()
  getStatisticsStudioLeaveMessage.mockClear()
  installStatisticsStudioBeforeUnloadGuard.mockClear()
  shouldConfirmStatisticsStudioRouteLeave.mockClear()
  i18nManager.tn.mockClear()
  i18nManager.tCommon.mockClear()
  i18nManager.onLocaleChange.mockClear()
  resolvePostLoginFallbackPath.mockClear()
  isExternal.mockClear()
  Object.defineProperty(globalThis, 'window', {
    value: {
      history: {
        replaceState: vi.fn(),
      },
      location: {
        href: 'https://example.test/dev/orgrbacdemo/builtin-position',
        pathname: '/dev/orgrbacdemo/builtin-position',
        search: '',
        hash: '',
      },
      confirm: vi.fn(() => true),
      addEventListener: vi.fn(),
    },
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'document', {
    value: {
      title: '测试平台',
    },
    configurable: true,
    writable: true,
  })
})

test('initial router bootstrap executes the official tab decision once for the direct URL', async () => {
  const router = routerEngineModule.getRouter()

  await flush()

  expect(readRouterTopology).toHaveBeenCalledTimes(1)
  expect(tabs.openOrSwitchTab).toHaveBeenCalledTimes(1)
  expect(tabs.openOrSwitchTab).toHaveBeenCalledWith('/dev/orgrbacdemo/builtin-position', {
    title: '内置岗位',
    syncLocation: false,
    isCurrent: expect.any(Function),
  })
  expect(store.getters.activeTabId).toBe('tab-1')
  expect(store.getters.tabsList).toEqual([
    expect.objectContaining({
      id: 'tab-1',
      path: '/dev/orgrbacdemo/builtin-position',
      fullPath: '/dev/orgrbacdemo/builtin-position',
    }),
  ])
  expect(router.currentRoute.fullPath).toBe('/dev/orgrbacdemo/builtin-position')

  routerEngineModule.getRouter()
  await flush()

  expect(tabs.openOrSwitchTab).toHaveBeenCalledTimes(1)
})

test('refreshRouter replays the current login URL after the app topology becomes available', async () => {
  store.getters['user/isLogin'] = false
  store.getters['app/whiteList'] = ['/login']
  readRouterTopology.mockReturnValue([
    {
      path: '/login',
      name: 'login',
      meta: { title: '登录' },
      pageComponent: 'LoginRoute',
      children: [],
    },
  ])
  window.location.href = 'https://example.test/login'
  window.location.pathname = '/login'
  window.location.search = ''
  window.location.hash = ''

  routerEngineModule.refreshRouter()

  await flush()

  expect(document.title).toBe('登录 - 测试平台')
})

test('refreshRouter replays the browser URL and opens the matching tab for protected routes', async () => {
  store.getters['user/isLogin'] = true
  store.getters['app/whiteList'] = ['/login']
  readRouterTopology.mockReturnValue([
    {
      path: '/dev/orgrbacdemo/builtin-position',
      name: 'builtinPosition',
      meta: { title: '内置岗位' },
      pageComponent: 'AmisPageRoute',
      children: [],
    },
  ])
  window.location.href = 'https://example.test/dev/orgrbacdemo/builtin-position?tab=todo'
  window.location.pathname = '/dev/orgrbacdemo/builtin-position'
  window.location.search = '?tab=todo'
  window.location.hash = ''

  routerEngineModule.refreshRouter()

  await flush()

  expect(tabs.openOrSwitchTab).toHaveBeenCalledWith('/dev/orgrbacdemo/builtin-position?tab=todo', {
    title: '内置岗位',
    syncLocation: false,
    isCurrent: expect.any(Function),
  })
  expect(store.getters.activeTabId).toBe('tab-1')
  expect(document.title).toBe('内置岗位 - 测试平台')
})
