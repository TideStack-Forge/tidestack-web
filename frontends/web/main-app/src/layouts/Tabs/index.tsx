import { useMemo, useRef } from 'react'

import { i18nService } from '@/common/i18n'
import tabs from '@/common/tabs'

import { TabsView } from './TabsView'
import type { TabItem, TabsLabels, TabsRuntimeActions } from './types'
import { useTabsContextMenu } from './useTabsContextMenu'
import { useTabsDrag } from './useTabsDrag'
import { useTabsOverflow } from './useTabsOverflow'

interface TabsProps {
  tabsList?: TabItem[]
  activeTabId?: string
  currentPath?: string
}

const tabsActions: TabsRuntimeActions = {
  switchTab: (tabId) => tabs.switchTab(tabId),
  closeTab: (tabId) => tabs.closeTab(tabId),
  closeOtherTabs: (tabId) => tabs.closeOtherTabs(tabId),
  closeRightTabs: (tabId) => tabs.closeRightTabs(tabId),
  toggleFixedTab: (tabId) => tabs.toggleFixedTab(tabId),
  moveTab: (sourceTabId, targetTabId, position) =>
    tabs.moveTab(sourceTabId, targetTabId, position),
}

function tCommon(key: string, defaultText: string) {
  return i18nService.getManager().tCommon(key, defaultText)
}

export function Tabs({ tabsList = [], activeTabId = '', currentPath = '' }: TabsProps) {
  const tabsRef = useRef<Array<HTMLDivElement | null>>([])
  const activeTab = useMemo(
    () =>
      tabsList.find((tab) => tab.id === activeTabId) ||
      tabsList.find((tab) => tab.path === currentPath) ||
      null,
    [activeTabId, currentPath, tabsList]
  )
  const overflow = useTabsOverflow({ tabsList, activeTab, tabsRef })
  const contextMenu = useTabsContextMenu({ tabsList, actions: tabsActions })
  const drag = useTabsDrag({
    tabsList,
    tabsRef,
    scrollWrapperRef: overflow.scrollWrapperRef,
    actions: tabsActions,
    onDragStart: contextMenu.close,
  })
  const labels: TabsLabels = {
    close: tCommon('tabs.close', '关闭'),
    toggleFixed: contextMenu.selectedTab?.isFixed
      ? tCommon('tabs.unpin', '取消固定')
      : tCommon('tabs.pin', '固定标签'),
    closeOthers: tCommon('tabs.closeOthers', '关闭其他'),
    closeRight: tCommon('tabs.closeRight', '关闭右侧标签'),
  }

  return (
    <TabsView
      tabsList={tabsList}
      activeTabId={activeTabId}
      tabsRef={tabsRef}
      labels={labels}
      overflow={overflow}
      drag={drag}
      contextMenu={contextMenu}
    />
  )
}
