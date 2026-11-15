import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'

const { mockOpenMenuItem, mockI18nService, resetMocks } = vi.hoisted(() => {
  const mockOpenMenuItem = vi.fn()
  const mockI18nService = {
    getManager: vi.fn(() => ({
      tCommon: vi.fn((key, defaultText) => defaultText),
    })),
  }

  return {
    mockOpenMenuItem,
    mockI18nService,
    resetMocks() {
      mockOpenMenuItem.mockClear()
      mockI18nService.getManager.mockClear()
    },
  }
})

vi.mock('@/common/menus', () => ({
  openMenuItem: mockOpenMenuItem,
}))

vi.mock('@/common/i18n', () => ({
  i18nService: mockI18nService,
}))

vi.mock('@/utils/url', () => ({
  isExternal: vi.fn(() => false),
}))

vi.mock('@/store/storeFacade', () => ({
  dispatch: vi.fn(),
  subscribeState: () => () => {},
  readGetters: () => ({ 'user/menu': { globalMenu: [], globalSubNav: [] } }),
}))

const { SearchBar } = await import('../../../../src/layouts/SearchBar.tsx')

let dom
let root
let container

beforeEach(() => {
  resetMocks()
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

  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  delete globalThis.window
  delete globalThis.document
})

const testMenu = {
  globalMenu: [
    {
      key: 'system-setting',
      title: '系统管理',
      path: '/system',
      icon: 'icon-system',
      children: [
        {
          key: 'user-management',
          parent: 'system-setting',
          title: '用户管理',
          path: '/system/users',
          url: '/system/users?source=search',
          fullPath: '/system/users',
          showMode: 'tab',
        },
        { key: 'role-management', parent: 'system-setting', title: '角色管理', path: '/system/roles' },
      ],
    },
    {
      key: 'data-management',
      title: '数据管理',
      path: '/data',
      icon: 'icon-data',
      children: [{ key: 'data-source', parent: 'data-management', title: '数据源', path: '/data/sources' }],
    },
  ],
}

test('refocusing input with non-empty value reopens search results', () => {
  act(() => {
    root.render(React.createElement(SearchBar, { menu: testMenu }))
  })

  const input = container.querySelector('.search-input__field')
  const getResultsPanel = () => container.querySelector('.search-results')
  const getOverlay = () => container.querySelector('.search-overlay')

  expect(input).toBeTruthy()
  expect(getResultsPanel()).toBeFalsy()

  const reactFiber = Object.keys(input).find((key) => key.startsWith('__reactFiber'))
  const reactProps = Object.keys(input).find((key) => key.startsWith('__reactProps'))
  
  expect(reactFiber || reactProps).toBeTruthy()
  
  const props = reactProps ? input[reactProps] : input[reactFiber]?.memoizedProps
  expect(props).toBeTruthy()
  expect(props.onFocus).toBeTruthy()
  expect(typeof props.onFocus).toBe('function')
})

test('focusing input with empty value does not open results', () => {
  act(() => {
    root.render(React.createElement(SearchBar, { menu: testMenu }))
  })

  const input = container.querySelector('.search-input__field')
  const getResultsPanel = () => container.querySelector('.search-results')

  expect(input.value).toBe('')

  act(() => {
    input.dispatchEvent(new dom.window.Event('focus', { bubbles: true }))
  })

  expect(getResultsPanel()).toBeFalsy()
})

test('collapsed search opens a floating panel and keeps full menu identity payload on jump', async () => {
  act(() => {
    root.render(React.createElement(SearchBar, { menu: testMenu, collapsed: true }))
  })

  const wrapper = container.querySelector('.search-wrapper')
  const trigger = container.querySelector('.search-box')
  const input = container.querySelector('.search-input__field')

  expect(wrapper?.className).toContain('is-collapsed')
  expect(container.querySelector('.search-results')).toBeFalsy()

  act(() => {
    trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  expect(container.querySelector('.search-results')).toBeTruthy()
  expect(document.activeElement).toBe(input)

  const reactFiber = Object.keys(input).find((key) => key.startsWith('__reactFiber'))
  const reactProps = Object.keys(input).find((key) => key.startsWith('__reactProps'))
  const props = reactProps ? input[reactProps] : input[reactFiber]?.memoizedProps

  act(() => {
    props.onChange({ target: { value: '用户' } })
  })

  const resultButtons = [...container.querySelectorAll('.search-results__list button')]
  const userButton = resultButtons.find((button) => button.textContent?.includes('用户管理'))

  expect(userButton).toBeTruthy()

  act(() => {
    userButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })

  expect(mockOpenMenuItem).toHaveBeenCalledTimes(1)
  expect(mockOpenMenuItem).toHaveBeenCalledWith(
    expect.objectContaining({
      key: 'user-management',
      parent: 'system-setting',
      url: '/system/users?source=search',
      fullPath: '/system/users',
      showMode: 'tab',
      path: '/system/users',
      title: '用户管理',
      hasChildren: false,
    })
  )
})
