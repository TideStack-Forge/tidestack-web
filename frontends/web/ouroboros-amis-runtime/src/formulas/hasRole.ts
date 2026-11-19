import { registerFormula } from 'amis'
import { store } from '#ouroboros-host/store/storeFacade'

const doc = {
  name: 'hasRole',
  description: '判断当前用户是否拥有指定角色权限',
  example: `hasRole('role1', 'role2', ...) 或者 hasRole('role1,role2,role3')`,
  namespace: '系统能力',
  params: [
    {
      name: 'roleNames',
      type: '...string',
      description: '角色名列表',
    },
  ],
  returns: {
    type: 'boolean',
    description: '如果当前用户具备其中的角色，则返回true，否则返回false',
  },
}

function hasRole(...roles: any[]) {
  // TODO: 也许这里需要优化
  const allRoles = roles.join(',')
  const hasRoleFn = store.getters['user/hasRole']
  return hasRoleFn(allRoles)
}

registerFormula('hasRole', hasRole, doc)
