import { useLayoutEffect, useRef, useState } from 'react'

import { openMenuItem } from '@/common/menus'

import { Icon } from '../Icon'
import { MenuBadge } from './MenuBadge'
import { resolveMenuItemIcon } from './menuIcon'
import type { MenuItem } from './menuTypes'
import { MenuFloatItem } from './MenuFloatItem'

interface MenuFloatSubmenuProps {
  data: MenuItem
  theme?: string
  activeMenuFn: (item: MenuItem) => boolean
  onMenuItemClick: () => void
}

export function MenuFloatSubmenu({ data, theme = '', activeMenuFn, onMenuItemClick }: MenuFloatSubmenuProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const subMenuRef = useRef<HTMLDivElement | null>(null)
  const [subMenuShow, setSubMenuShow] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!subMenuShow) return
    const subMenu = subMenuRef.current
    const wrapper = wrapperRef.current
    if (!subMenu || !wrapper) return
    const rect = wrapper.getBoundingClientRect()
    let top = rect.top
    const difference = window.innerHeight - (top + subMenu.clientHeight)
    if (difference < 0) {
      top = top + difference - 5
    }
    setPosition({ top, left: wrapper.offsetWidth + rect.left })
  }, [subMenuShow])

  function handleMenuItemClick(item: MenuItem) {
    void openMenuItem(item)
    onMenuItemClick()
  }

  return (
    <div
      ref={wrapperRef}
      className={`app-float-menu__submenu${activeMenuFn(data) ? ' is-active' : ''}`}
      onMouseEnter={() => setSubMenuShow(true)}
      onMouseLeave={() => setSubMenuShow(false)}
    >
      <div className="app-float-menu__submenu-title" onClick={(event) => {
        event.stopPropagation()
        if (data.url || data.path || data.fullPath) {
          handleMenuItemClick(data)
        } else {
          setSubMenuShow(true)
        }
      }}>
        <Icon icon={resolveMenuItemIcon(data)} theme={theme} className="app-float-menu__submenu-icon" iconWidth="18px" />
        <span className="app-float-menu__submenu-text">{data.title}</span>
        <MenuBadge item={data} />
        <Icon icon="icon-menu-arrow" className="app-float-menu__submenu-arrow" iconWidth="16px" />
      </div>
      {subMenuShow ? (
        <div ref={subMenuRef} className="app-float-menu__submenu-content" style={{ top: `${position.top}px`, left: `${position.left}px` }}>
          {data.children?.map((child, index) =>
            child.children && child.children.length > 0 ? (
              <MenuFloatSubmenu
                key={`${child.title}${child.path}${index}-branch`}
                data={child}
                theme={theme}
                activeMenuFn={activeMenuFn}
                onMenuItemClick={onMenuItemClick}
              />
            ) : (
              <MenuFloatItem
                key={`${child.title}${child.path}${index}-leaf`}
                className={activeMenuFn(child) ? 'is-active' : ''}
                onClick={() => handleMenuItemClick(child)}
              >
                <Icon icon={resolveMenuItemIcon(child)} theme={theme} className="app-float-menu__item-icon" iconWidth="18px" />
                <span className="app-float-menu__item-text">{child.title}</span>
                <MenuBadge item={child} />
              </MenuFloatItem>
            )
          )}
        </div>
      ) : null}
    </div>
  )
}
