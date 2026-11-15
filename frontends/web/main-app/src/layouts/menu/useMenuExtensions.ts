import { useSyncExternalStore } from 'react'

import {
  getMenuBadgeForItem,
  getRegisteredUserMenuItems,
  subscribeMenuExtension,
} from '@/common/menus/registry'

/**
 * 订阅菜单项徽标。item 为菜单项对象（或具备 fullName/path 等引用字段的对象）。
 */
export function useMenuBadge(item?: any) {
  return useSyncExternalStore(subscribeMenuExtension, () => getMenuBadgeForItem(item))
}

/**
 * 订阅用户菜单注册表（按 order 升序，含内置项）。
 */
export function useUserMenuItems() {
  return useSyncExternalStore(subscribeMenuExtension, getRegisteredUserMenuItems)
}
