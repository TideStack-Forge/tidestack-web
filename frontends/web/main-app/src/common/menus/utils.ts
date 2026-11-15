import type { MenuItem } from '@/layouts/menu/menuTypes'

/**
 * 菜单寻址工具
 *
 * 菜单引用（menu ref）统一以菜单全名（fullName）为主键，
 * 兼容既有 getMenuItem 的多键匹配顺序：fullName → url → path → fullPath → router_id → name。
 */

export const MENU_REF_KEYS = ['fullName', 'url', 'path', 'fullPath', 'router_id', 'name'] as const

/**
 * 归一菜单引用键：取菜单项上按优先级排列的第一个非空字符串字段。
 * 用于徽标注册表的存储键与查询键。
 */
export function resolveMenuRef(item: any): string | undefined {
  if (!item || typeof item !== 'object') {
    return undefined
  }
  for (const key of MENU_REF_KEYS) {
    const value = item[key]
    if (typeof value === 'string' && value) {
      return value
    }
  }
  return undefined
}

/**
 * 在菜单列表中按引用（fullName/path/url/fullPath/router_id/name 任一匹配）递归查找菜单项。
 * 与 user store 模块中既有 getMenuItem 的匹配语义保持一致。
 */
export function findMenuItem(list: MenuItem[] | undefined, target: string | undefined): MenuItem | undefined {
  if (!target || !Array.isArray(list)) {
    return undefined
  }
  for (const menu of list) {
    if (!menu || typeof menu !== 'object') {
      continue
    }
    if (MENU_REF_KEYS.some((key) => menu[key] === target)) {
      return menu
    }
    const nested = findMenuItem(menu.children, target)
    if (nested) {
      return nested
    }
  }
  return undefined
}

/**
 * 在主菜单与辅助菜单中查找菜单项。
 */
export function findMenuItemInTrees(
  menuTree: { globalMenu?: MenuItem[]; globalSubNav?: MenuItem[] },
  target: string | undefined
): MenuItem | undefined {
  return (
    findMenuItem(menuTree?.globalMenu, target) ||
    findMenuItem(menuTree?.globalSubNav, target)
  )
}

/**
 * 深拷贝菜单树（纯数据，不拷贝函数字段）。
 */
export function cloneMenuItems(items: MenuItem[] | undefined): MenuItem[] {
  return (items || []).map((item) => {
    const cloned: any = {}
    for (const key of Object.keys(item || {})) {
      const value = (item as any)[key]
      if (Array.isArray(value)) {
        cloned[key] = cloneMenuItems(value)
      } else if (value && typeof value === 'object') {
        cloned[key] = { ...value }
      } else {
        cloned[key] = value
      }
    }
    return cloned as MenuItem
  })
}
