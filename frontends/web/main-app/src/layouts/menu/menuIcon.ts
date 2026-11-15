import type { MenuItem } from './menuTypes'

export const DEFAULT_MENU_ICON = 'fas fa-list-ul'

export function resolveMenuItemIcon(menuItem?: MenuItem) {
  return menuItem?.icon || DEFAULT_MENU_ICON
}
