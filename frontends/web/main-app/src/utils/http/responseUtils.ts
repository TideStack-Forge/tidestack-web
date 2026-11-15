import { i18nService } from '@/common/i18n'
import type { AxiosResponse } from 'axios'

import type { AnyObj } from './types'

export function extractFileNameFromContentDisposition(cd?: string | null): string | null {
  if (!cd) return null
  const star = cd.match(/filename\*\s*=\s*([^']*)''([^;]+)/i)
  if (star && star[2]) {
    try {
      return decodeURIComponent(star[2])
    } catch {
      return star[2]
    }
  }
  const normal = cd.match(/filename\s*=\s*("?)([^";]+)\1/i)
  if (normal && normal[2]) {
    try {
      return decodeURIComponent(normal[2])
    } catch {
      return normal[2]
    }
  }
  return null
}

/** 兼容 remapResponse：Blob 放行；code→status；数组挪到 data.items */
export function remapResponse<T = any>(res: AxiosResponse<T>): AxiosResponse<any> {
  const data: any = (res as any)?.data
  if (typeof Blob !== 'undefined' && data instanceof Blob) return res

  const out: AxiosResponse<any> = { ...(res as any) }
  out.data = data || {}
  const body: AnyObj = out.data

  if (body && body.status === undefined && body.code !== undefined) {
    body.status = body.code
  }

  if (Array.isArray(body?.data)) {
    body.data = { items: body.data }
  }

  if (Array.isArray(body?.items)) {
    body.data = { ...(body.data || {}), items: body.items }
  }

  return out
}

export function isApiErrorResponse(
  body: any
): body is { code: number; msg: string; data?: any } {
  return (
    body != null &&
    typeof body === 'object' &&
    typeof body.code === 'number' &&
    typeof body.msg === 'string'
  )
}

export function extractErrorMessage(error: any): string {
  const body = error?.response?.data
  if (isApiErrorResponse(body) && body.msg) return body.msg
  const manager = i18nService.getManager()
  if (error?.code === 'ECONNABORTED')
    return manager.tCommon('http.timeout', '请求超时，请稍后重试')
  const status = error?.response?.status
  if (status === 401)
    return manager.tCommon('auth.sessionExpired', '登录已过期，请重新登录')
  if (status === 403) return manager.tCommon('http.forbidden', '无权限')
  if (status >= 500)
    return manager.tCommon('http.unavailable', '服务暂时不可用，请稍后重试')
  if (!error?.response)
    return manager.tCommon('http.networkError', '网络连接失败，请稍后重试')
  return manager.tCommon('http.requestFailed', '请求失败，请稍后重试')
}

export function readResponseFile(file: Blob): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        resolve(JSON.parse((e.target as FileReader).result as string))
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = (e) => reject(e)
    reader.readAsText(file)
  })
}
