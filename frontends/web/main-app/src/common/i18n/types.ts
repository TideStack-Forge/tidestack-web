/**
 * I18n 类型定义
 */

// 语言环境数据结构
export interface LocaleData {
  locale: string              // 语言代码，如 'zh-CN'
  name: string                // 语言名称，如 '简体中文'
  version: string             // 版本号，如 '1.2.3'
  enabled: boolean            // 是否启用
  isDefault: boolean          // 是否默认语言
  direction: 'LTR' | 'RTL'    // 文本方向
  timestamp?: number          // 生成时间戳
  messages: Messages          // 翻译消息
}

// 翻译消息结构（二级 key）
export interface Messages {
  [primaryKey: string]: {
    [secondaryKey: string]: string
  }
}

// 语言选项
export interface LanguageOption {
  value: string               // 语言代码
  label: string               // 语言名称
  version: string             // 版本号
  isDefault?: boolean         // 是否默认
}

// API 响应格式
export interface ApiResponse<T> {
  status: number
  msg: string
  data: T | null
}
