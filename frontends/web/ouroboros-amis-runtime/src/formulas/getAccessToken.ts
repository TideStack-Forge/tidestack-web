import { registerFormula } from 'amis'
import { store } from '#ouroboros-host/store/storeFacade'

const doc = {
  name: 'getAccessToken',
  description: '获取当前的 AccessToken',
  example: `getAccessToken()`,
  namespace: '系统能力',
  params: [],
  returns: {
    type: 'string',
    description: '当前的 AccessToken',
  },
}

function getAccessToken(key: string) {
  return store.getters.accessToken.token
}

// registerFormula 包裹了 registerFunction 和 registerFunctionDoc
registerFormula('getAccessToken', getAccessToken, doc)
