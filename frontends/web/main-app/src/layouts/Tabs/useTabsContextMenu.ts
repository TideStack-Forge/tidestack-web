import type { MouseEvent as ReactMouseEvent } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { TabItem, TabsRuntimeActions } from './types'
import { runTabsAction } from './tabsActionGuard'

type UseTabsContextMenuOptions = {
  tabsList: TabItem[]
  actions: TabsRuntimeActions
}

export function useTabsContextMenu({ tabsList, actions }: UseTabsContextMenuOptions) {
  const [visible, setVisible] = useState(false)
  const [selectedTabId, setSelectedTabId] = useState('')
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const selectedTab = useMemo(
    () => tabsList.find((tab) => tab.id === selectedTabId) || null,
    [selectedTabId, tabsList]
  )

  const close = useCallback(() => {
    setVisible(false)
  }, [])

  const open = useCallback((event: ReactMouseEvent<HTMLElement>, tabId: string) => {
    event.preventDefault()
    const menuMinWidth = 124
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth
    const maxLeft = Math.max(0, viewportWidth - menuMinWidth)

    setPosition({
      left: event.clientX > maxLeft ? maxLeft : event.clientX,
      top: event.clientY,
    })
    setSelectedTabId(tabId)
    setVisible(true)
  }, [])

  const closeTab = useCallback(
    (tabId: string) => {
      runTabsAction('close tab', () => actions.closeTab(tabId))
      close()
    },
    [actions, close]
  )

  const closeSelectedTab = useCallback(() => {
    if (selectedTab?.isFixed) {
      return
    }

    closeTab(selectedTabId)
  }, [closeTab, selectedTab?.isFixed, selectedTabId])

  const toggleSelectedTabFixed = useCallback(() => {
    runTabsAction('toggle fixed tab', () => actions.toggleFixedTab(selectedTabId))
    close()
  }, [actions, close, selectedTabId])

  const closeOtherTabs = useCallback(() => {
    runTabsAction('close other tabs', () => actions.closeOtherTabs(selectedTabId))
    close()
  }, [actions, close, selectedTabId])

  const closeRightTabs = useCallback(() => {
    runTabsAction('close right tabs', () => actions.closeRightTabs(selectedTabId))
    close()
  }, [actions, close, selectedTabId])

  useEffect(() => {
    function handleWindowClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      if (!target?.closest('.app-tabs__menu') && !target?.closest('.app-tabs__item')) {
        close()
      }
    }

    window.addEventListener('click', handleWindowClick)
    return () => {
      window.removeEventListener('click', handleWindowClick)
    }
  }, [close])

  return {
    visible,
    selectedTabId,
    selectedTab,
    position,
    open,
    close,
    closeTab,
    closeSelectedTab,
    toggleSelectedTabFixed,
    closeOtherTabs,
    closeRightTabs,
  }
}

export type TabsContextMenuController = ReturnType<typeof useTabsContextMenu>
