import { i18nService } from '@/common/i18n'
import { useEffect, useMemo, useRef, useState } from 'react'

import { alert } from '@/common/modal'
import { openMenuItem } from '@/common/menus'
import systemApi from '@/common/api/system'
import { getItemFromSession } from '@/utils/sessionStorage'
import { subscribeUserTopic } from '@/utils/Stomp'

import { Icon } from '../Icon'
import { MenuBadge } from './MenuBadge'
import { MenuFloatMenu } from './MenuFloatMenu'
import { resolveMenuItemIcon } from './menuIcon'
import { getMenuBreadcrumbKeys } from './menuState'
import type { MenuItem } from './menuTypes'

const FLOAT_MENU_INLINE_GAP = 12

interface MenuDualModeProps {
  appName?: string
  theme?: string
  menu?: any
  breadcrumb?: any[]
  activeTabId?: string
  sidebarExpanded?: boolean
  appConfig?: any
}

export function MenuDualMode({ appName = '', theme = '', menu = {}, breadcrumb = [], appConfig = {} }: MenuDualModeProps) {
  const sidebarRef = useRef<HTMLDivElement | null>(null)
  const [showFloatMenuFlag, setShowFloatMenuFlag] = useState(false)
  const [floatMenuData, setFloatMenuData] = useState<MenuItem>({})
  const [position, setPosition] = useState<any>({})
  const [scrollHeight, setScrollHeight] = useState(0)
  const [activeMenuKey, setActiveMenuKey] = useState('')
  const [sidebarExpanded] = useState(getItemFromSession('sidebarStatus') ? !!+getItemFromSession('sidebarStatus') : false)
  const timerRef = useRef<any>(null)

  const menus = useMemo(() => menu.globalMenu || [], [menu])
  const breadcrumbKeys = useMemo(() => getMenuBreadcrumbKeys(breadcrumb), [breadcrumb])
  const shouldSubscribeRealTime = appConfig && appConfig['notification.unreadCount.realtime'] === true

  useEffect(() => {
    setActiveMenuKey(breadcrumbKeys[0] || '')
  }, [breadcrumbKeys])

  useEffect(() => {
    void systemApi.getNotificationNumbers().catch(() => undefined)
    if (!shouldSubscribeRealTime) return
    subscribeUserTopic('/notification/unread-count', () => undefined)
  }, [shouldSubscribeRealTime])

  function getSidebarWidth() {
    return sidebarRef.current?.clientWidth || 72
  }

  function showFloatMenu(event: React.MouseEvent, item: MenuItem, index: number) {
    clearTimeout(timerRef.current)
    const top = (event.currentTarget as HTMLLIElement).getBoundingClientRect().top
    const h = document.documentElement.clientHeight || document.body.clientHeight
    const treeHeight = 64 + ((item.children?.length || 0) * 42)
    const bottomDistance = h - treeHeight - top
    const nextTop = treeHeight < h ? (bottomDistance < 0 ? top + bottomDistance - 20 : top) : 0
    setPosition({ top: nextTop, left: getSidebarWidth() + FLOAT_MENU_INLINE_GAP, zIndex: 3000 })
    setScrollHeight(treeHeight < h ? treeHeight : h)
    setFloatMenuData({ ...item, parentIndex: index })
    setShowFloatMenuFlag(true)
  }

  async function toggleSubmenu(item: MenuItem) {
    setShowFloatMenuFlag(false)
    if (item.url && (!item.children || !item.children.length)) {
      await openMenuItem(item)
      return
    }
    if (!item.url && (!item.children || !item.children.length)) {
      await alert(
        i18nService.getManager().tCommon('menu.invalidUrl', '配置的菜单地址是无效地址'),
        i18nService.getManager().tCommon('error.title', '错误')
      )
      return
    }
    if (
      item.children &&
      item.children.length === 1 &&
      !item.children[0].url &&
      (!item.children[0].children || !item.children[0].children.length)
    ) {
      await alert(
        i18nService.getManager().tCommon('menu.invalidUrl', '配置的菜单地址是无效地址'),
        i18nService.getManager().tCommon('error.title', '错误')
      )
      return
    }
    if (item.children && item.children.length === 1 && item.children[0].url && (!item.children[0].children || !item.children[0].children.length)) {
      await openMenuItem(item)
    }
    setActiveMenuKey(String(item.key || ''))
  }

  return (
    <div ref={sidebarRef} className="app-menu">
      <ul className="dual-mode-menu">
        {menus.map((menuItem: MenuItem, index: number) => (
          <li
            key={index}
            className={`dual-mode-menu__item${activeMenuKey && activeMenuKey === String(menuItem.key || '') ? ' is-active' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              void toggleSubmenu(menuItem)
            }}
            onMouseEnter={(event) => showFloatMenu(event, menuItem, index)}
            onMouseLeave={() => {
              clearTimeout(timerRef.current)
              timerRef.current = setTimeout(() => {
                setPosition((current: any) => ({ ...current, zIndex: -1 }))
                setShowFloatMenuFlag(false)
              }, 100)
            }}
          >
            <div className="dual-mode-menu__link">
              <Icon icon={resolveMenuItemIcon(menuItem)} theme={theme} active={menuItem.active} className="dual-mode-menu__icon" />
              <span className="dual-mode-menu__text">{menuItem.title}</span>
              <MenuBadge item={menuItem} />
            </div>
          </li>
        ))}
      </ul>
      {showFloatMenuFlag ? (
        <MenuFloatMenu
          floatMenuData={floatMenuData}
          theme={theme}
          position={position}
          breadcrumb={breadcrumb}
          sidebarExpanded={sidebarExpanded}
          onMouseEnterFloatMenu={() => {
            clearTimeout(timerRef.current)
            setShowFloatMenuFlag(true)
          }}
          onMouseLeaveFloatMenu={() => {
            clearTimeout(timerRef.current)
            timerRef.current = setTimeout(() => {
              setPosition((current: any) => ({ ...current, zIndex: -1 }))
              setShowFloatMenuFlag(false)
            }, 100)
          }}
          onMenuItemClick={() => setShowFloatMenuFlag(false)}
        />
      ) : null}
    </div>
  )
}
