import { useMemo, useRef, useState } from 'react'

import { getItemFromSession } from '@/utils/sessionStorage'

import { MenuFloatMenu } from './MenuFloatMenu'
import { MenuTreeItems } from './MenuTreeItems'
import type { MenuItem } from './menuTypes'

const FLOAT_MENU_INLINE_GAP = 12

interface MenuTreeProps {
  theme?: string
  menu?: any
  breadcrumb?: any[]
  activeTabId?: string
  sidebarExpanded?: boolean
}

export function MenuTree({ theme = '', menu = {}, breadcrumb = [], activeTabId = '', sidebarExpanded = false }: MenuTreeProps) {
  const treeSidebarRef = useRef<HTMLDivElement | null>(null)
  const [showFloatMenuFlag, setShowFloatMenuFlag] = useState(false)
  const [floatMenuData, setFloatMenuData] = useState<MenuItem>({})
  const [position, setPosition] = useState<any>({})
  const [scrollHeight, setScrollHeight] = useState(0)
  const timerRef = useRef<any>(null)
  const localSidebarExpanded = useMemo(() => !getItemFromSession('siderbarCollapsed'), [])
  const menus = menu.globalMenu || []

  function getSidebarWidth() {
    return treeSidebarRef.current?.clientWidth || 200
  }

  function showFloatMenu(event: React.MouseEvent, item: MenuItem, index: number) {
    clearTimeout(timerRef.current)
    const top = (event.currentTarget as HTMLDivElement).getBoundingClientRect().top
    const h = document.documentElement.clientHeight || document.body.clientHeight
    const treeHeight = 64 + ((item.children?.length || 0) * 42)
    const bottomDistance = h - treeHeight - top
    const nextTop = treeHeight < h ? (bottomDistance < 0 ? top + bottomDistance - 20 : top) : 0
    setPosition({ top: nextTop, left: getSidebarWidth() + FLOAT_MENU_INLINE_GAP, zIndex: 3000 })
    setScrollHeight(treeHeight < h ? treeHeight : h)
    setFloatMenuData({ ...item, parentIndex: index })
    setShowFloatMenuFlag(true)
  }

  return (
    <div ref={treeSidebarRef} className={`app-menu${localSidebarExpanded ? ' is-open' : ''}`}>
      <MenuTreeItems
        menuArr={menus}
        theme={theme}
        level={0}
        breadcrumb={breadcrumb}
        activeTabId={activeTabId}
        onItemMouseEnter={({ event, item, level, index }) => {
          if (level !== 0 || sidebarExpanded) return
          showFloatMenu(event, item, index)
        }}
        onItemMouseLeave={() => {
          clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => {
            setPosition((current: any) => ({ ...current, zIndex: -1 }))
            setShowFloatMenuFlag(false)
          }, 100)
        }}
        onMenuItemClick={() => setShowFloatMenuFlag(false)}
      />
      {showFloatMenuFlag ? (
        <MenuFloatMenu
          floatMenuData={floatMenuData}
          theme={theme}
          position={position}
          breadcrumb={breadcrumb}
          activeTabId={activeTabId}
          sidebarExpanded={localSidebarExpanded}
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
