import { registerFormula } from 'amis'

const doc = {
  name: 'REDUCE',
  description: '对数组进行 reduce 操作',
  example: `REDUCE(array, (acc, curr, index, array) => acc + curr, 0)`,
  namespace: '数组',
  params: [
    {
      name: 'array',
      type: 'any[]',
      description: '属性名',
    },
    {
      name: 'callback',
      type: 'function',
      description: '回调函数',
    },
    {
      name: 'initialValue',
      type: 'any',
      description: '初始值',
    },
  ],
  returns: {
    type: 'object'
  },
}

/**
 * reduce 操作
 */
export function reduce<T>(array: any[], callback: (acc: T, curr: any, index: number, array: any[]) => T, initialValue?: T): T {
  if (!Array.isArray(array)) return array
  return array.reduce(callback, initialValue)
}

registerFormula('REDUCE', reduce, doc)
