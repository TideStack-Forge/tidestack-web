export type AuthProviderType = 'ldap' | 'oauth2' | 'cas'

export type CredentialLoginModeType = 'local' | 'ldap'

export type AuthProviderAvailability = 'healthy' | 'unhealthy-runtime'

export interface AuthProviderInfo {
  key: string
  type: AuthProviderType
  displayName: string
  loginUrl: string | null
  availability: AuthProviderAvailability
}

export interface CredentialLoginMode {
  key: string
  type: CredentialLoginModeType
  providerKey: string | null
  providerDisplayName: string | null
  disabled: boolean
}

export interface AuthRouteLike {
  path?: string
  fullPath?: string
  query?: Record<string, string | string[] | null | undefined>
}

export interface LdapLoginPayload {
  username: string
  password: string
}

export interface BindExternalAccountPayload {
  bindingToken: string
  username: string
  password: string
}

export interface AuthTokenPayload {
  accessToken: any
  refreshToken: any
  [key: string]: any
}

export interface BindingRequiredPayload {
  bindingToken: string
}
