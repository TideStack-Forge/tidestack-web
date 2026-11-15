import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'
const { get, patch, commit } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), commit: vi.fn() }))
vi.mock('@/router/routerFacade', () => ({ readCurrentRoute: () => ({ query: Object.fromEntries(new URLSearchParams(window.location.search)) }) }))
vi.mock('@/utils/http', () => ({ Client: { get, patch } }))
vi.mock('@/store/storeFacade', () => ({ commit }))
vi.mock('@/components/amis/AmisComponent', () => ({
  default: ({ amisProps }) => React.createElement('button', {
    onClick: () => amisProps.onSubmit({ identity_approved: true, offline_approved: true,
      nickname: '新名称', formalName: '伪造姓名', displayName: '伪造显示名' }),
  }, '提交资料或授权'),
}))
const { default: ConsentPage } = await import('../../../../../src/features/auth/pages/OidcConsentPage.tsx')
const { default: ProfilePage, AdminUserProfilePage } = await import('../../../../../src/features/account/UserProfilePage.tsx')
let dom, root, container
const userInfo = { nickname: '新名称', formalName: '张三', displayName: '新名称' }
const profile = { status: 'EDITABLE', schemaRevision: 'rules-1', profileRevision: 4,
  fields: [{ name: 'nickname', label: '昵称', editable: true, writeMode: 'PROFILE_PATCH' },
    { name: 'formalName', label: '正式名称', editable: false, writeMode: 'READ_ONLY' },
    { name: 'displayName', label: '显示名称', editable: false, writeMode: 'READ_ONLY' }],
  values: { nickname: '旧名称' }, contactStatus: {}, editSchema: { type: 'form' } }
beforeEach(() => {
  vi.clearAllMocks()
  dom = new JSDOM('<div id="root"></div>', { url: 'https://platform.example/login/oidc/consent?state=request-a' })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.getElementById('root'); root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  document.querySelectorAll('form').forEach(form => form.remove())
  delete globalThis.window; delete globalThis.document; delete globalThis.IS_REACT_ACT_ENVIRONMENT
  dom.window.close()
})
test('consent renders the authoritative preview and posts only its server-bound choices', async () => {
  const view = { contextId: 'bound-context', viewRevision: 'view-1', client: { name: '应用甲', verifiedRedirectOrigin: 'https://rp.example' },
    account: { displayName: '用户', accountLabel: 'user' }, identity: { scopes: ['openid'], claims: { sub: 'subject' } },
    offlineAccess: { requested: true }, csrf: { parameterName: '_csrf', token: 'csrf-proof' } }
  get.mockImplementation(url => Promise.resolve({ data: { code: 0, data: url.includes('consent-context') ? view : { type: 'form' } } }))
  const submit = vi.spyOn(dom.window.HTMLFormElement.prototype, 'submit').mockImplementation(() => {})
  await act(async () => root.render(React.createElement(ConsentPage)))
  expect(container.textContent).toContain('应用甲')
  expect(container.textContent).toContain('subject')
  await act(async () => container.querySelector('button').click())
  const form = document.querySelector('form')
  expect(form.action).toBe('https://platform.example/oauth2/authorize')
  expect(Object.fromEntries(new dom.window.FormData(form))).toEqual({ context_id: 'bound-context', view_revision: 'view-1', decision: 'continue',
    _csrf: 'csrf-proof', identity_approved: 'true', offline_approved: 'true' })
  expect(submit).toHaveBeenCalledOnce()
})
test('expired consent shows a recoverable message without loading or submitting', async () => {
  window.history.replaceState(null, '', '/login/oidc/consent?result=expired')
  await act(async () => root.render(React.createElement(ConsentPage)))
  expect(container.querySelector('[role="alert"]').textContent).toContain('已失效')
  expect(get).not.toHaveBeenCalled()
  expect(container.querySelector('button')).toBeNull()
})
test('self profile submits a narrow patch with both authoritative versions', async () => {
  get.mockImplementation(url => Promise.resolve({ data: { code: 0, data: url === '/api/sys/user/info' ? userInfo : profile } }))
  patch.mockResolvedValue({ data: { code: 0, data: { ...profile, profileRevision: 5 } } })
  await act(async () => root.render(React.createElement(ProfilePage)))
  await act(async () => container.querySelector('button').click())
  expect(patch).toHaveBeenCalledWith('/api/sys/user/me/profile', { schemaRevision: 'rules-1', expectedProfileRevision: 4,
    changes: { nickname: '新名称' } }, { isSilent: true })
  expect(container.querySelector('[role="status"]').textContent).toContain('已保存')
  expect(commit).toHaveBeenCalledWith('user/SET_USERINFO', userInfo)
})
test('admin profile uses the same form rules and targets only the selected account', async () => {
  get.mockImplementation(url => Promise.resolve({ data: { code: 0, data: url === '/api/sys/user/info' ? userInfo : profile } }))
  patch.mockResolvedValue({ data: { code: 0, data: profile } })
  await act(async () => root.render(React.createElement(ProfilePage, { adminIdentity: 'selected-user' })))
  expect(container.textContent).toContain('用户资料：selected-user')
  await act(async () => container.querySelector('button').click())
  expect(patch.mock.calls[0][0]).toBe('/api/sys/user/selected-user/profile')
  expect(commit).toHaveBeenCalledWith('user/SET_USERINFO', userInfo)
  expect(commit.mock.calls[0][1]).not.toBe(profile)
})
test('a failed profile load remains visible and offers reload', async () => {
  get.mockRejectedValue(new Error('资料规则不可用'))
  await act(async () => root.render(React.createElement(ProfilePage)))
  expect(container.querySelector('[role="alert"]').textContent).toContain('资料规则不可用')
  expect(container.querySelector('button').textContent).toBe('重新加载')
})

test('admin route reads the selected account from the platform router facade', async () => {
  window.history.replaceState(null, '', '/system-setting/user-management/profile?userIdentity=selected-user')
  get.mockImplementation(url => Promise.resolve({ data: { code: 0, data: url === '/api/sys/user/info' ? userInfo : profile } }))
  await act(async () => root.render(React.createElement(AdminUserProfilePage)))
  expect(container.textContent).toContain('用户资料：selected-user')
  expect(get.mock.calls[0][0]).toBe('/api/sys/user/selected-user/profile')
})
