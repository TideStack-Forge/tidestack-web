import type { CSSProperties } from 'react'

import { resolveDisplacedTabOffset } from './tabsDragMath'
import type { TabDropTarget, TabItem } from './tabsDragMath'

export type TabReleaseSettleState = {
  tabId: string
  offsetX: number
  phase: 'commit' | 'revert'
  stage: 'queued' | 'settling'
}

type TabTransformStyle = CSSProperties & {
  '--app-tabs-drag-offset': string
}

export type TabDragPresentation = {
  style?: TabTransformStyle
  isDragging: boolean
  settleClassName: string
}

type ResolveTabDragPresentationOptions = {
  tabId: string
  tabIndex: number
  tabsList: TabItem[]
  draggingTabId: string
  draggingTabIndex: number
  draggingPointerOffsetX: number
  draggingTabOffset: number
  dropTarget: TabDropTarget | null
  committedTabMoveReflected: boolean
  releaseSettleState: TabReleaseSettleState | null
}

export function resolveTabDragPresentation({
  tabId,
  tabIndex,
  tabsList,
  draggingTabId,
  draggingTabIndex,
  draggingPointerOffsetX,
  draggingTabOffset,
  dropTarget,
  committedTabMoveReflected,
  releaseSettleState,
}: ResolveTabDragPresentationOptions): TabDragPresentation {
  let style: TabTransformStyle | undefined

  if (draggingTabId === tabId) {
    style = {
      ['--app-tabs-drag-offset' as const]: `${draggingPointerOffsetX}px`,
    }
  } else if (releaseSettleState?.tabId === tabId) {
    style = {
      ['--app-tabs-drag-offset' as const]:
        releaseSettleState.stage === 'queued' ? `${releaseSettleState.offsetX}px` : '0px',
    }
  } else if (
    !committedTabMoveReflected &&
    draggingTabId &&
    dropTarget &&
    draggingTabOffset !== 0
  ) {
    const targetIndex = tabsList.findIndex((tab) => tab.id === dropTarget.tabId)
    if (
      draggingTabIndex !== -1 &&
      targetIndex !== -1 &&
      draggingTabIndex !== targetIndex
    ) {
      const translateX = resolveDisplacedTabOffset(
        tabIndex,
        draggingTabIndex,
        targetIndex,
        dropTarget.position,
        draggingTabOffset
      )
      if (translateX !== 0) {
        style = {
          ['--app-tabs-drag-offset' as const]: `${translateX}px`,
        }
      }
    }
  }

  return {
    style,
    isDragging: draggingTabId === tabId,
    settleClassName:
      releaseSettleState?.tabId === tabId
        ? `is-settling is-settling--${releaseSettleState.phase}`
        : '',
  }
}
