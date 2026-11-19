import { registerFormula } from 'amis'

const doc = {
  name: 'PICK',
  description: '提取对象指定属性，形成新对象返回。',
  example: `PICK(obj, 'key1', 'key2')`,
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

/**
 * 简单 pick：只支持一层属性名，不支持深层路径。
 */
export function pick(input: object, ...keys: string[]): object {
  const newObj: any = {}
  for (const key in keys) {
    const value = (input as any)[key]
    if (value !== undefined) {
      newObj[key] = value
    }
  }
  return newObj
}

registerFormula('PICK', pick, doc)
