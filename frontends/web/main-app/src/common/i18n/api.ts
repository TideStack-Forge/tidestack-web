/**
 * I18n API 接口封装
 */
import type { LocaleData, LanguageOption, ApiResponse } from './types'

// Client 类型定义
interface HttpClient {
  get<T = any>(url: string, params?: any, config?: any): Promise<{ data: ApiResponse<T> }>
}

export class I18nApi {
  private httpClient: HttpClient

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient
  }

  // 获取语言列表
  async getLanguages(): Promise<LanguageOption[]> {
    const response = await this.httpClient.get<{ items: LanguageOption[] }>(
      '/api/i18n/languages',
      {},
      { isSilent: true, skipAuth: true }
    )
    return response.data.data?.items || []
  }

  // 获取语言环境数据
  async getLocale(locale: string): Promise<LocaleData> {
    const response = await this.httpClient.get<LocaleData>(
      `/api/i18n/locale/${locale}`,
      {},
      { isSilent: true, skipAuth: true }
    )
    if (!response.data.data) {
      throw new Error(`Failed to load locale: ${locale}`)
    }
    return response.data.data
  }
}
