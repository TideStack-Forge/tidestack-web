import type { AuthProviderInfo, AuthRouteLike, CredentialLoginMode } from './types'

const LOCAL_CREDENTIAL_MODE_KEY = 'local'
const IGNORABLE_PROVIDER_DISCOVERY_STATUSES = new Set([401, 403, 404])
const IGNORABLE_PROVIDER_DISCOVERY_CODES = new Set(['-1', '401', '403', '404'])
export const USER_BOOTSTRAP_ERROR_REASON = 'user-bootstrap-failed'

function matchesIgnorableProviderDiscoveryMessage(message?: string | null): boolean {
  return /未认证|未登录|未授权|无法访问|unauthorized|forbidden|not\s+found|404/i.test(
    `${message || ''}`
  )
}

function getQueryValue(value?: string | string[] | null): string {
  if (Array.isArray(value)) {
    return value[0] || ''
  }
  return value || ''
}

function stripOrigin(candidate: string): string {
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(candidate)) {
    try {
      const target = new URL(candidate)
      if (typeof window !== 'undefined' && target.origin === window.location.origin) {
        return `${target.pathname}${target.search}${target.hash}` || '/'
      }
      return '/'
    } catch (error) {
      return '/'
    }
  }
  return candidate
}

function resolveBooleanValue(value: any, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    if (value === 'true') {
      return true
    }
    if (value === 'false') {
      return false
    }
  }
  return defaultValue
}

export function resolveReturnUrl(input?: string | AuthRouteLike | null): string {
  if (input && typeof input === 'object') {
    const redirect = getQueryValue(input.query?.redirect)
    const returnUrl = getQueryValue(input.query?.returnUrl)
    return resolveReturnUrl(redirect || returnUrl || '/')
  }

  const rawValue = `${input || ''}`.trim()
  if (!rawValue) {
    return '/'
  }

  let normalized = rawValue
  try {
    normalized = decodeURIComponent(rawValue)
  } catch (error) {
    normalized = rawValue
  }

  normalized = stripOrigin(normalized)

  if (!normalized || normalized.startsWith('//')) {
    return '/'
  }

  if (normalized.startsWith('/')) {
    return normalized
  }

  try {
    const target = new URL(`/${normalized.replace(/^\.?\//, '')}`, 'http://localhost')
    return `${target.pathname}${target.search}${target.hash}` || '/'
  } catch (error) {
    return '/'
  }
}

export function buildInitializationRecoveryLocation(returnUrl: string) {
  return {
    path: '/errorAfterLogin',
    query: { fullscreen: 'true', redirect: resolveReturnUrl(returnUrl) },
  }
}

/** The router expects an object target to carry query parameters separately from its path. */
export function oidcLoginReturnTarget(returnUrl: string) {
  const path = '/login/oidc'
  if (returnUrl !== path && !returnUrl.startsWith(path + '?')) return null
  const requestId = new URLSearchParams(returnUrl.slice(path.length)).get('loginRequestId')
  return {
    path,
    ...(requestId ? { query: { loginRequestId: requestId } } : {}),
  }
}

export function buildReturnUrl(route?: AuthRouteLike | null): string {
  return resolveReturnUrl(route)
}

export function getPreloadedAuthProviders(
  appInfo?: Record<string, any> | null
): AuthProviderInfo[] | null {
  if (!appInfo || !Object.prototype.hasOwnProperty.call(appInfo, 'authProviders')) {
    return null
  }
  return Array.isArray(appInfo.authProviders) ? appInfo.authProviders : []
}

export function isRedirectProvider(provider?: AuthProviderInfo | null): boolean {
  return provider?.type === 'oauth2' || provider?.type === 'cas'
}

export function isDirectProvider(provider?: AuthProviderInfo | null): boolean {
  return provider?.type === 'ldap'
}

export function isLocalPasswordLoginEnabled(
  config?: Record<string, any> | null
): boolean {
  if (!config) {
    return true
  }

  if (
    Object.prototype.hasOwnProperty.call(
      config,
      'security.auth.login.localPassword.enabled'
    )
  ) {
    return resolveBooleanValue(config['security.auth.login.localPassword.enabled'], true)
  }

  return resolveBooleanValue(config?.security?.auth?.login?.localPassword?.enabled, true)
}

export function shouldShowCredentialForm(
  config?: Record<string, any> | null,
  providers?: AuthProviderInfo[] | null
): boolean {
  if (isLocalPasswordLoginEnabled(config)) {
    return true
  }

  return (
    Array.isArray(providers) && providers.some((provider) => isDirectProvider(provider))
  )
}

export function buildCredentialModes(
  config?: Record<string, any> | null,
  providers?: AuthProviderInfo[] | null
): CredentialLoginMode[] {
  const localModes: CredentialLoginMode[] = isLocalPasswordLoginEnabled(config)
    ? [
        {
          key: LOCAL_CREDENTIAL_MODE_KEY,
          type: 'local',
          providerKey: null,
          providerDisplayName: null,
          disabled: false,
        },
      ]
    : []
  const providerModes: CredentialLoginMode[] = Array.isArray(providers)
    ? providers
        .filter((provider) => isDirectProvider(provider))
        .map((provider) => ({
          key: `ldap:${provider.key}`,
          type: 'ldap',
          providerKey: provider.key,
          providerDisplayName: provider.displayName || null,
          disabled: provider.availability !== 'healthy',
        }))
    : []

  return [...localModes, ...providerModes]
}

export function resolveActiveCredentialMode(
  modes?: CredentialLoginMode[] | null,
  preferredKey?: string | null
): CredentialLoginMode | null {
  if (!Array.isArray(modes) || !modes.length) {
    return null
  }

  if (preferredKey) {
    const preferredMode = modes.find(
      (mode) => mode.key === preferredKey && !mode.disabled
    )
    if (preferredMode) {
      return preferredMode
    }
  }

  const localMode = modes.find(
    (mode) => mode.key === LOCAL_CREDENTIAL_MODE_KEY && !mode.disabled
  )
  if (localMode) {
    return localMode
  }

  const firstEnabledMode = modes.find((mode) => !mode.disabled)
  if (firstEnabledMode) {
    return firstEnabledMode
  }

  return modes[0]
}

export function shouldShowCredentialModeSwitcher(
  modes?: CredentialLoginMode[] | null
): boolean {
  return Array.isArray(modes) && modes.length > 1
}

export function buildProviderEntry(
  provider: AuthProviderInfo,
  returnUrl: string
): string | null {
  if (!isRedirectProvider(provider) || !provider.loginUrl) {
    return null
  }

  const target = new URL(provider.loginUrl, 'http://localhost')
  target.searchParams.set('returnUrl', resolveReturnUrl(returnUrl))
  return `${target.pathname}${target.search}${target.hash}`
}

export function shouldIgnoreProviderDiscoveryResult(
  result?: {
    code?: string | number
    msg?: string | null
  } | null
): boolean {
  if (!result) {
    return false
  }

  const code = `${result.code ?? ''}`
  if (IGNORABLE_PROVIDER_DISCOVERY_CODES.has(code)) {
    return true
  }

  return matchesIgnorableProviderDiscoveryMessage(result.msg)
}

export function shouldIgnoreProviderDiscoveryError(error?: any): boolean {
  const status = Number(error?.response?.status || error?.status || 0)
  if (IGNORABLE_PROVIDER_DISCOVERY_STATUSES.has(status)) {
    return true
  }

  const responseCode = `${error?.response?.data?.code ?? error?.data?.code ?? ''}`
  if (IGNORABLE_PROVIDER_DISCOVERY_CODES.has(responseCode)) {
    return true
  }

  const message =
    error?.response?.data?.msg ||
    error?.data?.msg ||
    error?.message ||
    error?.response?.statusText ||
    ''
  return matchesIgnorableProviderDiscoveryMessage(message)
}

export function mapAuthError(code?: string | number): string {
  switch (`${code || ''}`) {
    case '40101':
      return '外部身份校验失败，请重新登录'
    case '40102':
      return '外部登录状态已失效，请重新发起登录'
    case '40103':
      return '绑定凭证已失效，请重新发起外部登录'
    case '40104':
      return '平台账号或密码错误'
    case '40105':
      return '外部登录结果已失效，请重新登录'
    case USER_BOOTSTRAP_ERROR_REASON:
      return '用户信息初始化失败，请重新登录'
    case '40106':
      return '该平台账号当前不可用，请联系管理员'
    case '40301':
      return '本地账号密码登录已禁用'
    case '40901':
      return '首次使用该外部账号登录，需要绑定平台账号'
    case '40902':
      return '当前外部账号已绑定其他平台账号'
    case '42901':
      return '绑定操作过于频繁，请稍后再试'
    case '50201':
      return '外部认证服务当前不可用'
    default:
      return '登录失败，请稍后再试'
  }
}
