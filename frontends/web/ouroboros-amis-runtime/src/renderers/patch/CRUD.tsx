import { CRUDStore, Renderer } from 'amis-core'
import { CRUDRendererBase } from 'amis/lib/renderers/CRUD'
import type { CRUDProps } from 'amis/lib/renderers/CRUD'
import ReactDOM from 'react-dom'
import { CrudFilterSmartLayoutRuntime } from './crudFilterSmartLayoutRuntime'
import {
  applySelectableClickSelectionDefault,
  isPageBodyDirectCrudPath,
  normalizeCrudHeaderToolbar,
  patchCrudBodySchema,
  resolveFilterInitValues,
  type FilterInitFormProps,
} from './crudSchemaPolicy'
import './CRUD.scss'

type PatchedCRUDSchema = Record<string, any>

@Renderer({
  type: 'crud',
  storeType: CRUDStore.name,
  name: 'OuroborosCRUD',
  isolateScope: true,
  override: true,
  weight: -200,
})
export default class OuroborosCRUDRenderer extends CRUDRendererBase<CRUDProps> {
  static defaultProps = {
    ...CRUDRendererBase.defaultProps,
    autoFillHeight: undefined,
  }

  private readonly filterSmartLayoutRuntime: CrudFilterSmartLayoutRuntime

  constructor(props: CRUDProps, context: any) {
    super(props, context)
    this.filterSmartLayoutRuntime = new CrudFilterSmartLayoutRuntime({
      getRootElement: () => ReactDOM.findDOMNode(this),
      requestUpdate: () => this.forceUpdate(),
    })
  }

  componentDidMount() {
    super.componentDidMount()

    this.filterSmartLayoutRuntime.syncLifecycle(
      this.props.filter,
      this.resolveSystemConfig()
    )
  }

  componentDidUpdate(prevProps: CRUDProps) {
    super.componentDidUpdate(prevProps)

    this.filterSmartLayoutRuntime.syncLifecycle(
      this.props.filter,
      this.resolveSystemConfig()
    )
  }

  componentWillUnmount() {
    this.filterSmartLayoutRuntime.dispose()

    super.componentWillUnmount()
  }

  handleFilterInit(values: object, formProps?: FilterInitFormProps) {
    super.handleFilterInit(resolveFilterInitValues(values, formProps))
  }

  handleFilterReset(values: object, action: any) {
    const { store, syncLocation, env, pageField, perPageField } = this.props
    const resetQuery: PatchedCRUDSchema = {}

    Object.keys(values).forEach((key) => {
      resetQuery[key] = ''
    })

    store.updateQuery(
      resetQuery,
      syncLocation && env?.updateLocation
        ? (location: Location) => env.updateLocation?.(location)
        : undefined,
      pageField,
      perPageField,
      true
    )

    this.lastQuery = store.query

    if (
      action?.actionType &&
      ['reset-and-submit', 'clear-and-submit', 'submit'].includes(action.actionType)
    ) {
      return
    }

    this.search()
  }

  private resolveEffectiveAutoFillHeight() {
    if (typeof this.props.autoFillHeight !== 'undefined') {
      return this.props.autoFillHeight
    }

    return isPageBodyDirectCrudPath((this.props as any).$path)
  }

  private resolveSystemConfig() {
    const props = this.props as any

    return (
      props.SystemConfig ?? props.data?.SystemConfig ?? props.env?.rootData?.SystemConfig
    )
  }

  filterBodySchema(subSchema: any) {
    const selectable = !!(
      (this.hasBulkActionsToolbar() && this.hasBulkActions()) ||
      this.props.pickerMode ||
      this.props.selectable
    )

    return applySelectableClickSelectionDefault(
      patchCrudBodySchema(subSchema),
      selectable
    )
  }

  renderBody() {
    const {
      className,
      style,
      bodyClassName,
      filter,
      render,
      store,
      mode,
      syncLocation,
      children,
      bulkActions,
      pickerMode,
      multiple,
      strictMode,
      valueField,
      primaryField,
      value,
      hideQuickSaveBtn,
      itemActions,
      classnames: cx,
      keepItemSelectionOnPageChange,
      maxKeepItemSelectionLength,
      maxItemSelectionLength,
      onAction,
      popOverContainer,
      translate: __,
      onQuery,
      autoGenerateFilter,
      onSelect,
      autoFillHeight,
      onEvent,
      onSave,
      onSaveOrder,
      onPopOverOpened,
      onPopOverClosed,
      onSearchableFromReset,
      onSearchableFromSubmit,
      onSearchableFromInit,
      headerToolbarRender,
      footerToolbarRender,
      testIdBuilder,
      id,
      filterCanAccessSuperData = true,
      selectable = false,
      ...rest
    } = this.props
    const lazyRenderAfter =
      (this.props as any).lazyRenderAfter ?? (this.props as any).$schema?.lazyRenderAfter
    const loadingMaxDuration =
      (this.props as any).loadingMaxDuration ??
      (this.props as any).$schema?.loadingMaxDuration
    const virtualTableBody =
      (this.props as any).virtualTableBody ??
      (this.props as any).$schema?.virtualTableBody

    return render(
      'body',
      {
        ...this.filterBodySchema(rest),
        id,
        // 通用事件 例如cus-event 如果直接透传给table 则会被触发2次
        // 因此只将下层组件table、cards中自定义事件透传下去 否则通过crud配置了也不会执行
        onEvent: this.filterOnEvent(onEvent),
        columns: store.columns ?? rest.columns,
        type: mode || 'table',
        ...(lazyRenderAfter !== undefined && (!mode || mode === 'table')
          ? { lazyRenderAfter, lazyRenderAfterExplicit: true }
          : {}),
        ...(loadingMaxDuration !== undefined && (!mode || mode === 'table')
          ? { loadingMaxDuration }
          : {}),
        ...(virtualTableBody !== undefined && (!mode || mode === 'table')
          ? { virtualTableBody }
          : {}),
      },
      {
        key: 'body',
        className: cx('Crud-body', bodyClassName),
        ref: this.controlRef,
        autoGenerateFilter: !filter && autoGenerateFilter,
        filterCanAccessSuperData,
        autoFillHeight: this.resolveEffectiveAutoFillHeight(),
        selectable: !!(
          (this.hasBulkActionsToolbar() && this.hasBulkActions()) ||
          pickerMode ||
          selectable
        ),
        itemActions,
        multiple:
          multiple === undefined
            ? bulkActions && bulkActions.length > 0
              ? true
              : false
            : multiple,
        selected: store.selectedItemsAsArray,
        strictMode,
        keepItemSelectionOnPageChange,
        maxKeepItemSelectionLength,
        maxItemSelectionLength,
        valueField: valueField || primaryField,
        primaryField,
        hideQuickSaveBtn,
        items: store.data.items,
        fullItems: store.itemsAsArray,
        query: store.query,
        orderBy: store.query.orderBy,
        orderDir: store.query.orderDir,
        popOverContainer,
        onAction: this.handleAction,
        dispatchEvent: this.dispatchEvent,
        onItemChange: this.handleItemChange,
        onSave: this.handleSave,
        onSaveOrder: this.handleSaveOrder,
        onQuery: this.handleQuery,
        onSelect: this.handleSelect,
        onPopOverOpened: this.handleChildPopOverOpen,
        onPopOverClosed: this.handleChildPopOverClose,
        onSearchableFromReset: this.handleFilterReset,
        onSearchableFromSubmit: this.handleFilterSubmit,
        onSearchableFromInit: this.handleFilterInit,
        headerToolbarRender: this.renderHeaderToolbar,
        footerToolbarRender: this.renderFooterToolbar,
        data: store.mergedData,
        loading: store.loading,
        offset: store.offset,
        host: this,
        filterItemIndex: this.filterItemIndex,
        onDbClick: this.props.rowDbClick,
        testIdBuilder: testIdBuilder?.getChild('body'),
      }
    )
  }

  renderHeaderToolbar(childProps: any, toolbarRenderer?: any) {
    const { toolbar, toolbarInline, mode } = this.props as any
    let { headerToolbar } = this.props as any

    if (toolbar) {
      if (Array.isArray(headerToolbar)) {
        headerToolbar = toolbarInline
          ? headerToolbar.concat(toolbar as any)
          : ([headerToolbar, toolbar] as any)
      } else if (headerToolbar) {
        headerToolbar = [headerToolbar, toolbar] as any
      } else {
        headerToolbar = toolbar as any
      }
    }

    headerToolbar = normalizeCrudHeaderToolbar(headerToolbar, mode)

    return this.renderToolbar(
      (headerToolbar as any) || [],
      0,
      childProps,
      toolbarRenderer
    )
  }

  renderFilter() {
    const {
      store,
      render,
      classnames: cx,
      filter,
      translate: __,
      testIdBuilder,
      filterCanAccessSuperData = true,
    } = this.props

    if (!filter || (store.filterTogglable && !store.filterVisible)) {
      return null
    }

    const renderedFilter = this.filterSmartLayoutRuntime.renderFilter({
      filter,
      systemConfig: this.resolveSystemConfig(),
      translate: __,
    })

    return render(
      'filter',
      {
        ...renderedFilter,
        testIdBuilder: testIdBuilder?.getChild('filter'),
      },
      {
        key: 'filter',
        panelClassName: cx('Crud-filter', filter.panelClassName || 'Crud-filter--flat'),
        data: store.filterData,
        onReset: this.handleFilterReset,
        onSubmit: this.handleFilterSubmit,
        onInit: this.handleFilterInit,
        formStore: undefined,
        canAccessSuperData: filter?.canAccessSuperData ?? filterCanAccessSuperData,
      }
    )
  }
}
