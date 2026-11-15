import React from 'react'
import { Renderer, TableStore, createObject } from 'amis-core'
import type { IColumn, IScopedContext } from 'amis-core'
import { HeadCellFilterDropDown } from 'amis/lib/renderers/Table/HeadCellFilterDropdown'
import { HeadCellSearchDropDown } from 'amis/lib/renderers/Table/HeadCellSearchDropdown'
import AmisTableCell from 'amis/lib/renderers/Table/Cell'
import { exportExcel } from 'amis/lib/renderers/Table/exportExcel'
import { TableRendererBase } from 'amis/lib/renderers/Table/index'
import type { TableProps } from 'amis/lib/renderers/Table/index'
import { Icon } from 'amis-ui'
import { getSnapshot, isAlive } from 'mobx-state-tree'

import { EnhancedColumnToggler } from './EnhancedColumnToggler'
import './Table.scss'
import {
  CooperativeTableContent,
  CooperativeTableSpinner,
  setVirtualTableBodyStore,
} from './cooperativeTableRendering'
import {
  canRenderSimpleStaticTextCell,
  getSimpleStaticTextRowData,
  resolveSimpleStaticTextCellClassNames,
  resolveSimpleStaticTextCellContent,
  resolveSimpleStaticTextCellStyle,
  resolveSimpleStaticTextCellText,
} from './tableStaticTextCell'
import {
  isTableLazyRenderGloballyDisabled,
  syncTableLazyRenderSystemConfig,
} from './tableLazyRenderSwitch'
import { resolvePatchedTableLayout, type TableLayoutDecisionInput } from './tableLayout'
import { registerEnhancedTableStore, type EnhancedTableStore } from './enhancedTableStore'
import {
  buildGroupedExportButtons,
  decorateExcelJSForNumericColumnFormats,
  EXPORT_EXCEL_BUTTON_ICON,
  EXPORT_EXCEL_BUTTON_LABEL,
  patchExportRowData,
  resolveExportColumns,
  resolveExportRows,
  resolveGroupedExportToolbars,
  resolveVisibleGroupedExportToolbars,
  type EnhancedExportExcelToolbar,
  type GroupedExportExcelToolbar,
} from './tableExcelExport'
import { TableColumnSettingsController } from './tableColumnSettingsController'
import { getExplicitTableColumnMinWidth } from './tableColumnSizing'
import { TableDomLifecycle } from './tableDomLifecycle'

type PatchedTableProps = TableProps &
  TableLayoutDecisionInput & {
    api?: any
    data?: Record<string, any>
    maxFixedLeft?: number
    maxFixedRight?: number
    query?: Record<string, any>
    store: EnhancedTableStore
    $schema?: {
      columns?: Array<Record<string, any>>
      loadingMaxDuration?: number | string
      lazyRenderAfter?: number | string
    }
  }

function isRowLazyRenderActive(store: any) {
  const lazyRenderAfter =
    typeof store?.lazyRenderAfter === 'number' && Number.isFinite(store.lazyRenderAfter)
      ? store.lazyRenderAfter
      : undefined
  const rowCount = typeof store?.rows?.length === 'number' ? store.rows.length : 0

  return (
    Boolean(store?.cooperativeRenderingPending) ||
    (typeof lazyRenderAfter === 'number' &&
      lazyRenderAfter > 0 &&
      rowCount > lazyRenderAfter)
  )
}

function shouldUseCooperativeLazyCell(store: any, column: IColumn) {
  const filteredColumnCount =
    typeof store?.filteredColumns?.length === 'number' ? store.filteredColumns.length : 0
  const columnType = String(column?.type ?? '')

  return (
    filteredColumnCount > 20 &&
    !column?.fixed &&
    columnType !== 'operation' &&
    !columnType.startsWith('__')
  )
}

function deferSelectionNotification(callback: () => void | Promise<void>) {
  if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
    window.setTimeout(() => {
      Promise.resolve(callback())
    }, 0)
    return
  }

  Promise.resolve().then(callback)
}

registerEnhancedTableStore()

@Renderer({
  type: 'table',
  name: 'OuroborosTable',
  storeType: TableStore.name,
  override: true,
  weight: -200,
})
// affixHeader 模式下，amis 会把固定表头和表体拆成两张表。
// 当表体在表头测宽后再出现长内容时，默认 auto layout 会重新分配正文列宽，导致两张表错位。
// 这里在未显式配置 tableLayout 时，将 affixHeader 表格统一收敛为 fixed layout。
export default class OuroborosTableRenderer extends TableRendererBase<PatchedTableProps> {
  private readonly columnSettingsController: TableColumnSettingsController
  private readonly tableDomLifecycle: TableDomLifecycle

  constructor(props: PatchedTableProps, context: IScopedContext) {
    super(props, context)
    this.columnSettingsController = new TableColumnSettingsController({
      getSchemaColumns: () => this.props.$schema?.columns,
      getStore: () => this.props.store,
      requestRender: () => this.forceUpdate(),
    })
    this.tableDomLifecycle = new TableDomLifecycle({
      clearBaseResizeSession: () => {
        delete this.resizeLine
      },
      getClassPrefix: () => this.props.classPrefix,
      getColumns: () => this.props.store.columns,
      getLayoutProps: () => this.props,
      getResizeListeners: () => ({
        mousemove: this.handleColResizeMouseMove,
        mouseup: this.handleColResizeMouseUp,
      }),
      getRoot: () => this.dom.current,
      setBaseResizeSession: ({ line, startWidth, startX }) => {
        this.resizeLine = line
        this.lineStartWidth = startWidth
        this.lineStartX = startX
      },
    })
    this.syncImplicitTableLayout(props)
    this.handleColResizeMouseDown = this.handleColResizeMouseDown.bind(this)
    this.handleColResizeMouseMove = this.handleColResizeMouseMove.bind(this)
    this.handleColResizeMouseUp = this.handleColResizeMouseUp.bind(this)
  }

  componentDidMount() {
    super.componentDidMount()
    this.applyExplicitColumnSizing()
    this.tableDomLifecycle.syncAffixHeaderScrollbarGutter()
  }

  componentDidUpdate(prevProps: PatchedTableProps) {
    this.syncImplicitTableLayout(this.props)
    super.componentDidUpdate(prevProps)
    this.applyExplicitColumnSizing()
    this.tableDomLifecycle.syncAffixHeaderScrollbarGutter()
  }

  componentWillUnmount() {
    this.tableDomLifecycle.dispose()
    this.columnSettingsController.dispose()
    if (isAlive(this.props.store)) {
      this.props.store.cancelCooperativeRendering?.()
    }
    super.componentWillUnmount()
  }

  renderHeading() {
    const { title, quickSaveApi, draggable } = this.props

    if (!title && !quickSaveApi && !draggable) {
      return null
    }

    return super.renderHeading()
  }

  renderToolbar(toolbar: any) {
    const type = toolbar?.type || toolbar

    if (type === 'columns-toggler') {
      this.renderedToolbars.push(type)
      return this.renderColumnsToggler(toolbar)
    }

    return super.renderToolbar(toolbar)
  }

  updateTableInfo(callback?: () => void) {
    super.updateTableInfo(() => {
      this.applyExplicitColumnSizing()
      callback?.()
    })
    this.applyExplicitColumnSizing()
  }

  renderHeader(editable?: boolean) {
    const {
      classnames: cx,
      header,
      headerToolbarClassName,
      host,
      showHeader,
      store,
      toolbarClassName,
      translate: __,
    } = this.props as PatchedTableProps & { host?: any }
    const hostProps = host?.props
    const headerToolbar = hostProps?.headerToolbar
    const hasOnlyInactiveBulkActions =
      hostProps &&
      !hostProps.toolbar &&
      Array.isArray(headerToolbar) &&
      headerToolbar.length > 0 &&
      headerToolbar.every((item: unknown) => item === 'bulkActions') &&
      (!Array.isArray(hostProps.bulkActions) || !hostProps.bulkActions.length)

    if (showHeader !== false && !header && hasOnlyInactiveBulkActions) {
      const actions = this.renderActions('header')
      return actions || store.dragging ? (
        <div
          className={cx(
            'Table-toolbar Table-headToolbar',
            toolbarClassName,
            headerToolbarClassName
          )}
          key="header-toolbar"
        >
          {actions}
          {store.dragging ? (
            <div className={cx('Table-dragTip')} ref={this.dragTipRef}>
              {__('Table.dragTip')}
            </div>
          ) : null}
        </div>
      ) : null
    }

    return super.renderHeader(editable)
  }

  renderFooter() {
    const {
      affixFooter,
      classnames: cx,
      footer,
      footerToolbarClassName,
      footerToolbarRender,
      host,
      showFooter,
      toolbarClassName,
    } = this.props as PatchedTableProps & { host?: any }
    const hostProps = host?.props
    const footerToolbar = hostProps?.footerToolbar
    const hasOnlyDataIndependentCrudFooterTools =
      hostProps &&
      !hostProps.toolbar &&
      Array.isArray(footerToolbar) &&
      footerToolbar.length > 0 &&
      footerToolbar.every(
        (item: unknown) => item === 'statistics' || item === 'pagination'
      )

    if (
      showFooter !== false &&
      !footer &&
      footerToolbarRender &&
      hasOnlyDataIndependentCrudFooterTools
    ) {
      const child = footerToolbarRender({ ...this.props }, this.renderToolbar)
      const actions = this.renderActions('footer')
      return actions || child ? (
        <div
          className={cx(
            'Table-toolbar Table-footToolbar',
            toolbarClassName,
            footerToolbarClassName,
            affixFooter ? 'Table-footToolbar--affix' : ''
          )}
          key="footer-toolbar"
        >
          {actions}
          {child}
        </div>
      ) : null
    }

    return super.renderFooter()
  }

  renderTableContent() {
    syncTableLazyRenderSystemConfig(
      (this.props as any).SystemConfig ??
        (this.props as any).$schema?.SystemConfig ??
        (this.props as any).env?.rootData?.SystemConfig
    )
    const virtualTableBodyConfig =
      (this.props as any).virtualTableBody ??
      (this.props as any).$schema?.virtualTableBody
    const explicitVirtual = virtualTableBodyConfig === true
    const virtualDisabled = virtualTableBodyConfig === false
    setVirtualTableBodyStore(
      this.props.store,
      explicitVirtual,
      !virtualDisabled && Boolean((this.props as any).autoFillHeight)
    )
    const content = super.renderTableContent() as React.ReactElement
    const children = React.Children.toArray(content.props.children)
    const tableContent = children[0]

    if (!React.isValidElement(tableContent)) {
      return content
    }

    return (
      <>
        <CooperativeTableContent
          {...(tableContent.props as any)}
          renderRichCell={(
            region: string,
            column: IColumn,
            item: any,
            props: any
          ) => this.renderNonVirtualTableCell(region, column, item, props, false)}
        />
        <CooperativeTableSpinner
          classnames={this.props.classnames}
          loadingConfig={(this.props as any).loadingConfig}
          store={this.props.store}
        />
      </>
    )
  }

  private syncImplicitTableLayout(props: PatchedTableProps) {
    const nextTableLayout = resolvePatchedTableLayout(props)
    if (props.store.tableLayout !== nextTableLayout) {
      props.store.update({ tableLayout: nextTableLayout })
    }
  }

  private applyExplicitColumnSizing() {
    const columns = this.props.store?.columns
    if (!Array.isArray(columns)) {
      return
    }

    columns.forEach((column: any) => {
      const explicitMinWidth = getExplicitTableColumnMinWidth(column)

      if (typeof explicitMinWidth === 'number') {
        column.setMinWidth?.(explicitMinWidth)
        if (typeof column.width === 'number' && column.width < explicitMinWidth) {
          column.setWidth?.(explicitMinWidth)
        }
      }
    })
  }

  renderColumnsToggler(config?: any) {
    const {
      classPrefix: ns,
      classnames: cx,
      env,
      maxFixedLeft: maxFixedLeftFromProps = 3,
      maxFixedRight: maxFixedRightFromProps = 3,
      render,
      store,
      translate: __,
    } = this.props

    if (!store.columnsTogglable) {
      return null
    }

    const columnSettings = this.columnSettingsController
    const currentColumns = columnSettings.getCurrentColumnsState()
    const maxFixedLeft = config?.maxFixedLeft ?? maxFixedLeftFromProps
    const maxFixedRight = config?.maxFixedRight ?? maxFixedRightFromProps

    return (
      <div
        className={cx('EnhancedColumnToggler-trigger', 'ColumnToggler', {
          'is-opened': columnSettings.isOpen,
        })}
        ref={columnSettings.captureTarget}
      >
        <button
          type="button"
          onClick={columnSettings.toggle}
          title="列设置"
          aria-label="列设置"
          className={cx('Button', 'Button--default', 'Button--size-sm')}
        >
          <Icon cx={cx} icon="columns" className={cx('icon')} />
          <span className={cx('ColumnToggler-caret')}>
            <Icon icon="right-arrow-bold" className="icon" />
          </span>
        </button>

        <EnhancedColumnToggler
          columns={currentColumns}
          onReset={columnSettings.reset}
          onCancel={columnSettings.close}
          onConfirm={columnSettings.confirm}
          onClose={columnSettings.close}
          classnames={cx}
          classPrefix={ns}
          render={render}
          translate={__}
          isOpened={columnSettings.isOpen}
          target={columnSettings.target}
          popOverContainer={columnSettings.getPopOverContainer}
          env={env}
          maxFixedLeft={maxFixedLeft}
          maxFixedRight={maxFixedRight}
        />
      </div>
    )
  }

  private canRenderSafeStaticTextCell(column: IColumn, item: any) {
    if (this.props.itemBadge || this.props.store?.isNested || column.isPrimary) {
      return false
    }

    if (item?.rowSpans?.[column.name] === 0) {
      return true
    }

    return canRenderSimpleStaticTextCell(column, { allowTplType: true })
  }

  private renderSafeStaticTextCell(column: IColumn, item: any, props: any) {
    if (item?.rowSpans?.[column.name as string] === 0) {
      return null
    }

    const cx = this.props.classnames
    const [stickyStyle = {}, stickyClassName = ''] =
      typeof this.props.store?.getStickyStyles === 'function'
        ? this.props.store.getStickyStyles(column, this.props.store.filteredColumns)
        : [{}, '']
    const rowData = getSimpleStaticTextRowData(item)
    const content = resolveSimpleStaticTextCellContent(column, rowData)
    const textValue = content
      ? content.muted
        ? <span className="text-muted">{content.text}</span>
        : content.text
      : resolveSimpleStaticTextCellText(column, rowData)
    const classNames = resolveSimpleStaticTextCellClassNames(
      column,
      rowData,
      stickyClassName
    )
    const rowSpan = item?.rowSpans?.[column.name as string]
    const columnStyle = resolveSimpleStaticTextCellStyle(column)

    return (
      <td
        key={props.key}
        style={columnStyle ? { ...columnStyle, ...stickyStyle } : stickyStyle}
        className={cx(...classNames)}
        rowSpan={rowSpan || undefined}
        {...this.props.testIdBuilder
          ?.getChild(`cell-${props.rowPath}-${column.index}`)
          .getTestId()}
      >
        {textValue}
      </td>
    )
  }

  private renderNonVirtualTableCell(
    region: string,
    column: IColumn,
    item: any,
    props: any,
    ignoreDrag: boolean
  ) {
    const {
      canAccessSuperData,
      classPrefix,
      classnames,
      filterItemIndex,
      itemBadge,
      offset,
      render,
      store,
      testIdBuilder,
      translate,
    } = this.props

    return (
      <AmisTableCell
        key={props.key}
        region={region}
        column={column}
        item={item}
        props={props}
        ignoreDrag={ignoreDrag}
        render={render}
        filterItemIndex={filterItemIndex}
        store={store}
        multiple={store.multiple}
        canAccessSuperData={canAccessSuperData}
        classnames={classnames}
        classPrefix={classPrefix}
        itemBadge={itemBadge}
        onCheck={(this as any).handleCheck}
        onDragStart={(this as any).handleDragStart}
        popOverContainer={(this as any).getPopOverContainer}
        quickEditFormRef={(this as any).subFormRef}
        onImageEnlarge={(this as any).handleImageEnlarge}
        translate={translate}
        testIdBuilder={testIdBuilder?.getChild(`cell-${props.rowPath}-${column.index}`)}
        offset={offset}
      />
    )
  }

  renderCell(region: string, column: IColumn, item: any, props: any, ignoreDrag = false) {
    if (this.canRenderSafeStaticTextCell(column, item)) {
      return this.renderSafeStaticTextCell(column, item, props)
    }

    if (shouldUseCooperativeLazyCell(this.props.store, column)) {
      // 行级懒渲染（LazyRow）已经按帧控制“哪些行出现、每帧出现几行”；
      // 单元格随行在同一帧整行渲染。再叠加逐格 LazyCell 会让一行分多帧补齐，
      // 首屏出现肉眼可见的“一行一行慢慢显示”，并引入每格一个 InView 的开销。
      // 全局关闭懒渲染时也直接整格渲染，不再走 AMIS 原生 VCell。
      if (
        isRowLazyRenderActive(this.props.store) ||
        isTableLazyRenderGloballyDisabled()
      ) {
        return this.renderNonVirtualTableCell(
          region,
          column,
          item,
          props,
          ignoreDrag
        )
      }
    }

    const renderedCell = super.renderCell(region, column, item, props, ignoreDrag)

    return renderedCell
  }

  async handleCheck(item: any, value?: boolean, shift?: boolean): Promise<void> {
    const { store, data, dispatchEvent, selectable } = this.props

    if (!selectable) {
      return
    }

    const nextValue = value !== undefined ? value : !item.checked
    if (shift) {
      store.toggleShift(item, nextValue)
    } else {
      item.toggle(nextValue)
    }

    // Let the browser paint the checkbox state before walking selected rows
    // and invoking user-defined selection handlers.
    deferSelectionNotification(async () => {
      this.syncSelected()
      await dispatchEvent(
        'selectedChange',
        createObject(data, {
          ...store.eventContext,
          item: item.data,
        })
      )
    })
  }

  renderHeadCell(column: IColumn, props?: any) {
    if ((column.type ?? '').startsWith('__')) {
      return super.renderHeadCell(column, props)
    }

    const {
      autoGenerateFilter,
      classnames: cx,
      data,
      dispatchEvent,
      onQuery,
      query,
      render,
      resizable,
      store,
      testIdBuilder,
    } = this.props

    const isFirstRightFixedColumn = (() => {
      if (column.fixed !== 'right') {
        return false
      }

      const rightFixedColumns = store.filteredColumns.filter(
        (filteredColumn: IColumn) => filteredColumn.fixed === 'right'
      )

      if (!rightFixedColumns.length) {
        return false
      }

      return column.index === rightFixedColumns[0].index
    })()

    const resizeLine = (
      <div
        className={cx('Table-content-colDragLine')}
        key={`resize-right-${column.id}`}
        data-index={column.index}
        data-side="right"
        onMouseDown={this.handleColResizeMouseDown}
      />
    )

    const resizeLineOnLeft = isFirstRightFixedColumn ? (
      <div
        className={cx('Table-content-colDragLine', 'Table-content-colDragLine--left')}
        key={`resize-left-${column.id}`}
        data-index={column.index}
        data-side="left"
        onMouseDown={this.handleColResizeMouseDown}
      />
    ) : null

    const tIdCell = testIdBuilder?.getChild(`head-cell-${column.name}`)
    const style = { ...props?.style }
    const [stickyStyle, stickyClassName] = store.getStickyStyles(
      column,
      store.filteredColumns
    )
    Object.assign(style, stickyStyle)

    const { key, ...restProps } = props || {}
    const prefix: Array<JSX.Element> = []
    const affix: Array<JSX.Element> = []

    if (column.isPrimary && store.isNested) {
      const shouldRenderExpandToggle = !(
        (store.footable &&
          (store.footable.expandAll === false || store.footable.accordion)) ||
        (store.expandConfig &&
          (store.expandConfig.expandAll === false || store.expandConfig.accordion))
      )

      if (shouldRenderExpandToggle) {
        prefix.push(
          <a
            key="expandBtn"
            className={cx('Table-expandBtn2', store.allExpanded ? 'is-active' : '')}
            onClick={store.toggleExpandAll}
          >
            <Icon icon="right-arrow-bold" className="icon" />
          </a>
        )
      }
    }

    if (column.searchable && column.name && !autoGenerateFilter) {
      affix.push(
        <HeadCellSearchDropDown
          {...restProps}
          key="table-head-search"
          {...this.props}
          onQuery={onQuery}
          name={column.name}
          searchable={column.searchable}
          type={column.type}
          data={query}
          testIdBuilder={tIdCell?.getChild('search')}
          popOverContainer={this.getPopOverContainer}
        />
      )
    }

    if (column.sortable && column.name) {
      const handleSort = async (targetOrderDir: 'asc' | 'desc') => {
        let orderBy = ''
        let orderDir = '' as '' | 'asc' | 'desc'

        if (column.name === store.orderBy && store.orderDir === targetOrderDir) {
          orderBy = ''
          orderDir = ''
        } else {
          orderBy = column.name || ''
          orderDir = targetOrderDir
        }

        const rendererEvent = await dispatchEvent(
          'columnSort',
          createObject(data, {
            orderBy,
            orderDir,
          })
        )

        if (rendererEvent?.prevented) {
          return
        }

        if (
          !onQuery ||
          onQuery({
            orderBy,
            orderDir,
          }) === false
        ) {
          store.changeOrder(orderBy, orderDir)
        }
      }

      affix.push(
        <span key="table-head-sort" className="table-sort">
          <i
            title="升序：最低到最高"
            className={cx(
              'table-sort__up',
              store.orderBy === column.name && store.orderDir === 'asc' ? 'is-active' : ''
            )}
            onClick={async (event) => {
              event.stopPropagation()
              await handleSort('asc')
            }}
          >
            <span className="icon" aria-hidden="true" />
          </i>

          <i
            title="降序：最高到最低"
            className={cx(
              'table-sort__down',
              store.orderBy === column.name && store.orderDir === 'desc'
                ? 'is-active'
                : ''
            )}
            onClick={async (event) => {
              event.stopPropagation()
              await handleSort('desc')
            }}
          >
            <span className="icon" aria-hidden="true" />
          </i>
        </span>
      )
    }

    if (!column.searchable && column.filterable && column.name && onQuery) {
      affix.push(
        <HeadCellFilterDropDown
          key="table-head-filter"
          {...this.props}
          onQuery={onQuery}
          name={column.name}
          type={column.type}
          data={query}
          superData={createObject(data, query)}
          filterable={column.filterable}
          popOverContainer={this.getPopOverContainer}
          testIdBuilder={tIdCell?.getChild('filter')}
        />
      )
    }

    return (
      <th
        {...restProps}
        key={key}
        style={style}
        className={cx(props ? props.className : '', stickyClassName, {
          'TableCell--sortable': column.sortable,
          'TableCell--searchable': column.searchable,
          'TableCell--filterable': column.filterable,
          'Table-operationCell': column.type === 'operation',
        })}
        {...tIdCell?.getTestId()}
      >
        {resizable === false ? null : resizeLineOnLeft}

        <div className={cx('table-head-content')}>
          {prefix}
          <div
            key="content"
            className={cx(
              'TableCell--title',
              column.pristine.className,
              column.pristine.labelClassName
            )}
            style={props?.style}
          >
            {(props?.label ?? column.label)
              ? render('tpl', props?.label ?? column.label)
              : null}

            {column.remark
              ? render('remark', {
                  type: 'remark',
                  tooltip: column.remark,
                  container: this.getPopOverContainer,
                })
              : null}
          </div>

          {affix}
        </div>
        {resizable === false ? null : resizeLine}
      </th>
    )
  }

  handleColResizeMouseDown(event: React.MouseEvent<HTMLElement>) {
    this.tableDomLifecycle.beginResize(event)
  }

  handleColResizeMouseMove(event: MouseEvent) {
    this.tableDomLifecycle.resize(event)
  }

  handleColResizeMouseUp(event: MouseEvent) {
    if (!this.tableDomLifecycle.isResizing) {
      return
    }

    super.handleColResizeMouseUp(event)
    this.tableDomLifecycle.completeResize()
    this.props.store.persistSaveToggledColumns()
  }

  renderExportExcel(toolbar: EnhancedExportExcelToolbar) {
    const { store } = this.props
    if (!store.filteredColumns?.length) {
      return null
    }

    const groupedToolbars = resolveGroupedExportToolbars(toolbar)
    if (groupedToolbars.length) {
      return this.renderGroupedExportExcel(
        toolbar as GroupedExportExcelToolbar,
        groupedToolbars
      )
    }

    return this.renderSingleExportExcel(toolbar)
  }

  private renderSingleExportExcel(toolbar: EnhancedExportExcelToolbar) {
    const { render, store } = this.props
    const toolbarConfig = toolbar as Record<string, any>

    return render(
      'exportExcel',
      {
        ...toolbarConfig,
        icon: toolbarConfig.icon ?? EXPORT_EXCEL_BUTTON_ICON,
        label: toolbarConfig.label ?? EXPORT_EXCEL_BUTTON_LABEL,
        type: 'button',
      },
      {
        loading: store.exportExcelLoading,
        onAction: () => this.triggerExportExcel(toolbar),
      }
    )
  }

  private renderGroupedExportExcel(
    toolbar: GroupedExportExcelToolbar,
    groupedToolbars: EnhancedExportExcelToolbar[]
  ) {
    const { render, store } = this.props
    const toolbarConfig = toolbar as Record<string, any>
    const visibleToolbars = resolveVisibleGroupedExportToolbars(groupedToolbars, {
      data: this.props.data,
      hasAuth: (this.props as any).SystemContext?.hasAuth,
      page: store.page,
      perPage: store.perPage,
      query: this.props.query,
      total: store.total,
    })

    if (!visibleToolbars.length) {
      return null
    }

    if (visibleToolbars.length === 1) {
      return this.renderSingleExportExcel(visibleToolbars[0])
    }

    return render(
      'exportExcel',
      {
        ...toolbarConfig,
        icon: toolbarConfig.icon ?? EXPORT_EXCEL_BUTTON_ICON,
        label: toolbarConfig.label ?? EXPORT_EXCEL_BUTTON_LABEL,
        buttons: buildGroupedExportButtons(visibleToolbars, (item) =>
          this.triggerExportExcel(item)
        ),
        closeOnClick: true,
        type: 'dropdown-button',
      },
      {
        btnDisabled: store.exportExcelLoading,
      }
    )
  }

  private async triggerExportExcel(toolbar: EnhancedExportExcelToolbar) {
    const { store } = this.props

    store.update({ exportExcelLoading: true })

    try {
      const module = await import('exceljs')
      const ExcelJS = module.default || module
      await this.exportTableExcel(ExcelJS, toolbar)
    } catch (error) {
      console.error(error)
      this.props.env?.notify?.('error', '导出失败，请稍后重试')
    } finally {
      store.update({ exportExcelLoading: false })
    }
  }

  private async exportTableExcel(ExcelJS: any, toolbar: EnhancedExportExcelToolbar) {
    const exportColumns = resolveExportColumns(toolbar, this.props.store.exportColumns)
    const sourceRows = await resolveExportRows(toolbar, {
      data: this.props.data,
      fetcher: this.props.env?.fetcher,
      getCurrentRows: () => this.props.store.rows.map((row: any) => row.data),
      getSelected: () => this.getSelected(),
      query: this.props.query,
    })
    const normalizedRows = sourceRows.map((row) => patchExportRowData(row, exportColumns))
    const snapshot = getSnapshot(this.props.store as any) as any
    const tmpStore = TableStore.create(snapshot)
    tmpStore.updateColumns(exportColumns)
    tmpStore.update({ lazyRenderAfter: Number.MAX_SAFE_INTEGER })
    tmpStore.initRows(normalizedRows)

    const exportToolbar = {
      ...(toolbar as Record<string, any>),
    }
    delete (exportToolbar as any).api

    const exportExcelJS = decorateExcelJSForNumericColumnFormats(ExcelJS, exportColumns)

    await exportExcel(
      exportExcelJS,
      {
        ...this.props,
        store: tmpStore,
      },
      exportToolbar as EnhancedExportExcelToolbar
    )
  }
}
