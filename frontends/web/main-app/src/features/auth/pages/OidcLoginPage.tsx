import { useEffect, useState } from 'react'
import authApi from '@/common/api/auth'
import { store } from '@/store/storeFacade'
import type { AuthNavigationTarget } from './LoginCallbackPage'

export interface OidcLoginPageProps {
  navigate: (target: AuthNavigationTarget) => void
  continueAuthorization: (target: string) => void
}

export function OidcLoginPage({ navigate, continueAuthorization }: OidcLoginPageProps) {
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    async function complete() {
      const loginRequestId =
        new URLSearchParams(window.location.search).get('loginRequestId') || undefined
      const returnUrl =
        '/login/oidc' +
        (loginRequestId ? '?loginRequestId=' + encodeURIComponent(loginRequestId) : '')
      const context = await authApi.getOidcLoginContext(loginRequestId)
      if (cancelled) return
      if (context.code !== 0 || !context.data?.csrfToken) {
        throw new Error(context.msg || '授权请求已失效，请从接入应用重新发起登录。')
      }
      if (!store.getters.token) {
        navigate({ path: '/login', query: { redirect: returnUrl } })
        return
      }
      const result = await authApi.completeOidcLogin(
        context.data.csrfHeader,
        context.data.csrfToken,
        loginRequestId
      )
      if (cancelled) return
      if (result.code !== 0 || !result.data?.redirectUrl) {
        throw new Error(result.msg || '无法完成授权登录，请重新登录后重试。')
      }
      // The server returns the saved authorization request; no OAuth parameters come from this page.
      continueAuthorization(result.data.redirectUrl)
    }
    complete().catch((failure: unknown) => {
      if (!cancelled)
        setError(failure instanceof Error ? failure.message : '授权登录失败，请重试。')
    })
    return () => {
      cancelled = true
    }
  }, [navigate, continueAuthorization])

  return (
    <div className="login-page login-page--center">
      <div className="login-page__container">
        <section
          className="login-card auth-pending-card"
          role={error ? 'alert' : 'status'}>
          <h2>{error ? '授权登录未完成' : '正在完成授权登录'}</h2>
          <p>{error || '正在使用平台登录身份完成认证，请稍候。'}</p>
          {error && <a href="/login?redirect=%2Flogin%2Foidc">重新登录</a>}
        </section>
      </div>
    </div>
  )
}
