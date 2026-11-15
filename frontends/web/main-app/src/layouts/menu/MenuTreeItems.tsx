import { useEffect, useMemo, useRef, useState } from 'react'

import { openMenuItem } from '@/common/menus'

import { Icon } from '../Icon'
import { MenuBadge } from './MenuBadge'
import { AUTO_EXPAND_ACTIVE_MENU_ON_TAB_SWITCH } from './menuBehavior'
import { resolveMenuItemIcon } from './menuIcon'
import { buildMenuSyncKey, expandActiveMenuPath, getActiveLeafKey, getMenuBreadcrumbKeys, isMenuItemInTrail, isMenuTabChanged } from './menuState'
import type { MenuItem } from './menuTypes'

interface MenuTreeItemsProps {
  menuArr?: MenuItem[]
  level?: number
  breadcrumb?: any[]
  activeTabId?: string
  theme?: string
  className?: string
  onItemMouseEnter?: (payload: { event: React.MouseEvent<any>; item: MenuItem; index: number; level: number }) => void
  onItemMouseLeave?: () => void
  onMenuItemClick?: () => void
}

export function MenuTreeItems({
  menuArr = [],
  level = 0,
  breadcrumb = [],
  activeTabId = '',
  theme = '',
  className = '',
  onItemMouseEnter,
  onItemMouseLeave,
  onMenuItemClick,
}: MenuTreeItemsProps) {
  const [, setRenderVersion] = useState(0)
  const previousSyncKeyRef = useRef('')
  const breadcrumbKeys = useMemo(() => getMenuBreadcrumbKeys(breadcrumb), [breadcrumb])
  const defaultActive = useMemo(() => getActiveLeafKey(breadcrumbKeys), [breadcrumbKeys])
  const activeMenuSyncKey = useMemo(
    () => buildMenuSyncKey(activeTabId, breadcrumbKeys),
    [activeTabId, breadcrumbKeys]
  )

  useEffect(() => {
    const previousSyncKey = previousSyncKeyRef.current
    const tabChanged = isMenuTabChanged(activeMenuSyncKey, previousSyncKey)

    if (tabChanged && !AUTO_EXPAND_ACTIVE_MENU_ON_TAB_SWITCH) {
      previousSyncKeyRef.current = activeMenuSyncKey
      return
    }

    // 标签身份与路由可能分两次更新，最终导航路径变化时也需重新展开。
    const navigationChanged = Boolean(previousSyncKey && previousSyncKey !== activeMenuSyncKey)
    if (expandActiveMenuPath(menuArr, breadcrumbKeys, { force: AUTO_EXPAND_ACTIVE_MENU_ON_TAB_SWITCH && navigationChanged })) {
      setRenderVersion((current) => current + 1)
    }

    previousSyncKeyRef.current = activeMenuSyncKey
  }, [activeMenuSyncKey, breadcrumbKeys, menuArr])

  function isItemActive(item: MenuItem) {
    return isMenuItemInTrail(item, breadcrumbKeys)
  }

  function isOpened(item: MenuItem) {
    return Boolean(item?.opened)
  }

  function getItemKey(item: MenuItem) {
    return String(item.key || item.path || item.title)
  }

  function toggleItem(item: MenuItem) {
    item.opened = !isOpened(item)
    setRenderVersion((current) => current + 1)
  }

  return (
    <ul className={['tree-menu', `tree-menu--level-${level}`, className].filter(Boolean).join(' ')}>
      {menuArr.map((item, index) =>
        item.children && item.children.length ? (
          <li
            key={getItemKey(item)}
            className={[
              'tree-menu__item',
              'tree-menu__item--parent',
              isOpened(item) ? 'is-opened' : '',
              defaultActive === item.key ? 'is-active' : isItemActive(item) ? 'is-ancestor' : '',
            ].filter(Boolean).join(' ')}
          >
            <div
              className="tree-menu__link"
              onMouseEnter={(event) => onItemMouseEnter?.({ event, item, index, level })}
              onMouseLeave={() => onItemMouseLeave?.()}
            >
              <button
                type="button"
                className="tree-menu__content"
                aria-expanded={item.url || item.path || item.fullPath ? undefined : isOpened(item)}
                onClick={(event) => {
                  event.stopPropagation()
                  if (item.url || item.path || item.fullPath) {
                    void openMenuItem(item)
                    onMenuItemClick?.()
                  } else {
                    toggleItem(item)
                  }
                }}
              >
                <Icon icon={resolveMenuItemIcon(item)} theme={theme} active={item.active} className="tree-menu__icon" iconWidth="18px" />
                <span className="tree-menu__title">{item.title}</span>
                <MenuBadge item={item} />
              </button>
              <button
                type="button"
                className="tree-menu__arrow"
                aria-label={`${isOpened(item) ? '收起' : '展开'}${item.title || ''}`}
                aria-expanded={isOpened(item)}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleItem(item)
                }}
              >
                <Icon icon="icon-menu-arrow" className="tree-menu__arrow-icon" iconWidth="16px" />
              </button>
            </div>
            <div className={`tree-menu__submenu-wrapper${isOpened(item) ? ' is-opened' : ''}`} aria-hidden={!isOpened(item)}>
              <div className="tree-menu__submenu-inner">
                <MenuTreeItems
                  menuArr={item.children}
                  theme={theme}
                  level={level + 1}
                  breadcrumb={breadcrumb}
                  activeTabId={activeTabId}
                  className="tree-menu__submenu"
                  onMenuItemClick={onMenuItemClick}
                />
              </div>
            </div>
          </li>
        ) : (
          <li
            key={getItemKey(item)}
            className={[
              'tree-menu__item',
              'tree-menu__item--leaf',
              defaultActive === item.key ? 'is-active' : '',
            ].filter(Boolean).join(' ')}
          >
            <button
              type="button"
              className="tree-menu__link"
              onClick={() => {
                void openMenuItem(item)
                onMenuItemClick?.()
              }}
            >
              <div className="tree-menu__content">
                <Icon icon={resolveMenuItemIcon(item)} theme={theme} active={item.active} className="tree-menu__icon" iconWidth="18px" />
                <span className="tree-menu__title">{item.title}</span>
                <MenuBadge item={item} />
              </div>
            </button>
          </li>
        )
      )}
    </ul>
  )
}
