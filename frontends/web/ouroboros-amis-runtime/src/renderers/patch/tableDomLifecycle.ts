import type React from 'react'

import {
  resolveAffixHeaderWrapperPaddingRight,
  type TableLayoutDecisionInput,
} from './tableLayout'

type ResizeSession = {
  line: HTMLElement
  startWidth: number
  startX: number
}

type TableDomLifecycleDependencies = {
  clearBaseResizeSession: () => void
  getClassPrefix: () => string | undefined
  getColumns: () => any[]
  getLayoutProps: () => TableLayoutDecisionInput
  getResizeListeners: () => {
    mousemove: (event: MouseEvent) => void
    mouseup: (event: MouseEvent) => void
  }
  getRoot: () => HTMLDivElement | null
  setBaseResizeSession: (session: ResizeSession) => void
}

export class TableDomLifecycle {
  private resizeLine?: HTMLElement
  private resizingSide: 'left' | 'right' = 'right'
  private startWidth = 0
  private startX = 0

  constructor(private readonly dependencies: TableDomLifecycleDependencies) {}

  get isResizing() {
    return Boolean(this.resizeLine)
  }

  syncAffixHeaderScrollbarGutter() {
    const tableRoot = this.dependencies.getRoot()
    if (!tableRoot) {
      return
    }

    const fixedTopWrapper = this.queryTableElement(
      tableRoot,
      'Table-fixedTop',
      'Table-wrapper'
    )
    if (!fixedTopWrapper) {
      return
    }

    const tableContent = this.queryTableElement(
      tableRoot,
      'Table-contentWrap',
      'Table-content'
    )
    const paddingRight = resolveAffixHeaderWrapperPaddingRight(
      this.dependencies.getLayoutProps(),
      tableContent
    )

    if (fixedTopWrapper.style.paddingRight !== paddingRight) {
      fixedTopWrapper.style.paddingRight = paddingRight
    }
  }

  beginResize(event: React.MouseEvent<HTMLElement>) {
    const resizeLine = event.currentTarget
    const index = parseInt(resizeLine.getAttribute('data-index') || '0', 10)
    const column = this.dependencies.getColumns()[index]

    this.startX = event.clientX
    this.startWidth = column.realWidth || column.width
    this.resizeLine = resizeLine
    this.resizingSide =
      (resizeLine.getAttribute('data-side') as 'left' | 'right') || 'right'

    this.dependencies.setBaseResizeSession({
      line: resizeLine,
      startWidth: this.startWidth,
      startX: this.startX,
    })
    resizeLine.classList.add('is-resizing')

    const listeners = this.dependencies.getResizeListeners()
    document.addEventListener('mousemove', listeners.mousemove)
    document.addEventListener('mouseup', listeners.mouseup)

    event.preventDefault()
    event.stopPropagation()
  }

  resize(event: MouseEvent) {
    if (!this.resizeLine) {
      return
    }

    const moveX = event.clientX - this.startX
    const index = parseInt(this.resizeLine.getAttribute('data-index') || '0', 10)
    const column = this.dependencies.getColumns()[index]
    const actualMoveX = this.resizingSide === 'left' ? -moveX : moveX

    column.setWidth(Math.max(this.startWidth + actualMoveX, 30, column.minWidth))
  }

  completeResize() {
    this.resizeLine = undefined
  }

  dispose() {
    const listeners = this.dependencies.getResizeListeners()
    document.removeEventListener('mousemove', listeners.mousemove)
    document.removeEventListener('mouseup', listeners.mouseup)
    this.resizeLine?.classList.remove('is-resizing')
    this.resizeLine = undefined
    this.dependencies.clearBaseResizeSession()
    this.clearAffixHeaderScrollbarGutter()
  }

  private queryTableElement(
    root: HTMLDivElement,
    containerClassName: string,
    targetClassName: string
  ): HTMLElement | null {
    const classPrefix = this.dependencies.getClassPrefix() || 'cxd-'
    return root.querySelector<HTMLElement>(
      `:scope > .${classPrefix}${containerClassName} .${classPrefix}${targetClassName}`
    )
  }

  private clearAffixHeaderScrollbarGutter() {
    const tableRoot = this.dependencies.getRoot()
    if (!tableRoot) {
      return
    }

    const fixedTopWrapper = this.queryTableElement(
      tableRoot,
      'Table-fixedTop',
      'Table-wrapper'
    )

    if (fixedTopWrapper?.style.paddingRight) {
      fixedTopWrapper.style.paddingRight = ''
    }
  }
}
