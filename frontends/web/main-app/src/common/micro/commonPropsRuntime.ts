import { store } from '@/store/storeFacade'
import { getLatestToken } from '@/utils/http'
import { i18nService } from '@/common/i18n'
import authApi from '@/common/api/auth'
import {
  buildProviderEntry,
  getPreloadedAuthProviders,
  isLocalPasswordLoginEnabled,
  mapAuthError,
  resolveReturnUrl,
} from '@/common/auth/flow'

export function readCommonPropsRuntimeValues() {
  const hasAuth = store.getters['user/hasAuth']
  const i18nManager = i18nService.getManager()
  const appInfo = store.getters['app/appInfo'] || {}
  const config = store.getters['app/config'] || {}

  return {
    token: store.getters.token,
    apiHost: window.location.protocol + '//' + window.location.host,
    mainWindow: window,
    appInfo,
    config,
    hasAuth,
    loginHandler: (params: any) => {
      return store.dispatch('user/login', {
        defaultJump: true,
        ...params,
      })
    },
    getToken: () => getLatestToken(),
    listExternalProviders: async () => {
      const preloadedProviders = getPreloadedAuthProviders(appInfo)
      if (preloadedProviders !== null) {
        return preloadedProviders
      }
      const result = await authApi.listProviders()
      return result?.data || []
    },
    isLocalPasswordLoginEnabled: () => isLocalPasswordLoginEnabled(config),
    startRedirectLogin: (provider: any, returnUrl?: string) => {
      const redirectTo = buildProviderEntry(provider, resolveReturnUrl(returnUrl || '/'))
      if (redirectTo) {
        window.location.assign(redirectTo)
      }
      return redirectTo
    },
    loginWithLdap: (params: any) => {
      return store.dispatch('user/loginWithLdap', {
        defaultJump: true,
        ...params,
      })
    },
    exchangeLoginCode: (loginCode: string) => authApi.exchangeLoginCode(loginCode),
    bindExternalAccount: (params: any) => authApi.bindExternalAccount(params),
    resolveReturnUrl: (input?: any) => resolveReturnUrl(input || '/'),
    mapAuthError,
    logoutHandler: async () => {
      await store.dispatch('user/logout')
    },
    getUserInfo: () => Promise.resolve(store.getters.userInfo),
    i18nManager,
    getLanguages: () => i18nService.getLanguages(),
    switchLanguage: (locale: string) => i18nService.switchLanguage(locale),
  }
}
