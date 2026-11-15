import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

import { i18nService } from '@/common/i18n'
import toast from '@/utils/toast'

import type { AuthRuntime } from './authRuntime'
import {
  extractErrorMessage,
  isApiErrorResponse,
  extractFileNameFromContentDisposition,
  readResponseFile,
  remapResponse,
} from './responseUtils'
import type { AnyObj, ApiResponse, RequestConfig } from './types'

type IsHttpRequestCancel = (error: any) => boolean

function stripAuthorizationHeader(config: RequestConfig): RequestConfig {
  if (!config.headers) return config
  const headers = { ...(config.headers as AnyObj) }
  delete headers.Authorization
  delete headers.authorization
  return { ...config, headers }
}

export function createHttpClient(
  httpClient: AxiosInstance,
  Auth: AuthRuntime,
  isHttpRequestCancel: IsHttpRequestCancel
) {
  const Client = {
    async get<T = any>(url: string, params?: any, config?: RequestConfig) {
      return await Client.request<T>('get', url, params, config)
    },
    async put<T = any>(url: string, data?: any, config?: RequestConfig) {
      return await Client.request<T>('put', url, data, config)
    },
    async delete<T = any>(url: string, data?: any, config?: RequestConfig) {
      return await Client.request<T>('delete', url, data, config)
    },
    async patch<T = any>(url: string, data?: any, config?: RequestConfig) {
      return await Client.request<T>('patch', url, data, config)
    },
    async post<T = any>(url: string, data?: any, config?: RequestConfig) {
      return await Client.request<T>('post', url, data, config)
    },
    async upload<T = any>(url: string, data?: any, config?: RequestConfig) {
      return await Client.request<T>('upload', url, data, config)
    },

    async request<T = any>(
      method: 'get' | 'put' | 'delete' | 'patch' | 'post' | 'upload',
      url: string,
      data?: any,
      config?: RequestConfig
    ): Promise<AxiosResponse<ApiResponse<T>>> {
      const requestConfig = (config || {}) as RequestConfig
      const { isSilent, throwOnError, authRefreshRetry, ...axiosConfig } = requestConfig
      try {
        data = data === undefined ? {} : data
        if (method === 'upload') method = 'post'

        const api = url.replace(/^\/+/g, '')
        const setting: RequestConfig = { url: api, ...axiosConfig, method }
        if (method === 'get') (setting as any).params = data
        else (setting as any).data = data

        let res = await httpClient.request<any>(setting as AxiosRequestConfig)

        res = remapResponse(res)

        if (res?.data instanceof Blob) {
          const contentType = res.headers['content-type'] || ''
          const contentDisposition = res.headers['content-disposition'] || ''
          const resolvedDownloadFileName =
            (config as any)?.downloadFileName ||
            extractFileNameFromContentDisposition(contentDisposition)
          const isAttachmentResponse =
            !!resolvedDownloadFileName || /attachment/i.test(contentDisposition)

          if (!isAttachmentResponse && contentType.includes('application/json')) {
            const errorData = await readResponseFile(res.data).catch((cause: unknown) => {
              const msg = '下载响应不是有效的 JSON'
              throw Object.assign(new Error(msg, { cause }), {
                response: { ...res, data: { code: -1, msg, data: null } },
              })
            })
            const errMsg =
              errorData?.msg ||
              errorData?.message ||
              i18nService
                .getManager()
                .tCommon('http.requestFailed', '请求失败，请稍后重试')
            const resObj: AxiosResponse<ApiResponse<T>> = {
              ...res,
              data: {
                code: errorData?.code ?? -1,
                status: errorData?.status ?? errorData?.code ?? -1,
                msg: errMsg,
                data: errorData?.data ?? null,
              },
            }
            if (throwOnError) throw Object.assign(new Error(errMsg), { response: resObj })
            if (!isSilent) toast.error(errMsg)
            return resObj
          }

          const fileName = resolvedDownloadFileName || `download_${Date.now()}`

          if ((config as any)?.noSave !== false) {
            const url = window.URL.createObjectURL(res.data)
            const link = document.createElement('a')
            link.href = url
            link.download = fileName
            link.style.display = 'none'

            document.body.appendChild(link)
            link.click()

            setTimeout(() => {
              document.body.removeChild(link)
              window.URL.revokeObjectURL(url)
            }, 100)
          }

          return {
            ...res,
            data: {
              code: 0,
              status: 0,
              msg: i18nService
                .getManager()
                .tCommon('http.downloadSuccess', '文件下载成功'),
              data: {
                fileName,
                fileContent: res.data,
                fileSize: res.data.size,
                fileType: res.data.type,
              } as any,
            },
          } as AxiosResponse<ApiResponse<T>>
        }

        if (
          res.status >= 200 &&
          res.status < 300 &&
          (res.data === undefined || res.data === null || res.data === '')
        ) {
          ;(res as AxiosResponse<ApiResponse<T>>).data = {
            code: 0,
            status: 0,
            msg: '',
            data: { httpStatus: res.status } as any,
          }
          return res as AxiosResponse<ApiResponse<T>>
        }

        {
          const raw: AnyObj = (res.data as any) || {}
          const code = raw.code ?? raw.status ?? 0
          const msg =
            raw.msg ??
            raw.message ??
            raw.errorMsg ??
            raw.error_message ??
            raw.errMsg ??
            ''
          const normData = (raw.data !== undefined ? raw.data : null) as T
          ;(res as AxiosResponse<ApiResponse<T>>).data = {
            code,
            status: code,
            msg,
            data: normData,
          }
        }

        return res as AxiosResponse<ApiResponse<T>>
      } catch (requestError: any) {
        let error = requestError
        if (isHttpRequestCancel(error)) {
          throw error
        }

        let httpStatus: number | undefined = error?.response?.status
        const sameOrigin401 =
          httpStatus === 401 &&
          (() => {
            try {
              const requestUrlStr = error.request?.responseURL || ''
              const requestUrl = new URL(
                requestUrlStr,
                typeof window !== 'undefined' ? window.location.href : ''
              )
              return (
                requestUrl.host &&
                typeof window !== 'undefined' &&
                requestUrl.host === window.location.host
              )
            } catch {
              return false
            }
          })()

        if (sameOrigin401 && !axiosConfig.skipAuth && !authRefreshRetry) {
          try {
            const tokenObj = await Auth.Store.getToken()
            if (tokenObj) {
              const refreshedToken = await Auth.Refresh.refresh(tokenObj)
              if (refreshedToken) {
                return await Client.request<T>(method, url, data, {
                  ...stripAuthorizationHeader(requestConfig),
                  authRefreshRetry: true,
                })
              }
            }
          } catch (refreshError: any) {
            error = refreshError
            httpStatus = refreshError?.response?.status
          }
        }

        if (sameOrigin401 && httpStatus === 401 && !axiosConfig.skipAuth) {
          toast.warning(
            i18nService
              .getManager()
              .tCommon('auth.sessionExpired', '登录已过期，请重新登录')
          )
          Auth.Store.logout()
        }

        const resObj: AxiosResponse<ApiResponse<T>> =
          error.response ||
          ({ status: httpStatus || -1, headers: {}, config: error.config } as any)

        const msg = extractErrorMessage(error)
        if (msg && !isSilent) {
          toast.error(msg)
        }
        const body = error.response?.data
        const errCode = isApiErrorResponse(body) ? body.code : (httpStatus ?? -1)
        resObj.data = {
          code: errCode,
          status: errCode,
          msg,
          data: isApiErrorResponse(body) ? (body.data ?? null) : null,
          httpStatus,
        }
        if (throwOnError)
          throw Object.assign(new Error(msg, { cause: error }), { response: resObj })
        return resObj
      }
    },
  }

  return Client
}
