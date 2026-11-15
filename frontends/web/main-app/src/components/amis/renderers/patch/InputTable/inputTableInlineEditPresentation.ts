import {
  containsInputTableActiveElement,
  findEditableInputTableControl,
  findFocusableInputTableControl,
  focusInputTableControl,
} from './inputTableDomControls'

export interface PresentInputTableInlineEditRowOptions {
  root: HTMLElement
  editIndex: string
  isNew: boolean
  isActive: () => boolean
  shouldFocus?: () => boolean
}

const MAX_ROW_LOOKUP_FRAMES = 120
const HEIGHT_SETTLE_IDLE_MS = 250
const HEIGHT_SETTLE_MAX_MS = 1200

export const INPUT_TABLE_SCROLL_CONTAINER_CLASS = 'input-table-virtual-scroll'

function hasRowIndex(row: HTMLTableRowElement, rowIndex: string) {
  return (
    row.getAttribute('data-index') === rowIndex ||
    row.getAttribute('row-index') === rowIndex
  )
}

export function findInputTableInlineEditRow(
  root: HTMLElement,
  editIndex: string
) {
  const rows = Array.from(root.querySelectorAll<HTMLTableRowElement>('tbody tr'))
  const exact = rows.find((row) => hasRowIndex(row, editIndex))

  if (exact) {
    return exact
  }

  const fallbackIndex = editIndex.split('.').slice(-1)[0]
  return rows.find((row) => hasRowIndex(row, fallbackIndex))
}

function findInputTableInlineEditControl(row: HTMLTableRowElement) {
  for (const cell of Array.from(row.cells)) {
    const control =
      findEditableInputTableControl(cell) ?? findFocusableInputTableControl(cell)

    if (control) {
      return control
    }
  }

  return findEditableInputTableControl(row) ?? findFocusableInputTableControl(row)
}

function findInputTableScrollContainer(
  root: HTMLElement,
  row: HTMLTableRowElement
) {
  let element = row.parentElement

  while (element && element !== root.parentElement) {
    if (
      element.classList.contains(INPUT_TABLE_SCROLL_CONTAINER_CLASS) ||
      element.scrollHeight > element.clientHeight + 1
    ) {
      return element
    }

    element = element.parentElement
  }

  return undefined
}

function alignInputTableEditRow(
  container: HTMLElement,
  row: HTMLTableRowElement,
  isNew: boolean
) {
  if (isNew) {
    container.scrollTop = Math.max(
      0,
      container.scrollHeight - container.clientHeight
    )
    return
  }

  const rowTop = row.offsetTop - container.offsetTop
  const centeredTop =
    rowTop - Math.max(0, container.clientHeight - row.offsetHeight) / 2
  container.scrollTop = Math.max(0, centeredTop)
}

export function presentInputTableInlineEditRow(
  options: PresentInputTableInlineEditRowOptions
) {
  let cancelled = false
  let lookupFrame = 0
  let rowPresented = false
  let cancelScheduledFrame: (() => void) | undefined
  let settleObserver: ResizeObserver | undefined
  let settleIdleTimer: ReturnType<typeof setTimeout> | undefined
  let settleMaxTimer: ReturnType<typeof setTimeout> | undefined

  const stopHeightSettle = () => {
    settleObserver?.disconnect()
    settleObserver = undefined

    if (settleIdleTimer) {
      clearTimeout(settleIdleTimer)
      settleIdleTimer = undefined
    }

    if (settleMaxTimer) {
      clearTimeout(settleMaxTimer)
      settleMaxTimer = undefined
    }
  }

  const cancel = () => {
    cancelled = true
    cancelScheduledFrame?.()
    cancelScheduledFrame = undefined
    stopHeightSettle()
  }

  const scheduleFrame = (callback: () => void) => {
    if (typeof window.requestAnimationFrame === 'function') {
      const frame = window.requestAnimationFrame(callback)
      cancelScheduledFrame = () => window.cancelAnimationFrame(frame)
      return
    }

    const timer = setTimeout(callback, 16)
    cancelScheduledFrame = () => clearTimeout(timer)
  }

  const settleAtBottom = (
    container: HTMLElement,
    row: HTMLTableRowElement
  ) => {
    if (!options.isNew || typeof ResizeObserver === 'undefined') {
      return
    }

    stopHeightSettle()

    const align = () => {
      if (!cancelled && options.isActive()) {
        alignInputTableEditRow(container, row, true)
      }
    }
    const finishAfterIdle = () => {
      if (settleIdleTimer) {
        clearTimeout(settleIdleTimer)
      }
      settleIdleTimer = setTimeout(stopHeightSettle, HEIGHT_SETTLE_IDLE_MS)
    }

    settleObserver = new ResizeObserver(() => {
      align()
      finishAfterIdle()
    })
    settleObserver.observe(row.closest('table') || row)
    settleMaxTimer = setTimeout(stopHeightSettle, HEIGHT_SETTLE_MAX_MS)
    finishAfterIdle()
  }

  const present = () => {
    cancelScheduledFrame = undefined

    if (cancelled || !options.isActive()) {
      cancel()
      return
    }

    const row = findInputTableInlineEditRow(options.root, options.editIndex)

    if (!row) {
      lookupFrame += 1
      if (lookupFrame < MAX_ROW_LOOKUP_FRAMES) {
        scheduleFrame(present)
      }
      return
    }

    const container = findInputTableScrollContainer(options.root, row)

    if (container) {
      alignInputTableEditRow(container, row, options.isNew)
    }

    if (!rowPresented && container) {
      settleAtBottom(container, row)
    }

    rowPresented = true

    const shouldFocus = !options.shouldFocus || options.shouldFocus()

    if (!shouldFocus) {
      return
    }

    const control = findInputTableInlineEditControl(row)

    if (control) {
      if (document.activeElement !== control) {
        focusInputTableControl(control)
      }

      return
    }

    if (containsInputTableActiveElement(row)) {
      return
    }

    lookupFrame += 1
    if (lookupFrame < MAX_ROW_LOOKUP_FRAMES) {
      scheduleFrame(present)
    }
  }

  scheduleFrame(present)
  return cancel
}
