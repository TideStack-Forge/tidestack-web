import {
  normalizeBooleanConfigValue,
  readSystemConfigValue,
} from './runtimeSystemConfig'

export const TABLE_LAZY_RENDER_STORAGE_KEY = 'ouroboros.table.lazyRender'
export const TABLE_LAZY_RENDER_CONFIG_KEY = 'ui.table.lazyRender.enabled'
export const TABLE_LAZY_RENDER_QUERY_KEY = 'tableLazyRender'

let systemConfigEnabled = false
let localOverrideEnabled: boolean | undefined
let localOverrideResolved = false

export function syncTableLazyRenderSystemConfig(systemConfig?: any) {
  // 配置项默认 false：只有显式配置 true 才开启懒渲染。
  systemConfigEnabled =
    normalizeBooleanConfigValue(
      readSystemConfigValue(systemConfig, TABLE_LAZY_RENDER_CONFIG_KEY)
    ) === true
  localOverrideEnabled = undefined
  localOverrideResolved = false
}

function resolveLocalOverrideEnabled() {
  if (localOverrideResolved) {
    return localOverrideEnabled
  }

  localOverrideResolved = true

  if (typeof window === 'undefined') {
    localOverrideEnabled = undefined
    return localOverrideEnabled
  }

  if (typeof (window as any).__OUROBOROS_TABLE_LAZY_RENDER__ === 'boolean') {
    localOverrideEnabled = (window as any).__OUROBOROS_TABLE_LAZY_RENDER__
    return localOverrideEnabled
  }

  try {
    const queryValue = normalizeBooleanConfigValue(
      new URLSearchParams(window.location.search).get(
        TABLE_LAZY_RENDER_QUERY_KEY
      )
    )
    if (queryValue !== undefined) {
      localOverrideEnabled = queryValue
      return localOverrideEnabled
    }
  } catch {
    // 忽略 URL 解析失败
  }

  try {
    const storedValue = normalizeBooleanConfigValue(
      window.localStorage.getItem(TABLE_LAZY_RENDER_STORAGE_KEY)
    )
    if (storedValue !== undefined) {
      localOverrideEnabled = storedValue
      return localOverrideEnabled
    }
  } catch {
    // localStorage 不可用时忽略
  }

  localOverrideEnabled = undefined
  return localOverrideEnabled
}

/**
 * 全局表格懒渲染总开关（默认关闭）。
 *
 * 默认关闭；以下方式可显式开启（优先级从高到低）：
 * - `window.__OUROBOROS_TABLE_LAZY_RENDER__ = true`
 * - URL 参数 `?tableLazyRender=1`
 * - localStorage `ouroboros.table.lazyRender = "true"`
 * - 平台配置 `ui.table.lazyRender.enabled = true`
 *
 * 显式设为 false 可强制关闭，优先级高于平台配置。
 */
export function isTableLazyRenderGloballyDisabled() {
  const localOverride = resolveLocalOverrideEnabled()
  if (localOverride !== undefined) {
    return !localOverride
  }

  return !systemConfigEnabled
}
