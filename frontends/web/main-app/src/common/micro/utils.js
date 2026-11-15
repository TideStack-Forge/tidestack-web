export function isMicro(type) {
  const microType = ['micro', 'qb_template', 'qb', 'quick']
  return microType.includes(type)
}

/**
 * entry 映射缓存
 */
let entryMapCache = null
let lastStorageValue = null

/**
 * 获取 entry 映射配置（带缓存）
 * @returns {Object} entry 映射对象
 */
function getEntryMap() {
  try {
    const currentValue = sessionStorage.getItem('devMicroEntryMap')

    // 如果 sessionStorage 的值没有变化，直接返回缓存
    if (currentValue === lastStorageValue && entryMapCache !== null) {
      return entryMapCache
    }

    // 更新缓存
    lastStorageValue = currentValue
    if (currentValue) {
      entryMapCache = JSON.parse(currentValue)
    } else {
      entryMapCache = {}
    }

    return entryMapCache
  } catch (e) {
    console.warn('解析微前端配置失败', e)
    entryMapCache = {}
    return entryMapCache
  }
}

/**
 * 清除 entry 映射缓存
 * 当 sessionStorage 更新后调用此方法
 */
export function clearEntryMapCache() {
  entryMapCache = null
  lastStorageValue = null
}

/**
 * 微应用入口规范化处理
 * 1. 优先使用 sessionStorage 中配置的自定义 entry
 * 2. 确保 entry 以 '/' 或 '.html' 结尾
 *
 * @param {string} entry - 原始 entry
 * @returns {string} 规范化后的 entry
 */
export function normalizeMicroEntry(entry) {
  if (!entry) return

  // 使用自定义 entry（如果存在）
  const entryMap = getEntryMap()
  const customEntry = entryMap[entry]
  if (customEntry) {
    entry = customEntry
  }

  // 规范化处理：确保以 '/' 或 '.html' 结尾
  if (typeof entry === 'string') {
    return entry.endsWith('/') || entry.endsWith('.html') ? entry : entry + '/'
  }

  return entry
}
