export const tabStripScrollStep = 100
export const tabArrowScrollDistance = 100
export const smoothScrollBehavior = 'smooth'
export const tabArrowHoldDelayMs = 180
export const tabArrowHoldFrameDistance = 8

export type TabStripScrollMode = 'auto' | 'smooth'

type TabStripScrollHost = {
  clientWidth: number
  scrollLeft: number
  scrollWidth: number
  scrollBy?: (options: { left: number; behavior?: TabStripScrollMode }) => void
}

type TabsWheelLikeEvent = {
  deltaX?: number
  deltaY?: number
  wheelDelta?: number
}

export function hasHorizontalTabOverflow(
  scrollHost: TabStripScrollHost | null | undefined
): scrollHost is TabStripScrollHost {
  return !!scrollHost && scrollHost.scrollWidth > scrollHost.clientWidth
}

export function getTabStripMaxScrollLeft(
  scrollHost: TabStripScrollHost | null | undefined
) {
  if (!scrollHost) {
    return 0
  }

  return Math.max(0, scrollHost.scrollWidth - scrollHost.clientWidth)
}

export function getTabStripWheelDelta(event: TabsWheelLikeEvent) {
  if (typeof event.deltaX === 'number' && event.deltaX !== 0) {
    return event.deltaX
  }

  const legacyWheelDelta =
    typeof event.wheelDelta === 'number' && event.wheelDelta !== 0
      ? -event.wheelDelta / 4
      : 0

  if (typeof event.deltaY === 'number' && event.deltaY !== 0) {
    return legacyWheelDelta || event.deltaY * 10
  }

  return legacyWheelDelta
}

export function scrollTabStripByDelta(
  scrollHost: TabStripScrollHost | null | undefined,
  delta: number
) {
  if (!hasHorizontalTabOverflow(scrollHost) || delta === 0) {
    return false
  }

  const maxScrollLeft = getTabStripMaxScrollLeft(scrollHost)
  const nextScrollLeft = Math.min(
    maxScrollLeft,
    Math.max(0, scrollHost.scrollLeft + delta)
  )

  if (nextScrollLeft === scrollHost.scrollLeft) {
    return false
  }

  scrollHost.scrollLeft = nextScrollLeft
  return true
}

export function scrollTabsBy(
  scrollHost: TabStripScrollHost | null | undefined,
  delta: number,
  behavior: TabStripScrollMode = 'auto',
  onFallbackApplied?: () => void
) {
  if (!hasHorizontalTabOverflow(scrollHost) || delta === 0) {
    return false
  }

  const maxScrollLeft = getTabStripMaxScrollLeft(scrollHost)
  const nextScrollLeft = Math.min(
    maxScrollLeft,
    Math.max(0, scrollHost.scrollLeft + delta)
  )

  if (Math.abs(nextScrollLeft - scrollHost.scrollLeft) < 0.5) {
    return false
  }

  if (typeof scrollHost.scrollBy === 'function') {
    scrollHost.scrollBy({
      left: nextScrollLeft - scrollHost.scrollLeft,
      behavior,
    })
    return true
  }

  scrollHost.scrollLeft = nextScrollLeft
  onFallbackApplied?.()
  return true
}
