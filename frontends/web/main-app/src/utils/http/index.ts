/**
 * API 网络请求封装兼容门面。
 *
 * 对外保持：
 *   export { Client, request, extractErrorMessage, configAxios, getLatestToken }
 */

import axios, { type AxiosInstance } from 'axios'

import { createAuthRuntime } from './authRuntime'
import { createHttpClient } from './client'
import { applyHttpInterceptors } from './interceptors'
import { extractErrorMessage } from './responseUtils'

import type { TokenLike } from './types'

const request = axios.create({
  baseURL:
    (typeof window !== 'undefined' &&
      (window as any).sessionStorage &&
      (window as any).sessionStorage.getItem('apiHost')) ||
    (process.env as any).VUE_APP_API_HOST,
  timeout: 1 * 60 * 1000,
  responseType: 'json',
  responseEncoding: 'utf8',
  headers: { 'Content-Type': 'application/json; charset=UTF-8' },
}) as AxiosInstance

const authRuntime = createAuthRuntime(request)
const isHttpRequestCancel = (error: any): boolean =>
  Boolean((axios as any).isCancel?.(error))
const Client = createHttpClient(request, authRuntime.Auth, isHttpRequestCancel)

applyHttpInterceptors(request, authRuntime.Auth)
authRuntime.scheduleBootTokenRefresh()
authRuntime.setupAuthVisibility()

function configAxios(configer: (instance: AxiosInstance) => void): void {
  configer(request)
}

async function getLatestToken(): Promise<TokenLike | null | undefined> {
  return authRuntime.getLatestToken()
}

export { Client, request, extractErrorMessage, configAxios, getLatestToken }
export type { ApiResponse, RequestConfig, TokenLike } from './types'
