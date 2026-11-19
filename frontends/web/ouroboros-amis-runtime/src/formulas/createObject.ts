import { registerFormula } from 'amis'

const doc = {
  name: 'CREATEOBJECT',
  description: '创建对象',
  example: `CREATEOBJECT('key1', value1, 'key2', value2) 或 CREATEOBJECT(['key1', value1], ['key2', value2])`,
  namespace: '其他',
  params: [
    {
      name: 'array',
      type: 'any[]',
      description: '键值对',
    }
  ],
  returns: {
    type: 'object'
  },
}

/**
 * 根据键值对创建对象
 */
export function createObject(...kvs: any[]): object {
  if (!kvs || kvs.length === 0) return {}
  if (Array.isArray(kvs[0])) {
    return kvs.reduce((acc, curr) => {
      if (!Array.isArray(curr) || curr.length < 2) return acc
      acc[curr[0]] = curr[1]
      return acc
    }, {})
  }
  return kvs.reduce((acc, curr, index) => {
    if (index % 2 === 0) {
      acc[curr] = kvs[index + 1]
    }
    return acc
  }, {})
}

registerFormula('CREATEOBJECT', createObject, doc)
