import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'

const { exchangeLoginCode, dispatch } = vi.hoisted(() => ({
  exchangeLoginCode: vi.fn(),
  dispatch: vi.fn(),
}))

vi.mock('@/common/i18n', () => ({
  i18nService: {
    getManager: () => ({
      getLocale: () => 'zh-CN',
      onLocaleChange: () => () => {},
      tn: (_namespace, _key, fallback) => fallback,
    }),
  },
}))

vi.mock('@/common/api/auth', () => ({
  default: { exchangeLoginCode },
}))
vi.mock('@/store/storeFacade', () => ({
  store: { dispatch },
}))
vi.mock('../../../../../src/features/auth/components/LanguageSelector.tsx', () => ({
  LanguageSelector: () => null,
}))

const { LoginCallbackPageView } =
  await import('../../../../../src/features/auth/pages/LoginCallbackPage.tsx')

let dom
let root
let container

beforeEach(() => {
  exchangeLoginCode.mockReset()
  dispatch.mockReset()

  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/login/callback?code=login-code',
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

test('routes to recovery without redeeming the external code again after initialization fails', async () => {
  exchangeLoginCode.mockResolvedValue({
    code: 0,
    data: { accessToken: 'invalid-token' },
  })
  dispatch.mockResolvedValue({
    success: false,
    msg: '用户信息初始化失败',
    data: null,
    code: 50001,
  })
  const navigate = vi.fn()

  await act(async () => {
    root.render(
      React.createElement(LoginCallbackPageView, {
        navigate,
        route: {
          path: '/login/callback',
          fullPath: '/login/callback?code=login-code',
          query: { code: 'login-code', redirect: '/dashboard' },
        },
      })
    )
  })

  expect(exchangeLoginCode).toHaveBeenCalledTimes(1)
  expect(navigate).toHaveBeenCalledWith({
    path: '/errorAfterLogin',
    query: { fullscreen: 'true', redirect: '/dashboard' },
  })
})
