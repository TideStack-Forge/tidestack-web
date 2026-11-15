/**
 * I18n 核心管理类
 */
import type { EventBusType } from '@/common/eventBus'
import type { LocaleData, Messages } from './types'

export class I18nManager {
  private locale: string = 'zh-CN'
  private localeData: LocaleData | null = null
  private eventBus: EventBusType
  public missingKeys: Set<string> = new Set()

  constructor(eventBus: EventBusType) {
    this.eventBus = eventBus
  }

  // 设置语言环境（触发 locale-changed 事件）
  setLocale(localeData: LocaleData): void {
    this.locale = localeData.locale
    this.localeData = localeData
    this.eventBus.publish('locale-changed', {
      locale: localeData.locale,
      localeData: localeData
    })
  }

  // 获取当前语言代码
  getLocale(): string {
    return this.locale
  }

  // 获取完整语言数据
  getLocaleData(): LocaleData | null {
    return this.localeData
  }

  // 通用翻译方法（自动查找 primaryKey）
  t(key: string, defaultTextOrParams?: string | Record<string, any>, params?: Record<string, any>): string {
    // 参数类型检测
    let defaultText: string | undefined
    let actualParams: Record<string, any> | undefined
    
    if (typeof defaultTextOrParams === 'object' && defaultTextOrParams !== null) {
      // 向后兼容: 第二个参数是对象，视为 params
      actualParams = defaultTextOrParams
    } else if (typeof defaultTextOrParams === 'string') {
      // 新用法: 第二个参数是字符串，视为 defaultText
      defaultText = defaultTextOrParams
      actualParams = params
    }
    
    const messages = this.localeData?.messages || {}
    
    // 1. 全局匹配
    for (const [primaryKey, secondaryMessages] of Object.entries(messages)) {
      if (secondaryMessages[key]) {
        return actualParams ? this.interpolate(secondaryMessages[key], actualParams) : secondaryMessages[key]
      }
    }
    
    // 2. 拆分 key 查找
    const parts = key.split('.')
    if (parts.length >= 2) {
      const primaryKey = parts[0]
      const secondaryKey = parts.slice(1).join('.')
      const text = messages[primaryKey]?.[secondaryKey] ?? messages['common']?.[secondaryKey]
      if (text) {
        return actualParams ? this.interpolate(text, actualParams) : text
      }
    }
    
    // 3. 如果提供了 defaultText，尝试 common 降级
    if (defaultText) {
      const text = messages.common?.[defaultText]
      if (text) {
        return actualParams ? this.interpolate(text, actualParams) : text
      }
      // 返回 defaultText
      return actualParams ? this.interpolate(defaultText, actualParams) : defaultText
    }
    
    // 4. fallback
    if (process.env.NODE_ENV === 'development') {
      this.missingKeys.add(key)
    }
    return key
  }

  // 指定 namespace 的翻译方法
  tn(namespace: string, key: string, defaultTextOrParams?: string | Record<string, any>, params?: Record<string, any>): string {
    // 参数类型检测
    let defaultText: string | undefined
    let actualParams: Record<string, any> | undefined
    
    if (typeof defaultTextOrParams === 'object' && defaultTextOrParams !== null) {
      // 向后兼容: 第三个参数是对象，视为 params
      actualParams = defaultTextOrParams
    } else if (typeof defaultTextOrParams === 'string') {
      // 新用法: 第三个参数是字符串，视为 defaultText
      defaultText = defaultTextOrParams
      actualParams = params
    }
    
    const messages = this.localeData?.messages || {}
    
    // 1. 查找 messages[namespace][key]
    let text = messages[namespace]?.[key] ?? messages['common']?.[key]
    if (text) {
      return actualParams ? this.interpolate(text, actualParams) : text
    }

    // 2. 如果提供了 defaultText，先查当前命名空间，再查 common
    if (defaultText) {
      text = messages[namespace]?.[defaultText] || messages.common?.[defaultText]
      if (text) {
        return actualParams ? this.interpolate(text, actualParams) : text
      }
      // 返回 defaultText
      return actualParams ? this.interpolate(defaultText, actualParams) : defaultText
    }
    
    // 3. fallback
    const fallback = `${namespace}.${key}`
    if (process.env.NODE_ENV === 'development') {
      this.missingKeys.add(fallback)
    }
    return fallback
  }

  // 菜单翻译（namespace = 'menu'）
  tMenu(menuKey: string, defaultText?: string): string {
    return this.tn('menu', menuKey, defaultText)
  }

  // 通用翻译（namespace = 'common'）
  tCommon(key: string, defaultText?: string, params?: Record<string, any>): string {
    return this.tn('common', key, defaultText, params)
  }

  // 创建绑定 namespace 的翻译函数（利用闭包）
  useNamespace(
    namespace: string
  ): (key: string, defaultText?: string, params?: Record<string, any>) => string {
    return (key, defaultText, params) => this.tn(namespace, key, defaultText, params)
  }

  // 监听语言变更（返回取消订阅函数）
  onLocaleChange(callback: (locale: string) => void): () => void {
    const handler = (data: any) => callback(data.locale)
    this.eventBus.subscribe('locale-changed', handler)
    return () => this.eventBus.unsubscribe('locale-changed', handler)
  }

  // 内部方法：参数插值
  private interpolate(text: string, params: Record<string, any>): string {
    if (!text || typeof text !== 'string') {
      return text
    }

    // 支持 {{param}} 格式
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match
    })
  }
}
