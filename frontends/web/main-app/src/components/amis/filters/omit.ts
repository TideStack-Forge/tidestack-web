import { registerFilter } from 'amis'

type PlainObject = Record<string, any>
type Input = PlainObject | PlainObject[]

function omitObject(obj: PlainObject, keys: string[]): PlainObject {
  if (typeof obj !== 'object' || Array.isArray(obj)) return obj
  const result = { ...obj }
  keys.forEach((key) => delete result[key])
  return result
}

/**
 * 简单 omit：只支持一层属性名，不支持深层路径。
 */
export function omit(input: Input, ...keys: string[]): Input {

  // 处理数组
  if (Array.isArray(input)) {
    return input.map((item) => omitObject(item, keys))
  }

  // 处理单个对象
  return omitObject(input, keys)
}

registerFilter('omit', omit)
