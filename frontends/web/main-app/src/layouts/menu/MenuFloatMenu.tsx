import { useEffect, useState } from 'react'

import { openMenuItem } from '@/common/menus'

import { Icon } from '../Icon'
import { MenuBadge } from './MenuBadge'
import { MenuFloatItem } from './MenuFloatItem'
import { MenuFloatSubmenu } from './MenuFloatSubmenu'
import { resolveMenuItemIcon } from './menuIcon'
import { getMenuBreadcrumbKeys, isMenuItemInTrail } from './menuState'
import type { MenuItem } from './menuTypes'

interface MenuFloatMenuProps {
  floatMenuData: MenuItem
  position: { top?: number; left?: number; zIndex?: number }
  theme?: string
  breadcrumb?: any[]
  activeTabId?: string
  sidebarExpanded?: boolean
  onMouseEnterFloatMenu: () => void
  onMouseLeaveFloatMenu: () => void
  onMenuItemClick: () => void
}

export function MenuFloatMenu({
  floatMenuData,
  position,
  theme = '',
  breadcrumb = [],
  sidebarExpanded = false,
  onMouseEnterFloatMenu,
  onMouseLeaveFloatMenu,
  onMenuItemClick,
}: MenuFloatMenuProps) {
  const [screenHeight, setScreenHeight] = useState(0)
  const breadcrumbKeys = getMenuBreadcrumbKeys(breadcrumb)

  useEffect(() => {
    setScreenHeight(document.documentElement.clientHeight || document.body.clientHeight)
  }, [])

  const showMenuName = !(floatMenuData && floatMenuData.children && floatMenuData.children.length > 0)
  const isActiveMenu = (item: MenuItem) => isMenuItemInTrail(item, breadcrumbKeys)

  return (
    <div className="app-float-menu" style={{ position: 'fixed', top: `${position.top}px`, left: `${position.left}px`, zIndex: position.zIndex as number }}>
      {showMenuName ? (
        !sidebarExpanded ? <div className="app-float-menu__title">{floatMenuData.title}</div> : null
      ) : (
        <div className="app-float-menu__panel" style={{ maxHeight: `${screenHeight}px` }} onMouseEnter={onMouseEnterFloatMenu} onMouseLeave={onMouseLeaveFloatMenu}>
          <div className="app-float-menu__header" onClick={() => {
            if (!(floatMenuData.url || floatMenuData.path || floatMenuData.fullPath)) return
            void openMenuItem(floatMenuData)
            onMenuItemClick()
          }}>
            <Icon icon={resolveMenuItemIcon(floatMenuData)} theme={theme} active={floatMenuData.active} className="app-float-menu__header-icon" iconWidth="18px" />
            <p className="app-float-menu__header-title">{floatMenuData.title}</p>
            <MenuBadge item={floatMenuData} />
          </div>
          {floatMenuData.children?.map((item, index) =>
            item.children && item.children.length > 0 ? (
              <MenuFloatSubmenu
                key={`${item.title}${item.path}${index}-branch`}
                data={item}
                theme={theme}
                activeMenuFn={isActiveMenu}
                onMenuItemClick={onMenuItemClick}
              />
            ) : (
              <MenuFloatItem
                key={`${item.title}${item.path}${index}-leaf`}
                className={isActiveMenu(item) ? 'is-active' : ''}
                onClick={() => {
                  void openMenuItem(item)
                  onMenuItemClick()
                }}
              >
                <Icon icon={resolveMenuItemIcon(item)} theme={theme} className="app-float-menu__item-icon" iconWidth="18px" />
                <span className="app-float-menu__item-text">{item.title}</span>
                <MenuBadge item={item} />
              </MenuFloatItem>
            )
          )}
        </div>
      )}
    </div>
  )
}
