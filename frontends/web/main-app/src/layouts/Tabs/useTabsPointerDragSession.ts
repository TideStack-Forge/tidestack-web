import type { MouseEvent as ReactMouseEvent } from 'react'
import { useCallback, useEffect, useRef } from 'react'

import {
  consumeTabShellClickSuppression,
  shouldCancelTabPointerDragOnReleasedButtons,
  shouldCancelTabPointerDragOnVisibilityChange,
  shouldIgnoreTabPointerDown,
  shouldStartTabPointerDrag,
} from './tabsDragMath'

export type PointerDragSession = {
  tabId: string
  startClientX: number
  startClientY: number
  lastClientX: number
  anchorOffsetX: number
  started: boolean
  suppressNextClick: boolean
}

type UseTabsPointerDragSessionOptions = {
  enabled: boolean
  onStart: (session: PointerDragSession) => boolean
  onMove: (session: PointerDragSession, event: MouseEvent) => void
  onEnd: (session: PointerDragSession, event: MouseEvent) => void
  onCancel: (session: PointerDragSession) => void
}

export function useTabsPointerDragSession({
  enabled,
  onStart,
  onMove,
  onEnd,
  onCancel,
}: UseTabsPointerDragSessionOptions) {
  const sessionRef = useRef<PointerDragSession | null>(null)
  const cleanupListenersRef = useRef<(() => void) | null>(null)
  const suppressNextClickTimeoutRef = useRef<number | null>(null)
  const suppressNextClickRef = useRef(false)

  const clearScheduledClickSuppressionReset = useCallback(() => {
    if (suppressNextClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressNextClickTimeoutRef.current)
      suppressNextClickTimeoutRef.current = null
    }
  }, [])

  const resetClickSuppression = useCallback(() => {
    suppressNextClickRef.current = false
    clearScheduledClickSuppressionReset()
  }, [clearScheduledClickSuppressionReset])

  const armClickSuppression = useCallback(() => {
    clearScheduledClickSuppressionReset()
    suppressNextClickRef.current = true
    suppressNextClickTimeoutRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = false
      suppressNextClickTimeoutRef.current = null
    }, 0)
  }, [clearScheduledClickSuppressionReset])

  const consumeClick = useCallback(() => {
    const result = consumeTabShellClickSuppression(suppressNextClickRef.current)
    suppressNextClickRef.current = result.nextSuppressNextClick

    if (!result.shouldSwitchTab) {
      clearScheduledClickSuppressionReset()
    }

    return result.shouldSwitchTab
  }, [clearScheduledClickSuppressionReset])

  const removeListeners = useCallback(() => {
    cleanupListenersRef.current?.()
    cleanupListenersRef.current = null
  }, [])

  const releaseSession = useCallback(() => {
    const session = sessionRef.current
    sessionRef.current = null
    removeListeners()
    return session
  }, [removeListeners])

  const cancelSession = useCallback(() => {
    const session = releaseSession()
    if (!session?.started) {
      return
    }

    if (session.suppressNextClick) {
      armClickSuppression()
    }
    onCancel(session)
  }, [armClickSuppression, onCancel, releaseSession])

  const handleDocumentMove = useCallback(
    (event: MouseEvent) => {
      const session = sessionRef.current
      if (!session) {
        return
      }

      if (shouldCancelTabPointerDragOnReleasedButtons(event.buttons, true)) {
        cancelSession()
        return
      }

      session.lastClientX = event.clientX
      if (!session.started) {
        if (
          !shouldStartTabPointerDrag(
            session.startClientX,
            session.startClientY,
            event.clientX,
            event.clientY
          )
        ) {
          return
        }

        session.started = true
        session.suppressNextClick = true
        if (!onStart(session)) {
          sessionRef.current = null
          resetClickSuppression()
          removeListeners()
          return
        }
      }

      event.preventDefault()
      onMove(session, event)
    },
    [cancelSession, onMove, onStart, removeListeners, resetClickSuppression]
  )

  const handleDocumentEnd = useCallback(
    (event: MouseEvent) => {
      const session = releaseSession()
      if (!session?.started) {
        return
      }

      event.preventDefault()
      if (session.suppressNextClick) {
        armClickSuppression()
      }
      onEnd(session, event)
    },
    [armClickSuppression, onEnd, releaseSession]
  )

  const handleWindowCancel = useCallback(() => {
    if (sessionRef.current) {
      cancelSession()
    }
  }, [cancelSession])

  const handleVisibilityChange = useCallback(() => {
    if (
      shouldCancelTabPointerDragOnVisibilityChange(
        document.hidden,
        Boolean(sessionRef.current)
      )
    ) {
      cancelSession()
    }
  }, [cancelSession])

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, tabId: string) => {
      if (event.defaultPrevented || !enabled) {
        return
      }

      if (
        shouldIgnoreTabPointerDown({
          button: event.button,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          target: event.target,
          currentTarget: event.currentTarget,
        })
      ) {
        return
      }

      removeListeners()
      sessionRef.current = {
        tabId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        lastClientX: event.clientX,
        anchorOffsetX: 0,
        started: false,
        suppressNextClick: false,
      }

      document.addEventListener('mousemove', handleDocumentMove)
      document.addEventListener('mouseup', handleDocumentEnd)
      window.addEventListener('blur', handleWindowCancel)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      cleanupListenersRef.current = () => {
        document.removeEventListener('mousemove', handleDocumentMove)
        document.removeEventListener('mouseup', handleDocumentEnd)
        window.removeEventListener('blur', handleWindowCancel)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    },
    [
      enabled,
      handleDocumentEnd,
      handleDocumentMove,
      handleVisibilityChange,
      handleWindowCancel,
      removeListeners,
    ]
  )

  useEffect(() => {
    return () => {
      sessionRef.current = null
      removeListeners()
      resetClickSuppression()
    }
  }, [removeListeners, resetClickSuppression])

  return {
    handleMouseDown,
    consumeClick,
  }
}
