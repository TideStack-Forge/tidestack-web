import { useI18n } from '@/common/i18n/useI18n'
import { useEffect } from 'react'
import authApi from '@/common/api/auth'
import { resolveReturnUrl, buildInitializationRecoveryLocation, oidcLoginReturnTarget } from '@/common/auth/flow'
import type { AuthRouteLike } from '@/common/auth/types'
import { store } from '@/store/storeFacade'
import { LanguageSelector } from '../components/LanguageSelector'

export interface AuthNavigationTarget {
  path: string
  query?: Record<string, any>
}

export interface LoginCallbackPageViewProps {
  navigate: (target: AuthNavigationTarget) => void
  route: AuthRouteLike
}

function buildLoginQuery(errorCode: string, returnUrl: string) {
  if (returnUrl && returnUrl !== '/') {
    return {
      error: errorCode,
      redirect: returnUrl,
    }
  }

  return {
    error: errorCode,
  }
}

export function LoginCallbackPageView({ navigate, route }: LoginCallbackPageViewProps) {
  const i18n = useI18n()
  useEffect(() => {
    const code = Array.isArray(route.query?.code)
      ? route.query?.code[0]
      : route.query?.code
    const returnUrl = resolveReturnUrl(route)

    async function run() {
      if (!code) {
        navigate({ path: '/login', query: buildLoginQuery('40105', returnUrl) })
        return
      }

      const result = await authApi.exchangeLoginCode(code)
      if (result?.code !== 0) {
        navigate({
          path: '/login',
          query: buildLoginQuery(String(result?.code || 40105), returnUrl),
        })
        return
      }

      const bootstrapResult = await store.dispatch('user/bootstrapWithToken', result.data)
      if (!bootstrapResult?.success) {
        navigate(buildInitializationRecoveryLocation(returnUrl))
        return
      }

      navigate(oidcLoginReturnTarget(returnUrl) ?? { path: returnUrl || '/' })
    }

    run().catch((error) => {
      console.warn('外部登录回调处理失败', error)
    })
  }, [navigate, route])

  return (
    <div className="login-page login-page--center">
      <div className="login-page__background" />
      <div className="login-page__container">
        <div className="login-page__language-selector">
          <LanguageSelector />
        </div>
        <div className="login-card login-card--transition">
          <section className="auth-pending-card">
            <div className="auth-pending-card__spinner">
              <i className="fa fa-spinner" />
            </div>
            <h2 className="auth-pending-card__title">
              {i18n.tn('/login', 'callback.title', '正在完成外部登录')}
            </h2>
            <p className="auth-pending-card__description">
              {i18n.tn(
                '/login',
                'callback.description',
                '平台正在校验外部登录结果，请稍候。'
              )}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
