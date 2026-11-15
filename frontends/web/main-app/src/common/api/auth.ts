import { Client } from '@/utils/http'
import type { ApiResponse } from '@/utils/http'

import type {
  AuthProviderInfo,
  AuthTokenPayload,
  BindExternalAccountPayload,
  BindingRequiredPayload,
  LdapLoginPayload,
} from '@/common/auth/types'

export type ExternalAuthPayload = AuthTokenPayload | BindingRequiredPayload

export async function listProviders(): Promise<ApiResponse<AuthProviderInfo[]>> {
  const response = await Client.get<AuthProviderInfo[] | { items: AuthProviderInfo[] }>(
    '/api/auth/providers',
    {},
    { isSilent: true, skipAuth: true }
  )
  const collection = response.data.data
  return {
    ...response.data,
    data: Array.isArray(collection) ? collection : collection?.items || [],
  }
}

export async function loginWithLdap(
  provider: string,
  payload: LdapLoginPayload
): Promise<ApiResponse<ExternalAuthPayload>> {
  const response = await Client.post<ExternalAuthPayload>(
    `/api/auth/ldap/${provider}/login`,
    payload,
    { isSilent: true, skipAuth: true }
  )
  return response.data
}

export async function exchangeLoginCode(
  loginCode: string
): Promise<ApiResponse<AuthTokenPayload>> {
  const response = await Client.post<AuthTokenPayload>(
    '/api/auth/login-code/exchange',
    {
      loginCode,
    },
    { isSilent: true, skipAuth: true }
  )
  return response.data
}

export async function bindExternalAccount(
  payload: BindExternalAccountPayload
): Promise<ApiResponse<AuthTokenPayload>> {
  const response = await Client.post<AuthTokenPayload>('/api/auth/bind', payload, {
    isSilent: true,
    skipAuth: true,
  })
  return response.data
}

export async function getOidcLoginContext(loginRequestId?: string) {
  const response = await Client.get<{ csrfToken: string; csrfHeader: string }>(
    '/api/auth/oidc/login-context',
    loginRequestId ? { loginRequestId } : {},
    { isSilent: true, skipAuth: true, withCredentials: true }
  )
  return response.data
}

export async function completeOidcLogin(csrfHeader: string, csrfToken: string, loginRequestId?: string) {
  const response = await Client.post<{ redirectUrl: string }>(
    '/api/auth/oidc/session' + (loginRequestId ? '?loginRequestId=' + encodeURIComponent(loginRequestId) : ''),
    {},
    { isSilent: true, withCredentials: true, headers: { [csrfHeader]: csrfToken } }
  )
  return response.data
}

export default {
  getOidcLoginContext,
  completeOidcLogin,
  listProviders,
  loginWithLdap,
  exchangeLoginCode,
  bindExternalAccount,
}
