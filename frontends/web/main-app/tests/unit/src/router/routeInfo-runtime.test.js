import { beforeEach, expect, test, vi } from 'vitest'

const { store, resolveLocation, buildRouteInfo, hasRouteDefinition, createAmisPage, isExternal } = vi.hoisted(() => ({
  store: {
    getters: {
      'app/routes': [],
    },
  },
  resolveLocation: vi.fn(),
  buildRouteInfo: vi.fn(),
  hasRouteDefinition: vi.fn(),
  createAmisPage: vi.fn(),
  isExternal: vi.fn(),
}))

vi.mock('@/components/amis/AmisPage', () => ({
  default: createAmisPage,
}))

vi.mock('@/utils/url', () => ({
  isExternal,
}))

vi.mock('@/store/storeFacade', () => ({
  store,
}))

vi.mock('@/router/routerFacade', () => ({
  resolveLocation,
}))

vi.mock('../../../../src/router/routeInfo.ts', () => ({
  buildRouteInfo,
  hasRouteDefinition,
}))

const routerUtilsModule = await import('../../../../src/router/utils.ts')

beforeEach(() => {
  store.getters['app/routes'] = []
  resolveLocation.mockReset()
  buildRouteInfo.mockReset()
  hasRouteDefinition.mockReset()
  hasRouteDefinition.mockImplementation((route, routes) => {
    if (!route || !route.path) {
      throw new TypeError('route.path is required')
    }
    return routes.some((item) => item.path === route.path)
  })
})

test('getRouteInfo delegates the resolved route into the pure builder', () => {
  const resolvedRoute = {
    href: '/dev/app-list?tab=todo',
    resolved: {
      matched: [{ path: '/dev/app-list', meta: { title: '应用列表' } }],
      query: { tab: 'todo' },
      params: {},
      fullPath: '/dev/app-list?tab=todo',
      path: '/dev/app-list',
      hash: '',
    },
  }
  const routeInfo = { path: '/dev/app-list', type: 'internal' }

  resolveLocation.mockReturnValue(resolvedRoute)
  buildRouteInfo.mockReturnValue(routeInfo)

  expect(routerUtilsModule.getRouteInfo('/dev/app-list?tab=todo')).toBe(routeInfo)
  expect(resolveLocation).toHaveBeenCalledWith('/dev/app-list?tab=todo')
  expect(buildRouteInfo).toHaveBeenCalledWith('/dev/app-list?tab=todo', resolvedRoute)
})

test('hasRoute is null-safe and treats missing route definitions as not-found', () => {
  store.getters['app/routes'] = undefined

  expect(routerUtilsModule.hasRoute(null)).toBe(false)
  expect(hasRouteDefinition).not.toHaveBeenCalled()
})

test('hasRoute reads converged root routes seam before the namespaced fallback', () => {
  store.getters.routes = [{ path: '/dev/app-list' }]
  store.getters['app/routes'] = undefined
  hasRouteDefinition.mockReturnValue(true)

  expect(routerUtilsModule.hasRoute({ path: '/dev/app-list' })).toBe(true)
  expect(hasRouteDefinition).toHaveBeenCalledWith({ path: '/dev/app-list' }, [{ path: '/dev/app-list' }])
})
