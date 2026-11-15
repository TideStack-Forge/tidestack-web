import { dispatch, readGetters, subscribeState } from '@/store/storeFacade'
import type { MenuItem } from '@/layouts/menu/menuTypes'
import {
  cloneMenuItems,
  findMenuItem,
  findMenuItemInTrees,
  MENU_REF_KEYS,
  resolveMenuRef,
} from './utils'

/**
 * 菜单扩展注册中心（单例）
 *
 * 承载两类运行时扩展状态：
 * 1. 菜单徽标（badges）—— 会话内存级装饰层，与 store 菜单树解耦，树重建后按菜单引用重新命中；
 * 2. 用户菜单注册表（userMenuItems）—— 用户下拉菜单的注册制条目，内置项与业务注册项并存。
 *
 * 菜单树增删操作（addMenuItem / removeMenuItem）经 storeFacade 落回 store 的 user 模块
 * （user/updateMenu），复用 normalize、翻译、面包屑、搜索等既有数据流。
 */

// ============================================================================
// 类型定义
// ============================================================================

export type MenuBadgeTone = 'danger' | 'warning' | 'success' | 'info' | 'neutral'

export interface MenuBadgeBase {
  /** 语义色，缺省 danger；color 优先于 tone */
  tone?: MenuBadgeTone
  /** 自定义颜色（CSS 色值），覆盖 tone */
  color?: string
}

export type MenuBadge =
  | ({ type: 'number'; value: number; max?: number; showZero?: boolean } & MenuBadgeBase)
  | ({ type: 'dot' } & MenuBadgeBase)
  | ({ type: 'text'; text: string } & MenuBadgeBase)
  | ({ type: 'ribbon'; text: string; position?: 'top-left' | 'top-right' } & MenuBadgeBase)

export type MenuScope = 'main' | 'secondary' | 'all'

export interface MenuItemInfo extends MenuItem {
  /** 查询 / 遍历输出时由注册中心合并注入 */
  badge?: MenuBadge
}

export interface MenuTreeResult {
  main?: MenuItemInfo[]
  secondary?: MenuItemInfo[]
}

export interface GetMenusOptions {
  scope?: MenuScope
  flat?: boolean
}

export interface AddMenuItemOptions {
  scope: 'main' | 'secondary'
  item: MenuItemInfo
  /** 父菜单引用（fullName/path 等），缺省追加到对应 scope 根 */
  parentFullName?: string
  /** 在父节点 children 中的插入位置，缺省追加到末尾 */
  index?: number
}

export interface UserMenuContext {
  userInfo: any
  theme: string
  themeList: string[]
  isLockTheme: boolean
  lockTheme: string
  dispatch: typeof dispatch
  openDialog: (schema: any, ctx?: any) => Promise<any>
}

export interface UserMenuItem {
  /** 注册返回的唯一 id（register 时可不传） */
  id?: string
  /** 稳定业务键：同 key 重复注册视为覆盖（幂等） */
  key?: string
  title: string
  /** i18n 翻译键（common 命名空间）；提供时渲染 t(titleKey, title) */
  titleKey?: string
  icon?: string
  /** 升序渲染，缺省 100 */
  order?: number
  /** 用户菜单项徽标（复用徽标机制） */
  badge?: MenuBadge
  /** 分组线 */
  divider?: boolean
  visible?: (ctx: UserMenuContext) => boolean
  disabled?: (ctx: UserMenuContext) => boolean
  /** 点击后收起下拉，缺省 true */
  closeOnClick?: boolean
  onClick: (ctx: UserMenuContext) => void | Promise<void>
}

interface InternalUserMenuItem {
  item: UserMenuItem
  owner?: string
  builtin?: boolean
  seq: number
}

const DEFAULT_ORDER = 100

// ============================================================================
// 内部状态
// ============================================================================

/** 徽标注册表：菜单引用（fullName 优先）→ 徽标 */
const badges = new Map<string, MenuBadge>()

const userMenuEntries: InternalUserMenuItem[] = []
let userMenuSnapshot: UserMenuItem[] = []
let userMenuSeq = 0

const listeners = new Set<() => void>()

function notify() {
  for (const listener of [...listeners]) {
    listener()
  }
}

/**
 * 订阅扩展状态变化（徽标 / 用户菜单）。
 * @returns 取消订阅函数
 */
export function subscribeMenuExtension(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// ============================================================================
// 徽标（badge）
// ============================================================================

function readMenuTree() {
  const menu = readGetters()['user/menu'] || {}
  return {
    globalMenu: (menu.globalMenu || []) as MenuItem[],
    globalSubNav: (menu.globalSubNav || []) as MenuItem[],
  }
}

function readAllMenuItems(): MenuItem[] {
  const tree = readMenuTree()
  return [...tree.globalMenu, ...tree.globalSubNav]
}

/**
 * 渲染侧查找：按菜单项自身全部引用键依次命中徽标。
 * 直接键未命中时回退树查找（按首个可用引用定位节点后取其规范键），
 * 支持"设置时用 fullName、渲染项只有 path"等组合。
 */
export function getMenuBadgeForItem(item: any): MenuBadge | undefined {
  if (badges.size === 0 || !item || typeof item !== 'object') {
    return undefined
  }
  for (const key of MENU_REF_KEYS) {
    const value = item[key]
    if (typeof value === 'string' && value && badges.has(value)) {
      return badges.get(value)
    }
  }
  const node = findMenuItemInTrees(readMenuTree(), resolveMenuRef(item))
  if (!node) {
    return undefined
  }
  const canonical = resolveMenuRef(node)
  return canonical ? badges.get(canonical) : undefined
}

/**
 * 设置 / 修改 / 清除菜单徽标。badge 为 null 时清除。
 * 目标菜单尚未加载时徽标挂起记录，菜单加载后按引用自然命中。
 */
export function setMenuBadge(ref: string, badge: MenuBadge | null): void {
  const key = String(ref || '').trim()
  if (!key) {
    return
  }
  if (badge) {
    badges.set(key, badge)
  } else {
    badges.delete(key)
  }
  notify()
}

export function getMenuBadge(ref: string): MenuBadge | undefined {
  const key = String(ref || '').trim()
  if (!key) {
    return undefined
  }
  if (badges.has(key)) {
    return badges.get(key)
  }
  const node = findMenuItemInTrees(readMenuTree(), key)
  if (!node) {
    return undefined
  }
  const canonical = resolveMenuRef(node)
  return canonical ? badges.get(canonical) : undefined
}

function clearSubtreeBadges(node: MenuItem) {
  for (const key of MENU_REF_KEYS) {
    const value = node[key]
    if (typeof value === 'string' && value) {
      badges.delete(value)
    }
  }
  for (const child of node.children || []) {
    clearSubtreeBadges(child)
  }
}

// ============================================================================
// 菜单树操作（查询 / 遍历 / 增删）
// ============================================================================

function mergeBadge(item: MenuItem): MenuItemInfo {
  return { ...item, badge: getMenuBadgeForItem(item) }
}

function mergeTree(items: MenuItem[] | undefined): MenuItemInfo[] {
  return (items || []).map((item) => {
    const merged = mergeBadge(item)
    if (item.children && item.children.length > 0) {
      merged.children = mergeTree(item.children)
    }
    return merged
  })
}

function flattenWithLevel(items: MenuItemInfo[], level: number, result: MenuItemInfo[]) {
  for (const item of items) {
    const entry = { ...item, level }
    result.push(entry)
    if (item.children && item.children.length > 0) {
      flattenWithLevel(item.children, level + 1, result)
    }
  }
}

/**
 * 查询菜单项（含徽标），返回副本。引用可以是 fullName/path/url/fullPath/router_id/name 任一。
 */
export function getMenu(ref: string): MenuItemInfo | undefined {
  const key = String(ref || '').trim()
  if (!key) {
    return undefined
  }
  const node = findMenuItemInTrees(readMenuTree(), key)
  if (!node) {
    return undefined
  }
  return mergeBadge(cloneMenuItems([node])[0])
}

/**
 * 查询 / 遍历菜单树（含徽标）。
 * - flat: false（默认）返回 { main, secondary }，仅包含请求的 scope；
 * - flat: true 返回按 scope 顺序深度优先拍平后的数组，每项带 level 字段。
 */
export function getMenus(options: GetMenusOptions = {}): MenuItemInfo[] | MenuTreeResult {
  const { scope = 'all', flat = false } = options
  const tree = readMenuTree()

  const result: MenuTreeResult = {}
  if (scope === 'main' || scope === 'all') {
    result.main = mergeTree(tree.globalMenu)
  }
  if (scope === 'secondary' || scope === 'all') {
    result.secondary = mergeTree(tree.globalSubNav)
  }

  if (!flat) {
    return result
  }

  const flattened: MenuItemInfo[] = []
  if (result.main) {
    flattenWithLevel(result.main, 1, flattened)
  }
  if (result.secondary) {
    flattenWithLevel(result.secondary, 1, flattened)
  }
  return flattened
}

/**
 * 访问器遍历菜单（含徽标）。visitor 返回 false 时跳过该子树。
 */
export function traverseMenus(
  visitor: (item: MenuItemInfo, parents: MenuItemInfo[]) => boolean | void,
  options: { scope?: MenuScope } = {}
): void {
  const { scope = 'all' } = options
  const tree = readMenuTree()
  const visit = (items: MenuItem[], parents: MenuItemInfo[]) => {
    for (const item of items) {
      const merged = mergeBadge(item)
      const shouldContinue = visitor(merged, parents) !== false
      if (shouldContinue && item.children && item.children.length > 0) {
        visit(item.children, [...parents, merged])
      }
    }
  }
  if (scope === 'main' || scope === 'all') {
    visit(tree.globalMenu, [])
  }
  if (scope === 'secondary' || scope === 'all') {
    visit(tree.globalSubNav, [])
  }
}

function dispatchMenuUpdate(main: MenuItem[], secondary: MenuItem[]) {
  return dispatch('user/updateMenu', { main, secondary })
}

/**
 * 运行时添加菜单项（仅前端运行时，刷新后回退后端菜单树）。
 * 冲突（引用已存在 / 父节点不存在 / 缺引用）时操作拒绝并返回 false。
 */
export function addMenuItem(options: AddMenuItemOptions): boolean {
  const { scope, item, parentFullName, index } = options
  if (!item || typeof item !== 'object' || !resolveMenuRef(item)) {
    return false
  }
  const ref = resolveMenuRef(item) as string
  if (findMenuItem(readAllMenuItems(), ref)) {
    return false
  }

  const tree = readMenuTree()
  const target = scope === 'secondary' ? 'secondary' : 'main'
  const sourceKey = target === 'secondary' ? 'globalSubNav' : 'globalMenu'
  const cloned = cloneMenuItems(tree[sourceKey])

  let insertList = cloned
  if (parentFullName) {
    const parent = findMenuItem(cloned, parentFullName)
    if (!parent) {
      return false
    }
    parent.children = parent.children || []
    insertList = parent.children
  }
  const position = typeof index === 'number' ? Math.max(0, Math.min(index, insertList.length)) : insertList.length
  insertList.splice(position, 0, cloneMenuItems([item])[0])

  const nextTree = { main: tree.globalMenu, secondary: tree.globalSubNav }
  nextTree[target] = cloned
  dispatchMenuUpdate(nextTree.main, nextTree.secondary)
  return true
}

/**
 * 运行时移除菜单项（含子树），并级联清理该子树全部徽标。
 * 未找到时返回 false。
 */
export function removeMenuItem(ref: string): boolean {
  const key = String(ref || '').trim()
  if (!key) {
    return false
  }
  const tree = readMenuTree()

  const removeFromList = (list: MenuItem[]): { list: MenuItem[]; removed: MenuItem | null } => {
    const index = list.findIndex((item) => MENU_REF_KEYS.some((k) => item[k] === key))
    if (index > -1) {
      return { list: [...list.slice(0, index), ...list.slice(index + 1)], removed: list[index] }
    }
    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      if (!item.children || item.children.length === 0) {
        continue
      }
      const childResult = removeFromList(item.children)
      if (childResult.removed) {
        return {
          list: [...list.slice(0, i), { ...item, children: childResult.list }, ...list.slice(i + 1)],
          removed: childResult.removed,
        }
      }
    }
    return { list, removed: null }
  }

  const mainResult = removeFromList(tree.globalMenu)
  if (mainResult.removed) {
    clearSubtreeBadges(mainResult.removed)
    dispatchMenuUpdate(mainResult.list, tree.globalSubNav)
    return true
  }
  const secondaryResult = removeFromList(tree.globalSubNav)
  if (secondaryResult.removed) {
    clearSubtreeBadges(secondaryResult.removed)
    dispatchMenuUpdate(tree.globalMenu, secondaryResult.list)
    return true
  }
  return false
}

// ============================================================================
// 用户菜单注册表
// ============================================================================

function rebuildUserMenuSnapshot() {
  userMenuSnapshot = [...userMenuEntries]
    .sort((a, b) => (a.item.order ?? DEFAULT_ORDER) - (b.item.order ?? DEFAULT_ORDER) || a.seq - b.seq)
    .map((entry) => entry.item)
}

/**
 * 注册用户菜单项，返回 id。
 * - 提供 key 且已存在同 key 条目时视为覆盖（保留原 id，幂等）；
 * - 提供 id 且已存在时同样视为覆盖。
 * @param builtin 内部参数：内置项标记，登出清理时保留
 */
export function registerUserMenuItem(item: UserMenuItem, owner?: string, builtin = false): string {
  if (!item || typeof item !== 'object' || typeof item.onClick !== 'function' || !item.title) {
    return ''
  }
  const existing =
    (item.id && userMenuEntries.find((entry) => entry.item.id === item.id)) ||
    (item.key && userMenuEntries.find((entry) => entry.item.key === item.key))
  if (existing) {
    existing.item = { ...existing.item, ...item, id: existing.item.id }
    existing.owner = owner ?? existing.owner
    existing.builtin = existing.builtin || builtin
    rebuildUserMenuSnapshot()
    notify()
    return existing.item.id as string
  }

  const id = item.id || `user-menu-${++userMenuSeq}`
  userMenuEntries.push({ item: { ...item, id }, owner, builtin, seq: ++userMenuSeq })
  rebuildUserMenuSnapshot()
  notify()
  return id
}

export function registerBuiltinUserMenuItem(item: UserMenuItem): string {
  return registerUserMenuItem(item, undefined, true)
}

export function unregisterUserMenuItem(id: string): void {
  const index = userMenuEntries.findIndex((entry) => entry.item.id === id)
  if (index === -1) {
    return
  }
  userMenuEntries.splice(index, 1)
  rebuildUserMenuSnapshot()
  notify()
}

/**
 * 按 owner 批量移除（供微应用卸载清理等场景）。
 */
export function unregisterUserMenuItemsByOwner(owner: string): void {
  if (!owner) {
    return
  }
  const before = userMenuEntries.length
  for (let i = userMenuEntries.length - 1; i >= 0; i--) {
    if (userMenuEntries[i].owner === owner) {
      userMenuEntries.splice(i, 1)
    }
  }
  if (userMenuEntries.length !== before) {
    rebuildUserMenuSnapshot()
    notify()
  }
}

/**
 * 查询 / 遍历已注册用户菜单项（按 order 升序，含内置项）。
 * 返回同一快照引用，仅注册表变化时更新。
 */
export function getRegisteredUserMenuItems(): UserMenuItem[] {
  return userMenuSnapshot
}

// ============================================================================
// 生命周期清理
// ============================================================================

/**
 * 用户登出清理：清空全部徽标与全部非内置用户菜单项；内置项保持幂等。
 */
export function resetMenuExtensionRuntime() {
  badges.clear()
  for (let i = userMenuEntries.length - 1; i >= 0; i--) {
    if (!userMenuEntries[i].builtin) {
      userMenuEntries.splice(i, 1)
    }
  }
  rebuildUserMenuSnapshot()
  notify()
}

let logoutHookInstalled = false
function ensureLogoutHook() {
  if (logoutHookInstalled) {
    return
  }
  logoutHookInstalled = true
  subscribeState((mutation) => {
    if (mutation?.type === 'user/LOGOUT' || mutation?.type === '@@store/reset') {
      resetMenuExtensionRuntime()
    }
  })
}

export function installMenuExtensionStoreLifecycle() {
  ensureLogoutHook()
}

// ============================================================================
// 对外 API
// ============================================================================

export const menu = {
  setMenuBadge,
  getMenuBadge,
  getMenu,
  getMenus,
  traverseMenus,
  addMenuItem,
  removeMenuItem,
}

export const userMenu = {
  register: (item: UserMenuItem, owner?: string) => registerUserMenuItem(item, owner),
  unregister: unregisterUserMenuItem,
  getItems: getRegisteredUserMenuItems,
  unregisterAll: unregisterUserMenuItemsByOwner,
}
