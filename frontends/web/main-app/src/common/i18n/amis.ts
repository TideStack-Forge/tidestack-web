/**
 * AMIS Schema 多语言处理工具
 * 算法对齐后端 UISchemaTextExtractor
 */
import { i18nService } from './index'

// 需要翻译的文本属性
const TEXT_PROPERTIES = [
  'label', 'title', 'placeholder', 'description', 'tpl', 'content', 'msg',
  'tooltip', 'remark', 'disabledTip', 'popOver',
  'success', 'failed'
]

// 通配符文本属性（匹配 *Failed, *Success, *Text, *Label, *Msg）
const WILDCARD_TEXT_PATTERNS = ['Failed', 'Success', 'Text', 'Label', 'Msg']

// 通配符属性（key -> string 映射）
const WILDCARD_PROPERTIES = ['definitions', 'messages', 'validationErrors']

// 属性黑名单（不递归处理）
const PROPERTY_BLACKLIST = [
  'data', 'value', 'defaultValue', 'source', 'reload', 'redirect',
  'className', 'style', 'inputClassName', 'labelClassName', 'staticClassName',
  'visibleOn', 'hiddenOn', 'disabledOn', 'requiredOn', 'staticOn',
  'required', 'disabled', 'hidden', 'static',
  'id', 'localeKey', 'localeKeys', 'localePath', 'name', 'type'
]

const MAX_DEPTH = 20

/**
 * 构建 key 前缀
 */
function buildKeyPrefix(node: any, path: string): string {
  let currentPath = path
  if (!path && node.type) {
    currentPath = node.type || 'root'
  }
  
  return node.localeKey || currentPath
}

/**
 * 获取节点标识符
 */
function getNodeIdentifier(node: any, index: number, typeCount: Map<string, number>): string {
  // 0. 最高优先级：localePath
  if (node.localePath && typeof node.localePath === 'string') {
    return node.localePath
  }
  
  // 1. 优先 id（忽略 u: 开头的 id）
  if (node.id && typeof node.id === 'string' && !node.id.startsWith('u:')) {
    return node.id
  }
  
  // 2. 其次 name
  if (node.name && typeof node.name === 'string') {
    return node.name
  }
  
  // 3. 根据上下文选择 type 或 index
  if (node.type && typeof node.type === 'string') {
    if (typeCount.get(node.type) === 1) {
      return node.type
    }
    return String(index)
  }
  
  // 4. 兜底用 index
  return String(index)
}

/**
 * 构建节点路径
 */
function buildNodePath(parentPath: string, nodeId: string, propertyName: string, index: number): string {
  // 如果节点ID是纯数字（下标），使用属性名[index]格式
  if (/^\d+$/.test(nodeId)) {
    const searchStr = '.' + propertyName
    const lastIndex = parentPath.lastIndexOf(searchStr)
    if (lastIndex !== -1) {
      const basePath = parentPath.substring(0, lastIndex)
      return basePath ? `${basePath}.${propertyName}[${index}]` : `${propertyName}[${index}]`
    }
    return `${propertyName}[${index}]`
  }
  
  return `${parentPath}.${nodeId}`
}

/**
 * 检查是否是黑名单属性
 */
function isBlacklisted(propName: string): boolean {
  return PROPERTY_BLACKLIST.includes(propName)
}

/**
 * 检查是否是文本属性
 */
function isTextProperty(propName: string): boolean {
  if (TEXT_PROPERTIES.includes(propName)) {
    return true
  }
  
  for (const pattern of WILDCARD_TEXT_PATTERNS) {
    const regex = new RegExp(pattern + '$')
    if (regex.test(propName)) {
      return true
    }
  }
  
  return false
}

/**
 * 检查是否是通配符属性
 */
function isWildcardProperty(propName: string): boolean {
  return WILDCARD_PROPERTIES.includes(propName)
}

/**
 * 检查是否是复杂对象
 */
function isComplexObject(value: any): boolean {
  if (value == null) return false
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return false
  }
  return true
}

function getLocaleKeys(node: any): Record<string, string> | null {
  return node?.localeKeys && typeof node.localeKeys === 'object' && !Array.isArray(node.localeKeys)
    ? node.localeKeys
    : null
}

function getExplicitLocaleKey(node: any, prop: string): string | null {
  const localeKeys = getLocaleKeys(node)
  const key = localeKeys?.[prop]
  return typeof key === 'string' && key.trim() ? key : null
}

/**
 * 翻译单个文本属性
 */
function translateSingleTextProperty(schemaId: string, node: any, keyPrefix: string, localeKey: any, prop: string, result: any): void {
  const value = node[prop]
  
  if (typeof value === 'string' && value.trim()) {
    const finalKey = getExplicitLocaleKey(node, prop) || localeKey || `${keyPrefix}.${prop}`
    result[prop] = i18nService.getManager().tn(schemaId, finalKey, value)
  } else if (value && typeof value === 'object') {
    const childPath = keyPrefix ? `${keyPrefix}.${prop}` : prop
    result[prop] = translateNode(schemaId, value, childPath, 0)
  }
}

/**
 * 翻译通配符文本属性
 */
function translateWildcardTextProperties(schemaId: string, node: any, keyPrefix: string, localeKey: any, pattern: string, result: any): void {
  const regex = new RegExp(pattern + '$')
  
  for (const propName in node) {
    if (!regex.test(propName)) continue
    
    const value = node[propName]
    if (typeof value === 'string' && value.trim()) {
      const finalKey = getExplicitLocaleKey(node, propName) || localeKey || `${keyPrefix}.${propName}`
      result[propName] = i18nService.getManager().tn(schemaId, finalKey, value)
    } else if (value && typeof value === 'object') {
      const childPath = keyPrefix ? `${keyPrefix}.${propName}` : propName
      result[propName] = translateNode(schemaId, value, childPath, 0)
    }
  }
}

/**
 * 翻译文本属性
 */
function translateTextProperties(schemaId: string, node: any, keyPrefix: string, result: any): void {
  const localeKey = node.localeKey
  
  // 处理固定属性
  for (const prop of TEXT_PROPERTIES) {
    translateSingleTextProperty(schemaId, node, keyPrefix, localeKey, prop, result)
  }
  
  // 处理通配符属性
  for (const pattern of WILDCARD_TEXT_PATTERNS) {
    translateWildcardTextProperties(schemaId, node, keyPrefix, localeKey, pattern, result)
  }
}

/**
 * 翻译 onEvent
 */
function translateOnEvent(schemaId: string, onEvent: any, path: string): any {
  if (!onEvent || typeof onEvent !== 'object') return onEvent
  
  const result: any = {}
  
  for (const [eventName, eventData] of Object.entries(onEvent)) {
    if (!eventData || typeof eventData !== 'object') {
      result[eventName] = eventData
      continue
    }
    
    const actions = (eventData as any).actions
    if (!Array.isArray(actions)) {
      result[eventName] = eventData
      continue
    }
    
    result[eventName] = {
      ...(eventData as any),
      actions: actions.map((action: any, i: number) => {
        if (!action || typeof action !== 'object') return action
        
        const newAction = { ...action }
        const actionType = action.actionType
        
        if (actionType === 'toast' && typeof newAction.msg === 'string') {
          const key = `${path}.onEvent.${eventName}.${i}.msg`
          newAction.msg = i18nService.getManager().tn(schemaId, key, newAction.msg)
        } else if ((actionType === 'dialog' || actionType === 'drawer') && typeof newAction.title === 'string') {
          const key = `${path}.onEvent.${eventName}.${i}.title`
          newAction.title = i18nService.getManager().tn(schemaId, key, newAction.title)
        }
        
        return newAction
      })
    }
  }
  
  return result
}

/**
 * 处理通配符 Map（如 definitions.*）
 */
function translateWildcardMap(
  schemaId: string,
  map: any,
  basePath: string,
  depth: number,
  localeKeys: Record<string, string> | null = null,
  propName: string = ''
): any {
  if (!map || typeof map !== 'object' || depth > MAX_DEPTH) {
    return map
  }
  
  const result: any = {}
  for (const [key, value] of Object.entries(map)) {
    const childPath = `${basePath}.${key}`
    
    if (typeof value === 'string' && value.trim()) {
      const explicitKey = localeKeys?.[`${propName}.${key}`]
      const finalKey = typeof explicitKey === 'string' && explicitKey.trim()
        ? explicitKey
        : childPath
      result[key] = i18nService.getManager().tn(schemaId, finalKey, value)
    } else if (value && typeof value === 'object') {
      result[key] = translateNode(schemaId, value, childPath, depth + 1)
    } else {
      result[key] = value
    }
  }
  
  return result
}

/**
 * 处理子节点数组
 */
function translateChildArray(schemaId: string, children: any[], parentPath: string, propertyName: string, depth: number): any[] {
  // 统计每个 type 的出现次数
  const typeCount = new Map<string, number>()
  for (const child of children) {
    if (child && typeof child === 'object' && child.type) {
      typeCount.set(child.type, (typeCount.get(child.type) || 0) + 1)
    }
  }
  
  // 处理每个节点
  const usedCount = new Map<string, number>()
  return children.map((child, index) => {
    if (!child || typeof child !== 'object') return child
    
    const nodeId = getNodeIdentifier(child, index, typeCount)
    
    // 处理重复标识符
    const count = usedCount.get(nodeId) || 0
    const finalNodeId = count > 0 ? `${nodeId}[${count}]` : nodeId
    usedCount.set(nodeId, count + 1)
    
    // 构建节点路径
    const nodePath = buildNodePath(parentPath, finalNodeId, propertyName, index)
    return translateNode(schemaId, child, nodePath, depth + 1)
  })
}

/**
 * 处理所有子属性
 */
function processAllChildProperties(schemaId: string, node: any, keyPrefix: string, result: any, depth: number): void {
  for (const propName in node) {
    // 跳过黑名单属性
    if (isBlacklisted(propName)) {
      continue
    }
    
    // 跳过已处理的文本属性
    if (isTextProperty(propName)) {
      continue
    }
    
    // 检查是否是通配符属性
    if (isWildcardProperty(propName)) {
      if (node[propName] && typeof node[propName] === 'object' && !Array.isArray(node[propName])) {
        const childPath = keyPrefix ? `${keyPrefix}.${propName}` : propName
        result[propName] = translateWildcardMap(
          schemaId,
          node[propName],
          childPath,
          depth,
          getLocaleKeys(node),
          propName
        )
      }
      continue
    }
    
    // 自动递归对象和数组
    const value = node[propName]
    const childPath = keyPrefix ? `${keyPrefix}.${propName}` : propName
    const explicitKey = getExplicitLocaleKey(node, propName)
    if (typeof value === 'string' && value.trim() && explicitKey) {
      result[propName] = i18nService.getManager().tn(schemaId, explicitKey, value)
      continue
    }
    
    if (Array.isArray(value)) {
      result[propName] = translateChildArray(schemaId, value, childPath, propName, depth)
    } else if (isComplexObject(value)) {
      result[propName] = translateNode(schemaId, value, childPath, depth + 1)
    }
  }
}

/**
 * 翻译节点
 */
function translateNode(schemaId: string, node: any, path: string, depth: number): any {
  if (!node || typeof node !== 'object' || depth > MAX_DEPTH) {
    return node
  }
  
  const result = Array.isArray(node) ? [...node] : { ...node }
  const keyPrefix = buildKeyPrefix(node, path)
  
  // 翻译文本属性
  translateTextProperties(schemaId, node, keyPrefix, result)
  
  // 翻译 onEvent
  if (node.onEvent && typeof node.onEvent === 'object') {
    result.onEvent = translateOnEvent(schemaId, node.onEvent, keyPrefix)
  }
  
  // 自动递归所有对象和数组属性
  processAllChildProperties(schemaId, node, keyPrefix, result, depth)
  
  return result
}

/**
 * 处理 AMIS Schema 多语言
 * @param schemaId - Schema 标识符（通常是路由路径）
 * @param schema - AMIS Schema 对象
 * @returns 翻译后的 Schema
 */
export function processAmisSchema(schemaId: string, schema: any): any {
  if (!schema || typeof schema !== 'object') {
    return schema
  }
  
  // 如果 schemaId 为空，跳过处理以提高性能
  if (!schemaId) {
    return schema
  }
  
  // 检查当前语言数据中是否存在该 namespace 的内容
  const manager = i18nService.getManager()
  const localeData = manager.getLocaleData()
  const messages = localeData?.messages || {}
  if (!messages[schemaId] || Object.keys(messages[schemaId]).length === 0) {
    return schema
  }
  
  return translateNode(schemaId, schema, '', 0)
}
