import {
  CRUD_FILTER_LAYOUT_WIDE_HEAD_CLASS,
  CRUD_FILTER_MOBILE_STACKED_FORM_CLASS,
  isCrudFilterSmartLayoutEnabled,
  normalizeCrudFilterGridLayout,
  resolveCrudFilterSmartLayoutOptions,
  type CrudFilterSmartLayoutOptions,
} from './crudFilterGridLayout'
import { CrudFilterLayoutController } from './crudFilterLayoutController'
import { normalizeFilterSchema } from './crudSchemaPolicy'

const FILTER_FORM_CLASS = 'crud-filter-form'
const FILTER_LAYOUT_STATE_CLASS_PREFIX = 'crud-filter-layout--'

type CrudFilterSmartLayoutRuntimeDependencies = {
  getRootElement: () => unknown
  requestUpdate: () => void
}

type CrudFilterSmartLayoutRenderOptions = {
  filter: Record<string, any>
  systemConfig?: any
  translate: (key: string) => string
}

export class CrudFilterSmartLayoutRuntime {
  private currentFilter?: Record<string, any>
  private currentSystemConfig?: any
  private readonly controller: CrudFilterLayoutController

  constructor(private readonly dependencies: CrudFilterSmartLayoutRuntimeDependencies) {
    this.controller = new CrudFilterLayoutController({
      getRootElement: dependencies.getRootElement,
      isEnabled: () =>
        isCrudFilterSmartLayoutEnabled(this.currentFilter, this.currentSystemConfig),
      requestUpdate: dependencies.requestUpdate,
    })
  }

  syncLifecycle(filter: Record<string, any> | undefined, systemConfig?: any) {
    this.rememberContext(filter, systemConfig)
    this.controller.syncLifecycle()
  }

  dispose() {
    this.controller.dispose()
  }

  renderFilter({ filter, systemConfig, translate }: CrudFilterSmartLayoutRenderOptions) {
    this.rememberContext(filter, systemConfig)

    const smartLayoutOptions = resolveCrudFilterSmartLayoutOptions(filter, systemConfig)
    const smartLayoutEnabled = smartLayoutOptions.enabled
    const normalizedFilter = smartLayoutEnabled
      ? normalizeCrudFilterGridLayout(normalizeFilterSchema(filter, translate))
      : normalizeFilterSchema(filter, translate)
    const { renderState, renderedSchema } = this.controller.getSnapshot(
      normalizedFilter,
      smartLayoutOptions
    )

    return {
      title: translate('CRUD.filter'),
      mode: 'inline',
      submitText: translate('search'),
      className: this.buildFormClassName(smartLayoutEnabled, renderState),
      style: this.buildFormStyle(smartLayoutEnabled, renderState, smartLayoutOptions),
      ...renderedSchema,
      smartLayout: false,
      type: 'form',
      api: null,
    }
  }

  private rememberContext(filter: Record<string, any> | undefined, systemConfig?: any) {
    this.currentFilter = filter
    this.currentSystemConfig = systemConfig
  }

  private buildFormClassName(
    smartLayoutEnabled: boolean,
    renderState: ReturnType<CrudFilterLayoutController['getSnapshot']>['renderState']
  ) {
    return [
      FILTER_FORM_CLASS,
      smartLayoutEnabled && renderState.layoutState
        ? `${FILTER_LAYOUT_STATE_CLASS_PREFIX}${renderState.layoutState}`
        : '',
      smartLayoutEnabled && renderState.labelWidth
        ? 'crud-filter-form--label-aligned'
        : '',
      smartLayoutEnabled && renderState.wideHeadSplit
        ? CRUD_FILTER_LAYOUT_WIDE_HEAD_CLASS
        : '',
      smartLayoutEnabled && renderState.mobileStacked
        ? CRUD_FILTER_MOBILE_STACKED_FORM_CLASS
        : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  private buildFormStyle(
    smartLayoutEnabled: boolean,
    renderState: ReturnType<CrudFilterLayoutController['getSnapshot']>['renderState'],
    layoutOptions: CrudFilterSmartLayoutOptions
  ) {
    const columnCount = renderState.columnCount ?? layoutOptions.fieldsPerRow.desktop

    return {
      ...(renderState.toolbarWidth
        ? {
            '--crud-filter-toolbar-width': renderState.toolbarWidth,
          }
        : {}),
      ...(renderState.toolbarHeight
        ? {
            '--crud-filter-toolbar-height': renderState.toolbarHeight,
          }
        : {}),
      ...(renderState.labelWidth
        ? {
            '--crud-filter-label-width': renderState.labelWidth,
          }
        : {}),
      ...(smartLayoutEnabled && columnCount
        ? {
            '--crud-filter-columns': String(columnCount),
          }
        : {}),
    }
  }
}
