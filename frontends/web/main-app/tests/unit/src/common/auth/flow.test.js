const assert = require('node:assert/strict')
const path = require('node:path')
const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()
clearMirroredSrcModuleCache(__filename, '.')

const authFlow = requireMirroredSrcModule(__filename, './flow.ts')
const {
  buildCredentialModes,
  buildProviderEntry,
  buildReturnUrl,
  getPreloadedAuthProviders,
  isDirectProvider,
  isRedirectProvider,
  mapAuthError,
  oidcLoginReturnTarget,
  resolveReturnUrl,
  resolveActiveCredentialMode,
  shouldIgnoreProviderDiscoveryError,
  shouldIgnoreProviderDiscoveryResult,
  shouldShowCredentialModeSwitcher,
} = authFlow

const oauthProvider = {
  key: 'oidc-main',
  type: 'oauth2',
  displayName: 'OIDC Main',
  loginUrl: '/api/auth/oauth2/oidc-main/authorize',
  availability: 'healthy',
}

const casProvider = {
  key: 'cas-main',
  type: 'cas',
  displayName: 'CAS Main',
  loginUrl: '/api/auth/cas/cas-main/login',
  availability: 'healthy',
}

const ldapProvider = {
  key: 'corp-ldap',
  type: 'ldap',
  displayName: 'Corp LDAP',
  loginUrl: null,
  availability: 'healthy',
}

test('appends returnUrl for redirect providers', () => {
  assert.equal(
    buildProviderEntry(oauthProvider, '/welcome?tab=home'),
    '/api/auth/oauth2/oidc-main/authorize?returnUrl=%2Fwelcome%3Ftab%3Dhome'
  )
  assert.equal(
    buildProviderEntry(casProvider, '/welcome?tab=home'),
    '/api/auth/cas/cas-main/login?returnUrl=%2Fwelcome%3Ftab%3Dhome'
  )
})

test('treats cas providers as redirect login entries', () => {
  assert.equal(isRedirectProvider(casProvider), true)
  assert.equal(isDirectProvider(casProvider), false)
})

test('keeps ldap providers in direct mode', () => {
  assert.equal(buildProviderEntry(ldapProvider, '/welcome'), null)
  assert.equal(isDirectProvider(ldapProvider), true)
  assert.equal(isRedirectProvider(ldapProvider), false)
})

test('prefers redirect query and sanitizes external returnUrl', () => {
  assert.equal(
    buildReturnUrl({
      path: '/login',
      query: {
        redirect: 'https://evil.example.com/steal',
      },
    }),
    '/'
  )
})

test('falls back to root when login route has no redirect query', () => {
  assert.equal(
    buildReturnUrl({
      path: '/login',
      fullPath: '/login',
      query: {},
    }),
    '/'
  )
})

test('normalizes relative returnUrl inputs', () => {
  assert.equal(resolveReturnUrl('dashboard?tab=todo'), '/dashboard?tab=todo')
})

test('maps binding and login-code errors to auth messages', () => {
  assert.equal(mapAuthError(40103), '绑定凭证已失效，请重新发起外部登录')
  assert.equal(mapAuthError('40105'), '外部登录结果已失效，请重新登录')
  assert.equal(mapAuthError('user-bootstrap-failed'), '用户信息初始化失败，请重新登录')
})

test('ignores provider discovery results when legacy-style backends reject or omit the endpoint', () => {
  assert.equal(
    shouldIgnoreProviderDiscoveryResult({ code: -1, msg: '无法访问（未认证）' }),
    true
  )
  assert.equal(shouldIgnoreProviderDiscoveryResult({ code: 404, msg: 'Not Found' }), true)
  assert.equal(shouldIgnoreProviderDiscoveryResult({ code: 500, msg: '内部错误' }), false)
})

test('ignores provider discovery transport errors when auth provider APIs are unavailable before login', () => {
  assert.equal(
    shouldIgnoreProviderDiscoveryError({
      response: {
        status: 401,
        data: {
          code: -1,
          msg: '无法访问（未认证）',
        },
      },
    }),
    true
  )
  assert.equal(
    shouldIgnoreProviderDiscoveryError({
      response: {
        status: 404,
      },
      message: 'Request failed with status code 404',
    }),
    true
  )
  assert.equal(shouldIgnoreProviderDiscoveryError(new Error('socket hang up')), false)
})

test('prefers auth providers embedded in web-app-info', () => {
  assert.deepEqual(
    getPreloadedAuthProviders({
      authProviders: [oauthProvider],
    }),
    [oauthProvider]
  )
})

test('reads local password toggle from login config and defaults to enabled', () => {
  assert.equal(typeof authFlow.isLocalPasswordLoginEnabled, 'function')
  assert.equal(authFlow.isLocalPasswordLoginEnabled(undefined), true)
  assert.equal(
    authFlow.isLocalPasswordLoginEnabled({
      'security.auth.login.localPassword.enabled': false,
    }),
    false
  )
  assert.equal(
    authFlow.isLocalPasswordLoginEnabled({
      security: {
        auth: {
          login: {
            localPassword: {
              enabled: false,
            },
          },
        },
      },
    }),
    false
  )
})

test('keeps credential form when local login is disabled but ldap is available', () => {
  assert.equal(typeof authFlow.shouldShowCredentialForm, 'function')
  assert.equal(
    authFlow.shouldShowCredentialForm(
      {
        'security.auth.login.localPassword.enabled': false,
      },
      [ldapProvider]
    ),
    true
  )
  assert.equal(
    authFlow.shouldShowCredentialForm(
      {
        'security.auth.login.localPassword.enabled': false,
      },
      [oauthProvider]
    ),
    false
  )
})

test('builds credential modes with local login first when ldap is also available', () => {
  const modes = buildCredentialModes(
    {
      'security.auth.login.localPassword.enabled': true,
    },
    [ldapProvider, oauthProvider]
  )

  assert.deepEqual(
    modes.map((mode) => ({
      key: mode.key,
      type: mode.type,
      providerKey: mode.providerKey,
    })),
    [
      {
        key: 'local',
        type: 'local',
        providerKey: null,
      },
      {
        key: 'ldap:corp-ldap',
        type: 'ldap',
        providerKey: 'corp-ldap',
      },
    ]
  )
})

test('defaults credential mode selection to local when local and ldap are both available', () => {
  const modes = buildCredentialModes(
    {
      'security.auth.login.localPassword.enabled': true,
    },
    [ldapProvider]
  )

  assert.equal(resolveActiveCredentialMode(modes)?.key, 'local')
  assert.equal(
    resolveActiveCredentialMode(modes, 'ldap:corp-ldap')?.key,
    'ldap:corp-ldap'
  )
})

test('shows credential mode switcher only when more than one credential login mode is available', () => {
  const localAndLdapModes = buildCredentialModes(
    {
      'security.auth.login.localPassword.enabled': true,
    },
    [ldapProvider]
  )
  const ldapOnlyModes = buildCredentialModes(
    {
      'security.auth.login.localPassword.enabled': false,
    },
    [ldapProvider]
  )

  assert.equal(shouldShowCredentialModeSwitcher(localAndLdapModes), true)
  assert.equal(shouldShowCredentialModeSwitcher(ldapOnlyModes), false)
})

test('OIDC continuation uses the exact internal route and a separate request ID query', () => {
  assert.deepEqual(oidcLoginReturnTarget('/login/oidc?loginRequestId=req-2&client_id=discarded'), {
    path: '/login/oidc',
    query: { loginRequestId: 'req-2' },
  })
  assert.deepEqual(oidcLoginReturnTarget('/login/oidc'), { path: '/login/oidc' })
  assert.equal(oidcLoginReturnTarget('/login/oidc/consent?loginRequestId=req-2'), null)
  assert.equal(oidcLoginReturnTarget('https://rp.example/login/oidc?loginRequestId=req-2'), null)
})
