import type {
  MouseEvent as ReactMouseEvent,
  MutableRefObject,
  WheelEvent as ReactWheelEvent,
} from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getTabStripMaxScrollLeft,
  getTabStripWheelDelta,
  hasHorizontalTabOverflow,
  scrollTabsBy,
  scrollTabStripByDelta,
  smoothScrollBehavior,
  tabArrowHoldDelayMs,
  tabArrowHoldFrameDistance,
  tabArrowScrollDistance,
} from './tabsScroll'
import { tagAndTagSpacing } from './tabsDragMath'
import type { TabItem } from './types'

export type ArrowHoldDirection = -1 | 0 | 1

type UseTabsOverflowOptions = {
  tabsList: TabItem[]
  activeTab: TabItem | null
  tabsRef: MutableRefObject<Array<HTMLDivElement | null>>
}

export function useTabsOverflow({
  tabsList,
  activeTab,
  tabsRef,
}: UseTabsOverflowOptions) {
  const scrollWrapperRef = useRef<HTMLDivElement | null>(null)
  const arrowHoldDirectionRef = useRef<ArrowHoldDirection>(0)
  const arrowHoldDelayTimerRef = useRef<number | null>(null)
  const arrowHoldFrameRef = useRef<number | null>(null)
  const suppressNextArrowClickRef = useRef(false)
  const arrowClickSuppressionResetTimerRef = useRef<number | null>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const clearScheduledArrowHoldDelay = useCallback(() => {
    if (arrowHoldDelayTimerRef.current !== null) {
      window.clearTimeout(arrowHoldDelayTimerRef.current)
      arrowHoldDelayTimerRef.current = null
    }
  }, [])

  const clearScheduledArrowHoldFrame = useCallback(() => {
    if (arrowHoldFrameRef.current !== null) {
      cancelAnimationFrame(arrowHoldFrameRef.current)
      arrowHoldFrameRef.current = null
    }
  }, [])

  const clearScheduledArrowClickSuppressionReset = useCallback(() => {
    if (arrowClickSuppressionResetTimerRef.current !== null) {
      window.clearTimeout(arrowClickSuppressionResetTimerRef.current)
      arrowClickSuppressionResetTimerRef.current = null
    }
  }, [])

  const resetArrowClickSuppression = useCallback(() => {
    suppressNextArrowClickRef.current = false
    clearScheduledArrowClickSuppressionReset()
  }, [clearScheduledArrowClickSuppressionReset])

  const scheduleArrowClickSuppressionReset = useCallback(() => {
    clearScheduledArrowClickSuppressionReset()
    arrowClickSuppressionResetTimerRef.current = window.setTimeout(() => {
      suppressNextArrowClickRef.current = false
      arrowClickSuppressionResetTimerRef.current = null
    }, 0)
  }, [clearScheduledArrowClickSuppressionReset])

  const refresh = useCallback(() => {
    const scrollWrapper = scrollWrapperRef.current
    if (!scrollWrapper) {
      return
    }

    if (hasHorizontalTabOverflow(scrollWrapper)) {
      const maxScrollLeft = getTabStripMaxScrollLeft(scrollWrapper)
      setShowLeftArrow(scrollWrapper.scrollLeft > 0)
      setShowRightArrow(scrollWrapper.scrollLeft < maxScrollLeft)
      return
    }

    setShowLeftArrow(false)
    setShowRightArrow(false)
  }, [])

  const stopArrowHoldScroll = useCallback(() => {
    clearScheduledArrowHoldDelay()
    clearScheduledArrowHoldFrame()
    arrowHoldDirectionRef.current = 0
    document.removeEventListener('mouseup', stopArrowHoldScroll)
    window.removeEventListener('blur', stopArrowHoldScroll)

    if (suppressNextArrowClickRef.current) {
      scheduleArrowClickSuppressionReset()
    }
  }, [
    clearScheduledArrowHoldDelay,
    clearScheduledArrowHoldFrame,
    scheduleArrowClickSuppressionReset,
  ])

  const scrollBy = useCallback(
    (delta: number, behavior: 'auto' | 'smooth' = 'auto') => {
      return scrollTabsBy(scrollWrapperRef.current, delta, behavior, refresh)
    },
    [refresh]
  )

  const stepArrowHoldScroll = useCallback(() => {
    if (!arrowHoldDirectionRef.current) {
      return
    }

    const didScroll = scrollBy(
      arrowHoldDirectionRef.current * tabArrowHoldFrameDistance,
      'auto'
    )

    if (!didScroll) {
      stopArrowHoldScroll()
      return
    }

    arrowHoldFrameRef.current = requestAnimationFrame(() => {
      stepArrowHoldScroll()
    })
  }, [scrollBy, stopArrowHoldScroll])

  const startArrowHoldScroll = useCallback(
    (direction: ArrowHoldDirection) => {
      arrowHoldDirectionRef.current = direction
      suppressNextArrowClickRef.current = true
      stepArrowHoldScroll()
    },
    [stepArrowHoldScroll]
  )

  const handleArrowMouseDown = useCallback(
    (direction: ArrowHoldDirection, event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.button !== 0) {
        return
      }

      stopArrowHoldScroll()
      resetArrowClickSuppression()
      arrowHoldDirectionRef.current = direction
      arrowHoldDelayTimerRef.current = window.setTimeout(() => {
        arrowHoldDelayTimerRef.current = null
        startArrowHoldScroll(direction)
      }, tabArrowHoldDelayMs)
      document.addEventListener('mouseup', stopArrowHoldScroll)
      window.addEventListener('blur', stopArrowHoldScroll)
    },
    [resetArrowClickSuppression, startArrowHoldScroll, stopArrowHoldScroll]
  )

  const handleArrowClick = useCallback(
    (direction: ArrowHoldDirection) => {
      if (suppressNextArrowClickRef.current) {
        resetArrowClickSuppression()
        return
      }

      scrollBy(
        direction < 0 ? -tabArrowScrollDistance : tabArrowScrollDistance,
        smoothScrollBehavior
      )
    },
    [resetArrowClickSuppression, scrollBy]
  )

  const moveToTarget = useCallback(
    (currentTab: TabItem | null) => {
      const scrollWrapper = scrollWrapperRef.current
      if (!scrollWrapper || !currentTab) {
        return
      }

      const containerWidth = scrollWrapper.offsetWidth
      const firstTab = tabsList[0]
      const lastTab = tabsList[tabsList.length - 1]

      if (firstTab?.id === currentTab.id) {
        scrollWrapper.scrollLeft = 0
        refresh()
        return
      }

      if (lastTab?.id === currentTab.id) {
        scrollWrapper.scrollLeft = getTabStripMaxScrollLeft(scrollWrapper)
        refresh()
        return
      }

      const currentIndex = tabsList.findIndex((item) => item.id === currentTab.id)
      const prevTag = tabsRef.current[currentIndex - 1]
      const nextTag = tabsRef.current[currentIndex + 1]

      if (!prevTag || !nextTag) {
        refresh()
        return
      }

      const afterNextTagOffsetLeft =
        nextTag.offsetLeft + nextTag.offsetWidth + tagAndTagSpacing
      const beforePrevTagOffsetLeft = prevTag.offsetLeft - tagAndTagSpacing

      if (afterNextTagOffsetLeft > scrollWrapper.scrollLeft + containerWidth) {
        scrollWrapper.scrollLeft = afterNextTagOffsetLeft - containerWidth
      } else if (beforePrevTagOffsetLeft < scrollWrapper.scrollLeft) {
        scrollWrapper.scrollLeft = beforePrevTagOffsetLeft
      }

      refresh()
    },
    [refresh, tabsList, tabsRef]
  )

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      const scrollWrapper = scrollWrapperRef.current
      if (!hasHorizontalTabOverflow(scrollWrapper)) {
        return
      }

      const delta = getTabStripWheelDelta(
        event.nativeEvent as WheelEvent & { wheelDelta?: number }
      )
      if (delta === 0) {
        return
      }

      event.preventDefault()
      scrollTabStripByDelta(scrollWrapper, delta)
      refresh()
    },
    [refresh]
  )

  useEffect(() => {
    moveToTarget(activeTab)
  }, [activeTab, moveToTarget])

  useEffect(() => {
    if (tabsList.length === 0) {
      setShowLeftArrow(false)
      setShowRightArrow(false)
      return
    }

    refresh()
  }, [refresh, tabsList.length])

  useEffect(() => {
    window.addEventListener('resize', refresh)
    return () => {
      window.removeEventListener('resize', refresh)
    }
  }, [refresh])

  useEffect(() => {
    return () => {
      stopArrowHoldScroll()
      resetArrowClickSuppression()
    }
  }, [resetArrowClickSuppression, stopArrowHoldScroll])

  return {
    scrollWrapperRef,
    showLeftArrow,
    showRightArrow,
    refresh,
    handleWheel,
    handleArrowMouseDown,
    handleArrowClick,
  }
}

export type TabsOverflowController = ReturnType<typeof useTabsOverflow>
