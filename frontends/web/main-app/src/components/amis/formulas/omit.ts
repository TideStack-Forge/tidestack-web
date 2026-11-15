import { registerFormula } from 'amis'

type PlainObject = Record<string, any>
type Input = PlainObject | PlainObject[]

const doc = {
  name: 'OMIT',
  description: '剔除对象指定属性，返回新对象。',
  example: `OMIT(obj, 'key1', 'key2')`,
  namespace: '其他',
  params: [
    {
      name: 'input',
      type: 'object',
      description: '对象',
    },
    {
      name: 'keys',
      type: '...string',
      description: '属性名列表',
    },
  ],
  returns: {
    type: 'object'
  },
}

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
  return omitObject(input, keys)
}

registerFormula('OMIT', omit, doc)
