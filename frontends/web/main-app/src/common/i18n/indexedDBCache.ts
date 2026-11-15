/**
 * I18n IndexedDB 缓存管理
 * 用于存储大容量语言包（5MB+）
 */
import type { LocaleData } from './types'

interface CacheData {
  locale: string
  data: LocaleData
  timestamp: number
  version?: string
}

export class I18nIndexedDBCache {
  private static readonly DB_NAME = 'i18n-cache'
  private static readonly DB_VERSION = 1
  private static readonly STORE_NAME = 'locales'
  private static readonly CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 天
  private static dbPromise: Promise<IDBDatabase> | null = null

  // 初始化数据库
  private static async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION)

      request.onerror = () => {
        console.error('[I18nIndexedDB] Failed to open database:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // 创建对象存储
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'locale' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          console.log('[I18nIndexedDB] Object store created')
        }
      }
    })

    return this.dbPromise
  }

  // 存储语言数据
  static async set(locale: string, data: LocaleData, version?: string): Promise<void> {
    try {
      const db = await this.getDB()
      const transaction = db.transaction([this.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)

      const cacheData: CacheData = {
        locale,
        data,
        timestamp: Date.now(),
        version
      }

      const request = store.put(cacheData)

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve()
        request.onerror = () => {
          console.error(`[I18nIndexedDB] Failed to cache locale ${locale}:`, request.error)
          reject(request.error)
        }
      })
    } catch (error) {
      console.error(`[I18nIndexedDB] Error caching locale ${locale}:`, error)
    }
  }

  // 读取语言数据
  static async get(locale: string): Promise<LocaleData | null> {
    try {
      const db = await this.getDB()
      const transaction = db.transaction([this.STORE_NAME], 'readonly')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.get(locale)

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const cacheData = request.result as CacheData | undefined
          
          if (!cacheData) {
            resolve(null)
            return
          }

          // 检查是否过期
          const isExpired = Date.now() - cacheData.timestamp > this.CACHE_EXPIRY
          if (isExpired) {
            this.remove(locale)
            resolve(null)
            return
          }

          resolve(cacheData.data)
        }
        request.onerror = () => {
          console.error(`[I18nIndexedDB] Failed to read locale ${locale}:`, request.error)
          resolve(null)
        }
      })
    } catch (error) {
      console.error(`[I18nIndexedDB] Error reading locale ${locale}:`, error)
      return null
    }
  }

  // 删除指定语言缓存
  static async remove(locale: string): Promise<void> {
    try {
      const db = await this.getDB()
      const transaction = db.transaction([this.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)
      store.delete(locale)
      console.log(`[I18nIndexedDB] Removed cache for ${locale}`)
    } catch (error) {
      console.error(`[I18nIndexedDB] Error removing locale ${locale}:`, error)
    }
  }

  // 清空所有缓存
  static async clear(): Promise<void> {
    try {
      const db = await this.getDB()
      const transaction = db.transaction([this.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(this.STORE_NAME)
      store.clear()
      console.log('[I18nIndexedDB] Cleared all cache')
    } catch (error) {
      console.error('[I18nIndexedDB] Error clearing cache:', error)
    }
  }

  // 获取缓存的版本
  static async getVersion(locale: string): Promise<string | null> {
    try {
      const db = await this.getDB()
      const transaction = db.transaction([this.STORE_NAME], 'readonly')
      const store = transaction.objectStore(this.STORE_NAME)
      const request = store.get(locale)

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const cacheData = request.result as CacheData | undefined
          resolve(cacheData?.version || null)
        }
        request.onerror = () => {
          resolve(null)
        }
      })
    } catch (error) {
      return null
    }
  }

  // 检查缓存是否有效
  static async isValid(locale: string, latestVersion: string): Promise<boolean> {
    try {
      const cacheData = await this.get(locale)
      if (!cacheData) return false

      const cachedVersion = await this.getVersion(locale)
      return cachedVersion === latestVersion
    } catch (error) {
      return false
    }
  }

  // localStorage 兼容方法（用于偏好设置）
  static setPreferredLocale(locale: string): void {
    try {
      localStorage.setItem('i18n-preferred-locale', locale)
    } catch (error) {
      console.warn('Failed to save preferred locale:', error)
    }
  }

  static getPreferredLocale(): string | null {
    try {
      return localStorage.getItem('i18n-preferred-locale')
    } catch (error) {
      return null
    }
  }
}
