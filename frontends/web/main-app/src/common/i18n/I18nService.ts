/**
 * I18n 服务层
 */
import { registerLocale } from 'amis'
import type { I18nManager } from './I18nManager'
import { I18nIndexedDBCache } from './indexedDBCache'
import type { I18nApi } from './api'
import type { LocaleData, LanguageOption } from './types'
import { store } from '@/store/storeFacade'

export class I18nService {
  private i18nManager: I18nManager
  private cache = I18nIndexedDBCache
  private api: I18nApi
  private languages: LanguageOption[] = []

  constructor(i18nManager: I18nManager, api: I18nApi) {
    this.i18nManager = i18nManager
    this.api = api
  }

  // 初始化（应用启动时调用）
  async init(): Promise<void> {
    try {
      // 1. 加载语言列表（获取版本信息）
      await this.loadLanguages()

      // 2. 获取用户偏好语言
      let preferredLocale = this.cache.getPreferredLocale()
      
      // 如果没有本地配置，使用 isDefault 的语言
      if (!preferredLocale) {
        const defaultLanguage = this.languages.find(l => l.isDefault)
        preferredLocale = defaultLanguage?.value || this.getBrowserLocale() || 'zh-CN'
      }

      // 3. 检查缓存有效性
      const latestVersion = this.languages.find(l => l.value === preferredLocale)?.version
      if (latestVersion && !this.cache.isValid(preferredLocale, latestVersion)) {
        this.cache.remove(preferredLocale)
      }

      // 4. 加载语言环境
      await this.loadLocale(preferredLocale)
      
      // 5. 初始化 store 的 locale 状态
      store.commit('app/SET_LOCALE', preferredLocale)
      
      // 6. 更新初始页面标题（从"正在加载"改为应用名）
      const appName = store.getters.appName || 'Ouroboros'
      document.title = appName
    } catch (error) {
      console.warn('Failed to initialize I18n:', error)
      // 降级到默认语言
      this.i18nManager.setLocale({
        locale: 'zh-CN',
        name: '简体中文',
        version: '1.0.0',
        enabled: true,
        isDefault: true,
        direction: 'LTR',
        messages: {}
      })
    }
  }

  // 加载可用语言列表
  async loadLanguages(): Promise<LanguageOption[]> {
    try {
      this.languages = await this.api.getLanguages()
      return this.languages
    } catch (error) {
      console.warn('Failed to load languages:', error)
      return []
    }
  }

  // 获取可用语言列表
  getLanguages(): LanguageOption[] {
    return this.languages
  }

  // 切换语言
  async switchLanguage(locale: string): Promise<void> {
    await this.loadLocale(locale)
    
    store.commit('app/SET_LOCALE', locale)

    if (store.getters['user/isLogin']) {
      const result = await store.dispatch('user/fetchMenu')
      if (result?.code !== 0) {
        throw new Error(
          result?.msg ||
            this.i18nManager.tCommon('http.requestFailed', '请求失败，请稍后重试')
        )
      }
    }

    // 更新所有 Tab 标题
    this.updateAllTabTitles()
  }

  /**
   * 更新所有 Tab 标题
   */
  private updateAllTabTitles(): void {
    try {
      // 获取所有打开的 Tab
      const tabs = store.getters.tabsList || []
      
      // 遍历并更新每个 Tab 的标题
      tabs.forEach((tab: any) => {
        const translatedTitle = this.i18nManager.tn(tab.path, 'title')
        
        if (translatedTitle !== `${tab.path}.title`) {
          store.dispatch('tabs/changeTab', {
            ...tab,
            title: translatedTitle
          })
        }
      })
    } catch (error) {
      console.error('Failed to update tab titles:', error)
    }
  }

  // 加载指定语言环境数据
  async loadLocale(locale: string): Promise<LocaleData> {
    // 1. 检查缓存有效性
    const latestVersion = this.languages.find(l => l.value === locale)?.version
    if (latestVersion && !(await this.cache.isValid(locale, latestVersion))) {
      await this.cache.remove(locale)
    }
    
    // 2. 尝试从缓存加载
    let localeData = await this.cache.get(locale)

    // 3. 缓存不存在，从 API 加载
    if (!localeData) {
      localeData = await this.api.getLocale(locale)
      await this.cache.set(locale, localeData, localeData.version)
    }

    // 4. 设置 I18nManager
    this.i18nManager.setLocale(localeData)

    // 5. 注册 AMIS 多语言
    this.registerAmisLocale(localeData)

    // 6. 设置文档方向
    this.setDocumentDirection(localeData.direction || 'LTR')

    // 7. 保存用户偏好
    this.cache.setPreferredLocale(locale)

    return localeData
  }

  // 获取 I18nManager 实例
  getManager(): I18nManager {
    return this.i18nManager
  }

  // 内部方法：注册 AMIS 多语言
  private registerAmisLocale(localeData: LocaleData): void {
    const amisLocaleData = localeData.messages?.base || {}
    const common = localeData.messages?.common || {}
    registerLocale(localeData.locale, {
      ...amisLocaleData,
      confirm: amisLocaleData.confirm || common.confirm || '确认',
      cancel: amisLocaleData.cancel || common.cancel || '取消',
      // AMIS Alert's initial button state uses this literal as its locale key.
      确认: amisLocaleData.confirm || common.confirm || '确认',
    })
  }

  // 内部方法：设置文档方向
  private setDocumentDirection(direction: 'LTR' | 'RTL'): void {
    const dir = direction.toLowerCase()
    document.documentElement.setAttribute('dir', dir)
    document.documentElement.setAttribute('lang', this.i18nManager.getLocale())
  }

  // 内部方法：获取浏览器语言
  private getBrowserLocale(): string | null {
    const browserLang = navigator.language || (navigator.languages && navigator.languages[0])
    return browserLang || null
  }
}
