import { useI18n } from '@/common/i18n/useI18n'
import { useEffect, useState, type FormEvent } from 'react'
import authApi from '@/common/api/auth'
import {
  mapAuthError,
  oidcLoginReturnTarget,
  resolveReturnUrl,
  buildInitializationRecoveryLocation,
} from '@/common/auth/flow'
import type { AuthRouteLike } from '@/common/auth/types'
import { store } from '@/store/storeFacade'
import { LanguageSelector } from '../components/LanguageSelector'

export interface AuthNavigationTarget {
  path: string
  query?: Record<string, any>
}

export interface LoginBindPageViewProps {
  navigate: (target: AuthNavigationTarget) => void
  route: AuthRouteLike
}

export function LoginBindPageView({ navigate, route }: LoginBindPageViewProps) {
  const i18n = useI18n()
  const usernameInputId = 'login-bind-username'
  const passwordInputId = 'login-bind-password'
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [bindingToken, setBindingToken] = useState('')
  const [returnUrl, setReturnUrl] = useState('/')
  const [submitError, setSubmitError] = useState<string | number>('')

  useEffect(() => {
    const token = Array.isArray(route.query?.token)
      ? route.query?.token[0]
      : route.query?.token
    const nextBindingToken = token || ''

    setBindingToken(nextBindingToken)
    setReturnUrl(resolveReturnUrl(route))
    setSubmitError(nextBindingToken ? '' : 40103)
  }, [route])

  const bindingExpired = String(submitError) === '40103'

  async function handleBindSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return

    if (!bindingToken) {
      setSubmitError(40103)
      return
    }

    if (!username || !password) {
      setSubmitError('bind.required')
      return
    }

    setSubmitError('')
    setLoading(true)
    try {
      const result = await authApi.bindExternalAccount({
        bindingToken,
        username,
        password,
      })
      if (result?.code !== 0) {
        setSubmitError(result?.code || 'unknown')
        return
      }
      const bootstrapResult = await store.dispatch('user/bootstrapWithToken', result.data)
      if (!bootstrapResult?.success) {
        navigate(buildInitializationRecoveryLocation(returnUrl))
        return
      }
      navigate(oidcLoginReturnTarget(returnUrl) ?? { path: returnUrl || '/' })
    } finally {
      setLoading(false)
    }
  }

  function backToLogin() {
    navigate({
      path: '/login',
      query:
        returnUrl && returnUrl !== '/'
          ? { error: '40103', redirect: returnUrl }
          : { error: '40103' },
    })
  }

  return (
    <div className="login-page login-page--center">
      <div className="login-page__background" />
      <div className="login-page__container">
        <div className="login-page__language-selector">
          <LanguageSelector />
        </div>
        <div className="login-card login-card--bind">
          <section className="auth-pending-card">
            <div className="auth-pending-card__icon">
              <i className="fa fa-link" />
            </div>
            <h2 className="auth-pending-card__title">
              {i18n.tn('/login', 'bind.title', '绑定平台账号')}
            </h2>
            <p className="auth-pending-card__description">
              {i18n.tn(
                '/login',
                'bind.description',
                '首次使用该外部账号登录时，需要绑定一个已有的平台账号。'
              )}
            </p>
          </section>
          {submitError ? (
            <div className="login-alert login-alert--error">
              <i className="fa fa-exclamation-circle" />
              <span>
                {submitError === 'bind.required'
                  ? i18n.tn('/login', 'bind.required', '请输入平台用户名和密码')
                  : i18n.tn('/login', `error.${submitError}`, mapAuthError(submitError))}
              </span>
            </div>
          ) : null}
          <form className="login-form" onSubmit={(event) => void handleBindSubmit(event)}>
            <div className="login-form-item is-required">
              <label className="login-form-item__label" htmlFor={usernameInputId}>
                {i18n.tn('/login', 'bind.username', '平台用户名')}
              </label>
              <div className="login-form-item__control">
                <div className="login-input">
                  <span className="login-input__prefix">
                    <i className="fa fa-user" />
                  </span>
                  <input
                    value={username}
                    id={usernameInputId}
                    type="text"
                    autoComplete="off"
                    placeholder={i18n.tn(
                      '/login',
                      'bind.usernamePlaceholder',
                      '请输入平台用户名'
                    )}
                    className="login-input__field"
                    onChange={(event) => setUsername(event.currentTarget.value)}
                  />
                </div>
              </div>
            </div>
            <div className="login-form-item is-required">
              <label className="login-form-item__label" htmlFor={passwordInputId}>
                {i18n.tn('/login', 'bind.password', '平台密码')}
              </label>
              <div className="login-form-item__control">
                <div className="login-input">
                  <span className="login-input__prefix">
                    <i className="fa fa-lock" />
                  </span>
                  <input
                    value={password}
                    id={passwordInputId}
                    type="password"
                    autoComplete="off"
                    placeholder={i18n.tn(
                      '/login',
                      'bind.passwordPlaceholder',
                      '请输入平台密码'
                    )}
                    className="login-input__field"
                    onChange={(event) => setPassword(event.currentTarget.value)}
                  />
                </div>
              </div>
            </div>
            {bindingExpired ? (
              <div className="bind-login__hint">
                <button type="button" className="bind-login__link" onClick={backToLogin}>
                  {i18n.tn('/login', 'bind.restart', '返回登录页重新发起外部登录')}
                </button>
              </div>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className={`login-form__button${loading ? ' is-loading' : ''}`}>
              {loading ? (
                <i className="fa fa-spinner login-form__loading" aria-hidden="true" />
              ) : null}
              <span>{i18n.tn('/login', 'bind.submit', '绑定并登录')}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
