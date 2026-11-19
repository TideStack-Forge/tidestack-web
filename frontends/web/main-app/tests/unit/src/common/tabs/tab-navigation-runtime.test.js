import { beforeEach, expect, test, vi } from 'vitest'

const {
  store,
  replaceLocation,
  getRouteInfo,
  openMenuAfterLogin,
  subscribe,
  publish,
  removeReplayEvent,
  unsubscribeAll,
  tn,
  tCommon,
  delay,
  uniqueId,
  querySelector,
  normalizeTabPath,
  findBestMatchingTabId,
} = vi.hoisted(() => ({
  store: {
    getters: {
      tabsList: [],
      activeTabId: '',
      scrollBarScrollTopMap: {},
      'user/menuGetter': vi.fn(),
      'app/config': {},
    },
    dispatch: vi.fn(),
  },
  replaceLocation: vi.fn(),
  getRouteInfo: vi.fn(),
  openMenuAfterLogin: vi.fn(),
  subscribe: vi.fn(),
  publish: vi.fn(),
  removeReplayEvent: vi.fn(),
  unsubscribeAll: vi.fn(),
  tn: vi.fn(),
  tCommon: vi.fn(),
  delay: vi.fn((fn) => fn()),
  uniqueId: vi.fn(() => 'tab-notfound-1'),
  querySelector: vi.fn(),
  normalizeTabPath: vi.fn(),
  findBestMatchingTabId: vi.fn(),
}))

vi.mock('@/store/storeFacade', () => ({
  store,
}))

vi.mock('@/router/tabNavigationCommand', () => ({
  navigateTab: replaceLocation,
}))

vi.mock('@/router/utils', () => ({
  getRouteInfo,
}))

vi.mock('@/common/menus', () => ({
  openMenuAfterLogin,
  readPostLoginTarget: () => ({ path: '/welcome' }),
}))

vi.mock('@/common/eventBus', () => ({
  EventBus: {
    subscribe,
    publish,
    removeReplayEvent,
    unsubscribeAll,
  },
}))

vi.mock('@/common/i18n', () => ({
  i18nManager: {
    tn,
    tCommon,
  },
}))

vi.mock('lodash', () => ({
  delay,
  uniqueId,
}))

vi.mock('../../../../../src/common/tabs/tabNavigation.ts', () => ({
  normalizeTabPath,
  findBestMatchingTabId,
  getUrlMatchScore: vi.fn(),
}))

const tabNavigationRuntimeModule =
  await import('../../../../../src/common/tabs/tabNavigationRuntime.ts')

test('editor leave guards reject switch, replace and destructive closes before changing tab state', async () => {
  const tabs = tabNavigationRuntimeModule.default
  store.getters.tabsList = [
    { id: 'other', path: '/other', fullPath: '/other' },
    { id: 'editing', path: '/editing', fullPath: '/editing' },
    { id: 'third', path: '/third', fullPath: '/third' },
  ]
  store.getters.activeTabId = 'editing'
  const remove = tabs.beforeLeave('editing', async () => false)
  try {
    expect(await tabs.switchTab('other')).toBe(false)
    expect(await tabs.openTab('/new')).toBe(false)
    expect(await tabs.replaceTab('editing', '/new')).toBe(false)
    expect(await tabs.updateTab('editing', '/new')).toBe(false)
    expect(await tabs.closeTab('editing')).toBe(false)
    expect(await tabs.closeOtherTabs('other')).toBe(false)
    expect(await tabs.closeRightTabs('other')).toBe(false)
    expect(store.dispatch).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
    expect(store.getters.tabsList[1].fullPath).toBe('/editing')
  } finally {
    remove()
  }
})

test('rejected openOrSwitch leaves target query, breadcrumbs and fixed state intact', async () => {
  const tabs = tabNavigationRuntimeModule.default
  const target = {
    id: 'other',
    path: '/other',
    fullPath: '/other?name=old',
    breadcrumbs: [],
    isFixed: false,
  }
  store.getters.tabsList = [target, { id: 'editing', fullPath: '/editing' }]
  store.getters.activeTabId = 'editing'
  findBestMatchingTabId.mockReturnValue('other')
  const remove = tabs.beforeLeave('editing', () => false)
  try {
    expect(
      await tabs.openOrSwitchTab('/other?name=new', {
        breadcrumbs: [{ title: 'new' }],
        isFixed: true,
      })
    ).toBe(false)
    expect(target).toEqual({
      id: 'other',
      path: '/other',
      fullPath: '/other?name=old',
      breadcrumbs: [],
      isFixed: false,
    })
    expect(store.dispatch).not.toHaveBeenCalled()
    expect(subscribe).not.toHaveBeenCalled()
  } finally {
    remove()
  }
})

test('removing a leave guard restores normal tab switching', async () => {
  const tabs = tabNavigationRuntimeModule.default
  store.getters.activeTabId = 'editing'
  store.getters.tabsList = [{ id: 'other', path: '/other', fullPath: '/other' }]
  const remove = tabs.beforeLeave('editing', () => false)
  remove()
  await tabs.switchTab('other')
  expect(store.dispatch).toHaveBeenCalledWith('tabs/changeActiveTab', 'other')
})

test('updating an existing tab preserves the accepted query and resolved icon in the store', async () => {
  const tabs = tabNavigationRuntimeModule.default
  store.getters.tabsList = [{ id: 'target', path: '/items', fullPath: '/items?old=1', icon: 'old' }]
  findBestMatchingTabId.mockReturnValue('target')
  getRouteInfo.mockReturnValue({ icon: 'new' })
  store.dispatch.mockImplementation((type, payload) => {
    if (type === 'tabs/changeTab') {
      store.getters.tabsList = store.getters.tabsList.map(tab => tab.id === payload.id ? { ...payload } : tab)
    }
    if (type === 'tabs/changeActiveTab') store.getters.activeTabId = payload
  })
  expect(await tabs.openOrSwitchTab('/items?new=2', { isFixed: true })).toBe('target')
  expect(store.getters.tabsList).toEqual([expect.objectContaining({
    fullPath: '/items?new=2', icon: 'new', isFixed: true,
  })])
  expect(store.getters.activeTabId).toBe('target')
})

test('a superseded existing-tab projection does not apply metadata or subscribe callbacks', async () => {
  const tabs = tabNavigationRuntimeModule.default
  store.getters.tabsList = [{ id: 'target', fullPath: '/items' }]
  findBestMatchingTabId.mockReturnValue('target')
  const callback = vi.fn()
  const switchTab = vi.spyOn(tabs, 'switchTab').mockResolvedValue(undefined)
  try {
    expect(await tabs.openOrSwitchTab('/items', { syncLocation: false, isCurrent: () => false, isFixed: true, callback })).toBe(false)
    expect(store.dispatch).not.toHaveBeenCalled()
    expect(subscribe).not.toHaveBeenCalled()
  } finally {
    switchTab.mockRestore()
  }
})

beforeEach(() => {
  store.getters.tabsList = []
  store.getters.activeTabId = ''
  store.getters.scrollBarScrollTopMap = {}
  store.getters['user/menuGetter'].mockReset()
  store.getters['app/config'] = {}
  store.dispatch.mockReset()
  replaceLocation.mockReset().mockImplementation(async (_path, project) => (await project?.(() => true)) !== false)
  getRouteInfo.mockReset()
  openMenuAfterLogin.mockReset()
  subscribe.mockReset()
  publish.mockReset()
  removeReplayEvent.mockReset()
  unsubscribeAll.mockReset()
  tn.mockReset()
  tCommon.mockReset()
  delay.mockClear()
  uniqueId.mockClear()
  querySelector.mockReset()
  normalizeTabPath.mockReset()
  findBestMatchingTabId.mockReset()
  normalizeTabPath.mockImplementation((value) => value)
  Object.defineProperty(globalThis, 'document', {
    value: {
      querySelector,
    },
    configurable: true,
    writable: true,
  })
})

test('openOrSwitchTab prefers the best matching existing tab', async () => {
  store.getters.tabsList = [
    { id: 'tab-1', path: '/dev/app-list', fullPath: '/dev/app-list?tab=todo' },
  ]
  findBestMatchingTabId.mockReturnValue('tab-1')
  const switchTab = vi
    .spyOn(tabNavigationRuntimeModule.default, 'switchTab')
    .mockResolvedValue(undefined)

  const result = await tabNavigationRuntimeModule.default.openOrSwitchTab(
    '/dev/app-list?tab=todo',
    {
      callback: vi.fn(),
    }
  )

  expect(findBestMatchingTabId).toHaveBeenCalledWith(
    '/dev/app-list?tab=todo',
    store.getters.tabsList
  )
  expect(switchTab).toHaveBeenCalledWith('tab-1', expect.objectContaining({ callback: expect.any(Function), syncLocation: false, isCurrent: expect.any(Function) }))
  expect(subscribe).toHaveBeenCalledWith('MSG_FROM_TAB_tab-1', expect.any(Function))
  expect(result).toBe('tab-1')
  switchTab.mockRestore()
})

test('switchTab skips replaceLocation when location sync is disabled', async () => {
  querySelector.mockReturnValue({ scrollTop: 42 })
  store.getters.activeTabId = 'tab-2'
  store.getters.tabsList = [
    { id: 'tab-1', path: '/dev/app-list', fullPath: '/dev/app-list?tab=todo' },
    { id: 'tab-2', path: '/dev/home', fullPath: '/dev/home' },
  ]
  store.getters.scrollBarScrollTopMap = { 'tab-1': 16 }

  await tabNavigationRuntimeModule.default.switchTab('tab-1', { syncLocation: false })

  expect(store.dispatch).not.toHaveBeenCalledWith('tabs/setPreventTabOperation')
  expect(store.dispatch).toHaveBeenCalledWith('tabs/changeActiveTab', 'tab-1')
  expect(replaceLocation).not.toHaveBeenCalled()
})

test('switchTab still syncs location by default for direct callers', async () => {
  querySelector.mockReturnValue({ scrollTop: 42 })
  store.getters.activeTabId = 'tab-2'
  store.getters.tabsList = [
    { id: 'tab-1', path: '/dev/app-list', fullPath: '/dev/app-list?tab=todo' },
    { id: 'tab-2', path: '/dev/home', fullPath: '/dev/home' },
  ]

  await tabNavigationRuntimeModule.default.switchTab('tab-1')

  expect(replaceLocation).toHaveBeenCalledWith('/dev/app-list?tab=todo', expect.any(Function))
})

test('openOrSwitchTab passes disabled location sync to matched tab switch', async () => {
  store.getters.tabsList = [
    { id: 'tab-1', path: '/dev/app-list', fullPath: '/dev/app-list?tab=todo' },
  ]
  findBestMatchingTabId.mockReturnValue('tab-1')
  const switchTab = vi
    .spyOn(tabNavigationRuntimeModule.default, 'switchTab')
    .mockResolvedValue(undefined)

  await tabNavigationRuntimeModule.default.openOrSwitchTab('/dev/app-list?tab=todo', {
    syncLocation: false,
  })

  expect(switchTab).toHaveBeenCalledWith('tab-1', { syncLocation: false })
  switchTab.mockRestore()
})

test('openOrSwitchTab updates a matched tab when the requested query changes', async () => {
  store.getters.tabsList = [
    { id: 'tab-1', path: '/dev/app-list', fullPath: '/dev/app-list' },
  ]
  findBestMatchingTabId.mockReturnValue('tab-1')
  const updateTab = vi
    .spyOn(tabNavigationRuntimeModule.default, 'updateTab')
    .mockResolvedValue(undefined)
  const switchTab = vi
    .spyOn(tabNavigationRuntimeModule.default, 'switchTab')
    .mockResolvedValue(undefined)

  await tabNavigationRuntimeModule.default.openOrSwitchTab(
    '/dev/app-list?resizer-final-check=extreme',
    {
      syncLocation: false,
    }
  )

  expect(updateTab).toHaveBeenCalledWith(
    'tab-1',
    '/dev/app-list?resizer-final-check=extreme',
    { syncLocation: false }
  )
  expect(switchTab).not.toHaveBeenCalled()
  updateTab.mockRestore()
  switchTab.mockRestore()
})

test('openTab derives title via route and i18n fallback and pushes active tab state', async () => {
  querySelector.mockReturnValue({ scrollTop: 42 })
  getRouteInfo.mockReturnValue({
    title: '路由标题',
    type: 'internal',
    icon: 'route-icon',
  })
  store.getters['user/menuGetter'].mockReturnValue({ icon: 'menu-icon' })
  tn.mockReturnValue('/dev/app-list.title')
  tCommon.mockReturnValue('未知页面')
  const getMultiTab = vi
    .spyOn(tabNavigationRuntimeModule.default, 'getMultiTab')
    .mockResolvedValue(true)

  const tabId = await tabNavigationRuntimeModule.default.openTab('/dev/app-list', {
    title: '显式标题',
    icon: 'app',
  })

  expect(store.dispatch).toHaveBeenNthCalledWith(1, 'tabs/pushTabScrollTop', 42)
  expect(store.dispatch).toHaveBeenNthCalledWith(
    2,
    'tabs/pushTab',
    expect.objectContaining({
      path: '/dev/app-list',
      fullPath: '/dev/app-list',
      title: '显式标题',
      icon: 'app',
    })
  )
  expect(store.dispatch).toHaveBeenNthCalledWith(3, 'tabs/changeActiveTab', tabId)
  expect(replaceLocation).toHaveBeenCalledWith('/dev/app-list', expect.any(Function))
  getMultiTab.mockRestore()
})

test('openTab prefers ui-model icon over menu, defaultIcon, and global fallback', async () => {
  querySelector.mockReturnValue({ scrollTop: 42 })
  getRouteInfo.mockReturnValue({
    title: '路由标题',
    type: 'internal',
    icon: 'ui-model-icon',
  })
  store.getters['user/menuGetter'].mockReturnValue({ icon: 'menu-icon' })
  tn.mockReturnValue('/dev/app-list.title')
  tCommon.mockReturnValue('未知页面')
  const getMultiTab = vi
    .spyOn(tabNavigationRuntimeModule.default, 'getMultiTab')
    .mockResolvedValue(true)

  await tabNavigationRuntimeModule.default.openTab('/dev/app-list', {
    defaultIcon: 'default-icon',
  })

  expect(store.dispatch).toHaveBeenCalledWith(
    'tabs/pushTab',
    expect.objectContaining({
      icon: 'ui-model-icon',
    })
  )
  getMultiTab.mockRestore()
})

test('openTab falls back to the best matching menu icon before the explicit defaultIcon', async () => {
  querySelector.mockReturnValue({ scrollTop: 42 })
  getRouteInfo.mockReturnValue({ title: '路由标题', type: 'internal' })
  store.getters['user/menuGetter'].mockImplementation((targetPath) => {
    if (targetPath === '/dev/app-list') {
      return { icon: 'menu-icon' }
    }
    return null
  })
  tn.mockReturnValue('/dev/app-list.title')
  tCommon.mockReturnValue('未知页面')
  const getMultiTab = vi
    .spyOn(tabNavigationRuntimeModule.default, 'getMultiTab')
    .mockResolvedValue(true)

  await tabNavigationRuntimeModule.default.openTab('/dev/app-list?tab=todo', {
    defaultIcon: 'default-icon',
  })

  expect(store.dispatch).toHaveBeenCalledWith(
    'tabs/pushTab',
    expect.objectContaining({
      icon: 'menu-icon',
    })
  )
  getMultiTab.mockRestore()
})

test('openTab falls back to the explicit defaultIcon when no ui-model or menu icon exists', async () => {
  querySelector.mockReturnValue({ scrollTop: 42 })
  getRouteInfo.mockReturnValue({ title: '路由标题', type: 'internal' })
  store.getters['user/menuGetter'].mockReturnValue(null)
  tn.mockReturnValue('/dev/app-list.title')
  tCommon.mockReturnValue('未知页面')
  const getMultiTab = vi
    .spyOn(tabNavigationRuntimeModule.default, 'getMultiTab')
    .mockResolvedValue(true)

  await tabNavigationRuntimeModule.default.openTab('/dev/app-list', {
    defaultIcon: 'default-icon',
  })

  expect(store.dispatch).toHaveBeenCalledWith(
    'tabs/pushTab',
    expect.objectContaining({
      icon: 'default-icon',
    })
  )
  getMultiTab.mockRestore()
})

test('openTab uses the global default icon when no other icon source is available', async () => {
  querySelector.mockReturnValue({ scrollTop: 42 })
  getRouteInfo.mockReturnValue({ title: '路由标题', type: 'internal' })
  store.getters['user/menuGetter'].mockReturnValue(null)
  tn.mockReturnValue('/dev/app-list.title')
  tCommon.mockReturnValue('未知页面')
  const getMultiTab = vi
    .spyOn(tabNavigationRuntimeModule.default, 'getMultiTab')
    .mockResolvedValue(true)

  await tabNavigationRuntimeModule.default.openTab('/dev/app-list')

  expect(store.dispatch).toHaveBeenCalledWith(
    'tabs/pushTab',
    expect.objectContaining({
      icon: 'fas fa-list-ul',
    })
  )
  getMultiTab.mockRestore()
})

test('openTab still syncs location by default for direct callers', async () => {
  querySelector.mockReturnValue({ scrollTop: 42 })
  getRouteInfo.mockReturnValue({ title: '路由标题', type: 'internal' })
  tn.mockReturnValue('/dev/app-list.title')
  tCommon.mockReturnValue('未知页面')
  const getMultiTab = vi
    .spyOn(tabNavigationRuntimeModule.default, 'getMultiTab')
    .mockResolvedValue(true)

  await tabNavigationRuntimeModule.default.openTab('/dev/app-list', { title: '显式标题' })

  expect(replaceLocation).toHaveBeenCalledWith('/dev/app-list', expect.any(Function))
  getMultiTab.mockRestore()
})

test('openTab can replace the current source tab after opening a new one', async () => {
  querySelector.mockReturnValue({ scrollTop: 42 })
  getRouteInfo.mockReturnValue({ title: '业务模型管理', type: 'internal' })
  tn.mockReturnValue('/dev/newenergy/business-model.title')
  tCommon.mockReturnValue('未知页面')
  store.getters.activeTabId = 'tab-source'
  const getMultiTab = vi
    .spyOn(tabNavigationRuntimeModule.default, 'getMultiTab')
    .mockResolvedValue(true)

  const tabId = await tabNavigationRuntimeModule.default.openTab(
    '/dev/newenergy/business-model',
    {
      replaceCurrentTab: true,
    }
  )

  expect(store.dispatch).toHaveBeenCalledWith('tabs/changeActiveTab', tabId)
  getMultiTab.mockRestore()
})

test('openOrSwitchTab can replace the current source tab in place', async () => {
  querySelector.mockReturnValue({ scrollTop: 42 })
  getRouteInfo.mockReturnValue({
    title: '业务模型管理',
    type: 'internal',
    icon: 'route-icon',
  })
  tn.mockReturnValue('/dev/newenergy/business-model.title')
  tCommon.mockReturnValue('未知页面')
  store.getters.activeTabId = 'tab-source'
  store.getters.tabsList = [
    {
      id: 'tab-source',
      path: '/dev/apps',
      fullPath: '/dev/apps',
      title: '打开应用',
      breadcrumbs: [{ title: '打开应用', path: '/dev/apps' }],
      isFixed: false,
      icon: 'old-icon',
    },
  ]
  store.dispatch.mockImplementation(async (type, payload) => {
    if (type === 'tabs/changeTab') {
      store.getters.tabsList = store.getters.tabsList.map((tab) =>
        tab.id === payload.id ? { ...tab, ...payload } : tab
      )
      return
    }
    if (type === 'tabs/changeActiveTab') {
      store.getters.activeTabId = payload
    }
  })

  const result = await tabNavigationRuntimeModule.default.openOrSwitchTab(
    '/dev/newenergy/business-model',
    {
      replaceCurrentTab: true,
    }
  )

  expect(result).toBe('tab-source')
  expect(store.dispatch).toHaveBeenCalledWith(
    'tabs/changeTab',
    expect.objectContaining({
      id: 'tab-source',
      path: '/dev/newenergy/business-model',
      fullPath: '/dev/newenergy/business-model',
      icon: 'route-icon',
      breadcrumbs: [],
    })
  )
  expect(store.dispatch).toHaveBeenCalledWith('tabs/changeActiveTab', 'tab-source')
  expect(replaceLocation).toHaveBeenCalledWith('/dev/newenergy/business-model', expect.any(Function))
})

test('openOrSwitchTab skips replaceLocation during guard-driven open', async () => {
  querySelector.mockReturnValue({ scrollTop: 42 })
  getRouteInfo.mockReturnValue({ title: '路由标题', type: 'internal' })
  tn.mockReturnValue('/dev/app-list.title')
  tCommon.mockReturnValue('未知页面')
  findBestMatchingTabId.mockReturnValue(undefined)
  const getMultiTab = vi
    .spyOn(tabNavigationRuntimeModule.default, 'getMultiTab')
    .mockResolvedValue(true)

  await tabNavigationRuntimeModule.default.openOrSwitchTab('/dev/app-list?tab=todo', {
    title: '显式标题',
    syncLocation: false,
  })

  expect(replaceLocation).not.toHaveBeenCalled()
  getMultiTab.mockRestore()
})

test('moveTab delegates drag reordering to the tabs store module', async () => {
  await tabNavigationRuntimeModule.default.moveTab('tab-1', 'tab-3', 'after')

  expect(store.dispatch).toHaveBeenCalledWith('tabs/moveTab', {
    sourceTabId: 'tab-1',
    targetTabId: 'tab-3',
    position: 'after',
  })
})

test('closeTab refuses fixed tabs unless the caller explicitly overrides the guard', async () => {
  store.getters.tabsList = [{ id: 'tab-fixed', fullPath: '/dev/app-list', isFixed: true }]
  store.getters.activeTabId = 'tab-fixed'

  const result = await tabNavigationRuntimeModule.default.closeTab('tab-fixed')

  expect(result).toBe(false)
  expect(store.dispatch).not.toHaveBeenCalledWith('tabs/closeTab', 'tab-fixed')
  expect(publish).not.toHaveBeenCalled()
})

test('closeTab allows fixed tabs to be closed when the override option is enabled', async () => {
  store.getters.tabsList = [{ id: 'tab-fixed', fullPath: '/dev/app-list', isFixed: true }]
  store.getters.activeTabId = 'tab-fixed'
  store.dispatch.mockImplementation(async (type) => {
    if (type === 'tabs/closeTab') {
      store.getters.tabsList = []
    }
  })

  await tabNavigationRuntimeModule.default.closeTab('tab-fixed', null, {
    allowFixedTabClose: true,
    skipEmptyShellFallback: true,
  })

  expect(store.dispatch).toHaveBeenCalledWith('tabs/closeTab', 'tab-fixed')
  expect(publish).toHaveBeenCalledWith('closeTab', { tabId: 'tab-fixed', result: null })
})

test('closeOtherTabs preserves fixed tabs by default and still routes to the requested keep tab', async () => {
  store.getters.tabsList = [
    { id: 'tab-fixed', fullPath: '/dev/fixed', isFixed: true },
    { id: 'tab-keep', fullPath: '/dev/app-list' },
    { id: 'tab-active', fullPath: '/dev/app-a' },
  ]
  store.getters.activeTabId = 'tab-active'
  store.dispatch.mockImplementation(async (type, payload) => {
    if (type === 'tabs/closeOtherTabs') {
      const { saveId, includeFixedTabs } = payload
      store.getters.tabsList = store.getters.tabsList.filter(
        (tab) => tab.id === saveId || (!includeFixedTabs && tab.isFixed)
      )
      store.getters.activeTabId = saveId
    }
  })

  await tabNavigationRuntimeModule.default.closeOtherTabs('tab-keep')

  expect(publish).toHaveBeenCalledWith('closeTab', { tabId: 'tab-active' })
  expect(publish).not.toHaveBeenCalledWith('closeTab', { tabId: 'tab-fixed' })
  expect(store.dispatch).toHaveBeenCalledWith('tabs/closeOtherTabs', {
    saveId: 'tab-keep',
    includeFixedTabs: false,
  })
  expect(replaceLocation).toHaveBeenCalledWith('/dev/app-list', expect.any(Function))
})

test('closeOtherTabs can keep the requested tab active even when no closable tabs remain', async () => {
  store.getters.tabsList = [
    { id: 'tab-fixed', fullPath: '/dev/fixed', isFixed: true },
    { id: 'tab-keep', fullPath: '/dev/app-list' },
  ]
  store.getters.activeTabId = 'tab-fixed'

  await tabNavigationRuntimeModule.default.closeOtherTabs('tab-keep')

  expect(publish).not.toHaveBeenCalledWith('closeTab', expect.anything())
  expect(store.dispatch).not.toHaveBeenCalledWith(
    'tabs/closeOtherTabs',
    expect.anything()
  )
  expect(store.dispatch).toHaveBeenCalledWith('tabs/changeActiveTab', 'tab-keep')
  expect(replaceLocation).toHaveBeenCalledWith('/dev/app-list', expect.any(Function))
})

test('closeTab falls back to openMenuAfterLogin when the last tab closes', async () => {
  store.getters.tabsList = [{ id: 'tab-1', fullPath: '/dev/app-list' }]
  store.getters.activeTabId = 'tab-1'
  store.dispatch.mockImplementation(async (type) => {
    if (type === 'tabs/closeTab') {
      store.getters.tabsList = []
    }
  })

  await tabNavigationRuntimeModule.default.closeTab('tab-1')
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()

  expect(store.dispatch).toHaveBeenCalledWith('tabs/closeTab', 'tab-1')
  expect(publish).toHaveBeenCalledWith('closeTab', { tabId: 'tab-1', result: null })
  expect(store.dispatch).toHaveBeenCalledWith('tabs/changeActiveTab', '')
  expect(openMenuAfterLogin).toHaveBeenCalledTimes(1)
  expect(store.dispatch).toHaveBeenCalledWith('app/init')
  expect(store.dispatch).toHaveBeenCalledWith('user/fetchMenu')
  const initCall = store.dispatch.mock.calls.findIndex(([type]) => type === 'app/init')
  const fetchMenuCall = store.dispatch.mock.calls.findIndex(
    ([type]) => type === 'user/fetchMenu'
  )
  const openMenuCall = openMenuAfterLogin.mock.invocationCallOrder[0]
  expect(initCall).toBeLessThan(fetchMenuCall)
  expect(store.dispatch.mock.invocationCallOrder[fetchMenuCall]).toBeLessThan(
    openMenuCall
  )
})

test('closeTab returns to platform home without clearing global shell replay state', async () => {
  store.getters.tabsList = [
    { id: 'tab-1', fullPath: '/dev/newenergy/business-model-management' },
  ]
  store.getters.activeTabId = 'tab-1'
  store.dispatch.mockImplementation(async (type) => {
    if (type === 'tabs/closeTab') {
      store.getters.tabsList = []
    }
  })

  await tabNavigationRuntimeModule.default.closeTab('tab-1')
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()

  const initCall = store.dispatch.mock.calls.findIndex(([type]) => type === 'app/init')
  expect(removeReplayEvent).not.toHaveBeenCalled()
  expect(initCall).toBeGreaterThan(-1)
  expect(openMenuAfterLogin).toHaveBeenCalledTimes(1)
})

test('closeTab does not clear app shell replay when leaving a public tab', async () => {
  store.getters.tabsList = [{ id: 'tab-1', fullPath: '/dev/apps' }]
  store.getters.activeTabId = 'tab-1'
  store.dispatch.mockImplementation(async (type) => {
    if (type === 'tabs/closeTab') {
      store.getters.tabsList = []
    }
  })

  await tabNavigationRuntimeModule.default.closeTab('tab-1')

  expect(store.dispatch).toHaveBeenCalledWith('tabs/closeTab', 'tab-1')
  expect(removeReplayEvent).not.toHaveBeenCalled()
  expect(store.dispatch).toHaveBeenCalledWith('tabs/changeActiveTab', '')
  expect(store.dispatch).toHaveBeenCalledWith('app/init')
  expect(store.dispatch).toHaveBeenCalledWith('user/fetchMenu')
  expect(openMenuAfterLogin).toHaveBeenCalledTimes(1)
})

test('closeTab synchronously activates the previous tab when closing the active tab', async () => {
  store.getters.tabsList = [
    { id: 'tab-1', fullPath: '/dev/app-list' },
    { id: 'tab-2', fullPath: '/dev/app-a' },
  ]
  store.getters.activeTabId = 'tab-2'
  store.dispatch.mockImplementation(async (type, payload) => {
    if (type === 'tabs/closeTab') {
      store.getters.tabsList = store.getters.tabsList.filter((tab) => tab.id !== payload)
    }
    if (type === 'tabs/changeActiveTab') {
      store.getters.activeTabId = payload
    }
  })

  await tabNavigationRuntimeModule.default.closeTab('tab-2')

  expect(delay).not.toHaveBeenCalled()
  expect(store.dispatch).toHaveBeenCalledWith('tabs/changeActiveTab', 'tab-1')
  expect(replaceLocation).toHaveBeenCalledWith('/dev/app-list', expect.any(Function))
  expect(openMenuAfterLogin).not.toHaveBeenCalled()
})

test('openTab replaces the only non-multi tab while preserving explicit metadata', async () => {
  querySelector.mockReturnValue({ scrollTop: 24 })
  getRouteInfo.mockReturnValue({ title: '应用详情', type: 'internal' })
  tn.mockReturnValue('/dev/app-detail.title')
  tCommon.mockReturnValue('未知页面')
  const getMultiTab = vi
    .spyOn(tabNavigationRuntimeModule.default, 'getMultiTab')
    .mockResolvedValue(false)
  const breadcrumbs = [
    { path: '/dev', title: '开发' },
    { path: '/dev/app-detail', title: '应用详情' },
  ]
  store.getters.tabsList = [
    { id: 'tab-existing', path: '/dev/app-detail', fullPath: '/dev/app-detail?id=1' },
  ]
  store.getters.activeTabId = 'tab-existing'
  store.dispatch.mockImplementation(async (type, payload) => {
    if (type === 'tabs/closeTab') {
      store.getters.tabsList = store.getters.tabsList.filter((tab) => tab.id !== payload)
    }
    if (type === 'tabs/pushTab') {
      store.getters.tabsList.push(payload)
    }
    if (type === 'tabs/changeActiveTab') {
      store.getters.activeTabId = payload
    }
  })

  const callback = vi.fn()
  await tabNavigationRuntimeModule.default.openTab('/dev/app-detail?id=2', {
    title: '显式详情标题',
    breadcrumbs,
    callback,
    icon: 'detail-icon',
  })

  expect(openMenuAfterLogin).not.toHaveBeenCalled()
  expect(store.dispatch).not.toHaveBeenCalledWith('app/init')
  expect(store.dispatch).not.toHaveBeenCalledWith('user/fetchMenu')
  expect(store.dispatch).toHaveBeenCalledWith('tabs/closeTab', 'tab-existing')
  expect(store.dispatch).toHaveBeenCalledWith(
    'tabs/pushTab',
    expect.objectContaining({
      path: '/dev/app-detail',
      fullPath: '/dev/app-detail?id=2',
      title: '显式详情标题',
      breadcrumbs,
      icon: 'detail-icon',
    })
  )
  expect(subscribe).toHaveBeenCalledWith(
    expect.stringMatching(/^MSG_FROM_TAB_tab-/),
    callback
  )
  expect(replaceLocation).toHaveBeenCalledWith('/dev/app-detail?id=2', expect.any(Function))
  getMultiTab.mockRestore()
})

test('updateTabTitle keeps translation-first behavior', async () => {
  store.getters.activeTabId = 'tab-1'
  store.getters.tabsList = [{ id: 'tab-1', path: '/dev/app-list', title: '旧标题' }]
  tn.mockReturnValue('应用列表')

  await tabNavigationRuntimeModule.default.updateTabTitle(undefined, '手工标题')

  expect(store.dispatch).toHaveBeenCalledWith(
    'tabs/changeTab',
    expect.objectContaining({
      id: 'tab-1',
      title: '应用列表',
    })
  )
})
