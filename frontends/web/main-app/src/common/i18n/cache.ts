/**
 * I18n 缓存管理
 */
import type { LocaleData } from './types'

interface CacheData {
  data: LocaleData
  timestamp: number
}

export class I18nCache {
  static readonly CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 天
  static readonly ENABLE_CACHE = false // 禁用缓存，语言包太大（5MB+）超过 localStorage 限制

  // 存储语言数据（包含 timestamp）
  static set(locale: string, data: LocaleData): void {
    if (!this.ENABLE_CACHE) {
      console.log(`[I18nCache] Cache disabled, skipping ${locale}`)
      return
    }
    
    const cacheData: CacheData = {
      data,
      timestamp: Date.now()
    }
    const jsonString = JSON.stringify(cacheData)
    const sizeInKB = (jsonString.length / 1024).toFixed(2)
    
    console.log(`[I18nCache] Attempting to cache locale ${locale}, size: ${sizeInKB} KB`)
    
    try {
      localStorage.setItem(`i18n-locale-${locale}`, jsonString)
      console.log(`[I18nCache] Successfully cached locale ${locale}`)
    } catch (error) {
      console.error(`[I18nCache] Failed to cache locale ${locale}:`, error)
      // 如果是 QuotaExceededError，尝试清理所有旧缓存
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[I18nCache] localStorage quota exceeded, clearing ALL old cache...')
        this.clearAllLocaleCache()
        // 重试一次
        try {
          localStorage.setItem(`i18n-locale-${locale}`, jsonString)
          console.log(`[I18nCache] Retry successful for locale ${locale}`)
        } catch (retryError) {
          console.error(`[I18nCache] Retry failed, locale ${locale} will not be cached. Size: ${sizeInKB} KB`)
          // 不抛出错误，允许应用继续运行（只是不缓存）
        }
      }
    }
  }

  // 清理所有语言缓存
  private static clearAllLocaleCache(): void {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('i18n-locale-')) {
          localStorage.removeItem(key)
          console.log(`[I18nCache] Removed cache: ${key}`)
        }
      })
    } catch (error) {
      console.error('[I18nCache] Failed to clear cache:', error)
    }
  }

  // 读取语言数据
  static get(locale: string): LocaleData | null {
    if (!this.ENABLE_CACHE) {
      return null
    }
    
    try {
      const cached = localStorage.getItem(`i18n-locale-${locale}`)
      if (!cached) return null

      const cacheData: CacheData = JSON.parse(cached)
      return cacheData.data
    } catch (error) {
      console.warn('Failed to read cached locale data:', error)
      return null
    }
  }

  // 删除指定语言缓存
  static remove(locale: string): void {
    try {
      localStorage.removeItem(`i18n-locale-${locale}`)
    } catch (error) {
      console.warn('Failed to remove cached locale data:', error)
    }
  }

  // 清空所有缓存
  static clear(): void {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith('i18n-locale-') || key === 'i18n-versions' || key === 'i18n-preferred-locale') {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.warn('Failed to clear cache:', error)
    }
  }

  // 设置用户偏好语言
  static setPreferredLocale(locale: string): void {
    try {
      localStorage.setItem('i18n-preferred-locale', locale)
    } catch (error) {
      console.warn('Failed to save preferred locale:', error)
    }
  }

  // 获取用户偏好语言
  static getPreferredLocale(): string | null {
    try {
      return localStorage.getItem('i18n-preferred-locale')
    } catch (error) {
      console.warn('Failed to read preferred locale:', error)
      return null
    }
  }

  // 设置语言版本
  static setVersion(locale: string, version: string): void {
    try {
      const versions = JSON.parse(localStorage.getItem('i18n-versions') || '{}')
      versions[locale] = version
      localStorage.setItem('i18n-versions', JSON.stringify(versions))
    } catch (error) {
      console.warn('Failed to save locale version:', error)
    }
  }

  // 获取语言版本
  static getVersion(locale: string): string | null {
    try {
      const versions = JSON.parse(localStorage.getItem('i18n-versions') || '{}')
      return versions[locale] || null
    } catch (error) {
      console.warn('Failed to read locale version:', error)
      return null
    }
  }

  // 检查缓存是否有效（版本 + 时间双重检查）
  static isValid(locale: string, latestVersion: string): boolean {
    try {
      const cached = localStorage.getItem(`i18n-locale-${locale}`)
      if (!cached) return false

      const cacheData: CacheData = JSON.parse(cached)

      // 1. 检查时间是否过期
      const isExpired = Date.now() - cacheData.timestamp > this.CACHE_EXPIRY
      if (isExpired) return false

      // 2. 检查版本是否匹配
      const cachedVersion = this.getVersion(locale)
      if (cachedVersion !== latestVersion) return false

      return true
    } catch (error) {
      console.warn('Failed to validate cache:', error)
      return false
    }
  }
}
