import {
  applyCrudFilterLayoutBody,
  CRUD_FILTER_LABEL_STYLE_LABEL,
  normalizeSchemaArray,
  resolveCrudFilterLayoutMode,
  type CrudFilterSmartLayoutOptions,
  type CrudFilterLayoutModeCode,
  type CrudFilterLayoutState,
} from './crudFilterGridLayout'
import {
  clearCrudFilterLayoutObserverTarget,
  findCrudFilterFormElement,
  measureCrudFilterLayout,
  switchCrudFilterLayoutObserverTarget,
} from './crudFilterLayoutMeasurement'
import { hasFilterToolbarItem } from './crudSchemaPolicy'

type CrudFilterMeasurements = {
  containerWidth: number | null
  toolbarWidth: number | null
  toolbarHeight: number | null
  labelWidth: string | null
}

export type CrudFilterRenderState = {
  modeCode: CrudFilterLayoutModeCode | null
  layoutState: CrudFilterLayoutState | null
  toolbarWidth: string | null
  toolbarHeight: string | null
  labelWidth: string | null
  columnCount: number | null
  wideHeadSplit: boolean
  alignLabelWidth: boolean
  mobileStacked: boolean
}

export type CrudFilterRenderSnapshot = {
  renderState: CrudFilterRenderState
  renderedSchema: Record<string, any>
}

type CrudFilterLayoutDependencies = {
  getRootElement: () => unknown
  isEnabled: () => boolean
  requestUpdate: () => void
}

const EMPTY_MEASUREMENTS: CrudFilterMeasurements = {
  containerWidth: null,
  toolbarWidth: null,
  toolbarHeight: null,
  labelWidth: null,
}

export class CrudFilterLayoutController {
  private measurements: CrudFilterMeasurements = EMPTY_MEASUREMENTS
  private resizeObserver?: ResizeObserver
  private scheduledFrame?: number

  private latestRenderState?: CrudFilterRenderState

  constructor(private readonly dependencies: CrudFilterLayoutDependencies) {}

  syncLifecycle() {
    if (!this.dependencies.isEnabled()) {
      this.reset()
      return
    }

    this.schedule()
    this.bindResizeObserver()
  }

  dispose() {
    this.unbindResizeObserver()
    this.cancelScheduledSync()
  }

  getSnapshot(
    normalizedFilter: Record<string, any>,
    layoutOptions: CrudFilterSmartLayoutOptions = {
      enabled: true,
      labelStyle: CRUD_FILTER_LABEL_STYLE_LABEL,
      fieldsPerRow: {
        desktop: 5,
        narrow: 4,
        mobile: 1,
      },
    }
  ): CrudFilterRenderSnapshot {
    const enabled = this.dependencies.isEnabled()
    const renderState = enabled
      ? this.resolveRenderState(normalizedFilter, layoutOptions)
      : this.getDisabledRenderState()
    const renderedSchema = enabled
      ? this.applyRenderedSchema(normalizedFilter, renderState, layoutOptions)
      : normalizedFilter
    this.latestRenderState = renderState

    return {
      renderState,
      renderedSchema,
    }
  }

  private reset() {
    this.unbindResizeObserver()
    this.cancelScheduledSync()
    this.setMeasurements(null, null, null, null)
  }

  private resolveRenderState(
    normalizedFilter: Record<string, any>,
    layoutOptions: CrudFilterSmartLayoutOptions
  ): CrudFilterRenderState {
    if (!hasFilterToolbarItem(normalizedFilter.body)) {
      return this.getDisabledRenderState()
    }

    const { containerWidth, toolbarWidth, toolbarHeight, labelWidth } = this.measurements

    if (!containerWidth || !toolbarWidth) {
      return this.getDisabledRenderState()
    }

    const layoutMode = resolveCrudFilterLayoutMode({
      bodyItems: normalizeSchemaArray(normalizedFilter.body),
      containerWidth,
      toolbarInlineMinWidth: toolbarWidth,
      fieldsPerRow: layoutOptions.fieldsPerRow,
    })

    return {
      modeCode: layoutMode.modeCode,
      layoutState: layoutMode.layoutState,
      toolbarWidth: `${toolbarWidth}px`,
      toolbarHeight: toolbarHeight ? `${toolbarHeight}px` : null,
      labelWidth: layoutMode.alignLabelWidth ? labelWidth : null,
      columnCount: layoutMode.columnCount,
      wideHeadSplit: layoutMode.wideHeadSplit,
      alignLabelWidth: layoutMode.alignLabelWidth,
      mobileStacked: layoutMode.columnCount === 1,
    }
  }

  private getDisabledRenderState(): CrudFilterRenderState {
    return {
      modeCode: null,
      layoutState: null,
      toolbarWidth: null,
      toolbarHeight: null,
      labelWidth: null,
      columnCount: null,
      wideHeadSplit: false,
      alignLabelWidth: false,
      mobileStacked: false,
    }
  }

  private applyRenderedSchema(
    normalizedFilter: Record<string, any>,
    layoutState: Pick<
      CrudFilterRenderState,
      'modeCode' | 'wideHeadSplit' | 'mobileStacked'
    >,
    layoutOptions: CrudFilterSmartLayoutOptions
  ) {
    return {
      ...normalizedFilter,
      ...(layoutState.mobileStacked ? { mode: 'normal' } : {}),
      body: applyCrudFilterLayoutBody({
        bodyItems: normalizeSchemaArray(normalizedFilter.body),
        modeCode: layoutState.modeCode,
        wideHeadSplit: layoutState.wideHeadSplit,
        mobileStacked: layoutState.mobileStacked,
        labelStyle: layoutOptions.labelStyle,
      }),
    }
  }

  private schedule() {
    if (typeof window === 'undefined') {
      return
    }

    if (!this.dependencies.isEnabled()) {
      this.cancelScheduledSync()
      return
    }

    this.cancelScheduledSync()
    this.scheduledFrame = window.requestAnimationFrame(() => {
      this.scheduledFrame = undefined
      this.syncMeasurements()
    })
  }

  private cancelScheduledSync() {
    if (typeof window === 'undefined') {
      return
    }

    if (this.scheduledFrame) {
      window.cancelAnimationFrame(this.scheduledFrame)
      this.scheduledFrame = undefined
    }
  }

  private bindResizeObserver() {
    if (!this.dependencies.isEnabled()) {
      this.unbindResizeObserver()
      return
    }

    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
      return
    }

    const filterForm = this.getFilterFormElement()
    if (!filterForm) {
      this.unbindResizeObserver()
      return
    }

    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.schedule())
    }

    switchCrudFilterLayoutObserverTarget(this.resizeObserver, filterForm)
  }

  private unbindResizeObserver() {
    if (!this.resizeObserver) {
      return
    }

    clearCrudFilterLayoutObserverTarget(this.resizeObserver)
    this.resizeObserver.disconnect()
    this.resizeObserver = undefined
  }

  private syncMeasurements() {
    if (!this.dependencies.isEnabled()) {
      this.setMeasurements(null, null, null, null)
      return
    }

    const form = this.getFilterFormElement()
    if (!form) {
      return
    }

    const currentRenderState = this.latestRenderState ?? this.getDisabledRenderState()
    const measurements = measureCrudFilterLayout(form, {
      alignLabelWidth: currentRenderState.alignLabelWidth,
      wideHeadSplit: currentRenderState.wideHeadSplit,
      layoutState: currentRenderState.layoutState,
    })

    if (!measurements) {
      this.setMeasurements(null, null, null, null)
      this.applyWideHeadRailTop(form, null)
      return
    }

    this.setMeasurements(
      measurements.containerWidth,
      measurements.toolbarWidth,
      measurements.toolbarHeight,
      measurements.labelWidth
    )
    this.applyWideHeadRailTop(form, measurements.railTop)
  }

  private setMeasurements(
    containerWidth: number | null,
    toolbarWidth: number | null,
    toolbarHeight: number | null,
    labelWidth: string | null
  ) {
    if (
      this.measurements.containerWidth === containerWidth &&
      this.measurements.toolbarWidth === toolbarWidth &&
      this.measurements.toolbarHeight === toolbarHeight &&
      this.measurements.labelWidth === labelWidth
    ) {
      return
    }

    this.measurements = {
      containerWidth,
      toolbarWidth,
      toolbarHeight,
      labelWidth,
    }
    this.dependencies.requestUpdate()
  }

  private getFilterFormElement() {
    const root = this.dependencies.getRootElement()
    return typeof Element !== 'undefined' && root instanceof Element
      ? findCrudFilterFormElement(root)
      : null
  }

  private applyWideHeadRailTop(form: HTMLElement, railTop: string | null) {
    if (!railTop) {
      form.style.removeProperty('--crud-filter-rail-top')
      return
    }

    form.style.setProperty('--crud-filter-rail-top', railTop)
  }
}
