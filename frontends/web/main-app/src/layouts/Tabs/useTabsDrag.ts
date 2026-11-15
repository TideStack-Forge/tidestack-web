import type {
  KeyboardEvent as ReactKeyboardEvent,
  MutableRefObject,
  TransitionEvent as ReactTransitionEvent,
} from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import {
  hasCommittedTabMoveReflected,
  resolveDraggedTabPointerOffset,
  resolveStableTabDropTarget,
  resolveTabDragAnchorOffset,
  resolveTabDropBehavior,
  tagAndTagSpacing,
} from './tabsDragMath'
import type {
  PendingCommittedTabMove,
  StableDragGeometryCache,
  TabDropPosition,
  TabDropTarget,
} from './tabsDragMath'
import { createTabDragGeometry, measureCommittedTabSettleOffset } from './tabsDragDom'
import { resolveTabDragPresentation } from './tabsDragPresentation'
import type { TabDragPresentation, TabReleaseSettleState } from './tabsDragPresentation'
import type { TabItem, TabsRuntimeActions } from './types'
import { useTabsPointerDragSession } from './useTabsPointerDragSession'
import type { PointerDragSession } from './useTabsPointerDragSession'
import { reportTabsActionFailure, runTabsAction } from './tabsActionGuard'

type PendingCommitSettleState = {
  tabId: string
  releaseLeft: number
}

type UseTabsDragOptions = {
  tabsList: TabItem[]
  tabsRef: MutableRefObject<Array<HTMLDivElement | null>>
  scrollWrapperRef: MutableRefObject<HTMLDivElement | null>
  actions: Pick<TabsRuntimeActions, 'moveTab' | 'switchTab'>
  onDragStart: () => void
}

export function useTabsDrag({
  tabsList,
  tabsRef,
  scrollWrapperRef,
  actions,
  onDragStart,
}: UseTabsDragOptions) {
  const draggingTabIdRef = useRef('')
  const stableDropTargetRef = useRef<TabDropTarget | null>(null)
  const dragGeometryCacheRef = useRef<StableDragGeometryCache | null>(null)
  const dragFrameRef = useRef<number | null>(null)
  const dragPointerXRef = useRef<number | null>(null)
  const draggingPointerOffsetXRef = useRef(0)
  const dropCommittedRef = useRef(false)
  const pendingCommittedTabMoveRef = useRef<PendingCommittedTabMove | null>(null)
  const pendingCommitSettleRef = useRef<PendingCommitSettleState | null>(null)
  const [draggingTabId, setDraggingTabId] = useState('')
  const [dropTarget, setDropTarget] = useState<TabDropTarget | null>(null)
  const [draggingPointerOffsetX, setDraggingPointerOffsetX] = useState(0)
  const [releaseSettleState, setReleaseSettleState] =
    useState<TabReleaseSettleState | null>(null)

  const finishDragState = useCallback(() => {
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current)
      dragFrameRef.current = null
    }
    draggingTabIdRef.current = ''
    dragPointerXRef.current = null
    dragGeometryCacheRef.current = null
    pendingCommittedTabMoveRef.current = null
    pendingCommitSettleRef.current = null
    draggingPointerOffsetXRef.current = 0
    setDraggingPointerOffsetX(0)
    setDraggingTabId('')
    setDropTarget(null)
    stableDropTargetRef.current = null
  }, [])

  const queueReleaseSettle = useCallback(
    (tabId: string, offsetX: number, phase: 'commit' | 'revert') => {
      if (offsetX === 0) {
        setReleaseSettleState(null)
        return
      }

      setReleaseSettleState({
        tabId,
        offsetX,
        phase,
        stage: 'queued',
      })
    },
    []
  )

  const updateDropTarget = useCallback((nextDropTarget: TabDropTarget | null) => {
    stableDropTargetRef.current = nextDropTarget
    setDropTarget((current) => {
      if (
        current?.tabId === nextDropTarget?.tabId &&
        current?.position === nextDropTarget?.position
      ) {
        return current
      }
      return nextDropTarget
    })
  }, [])

  const resolveStableDropTargetFromPointerOffset = useCallback(
    (pointerOffsetX: number) => {
      return resolveStableTabDropTarget(
        dragGeometryCacheRef.current,
        stableDropTargetRef.current,
        pointerOffsetX
      )
    },
    []
  )

  const flushDragPreviewTarget = useCallback(() => {
    dragFrameRef.current = null
    if (dragPointerXRef.current === null) {
      return
    }

    updateDropTarget(
      resolveStableDropTargetFromPointerOffset(draggingPointerOffsetXRef.current)
    )
  }, [resolveStableDropTargetFromPointerOffset, updateDropTarget])

  const scheduleStableDropTargetUpdate = useCallback(
    (clientX: number) => {
      dragPointerXRef.current = clientX
      if (dragFrameRef.current !== null) {
        return
      }

      dragFrameRef.current = requestAnimationFrame(() => {
        flushDragPreviewTarget()
      })
    },
    [flushDragPreviewTarget]
  )

  const getStableDropTargetForDrop = useCallback(
    (clientX: number, pointerOffsetX: number) => {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = null
      }
      dragPointerXRef.current = clientX

      const nextDropTarget = resolveStableDropTargetFromPointerOffset(pointerOffsetX)
      updateDropTarget(nextDropTarget)
      return nextDropTarget
    },
    [resolveStableDropTargetFromPointerOffset, updateDropTarget]
  )

  const moveDraggedTab = useCallback(
    (targetTabId?: string, position: TabDropPosition = 'before') => {
      const activeDraggingTabId = draggingTabIdRef.current
      if (!activeDraggingTabId || dropCommittedRef.current) {
        return false
      }

      const pendingCommittedTabMove = {
        sourceTabId: activeDraggingTabId,
        targetTabId,
        position,
      }
      const handleCommitResult = (didCommit: boolean) => {
        if (didCommit) {
          return
        }

        if (pendingCommittedTabMoveRef.current !== pendingCommittedTabMove) {
          return
        }
        pendingCommittedTabMoveRef.current = null
        pendingCommitSettleRef.current = null
        queueReleaseSettle(
          activeDraggingTabId,
          draggingPointerOffsetXRef.current,
          'revert'
        )
        finishDragState()
        dropCommittedRef.current = false
      }
      const handleCommitFailure = (error: unknown) => {
        reportTabsActionFailure('move tab', error)
        handleCommitResult(false)
      }

      dropCommittedRef.current = true
      pendingCommittedTabMoveRef.current = pendingCommittedTabMove
      runTabsAction(
        'move tab',
        () => actions.moveTab(activeDraggingTabId, targetTabId, position),
        handleCommitResult,
        handleCommitFailure
      )
      return true
    },
    [actions, finishDragState, queueReleaseSettle]
  )

  const handlePointerStart = useCallback(
    (session: PointerDragSession) => {
      if (dropCommittedRef.current) {
        return false
      }

      const geometryCache = createTabDragGeometry({
        tabsList,
        tabElements: tabsRef.current,
        scrollWrapper: scrollWrapperRef.current,
        draggingTabId: session.tabId,
      })
      if (!geometryCache) {
        finishDragState()
        return false
      }

      onDragStart()
      dropCommittedRef.current = false
      dragGeometryCacheRef.current = geometryCache
      draggingTabIdRef.current = session.tabId
      session.anchorOffsetX = resolveTabDragAnchorOffset(
        session.startClientX,
        geometryCache
      )
      const pointerOffsetX = resolveDraggedTabPointerOffset(
        session.lastClientX,
        geometryCache,
        session.anchorOffsetX
      )
      draggingPointerOffsetXRef.current = pointerOffsetX
      setDraggingPointerOffsetX(pointerOffsetX)
      setDraggingTabId(session.tabId)
      updateDropTarget(null)
      window.getSelection()?.removeAllRanges()
      scheduleStableDropTargetUpdate(session.lastClientX)
      return true
    },
    [
      finishDragState,
      onDragStart,
      scheduleStableDropTargetUpdate,
      scrollWrapperRef,
      tabsList,
      tabsRef,
      updateDropTarget,
    ]
  )

  const handlePointerMove = useCallback(
    (session: PointerDragSession, event: MouseEvent) => {
      const pointerOffsetX = resolveDraggedTabPointerOffset(
        event.clientX,
        dragGeometryCacheRef.current,
        session.anchorOffsetX
      )
      draggingPointerOffsetXRef.current = pointerOffsetX
      setDraggingPointerOffsetX(pointerOffsetX)
      scheduleStableDropTargetUpdate(event.clientX)
    },
    [scheduleStableDropTargetUpdate]
  )

  const handlePointerCancel = useCallback(
    (session: PointerDragSession) => {
      queueReleaseSettle(session.tabId, draggingPointerOffsetXRef.current, 'revert')
      finishDragState()
      dropCommittedRef.current = false
    },
    [finishDragState, queueReleaseSettle]
  )

  const handlePointerEnd = useCallback(
    (session: PointerDragSession, event: MouseEvent) => {
      const releasePointerOffsetX = resolveDraggedTabPointerOffset(
        event.clientX,
        dragGeometryCacheRef.current,
        session.anchorOffsetX
      )
      draggingPointerOffsetXRef.current = releasePointerOffsetX
      setDraggingPointerOffsetX(releasePointerOffsetX)

      const stableDropTarget = getStableDropTargetForDrop(
        event.clientX,
        releasePointerOffsetX
      )
      if (!stableDropTarget) {
        queueReleaseSettle(session.tabId, releasePointerOffsetX, 'revert')
        finishDragState()
        dropCommittedRef.current = false
        return
      }

      const dropBehavior = resolveTabDropBehavior(
        session.tabId,
        stableDropTarget.tabId,
        stableDropTarget.position
      )
      if (dropBehavior.type !== 'commit') {
        queueReleaseSettle(session.tabId, releasePointerOffsetX, 'revert')
        finishDragState()
        dropCommittedRef.current = false
        return
      }

      pendingCommitSettleRef.current = {
        tabId: session.tabId,
        releaseLeft:
          (dragGeometryCacheRef.current?.draggingBounds?.left ?? 0) +
          releasePointerOffsetX,
      }
      moveDraggedTab(dropBehavior.targetTabId, dropBehavior.position)
    },
    [finishDragState, getStableDropTargetForDrop, moveDraggedTab, queueReleaseSettle]
  )

  const pointerSession = useTabsPointerDragSession({
    enabled: tabsList.length >= 2,
    onStart: handlePointerStart,
    onMove: handlePointerMove,
    onEnd: handlePointerEnd,
    onCancel: handlePointerCancel,
  })

  const isTabDragActive = Boolean(draggingTabId) || Boolean(releaseSettleState)
  const handleTabClick = useCallback(
    (tabId: string) => {
      if (!pointerSession.consumeClick() || isTabDragActive) {
        return
      }

      runTabsAction('switch tab', () => actions.switchTab(tabId))
    },
    [actions, isTabDragActive, pointerSession]
  )

  const handleTabKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, tabId: string) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      event.preventDefault()
      if (!isTabDragActive) {
        runTabsAction('switch tab', () => actions.switchTab(tabId))
      }
    },
    [actions, isTabDragActive]
  )

  const draggingTabIndex = useMemo(
    () => tabsList.findIndex((tab) => tab.id === draggingTabId),
    [draggingTabId, tabsList]
  )
  const committedTabMoveReflected = hasCommittedTabMoveReflected(
    tabsList,
    pendingCommittedTabMoveRef.current
  )
  const draggingTabOffset = useMemo(() => {
    if (draggingTabIndex === -1) {
      return 0
    }

    const cachedDraggingWidth = dragGeometryCacheRef.current?.draggingWidth
    if (cachedDraggingWidth) {
      return cachedDraggingWidth
    }

    const draggingTabElement = tabsRef.current[draggingTabIndex]
    return draggingTabElement ? draggingTabElement.offsetWidth + tagAndTagSpacing : 0
  }, [draggingTabId, draggingTabIndex, dropTarget, tabsRef])

  const getTabPresentation = useCallback(
    (tabId: string, index: number): TabDragPresentation => {
      return resolveTabDragPresentation({
        tabId,
        tabIndex: index,
        tabsList,
        draggingTabId,
        draggingTabIndex,
        draggingPointerOffsetX,
        draggingTabOffset,
        dropTarget,
        committedTabMoveReflected,
        releaseSettleState,
      })
    },
    [
      committedTabMoveReflected,
      draggingPointerOffsetX,
      draggingTabId,
      draggingTabIndex,
      draggingTabOffset,
      dropTarget,
      releaseSettleState,
      tabsList,
    ]
  )

  const handleTabTransitionEnd = useCallback(
    (event: ReactTransitionEvent<HTMLDivElement>, tabId: string) => {
      if (
        event.target !== event.currentTarget ||
        event.propertyName !== 'transform' ||
        releaseSettleState?.tabId !== tabId ||
        releaseSettleState.stage !== 'settling'
      ) {
        return
      }

      setReleaseSettleState(null)
    },
    [releaseSettleState]
  )

  useLayoutEffect(() => {
    const pendingCommittedTabMove = pendingCommittedTabMoveRef.current
    if (!hasCommittedTabMoveReflected(tabsList, pendingCommittedTabMove)) {
      return
    }

    const pendingCommitSettle = pendingCommitSettleRef.current
    if (pendingCommitSettle?.tabId) {
      const tabIndex = tabsList.findIndex((tab) => tab.id === pendingCommitSettle.tabId)
      queueReleaseSettle(
        pendingCommitSettle.tabId,
        measureCommittedTabSettleOffset(
          scrollWrapperRef.current,
          tabIndex === -1 ? null : tabsRef.current[tabIndex],
          pendingCommitSettle.releaseLeft
        ),
        'commit'
      )
    }

    finishDragState()
    dropCommittedRef.current = false
  }, [finishDragState, queueReleaseSettle, scrollWrapperRef, tabsList, tabsRef])

  useLayoutEffect(() => {
    if (!releaseSettleState || releaseSettleState.stage !== 'queued') {
      return
    }

    const frameId = requestAnimationFrame(() => {
      setReleaseSettleState((current) =>
        current?.stage === 'queued'
          ? {
              ...current,
              stage: 'settling',
            }
          : current
      )
    })

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [releaseSettleState])

  useEffect(() => {
    return () => {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current)
      }
      draggingTabIdRef.current = ''
      dragPointerXRef.current = null
      draggingPointerOffsetXRef.current = 0
      dragGeometryCacheRef.current = null
      stableDropTargetRef.current = null
      pendingCommittedTabMoveRef.current = null
      pendingCommitSettleRef.current = null
      dropCommittedRef.current = false
    }
  }, [])

  return {
    isTabDragActive,
    isReleaseSettleQueued: releaseSettleState?.stage === 'queued',
    getTabPresentation,
    handleTabMouseDown: pointerSession.handleMouseDown,
    handleTabClick,
    handleTabKeyDown,
    handleTabTransitionEnd,
  }
}

export type TabsDragController = ReturnType<typeof useTabsDrag>
