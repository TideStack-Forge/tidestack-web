import { describe, test, expect, vi, beforeEach } from 'vitest'
import * as SDK from '../../../src/main'

// 与 micro-app-injection 测试一致：SDK 生命周期会访问 window
global.window = global.window || ({} as any)

describe('菜单扩展能力（menu / userMenu）', () => {
  let realMenu: any
  let realUserMenu: any
  let mountProps: any

  beforeEach(() => {
    realMenu = {
      setMenuBadge: vi.fn(),
      getMenuBadge: vi.fn(() => undefined),
      getMenu: vi.fn(() => undefined),
      getMenus: vi.fn(() => []),
      traverseMenus: vi.fn(),
      addMenuItem: vi.fn(() => true),
      removeMenuItem: vi.fn(() => true),
    }
    realUserMenu = {
      register: vi.fn(() => 'real-user-menu-id'),
      unregister: vi.fn(),
      getItems: vi.fn(() => []),
      unregisterAll: vi.fn(),
    }
    mountProps = {
      appInfo: { name: 'demo-app' },
      __utils__: {
        menu: realMenu,
        userMenu: realUserMenu,
      },
    }
  })

  function mountWith(extraProps: Record<string, any> = {}) {
    const lifecycle = SDK.initMicroApp({
      render: async () => ({ app: 'mock-app' }),
    })
    return { lifecycle, mount: () => lifecycle.mount({ ...mountProps, ...extraProps }) }
  }

  test('导出 menu / userMenu API 契约完整', () => {
    expect(typeof SDK.menu.setMenuBadge).toBe('function')
    expect(typeof SDK.menu.getMenuBadge).toBe('function')
    expect(typeof SDK.menu.getMenu).toBe('function')
    expect(typeof SDK.menu.getMenus).toBe('function')
    expect(typeof SDK.menu.traverseMenus).toBe('function')
    expect(typeof SDK.menu.addMenuItem).toBe('function')
    expect(typeof SDK.menu.removeMenuItem).toBe('function')

    expect(typeof SDK.userMenu.register).toBe('function')
    expect(typeof SDK.userMenu.unregister).toBe('function')
    expect(typeof SDK.userMenu.getItems).toBe('function')
    expect(typeof SDK.userMenu.unregisterAll).toBe('function')
  })

  test('平台注入前：命令式调用进入 pending，查询类返回空结果', async () => {
    SDK.menu.setMenuBadge('dev.apps', { type: 'dot' })
    SDK.menu.addMenuItem({ scope: 'main', item: { fullName: 'x', title: 'X' } })
    SDK.menu.removeMenuItem('y')
    const pendingId = SDK.userMenu.register({ title: '待办', onClick: () => {} })
    SDK.userMenu.unregister(pendingId)

    expect(SDK.menu.getMenuBadge('dev.apps')).toBeUndefined()
    expect(SDK.menu.getMenu('dev.apps')).toBeUndefined()
    expect(SDK.menu.getMenus()).toEqual([])
    expect(SDK.userMenu.getItems()).toEqual([])
    expect(pendingId).toMatch(/^__pending-user-menu-\d+$/)
  })

  test('注入后 pending 队列按调用顺序 flush，owner 取自 appInfo.name', async () => {
    SDK.menu.setMenuBadge('dev.apps', { type: 'number', value: 1 })
    SDK.menu.addMenuItem({ scope: 'main', item: { fullName: 'runtime', title: '运行时' } })
    SDK.userMenu.register({ title: '挂载前注册', onClick: () => {} })

    const { mount } = mountWith()
    await mount()

    expect(realMenu.setMenuBadge).toHaveBeenCalledWith('dev.apps', { type: 'number', value: 1 })
    expect(realMenu.addMenuItem).toHaveBeenCalledWith({
      scope: 'main',
      item: { fullName: 'runtime', title: '运行时' },
    })
    expect(realUserMenu.register).toHaveBeenCalledWith(
      expect.objectContaining({ title: '挂载前注册' }),
      'demo-app'
    )
    // flush 顺序保真：setMenuBadge 先于 addMenuItem 先于 register
    const setOrder = (realMenu.setMenuBadge as any).mock.invocationCallOrder[0]
    const addOrder = (realMenu.addMenuItem as any).mock.invocationCallOrder[0]
    const regOrder = (realUserMenu.register as any).mock.invocationCallOrder[0]
    expect(setOrder).toBeLessThan(addOrder)
    expect(addOrder).toBeLessThan(regOrder)
  })

  test('注入后调用直达平台实现，查询返回平台结果', async () => {
    realMenu.getMenuBadge.mockReturnValue({ type: 'dot' })
    realMenu.getMenus.mockReturnValue([{ fullName: 'a', badge: { type: 'dot' } }])
    realUserMenu.getItems.mockReturnValue([{ id: '1', title: 'T' }])

    const { mount } = mountWith()
    await mount()

    SDK.menu.setMenuBadge('dev.apps', { type: 'dot' })
    expect(realMenu.setMenuBadge).toHaveBeenCalledWith('dev.apps', { type: 'dot' })
    expect(SDK.menu.getMenuBadge('dev.apps')).toEqual({ type: 'dot' })
    expect(SDK.menu.getMenus({ scope: 'all', flat: true })).toEqual([
      { fullName: 'a', badge: { type: 'dot' } },
    ])
    SDK.menu.traverseMenus(() => {})
    expect(realMenu.traverseMenus).toHaveBeenCalled()
    SDK.userMenu.unregisterAll('demo-app')
    expect(realUserMenu.unregisterAll).toHaveBeenCalledWith('demo-app')
  })

  test('unmount 清理 SDK 注册的用户菜单项，且不清除徽标', async () => {
    const { lifecycle, mount } = mountWith()
    await mount()

    const id = SDK.userMenu.register({ title: '业务项', onClick: () => {} })
    expect(id).toBe('real-user-menu-id')
    SDK.menu.setMenuBadge('dev.apps', { type: 'number', value: 5 })

    await lifecycle.unmount({})

    expect(realUserMenu.unregister).toHaveBeenCalledWith('real-user-menu-id')
    // badge 保留（D3）：unmount 不触发任何 setMenuBadge 清除
    expect(realMenu.setMenuBadge).not.toHaveBeenCalledWith('dev.apps', null)
    // 幂等：二次 unmount 不重复清理
    realUserMenu.unregister.mockClear()
    await lifecycle.unmount({})
    expect(realUserMenu.unregister).not.toHaveBeenCalled()
  })

  test('多 init 实例只清理各自注册的用户菜单项', async () => {
    const registeredIds = new Set<string>()
    realUserMenu.register.mockImplementation((item: any, owner: string) => {
      const id = `${owner}:${item.title}`
      registeredIds.add(id)
      return id
    })
    realUserMenu.unregister.mockImplementation((id: string) => {
      registeredIds.delete(id)
    })

    const microLifecycle = SDK.initMicroApp({ render: async () => ({}) })
    await microLifecycle.mount({ ...mountProps, appInfo: { name: 'micro-app' } })
    const microId = SDK.userMenu.register({ title: 'A', onClick: () => {} })

    const layoutLifecycle = SDK.initLayoutComponent({ render: async () => ({}) })
    await layoutLifecycle.mount({ ...mountProps, appInfo: { name: 'layout-app' } })
    const layoutId = SDK.userMenu.register({ title: 'B', onClick: () => {} })

    await layoutLifecycle.unmount({})
    expect(registeredIds.has(microId)).toBe(true)
    expect(registeredIds.has(layoutId)).toBe(false)

    await microLifecycle.unmount({})
    expect(registeredIds.has(microId)).toBe(false)
  })

  test('initLayoutComponent 与 initAmisComponentLib 的 unmount 同样清理注册项', async () => {
    const layoutLifecycle = SDK.initLayoutComponent({ render: async () => ({}) })
    await layoutLifecycle.mount(mountProps)
    SDK.userMenu.register({ title: '布局项', onClick: () => {} })
    await layoutLifecycle.unmount({})
    expect(realUserMenu.unregister).toHaveBeenCalledWith('real-user-menu-id')

    realUserMenu.unregister.mockClear()
    const libLifecycle = SDK.initAmisComponentLib({})
    await libLifecycle.mount(mountProps)
    SDK.userMenu.register({ title: '组件库项', onClick: () => {} })
    await libLifecycle.unmount({})
    expect(realUserMenu.unregister).toHaveBeenCalledWith('real-user-menu-id')
  })
})
