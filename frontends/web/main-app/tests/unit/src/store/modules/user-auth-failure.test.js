import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  userApi: Object.fromEntries(
    [
      'getAuthorities',
      'getUserInfo',
      'getUserMenus',
      'getUserSetting',
      'login',
      'revokeToken',
    ].map((key) => [key, vi.fn()])
  ),
  authApi: { loginWithLdap: vi.fn() },
  publish: vi.fn(),
  startMicroApp: vi.fn(),
  toastError: vi.fn(),
  replaceLocation: vi.fn(),
}))
vi.mock('@/common/api/user', () => ({ default: mocks.userApi }))
vi.mock('@/common/api/auth', () => ({ default: mocks.authApi }))
vi.mock('@/common/menus', () => ({ doJump: vi.fn() }))
vi.mock('@/utils/Storage', () => ({ default: class Storage {} }))
vi.mock('@/common/eventBus', () => ({ EventBus: { publish: mocks.publish } }))
vi.mock('@/utils/toast', () => ({ default: { error: mocks.toastError } }))
vi.mock('@/common/micro', () => ({ startMicroApp: mocks.startMicroApp }))
vi.mock('@/utils/http', () => ({ configAxios: vi.fn() }))
vi.mock('@/common/i18n', () => ({ i18nManager: { tMenu: (_key, fallback) => fallback } }))
vi.mock('@/router/routerFacade', () => ({ replaceLocation: mocks.replaceLocation }))

const userModule = (await import('../../../../../src/store/modules/user.js')).default
const token = { accessToken: 'same-session' }
const failure = {
  code: 50000,
  httpStatus: 500,
  msg: '服务暂时不可用，请稍后重试',
  data: null,
}

function context() {
  const state = {
    ...structuredClone(userModule.state),
    token,
    tokenStorage: { setItem: vi.fn(), removeItem: vi.fn() },
  }
  const ctx = { state, rootGetters: { 'app/whiteList': ['/login'], 'app/config': {} } }
  ctx.commit = vi.fn((type, payload) => userModule.mutations[type](state, payload))
  ctx.dispatch = vi.fn((type, payload) => userModule.actions[type](ctx, payload))
  return ctx
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', {
    location: new URL('http://localhost/login?redirect=%2Freports%3Ftab%3Dmine'),
    history: { replaceState: vi.fn() },
  })
  mocks.userApi.getUserInfo.mockResolvedValue({
    code: 0,
    data: { userIdentity: 'alice' },
  })
  mocks.userApi.getUserMenus.mockResolvedValue({
    code: 0,
    data: { main: [{ title: '报表', path: '/reports' }], secondary: [] },
  })
  mocks.userApi.getAuthorities.mockResolvedValue({ code: 0, data: { read: {} } })
  mocks.userApi.getUserSetting.mockResolvedValue({ code: 0, data: null })
})
afterEach(() => vi.unstubAllGlobals())

describe('user initialization recovery', () => {
  test.each(['getUserInfo', 'getUserMenus', 'getAuthorities'])(
    '%s failure preserves the session without partial state, then recovers',
    async (apiMethod) => {
      mocks.userApi[apiMethod].mockResolvedValueOnce(failure)
      const ctx = context()
      ctx.state.isLogin = true
      ctx.state.authorities = { stale: {} }
      ctx.state.authorityNames = ['stale']
      ctx.state.menu.globalMenu = [{ title: 'stale' }]
      const result = await ctx.dispatch('init')
      expect(result).toMatchObject({ success: false, code: 50000, httpStatus: 500 })
      expect(ctx.state.token).toBe(token)
      expect(ctx.state.isLogin).toBe(false)
      expect(ctx.state.userInfo).toEqual({})
      expect(ctx.state.menu.globalMenu).toEqual([])
      expect(ctx.state.authorities).toEqual({})
      expect(ctx.state.initializationError).toBe(result)
      expect(ctx.state.tokenStorage.removeItem).not.toHaveBeenCalled()
      expect(mocks.startMicroApp).not.toHaveBeenCalled()
      expect(mocks.publish).not.toHaveBeenCalledWith('SYS_INIT_USER')
      expect(mocks.userApi.getUserSetting).not.toHaveBeenCalled()
      expect(ctx.commit.mock.calls.map(([type]) => type)).not.toContain('SET_USERINFO')
      if (apiMethod === 'getUserInfo')
        expect(mocks.userApi.getUserMenus).not.toHaveBeenCalled()
      if (apiMethod !== 'getAuthorities')
        expect(mocks.userApi.getAuthorities).not.toHaveBeenCalled()

      expect(await ctx.dispatch('init')).toMatchObject({ success: true })
      expect(ctx.state.isLogin).toBe(true)
      expect(ctx.state.initializationError).toBeNull()
      expect(ctx.state.token).toBe(token)
      expect(ctx.state.menu.globalMenu[0].path).toBe('/reports')
      expect(ctx.state.authorityNames).toEqual(['read'])
      expect(mocks.startMicroApp).toHaveBeenCalledTimes(1)
      expect(mocks.publish).toHaveBeenCalledExactlyOnceWith('SYS_INIT_USER')
      expect(mocks.userApi.login).not.toHaveBeenCalled()
    }
  )

  test('successful empty menus complete initialization and retain the no-menu outcome', async () => {
    mocks.userApi.getUserMenus.mockResolvedValue({
      code: 0,
      data: { main: [], secondary: [] },
    })
    const ctx = context()
    expect(await ctx.dispatch('bootstrapWithToken', token)).toMatchObject({
      success: true,
      hasConfiguredMenu: false,
    })
    expect(ctx.state.initializationError).toBeNull()
    expect(ctx.state.isLogin).toBe(true)
  })

  test.each(['login', 'loginWithLdap'])(
    '%s routes initialization failure to recovery without success callbacks or duplicate toast',
    async (action) => {
      mocks.userApi.login.mockResolvedValue({ code: 0, data: token })
      mocks.authApi.loginWithLdap.mockResolvedValue({ code: 0, data: token })
      mocks.userApi.getUserMenus.mockResolvedValueOnce(failure)
      const ctx = context()
      const success = vi.fn()
      expect(
        await ctx.dispatch(action, { username: 'alice', password: 'secret', success })
      ).toMatchObject({ success: false })
      expect(success).not.toHaveBeenCalled()
      expect(mocks.toastError).not.toHaveBeenCalled()
      expect(mocks.replaceLocation).toHaveBeenCalledWith({
        path: '/errorAfterLogin',
        query: { fullscreen: 'true', redirect: '/reports?tab=mine' },
      })
    }
  )

  test('actual invalid credentials still use login feedback without initializing a session', async () => {
    mocks.userApi.login.mockResolvedValue({ code: -1, msg: '用户名或密码错误' })
    const ctx = context()
    const result = await ctx.dispatch('login', { username: 'alice', password: 'wrong' })
    expect(result.success).toBe(false)
    expect(mocks.toastError).toHaveBeenCalledWith('用户名或密码错误')
    expect(mocks.userApi.getUserInfo).not.toHaveBeenCalled()
  })

  test('explicit logout clears all user-derived authorization state', () => {
    const ctx = context()
    ctx.state.authorities = { stale: {} }
    ctx.state.authorityNames = ['stale']
    ctx.state.menu.globalMenu = [{ title: 'stale' }]
    ctx.commit('LOGOUT')
    expect(ctx.state.token).toBeNull()
    expect(ctx.state.authorities).toEqual({})
    expect(ctx.state.authorityNames).toEqual([])
    expect(ctx.state.menu.globalMenu).toEqual([])
  })
})
