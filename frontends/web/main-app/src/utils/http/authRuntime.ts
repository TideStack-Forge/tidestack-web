import type { AxiosInstance } from 'axios'

import { store } from '@/store/storeFacade'

import type { AnyObj, ApiResponse, RequestConfig, TokenLike } from './types'

export function createAuthRuntime(httpClient: AxiosInstance) {
  const Auth = {
    Time: {
      SKEW_MS: 60 * 1000,
      toMillis(v: unknown): number {
        if (v == null) return 0
        const n = Number(v)
        return Number.isFinite(n) ? n : 0
      },
      asExpiresAt(expiresLike: unknown, issuedAtLike?: unknown): number {
        const now = Date.now()
        const issuedAt = Auth.Time.toMillis(issuedAtLike) || now
        const raw = Auth.Time.toMillis(expiresLike)
        if (!raw) return 0
        if (raw >= 1e12) return raw
        if (raw >= 1e10) return raw * 1000
        const ttlMs = raw < 1e6 ? raw * 1000 : raw
        return issuedAt + ttlMs
      },
      isValid(expiresAtMs?: number): boolean {
        if (!expiresAtMs) return false
        return expiresAtMs - Auth.Time.SKEW_MS > Date.now()
      },
    },

    Store: {
      refreshTimerId: null as any as number | null,
      sessionEpoch: 0,

      async getToken(): Promise<TokenLike | null | undefined> {
        if (Auth.Refresh.refreshingPromise) {
          await Auth.Refresh.refreshingPromise
        }
        return (store as any).getters.token as TokenLike | null | undefined
      },

      setToken(token: TokenLike): void {
        ;(store as any).commit('user/SET_TOKEN', token)
        Auth.Scheduler.schedule(token)
      },

      logout(): void {
        if (Auth.Store.refreshTimerId) {
          clearTimeout(Auth.Store.refreshTimerId)
          Auth.Store.refreshTimerId = null
        }
        Auth.Store.sessionEpoch++
        ;(store as any).dispatch('user/logout', { revoke: false })
      },
    },

    Tokens: {
      pick<T = any>(obj: AnyObj | undefined, ...keys: string[]): T | undefined {
        if (!obj) return undefined
        for (const k of keys) {
          if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null) {
            return obj[k]
          }
        }
        return undefined
      },

      extractAccess(tokenObj?: TokenLike): { token: string | null; expiresAt: number } {
        if (!tokenObj) return { token: null, expiresAt: 0 }

        const accessContainer = this.pick<any>(tokenObj, 'accessToken', 'access_token')
        if (!accessContainer) return { token: null, expiresAt: 0 }

        if (typeof accessContainer === 'string') {
          const token = accessContainer
          const expiresRaw = this.pick<number>(
            tokenObj,
            'expiresAt',
            'expires_at',
            'expiresTime',
            'expires_time',
            'expiresIn',
            'expires_in'
          )
          const issuedRaw = this.pick<number>(
            tokenObj,
            'issuedAt',
            'issued_at',
            'loginTime',
            'login_time',
            'updateTime',
            'update_time'
          )
          const expiresAt = Auth.Time.asExpiresAt(expiresRaw, issuedRaw)
          return { token, expiresAt }
        }

        const at = accessContainer as AnyObj
        const token = this.pick<string>(at, 'token', 'access_token', 'value') ?? null
        const expiresRaw =
          this.pick<number>(
            at,
            'expiresAt',
            'expires_at',
            'expiresTime',
            'expires_time',
            'expiresIn',
            'expires_in'
          ) ??
          this.pick<number>(
            tokenObj,
            'expiresAt',
            'expires_at',
            'expiresTime',
            'expires_time',
            'expiresIn',
            'expires_in'
          )
        const issuedRaw =
          this.pick<number>(
            at,
            'issuedAt',
            'issued_at',
            'createdAt',
            'created_at',
            'updatedAt',
            'updated_at'
          ) ??
          this.pick<number>(
            tokenObj,
            'issuedAt',
            'issued_at',
            'loginTime',
            'login_time',
            'updateTime',
            'update_time'
          )

        const expiresAt = Auth.Time.asExpiresAt(expiresRaw, issuedRaw)
        return { token, expiresAt: expiresAt || 0 }
      },

      extractRefresh(tokenObj?: TokenLike): { token: string | null; expiresAt: number } {
        if (!tokenObj) return { token: null, expiresAt: 0 }

        const refreshContainer = this.pick<any>(tokenObj, 'refreshToken', 'refresh_token')
        if (!refreshContainer) return { token: null, expiresAt: 0 }

        if (typeof refreshContainer === 'string') {
          const token = refreshContainer
          const expiresRaw =
            this.pick<number>(
              tokenObj,
              'refreshTokenExpiresAt',
              'refresh_token_expires_at',
              'refreshTokenExpiresTime',
              'refresh_token_expires_time',
              'refreshTokenExpiresIn',
              'refresh_token_expires_in'
            ) ??
            this.pick<number>(
              tokenObj,
              'refreshExpiresAt',
              'refresh_expires_at',
              'refreshExpiresTime',
              'refresh_expires_time',
              'refreshExpiresIn',
              'refresh_expires_in'
            )
          const issuedRaw = this.pick<number>(
            tokenObj,
            'refreshTokenIssuedAt',
            'refresh_token_issued_at',
            'issuedAt',
            'issued_at',
            'loginTime',
            'login_time',
            'updateTime',
            'update_time'
          )
          const expiresAt = Auth.Time.asExpiresAt(expiresRaw, issuedRaw)
          return { token, expiresAt }
        }

        const rt = refreshContainer as AnyObj
        const token = this.pick<string>(rt, 'token', 'refresh_token', 'value') ?? null
        const expiresRaw =
          this.pick<number>(
            rt,
            'expiresAt',
            'expires_at',
            'expiresTime',
            'expires_time',
            'expiresIn',
            'expires_in'
          ) ??
          this.pick<number>(
            tokenObj,
            'refreshTokenExpiresAt',
            'refresh_token_expires_at',
            'refreshTokenExpiresTime',
            'refresh_token_expires_time',
            'refreshTokenExpiresIn',
            'refresh_token_expires_in',
            'refreshExpiresAt',
            'refresh_expires_at',
            'refreshExpiresTime',
            'refresh_expires_time',
            'refreshExpiresIn',
            'refresh_expires_in'
          )
        const issuedRaw =
          this.pick<number>(
            rt,
            'issuedAt',
            'issued_at',
            'createdAt',
            'created_at',
            'updatedAt',
            'updated_at'
          ) ??
          this.pick<number>(
            tokenObj,
            'refreshTokenIssuedAt',
            'refresh_token_issued_at',
            'issuedAt',
            'issued_at',
            'loginTime',
            'login_time',
            'updateTime',
            'update_time'
          )

        const expiresAt = Auth.Time.asExpiresAt(expiresRaw, issuedRaw)
        return { token, expiresAt: expiresAt || 0 }
      },

      attachAccessHeader(tokenObj: TokenLike, config: RequestConfig): boolean {
        if (!config.headers) config.headers = {}

        const existingAuth =
          (config.headers as AnyObj)['Authorization'] ??
          (config.headers as AnyObj)['authorization']
        if (existingAuth) return true

        const { token: at, expiresAt } = this.extractAccess(tokenObj)
        if (at && Auth.Time.isValid(expiresAt)) {
          ;(config.headers as AnyObj)['Authorization'] = `Bearer ${at}`
          return true
        }
        return false
      },
    },

    Refresh: {
      refreshingPromise: null as Promise<TokenLike | null> | null,

      async refresh(tokenObj: TokenLike): Promise<TokenLike | null> {
        if (Auth.Refresh.refreshingPromise) return Auth.Refresh.refreshingPromise

        const { token: rt, expiresAt } = Auth.Tokens.extractRefresh(tokenObj)
        if (!rt || !Auth.Time.isValid(expiresAt)) {
          return Promise.reject(
            Object.assign(new Error('登录已过期，请重新登录'), {
              response: {
                status: 401,
                data: { code: 401, msg: '登录已过期，请重新登录' },
              },
            })
          )
        }

        const startEpoch = Auth.Store.sessionEpoch
        Auth.Refresh.refreshingPromise = httpClient
          .post<ApiResponse<TokenLike>>('/api/auth/refresh-token/' + rt, null, {
            skipAuth: true,
          } as RequestConfig)
          .then((res) => {
            if (res && res.data && res.data.code === 0) {
              if (startEpoch !== Auth.Store.sessionEpoch) return null
              const newToken = res.data.data
              Auth.Store.setToken(newToken)
              return newToken
            }
            throw Object.assign(new Error('刷新令牌失败'), {
              response: {
                ...res,
                status:
                  res.data?.code === 401 ||
                  (res.data?.code >= 40100 && res.data?.code < 40200)
                    ? 401
                    : 500,
              },
            })
          })
          .finally(() => {
            Auth.Refresh.refreshingPromise = null
          })

        return Auth.Refresh.refreshingPromise
      },
    },

    Scheduler: {
      PRE_REFRESH_MS: 2 * 60 * 1000,
      MAX_REFRESH_MS: 5 * 60 * 1000,

      schedule(tokenObj?: TokenLike | null): void {
        if (Auth.Store.refreshTimerId) {
          clearTimeout(Auth.Store.refreshTimerId)
          Auth.Store.refreshTimerId = null
        }
        if (!tokenObj) return

        const { token: at, expiresAt } = Auth.Tokens.extractAccess(tokenObj)
        if (!at || !expiresAt) return
        if (!Auth.Time.isValid(expiresAt)) return

        const now = Date.now()
        let delay = Math.min(
          expiresAt - Auth.Scheduler.PRE_REFRESH_MS - now,
          Auth.Scheduler.MAX_REFRESH_MS
        )

        if (delay < 100) delay = 100
        Auth.Store.refreshTimerId = setTimeout(async () => {
          try {
            const currentTokenObj = await Auth.Store.getToken()
            if (!currentTokenObj) return

            const { token: at2, expiresAt: exp2 } =
              Auth.Tokens.extractAccess(currentTokenObj)
            if (!at2 || !exp2) return
            if (
              exp2 - Auth.Time.SKEW_MS - Date.now() >
              Auth.Scheduler.PRE_REFRESH_MS + 1000
            ) {
              Auth.Scheduler.schedule(currentTokenObj)
              return
            }

            await Auth.Refresh.refresh(currentTokenObj)
          } catch (e: any) {
            console?.warn?.('预刷新失败', e?.message || e)
          }
        }, delay) as unknown as number
      },
    },
  }

  const App = {
    Visibility: {
      bound: false,
      setup(): void {
        if (App.Visibility.bound) return
        if (typeof document === 'undefined' || typeof window === 'undefined') return

        const onVisible = async () => {
          try {
            if (document.visibilityState === 'visible') {
              const tokenObj = await Auth.Store.getToken()
              if (tokenObj) Auth.Scheduler.schedule(tokenObj)
            }
          } catch (e: any) {
            console?.warn?.('可见性校准失败', e?.message || e)
          }
        }

        document.addEventListener(
          'visibilitychange',
          onVisible as any,
          { passive: true } as any
        )
        window.addEventListener('focus', onVisible as any, { passive: true } as any)
        App.Visibility.bound = true
      },
    },
  }

  function scheduleBootTokenRefresh(): void {
    try {
      const bootToken = (store as any).getters.token as TokenLike | null | undefined
      if (bootToken) Auth.Scheduler.schedule(bootToken)
    } catch (error) {
      void error
    }
  }

  function setupAuthVisibility(): void {
    App.Visibility.setup()
  }

  async function getLatestToken(): Promise<TokenLike | null | undefined> {
    return Auth.Store.getToken()
  }

  return {
    Auth,
    scheduleBootTokenRefresh,
    setupAuthVisibility,
    getLatestToken,
  }
}

export type AuthRuntime = ReturnType<typeof createAuthRuntime>['Auth']
