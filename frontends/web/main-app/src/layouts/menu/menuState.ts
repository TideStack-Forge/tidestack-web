import type { MenuItem } from './menuTypes'

export function getMenuBreadcrumbKeys(breadcrumb: Array<{ key?: string }> = []): string[] {
  return breadcrumb
    .map((item) => item?.key)
    .filter(Boolean)
    .map((key) => String(key))
}

export function getActiveLeafKey(breadcrumbKeys: string[] = []): string {
  return breadcrumbKeys[breadcrumbKeys.length - 1] || ''
}

export function buildMenuSyncKey(activeTabId = '', breadcrumbKeys: string[] = []): string {
  return [activeTabId || '', breadcrumbKeys.join('|')].join('|')
}

export function isMenuTabChanged(nextKey = '', previousKey = ''): boolean {
  if (!previousKey) return false
  const [nextTabId] = `${nextKey}`.split('|')
  const [previousTabId] = `${previousKey}`.split('|')
  return Boolean(nextTabId && previousTabId && nextTabId !== previousTabId)
}

export function isMenuItemInTrail(item: MenuItem | undefined, breadcrumbKeys: string[] = []): boolean {
  if (!item?.key) return false
  return breadcrumbKeys.includes(String(item.key))
}

export function expandActiveMenuPath(
  menuArr: MenuItem[] = [],
  breadcrumbKeys: string[] = [],
  { force = false }: { force?: boolean } = {}
): boolean {
  let changed = false

  for (const item of menuArr) {
    if (!item?.children?.length) continue

    if (
      isMenuItemInTrail(item, breadcrumbKeys) &&
      (force || !Object.prototype.hasOwnProperty.call(item, 'opened'))
    ) {
      if (item.opened !== true) {
        changed = true
      }
      item.opened = true
    }

    if (expandActiveMenuPath(item.children, breadcrumbKeys, { force })) {
      changed = true
    }
  }

  return changed
}
