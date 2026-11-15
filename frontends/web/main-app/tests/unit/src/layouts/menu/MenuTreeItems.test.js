import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'

vi.mock('@/common/menus', () => ({ openMenuItem: vi.fn() }))
vi.mock('@/layouts/Icon', () => ({ Icon: () => null }))
vi.mock('@/layouts/menu/MenuBadge', () => ({ MenuBadge: () => null }))

const { openMenuItem } = await import('@/common/menus')
const { MenuTreeItems } = await import('@/layouts/menu/MenuTreeItems.tsx')
const { MenuFloatSubmenu } = await import('@/layouts/menu/MenuFloatSubmenu.tsx')
const { MenuFloatMenu } = await import('@/layouts/menu/MenuFloatMenu.tsx')

let dom
let root
let container

function frontendPages() {
  return {
    key: 'UIDesign.UIManagement',
    title: '前端页面',
    url: '/dev/demo/ui',
    children: [
      { key: 'UIDesign.UIManagement.UIModel', title: 'UI 模型', url: '/dev/demo/ui-model' },
      { key: 'UIDesign.UIManagement.UISchema', title: 'UI Schema', url: '/dev/demo/ui-schema' },
    ],
  }
}

async function renderTree(page, props = {}) {
  await act(async () => {
    root.render(React.createElement(MenuTreeItems, {
      menuArr: [{ key: 'UIDesign', title: '界面设计', opened: true, children: [page] }],
      ...props,
    }))
  })
}

function button(label) {
  const result = [...container.querySelectorAll('button')].find(
    (element) => (element.getAttribute('aria-label') || element.textContent) === label
  )
  expect(result, `button: ${label}`).toBeDefined()
  return result
}

async function click(element) {
  await act(async () => element.click())
}

beforeEach(() => {
  vi.clearAllMocks()
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })
  container = dom.window.document.getElementById('root')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  delete globalThis.window
  delete globalThis.document
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
  dom.window.close()
})

test('有页面地址的父菜单标题可以打开自己的页面', async () => {
  const page = frontendPages()
  const onMenuItemClick = vi.fn()
  await renderTree(page, { onMenuItemClick })

  await click(button('前端页面'))

  expect(openMenuItem).toHaveBeenCalledExactlyOnceWith(page)
  expect(onMenuItemClick).toHaveBeenCalledTimes(1)
})

test('父菜单箭头独立展开和收起，子菜单仍可打开', async () => {
  const page = frontendPages()
  const onMenuItemClick = vi.fn()
  await renderTree(page, { onMenuItemClick })
  const submenu = button('前端页面').closest('li').querySelector('.tree-menu__submenu-wrapper')
  expect(submenu.getAttribute('aria-hidden')).toBe('true')

  await click(button('展开前端页面'))
  expect(button('收起前端页面').getAttribute('aria-expanded')).toBe('true')
  expect(submenu.getAttribute('aria-hidden')).toBe('false')
  expect(openMenuItem).not.toHaveBeenCalled()
  expect(onMenuItemClick).not.toHaveBeenCalled()

  await click(button('UI 模型'))
  expect(openMenuItem).toHaveBeenCalledExactlyOnceWith(page.children[0])
  expect(onMenuItemClick).toHaveBeenCalledTimes(1)

  await click(button('收起前端页面'))
  expect(button('展开前端页面').getAttribute('aria-expanded')).toBe('false')
  expect(submenu.getAttribute('aria-hidden')).toBe('true')
  expect(openMenuItem).toHaveBeenCalledTimes(1)
})

test('没有页面地址的分组标题保持展开和收起行为', async () => {
  await renderTree(frontendPages())
  const group = button('界面设计')

  await click(group)
  expect(group.getAttribute('aria-expanded')).toBe('false')
  await click(group)
  expect(group.getAttribute('aria-expanded')).toBe('true')
  expect(openMenuItem).not.toHaveBeenCalled()
})

test('父菜单自己的页面激活时高亮并展开，切换到子菜单后高亮子菜单', async () => {
  const page = frontendPages()
  const trail = [{ key: 'UIDesign' }, { key: page.key }]
  await renderTree(page, { breadcrumb: trail, activeTabId: 'page' })
  expect(button('前端页面').closest('li').classList.contains('is-active')).toBe(true)
  expect(button('收起前端页面').getAttribute('aria-expanded')).toBe('true')

  await click(button('收起前端页面'))
  await renderTree(page, { breadcrumb: [...trail, { key: page.children[0].key }], activeTabId: 'model' })
  expect(button('前端页面').closest('li').classList.contains('is-active')).toBe(false)
  expect(button('前端页面').closest('li').classList.contains('is-ancestor')).toBe(true)
  expect(button('UI 模型').closest('li').classList.contains('is-active')).toBe(true)
  expect(button('收起前端页面').getAttribute('aria-expanded')).toBe('true')
})

test.each(['path', 'fullPath'])('父菜单也通过 %s 地址打开页面', async (addressKey) => {
  const page = frontendPages()
  page[addressKey] = page.url
  delete page.url
  await renderTree(page)

  await click(button('前端页面'))

  expect(openMenuItem).toHaveBeenCalledExactlyOnceWith(page)
})

test('标签身份先变化、路由稍后变化时仍展开最终页面所属分组', async () => {
  const page = frontendPages()
  const audit = { key: 'settings.audit', title: '审计管理', children: [{ key: 'settings.log', title: '业务日志', url: '/logs' }] }
  const menus = [page, audit]
  async function renderNavigation(activeTabId, group) {
    await act(async () => root.render(React.createElement(MenuTreeItems, {
      menuArr: menus, activeTabId, breadcrumb: [{ key: group.key }, { key: group.children[0].key }],
    })))
  }
  await renderNavigation('page', page)
  await renderNavigation('audit', audit)
  await click(button('收起前端页面'))
  expect(button('展开前端页面').getAttribute('aria-expanded')).toBe('false')

  await renderNavigation('page', audit)
  await renderNavigation('page', page)

  expect(button('收起前端页面').getAttribute('aria-expanded')).toBe('true')
  expect(button('UI 模型').closest('li').classList.contains('is-active')).toBe(true)
})

test('悬浮菜单能展开子菜单，也能点击父菜单和子菜单打开页面', async () => {
  const page = frontendPages()
  const onMenuItemClick = vi.fn()
  await act(async () => root.render(React.createElement(MenuFloatSubmenu, {
    data: page,
    activeMenuFn: () => false,
    onMenuItemClick,
  })))
  expect(container.textContent).not.toContain('UI 模型')

  await act(async () => container.firstChild.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true })))
  expect([...container.querySelectorAll('.app-float-menu__item-text')].map((item) => item.textContent))
    .toEqual(['UI 模型', 'UI Schema'])

  await click(container.querySelector('.app-float-menu__submenu-title'))
  expect(openMenuItem).toHaveBeenLastCalledWith(page)
  await click(container.querySelector('.app-float-menu__item'))
  expect(openMenuItem).toHaveBeenLastCalledWith(page.children[0])
  expect(onMenuItemClick).toHaveBeenCalledTimes(2)
})

test('悬浮分组点击标题只展开，选择页面后才导航并关闭浮层', async () => {
  const page = frontendPages()
  const group = { key: 'settings.portal', title: '门户与界面', children: [page] }
  const onMenuItemClick = vi.fn()
  await act(async () => root.render(React.createElement(MenuFloatSubmenu, {
    data: group, activeMenuFn: () => false, onMenuItemClick,
  })))

  await click(container.querySelector('.app-float-menu__submenu-title'))
  expect(container.textContent).toContain('前端页面')
  expect(openMenuItem).not.toHaveBeenCalled()
  expect(onMenuItemClick).not.toHaveBeenCalled()

  await click(container.querySelectorAll('.app-float-menu__submenu-title')[1])
  expect(openMenuItem).toHaveBeenCalledExactlyOnceWith(page)
  expect(onMenuItemClick).toHaveBeenCalledTimes(1)
})

test.each([false, true])('悬浮面板根标题仅在有页面地址时导航（hasUrl=%s）', async (hasUrl) => {
  const page = frontendPages()
  const menu = { key: 'settings', title: '系统设置', children: [page], ...(hasUrl ? { url: '/settings' } : {}) }
  const onMenuItemClick = vi.fn()
  await act(async () => root.render(React.createElement(MenuFloatMenu, {
    floatMenuData: menu, position: { top: 0, left: 0 },
    onMouseEnterFloatMenu: vi.fn(), onMouseLeaveFloatMenu: vi.fn(), onMenuItemClick,
  })))

  await click(container.querySelector('.app-float-menu__header'))
  if (hasUrl) {
    expect(openMenuItem).toHaveBeenCalledExactlyOnceWith(menu)
    expect(onMenuItemClick).toHaveBeenCalledTimes(1)
  } else {
    expect(openMenuItem).not.toHaveBeenCalled()
    expect(onMenuItemClick).not.toHaveBeenCalled()
    expect(container.textContent).toContain('前端页面')
  }
})

test.each([
  { top: 80, expectedTop: 80 },
  { top: 700, expectedTop: 663 },
])('悬浮子菜单首次展开在父菜单旁定位并避开底部溢出（top=$top）', async ({ top, expectedTop }) => {
  vi.spyOn(dom.window.HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top, left: 200, right: 400, bottom: top + 42, width: 200, height: 42,
  })
  Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 200 })
  Object.defineProperty(dom.window.HTMLElement.prototype, 'clientHeight', { configurable: true, value: 100 })
  await act(async () => root.render(React.createElement(MenuFloatSubmenu, {
    data: frontendPages(),
    activeMenuFn: () => false,
    onMenuItemClick: vi.fn(),
  })))

  await act(async () => container.firstChild.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true })))

  const submenu = container.querySelector('.app-float-menu__submenu-content')
  expect(submenu.style.left).toBe('400px')
  expect(submenu.style.top).toBe(`${expectedTop}px`)
})
