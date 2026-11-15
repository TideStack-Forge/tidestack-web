import { registerAction } from 'amis-core'
import { openFirstMenuItem, openMenuItem } from '@/common/menus'
export class OpenMenu {
  async run(action, renderer) {
    const menuName =
      typeof action.args === 'string'
        ? action.args
        : action.args?.fullName ?? action.args?.menu ?? action.args?.menuName
    if (!menuName) return openFirstMenuItem()
    return await openMenuItem(menuName)
  }
}

registerAction('openMenu', new OpenMenu())
