import { registerFormula } from 'amis'
import { store } from '#ouroboros-host/store/storeFacade'

const doc = {
  name: 'getUserId',
  description: '获取当前的用户标识',
  example: `getUserId()`,
  namespace: '系统能力',
  params: [],
  returns: {
    type: 'string',
    description: '当前的用户标识',
  },
}

function getUserId(key: string) {
  return store.getters['user/userInfo']?.userIdentity
}

// registerFormula 包裹了 registerFunction 和 registerFunctionDoc
registerFormula('getUserId', getUserId, doc)
