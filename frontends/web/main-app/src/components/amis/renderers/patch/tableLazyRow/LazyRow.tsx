import React from 'react'
import { InView } from 'react-intersection-observer'
import { getSimpleStaticTextRowData } from '../tableStaticTextCell'

const DEFAULT_LAZY_ROW_RENDER_FRAME_WORK_UNITS = 80
const LAZY_ROW_VISIBILITY_MIN_OVERSCAN_PX = 240
const LAZY_ROW_VISIBILITY_PULSE_FRAMES = 18
const LAZY_ROW_SCROLL_LISTENER_OPTIONS = {
  capture: true,
  passive: true,
} as const

type LazyRowRenderTask = {
  cancelled: boolean
  run: () => void
  workUnits: number
}

let lazyRowRenderQueue: LazyRowRenderTask[] = []
let lazyRowRenderFrameScheduled = false
let lazyRowVisibilityCheckFrameScheduled = false
let lazyRowVisibilityListenersInstalled = false
let lazyRowVisibilityPulseFramesRemaining = 0

type LazyRowVisibilityTarget = {
  checkPlaceholderVisibility: () => void
}

const pendingLazyRows = new Set<LazyRowVisibilityTarget>()

function getNow() {
  return typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

function requestLazyRowRenderFrame(callback: FrameRequestCallback) {
  if (
    typeof window !== 'undefined' &&
    typeof window.requestAnimationFrame === 'function'
  ) {
    return window.requestAnimationFrame(callback)
  }

  return setTimeout(() => callback(getNow()), 16) as unknown as number
}

function isScrollable(element: Element) {
  if (
    typeof window === 'undefined' ||
    typeof window.getComputedStyle !== 'function'
  ) {
    return false
  }

  const style = window.getComputedStyle(element)
  return /(auto|scroll|overlay)/.test(
    `${style.overflow}${style.overflowY}${style.overflowX}`
  )
}

function getScrollParent(element: HTMLElement) {
  let parent = element.parentElement

  while (parent) {
    if (isScrollable(parent)) {
      return parent
    }

    parent = parent.parentElement
  }

  return null
}

function isElementInLazyRenderViewport(element: HTMLElement) {
  const rect = element.getBoundingClientRect()

  if (rect.width === 0 && rect.height === 0) {
    return false
  }

  const viewportHeight =
    typeof window !== 'undefined'
      ? window.innerHeight || document.documentElement?.clientHeight || 0
      : 0
  const viewportOverscan = Math.max(
    LAZY_ROW_VISIBILITY_MIN_OVERSCAN_PX,
    Math.floor(viewportHeight / 2)
  )

  if (
    rect.bottom < -viewportOverscan ||
    rect.top > viewportHeight + viewportOverscan
  ) {
    return false
  }

  const scrollParent = getScrollParent(element)

  if (!scrollParent) {
    return true
  }

  const parentRect = scrollParent.getBoundingClientRect()
  const parentOverscan = Math.max(
    LAZY_ROW_VISIBILITY_MIN_OVERSCAN_PX,
    Math.floor(parentRect.height || 0)
  )

  return (
    rect.bottom >= parentRect.top - parentOverscan &&
    rect.top <= parentRect.bottom + parentOverscan
  )
}

function handleLazyRowVisibilityTrigger() {
  lazyRowVisibilityPulseFramesRemaining = Math.max(
    lazyRowVisibilityPulseFramesRemaining,
    LAZY_ROW_VISIBILITY_PULSE_FRAMES
  )
  scheduleLazyRowVisibilityCheck()
}

function installLazyRowVisibilityListeners() {
  if (
    lazyRowVisibilityListenersInstalled ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return
  }

  document.addEventListener(
    'scroll',
    handleLazyRowVisibilityTrigger,
    LAZY_ROW_SCROLL_LISTENER_OPTIONS
  )
  window.addEventListener('resize', handleLazyRowVisibilityTrigger)
  lazyRowVisibilityListenersInstalled = true
}

function uninstallLazyRowVisibilityListeners() {
  if (
    !lazyRowVisibilityListenersInstalled ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return
  }

  document.removeEventListener(
    'scroll',
    handleLazyRowVisibilityTrigger,
    LAZY_ROW_SCROLL_LISTENER_OPTIONS
  )
  window.removeEventListener('resize', handleLazyRowVisibilityTrigger)
  lazyRowVisibilityListenersInstalled = false
}

function registerPendingLazyRow(target: LazyRowVisibilityTarget) {
  pendingLazyRows.add(target)
  installLazyRowVisibilityListeners()
  handleLazyRowVisibilityTrigger()
}

function unregisterPendingLazyRow(target: LazyRowVisibilityTarget) {
  pendingLazyRows.delete(target)

  if (!pendingLazyRows.size) {
    uninstallLazyRowVisibilityListeners()
  }
}

function scheduleLazyRowVisibilityCheck() {
  if (lazyRowVisibilityCheckFrameScheduled) {
    return
  }

  lazyRowVisibilityCheckFrameScheduled = true
  requestLazyRowRenderFrame(() => {
    flushLazyRowVisibilityChecks()
  })
}

export function flushLazyRowVisibilityChecks() {
  lazyRowVisibilityCheckFrameScheduled = false
  pendingLazyRows.forEach((target) => {
    target.checkPlaceholderVisibility()
  })

  if (
    pendingLazyRows.size &&
    lazyRowVisibilityPulseFramesRemaining > 0
  ) {
    lazyRowVisibilityPulseFramesRemaining -= 1
    scheduleLazyRowVisibilityCheck()
  }
}

function scheduleLazyRowRenderFrame() {
  if (lazyRowRenderFrameScheduled) {
    return
  }

  lazyRowRenderFrameScheduled = true
  requestLazyRowRenderFrame(() => {
    flushLazyRowRenderQueue()
  })
}

function takeNextTask(frameWorkUnits: number, usedWorkUnits: number) {
  while (lazyRowRenderQueue.length) {
    const nextTask = lazyRowRenderQueue.shift()

    if (!nextTask || nextTask.cancelled) {
      continue
    }

    if (
      usedWorkUnits > 0 &&
      usedWorkUnits + nextTask.workUnits > frameWorkUnits
    ) {
      lazyRowRenderQueue.unshift(nextTask)
      return null
    }

    return nextTask
  }

  return null
}

export function flushLazyRowRenderQueue() {
  lazyRowRenderFrameScheduled = false

  let usedWorkUnits = 0
  let nextTask = takeNextTask(
    DEFAULT_LAZY_ROW_RENDER_FRAME_WORK_UNITS,
    usedWorkUnits
  )

  while (nextTask) {
    if (!nextTask.cancelled) {
      nextTask.run()
      usedWorkUnits += nextTask.workUnits
    }

    nextTask = takeNextTask(
      DEFAULT_LAZY_ROW_RENDER_FRAME_WORK_UNITS,
      usedWorkUnits
    )
  }

  if (lazyRowRenderQueue.some((task) => !task.cancelled)) {
    scheduleLazyRowRenderFrame()
  } else {
    lazyRowRenderQueue = []
  }
}

export function scheduleLazyRowRender(
  workUnits: number,
  run: () => void
) {
  const task: LazyRowRenderTask = {
    cancelled: false,
    run,
    workUnits: Math.max(1, Math.ceil(workUnits || 1)),
  }

  lazyRowRenderQueue.push(task)
  scheduleLazyRowRenderFrame()

  return () => {
    task.cancelled = true
  }
}

export interface LazyRowProps {
  row: any
  rowIndex: number
  columns: any[]
  rowsProps: any
  lazyRenderAfter: number
  renderRow: (row: any, rowIndex: number, rowsProps: any) => React.ReactNode
  renderPlaceholderRow: (
    row: any,
    rowIndex: number,
    rowRef?: React.Ref<HTMLTableRowElement>
  ) => React.ReactNode
}

interface LazyRowState {
  visible: boolean
  renderReady: boolean
}

function hasInputTablePlaceholderFlag(value: any) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      Object.prototype.hasOwnProperty.call(value, '__isPlaceholder')
  )
}

function shouldRenderLazyRowImmediately(row: any) {
  return [getSimpleStaticTextRowData(row), row?.data, row?.pristine, row].some(
    hasInputTablePlaceholderFlag
  )
}

export class LazyRow extends React.PureComponent<LazyRowProps, LazyRowState> {
  private cancelScheduledRender: (() => void) | null = null
  private inViewPlaceholderRef: React.Ref<HTMLTableRowElement> | null = null
  private mounted = false
  private placeholderElement: HTMLTableRowElement | null = null

  constructor(props: LazyRowProps) {
    super(props)

    const initiallyVisible =
      shouldRenderLazyRowImmediately(props.row) ||
      props.rowIndex + 1 < props.lazyRenderAfter

    this.state = {
      visible: initiallyVisible,
      renderReady: initiallyVisible,
    }
  }

  componentDidMount() {
    this.mounted = true
    this.syncVisibilityRescue()

    if (this.state.visible && !this.state.renderReady) {
      this.scheduleRender()
    }
  }

  componentDidUpdate() {
    if (!this.state.renderReady && shouldRenderLazyRowImmediately(this.props.row)) {
      unregisterPendingLazyRow(this)
      this.cancelPendingRender()
      this.setState({ visible: true, renderReady: true })
      return
    }

    this.syncVisibilityRescue()

    if (this.state.visible && !this.state.renderReady) {
      this.scheduleRender()
    }
  }

  componentWillUnmount() {
    this.mounted = false
    unregisterPendingLazyRow(this)
    this.cancelPendingRender()
  }

  private syncVisibilityRescue() {
    if (this.state.renderReady || !this.placeholderElement) {
      unregisterPendingLazyRow(this)
      return
    }

    registerPendingLazyRow(this)
  }

  private cancelPendingRender() {
    if (this.cancelScheduledRender) {
      this.cancelScheduledRender()
      this.cancelScheduledRender = null
    }
  }

  private getRenderWorkUnits() {
    return Array.isArray(this.props.columns) && this.props.columns.length
      ? this.props.columns.length
      : 1
  }

  private scheduleRender(forceReschedule = false) {
    if (this.state.renderReady) {
      return
    }

    if (this.cancelScheduledRender) {
      if (!forceReschedule) {
        scheduleLazyRowRenderFrame()
        return
      }

      this.cancelScheduledRender()
      this.cancelScheduledRender = null
    }

    this.cancelScheduledRender = scheduleLazyRowRender(
      this.getRenderWorkUnits(),
      () => {
        this.cancelScheduledRender = null

        if (this.mounted && !this.state.renderReady) {
          this.setState({ renderReady: true })
        }
      }
    )
  }

  private handleVisibleChange = (visible: boolean) => {
    if (!visible || this.state.visible) {
      return
    }

    this.setState({ visible: true }, () => {
      this.scheduleRender()
    })
  }

  checkPlaceholderVisibility = () => {
    if (
      this.state.renderReady ||
      !this.placeholderElement ||
      !isElementInLazyRenderViewport(this.placeholderElement)
    ) {
      return
    }

    if (this.state.visible) {
      this.scheduleRender(true)
      return
    }

    this.setState({ visible: true }, () => {
      this.scheduleRender()
    })
  }

  private setPlaceholderRef: React.RefCallback<HTMLTableRowElement> = (node) => {
    const inViewRef = this.inViewPlaceholderRef

    if (typeof inViewRef === 'function') {
      inViewRef(node)
    } else if (inViewRef && typeof inViewRef === 'object') {
      ;(inViewRef as React.MutableRefObject<HTMLTableRowElement | null>).current =
        node
    }

    if (this.placeholderElement === node) {
      return
    }

    this.placeholderElement = node
    this.syncVisibilityRescue()
  }

  render() {
    const {
      row,
      rowIndex,
      rowsProps,
      lazyRenderAfter,
      renderRow,
      renderPlaceholderRow,
    } = this.props
    const renderReady = this.state.renderReady

    return (
      <InView
        onChange={this.handleVisibleChange}
        fallbackInView={false}
        skip={this.state.visible || rowIndex + 1 < lazyRenderAfter}
      >
        {({ ref }) => {
          this.inViewPlaceholderRef = ref

          return renderReady
            ? renderRow(row, rowIndex, rowsProps)
            : renderPlaceholderRow(row, rowIndex, this.setPlaceholderRef)
        }}
      </InView>
    )
  }
}
