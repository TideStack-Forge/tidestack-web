import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'

const { mockOpenDialog, mockDispatch, mockI18nService, resetMocks } = vi.hoisted(() => {
  const mockOpenDialog = vi.fn(() => Promise.resolve(false))
  const mockDispatch = vi.fn(() => Promise.resolve())
  const mockI18nService = {
    getManager: vi.fn(() => ({
      tCommon: vi.fn((_key, defaultText) => defaultText),
    })),
  }

  return {
    mockOpenDialog,
    mockDispatch,
    mockI18nService,
    resetMocks() {
      mockOpenDialog.mockClear()
      mockDispatch.mockClear()
      mockI18nService.getManager.mockClear()
    },
  }
})

vi.mock('@/common/modal', () => ({
  openDialog: mockOpenDialog,
}))

vi.mock('@/common/i18n', () => ({
  i18nService: mockI18nService,
}))

vi.mock('../../../../src/store/storeFacade', () => ({
  dispatch: mockDispatch,
  subscribeState: () => () => {},
  readGetters: () => ({ 'user/menu': { globalMenu: [], globalSubNav: [] } }),
}))

vi.mock('../../../../src/layouts/Icon', () => ({
  Icon: function IconMock(props) {
    return React.createElement('span', {
      'aria-hidden': 'true',
      className: props.className,
    })
  },
}))

const { UserMenu } = await import('../../../../src/layouts/UserMenu.tsx')

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

test('change password menu opens the metadata-backed AMIS dialog route', async () => {
  act(() => {
    root.render(
      React.createElement(UserMenu, {
        userInfo: { username: 'mock-admin' },
        theme: 'light',
        themeList: ['light', 'dark'],
      })
    )
  })

  act(() => {
    container
      .querySelector('[aria-label="打开用户菜单"]')
      .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })

  await act(async () => {
    container
      .querySelector('[aria-label="修改密码"]')
      .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
  })

  expect(mockOpenDialog).toHaveBeenCalledTimes(1)
  const schema = mockOpenDialog.mock.calls[0][0]

  expect(schema).toEqual({
    width: '500px',
    url: '/system-setting/user-management/change-password',
  })
})
