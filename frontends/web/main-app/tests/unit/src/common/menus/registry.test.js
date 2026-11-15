import { beforeEach, describe, expect, test, vi } from 'vitest'

const { mockStore, mockDispatch, mockSubscribeState, triggerMutation, resetStoreTree } =
  vi.hoisted(() => {
    const buildTree = () => ({
      globalMenu: [
        {
          fullName: 'dashboard',
          title: '仪表盘',
          path: '/dashboard',
          children: [{ fullName: 'dashboard.overview', title: '概览', path: '/dashboard/overview' }],
        },
        {
          fullName: 'system',
          title: '系统',
          path: '/system',
          children: [
            {
              fullName: 'system.user',
              title: '用户',
              path: '/system/user',
              children: [{ fullName: 'system.user.list', title: '用户列表', path: '/system/user/list' }],
            },
          ],
        },
      ],
      globalSubNav: [{ fullName: 'help', title: '帮助', path: '/help' }],
    })
    const store = { menu: buildTree() }
    let mutationListener = null
    return {
      mockStore: store,
      resetStoreTree: () => {
        store.menu = buildTree()
      },
      mockDispatch: vi.fn((type, payload) => {
        if (type === 'user/updateMenu') {
          store.menu.globalMenu = payload.main
          store.menu.globalSubNav = payload.secondary
        }
      }),
      mockSubscribeState: vi.fn((listener) => {
        mutationListener = listener
        return () => {}
      }),
      triggerMutation: (type) => mutationListener?.({ type, payload: undefined }, store),
    }
  })

vi.mock('@/store/storeFacade', () => ({
  readGetters: () => ({ 'user/menu': mockStore.menu }),
  dispatch: mockDispatch,
  subscribeState: mockSubscribeState,
}))

const {
  menu,
  userMenu,
  getMenuBadgeForItem,
  installMenuExtensionStoreLifecycle,
  resetMenuExtensionRuntime,
  subscribeMenuExtension,
} = await import('@/common/menus/registry')

describe('初始化顺序', () => {
  test('导入 registry 不立即订阅 store，避免启动期循环依赖触发 TDZ', () => {
    expect(mockSubscribeState).not.toHaveBeenCalled()
  })

  test('显式安装生命周期订阅且保持幂等', () => {
    installMenuExtensionStoreLifecycle()
    installMenuExtensionStoreLifecycle()
    expect(mockSubscribeState).toHaveBeenCalledTimes(1)
  })
})

describe('菜单徽标（badge）', () => {
  beforeEach(() => {
    resetMenuExtensionRuntime()
    mockDispatch.mockClear()
  })

  test('setMenuBadge 按 fullName 设置，渲染侧按菜单项引用命中', () => {
    menu.setMenuBadge('dashboard', { type: 'number', value: 3 })
    const item = mockStore.menu.globalMenu[0]
    expect(getMenuBadgeForItem(item)).toEqual({ type: 'number', value: 3 })
  })

  test('设置时用 fullName、查询时用 path 也能命中', () => {
    menu.setMenuBadge('dashboard.overview', { type: 'dot' })
    expect(menu.getMenuBadge('/dashboard/overview')).toEqual({ type: 'dot' })
    expect(getMenuBadgeForItem({ path: '/dashboard/overview' })).toEqual({ type: 'dot' })
  })

  test('setMenuBadge 传 null 清除徽标并通知订阅者', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeMenuExtension(listener)
    menu.setMenuBadge('dashboard', { type: 'dot' })
    expect(listener).toHaveBeenCalledTimes(1)
    menu.setMenuBadge('dashboard', null)
    expect(menu.getMenuBadge('dashboard')).toBeUndefined()
    expect(getMenuBadgeForItem(mockStore.menu.globalMenu[0])).toBeUndefined()
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    menu.setMenuBadge('dashboard', { type: 'dot' })
    expect(listener).toHaveBeenCalledTimes(2)
  })

  test('空引用与空徽标操作被忽略', () => {
    menu.setMenuBadge('', { type: 'dot' })
    menu.setMenuBadge('   ', null)
    expect(menu.getMenuBadge('')).toBeUndefined()
  })

  test('目标菜单尚未加载时徽标挂起，菜单加载后自然命中', () => {
    menu.setMenuBadge('not.yet.loaded', { type: 'text', text: 'NEW' })
    expect(menu.getMenuBadge('not.yet.loaded')).toEqual({ type: 'text', text: 'NEW' })
    expect(getMenuBadgeForItem({ fullName: 'not.yet.loaded' })).toEqual({ type: 'text', text: 'NEW' })
  })

  test('徽标覆盖：同一引用重复设置以最后一次为准', () => {
    menu.setMenuBadge('dashboard', { type: 'number', value: 1 })
    menu.setMenuBadge('dashboard', { type: 'number', value: 99 })
    expect(getMenuBadgeForItem(mockStore.menu.globalMenu[0])).toEqual({ type: 'number', value: 99 })
  })
})

describe('菜单树查询与遍历', () => {
  beforeEach(() => {
    resetMenuExtensionRuntime()
    resetStoreTree()
    mockDispatch.mockClear()
  })

  test('getMenu 返回含徽标的副本，不共享 store 引用', () => {
    menu.setMenuBadge('system.user.list', { type: 'dot' })
    const item = menu.getMenu('system.user.list')
    expect(item.badge).toEqual({ type: 'dot' })
    expect(item.title).toBe('用户列表')
    item.title = 'mutated'
    expect(mockStore.menu.globalMenu[1].children[0].children[0].title).toBe('用户列表')
    expect(menu.getMenu('missing')).toBeUndefined()
  })

  test('getMenus 非拍平返回按 scope 过滤的两棵树且全节点合并徽标', () => {
    menu.setMenuBadge('dashboard', { type: 'number', value: 5 })
    const all = menu.getMenus({ scope: 'all' })
    expect(all.main).toHaveLength(2)
    expect(all.secondary).toHaveLength(1)
    expect(all.main[0].badge).toEqual({ type: 'number', value: 5 })
    expect(all.main[0].children[0].badge).toBeUndefined()

    const mainOnly = menu.getMenus({ scope: 'main' })
    expect(mainOnly.secondary).toBeUndefined()
    expect(mainOnly.main).toHaveLength(2)

    const secondaryOnly = menu.getMenus({ scope: 'secondary' })
    expect(secondaryOnly.main).toBeUndefined()
    expect(secondaryOnly.secondary[0].fullName).toBe('help')
  })

  test('getMenus 拍平返回深度优先数组且带 level', () => {
    const flat = menu.getMenus({ scope: 'all', flat: true })
    const names = flat.map((item) => item.fullName)
    expect(names).toEqual([
      'dashboard',
      'dashboard.overview',
      'system',
      'system.user',
      'system.user.list',
      'help',
    ])
    expect(flat[0].level).toBe(1)
    expect(flat[1].level).toBe(2)
  })

  test('traverseMenus 深度优先访问，visitor 返回 false 跳过子树', () => {
    const visited = []
    menu.traverseMenus((item, parents) => {
      visited.push(item.fullName)
      if (item.fullName === 'system') {
        return false
      }
      return undefined
    })
    expect(visited).toEqual(['dashboard', 'dashboard.overview', 'system', 'help'])

    const withParents = []
    menu.traverseMenus((item, parents) => {
      if (item.fullName === 'system.user') {
        withParents.push(parents.map((p) => p.fullName))
      }
    })
    expect(withParents).toEqual([['system']])
  })

  test('traverseMenus 支持 scope 过滤', () => {
    const visited = []
    menu.traverseMenus((item) => {
      visited.push(item.fullName)
    }, { scope: 'secondary' })
    expect(visited).toEqual(['help'])
  })
})

describe('运行时菜单增删', () => {
  beforeEach(() => {
    resetMenuExtensionRuntime()
    resetStoreTree()
    mockDispatch.mockClear()
  })

  test('addMenuItem 追加到主菜单根并落回 store', () => {
    const ok = menu.addMenuItem({
      scope: 'main',
      item: { fullName: 'reports', title: '报表', path: '/reports' },
    })
    expect(ok).toBe(true)
    expect(mockDispatch).toHaveBeenCalledWith('user/updateMenu', expect.any(Object))
    const added = mockStore.menu.globalMenu.find((item) => item.fullName === 'reports')
    expect(added).toBeDefined()
    expect(menu.getMenu('reports').title).toBe('报表')
  })

  test('addMenuItem 支持指定父节点与插入位置', () => {
    const ok = menu.addMenuItem({
      scope: 'main',
      parentFullName: 'system.user',
      index: 0,
      item: { fullName: 'system.user.new', title: '新用户页', path: '/system/user/new' },
    })
    expect(ok).toBe(true)
    const parent = mockStore.menu.globalMenu[1].children[0]
    expect(parent.children[0].fullName).toBe('system.user.new')
    expect(parent.children).toHaveLength(2)
  })

  test('addMenuItem 冲突 / 缺引用 / 父节点不存在时拒绝且不改动树', () => {
    expect(
      menu.addMenuItem({ scope: 'main', item: { fullName: 'dashboard', title: 'x' } })
    ).toBe(false)
    expect(menu.addMenuItem({ scope: 'main', item: { title: 'no-ref' } })).toBe(false)
    expect(
      menu.addMenuItem({
        scope: 'main',
        parentFullName: 'not.exists',
        item: { fullName: 'orphan', title: 'x' },
      })
    ).toBe(false)
    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockStore.menu.globalMenu).toHaveLength(2)
  })

  test('addMenuItem 支持辅助菜单 scope', () => {
    const ok = menu.addMenuItem({
      scope: 'secondary',
      item: { fullName: 'docs', title: '文档', path: '/docs' },
    })
    expect(ok).toBe(true)
    expect(mockStore.menu.globalSubNav.map((item) => item.fullName)).toEqual(['help', 'docs'])
  })

  test('removeMenuItem 删除嵌套节点并级联清理子树徽标', () => {
    menu.setMenuBadge('system.user', { type: 'number', value: 2 })
    menu.setMenuBadge('system.user.list', { type: 'dot' })
    expect(menu.removeMenuItem('system.user')).toBe(true)
    expect(menu.getMenu('system.user')).toBeUndefined()
    expect(menu.getMenu('system.user.list')).toBeUndefined()
    expect(menu.getMenuBadge('system.user')).toBeUndefined()
    expect(menu.getMenuBadge('system.user.list')).toBeUndefined()
    expect(mockStore.menu.globalMenu[1].children).toHaveLength(0)
  })

  test('removeMenuItem 删除根节点与辅助菜单节点，未找到返回 false', () => {
    expect(menu.removeMenuItem('dashboard')).toBe(true)
    expect(mockStore.menu.globalMenu.map((item) => item.fullName)).toEqual(['system'])
    expect(menu.removeMenuItem('help')).toBe(true)
    expect(mockStore.menu.globalSubNav).toHaveLength(0)
    expect(menu.removeMenuItem('missing')).toBe(false)
    expect(mockDispatch).toHaveBeenCalledTimes(2)
  })
})

describe('用户菜单注册表', () => {
  beforeEach(() => {
    resetMenuExtensionRuntime()
    mockDispatch.mockClear()
  })

  test('register 返回 id，getItems 按 order 升序返回同一快照', () => {
    const idB = userMenu.register({ title: 'B', order: 20, onClick: () => {} })
    const idA = userMenu.register({ title: 'A', order: 10, onClick: () => {} })
    expect(userMenu.getItems().map((item) => item.title)).toEqual(['A', 'B'])
    const snapshot = userMenu.getItems()
    expect(userMenu.getItems()).toBe(snapshot)
    userMenu.unregister(idA)
    expect(userMenu.getItems().map((item) => item.title)).toEqual(['B'])
    userMenu.unregister(idB)
    expect(userMenu.getItems()).toHaveLength(0)
    userMenu.unregister('not-exists')
  })

  test('缺省 order 为 100，排在显式 order 之后', () => {
    userMenu.register({ title: 'default', onClick: () => {} })
    userMenu.register({ title: 'early', order: 50, onClick: () => {} })
    expect(userMenu.getItems().map((item) => item.title)).toEqual(['early', 'default'])
  })

  test('同 key 重复注册视为覆盖且保留原 id（幂等）', () => {
    const id1 = userMenu.register({ key: 'todo', title: '待办', order: 10, onClick: () => {} })
    const id2 = userMenu.register({ key: 'todo', title: '待办改', order: 30, onClick: () => {} })
    expect(id2).toBe(id1)
    expect(userMenu.getItems()).toHaveLength(1)
    expect(userMenu.getItems()[0].title).toBe('待办改')
    expect(userMenu.getItems()[0].order).toBe(30)
  })

  test('同 id 重复注册视为覆盖', () => {
    const id = userMenu.register({ id: 'fixed-id', title: 'A', onClick: () => {} })
    userMenu.register({ id: 'fixed-id', title: 'B', onClick: () => {} })
    expect(id).toBe('fixed-id')
    expect(userMenu.getItems().map((item) => item.title)).toEqual(['B'])
  })

  test('unregisterAll 按 owner 批量移除', () => {
    userMenu.register({ title: '微应用A', onClick: () => {} }, 'app-a')
    userMenu.register({ title: '微应用B', onClick: () => {} }, 'app-b')
    userMenu.register({ title: '平台项', onClick: () => {} })
    userMenu.unregisterAll('app-a')
    expect(userMenu.getItems().map((item) => item.title)).toEqual(['微应用B', '平台项'])
  })

  test('非法注册被拒绝（缺 title / onClick 非函数）', () => {
    expect(userMenu.register({ title: 'no-handler' })).toBe('')
    expect(userMenu.register({ onClick: () => {} })).toBe('')
    expect(userMenu.getItems()).toHaveLength(0)
  })
})

describe('登出清理', () => {
  beforeEach(() => {
    resetMenuExtensionRuntime()
    mockDispatch.mockClear()
  })

  test('user/LOGOUT mutation 清空徽标与非内置用户菜单项', () => {
    installMenuExtensionStoreLifecycle()
    menu.setMenuBadge('dashboard', { type: 'dot' })
    userMenu.register({ title: '业务项', onClick: () => {} }, 'app-a')
    triggerMutation('user/LOGOUT')
    expect(menu.getMenuBadge('dashboard')).toBeUndefined()
    expect(userMenu.getItems()).toHaveLength(0)
  })
})
