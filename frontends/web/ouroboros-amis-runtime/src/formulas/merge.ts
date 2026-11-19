import { registerFormula } from 'amis'

const doc = {
  name: 'MERGE',
  description: '将一组对象合并为一个新对象',
  example: `MERGE(obj1, obj2, obj3, ...)`,
  namespace: '其他',
  params: [
    {
      name: 'objects',
      type: '...string',
      description: '对象组',
    },
  ],
  returns: {
    type: 'object'
  },
}

export function merge(...objects: any): object {
  return Object.assign({}, ...objects)
}

registerFormula('MERGE', merge, doc)
