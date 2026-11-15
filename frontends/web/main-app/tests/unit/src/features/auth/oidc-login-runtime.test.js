import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'

const { getOidcLoginContext, completeOidcLogin, getters } = vi.hoisted(() => ({
  getOidcLoginContext: vi.fn(),
  completeOidcLogin: vi.fn(),
  getters: { token: null },
}))
vi.mock('@/common/api/auth', () => ({
  default: { getOidcLoginContext, completeOidcLogin },
}))
vi.mock('@/store/storeFacade', () => ({ store: { getters } }))
const { OidcLoginPage } =
  await import('../../../../../src/features/auth/pages/OidcLoginPage.tsx')
let dom, root, container
beforeEach(() => {
  vi.clearAllMocks()
  getters.token = null
  getOidcLoginContext.mockResolvedValue({
    code: 0,
    data: { csrfHeader: 'X-CSRF-TOKEN', csrfToken: 'csrf' },
  })
  dom = new JSDOM('<div id="root"></div>', { url: 'https://platform.example/login/oidc' })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: dom.window.document,
  })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.getElementById('root')
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  delete globalThis.window
  delete globalThis.document
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
  dom.window.close()
})
test('uses the existing platform login when there is no platform token', async () => {
  const navigate = vi.fn(),
    continueAuthorization = vi.fn()
  await act(async () =>
    root.render(React.createElement(OidcLoginPage, { navigate, continueAuthorization }))
  )
  expect(navigate).toHaveBeenCalledWith({
    path: '/login',
    query: { redirect: '/login/oidc' },
  })
  expect(completeOidcLogin).not.toHaveBeenCalled()
})
test('completes the protected session bridge and resumes the saved server request', async () => {
  getters.token = { accessToken: 'platform-token' }
  completeOidcLogin.mockResolvedValue({
    code: 0,
    data: { redirectUrl: '/oauth2/authorize?client_id=app' },
  })
  const navigate = vi.fn(),
    continueAuthorization = vi.fn()
  await act(async () =>
    root.render(React.createElement(OidcLoginPage, { navigate, continueAuthorization }))
  )
  expect(completeOidcLogin).toHaveBeenCalledWith('X-CSRF-TOKEN', 'csrf', undefined)
  expect(continueAuthorization).toHaveBeenCalledWith('/oauth2/authorize?client_id=app')
})
test('shows an expired-request error without redirecting', async () => {
  getOidcLoginContext.mockResolvedValue({ code: 400, msg: '授权请求已失效' })
  const navigate = vi.fn(),
    continueAuthorization = vi.fn()
  await act(async () =>
    root.render(React.createElement(OidcLoginPage, { navigate, continueAuthorization }))
  )
  expect(container.querySelector('[role="alert"]').textContent).toContain(
    '授权请求已失效'
  )
  expect(navigate).not.toHaveBeenCalled()
  expect(continueAuthorization).not.toHaveBeenCalled()
})

test('keeps the request id when handing off to platform login', async () => {
  window.history.replaceState(null, '', '/login/oidc?loginRequestId=request-a')
  const navigate = vi.fn(), continueAuthorization = vi.fn()
  await act(async () => root.render(React.createElement(OidcLoginPage, { navigate, continueAuthorization })))
  expect(getOidcLoginContext).toHaveBeenCalledWith('request-a')
  expect(navigate).toHaveBeenCalledWith({ path: '/login', query: { redirect: '/login/oidc?loginRequestId=request-a' } })
})
