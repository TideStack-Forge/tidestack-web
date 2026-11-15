import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useI18n } from '@/common/i18n/useI18n'
import authApi from '@/common/api/auth'
import {
  buildCredentialModes,
  buildProviderEntry,
  buildReturnUrl,
  getPreloadedAuthProviders,
  isRedirectProvider,
  mapAuthError,
  oidcLoginReturnTarget,
  resolveActiveCredentialMode,
  shouldIgnoreProviderDiscoveryError,
  shouldIgnoreProviderDiscoveryResult,
  shouldShowCredentialModeSwitcher,
} from '@/common/auth/flow'
import type {
  AuthProviderInfo,
  AuthRouteLike,
  CredentialLoginMode,
} from '@/common/auth/types'
import { i18nService } from '@/common/i18n'
import { openMenuAfterLogin, openMenuItem } from '@/common/menus'
import { performPostLoginNavigation } from '@/common/menus/post-login-navigation'
import tabs from '@/common/tabs'
import { getRouteInfo } from '@/router/utils'
import { useHostSnapshot } from '@/layouts/useHostSnapshot'
import { store } from '@/store/storeFacade'
import { LanguageSelector } from '../components/LanguageSelector'

export interface AuthNavigationTarget {
  path: string
  query?: Record<string, any>
}

export interface LoginPageViewProps {
  navigate: (target: AuthNavigationTarget) => void
  route: AuthRouteLike
}

interface LoginFormField {
  value: 'username' | 'password'
  label: string
  required: boolean
  placeholder: string
  showClear: boolean
  icon: string
  type?: string
  error?: boolean
  errorMessage?: string
}

interface LoginModel {
  username: string
  password: string
}

function LoginErrorAlert({
  message,
  type,
}: {
  message: string
  type: 'warning' | 'error'
}) {
  if (!message) {
    return null
  }

  return (
    <div className={`login-alert login-alert--${type}`}>
      <i
        className={`fa ${type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}`}
      />
      <span>{message}</span>
    </div>
  )
}

function ExternalProviderList({
  providers,
  disabled,
  title,
  description,
  onSelect,
}: {
  providers: AuthProviderInfo[]
  disabled: boolean
  title: string
  description: string
  onSelect: (provider: AuthProviderInfo) => void
}) {
  const i18n = useI18n()
  if (!providers.length) {
    return null
  }

  return (
    <section className="external-provider-list">
      {title || description ? (
        <div className="external-provider-list__header">
          {title ? <h3 className="external-provider-list__title">{title}</h3> : null}
          {description ? (
            <p className="external-provider-list__description">{description}</p>
          ) : null}
        </div>
      ) : null}
      {providers.map((provider) => {
        const unavailable = provider.availability !== 'healthy'
        return (
          <button
            key={provider.key}
            type="button"
            className={`external-provider-list__button${unavailable ? ' is-disabled' : ''}`}
            disabled={disabled || unavailable}
            onClick={() => onSelect(provider)}>
            <span>{provider.displayName}</span>
            {unavailable ? (
              <small className="external-provider-list__hint">
                {i18n.tn('/login', 'provider.unavailable', '服务暂不可用')}
              </small>
            ) : null}
          </button>
        )
      })}
    </section>
  )
}

function renderLogo(logo: string) {
  if (logo) {
    return <i className={logo} />
  }

  return <img src={require('@/assets/images/logo.svg')} alt="" />
}

export function LoginPageView({ navigate, route }: LoginPageViewProps) {
  useHostSnapshot()
  const i18n = useI18n()
  const locale = i18n.getLocale()
  const [loading, setLoading] = useState(false)
  const [loadMicroLogin, setLoadMicroLogin] = useState(false)
  const [microLoginError, setMicroLoginError] = useState(false)
  const [providersLoading, setProvidersLoading] = useState(false)
  const [providerLoadError, setProviderLoadError] = useState<{
    code: string
    msg?: string
  } | null>(null)
  const [externalProviders, setExternalProviders] = useState<AuthProviderInfo[]>([])
  const [selectedCredentialModeKey, setSelectedCredentialModeKey] = useState('')
  const [modelLogin, setModelLogin] = useState<LoginModel>({ username: '', password: '' })
  const [loginForm, setLoginForm] = useState<LoginFormField[]>([])
  const microLoginHandleRef = useRef<any>(null)

  const translate = useCallback(
    (key: string, defaultText: string, params?: Record<string, any>) => {
      return i18nService.getManager().tn('/login', key, defaultText, params)
    },
    [locale]
  )

  useEffect(() => {
    function buildLoginFields(): LoginFormField[] {
      return [
        {
          value: 'username',
          label: translate('username.label', '用户名'),
          required: true,
          placeholder: translate('username.placeholder', '请输入用户名'),
          showClear: true,
          icon: 'fa fa-user',
        },
        {
          value: 'password',
          label: translate('password.label', '密码'),
          required: true,
          placeholder: translate('password.placeholder', '请输入密码'),
          type: 'password',
          showClear: true,
          icon: 'fa fa-lock',
        },
      ]
    }

    setLoginForm(buildLoginFields())
  }, [translate])

  const appName = store.getters.appName
  const logo = store.state.app.logo || ''
  const slogan = store.state.app.slogan || ''
  const appConfig = store.getters['app/config'] || {}
  const appInfo = store.state.app.appInfo || {}
  const loginEntry = store.state.app.loginEntry

  useEffect(() => {
    let active = true

    if (!loginEntry) {
      setLoadMicroLogin(false)
      return () => {
        active = false
      }
    }

    setLoadMicroLogin(true)

    async function run() {
      try {
        const { loadMicroApp } = await import('qiankun')
        const { getCommonProps } = await import('@/common/micro/commonProps')
        const { createMicroEntryFetch, ensureSameOriginMicroEntryIsSafe } = await import(
          '@/common/micro/entryGuard'
        )
        const { normalizeMicroEntry } = await import('@/common/micro/utils')
        if (!active) {
          return
        }

        const normalizedEntry = normalizeMicroEntry(loginEntry)
        await ensureSameOriginMicroEntryIsSafe(normalizedEntry)
        if (!active) {
          return
        }

        const microLogin = loadMicroApp(
          {
            name: 'micro-login',
            container: '#micro-login',
            entry: normalizedEntry,
            props: getCommonProps(),
          },
          { fetch: createMicroEntryFetch() }
        )
        microLoginHandleRef.current = microLogin
        await microLogin.mountPromise
      } catch (error) {
        if (!(error as any)?.isUnsafeMicroEntry) {
          console.warn('登录页微应用加载失败', error)
        }
        if (active) {
          setLoadMicroLogin(false)
          setMicroLoginError(true)
        }
      }
    }

    void run()

    return () => {
      active = false
      const microLogin = microLoginHandleRef.current
      microLoginHandleRef.current = null
      if (microLogin) {
        Promise.resolve(microLogin.unmount()).catch((error) => {
          console.warn('登录页微应用卸载失败', error)
        })
      }
    }
  }, [loginEntry])

  useEffect(() => {
    if (loadMicroLogin) {
      return
    }

    const preloadedProviders = getPreloadedAuthProviders(appInfo)
    if (preloadedProviders !== null) {
      setExternalProviders(preloadedProviders)
      return
    }

    let active = true
    setProvidersLoading(true)
    setProviderLoadError(null)

    authApi
      .listProviders()
      .then((result) => {
        if (!active) {
          return
        }
        setProvidersLoading(false)
        if (result?.code !== 0) {
          setExternalProviders([])
          if (shouldIgnoreProviderDiscoveryResult(result)) {
            return
          }
          setProviderLoadError({
            code: String(result?.code || 'unknown'),
            msg: result?.msg,
          })
          return
        }
        setExternalProviders(result?.data || [])
      })
      .catch((error) => {
        if (active) {
          setProvidersLoading(false)
          setExternalProviders([])
          if (shouldIgnoreProviderDiscoveryError(error)) {
            return
          }
          console.warn('外部登录方式加载失败', error)
          setProviderLoadError({ code: 'unknown' })
        }
      })

    return () => {
      active = false
    }
  }, [appInfo, loadMicroLogin])

  const errorCode = Array.isArray(route.query?.error)
    ? route.query?.error[0]
    : route.query?.error
  const loginErrorMessage = errorCode
    ? i18n.tn('/login', `error.${errorCode}`, mapAuthError(errorCode))
    : ''

  const currentReturnUrl = buildReturnUrl(route)
  const credentialModes = useMemo(
    () => buildCredentialModes(appConfig, externalProviders),
    [appConfig, externalProviders]
  )
  const currentCredentialMode = useMemo(
    () => resolveActiveCredentialMode(credentialModes, selectedCredentialModeKey),
    [credentialModes, selectedCredentialModeKey]
  )
  const showCredentialModeSwitcher = shouldShowCredentialModeSwitcher(credentialModes)
  const redirectProviders = externalProviders.filter((provider) =>
    isRedirectProvider(provider)
  )

  useEffect(() => {
    const nextKey =
      resolveActiveCredentialMode(credentialModes, selectedCredentialModeKey)?.key || ''
    if (nextKey !== selectedCredentialModeKey) {
      setSelectedCredentialModeKey(nextKey)
    }
  }, [credentialModes, selectedCredentialModeKey])

  const getCredentialModeLabel = useCallback(
    (mode?: CredentialLoginMode | null) => {
      if (!mode) {
        return ''
      }

      if (mode.type === 'local') {
        return translate('credential.local', '本地账号')
      }

      return mode.providerDisplayName || translate('credential.ldap', 'LDAP 目录')
    },
    [translate]
  )

  const credentialSectionHint = useMemo(() => {
    if (!currentCredentialMode) {
      return ''
    }

    if (currentCredentialMode.type === 'local') {
      return translate('credential.localHint', '请输入平台账号密码进行本地登录')
    }

    return translate(
      'credential.ldapHint',
      '请输入 {{provider}} 的账号密码进行目录认证',
      {
        provider: getCredentialModeLabel(currentCredentialMode),
      }
    )
  }, [currentCredentialMode, getCredentialModeLabel, translate])

  const credentialSubmitText = useMemo(() => {
    if (!currentCredentialMode || !showCredentialModeSwitcher) {
      return translate('button.submit', '登录')
    }

    return currentCredentialMode.type === 'local'
      ? translate('button.submitLocal', '本地登录')
      : translate('button.submitLdap', 'LDAP 登录')
  }, [currentCredentialMode, showCredentialModeSwitcher, translate])

  function setFieldError(fieldValue: 'username' | 'password', errorMessage: string) {
    setLoginForm((previousFields) =>
      previousFields.map((field) =>
        field.value === fieldValue
          ? { ...field, error: Boolean(errorMessage), errorMessage }
          : field
      )
    )
  }

  function handleBlur(field: LoginFormField) {
    const value = modelLogin[field.value]
    if (field.required && !value) {
      setFieldError(
        field.value,
        translate('validation.required', '请输入{{field}}', { field: field.label })
      )
      return
    }

    setFieldError(field.value, '')
  }

  function validateLoginForm() {
    let valid = true
    loginForm.forEach((field) => {
      const value = modelLogin[field.value]
      if (field.required && !value) {
        valid = false
        setFieldError(
          field.value,
          translate('validation.required', '请输入{{field}}', { field: field.label })
        )
      }
    })
    return valid
  }

  async function handlePostLoginRedirect() {
    const redirect = currentReturnUrl
    const oidcReturn = oidcLoginReturnTarget(redirect)
    if (oidcReturn) {
      navigate(oidcReturn)
      return
    }
    const routeInfo = redirect && redirect !== '/' ? getRouteInfo(redirect) : null

    await performPostLoginNavigation({
      preferredPath: redirect,
      preferredMenuPath:
        redirect && redirect !== '/' && store.getters['user/menuGetter'](redirect)
          ? redirect
          : null,
      preferredRoutePath:
        routeInfo && routeInfo.name !== 'notFound' ? routeInfo.path : null,
      menu: store.getters['user/menu'],
      onMenuTarget: (targetPath) => openMenuItem(targetPath),
      onRouteTarget: (targetPath) => tabs.openOrSwitchTab(targetPath),
      onFallbackTarget: () => openMenuAfterLogin(),
    })
  }

  async function handleLogin() {
    if (!validateLoginForm()) {
      return
    }
    setLoading(true)
    const loginResult = await store.dispatch('user/login', modelLogin)
    setLoading(false)
    if (loginResult?.success) {
      await handlePostLoginRedirect()
    }
  }

  async function handleLdapLogin(providerKey: string) {
    if (!validateLoginForm()) {
      return
    }

    setLoading(true)
    const loginResult = await store.dispatch('user/loginWithLdap', {
      provider: providerKey,
      username: modelLogin.username,
      password: modelLogin.password,
    })
    setLoading(false)

    if (loginResult?.bindingRequired && loginResult?.bindingToken) {
      const query: Record<string, string> = { token: loginResult.bindingToken }
      if (currentReturnUrl && currentReturnUrl !== '/') {
        query.returnUrl = currentReturnUrl
      }
      navigate({ path: '/login/bind', query })
      return
    }

    if (loginResult?.success) {
      await handlePostLoginRedirect()
    }
  }

  async function handlePrimarySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentCredentialMode || currentCredentialMode.disabled) {
      return
    }

    if (currentCredentialMode.type === 'local') {
      await handleLogin()
      return
    }

    if (currentCredentialMode.providerKey) {
      await handleLdapLogin(currentCredentialMode.providerKey)
    }
  }

  function startRedirectLogin(provider: AuthProviderInfo) {
    const redirectUrl = buildProviderEntry(provider, currentReturnUrl)
    if (redirectUrl) {
      window.location.assign(redirectUrl)
    }
  }

  if (loadMicroLogin) {
    return (
      <div className="login-page login-page--center">
        <div className="login-page__container">
          <LoginErrorAlert message={loginErrorMessage} type="error" />
          <div id="micro-login" className="login-page__micro" />
        </div>
      </div>
    )
  }

  return (
    <div className="login-page login-page--center">
      <div className="login-page__background" />
      <div className="login-page__container">
        <div className="login-page__language-selector">
          <LanguageSelector />
        </div>
        <div className="login-card">
          <div className="login-card__logo">{renderLogo(logo)}</div>
          <h2 className="login-card__title">{appName}</h2>
          {slogan ? <p className="login-card__slogan">{slogan}</p> : null}
          <p className="login-card__welcome">{translate('welcome', '欢迎使用')}</p>

          <LoginErrorAlert message={loginErrorMessage} type="error" />
          <LoginErrorAlert
            message={
              providerLoadError
                ? providerLoadError.msg ||
                  i18n.tn(
                    '/login',
                    `error.${providerLoadError.code}`,
                    mapAuthError(providerLoadError.code)
                  )
                : ''
            }
            type="warning"
          />
          <LoginErrorAlert
            message={
              microLoginError
                ? translate('microLoginError', '自定义登录页加载失败，已切换到默认登录页')
                : ''
            }
            type="warning"
          />

          {credentialModes.length > 0 ? (
            <section className="login-card__credential-section">
              <div className="login-card__credential-header">
                {showCredentialModeSwitcher ? (
                  <div
                    className="login-mode-switcher"
                    role="tablist"
                    aria-label={translate('credential.switcher', '账号密码登录方式')}>
                    {credentialModes.map((mode) => {
                      const isActive = currentCredentialMode?.key === mode.key
                      return (
                        <button
                          key={mode.key}
                          type="button"
                          role="tab"
                          className={`login-mode-switcher__option${isActive ? ' is-active' : ''}${mode.disabled ? ' is-disabled' : ''}`}
                          aria-selected={isActive ? 'true' : 'false'}
                          disabled={mode.disabled}
                          onClick={() => {
                            if (!mode.disabled) {
                              setSelectedCredentialModeKey(mode.key)
                            }
                          }}>
                          <span>{getCredentialModeLabel(mode)}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
                {showCredentialModeSwitcher && currentCredentialMode ? (
                  <p className="login-card__credential-hint">{credentialSectionHint}</p>
                ) : null}
              </div>

              <form
                className="login-form"
                onSubmit={(event) => void handlePrimarySubmit(event)}>
                {loginForm.map((item) => (
                  <div
                    key={item.value}
                    className={`login-form-item${item.error ? ' is-error' : ''}${item.required ? ' is-required' : ''}`}>
                    <label
                      className="login-form-item__label"
                      htmlFor={`login-${item.value}`}>
                      {item.label}
                    </label>
                    <div className="login-form-item__control">
                      <div className="login-input">
                        {item.icon ? (
                          <span className="login-input__prefix">
                            <i className={item.icon} />
                          </span>
                        ) : null}
                        <input
                          id={`login-${item.value}`}
                          value={modelLogin[item.value]}
                          type={item.type || 'text'}
                          autoComplete="off"
                          placeholder={item.placeholder}
                          className="login-input__field"
                          onBlur={() => handleBlur(item)}
                          onChange={(event) => {
                            const nextValue = event.currentTarget.value
                            setModelLogin((previousModel) => ({
                              ...previousModel,
                              [item.value]: nextValue,
                            }))
                          }}
                        />
                        {item.showClear && modelLogin[item.value] ? (
                          <span className="login-input__suffix">
                            <i
                              className="login-input__clear fa fa-times-circle-o"
                              aria-hidden="true"
                              onClick={() => {
                                setModelLogin((previousModel) => ({
                                  ...previousModel,
                                  [item.value]: '',
                                }))
                                setFieldError(item.value, '')
                              }}
                            />
                          </span>
                        ) : null}
                      </div>
                      {item.error ? (
                        <div className="login-form-item__error">{item.errorMessage}</div>
                      ) : null}
                    </div>
                  </div>
                ))}
                <button
                  type="submit"
                  disabled={
                    loading || !currentCredentialMode || currentCredentialMode.disabled
                  }
                  className={`login-form__button${loading ? ' is-loading' : ''}`}>
                  {loading ? (
                    <i className="fa fa-spinner login-form__loading" aria-hidden="true" />
                  ) : null}
                  <span>{credentialSubmitText}</span>
                </button>
              </form>
            </section>
          ) : null}

          {providersLoading ? (
            <p className="login-card__provider-loading">
              {translate('provider.loading', '正在加载外部登录方式...')}
            </p>
          ) : null}
          {credentialModes.length > 0 && redirectProviders.length ? (
            <div className="login-card__divider">
              <span>{translate('divider.sso', '单点登录')}</span>
            </div>
          ) : null}
          <ExternalProviderList
            providers={redirectProviders}
            disabled={loading}
            title={credentialModes.length > 0 ? '' : translate('sso.title', '单点登录')}
            description={translate(
              'sso.description',
              '通过 OAuth2、CAS 或 OIDC 跳转到企业认证系统完成登录。'
            )}
            onSelect={startRedirectLogin}
          />
        </div>
      </div>
    </div>
  )
}
