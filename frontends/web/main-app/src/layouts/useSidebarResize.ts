import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react'

import userApi from '@/common/api/user'

import {
  applySidebarWidthStyle,
  clampSidebarWidth,
  SIDEBAR_WIDTH_SETTING_NAME,
  type SidebarWidthConfig,
} from './sidebar-width'

interface SidebarResizeSession {
  startClientX: number
  startWidth: number
  lastWidth: number
  handle: HTMLDivElement
}

interface UseSidebarResizeInput {
  currentWidth?: number | null
  enabled?: boolean
  layoutRootRef?: RefObject<HTMLElement | null>
  settingName?: string
  sidebarExpanded?: boolean
  widthConfig?: SidebarWidthConfig
}

export function useSidebarResize({
  currentWidth = null,
  enabled = false,
  layoutRootRef,
  settingName = SIDEBAR_WIDTH_SETTING_NAME,
  sidebarExpanded = false,
  widthConfig,
}: UseSidebarResizeInput) {
  const dragSessionRef = useRef<SidebarResizeSession | null>(null)
  const cleanupPointerListenersRef = useRef<(() => void) | null>(null)
  const committedWidthRef = useRef<number | null>(currentWidth)

  useEffect(() => {
    committedWidthRef.current = currentWidth
  }, [currentWidth])

  const removePointerListeners = useCallback(() => {
    cleanupPointerListenersRef.current?.()
    cleanupPointerListenersRef.current = null
  }, [])

  const cancelDrag = useCallback(() => {
    const session = dragSessionRef.current
    if (!session) {
      return
    }

    session.handle.classList.remove('is-dragging')
    dragSessionRef.current = null
    removePointerListeners()
    applySidebarWidthStyle(layoutRootRef?.current, committedWidthRef.current)
  }, [layoutRootRef, removePointerListeners])

  const finishDrag = useCallback(() => {
    const session = dragSessionRef.current
    if (!session) {
      return
    }

    session.handle.classList.remove('is-dragging')
    dragSessionRef.current = null
    removePointerListeners()

    if (session.lastWidth === committedWidthRef.current) {
      return
    }

    committedWidthRef.current = session.lastWidth

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(settingName, String(session.lastWidth))
    }

    void userApi
      .saveUserWidth(settingName, session.lastWidth)
      .then((result) => {
        const status = result?.status ?? result?.code ?? 0
        if (status !== 0) {
          console.warn(
            `OuroborosSidebar: failed to persist sidebar width for "${settingName}"`,
            result
          )
        }
      })
      .catch((error) => {
        console.warn(
          `OuroborosSidebar: failed to persist sidebar width for "${settingName}"`,
          error
        )
      })
  }, [removePointerListeners, settingName])

  const handleDocumentPointerMove = useCallback(
    (event: PointerEvent) => {
      const session = dragSessionRef.current
      if (!session || !layoutRootRef?.current || !widthConfig) {
        return
      }

      const nextWidth = clampSidebarWidth(
        session.startWidth + (event.clientX - session.startClientX),
        widthConfig.minWidth,
        widthConfig.maxWidth
      )

      session.lastWidth = nextWidth
      applySidebarWidthStyle(layoutRootRef.current, nextWidth)
    },
    [layoutRootRef, widthConfig]
  )

  const handleDocumentPointerUp = useCallback(() => {
    finishDrag()
  }, [finishDrag])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const startWidth =
        typeof committedWidthRef.current === 'number' &&
        Number.isFinite(committedWidthRef.current)
          ? committedWidthRef.current
          : currentWidth

      if (
        !enabled ||
        !sidebarExpanded ||
        !widthConfig ||
        typeof startWidth !== 'number' ||
        !Number.isFinite(startWidth) ||
        !layoutRootRef?.current
      ) {
        return
      }

      if (event.button !== 0) {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      removePointerListeners()

      const handle = event.currentTarget
      handle.classList.add('is-dragging')

      dragSessionRef.current = {
        startClientX: event.clientX,
        startWidth,
        lastWidth: startWidth,
        handle,
      }

      const ownerDocument = handle.ownerDocument
      const defaultView = ownerDocument.defaultView

      ownerDocument.addEventListener('pointermove', handleDocumentPointerMove)
      ownerDocument.addEventListener('pointerup', handleDocumentPointerUp)
      ownerDocument.addEventListener('pointercancel', cancelDrag)
      defaultView?.addEventListener('blur', cancelDrag)

      cleanupPointerListenersRef.current = () => {
        ownerDocument.removeEventListener('pointermove', handleDocumentPointerMove)
        ownerDocument.removeEventListener('pointerup', handleDocumentPointerUp)
        ownerDocument.removeEventListener('pointercancel', cancelDrag)
        defaultView?.removeEventListener('blur', cancelDrag)
      }
    },
    [
      cancelDrag,
      currentWidth,
      enabled,
      handleDocumentPointerMove,
      handleDocumentPointerUp,
      layoutRootRef,
      removePointerListeners,
      sidebarExpanded,
      widthConfig,
    ]
  )

  useEffect(() => {
    return () => {
      cancelDrag()
      removePointerListeners()
    }
  }, [cancelDrag, removePointerListeners])

  const isResizable = Boolean(enabled && sidebarExpanded && widthConfig?.resizable)

  return {
    handleProps: isResizable
      ? {
          onPointerDown: handlePointerDown,
        }
      : {},
    isResizable,
  }
}
