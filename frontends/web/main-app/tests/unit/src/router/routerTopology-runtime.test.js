import { beforeEach, expect, test, vi } from 'vitest'

const { store, mergeRoutes, routersUnique, buildErrorRoutes, buildAppLayoutRoute, buildRouterTopology } =
  vi.hoisted(() => ({
    store: {
      getters: {
        initialized: false,
        routes: [],
        microWhiteRoutesMap: {},
        'app/initialized': true,
        'app/routes': [{ path: '/legacy' }],
        'app/microWhiteRoutesMap': { legacy: [{ path: '/legacy-white' }] },
      },
    },
    mergeRoutes: vi.fn(),
    routersUnique: vi.fn(),
    buildErrorRoutes: vi.fn(() => [{ path: '*', name: 'error' }]),
    buildAppLayoutRoute: vi.fn(() => ({ path: '/', children: [] })),
    buildRouterTopology: vi.fn(() => [{ path: '/', children: [] }]),
  }))

vi.mock('@/store/storeFacade', () => ({
  store,
}))

vi.mock('@/features/system/pages/ErrorPage', () => ({
  ErrorPage: { name: 'ErrorPage' },
}))

vi.mock('../../../../src/router/utils.ts', () => ({
  mergeRoutes,
  routersUnique,
}))

vi.mock('../../../../src/router/internalRoutes.ts', () => ({
  standaloneInternalRoutes: [{ path: '/login' }],
  appLayoutChildren: [{ path: '/welcome' }],
}))

vi.mock('../../../../src/router/routerTopology.ts', () => ({
  buildErrorRoutes,
  buildAppLayoutRoute,
  buildRouterTopology,
}))

const routerTopologyRuntimeModule = await import('../../../../src/router/routerTopologyRuntime.ts')

beforeEach(() => {
  store.getters.initialized = false
  store.getters.routes = []
  store.getters.microWhiteRoutesMap = {}
  store.getters['app/initialized'] = true
  store.getters['app/routes'] = [{ path: '/legacy' }]
  store.getters['app/microWhiteRoutesMap'] = { legacy: [{ path: '/legacy-white' }] }
  mergeRoutes.mockReset()
  routersUnique.mockReset()
  buildErrorRoutes.mockClear()
  buildAppLayoutRoute.mockClear()
  buildRouterTopology.mockClear()
  buildRouterTopology.mockReturnValue([{ path: '/', children: [] }])
})

test('readRouterTopology consumes converged root route-state seam and delegates to pure topology builder', () => {
  const runtimeRoutes = [{ path: '/dev/app-list' }]
  const runtimeWhiteRoutesMap = { appLayout: [{ path: '/micro/white' }] }
  const layoutComponent = { name: 'LayoutStub' }

  store.getters.initialized = true
  store.getters.routes = runtimeRoutes
  store.getters.microWhiteRoutesMap = runtimeWhiteRoutesMap

  expect(routerTopologyRuntimeModule.readRouterTopology(layoutComponent)).toEqual([{ path: '/', children: [] }])

  expect(buildRouterTopology).toHaveBeenCalledWith(
    expect.objectContaining({
      initialized: true,
      routes: runtimeRoutes,
      microWhiteRoutesMap: runtimeWhiteRoutesMap,
      mergeRoutes,
      routersUnique,
    })
  )
  expect(buildAppLayoutRoute).toHaveBeenCalledWith(layoutComponent, expect.any(Array))
  expect(buildErrorRoutes).toHaveBeenCalledTimes(1)
})
