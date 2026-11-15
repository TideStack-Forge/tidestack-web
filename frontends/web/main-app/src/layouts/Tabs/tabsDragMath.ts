export const tagAndTagSpacing = 6

export type TabIconValue = string | Record<string, unknown>

export interface TabItem {
  id: string
  path: string
  fullPath?: string
  title?: string
  icon?: TabIconValue
  isFixed?: boolean
}

export type TabDropPosition = 'before' | 'after'

export type TabDropTarget = { tabId: string; position: TabDropPosition }

export type TabDropBehavior =
  | { type: 'ignore' }
  | { type: 'preserve-for-dragend' }
  | {
      type: 'commit'
      targetTabId: string
      position: TabDropPosition
    }

export type StableDragTabGeometry = {
  tabId: string
  left: number
  right: number
  width: number
  midpoint: number
}

export type StableDragGeometryCache = {
  draggingTabId: string
  draggingWidth: number
  stripLeft: number
  scrollLeft: number
  draggingBounds: { left: number; right: number } | null
  stableTabs: StableDragTabGeometry[]
}

export type PendingCommittedTabMove = {
  sourceTabId: string
  targetTabId?: string
  position: TabDropPosition
}

const dragBoundaryHysteresis = 0
const dragOverlapThresholdMin = 20
const dragOverlapThresholdMax = 28
export const tabPointerDragThreshold = 5

export function shouldStartTabPointerDrag(
  startClientX: number,
  startClientY: number,
  currentClientX: number,
  currentClientY: number,
  threshold = tabPointerDragThreshold
) {
  return Math.abs(currentClientX - startClientX) >= threshold
}

export function shouldIgnoreTabPointerDown(options: {
  button: number
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  target?: EventTarget | null
  currentTarget?: HTMLElement | null
}) {
  const {
    button,
    ctrlKey = false,
    metaKey = false,
    altKey = false,
    shiftKey = false,
    target = null,
    currentTarget = null,
  } = options

  if (button !== 0 || ctrlKey || metaKey || altKey || shiftKey) {
    return true
  }

  const targetElement =
    target && typeof target === 'object' && 'closest' in target
      ? (target as HTMLElement)
      : null
  if (!targetElement || !currentTarget || targetElement === currentTarget) {
    return false
  }

  return Boolean(
    targetElement.closest(
      '[data-tab-drag-ignore="true"], button, a[href], input, select, textarea, [role="menuitem"]'
    )
  )
}

export function consumeTabShellClickSuppression(shouldSuppress: boolean) {
  return {
    shouldSwitchTab: !shouldSuppress,
    nextSuppressNextClick: false,
  }
}

export function shouldCancelTabPointerDragOnVisibilityChange(
  documentHidden: boolean,
  hasPointerDragSession: boolean
) {
  return documentHidden && hasPointerDragSession
}

export function shouldCancelTabPointerDragOnReleasedButtons(
  eventButtons: number,
  hasPointerDragSession: boolean
) {
  return hasPointerDragSession && eventButtons === 0
}

function resolveDragOverlapThreshold(draggedWidth: number) {
  return Math.min(
    dragOverlapThresholdMax,
    Math.max(dragOverlapThresholdMin, Math.round(draggedWidth * 0.25))
  )
}

export function resolveTabDragAnchorOffset(
  clientX: number,
  geometryCache: StableDragGeometryCache | null
) {
  if (!geometryCache?.draggingBounds) {
    return 0
  }

  return (
    clientX -
    geometryCache.stripLeft +
    geometryCache.scrollLeft -
    geometryCache.draggingBounds.left
  )
}

export function resolveDraggedTabPointerOffset(
  clientX: number,
  geometryCache: StableDragGeometryCache | null,
  anchorOffsetX: number
) {
  if (!geometryCache?.draggingBounds) {
    return 0
  }

  const draggedTabLeft =
    clientX - geometryCache.stripLeft + geometryCache.scrollLeft - anchorOffsetX
  return draggedTabLeft - geometryCache.draggingBounds.left
}

export function resolveDisplacedTabOffset(
  tabIndex: number,
  draggingTabIndex: number,
  targetIndex: number,
  position: TabDropPosition,
  draggingOffset: number
) {
  if (draggingTabIndex < targetIndex) {
    const isWithinAffectedRange =
      position === 'after'
        ? tabIndex > draggingTabIndex && tabIndex <= targetIndex
        : tabIndex > draggingTabIndex && tabIndex < targetIndex
    return isWithinAffectedRange ? -draggingOffset : 0
  }

  if (position === 'before') {
    return tabIndex >= targetIndex && tabIndex < draggingTabIndex ? draggingOffset : 0
  }

  return tabIndex > targetIndex && tabIndex < draggingTabIndex ? draggingOffset : 0
}

export function resolveStableTabDropTarget(
  geometryCache: StableDragGeometryCache | null,
  previousStableTarget: TabDropTarget | null,
  draggingPointerOffsetX: number,
  hysteresis = dragBoundaryHysteresis
): TabDropTarget | null {
  if (
    !geometryCache ||
    geometryCache.stableTabs.length === 0 ||
    !geometryCache.draggingBounds
  ) {
    return null
  }

  const draggedWidth =
    geometryCache.draggingBounds.right - geometryCache.draggingBounds.left
  const overlapThreshold = resolveDragOverlapThreshold(draggedWidth)
  const draggedLeft = geometryCache.draggingBounds.left + draggingPointerOffsetX
  const draggedRight = geometryCache.draggingBounds.right + draggingPointerOffsetX
  const isMovingRight = draggingPointerOffsetX >= 0
  const probeCoordinate = isMovingRight
    ? draggedRight - overlapThreshold
    : draggedLeft + overlapThreshold
  const boundaryCoordinates = geometryCache.stableTabs.map((tabGeometry) =>
    isMovingRight ? tabGeometry.left : tabGeometry.right
  )
  const candidateInsertionIndex = boundaryCoordinates.reduce(
    (count, coordinate) => (probeCoordinate >= coordinate ? count + 1 : count),
    0
  )

  const previousInsertionIndex = (() => {
    if (!previousStableTarget) {
      return null
    }

    if (previousStableTarget.position === 'before') {
      return 0
    }

    const previousTabIndex = geometryCache.stableTabs.findIndex(
      (tabGeometry) => tabGeometry.tabId === previousStableTarget.tabId
    )
    return previousTabIndex === -1 ? null : previousTabIndex + 1
  })()

  if (
    previousInsertionIndex !== null &&
    previousInsertionIndex !== candidateInsertionIndex &&
    hysteresis > 0
  ) {
    const boundaryIndex = Math.min(previousInsertionIndex, candidateInsertionIndex)
    const sharedBoundaryCoordinate = boundaryCoordinates[boundaryIndex]
    if (
      sharedBoundaryCoordinate !== undefined &&
      Math.abs(probeCoordinate - sharedBoundaryCoordinate) <= hysteresis
    ) {
      return previousStableTarget
    }
  }

  if (candidateInsertionIndex <= 0) {
    return {
      tabId: geometryCache.stableTabs[0].tabId,
      position: 'before',
    }
  }

  const tabIndex = Math.min(
    candidateInsertionIndex - 1,
    geometryCache.stableTabs.length - 1
  )
  return {
    tabId: geometryCache.stableTabs[tabIndex].tabId,
    position: 'after',
  }
}

export function resolveTabDropBehavior(
  draggingTabId: string,
  targetTabId: string,
  position: TabDropPosition
): TabDropBehavior {
  if (!draggingTabId) {
    return { type: 'ignore' as const }
  }

  if (draggingTabId === targetTabId) {
    return { type: 'preserve-for-dragend' as const }
  }

  return {
    type: 'commit' as const,
    targetTabId,
    position,
  }
}

export function hasCommittedTabMoveReflected(
  tabsList: TabItem[],
  pendingCommittedTabMove: PendingCommittedTabMove | null
) {
  if (!pendingCommittedTabMove?.sourceTabId || !pendingCommittedTabMove.targetTabId) {
    return false
  }

  const sourceIndex = tabsList.findIndex(
    (tab) => tab.id === pendingCommittedTabMove.sourceTabId
  )
  const targetIndex = tabsList.findIndex(
    (tab) => tab.id === pendingCommittedTabMove.targetTabId
  )
  if (sourceIndex === -1 || targetIndex === -1) {
    return false
  }

  return pendingCommittedTabMove.position === 'before'
    ? sourceIndex === targetIndex - 1
    : sourceIndex === targetIndex + 1
}
