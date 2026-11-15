import type { AxiosRequestConfig } from 'axios'

// 统一业务响应结构
export interface ApiResponse<T = any> {
  code: number
  httpStatus?: number
  status: number
  msg: string
  data: T
}

// 允许扩展的请求配置
export interface RequestConfig extends AxiosRequestConfig {
  isSilent?: boolean
  throwOnError?: boolean
  skipAuth?: boolean
  authRefreshRetry?: boolean
}

export type AnyObj = Record<string, any>

// 令牌对象的宽松描述（驼峰/下划线均可；子对象亦可能有这些字段）
export interface TokenLike extends AnyObj {
  accessToken?: string | AnyObj
  access_token?: string | AnyObj
  refreshToken?: string | AnyObj
  refresh_token?: string | AnyObj

  expiresAt?: number
  expires_at?: number
  expiresTime?: number
  expires_time?: number
  expiresIn?: number
  expires_in?: number
  issuedAt?: number
  issued_at?: number
  loginTime?: number
  login_time?: number
  updateTime?: number
  update_time?: number

  refreshTokenExpiresAt?: number
  refresh_token_expires_at?: number
  refreshTokenExpiresTime?: number
  refresh_token_expires_time?: number
  refreshTokenExpiresIn?: number
  refresh_token_expires_in?: number
  refreshExpiresAt?: number
  refresh_expires_at?: number
  refreshExpiresTime?: number
  refresh_expires_time?: number
  refreshExpiresIn?: number
  refresh_expires_in?: number

  refreshTokenIssuedAt?: number
  refresh_token_issued_at?: number
}
