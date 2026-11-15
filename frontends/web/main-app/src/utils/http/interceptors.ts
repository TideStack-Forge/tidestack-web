import type { AxiosInstance } from 'axios'

import type { AuthRuntime } from './authRuntime'
import type { AnyObj, RequestConfig } from './types'

export function applyHttpInterceptors(
  httpClient: AxiosInstance,
  Auth: AuthRuntime
): void {
  httpClient.interceptors.request.use((async (config: RequestConfig) => {
    if (config.data instanceof FormData) config.timeout = 0
    if (config.responseType === 'blob') config.timeout = 0
    if (!config.headers) config.headers = {}

    try {
      const { i18nService } = await import('@/common/i18n')
      const locale = i18nService.getManager().getLocale()
      if (locale) {
        ;(config.headers as AnyObj)['Accept-Language'] = locale
      }
    } catch (e) {
      void e
    }

    if (config.skipAuth) return config

    const tokenObj = await Auth.Store.getToken()
    if (!tokenObj) return config

    if (
      (config.headers as AnyObj)['Authorization'] ||
      (config.headers as AnyObj)['authorization']
    )
      return config

    if (Auth.Tokens.attachAccessHeader(tokenObj, config)) {
      Auth.Scheduler.schedule(tokenObj)
      return config
    }

    const newToken = await Auth.Refresh.refresh(tokenObj)
    if (newToken) {
      Auth.Tokens.attachAccessHeader(newToken, config)
    } else {
      const { i18nService } = await import('@/common/i18n')
      const msg = i18nService
        .getManager()
        .tCommon('auth.sessionExpired', '登录已过期，请重新登录')
      throw Object.assign(new Error(msg), {
        response: { status: 401, data: { code: 401, msg } },
      })
    }
    return config
  }) as any)
}
