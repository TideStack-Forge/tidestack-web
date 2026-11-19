import { beforeEach, expect, test, vi } from 'vitest'

const { store, tabs, replaceLocation, getRouteInfo, isExternal, resolvePostLoginFallbackPath } = vi.hoisted(() => ({
  store: {
    getters: {
      'user/menu': { globalMenu: [] },
      'menu': { globalMenu: [] },
      'app/homePage': '',
      'user/menuGetter': vi.fn(),
    },
  },
  tabs: {
    openOrSwitchTab: vi.fn(),
  },
  replaceLocation: vi.fn(),
  getRouteInfo: vi.fn(),
  isExternal: vi.fn(),
  resolvePostLoginFallbackPath: vi.fn(),
}))

vi.mock('@/store/storeFacade', () => ({
  store,
}))

vi.mock('@/common/tabs', () => ({
  default: tabs,
}))

vi.mock('@/router/routerFacade', () => ({
  replaceLocation,
}))

vi.mock('@/router/utils', () => ({
  getRouteInfo,
}))

vi.mock('@/utils/url', () => ({
  isExternal,
}))

vi.mock('@/common/menus/post-login', async () => {
  const actual = await import('../../../../../../src/common/menus/post-login.ts')
  return {
    ...actual,
    resolvePostLoginFallbackPath,
  }
})

vi.mock('@/common/menus/post-login-navigation', async () => {
  const actual = await import('../../../../../../src/common/menus/post-login-navigation.ts')
  return {
    performPostLoginNavigation: actual.performPostLoginNavigation,
  }
})

import { openMenuAfterLogin, openMenuItem, readPostLoginTarget } from '../../../../../../src/common/menus/index.js'

beforeEach(() => {
  store.getters['user/menu'] = { globalMenu: [] }
  store.getters.menu = { globalMenu: [] }
  store.getters['app/homePage'] = ''
  store.getters['user/menuGetter'].mockReset()
  tabs.openOrSwitchTab.mockReset()
  replaceLocation.mockReset()
  getRouteInfo.mockReset()
  isExternal.mockReset()
  isExternal.mockReturnValue(false)
  resolvePostLoginFallbackPath.mockReset()
  resolvePostLoginFallbackPath.mockReturnValue('/errorAfterLogin')
  Object.defineProperty(globalThis, 'window', {
    value: {
      open: vi.fn(),
      location: {
        origin: 'http://localhost:8080',
        href: 'http://localhost:8080/',
      },
      history: {
        replaceState: vi.fn(),
      },
    },
    configurable: true,
    writable: true,
  })
})

test('configured homePage opens the menu path through tab orchestration', async () => {
  const menu = {
    globalMenu: [{ title: '应用开发看板', path: '/dev/app-list', key: 'app-list', icon: 'icon-ui-model' }],
  }

  store.getters['user/menu'] = menu
  store.getters.menu = menu
  store.getters['app/homePage'] = '/dev/app-list'
  store.getters['user/menuGetter'].mockImplementation((targetPath) => {
    if (targetPath === '/dev/app-list') {
      return menu.globalMenu[0]
    }
    return null
  })
  getRouteInfo.mockReturnValue({ name: 'app-list', path: '/dev/app-list' })

  await openMenuAfterLogin()

  expect(tabs.openOrSwitchTab).toHaveBeenCalledWith('/dev/app-list', {
    title: '应用开发看板',
    breadcrumbs: [{ title: '应用开发看板', path: '/dev/app-list', key: 'app-list' }],
    defaultIcon: 'icon-ui-model',
  })
  expect(replaceLocation).not.toHaveBeenCalled()
})

test('valid non-menu route opens the route tab path', async () => {
  const menu = {
    globalMenu: [{ title: '应用开发看板', path: '/dev/app-list', key: 'app-list' }],
  }

  store.getters['user/menu'] = menu
  store.getters.menu = menu
  store.getters['app/homePage'] = '/welcome'
  store.getters['user/menuGetter'].mockReturnValue(null)
  getRouteInfo.mockImplementation((targetPath) => {
    if (targetPath === '/welcome') {
      return { name: 'welcome', path: '/welcome' }
    }
    return { name: 'notFound', path: targetPath }
  })

  await openMenuAfterLogin()

  expect(tabs.openOrSwitchTab).toHaveBeenCalledWith('/welcome', {})
  expect(replaceLocation).not.toHaveBeenCalled()
})

test('unmatched target falls back to replacing with the resolved post-login path', async () => {
  const menu = { globalMenu: [] }

  store.getters['user/menu'] = menu
  store.getters.menu = menu
  store.getters['app/homePage'] = '/dev/missing'
  store.getters['user/menuGetter'].mockReturnValue(null)
  getRouteInfo.mockReturnValue({ name: 'notFound', path: '/dev/missing' })
  resolvePostLoginFallbackPath.mockReturnValue('/errorAfterLogin')

  await openMenuAfterLogin()

  expect(replaceLocation).toHaveBeenCalledWith('/errorAfterLogin')
  expect(tabs.openOrSwitchTab).not.toHaveBeenCalled()
})

test('openMenuItem uses the resolved child target for external links', async () => {
  const externalChild = {
    title: 'External Docs',
    url: 'https://example.com/docs',
  }

  isExternal.mockImplementation((url) => url === 'https://example.com/docs')

  await openMenuItem({
    title: 'Parent Group',
    children: [externalChild],
  })

  expect(window.open).toHaveBeenCalledWith('https://example.com/docs')
})

test('openMenuItem applies fullScreen mode from the resolved child target', async () => {
  isExternal.mockReturnValue(false)
  getRouteInfo.mockReturnValue({ name: 'welcome', path: '/welcome' })

  await openMenuItem({
    title: 'Parent Group',
    children: [
      {
        title: 'Child FullScreen',
        path: '/welcome',
        showMode: 'fullScreen',
      },
    ],
  })

  expect(replaceLocation).toHaveBeenCalledWith('/welcome?isfullscreen=true')
  expect(tabs.openOrSwitchTab).not.toHaveBeenCalled()
})

test('closing the last tab resolves a fullscreen home to the final fullscreen URL', () => {
  store.getters['user/menu'] = { globalMenu: [{ path: '/welcome?view=all#summary', showMode: 'fullScreen' }] }
  getRouteInfo.mockReturnValue({ name: 'welcome' })
  expect(readPostLoginTarget().path).toBe('/welcome?view=all&isfullscreen=true#summary')
  expect(replaceLocation).not.toHaveBeenCalled()
})

test.each([
  { url: 'https://example.com/docs' },
  { path: '/dev-docs', showMode: 'newWindow' },
])('closing the last tab retains a shell URL for out-of-window home %j', async (menu) => {
  store.getters['user/menu'] = { globalMenu: [menu] }
  resolvePostLoginFallbackPath.mockReturnValue('/welcome')
  isExternal.mockImplementation(url => url.startsWith('https://'))
  expect(readPostLoginTarget().path).toBe('/welcome')
  await openMenuAfterLogin({ syncLocation: false })
  expect(window.open).toHaveBeenCalledWith(menu.url || menu.path)
  expect(replaceLocation).not.toHaveBeenCalled()
  expect(tabs.openOrSwitchTab).not.toHaveBeenCalled()
})

test('openMenuItem opens newWindow menus as plain links for relative paths', async () => {
  isExternal.mockReturnValue(false)
  getRouteInfo.mockReturnValue({ name: 'notFound', path: '/dev-docs' })

  await openMenuItem({
    title: '开发文档',
    path: '/dev-docs',
    showMode: 'newWindow',
  })

  expect(window.open).toHaveBeenCalledWith('/dev-docs')
  expect(window.open).not.toHaveBeenCalledWith('/dev-docs?isfullscreen=true')
  expect(tabs.openOrSwitchTab).not.toHaveBeenCalled()
  expect(replaceLocation).not.toHaveBeenCalled()
})

test('openMenuItem does not inherit parent fullScreen mode when resolved child has no showMode', async () => {
  isExternal.mockReturnValue(false)
  getRouteInfo.mockReturnValue({ name: 'welcome', path: '/welcome' })

  await openMenuItem({
    title: 'Parent Group',
    showMode: 'fullScreen',
    children: [
      {
        title: 'Child Default',
        path: '/welcome',
      },
    ],
  })

  expect(tabs.openOrSwitchTab).toHaveBeenCalledWith('/welcome', {
    title: 'Child Default',
    breadcrumbs: [{ title: 'Child Default', path: '/welcome', key: undefined }],
    defaultIcon: '',
  })
  expect(replaceLocation).not.toHaveBeenCalled()
})

test('openMenuItem forwards fixed-tab preference from the resolved menu target', async () => {
  isExternal.mockReturnValue(false)
  getRouteInfo.mockReturnValue({ name: 'welcome', path: '/welcome' })

  await openMenuItem({
    title: 'Parent Group',
    children: [
      {
        title: 'Child Fixed',
        path: '/welcome',
        isFixedTab: true,
      },
    ],
  })

  expect(tabs.openOrSwitchTab).toHaveBeenCalledWith('/welcome', {
    title: 'Child Fixed',
    breadcrumbs: [{ title: 'Child Fixed', path: '/welcome', key: undefined }],
    defaultIcon: '',
    isFixed: true,
  })
})

test('openMenuItem also reads fixed-tab preference from menu extraProps', async () => {
  isExternal.mockReturnValue(false)
  getRouteInfo.mockReturnValue({ name: 'welcome', path: '/welcome' })

  await openMenuItem({
    title: 'Parent Group',
    children: [
      {
        title: 'Child Fixed ExtraProps',
        path: '/welcome',
        extraProps: {
          isFixedTab: true,
        },
      },
    ],
  })

  expect(tabs.openOrSwitchTab).toHaveBeenCalledWith('/welcome', {
    title: 'Child Fixed ExtraProps',
    breadcrumbs: [{ title: 'Child Fixed ExtraProps', path: '/welcome', key: undefined }],
    defaultIcon: '',
    isFixed: true,
  })
})
