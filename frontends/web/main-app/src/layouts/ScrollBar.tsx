import type { HTMLAttributes, MouseEvent as ReactMouseEvent, ReactNode, UIEventHandler } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const MIN_THUMB_SIZE = 24
const AUTO_HIDE_DELAY = 1000
const CONTENT_CHANGE_REVEAL_DEBOUNCE = 120

type ScrollBarDirection = 'vertical' | 'horizontal'

type DragState = {
  active: boolean
  startClient: number
  startScroll: number
}

type ScrollMetrics = {
  hasOverflow: boolean
  thumbSize: number
  thumbOffset: number
}

function requestFrame(callback: FrameRequestCallback) {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback)
  }

  return globalThis.setTimeout(() => callback(Date.now()), 16) as unknown as number
}

function cancelFrame(frameId: number) {
  if (typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(frameId)
    return
  }

  globalThis.clearTimeout(frameId)
}

export type ScrollBarVisibilityMode = 'always' | 'hidden' | 'auto'

export interface ScrollBarProps extends HTMLAttributes<HTMLDivElement> {
  direction?: ScrollBarDirection
  visibilityMode?: ScrollBarVisibilityMode | ''
  hideScrollbar?: boolean
  children?: ReactNode
}

const idleDragState: DragState = {
  active: false,
  startClient: 0,
  startScroll: 0,
}

const idleMetrics: ScrollMetrics = {
  hasOverflow: false,
  thumbSize: 0,
  thumbOffset: 0,
}

export function ScrollBar({
  direction = 'vertical',
  visibilityMode = '',
  hideScrollbar = false,
  className = '',
  children,
  onScroll,
  ...rest
}: ScrollBarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  const syncFrameRef = useRef<number>(0)
  const revealFrameIdsRef = useRef<number[]>([])
  const autoHideTimerRef = useRef<number>(0)
  const contentChangeTimerRef = useRef<number>(0)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const mutationObserverRef = useRef<MutationObserver | null>(null)
  const dragStateRef = useRef<DragState>(idleDragState)
  const metricsRef = useRef<ScrollMetrics>(idleMetrics)
  const handleDocumentMouseMoveRef = useRef<(event: MouseEvent) => void>(() => {})
  const handleDocumentMouseUpRef = useRef<() => void>(() => {})
  const [metrics, setMetrics] = useState<ScrollMetrics>(idleMetrics)
  const [autoVisible, setAutoVisible] = useState(false)
  const [dragState, setDragState] = useState<DragState>(idleDragState)
  const resolvedVisibilityMode: ScrollBarVisibilityMode = visibilityMode || (hideScrollbar ? 'hidden' : 'always')
  const isHorizontal = direction === 'horizontal'

  useEffect(() => {
    metricsRef.current = metrics
  }, [metrics])

  useEffect(() => {
    dragStateRef.current = dragState
  }, [dragState])

  const clearAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current) {
      globalThis.clearTimeout(autoHideTimerRef.current)
      autoHideTimerRef.current = 0
    }
  }, [])

  const clearRevealFrames = useCallback(() => {
    revealFrameIdsRef.current.forEach((frameId) => cancelFrame(frameId))
    revealFrameIdsRef.current = []
  }, [])

  const clearContentChangeFeedback = useCallback(() => {
    if (contentChangeTimerRef.current) {
      globalThis.clearTimeout(contentChangeTimerRef.current)
      contentChangeTimerRef.current = 0
    }
    clearRevealFrames()
  }, [clearRevealFrames])

  const queueFrame = useCallback((callback: FrameRequestCallback) => {
    const frameId = requestFrame((timestamp) => {
      revealFrameIdsRef.current = revealFrameIdsRef.current.filter((current) => current !== frameId)
      callback(timestamp)
    })
    revealFrameIdsRef.current.push(frameId)
    return frameId
  }, [])

  const syncScrollbar = useCallback(() => {
    const viewport = viewportRef.current
    const rail = railRef.current

    if (!viewport || !rail) {
      if (metricsRef.current.hasOverflow || metricsRef.current.thumbSize || metricsRef.current.thumbOffset) {
        metricsRef.current = idleMetrics
        setMetrics(idleMetrics)
      }
      setAutoVisible(false)
      return
    }

    const clientSize = isHorizontal ? viewport.clientWidth : viewport.clientHeight
    const scrollSize = isHorizontal ? viewport.scrollWidth : viewport.scrollHeight
    const scrollOffset = isHorizontal ? viewport.scrollLeft : viewport.scrollTop
    const railSize = isHorizontal ? rail.clientWidth : rail.clientHeight
    const maxScroll = Math.max(0, scrollSize - clientSize)

    if (scrollSize <= clientSize + 1 || railSize <= 0) {
      if (metricsRef.current.hasOverflow || metricsRef.current.thumbSize || metricsRef.current.thumbOffset) {
        metricsRef.current = idleMetrics
        setMetrics(idleMetrics)
      }
      setAutoVisible(false)
      return
    }

    const thumbSize = Math.max(MIN_THUMB_SIZE, Math.round((clientSize / scrollSize) * railSize))
    const travel = Math.max(0, railSize - thumbSize)
    const thumbOffset = maxScroll ? Math.round((scrollOffset / maxScroll) * travel) : 0
    const nextMetrics = {
      hasOverflow: true,
      thumbSize,
      thumbOffset,
    }

    if (
      metricsRef.current.hasOverflow !== nextMetrics.hasOverflow ||
      metricsRef.current.thumbSize !== nextMetrics.thumbSize ||
      metricsRef.current.thumbOffset !== nextMetrics.thumbOffset
    ) {
      metricsRef.current = nextMetrics
      setMetrics(nextMetrics)
    }
  }, [isHorizontal])

  const scheduleSync = useCallback(() => {
    if (syncFrameRef.current) {
      return
    }

    syncFrameRef.current = requestFrame(() => {
      syncFrameRef.current = 0
      syncScrollbar()
    })
  }, [syncScrollbar])

  const revealScrollbar = useCallback(() => {
    if (resolvedVisibilityMode !== 'auto' || !metricsRef.current.hasOverflow) {
      return
    }

    setAutoVisible(true)
    clearAutoHideTimer()
    autoHideTimerRef.current = globalThis.setTimeout(() => {
      autoHideTimerRef.current = 0
      setAutoVisible(false)
    }, AUTO_HIDE_DELAY) as unknown as number
  }, [clearAutoHideTimer, resolvedVisibilityMode])

  const handleObservedContentChange = useCallback(() => {
    scheduleSync()

    if (resolvedVisibilityMode !== 'auto') {
      return
    }

    clearContentChangeFeedback()
    contentChangeTimerRef.current = globalThis.setTimeout(() => {
      contentChangeTimerRef.current = 0
      scheduleSync()
      queueFrame(() => {
        queueFrame(() => {
          revealScrollbar()
        })
      })
    }, CONTENT_CHANGE_REVEAL_DEBOUNCE) as unknown as number
  }, [clearContentChangeFeedback, queueFrame, resolvedVisibilityMode, revealScrollbar, scheduleSync])

  const handleDocumentMouseMoveNative = useCallback((event: MouseEvent) => {
    handleDocumentMouseMoveRef.current(event)
  }, [])

  const handleDocumentMouseUpNative = useCallback(() => {
    handleDocumentMouseUpRef.current()
  }, [])

  const teardownDocumentDrag = useCallback(() => {
    if (typeof document === 'undefined') {
      return
    }

    document.removeEventListener('mousemove', handleDocumentMouseMoveNative)
    document.removeEventListener('mouseup', handleDocumentMouseUpNative)
    document.body.classList.remove('is-c-scrollbar-dragging')
  }, [handleDocumentMouseMoveNative, handleDocumentMouseUpNative])

  handleDocumentMouseMoveRef.current = (event: MouseEvent) => {
    const currentDragState = dragStateRef.current
    if (!currentDragState.active) {
      return
    }

    const viewport = viewportRef.current
    const rail = railRef.current
    if (!viewport || !rail) {
      return
    }

    const railSize = isHorizontal ? rail.clientWidth : rail.clientHeight
    const maxScroll = isHorizontal
      ? Math.max(0, viewport.scrollWidth - viewport.clientWidth)
      : Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    const travel = Math.max(1, railSize - metricsRef.current.thumbSize)
    const nextClient = isHorizontal ? event.clientX : event.clientY
    const delta = nextClient - currentDragState.startClient
    const nextScroll = Math.max(0, Math.min(maxScroll, currentDragState.startScroll + delta * (maxScroll / travel)))

    if (isHorizontal) {
      viewport.scrollLeft = nextScroll
    } else {
      viewport.scrollTop = nextScroll
    }

    revealScrollbar()
    scheduleSync()
  }

  handleDocumentMouseUpRef.current = () => {
    if (!dragStateRef.current.active) {
      return
    }

    dragStateRef.current = idleDragState
    setDragState(idleDragState)
    teardownDocumentDrag()
    revealScrollbar()
    scheduleSync()
  }

  useEffect(() => {
    scheduleSync()
  })

  useEffect(() => {
    const handleWindowResize = () => scheduleSync()

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleWindowResize, { passive: true })
    }

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current = new ResizeObserver(() => {
        handleObservedContentChange()
      })

      if (rootRef.current) {
        resizeObserverRef.current.observe(rootRef.current)
      }
      if (contentRef.current) {
        resizeObserverRef.current.observe(contentRef.current)
      }
    }

    if (typeof MutationObserver !== 'undefined' && contentRef.current) {
      mutationObserverRef.current = new MutationObserver(() => {
        handleObservedContentChange()
      })
      mutationObserverRef.current.observe(contentRef.current, {
        childList: true,
        subtree: true,
        characterData: true,
      })
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleWindowResize)
      }

      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      mutationObserverRef.current?.disconnect()
      mutationObserverRef.current = null
    }
  }, [handleObservedContentChange, scheduleSync])

  useEffect(() => {
    if (resolvedVisibilityMode !== 'auto') {
      clearAutoHideTimer()
      clearContentChangeFeedback()
      setAutoVisible(false)
    }
  }, [clearAutoHideTimer, clearContentChangeFeedback, resolvedVisibilityMode])

  useEffect(() => {
    return () => {
      if (syncFrameRef.current) {
        cancelFrame(syncFrameRef.current)
        syncFrameRef.current = 0
      }

      teardownDocumentDrag()
      clearAutoHideTimer()
      clearContentChangeFeedback()
    }
  }, [clearAutoHideTimer, clearContentChangeFeedback, teardownDocumentDrag])

  const isRailVisible =
    metrics.hasOverflow &&
    (resolvedVisibilityMode === 'always' || (resolvedVisibilityMode === 'auto' && (autoVisible || dragState.active)))

  const thumbStyle = useMemo(() => {
    if (isHorizontal) {
      return {
        width: `${metrics.thumbSize}px`,
        transform: `translateX(${metrics.thumbOffset}px)`,
      }
    }

    return {
      height: `${metrics.thumbSize}px`,
      transform: `translateY(${metrics.thumbOffset}px)`,
    }
  }, [isHorizontal, metrics.thumbOffset, metrics.thumbSize])

  const handleViewportScroll: UIEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      revealScrollbar()
      scheduleSync()
      onScroll?.(event)
    },
    [onScroll, revealScrollbar, scheduleSync]
  )

  const handleRailMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isRailVisible || event.target !== railRef.current) {
        return
      }
      event.preventDefault()

      const viewport = viewportRef.current
      const rail = railRef.current
      if (!viewport || !rail) {
        return
      }

      const railRect = rail.getBoundingClientRect()
      const pointerOffset = isHorizontal ? event.clientX - railRect.left : event.clientY - railRect.top
      const railSize = isHorizontal ? rail.clientWidth : rail.clientHeight
      const trackTravel = Math.max(0, railSize - metricsRef.current.thumbSize)
      const targetThumbOffset = Math.max(0, Math.min(trackTravel, pointerOffset - metricsRef.current.thumbSize / 2))
      const maxScroll = isHorizontal
        ? Math.max(0, viewport.scrollWidth - viewport.clientWidth)
        : Math.max(0, viewport.scrollHeight - viewport.clientHeight)
      const nextScroll = trackTravel ? (targetThumbOffset / trackTravel) * maxScroll : 0

      if (isHorizontal) {
        viewport.scrollLeft = nextScroll
      } else {
        viewport.scrollTop = nextScroll
      }

      revealScrollbar()
      scheduleSync()
    },
    [isHorizontal, isRailVisible, revealScrollbar, scheduleSync]
  )

  const handleThumbMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const viewport = viewportRef.current
      if (!viewport || !metricsRef.current.hasOverflow || typeof document === 'undefined') {
        return
      }

      const nextDragState = {
        active: true,
        startClient: isHorizontal ? event.clientX : event.clientY,
        startScroll: isHorizontal ? viewport.scrollLeft : viewport.scrollTop,
      }
      dragStateRef.current = nextDragState
      setDragState(nextDragState)

      revealScrollbar()
      document.addEventListener('mousemove', handleDocumentMouseMoveNative)
      document.addEventListener('mouseup', handleDocumentMouseUpNative)
      document.body.classList.add('is-c-scrollbar-dragging')
    },
    [handleDocumentMouseMoveNative, handleDocumentMouseUpNative, isHorizontal, revealScrollbar]
  )

  const rootClassName = [
    'c-scrollbar',
    `c-scrollbar--${direction}`,
    resolvedVisibilityMode === 'hidden' ? 'c-scrollbar--hidden' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={rootRef} className={rootClassName} {...rest}>
      <div
        ref={viewportRef}
        className={['c-scrollbar__viewport', `c-scrollbar__viewport--${direction}`].join(' ')}
        onScroll={handleViewportScroll}
      >
        <div ref={contentRef} className={['c-scrollbar__content', `c-scrollbar__content--${direction}`].join(' ')}>
          {children}
        </div>
      </div>
      {resolvedVisibilityMode !== 'hidden' ? (
        <div
          ref={railRef}
          className={[
            'c-scrollbar__rail',
            `c-scrollbar__rail--${direction}`,
            isRailVisible ? 'is-visible' : '',
            dragState.active ? 'is-dragging' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onMouseDown={handleRailMouseDown}
        >
          <div
            className={[
              'c-scrollbar__thumb',
              `c-scrollbar__thumb--${direction}`,
              dragState.active ? 'is-dragging' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={thumbStyle}
            onMouseDown={(event) => {
              event.stopPropagation()
              event.preventDefault()
              handleThumbMouseDown(event)
            }}
          ></div>
        </div>
      ) : null}
    </div>
  )
}
