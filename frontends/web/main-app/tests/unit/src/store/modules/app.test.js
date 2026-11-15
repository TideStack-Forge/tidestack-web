import { describe, expect, test, vi } from 'vitest'

vi.mock('@/common/api/system', () => ({
  default: {
    getAppInfo: vi.fn(),
  },
}))

vi.mock('@/utils/url', () => ({
  isExternal: vi.fn((value) => typeof value === 'string' && /^https?:\/\//.test(value)),
}))

vi.mock('@/utils/localStorage', () => ({
  getItemFromLocal: vi.fn(() => ''),
}))

vi.mock('tree-like-object-utils', () => ({
  walkTree: vi.fn((arr, visitor) => {
    function visit(nodes, parentPath = []) {
      ;(Array.isArray(nodes) ? nodes : []).forEach((value, index) => {
        const node = { value, index }
        visitor(node, parentPath)
        if (Array.isArray(value?.children) && value.children.length) {
          visit(value.children, [...parentPath, node])
        }
      })
    }

    visit(arr)
  }),
}))

vi.mock('@/utils/http', () => ({
  Client: {
    request: vi.fn(),
  },
}))

vi.mock('@/utils/theme', () => ({
  setTheme: vi.fn(),
}))

vi.mock('@/utils/style', () => ({
  addCustomStyle: vi.fn(() => () => undefined),
}))

const appModule = (await import('../../../../../src/store/modules/app.js')).default

describe('store/modules/app route-state ownership', () => {
  test('initializes branding from the top-level web-app-info logo when frontend config omits it', async () => {
    const state = { ...appModule.state }
    const info = {
      logo: '/api/app-metadata/logo.png',
      config: { isLockTheme: true },
    }
    const commit = (type, payload) => appModule.mutations[type](state, payload)

    await appModule.actions.init({ state, commit, dispatch: vi.fn() }, info)

    expect(state.logo).toBe(info.logo)
    expect(state.config.logo).toBeUndefined()
    expect(appModule.getters.logo(state)).toBe(info.logo)
  })

  test('exposes normalized route-facing getters', () => {
    const state = {
      routes: undefined,
      whiteList: undefined,
      microWhiteRoutesMap: undefined,
      initialized: undefined,
    }

    expect(appModule.getters.routes(state)).toEqual([])
    expect(appModule.getters.whiteList(state)).toEqual([])
    expect(appModule.getters.microWhiteRoutesMap(state)).toEqual({})
    expect(appModule.getters.initialized(state)).toBe(false)
  })

  test('SET_ROUTES normalizes route paths without mutating input definitions', () => {
    const route = {
      path: 'dev/app-list/{id}',
      name: '应用列表',
      routeType: 'micro',
      config: { entry: 'app-list' },
    }
    const inputRoutes = [route]
    const state = {
      routes: [],
      quickEntry: 'quick-entry',
    }

    appModule.mutations.SET_ROUTES(state, inputRoutes)

    expect(state.routes[0]).toEqual(
      expect.objectContaining({
        path: '/dev/app-list/:id',
        type: 'micro',
        title: '应用列表',
      })
    )
    expect(route.path).toBe('dev/app-list/{id}')
    expect(route.type).toBeUndefined()
    expect(route.title).toBeUndefined()
  })

  test('SET_WHITE_LIST derives public routes without duplicates', () => {
    const state = {
      whiteList: ['/login'],
    }

    appModule.mutations.SET_WHITE_LIST(state, [
      { path: '/login', isPublic: true },
      { path: '/public/home', isPublic: true },
      { path: '/private/home', isPublic: false },
    ])

    expect(state.whiteList).toEqual(['/login', '/public/home'])
  })

  test('currentSidebarGetter infers the sidebar branch from a compatible route query', () => {
    const currentSidebarGetter = appModule.getters.currentSidebarGetter({})
    const menuTree = [
      {
        title: '开发',
        path: '/dev',
        key: 'dev',
        children: [
          {
            title: '应用列表',
            path: '/dev/app-list',
            key: 'app-list',
          },
        ],
      },
    ]

    expect(currentSidebarGetter(menuTree, '/dev/app-list?tab=todo')).toEqual([
      [
        menuTree[0],
        menuTree[0].children[0],
      ],
    ])
  })

  test('currentSidebarGetter prefers the most specific compatible menu when siblings share a path', () => {
    const currentSidebarGetter = appModule.getters.currentSidebarGetter({})
    const menuTree = [
      {
        title: '全部应用',
        path: '/dev/app-list',
        key: 'app-list-all',
      },
      {
        title: '待办应用',
        path: '/dev/app-list?tab=todo',
        key: 'app-list-todo',
      },
    ]

    expect(currentSidebarGetter(menuTree, '/dev/app-list?tab=todo&view=list')).toEqual([
      [menuTree[1]],
    ])
  })
})
