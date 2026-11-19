import { registerFormula } from 'amis'
import { store } from '#ouroboros-host/store/storeFacade'

const doc = {
  name: 'hasAuth',
  description: '判断是否存在某权限的能力',
  example: `hasAuth('Order.add)`,
  namespace: '系统能力',
  params: [
    {
      name: 'authKey',
      type: 'string',
      description: '权限标识key值',
    },
  ],
  returns: {
    type: 'boolean',
    description: '如果存在权限，则返回true，否则返回false',
  },
}

function hasAuth(key: string) {
  // TODO: 也许这里需要优化
  const hasAuthFn = store.getters['user/hasAuth']
  return hasAuthFn(key)
}


registerFormula('hasAuth', hasAuth, doc)
