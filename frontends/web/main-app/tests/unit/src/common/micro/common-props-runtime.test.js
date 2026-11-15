import { beforeEach, expect, test, vi } from 'vitest'

const {
  store,
  getLatestToken,
  i18nManager,
  getLanguages,
  switchLanguage,
  listProviders,
  exchangeLoginCode,
  bindExternalAccount,
  buildProviderEntry,
  getPreloadedAuthProviders,
  isLocalPasswordLoginEnabled,
  mapAuthError,
  resolveReturnUrl,
  assign,
} = vi.hoisted(() => ({
  store: {
    getters: {
      'user/hasAuth': vi.fn(),
      'app/appInfo': {},
      'app/config': {},
      token: { accessToken: 'access', refreshToken: 'refresh' },
      userInfo: { id: 'u-1' },
    },
    dispatch: vi.fn(),
  },
  getLatestToken: vi.fn(() => Promise.resolve({ accessToken: 'access' })),
  i18nManager: {
    getLocale: vi.fn(),
    t: vi.fn(),
    tn: vi.fn(),
    tMenu: vi.fn(),
    tCommon: vi.fn(),
    useNamespace: vi.fn(),
    getLocaleData: vi.fn(),
    onLocaleChange: vi.fn(),
  },
  getLanguages: vi.fn(() => [{ label: '简体中文', value: 'zh-CN' }]),
  switchLanguage: vi.fn(() => Promise.resolve()),
  listProviders: vi.fn(() => Promise.resolve({ data: [{ code: 'ldap' }] })),
  exchangeLoginCode: vi.fn(() => Promise.resolve({ code: 0 })),
  bindExternalAccount: vi.fn(() => Promise.resolve({ code: 0 })),
  buildProviderEntry: vi.fn(() => 'https://sso.test/login'),
  getPreloadedAuthProviders: vi.fn(() => null),
  isLocalPasswordLoginEnabled: vi.fn(() => true),
  mapAuthError: vi.fn(() => 'mapped-error'),
  resolveReturnUrl: vi.fn(() => '/resolved'),
  assign: vi.fn(),
}))

vi.mock('@/store/storeFacade', () => ({
  store,
}))

vi.mock('@/utils/http', () => ({
  getLatestToken,
}))

vi.mock('@/common/i18n', () => ({
  i18nService: {
    getManager: () => i18nManager,
    getLanguages,
    switchLanguage,
  },
}))

vi.mock('@/common/api/auth', () => ({
  default: {
    listProviders,
    exchangeLoginCode,
    bindExternalAccount,
  },
}))

vi.mock('@/common/auth/flow', () => ({
  buildProviderEntry,
  getPreloadedAuthProviders,
  isLocalPasswordLoginEnabled,
  mapAuthError,
  resolveReturnUrl,
}))

const commonPropsRuntimeModule = await import('../../../../../src/common/micro/commonPropsRuntime.ts')

beforeEach(() => {
  store.getters['user/hasAuth'] = vi.fn()
  store.getters['app/appInfo'] = {}
  store.getters['app/config'] = {}
  store.getters.token = { accessToken: 'access', refreshToken: 'refresh' }
  store.getters.userInfo = { id: 'u-1' }
  store.dispatch.mockReset()
  getLatestToken.mockReset()
  i18nManager.getLocale.mockReset()
  i18nManager.t.mockReset()
  i18nManager.tn.mockReset()
  i18nManager.tMenu.mockReset()
  i18nManager.tCommon.mockReset()
  i18nManager.useNamespace.mockReset()
  i18nManager.getLocaleData.mockReset()
  i18nManager.onLocaleChange.mockReset()
  getLanguages.mockReset()
  switchLanguage.mockReset()
  listProviders.mockReset()
  exchangeLoginCode.mockReset()
  bindExternalAccount.mockReset()
  buildProviderEntry.mockReset()
  getPreloadedAuthProviders.mockReset()
  isLocalPasswordLoginEnabled.mockReset()
  mapAuthError.mockReset()
  resolveReturnUrl.mockReset()
  assign.mockReset()
  getLatestToken.mockResolvedValue({ accessToken: 'latest' })
  getLanguages.mockReturnValue([{ label: '简体中文', value: 'zh-CN' }])
  switchLanguage.mockResolvedValue(undefined)
  listProviders.mockResolvedValue({ data: [{ code: 'ldap' }] })
  exchangeLoginCode.mockResolvedValue({ code: 0 })
  bindExternalAccount.mockResolvedValue({ code: 0 })
  getPreloadedAuthProviders.mockReturnValue(null)
  isLocalPasswordLoginEnabled.mockReturnValue(true)
  mapAuthError.mockReturnValue('mapped-error')
  resolveReturnUrl.mockReturnValue('/resolved')
  buildProviderEntry.mockReturnValue('https://sso.test/login')
  Object.defineProperty(globalThis, 'window', {
    value: {
      location: {
        protocol: 'https:',
        host: 'host.test',
        assign,
      },
    },
    configurable: true,
    writable: true,
  })
})

test('reads store-backed token, appInfo, config, and user data from runtime', async () => {
  store.getters['app/appInfo'] = { code: 'app-1' }
  store.getters['app/config'] = { ldapEnabled: true }

  const runtime = commonPropsRuntimeModule.readCommonPropsRuntimeValues()

  expect(runtime.token).toEqual({ accessToken: 'access', refreshToken: 'refresh' })
  expect(runtime.apiHost).toBe('https://host.test')
  expect(runtime.mainWindow).toBe(window)
  expect(runtime.appInfo).toEqual({ code: 'app-1' })
  expect(runtime.config).toEqual({ ldapEnabled: true })
  expect(runtime.hasAuth).toBe(store.getters['user/hasAuth'])
  expect(await runtime.getToken()).toEqual({ accessToken: 'latest' })
  expect(await runtime.getUserInfo()).toEqual({ id: 'u-1' })
})

test('wires loginHandler, loginWithLdap, and logoutHandler through store dispatch', async () => {
  const runtime = commonPropsRuntimeModule.readCommonPropsRuntimeValues()

  await runtime.loginHandler({ username: 'demo' })
  await runtime.loginWithLdap({ username: 'ldap-demo' })
  await runtime.logoutHandler()

  expect(store.dispatch).toHaveBeenNthCalledWith(1, 'user/login', {
    defaultJump: true,
    username: 'demo',
  })
  expect(store.dispatch).toHaveBeenNthCalledWith(2, 'user/loginWithLdap', {
    defaultJump: true,
    username: 'ldap-demo',
  })
  expect(store.dispatch).toHaveBeenNthCalledWith(3, 'user/logout')
})

test('uses provider preload fallback and redirect-login URL generation', async () => {
  store.getters['app/appInfo'] = { authProviders: [{ code: 'cas' }] }
  store.getters['app/config'] = { ldapEnabled: false }
  getPreloadedAuthProviders.mockReturnValue([{ code: 'cas' }])

  const runtime = commonPropsRuntimeModule.readCommonPropsRuntimeValues()

  expect(await runtime.listExternalProviders()).toEqual([{ code: 'cas' }])
  expect(runtime.isLocalPasswordLoginEnabled()).toBe(true)
  expect(runtime.startRedirectLogin({ code: 'cas' }, '/dashboard')).toBe('https://sso.test/login')
  expect(resolveReturnUrl).toHaveBeenCalledWith('/dashboard')
  expect(buildProviderEntry).toHaveBeenCalledWith({ code: 'cas' }, '/resolved')
  expect(assign).toHaveBeenCalledWith('https://sso.test/login')
})
