/**
 * I18n 统一导出接口
 */
import { EventBus } from '@/common/eventBus'
import { Client } from '@/utils/http'
import { I18nManager } from './I18nManager'
import { I18nService } from './I18nService'
import { I18nIndexedDBCache } from './indexedDBCache'
import { I18nApi } from './api'

// 创建单例实例
const i18nManager = new I18nManager(EventBus)
const i18nApi = new I18nApi(Client)
const i18nService = new I18nService(i18nManager, i18nApi)

// 开发模式调试工具
if (process.env.NODE_ENV === 'development') {
  (window as any).$i18nDebug = {
    getLocale: () => i18nManager.getLocale(),
    getMessages: () => i18nManager.getLocaleData()?.messages,
    test: (key: string, params?: any) => i18nManager.t(key, params),
    switchTo: (locale: string) => i18nService.switchLanguage(locale),
    clearCache: () => I18nIndexedDBCache.clear(),
    showMissingKeys: () => Array.from(i18nManager.missingKeys || [])
  }
}

// 导出单例
export { i18nService, i18nManager, I18nIndexedDBCache }

// 导出类型
export * from './types'
