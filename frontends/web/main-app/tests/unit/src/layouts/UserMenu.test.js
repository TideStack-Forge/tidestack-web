import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'

const { mockDispatch, i18nManager, mockOpenDialog, pushLocation } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  i18nManager: { getManager: vi.fn() },
  mockOpenDialog: vi.fn(),
  pushLocation: vi.fn(),
}))

vi.mock('@/router/routerFacade', () => ({ pushLocation }))
vi.mock('@/common/i18n', () => ({
  i18nService: { getManager: () => i18nManager.getManager() },
}))
vi.mock('@/store/storeFacade', () => ({
  dispatch: mockDispatch,
  readGetters: () => ({ 'user/menu': { globalMenu: [], globalSubNav: [] } }),
  subscribeState: vi.fn(() => () => {}),
}))
vi.mock('@/common/modal', () => ({ openDialog: mockOpenDialog }))

const { userMenu, resetMenuExtensionRuntime } = await import('@/common/menus/registry')

const { UserMenu } = await import('@/layouts/UserMenu.tsx')

let dom
let root
let container

function openDropdown() {
  const trigger = container.querySelector('button[aria-label="打开用户菜单"]')
  act(() => {
    trigger.click()
  })
}

function itemTitles() {
  return Array.from(container.querySelectorAll('.app-user-menu__item p')).map(
    (el) => el.textContent
  )
}

beforeEach(async () => {
  resetMenuExtensionRuntime()
  mockDispatch.mockReset()
  mockOpenDialog.mockReset()
  pushLocation.mockReset()
  i18nManager.getManager.mockReset()
  i18nManager.getManager.mockReturnValue({
    tCommon: vi.fn((_key, defaultText) => defaultText || _key),
  })

  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })
  container = dom.window.document.getElementById('root')

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: dom.window,
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: dom.window.document,
  })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    writable: true,
    value: true,
  })

  root = createRoot(container)
  await act(async () => {
    root.render(
      React.createElement(UserMenu, {
        userInfo: { displayName: '测试用户' },
        theme: 'light',
        themeList: ['light', 'dark'],
        isLockTheme: false,
        lockTheme: '',
      })
    )
    await Promise.resolve()
  })
})

afterEach(async () => {
  if (root) {
    await act(async () => {
      root.unmount()
    })
  }
  delete globalThis.window
  delete globalThis.document
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
  dom?.window.close()
})

test('下拉渲染内置注册项：个人资料 / 修改密码 / 切换主题 / 退出', () => {
  openDropdown()
  expect(itemTitles()).toEqual(['个人资料', '修改密码', '切换主题', '退出'])
})

test('isLockTheme 时切换主题项不可见', async () => {
  await act(async () => {
    root.unmount()
  })
  root = createRoot(container)
  await act(async () => {
    root.render(
      React.createElement(UserMenu, {
        userInfo: { displayName: '测试用户' },
        theme: 'light',
        themeList: ['light', 'dark'],
        isLockTheme: true,
        lockTheme: 'dark',
      })
    )
    await Promise.resolve()
  })
  openDropdown()
  expect(itemTitles()).toEqual(['个人资料', '修改密码', '退出'])
})

test('注册的业务项按 order 渲染，点击执行回调并注入 ctx', () => {
  const onClick = vi.fn()
  act(() => {
  userMenu.register({
    key: 'test.todo',
    title: '我的待办',
    order: 50,
    onClick,
  })
})
  openDropdown()
  expect(itemTitles()).toEqual(['个人资料', '修改密码', '切换主题', '我的待办', '退出'])

  const todoButton = Array.from(container.querySelectorAll('.app-user-menu__item button')).find(
    (btn) => btn.getAttribute('aria-label') === '我的待办'
  )
  act(() => {
    todoButton.click()
  })
  expect(onClick).toHaveBeenCalledTimes(1)
  const ctx = onClick.mock.calls[0][0]
  expect(ctx.userInfo.displayName).toBe('测试用户')
  expect(ctx.theme).toBe('light')
  expect(ctx.themeList).toEqual(['light', 'dark'])
  expect(typeof ctx.dispatch).toBe('function')
  expect(typeof ctx.openDialog).toBe('function')
  // 默认 closeOnClick：点击后下拉收起
  expect(container.querySelector('.app-user-menu__dropdown')).toBeNull()
})

test('closeOnClick 为 false 时点击不收起下拉', () => {
  act(() => {
  userMenu.register({
    key: 'test.keep-open',
    title: '不收起',
    closeOnClick: false,
    onClick: vi.fn(),
  })
})
  openDropdown()
  const button = Array.from(container.querySelectorAll('.app-user-menu__item button')).find(
    (btn) => btn.getAttribute('aria-label') === '不收起'
  )
  act(() => {
    button.click()
  })
  expect(container.querySelector('.app-user-menu__dropdown')).not.toBeNull()
})

test('disabled 项按钮禁用', () => {
  act(() => {
  userMenu.register({
    key: 'test.disabled',
    title: '禁用项',
    disabled: () => true,
    onClick: vi.fn(),
  })
})
  openDropdown()
  const button = Array.from(container.querySelectorAll('.app-user-menu__item button')).find(
    (btn) => btn.getAttribute('aria-label') === '禁用项'
  )
  expect(button.disabled).toBe(true)
  expect(container.querySelector('.app-user-menu__item.is-disabled')).not.toBeNull()
})

test('用户菜单项徽标渲染（数字）', () => {
  act(() => {
  userMenu.register({
    key: 'test.badge',
    title: '带徽标',
    badge: { type: 'number', value: 7 },
    onClick: vi.fn(),
  })
})
  openDropdown()
  const badge = container.querySelector('.app-user-menu__item .menu-badge--number')
  expect(badge).not.toBeNull()
  expect(badge.textContent).toBe('7')
})

test('titleKey 走 i18n 翻译', () => {
  act(() => {
  userMenu.register({
    key: 'test.i18n',
    title: '默认标题',
    titleKey: 'menu.custom',
    onClick: vi.fn(),
  })
})
  const tCommon = i18nManager.getManager().tCommon
  tCommon.mockImplementation((key, defaultText) => (key === 'menu.custom' ? '翻译标题' : defaultText))
  openDropdown()
  expect(itemTitles()).toContain('翻译标题')
})

test('divider 分组线渲染', () => {
  act(() => {
  userMenu.register({
    key: 'test.divider',
    title: '分组前',
    divider: true,
    onClick: vi.fn(),
  })
})
  openDropdown()
  expect(container.querySelector('.app-user-menu__divider')).not.toBeNull()
})

test('退出内置项触发 user/logout dispatch', () => {
  openDropdown()
  const logoutButton = Array.from(container.querySelectorAll('.app-user-menu__item button')).find(
    (btn) => btn.getAttribute('aria-label') === '退出'
  )
  act(() => {
    logoutButton.click()
  })
  expect(mockDispatch).toHaveBeenCalledWith('user/logout')
})

test('显示服务端计算的名称并随资料刷新更新', async () => {
  await act(async () => root.render(React.createElement(UserMenu, {
    userInfo: { nickname: '小张', formalName: '张三', displayName: '小张' },
  })))
  expect(container.querySelector('.app-user-menu__name').textContent).toBe('小张')
  await act(async () => root.render(React.createElement(UserMenu, {
    userInfo: { nickname: null, formalName: '张三', displayName: '张三' },
  })))
  expect(container.querySelector('.app-user-menu__name').textContent).toBe('张三')
})

test('个人资料通过原路由入口打开', () => {
  openDropdown()
  act(() => container.querySelector('button[aria-label="个人资料"]').click())
  expect(pushLocation).toHaveBeenCalledWith('/personal-settings/profile')
})
