import { registerAction } from 'amis-core'
import { menu } from '@/common/menus/registry'

/**
 * 设置 / 清除菜单徽标
 *
 * 用法：
 * ```json
 * { "actionType": "setMenuBadge", "args": { "fullName": "dev.apps", "badge": { "type": "number", "value": 3 } } }
 * ```
 * - args 为对象：`{ fullName, badge }`，badge 为 null 时清除徽标；
 * - args 为字符串：视为 fullName，语义为清除该菜单的徽标。
 */
export class SetMenuBadge {
  async run(action, renderer) {
    const args = action.args

    if (typeof args === 'string') {
      menu.setMenuBadge(args, null)
      return
    }

    const fullName = args?.fullName ?? args?.menu ?? args?.menuName
    if (!fullName) {
      return
    }
    menu.setMenuBadge(fullName, args?.badge ?? null)
  }
}

registerAction('setMenuBadge', new SetMenuBadge())
