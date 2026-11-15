import { describe, test, expect, beforeEach, vi } from 'vitest'
import { i18n } from '../../../src/main'

describe('i18n - 国际化功能测试', () => {
  describe('初始状态', () => {
    test('i18n 对象存在', () => {
      expect(i18n).toBeDefined()
      expect(typeof i18n).toBe('object')
    })

    test('所有方法存在', () => {
      expect(typeof i18n.getLocale).toBe('function')
      expect(typeof i18n.getLanguages).toBe('function')
      expect(typeof i18n.switchLanguage).toBe('function')
      expect(typeof i18n.t).toBe('function')
      expect(typeof i18n.tn).toBe('function')
      expect(typeof i18n.tMenu).toBe('function')
      expect(typeof i18n.tCommon).toBe('function')
      expect(typeof i18n.useNamespace).toBe('function')
      expect(typeof i18n.getLocaleData).toBe('function')
      expect(typeof i18n.onLocaleChange).toBe('function')
    })

    test('未注入时调用方法返回默认值', () => {
      // getLocale 返回默认语言
      expect(i18n.getLocale()).toBe('zh-CN')

      // getLanguages 返回空数组
      expect(i18n.getLanguages()).toEqual([])

      // t 返回 defaultText 或 key
      expect(i18n.t('test.key', '默认文本')).toBe('默认文本')
      expect(i18n.t('test.key')).toBe('test.key')

      // tn 返回 defaultText 或 key
      expect(i18n.tn('namespace', 'key', '默认')).toBe('默认')
      expect(i18n.tn('namespace', 'key')).toBe('key')

      // tMenu 返回 defaultText 或 key
      expect(i18n.tMenu('menu.home', '首页')).toBe('首页')

      // tCommon 返回 defaultText 或 key
      expect(i18n.tCommon('save', '保存')).toBe('保存')

      // getLocaleData 返回空对象
      expect(i18n.getLocaleData()).toEqual({})

      // useNamespace 返回函数
      const t = i18n.useNamespace('test')
      expect(typeof t).toBe('function')
      expect(t('key', '默认')).toBe('默认')

      // onLocaleChange 返回空函数
      const unsubscribe = i18n.onLocaleChange(() => {})
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('平台注入后', () => {
    let mockI18n: any

    beforeEach(() => {
      // 模拟平台注入的 i18n 对象
      mockI18n = {
        getLocale: vi.fn(() => 'en-US'),
        getLanguages: vi.fn(() => [
          { value: 'zh-CN', label: '简体中文', version: '1.0.0', isDefault: true },
          { value: 'en-US', label: 'English', version: '1.0.0' }
        ]),
        switchLanguage: vi.fn((locale: string) => Promise.resolve()),
        t: vi.fn((key: string, defaultText?: string, params?: any) => {
          if (key === 'common.save') return 'Save'
          return defaultText || key
        }),
        tn: vi.fn((namespace: string, key: string, defaultText?: string) => {
          if (namespace === 'app' && key === 'title') return 'My App'
          return defaultText || key
        }),
        tMenu: vi.fn((key: string, defaultText?: string) => {
          if (key === 'menu.home') return 'Home'
          return defaultText || key
        }),
        tCommon: vi.fn((key: string, defaultText?: string) => {
          if (key === 'save') return 'Save'
          return defaultText || key
        }),
        useNamespace: vi.fn((namespace: string) => {
          return (key: string, defaultText?: string) => {
            if (namespace === 'app' && key === 'title') return 'My App'
            return defaultText || key
          }
        }),
        getLocaleData: vi.fn(() => ({
          'common.save': 'Save',
          'common.cancel': 'Cancel'
        })),
        onLocaleChange: vi.fn((callback: Function) => {
          return () => {} // 返回取消订阅函数
        })
      }

      // 模拟平台注入
      Object.assign(i18n, mockI18n)
    })

    test('getLocale 返回当前语言', () => {
      const locale = i18n.getLocale()
      expect(locale).toBe('en-US')
      expect(mockI18n.getLocale).toHaveBeenCalled()
    })

    test('getLanguages 返回语言列表', () => {
      const languages = i18n.getLanguages()
      expect(languages).toHaveLength(2)
      expect(languages[0]).toEqual({
        value: 'zh-CN',
        label: '简体中文',
        version: '1.0.0',
        isDefault: true
      })
      expect(mockI18n.getLanguages).toHaveBeenCalled()
    })

    test('switchLanguage 切换语言', async () => {
      await i18n.switchLanguage('zh-CN')
      expect(mockI18n.switchLanguage).toHaveBeenCalledWith('zh-CN')
    })

    test('t 翻译文本', () => {
      const text = i18n.t('common.save', '保存')
      expect(text).toBe('Save')
      expect(mockI18n.t).toHaveBeenCalledWith('common.save', '保存')
    })

    test('t 带参数翻译', () => {
      i18n.t('welcome', 'Welcome {name}', { name: 'John' })
      expect(mockI18n.t).toHaveBeenCalledWith('welcome', 'Welcome {name}', { name: 'John' })
    })

    test('tn 命名空间翻译', () => {
      const text = i18n.tn('app', 'title', '我的应用')
      expect(text).toBe('My App')
      expect(mockI18n.tn).toHaveBeenCalledWith('app', 'title', '我的应用')
    })

    test('tMenu 菜单翻译', () => {
      const text = i18n.tMenu('menu.home', '首页')
      expect(text).toBe('Home')
      expect(mockI18n.tMenu).toHaveBeenCalledWith('menu.home', '首页')
    })

    test('tCommon 通用文本翻译', () => {
      const text = i18n.tCommon('save', '保存')
      expect(text).toBe('Save')
      expect(mockI18n.tCommon).toHaveBeenCalledWith('save', '保存')
    })

    test('useNamespace 使用命名空间', () => {
      const t = i18n.useNamespace('app')
      expect(typeof t).toBe('function')
      expect(mockI18n.useNamespace).toHaveBeenCalledWith('app')

      const text = t('title', '我的应用')
      expect(text).toBe('My App')
    })

    test('getLocaleData 获取语言数据', () => {
      const data = i18n.getLocaleData()
      expect(data).toEqual({
        'common.save': 'Save',
        'common.cancel': 'Cancel'
      })
      expect(mockI18n.getLocaleData).toHaveBeenCalled()
    })

    test('onLocaleChange 监听语言变化', () => {
      const callback = vi.fn()
      const unsubscribe = i18n.onLocaleChange(callback)

      expect(typeof unsubscribe).toBe('function')
      expect(mockI18n.onLocaleChange).toHaveBeenCalledWith(callback)
    })
  })

  describe('边界情况', () => {
    test('t 方法不传 defaultText', () => {
      const result = i18n.t('some.key')
      expect(typeof result).toBe('string')
    })

    test('tn 方法不传 defaultText', () => {
      const result = i18n.tn('namespace', 'key')
      expect(typeof result).toBe('string')
    })

    test('tMenu 方法不传 defaultText', () => {
      const result = i18n.tMenu('menu.key')
      expect(typeof result).toBe('string')
    })

    test('tCommon 方法不传 defaultText', () => {
      const result = i18n.tCommon('key')
      expect(typeof result).toBe('string')
    })

    test('useNamespace 返回的函数不传 defaultText', () => {
      const t = i18n.useNamespace('test')
      const result = t('key')
      expect(typeof result).toBe('string')
    })

    test('switchLanguage 返回 Promise', async () => {
      const result = i18n.switchLanguage('en-US')
      expect(result).toBeInstanceOf(Promise)
      await result
    })
  })

  describe('类型安全', () => {
    test('getLanguages 返回正确的数据结构', () => {
      const languages = i18n.getLanguages()
      expect(Array.isArray(languages)).toBe(true)

      if (languages.length > 0) {
        const lang = languages[0]
        expect(lang).toHaveProperty('value')
        expect(lang).toHaveProperty('label')
        expect(lang).toHaveProperty('version')
      }
    })

    test('getLocaleData 返回对象', () => {
      const data = i18n.getLocaleData()
      expect(typeof data).toBe('object')
      expect(data).not.toBeNull()
    })
  })
})
