import { Schema } from 'amis'
import { cloneDeep } from 'lodash'

/**
 * 净化 Schema，删除没有被使用的自动生成的 id
 * @param schema 待净化的 Schema
 * @param deepCloneFirst 是否在深拷贝的基础上进行净化
 * @returns
 */
export function getPureSchema(
  schema: Schema | Schema[],
  deepCloneFirst = true
): Schema | Schema[] {
  const schemaToProcess = deepCloneFirst ? cloneDeep(schema) : schema
  if (Array.isArray(schemaToProcess))
    schemaToProcess.forEach((schema) => pureSchemaHelper(schema))
  else if (typeof schemaToProcess === 'object') pureSchemaHelper(schemaToProcess)
  return schemaToProcess
}

// 因为schema 可能会出现在很多地方，穷举所有的 key 可能会遗漏
// 所以维护一个黑名单，即绝对不会有schema的key
const blackKeys = [
  'options',
  'api',
  'data',
  'source',
  'className',
  'headerClassName',
  'footerClassName',
  'itemClassName',
  'labelClassName',
  'inputClassName',
  'bodyClassName',
  'style',
  'css',
  'asideClassName',
  'asideStyle',
  'messages',
  'placeholder',
  'value',
  'initApi',
  'rules',
  'initAsyncApi',
  'asyncApi',
  'themeCss',
]

function pureSchemaHelper(
  schema: Schema,
  usedIds: Set<string> | null = null,
  collectedSchemas: Schema[] | null = null
) {
  if (!schema || typeof schema !== 'object' || schema instanceof RegExp) return
  const rootCollectedSchema = collectedSchemas || []
  const rootUsedIds = usedIds || new Set<string>()

  // 当前节点存在id，且以 u: 开头，说明是自动生成的，没有 themeCss 的时候，列入待删除
  if (schema.id && schema.id.startsWith('u:') && !schema.themeCss && !schema.wrapperCustomStyle) {
    rootCollectedSchema.push(schema)
  }

  // 如果当前节点有引用 componentId，且以 u: 开头，需要记录下来，避免删除对应的 id
  if (schema.componentId) {
    rootUsedIds.add(schema.componentId)
  }
  for (const key in schema) {
    const value = schema[key]
    // 非对象和数组的值，不需要处理
    if (typeof value !== 'object' || value instanceof RegExp) continue
    // 黑名单里的key，不需要处理
    if (blackKeys.includes(key)) continue
    // 如果是数组，递归处理
    if (Array.isArray(value)) {
      value.forEach((item) => {
        pureSchemaHelper(item, rootUsedIds, rootCollectedSchema)
      })
    } else {
      pureSchemaHelper(value, rootUsedIds, rootCollectedSchema)
    }
  }

  if (usedIds !== null) return

  // 删除没有被使用的id
  rootCollectedSchema.forEach((schema) => {
    if (rootUsedIds.has(schema.id)) return
    delete schema.id
  })
}
