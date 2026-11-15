import { describe, expect, test, vi } from 'vitest'

vi.mock('@/common/modal', () => ({
  openDialog: vi.fn(),
  openDrawer: vi.fn(),
  alert: vi.fn(),
  prompt: vi.fn(),
  confirm: vi.fn(),
}))

vi.mock('@/common/tabs', () => ({
  default: {
    openTab: vi.fn(),
    closeTab: vi.fn(),
    openOrSwitchTab: vi.fn(),
    sendToOpenerTab: vi.fn(),
    updateTabTitle: vi.fn(),
  },
}))

vi.mock('@/common/menus', () => ({
  openMenuItem: vi.fn(),
}))

vi.mock('@/common/eventBus', () => ({
  EventBus: { publish: vi.fn() },
}))

vi.mock('@/components/amis/AmisComponent', () => ({
  renderAmisSchema: vi.fn(),
}))

vi.mock('amis', () => ({
  registerIcon: vi.fn(),
  registerFormula: vi.fn(),
}))

vi.mock('amis-core', () => ({
  FormItem: Symbol('FormItem'),
  OptionsControl: Symbol('OptionsControl'),
  Renderer: Symbol('Renderer'),
  addRule: vi.fn(),
  registerAction: vi.fn(),
  utils: {},
}))

vi.mock('@/utils/http', () => ({
  request: vi.fn(),
  getLatestToken: vi.fn(),
}))

vi.mock('@/utils/toast', () => ({
  toast: vi.fn(),
}))

vi.mock('@/utils/Stomp', () => ({}))

vi.mock('@/utils/theme', () => ({
  getTheme: vi.fn(),
  setTheme: vi.fn(),
}))

vi.mock('@/components/amis/editor/lazyRegister', () => ({
  registerActionPanel: vi.fn(),
  registerValidator: vi.fn(),
  registerEditorPlugin: vi.fn(),
}))

vi.mock('@/store/storeFacade', () => ({
  store: { getters: {}, dispatch: vi.fn() },
  subscribeState: () => () => {},
  readGetters: () => ({ 'user/menu': { globalMenu: [], globalSubNav: [] } }),
}))

vi.mock('@/common/i18n', () => ({
  i18nService: {
    getManager: vi.fn(),
    getLanguages: vi.fn(),
    switchLanguage: vi.fn(),
  },
}))

vi.mock('@/common/api/auth', () => ({
  default: {
    listProviders: vi.fn(),
    exchangeLoginCode: vi.fn(),
    bindExternalAccount: vi.fn(),
  },
}))

vi.mock('@/common/auth/flow', () => ({
  buildProviderEntry: vi.fn(),
  getPreloadedAuthProviders: vi.fn(),
  isLocalPasswordLoginEnabled: vi.fn(),
  mapAuthError: vi.fn(),
  resolveReturnUrl: vi.fn(),
}))

import { createCommonProps } from '../../../../../src/common/micro/commonProps.ts'

describe('createCommonProps', () => {
  test('returns token, appInfo, config, mainWindow, apiHost, and __utils__ capability wiring', async () => {
    const runtime = {
      token: { accessToken: 'a', refreshToken: 'r' },
      apiHost: 'https://host.test',
      mainWindow: { name: 'main-window' },
      appInfo: { name: 'demo-app' },
      config: { ldapEnabled: true },
      hasAuth: vi.fn(),
      loginHandler: vi.fn(),
      getToken: vi.fn(),
      listExternalProviders: vi.fn(),
      isLocalPasswordLoginEnabled: vi.fn(),
      startRedirectLogin: vi.fn(),
      loginWithLdap: vi.fn(),
      exchangeLoginCode: vi.fn(),
      bindExternalAccount: vi.fn(),
      resolveReturnUrl: vi.fn(),
      mapAuthError: vi.fn(),
      logoutHandler: vi.fn(),
      getUserInfo: vi.fn(),
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
      getLanguages: vi.fn(),
      switchLanguage: vi.fn(),
    }

    const capabilities = {
      Renderer: Symbol('Renderer'),
      FormItem: Symbol('FormItem'),
      OptionsControl: Symbol('OptionsControl'),
      registerAction: vi.fn(),
      registerIcon: vi.fn(),
      addRule: vi.fn(),
      registerFormula: vi.fn(),
      registerValidator: vi.fn(),
      registerEditorPlugin: vi.fn(),
      registerActionPanel: vi.fn(),
      confirm: vi.fn(),
      alert: vi.fn(),
      prompt: vi.fn(),
      toast: vi.fn(),
      request: vi.fn(),
      amisUtils: { map: vi.fn() },
      openTab: vi.fn(),
      closeTab: vi.fn(),
      openOrSwitchTab: vi.fn(),
      sendToOpenerTab: vi.fn(),
      updateTabTitle: vi.fn(),
      openDialog: vi.fn(),
      openDrawer: vi.fn(),
      renderAmisSchema: vi.fn(),
      eventBus: { publish: vi.fn() },
      openMenu: vi.fn(),
      getTheme: vi.fn(),
      setTheme: vi.fn(),
      stomp: { connect: vi.fn() },
    }

    const commonProps = createCommonProps(runtime, capabilities)

    expect(commonProps.token).toEqual(runtime.token)
    expect(commonProps.apiHost).toBe('https://host.test')
    expect(commonProps.mainWindow).toBe(runtime.mainWindow)
    expect(commonProps.appInfo).toEqual(runtime.appInfo)
    expect(commonProps.config).toEqual(runtime.config)
    expect(commonProps.__utils__.openTab).toBe(capabilities.openTab)
    expect(commonProps.__utils__.openMenu).toBe(capabilities.openMenu)
    expect(commonProps.__utils__.request).toBe(capabilities.request)
    expect(commonProps.__utils__.hasAuth).toBe(runtime.hasAuth)
    expect(commonProps.__utils__.loginHandler).toBe(runtime.loginHandler)
    expect(commonProps.__utils__.logoutHandler).toBe(runtime.logoutHandler)
  })

  test('wraps i18n calls through injected manager and service dependencies', async () => {
    const runtime = {
      token: { accessToken: 'a', refreshToken: 'r' },
      apiHost: 'https://host.test',
      mainWindow: { name: 'main-window' },
      appInfo: {},
      config: {},
      hasAuth: vi.fn(),
      loginHandler: vi.fn(),
      getToken: vi.fn(),
      listExternalProviders: vi.fn(),
      isLocalPasswordLoginEnabled: vi.fn(),
      startRedirectLogin: vi.fn(),
      loginWithLdap: vi.fn(),
      exchangeLoginCode: vi.fn(),
      bindExternalAccount: vi.fn(),
      resolveReturnUrl: vi.fn(),
      mapAuthError: vi.fn(),
      logoutHandler: vi.fn(),
      getUserInfo: vi.fn(),
      i18nManager: {
        getLocale: vi.fn(() => 'zh-CN'),
        t: vi.fn(() => 'translated'),
        tn: vi.fn(() => 'namespaced'),
        tMenu: vi.fn(() => 'menu-text'),
        tCommon: vi.fn(() => 'common-text'),
        useNamespace: vi.fn(() => vi.fn(() => 'ns-text')),
        getLocaleData: vi.fn(() => ({ locale: 'zh-CN' })),
        onLocaleChange: vi.fn(() => vi.fn()),
      },
      getLanguages: vi.fn(() => [{ label: '简体中文', value: 'zh-CN' }]),
      switchLanguage: vi.fn(() => Promise.resolve()),
    }

    const commonProps = createCommonProps(runtime, {})

    expect(commonProps.i18n.getLocale()).toBe('zh-CN')
    expect(commonProps.i18n.t('page.title')).toBe('translated')
    expect(commonProps.i18n.tn('dashboard', 'title')).toBe('namespaced')
    expect(commonProps.i18n.getLanguages()).toEqual([{ label: '简体中文', value: 'zh-CN' }])
    await commonProps.i18n.switchLanguage('en-US')
    expect(runtime.switchLanguage).toHaveBeenCalledWith('en-US')
    expect(runtime.i18nManager.t).toHaveBeenCalledWith('page.title', undefined, undefined)
    expect(runtime.i18nManager.tn).toHaveBeenCalledWith('dashboard', 'title', undefined, undefined)
  })
})
