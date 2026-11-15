import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'

const { listProviders, loadMicroApp, i18nManager, useHostSnapshot, store } = vi.hoisted(
  () => ({
    listProviders: vi.fn(),
    loadMicroApp: vi.fn(),
    i18nManager: {
      getManager: vi.fn(),
    },
    useHostSnapshot: vi.fn(),
    store: {
      getters: { appName: 'Ouroboros', 'app/config': {} },
      state: {
        app: {
          appInfo: { loginEntry: 'https://login.example.test' },
          logo: 'fa fa-logo',
          slogan: '',
          loginEntry: 'https://login.example.test',
        },
      },
    },
  })
)

vi.mock('@/common/api/auth', () => ({ default: { listProviders } }))
vi.mock('qiankun', () => ({ loadMicroApp }))
vi.mock('@/common/micro/commonProps', () => ({ getCommonProps: vi.fn() }))
vi.mock('@/common/auth/flow', () => ({
  buildCredentialModes: vi.fn(() => []),
  buildProviderEntry: vi.fn(),
  buildReturnUrl: vi.fn(() => '/'),
  getPreloadedAuthProviders: vi.fn(() => []),
  isRedirectProvider: vi.fn(() => false),
  mapAuthError: vi.fn((code) =>
    code === 'user-bootstrap-failed' ? '用户信息初始化失败，请重新登录' : ''
  ),
  resolveActiveCredentialMode: vi.fn(() => null),
  shouldIgnoreProviderDiscoveryError: vi.fn(() => false),
  shouldIgnoreProviderDiscoveryResult: vi.fn(() => false),
  shouldShowCredentialModeSwitcher: vi.fn(() => false),
}))
vi.mock('@/common/i18n', () => ({
  i18nService: {
    getManager: () => i18nManager.getManager(),
  },
}))
vi.mock('@/common/menus', () => ({
  openMenuAfterLogin: vi.fn(),
  openMenuItem: vi.fn(),
}))
vi.mock('@/common/menus/post-login-navigation', () => ({
  performPostLoginNavigation: vi.fn(),
}))
vi.mock('@/common/tabs', () => ({ default: { openOrSwitchTab: vi.fn() } }))
vi.mock('@/router/utils', () => ({ getRouteInfo: vi.fn() }))
vi.mock('@/layouts/useHostSnapshot', () => ({ useHostSnapshot }))
vi.mock('@/store/storeFacade', () => ({ store }))
vi.mock('../../../../../src/features/auth/components/LanguageSelector.tsx', () => ({
  LanguageSelector: () => null,
}))

const { LoginPageView } =
  await import('../../../../../src/features/auth/pages/LoginPage.tsx')

let dom
let root
let container

beforeEach(() => {
  listProviders.mockReset()
  loadMicroApp.mockReset()
  i18nManager.getManager.mockReset()
  useHostSnapshot.mockReset()
  listProviders.mockResolvedValue({ code: 0, data: [] })
  loadMicroApp.mockReturnValue({ mountPromise: Promise.resolve(), unmount: vi.fn() })
  i18nManager.getManager.mockReturnValue({
    getLocale: () => 'zh-CN',
    tn: vi.fn((_namespace, _key, defaultText) => defaultText),
    onLocaleChange: vi.fn(() => vi.fn()),
  })

  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/login?error=user-bootstrap-failed',
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

test('keeps the bootstrap failure visible when a custom login micro-app is enabled', async () => {
  await act(async () => {
    root.render(
      React.createElement(LoginPageView, {
        navigate: vi.fn(),
        route: {
          path: '/login',
          fullPath: '/login?error=user-bootstrap-failed',
          query: { error: 'user-bootstrap-failed' },
        },
      })
    )
    await Promise.resolve()
  })

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  expect(container.querySelector('.login-page__micro')).toBeTruthy()
  expect(container.querySelector('.login-alert--error')?.textContent).toContain(
    '用户信息初始化失败，请重新登录'
  )
})
