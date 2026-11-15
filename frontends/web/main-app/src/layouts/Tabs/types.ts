import type { TabDropPosition, TabItem } from './tabsDragMath'

export interface TabsRuntimeActions {
  switchTab: (tabId: string) => unknown
  closeTab: (tabId: string) => unknown
  closeOtherTabs: (tabId: string) => unknown
  closeRightTabs: (tabId: string) => unknown
  toggleFixedTab: (tabId: string) => unknown
  moveTab: (
    sourceTabId: string,
    targetTabId?: string,
    position?: TabDropPosition
  ) => Promise<boolean>
}

export type TabsLabels = {
  close: string
  toggleFixed: string
  closeOthers: string
  closeRight: string
}

export type { TabItem }
