import React from 'react'
import ReactDOM from 'react-dom'
import { resizeSensor } from 'amis-core'
import { TableBody as AmisTableBody } from 'amis/lib/renderers/Table/TableBody'
import { TableContent as AmisTableContent } from 'amis/lib/renderers/Table/TableContent'
import flatten from 'lodash/flatten'
import { observer } from 'mobx-react'
import {
  canRenderSimpleStaticTextCell,
  getSimpleStaticTextRowData,
  resolveSimpleStaticTextCellClassNames,
  resolveSimpleStaticTextCellContent,
  resolveSimpleStaticTextCellStyle,
} from './tableStaticTextCell'
import { isTableLazyRenderGloballyDisabled } from './tableLazyRenderSwitch'
import { LazyRow } from './tableLazyRow/LazyRow'

export { flushLazyRowRenderQueue } from './tableLazyRow/LazyRow'

const AmisTableBodyBase =
  AmisTableBody as unknown as React.ComponentClass<any>
const AmisTableContentBase =
  AmisTableContent as unknown as React.ComponentClass<any>

// 由 OuroborosTable 在渲染前标记：
// - explicit：schema/属性显式要求虚拟表体；
// - auto：表格具备自动虚拟化的运行环境（内部滚动区域），行/列规模与特性在表体渲染时再判断。
// 存放在 WeakSet 里避免给 MST store 增加未声明的字段。
const explicitVirtualTableBodyStores = new WeakSet<any>()
const autoVirtualTableBodyStores = new WeakSet<any>()

export function setVirtualTableBodyStore(
  store: any,
  explicit: boolean,
  autoEligible = false
) {
  if (!store) {
    return
  }

  if (explicit) {
    explicitVirtualTableBodyStores.add(store)
  } else {
    explicitVirtualTableBodyStores.delete(store)
  }

  if (autoEligible) {
    autoVirtualTableBodyStores.add(store)
  } else {
    autoVirtualTableBodyStores.delete(store)
  }
}

function isRowCollection(value: any): value is any[] {
  return (
    !!value &&
    typeof value.length === 'number' &&
    typeof value.slice === 'function'
  )
}

function getRowCollection(value: any): any[] {
  return isRowCollection(value) ? value : []
}

function rowsPropsEqual(left: any, right: any) {
  if (left === right) {
    return true
  }

  const leftKeys = Object.keys(left || {})
  const rightKeys = Object.keys(right || {})
  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every((key) => left[key] === right[key])
}

function resolveEagerPlaceholderCellText(column: any, row: any) {
  // 占位行只负责“先给出可读文本”，不执行完整单元格渲染；
  // 数字/日期/映射要与正式渲染使用同一套直出逻辑，避免出现 SALE/1 这类原始值。
  const content = resolveSimpleStaticTextCellContent(
    column,
    getSimpleStaticTextRowData(row)
  )

  return content && !content.muted ? content.text : null
}

function resolveEagerPlaceholderClassNames(
  column: any,
  row: any,
  stickyClassName: string
) {
  return resolveSimpleStaticTextCellClassNames(
    column,
    getSimpleStaticTextRowData(row),
    stickyClassName
  )
}

function canRenderEagerPlaceholderCell(column: any) {
  return canRenderSimpleStaticTextCell(column)
}

function shouldUseCooperativePlaceholderClass(store: any) {
  const lazyRenderAfter =
    typeof store.lazyRenderAfter === 'number' &&
    Number.isFinite(store.lazyRenderAfter)
      ? store.lazyRenderAfter
      : undefined

  return (
    store.cooperativeRenderingPending ||
    (typeof lazyRenderAfter === 'number' &&
      lazyRenderAfter > 0 &&
      store.rows.length > lazyRenderAfter)
  )
}

// 子类覆盖 render 后必须重新建立 MobX 订阅，否则展开状态变化只更新行本身，无法挂载子行。
@observer
export class CooperativeTableBody extends AmisTableBodyBase {
  private stableRowsProps: any = null

  private getLazyRenderAfter() {
    const value = this.props.store?.lazyRenderAfter
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? value
      : Number.MAX_SAFE_INTEGER
  }

  private getStableRowsProps() {
    const rowsProps = this.props.rowsProps || {}
    if (!this.stableRowsProps || !rowsPropsEqual(this.stableRowsProps, rowsProps)) {
      this.stableRowsProps = rowsProps
    }

    return this.stableRowsProps
  }

  private shouldLazyRenderRows() {
    if (isTableLazyRenderGloballyDisabled()) {
      return false
    }

    const rows = getRowCollection(this.props.rows)
    const lazyRenderAfter = this.getLazyRenderAfter()

    if (
      this.props.footable ||
      Number(this.props.store?.combineNum || 0) > 0 ||
      rows.some((row) => Array.isArray(row?.children) && row.children.length)
    ) {
      return false
    }

    return (
      this.props.store?.cooperativeRenderingPending ||
      rows.length > lazyRenderAfter
    )
  }

  private getRowIdentityKey(row: any, index: number) {
    const rowPath = row?.path ?? row?.index ?? index

    return `${row?.id ?? 'row'}-${rowPath}`
  }

  private getPlaceholderColumnKey(column: any, index: number) {
    return (
      column?.columnKey ||
      column?.id ||
      column?.name ||
      column?.index ||
      column?.type ||
      index
    )
  }

  private renderPlaceholderRow = (
    row: any,
    rowIndex: number,
    rowRef?: React.Ref<HTMLTableRowElement>
  ) => {
    const columns = Array.isArray(this.props.columns) ? this.props.columns : []
    const cx =
      typeof this.props.classnames === 'function'
        ? this.props.classnames
        : (...tokens: any[]) => tokens.filter(Boolean).join(' ')

    return (
      <tr
        ref={rowRef}
        key={`lazy-row-placeholder-${this.getRowIdentityKey(row, rowIndex)}`}
        data-lazy-row-placeholder="true"
        data-lazy-row-key={this.getRowIdentityKey(row, rowIndex)}
        data-index={rowIndex}
        row-index={rowIndex}
      >
        {columns.length ? (
          columns.map((column: any, index: number) => {
            const [stickyStyle = {}, stickyClassName = ''] =
              typeof this.props.store?.getStickyStyles === 'function'
                ? this.props.store.getStickyStyles(column, columns)
                : [{}, '']
            const columnKey = this.getPlaceholderColumnKey(column, index)
            const rowSpan = column?.name ? row?.rowSpans?.[column.name] : undefined
            const renderEmptyPlaceholderCell = () => (
              <td
                key={`lazy-row-placeholder-cell-${columnKey}`}
                className={cx(stickyClassName)}
                style={stickyStyle}
                rowSpan={rowSpan > 1 ? rowSpan : undefined}
              >
                <div className={cx('Table-emptyBlock')}>&nbsp;</div>
              </td>
            )

            if (column?.name && row?.rowSpans?.[column.name] === 0) {
              return null
            }

            if (canRenderEagerPlaceholderCell(column)) {
              const eagerCellText = resolveEagerPlaceholderCellText(column, row)

              if (eagerCellText === null) {
                return renderEmptyPlaceholderCell()
              }

              return (
                <td
                  key={`lazy-row-placeholder-cell-${columnKey}`}
                  className={cx(
                    ...resolveEagerPlaceholderClassNames(column, row, stickyClassName)
                  )}
                  style={stickyStyle}
                  rowSpan={rowSpan > 1 ? rowSpan : undefined}
                >
                  {eagerCellText}
                </td>
              )
            }

            return renderEmptyPlaceholderCell()
          })
        ) : (
          <td>
            <div className={cx('Table-emptyBlock')}>&nbsp;</div>
          </td>
        )}
      </tr>
    )
  }

  private decorateRenderedRow(
    row: React.ReactElement,
    sourceRow: any,
    rowIndex: number,
    renderedRowOffset = 0
  ) {
    if (!React.isValidElement(row)) {
      return row
    }

    const rowKey = this.getRowIdentityKey(sourceRow, rowIndex)
    const rowProps = row.props as any
    const displayIndex =
      rowProps?.item?.index ??
      rowProps?.item?.dataIndex ??
      rowProps?.item?.rowIndex ??
      rowIndex

    return React.cloneElement(row, {
      ...rowProps,
      key: row.key ?? `${rowKey}-${renderedRowOffset}`,
      itemIndex: rowIndex,
      rowPath: String(rowIndex),
      'data-index': displayIndex,
      'data-lazy-row-key': rowKey,
      'data-lazy-row-rendered': 'true',
    })
  }

  private renderRow = (row: any, rowIndex: number, rowsProps: any) => {
    const renderedRows = flatten(
      ([] as any[]).concat(
        (this as any).renderRows([row], this.props.columns, rowsProps)
      )
    ).filter(Boolean)

    return renderedRows.map((renderedRow: React.ReactElement, offset) =>
      this.decorateRenderedRow(renderedRow, row, rowIndex, offset)
    )
  }

  private renderPlainBody() {
    const { rows, columns, className, prefixRow, affixRow } = this.props
    const rowsProps = this.getStableRowsProps()
    const renderedRows = flatten(
      ([] as any[])
        .concat((this as any).renderSummary('prefix', prefixRow))
        .concat((this as any).renderRows(rows, columns, rowsProps))
        .concat((this as any).renderSummary('affix', affixRow))
    ).filter(Boolean)

    return <tbody className={className}>{renderedRows}</tbody>
  }

  private renderLazyRowsBody() {
    const { rows, className, prefixRow, affixRow } = this.props
    const lazyRenderAfter = this.getLazyRenderAfter()
    const rowsProps = this.getStableRowsProps()
    const renderedPrefixRows = flatten(
      ([] as any[]).concat((this as any).renderSummary('prefix', prefixRow))
    ).filter(Boolean)
    const renderedAffixRows = flatten(
      ([] as any[]).concat((this as any).renderSummary('affix', affixRow))
    ).filter(Boolean)

    return (
      <tbody className={className} data-lazy-row-body="true">
        {renderedPrefixRows}
        {getRowCollection(rows).map((row, rowIndex) => {
          const rowKey = this.getRowIdentityKey(row, rowIndex)

          return (
            <LazyRow
              key={`lazy-row-${rowKey}`}
              row={row}
              rowIndex={rowIndex}
              columns={this.props.columns}
              rowsProps={rowsProps}
              lazyRenderAfter={lazyRenderAfter}
              renderRow={this.renderRow}
              renderPlaceholderRow={this.renderPlaceholderRow}
            />
          )
        })}
        {renderedAffixRows}
      </tbody>
    )
  }

  private shouldUseAutoVirtualTableBody() {
    const store = this.props.store
    const rows = getRowCollection(this.props.rows)
    const columns = Array.isArray(store?.filteredColumns)
      ? store.filteredColumns
      : Array.isArray(store?.columns)
        ? store.columns
        : []

    if (rows.length < AUTO_VIRTUAL_MIN_ROWS || columns.length < 20) {
      return false
    }

    if ((this.props as any).tableLayout === 'auto') {
      return false
    }

    // 窗口化后表格必须固定布局，列宽来自列配置/colgroup；
    // 没有显式宽度的列在 fixed 布局下会被均匀压缩，因此不自动启用。
    const dataColumns = columns.filter(
      (column: any) => !String(column?.type || '').startsWith('__')
    )
    if (
      dataColumns.some(
        (column: any) => !column?.width && !column?.minWidth
      )
    ) {
      return false
    }

    if (
      this.props.footable ||
      this.props.prefixRow ||
      this.props.affixRow ||
      Number(store?.combineNum || 0) > 0 ||
      store?.expandConfig ||
      (this.props as any).draggable ||
      store?.dragOrder
    ) {
      return false
    }

    if (
      columns.some(
        (column: any) =>
          column?.quickEdit ||
          column?.children ||
          column?.type === 'input-table' ||
          column?.type === 'operation' ||
          column?.type === 'group' ||
          String(column?.type || '').startsWith('input-') ||
          AUTO_VIRTUAL_BLOCKED_COLUMN_TYPES.has(column?.type)
      )
    ) {
      return false
    }

    return !rows.some(
      (row: any) =>
        (Array.isArray(row?.children) && row.children.length) ||
        (row?.rowSpans && Object.keys(row.rowSpans).length)
    )
  }

  render() {
    const autoVirtualEligible =
      autoVirtualTableBodyStores.has(this.props.store) &&
      this.shouldUseAutoVirtualTableBody()
    if (
      isLightweightAllRowsEnabled(
        this.props.rows.length,
        autoVirtualEligible
      )
    ) {
      return (
        <LightweightAllRowsBody
          rows={this.props.rows}
          columns={this.props.columns}
          classnames={this.props.classnames}
          renderCell={this.props.renderRichCell}
          store={this.props.store}
          className={this.props.className}
        />
      )
    }

    const useVirtualTableBody =
      explicitVirtualTableBodyStores.has(this.props.store) ||
      (autoVirtualTableBodyStores.has(this.props.store) &&
        this.shouldUseAutoVirtualTableBody())

    if (useVirtualTableBody) {
      const { rows, columns, prefixRow, affixRow } = this.props
      const rowsProps = this.getStableRowsProps()
      const renderedRows = flatten(
        ([] as any[])
          .concat((this as any).renderSummary('prefix', prefixRow))
          .concat((this as any).renderRows(rows, columns, rowsProps))
          .concat((this as any).renderSummary('affix', affixRow))
      ).filter(Boolean)

      return (
        <CooperativeVirtualTableBody
          rows={renderedRows}
          dataRows={this.props.rows}
          columns={this.props.columns}
          classnames={this.props.classnames}
          renderCell={this.props.renderRichCell}
          store={this.props.store}
          className={this.props.className}
        />
      )
    }

    if (!this.shouldLazyRenderRows()) {
      return this.renderPlainBody()
    }

    return this.renderLazyRowsBody()
  }
}

// 轻量虚拟表体：只挂载视口附近的行。
// AMIS 原生 VirtualTableBody 固定预挂 20 行 + 上下各 10 行 buffer（首屏约 30 行），
// 45 列宽表在低配机上首屏会一次挂 1300+ 单元格。这里把 buffer 收敛到 3 行，
// 初始窗口按视口高度估算，滚动时再补窗口，避免首屏一次性构造过多单元格。
// 自动虚拟化的安全边界：行内可编辑控件一旦卸载会丢失编辑态，这类列不自动虚拟化。
const AUTO_VIRTUAL_BLOCKED_COLUMN_TYPES = new Set([
  'combo',
  'input-array',
  'picker',
  'radios',
  'checkboxes',
  'select',
  'switch',
  'textarea',
  'tree-select',
])

const AUTO_VIRTUAL_MIN_ROWS = 20
const VIRTUAL_TABLE_ROW_BUFFER = 3
const VIRTUAL_TABLE_WINDOW_STEP = 6
const VIRTUAL_TABLE_MIN_VISIBLE_ROWS = 8
const VIRTUAL_TABLE_MAX_VISIBLE_ROWS = 80
const VIRTUAL_TABLE_DEFAULT_ROW_HEIGHT = 44

function resolvePreviewContainerField(column: any) {
  const body = column?.body ?? column?.pristine?.body ?? []
  for (const node of body) {
    const text =
      (typeof node?.label === 'string' && node.label) ||
      (typeof node?.tpl === 'string' && node.tpl) ||
      ''
    const match = text.match(
      /\$\{\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\}/
    )
    if (match) {
      return match[1]
    }
  }

  return null
}

// 大跨度跳转时先同步挂一层纯文本预览行（约 10ms），避免目标位置只有 spacer 的空白；
// 随后再替换为完整 AMIS 单元格（按钮/tag/弹窗），交互能力不丢。
function resolvePreviewMappingObject(column: any, rowData: any) {
  const type = column?.type ?? column?.pristine?.type
  if (type !== 'mapping') {
    return null
  }

  const map = column?.map ?? column?.pristine?.map ?? {}
  const name = column?.name ?? column?.pristine?.name
  const value = name ? rowData?.[name] : undefined
  let mapped = map[value]
  if (mapped === undefined) {
    mapped =
      value === true ? map['1'] : value === false ? map['0'] : map['*']
  }

  if (!mapped || typeof mapped !== 'object') {
    return null
  }

  let label = String(mapped.label ?? '')
  const variableMatch = label.match(/^\$\{\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\}$/)
  if (variableMatch) {
    label = String(rowData?.[variableMatch[1]] ?? '')
  }

  return {
    label,
    color: String(mapped.color ?? 'inactive'),
  }
}

function resolvePreviewContainerValue(column: any, rowData: any) {
  const type = column?.type ?? column?.pristine?.type
  if (type !== 'container') {
    return undefined
  }

  const field = resolvePreviewContainerField(column)
  return field ? rowData?.[field] : undefined
}

function resolvePreviewCellText(column: any, rowData: any) {
  const columnType = column?.type ?? column?.pristine?.type
  if (String(columnType || '').startsWith('__')) {
    return ''
  }

  const name = column?.name ?? column?.pristine?.name
  const value = name ? rowData?.[name] : undefined
  const type = column?.type ?? column?.pristine?.type
  const content = resolveSimpleStaticTextCellContent(column, rowData)

  if (content && !content.muted) {
    return content.text
  }

  if (type === 'mapping') {
    const map = column?.map ?? column?.pristine?.map ?? {}
    let mapped = map[value]
    if (mapped === undefined) {
      mapped =
        value === true
          ? map['1']
          : value === false
            ? map['0']
            : map['*']
    }
    if (mapped && typeof mapped === 'object') {
      return String(mapped.label ?? '')
    }
    if (mapped !== undefined && mapped !== null) {
      return String(mapped)
    }
    return value === null || value === undefined || value === ''
      ? '-'
      : String(value)
  }

  if (type === 'container') {
    const field = resolvePreviewContainerField(column)
    const fieldValue = field ? rowData?.[field] : undefined
    return fieldValue === null ||
      fieldValue === undefined ||
      fieldValue === ''
      ? '-'
      : String(fieldValue)
  }

  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

function isLightweightAllRowsEnabled(
  rowCount: number,
  autoVirtualEligible: boolean
) {
  if (typeof window === 'undefined') {
    return false
  }

  const mode = new URLSearchParams(window.location.search).get(
    'tableRender'
  )
  if (mode === 'light') {
    return true
  }
  if (mode) {
    return false
  }

  // 100 行以内、且满足只读宽表条件的表格，全部行直接渲染：
  // 滚动完全交给浏览器，避免虚拟窗口在 20x 下挂行造成的闪白。
  return autoVirtualEligible && rowCount > 0 && rowCount <= 120
}


function LightweightAllRowsBody(props: any) {
  const dataRows = Array.isArray(props.rows) ? props.rows : []
  const dataColumns = Array.isArray(props.columns) ? props.columns : []
  const store = props.store
  const [expandedCell, setExpandedCell] = React.useState<{
    key: string
    rowIndex: number
    columnIndex: number
  } | null>(null)
  const cx =
    typeof props.classnames === 'function'
      ? props.classnames
      : (...tokens: any[]) => tokens.filter(Boolean).join(' ')

  React.useEffect(() => {
    if (!expandedCell) {
      return
    }

    const frame = requestAnimationFrame(() => {
      const row = document.querySelector(
        `.cxd-Table-table tbody tr[data-index="${expandedCell.rowIndex}"]`
      )
      const cell = row?.querySelectorAll('td')[expandedCell.columnIndex]
      cell?.querySelector<HTMLButtonElement>('button')?.click()
    })

    return () => cancelAnimationFrame(frame)
  }, [expandedCell])

  return (
    <tbody className={props.className}>
      {dataRows.map((row: any, rowIndex: number) => {
        const rowData = getSimpleStaticTextRowData(row)
        return (
          <tr
            key={`light-row-${row?.id ?? rowIndex}`}
            data-index={rowIndex}
            className={cx(
              'Table-table-tr',
              rowIndex % 2 ? 'Table-tr--even' : 'Table-tr--odd',
              row?.checked ? 'is-checked' : ''
            )}
          >
            {dataColumns.map((column: any, columnIndex: number) => {
              const cellKey = `light-cell-${row?.id ?? rowIndex}-${
                column?.id ?? column?.name ?? columnIndex
              }`
              const type = column?.type ?? column?.pristine?.type
              const [stickyStyle = {}, stickyClassName = ''] =
                typeof store?.getStickyStyles === 'function'
                  ? store.getStickyStyles(column, dataColumns)
                  : [{}, '']
              const classNames = resolveSimpleStaticTextCellClassNames(
                column,
                rowData,
                stickyClassName
              )
              const columnStyle = resolveSimpleStaticTextCellStyle(column)
              const cellStyle = {
                ...(columnStyle || {}),
                ...stickyStyle,
              }

              if (String(type || '').startsWith('__')) {
                if (typeof props.renderCell === 'function') {
                  return props.renderCell(
                    `light/${rowIndex}`,
                    column,
                    row,
                    { key: cellKey, rowPath: String(rowIndex), rowIndex },
                    false
                  )
                }
                return (
                  <td key={cellKey} className={cx(...classNames)} style={cellStyle}>
                    <label className="cxd-Checkbox cxd-Checkbox--checkbox--default">
                      <input type="checkbox" />
                      <i>
                        <div className="checkbox-icon icon" />
                      </i>
                      <span className="" />
                    </label>
                  </td>
                )
              }

              if (
                type === 'container' &&
                expandedCell?.key === cellKey &&
                typeof props.renderCell === 'function'
              ) {
                const cell = props.renderCell(
                  `light/${rowIndex}`,
                  column,
                  row,
                  { key: cellKey, rowPath: String(rowIndex), rowIndex },
                  false
                )
                return cell && React.isValidElement(cell)
                  ? React.cloneElement(cell as React.ReactElement, {
                      'data-light-cell': cellKey,
                    })
                  : cell
              }

              const mappingObject = resolvePreviewMappingObject(column, rowData)
              const containerValue = resolvePreviewContainerValue(column, rowData)
              let content: React.ReactNode = resolvePreviewCellText(
                column,
                rowData
              )

              if (mappingObject) {
                content = (
                  <span className="cxd-MappingField">
                    <span
                      className={`cxd-Tag cxd-Tag--normal cxd-Tag--normal--${mappingObject.color} cxd-Tag--normal--hasColor`}
                    >
                      <span className="cxd-Tag-text">
                        {mappingObject.label}
                      </span>
                    </span>
                  </span>
                )
              } else if (type === 'container') {
                content =
                  containerValue === null ||
                  containerValue === undefined ||
                  containerValue === '' ? (
                    <div className="cxd-Container" data-role="container">
                      <div className="cxd-Container-body">
                        <span className="cxd-TplField fr-view">
                          <span>-</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="cxd-Container" data-role="container">
                      <div className="cxd-Container-body">
                        <button
                          type="button"
                          className="cxd-Button cxd-Button--link cxd-Button--size-default"
                          onClick={() =>
                            setExpandedCell({
                              key: cellKey,
                              rowIndex,
                              columnIndex,
                            })
                          }
                        >
                          <span>{String(containerValue)}</span>
                        </button>
                      </div>
                    </div>
                  )
              }

              return (
                <td
                  key={cellKey}
                  className={cx(...classNames)}
                  style={cellStyle}
                >
                  {content}
                </td>
              )
            })}
          </tr>
        )
      })}
    </tbody>
  )
}

function CooperativeVirtualTableBody(props: any) {
  const { rows, store } = props
  const tBodyRef = React.useRef<HTMLTableSectionElement>(null)
  const [itemHeight, setItemHeight] = React.useState(
    VIRTUAL_TABLE_DEFAULT_ROW_HEIGHT
  )
  const [visibleRowCount, setVisibleRowCount] = React.useState(
    VIRTUAL_TABLE_MIN_VISIBLE_ROWS
  )
  const [scrollTop, setScrollTop] = React.useState(0)
  const [preview, setPreview] = React.useState(false)
  const previewRef = React.useRef(false)
  const previewTimerRef = React.useRef<number | null>(null)
  const seekingRef = React.useRef<number | null>(null)
  const previewClickRef = React.useRef<{
    rowIndex: number
    columnIndex: number
  } | null>(null)
  const virtualStateRef = React.useRef({
    start: 0,
    end: 0,
    itemHeight: VIRTUAL_TABLE_DEFAULT_ROW_HEIGHT,
    visibleRowCount: VIRTUAL_TABLE_MIN_VISIBLE_ROWS,
    scrollTop: 0,
  })
  const firstRowKey = rows[0]?.key

  React.useEffect(() => {
    // 数据刷新/筛选/翻页后回到首行，避免沿用上一批数据的滚动位置。
    setScrollTop(0)
    previewRef.current = false
    setPreview(false)
  }, [rows.length, firstRowKey])

  const offset = Math.max(0, Math.floor(scrollTop / itemHeight))
  const windowBlockStart =
    Math.floor(offset / VIRTUAL_TABLE_WINDOW_STEP) * VIRTUAL_TABLE_WINDOW_STEP
  const start = Math.max(0, windowBlockStart - VIRTUAL_TABLE_ROW_BUFFER)
  const end = Math.min(
    rows.length,
    start +
      visibleRowCount +
      VIRTUAL_TABLE_WINDOW_STEP +
      2 * VIRTUAL_TABLE_ROW_BUFFER
  )
  virtualStateRef.current = {
    start,
    end,
    itemHeight,
    visibleRowCount,
    scrollTop,
  }
  const visibleRows = React.useMemo(
    () => rows.slice(start, end),
    [rows, start, end]
  )

  const previewRows = React.useMemo(() => {
    if (!preview) {
      return null
    }


    const dataRows = Array.isArray(props.dataRows) ? props.dataRows : []
    const dataColumns = Array.isArray(props.columns) ? props.columns : []
    const cx =
      typeof props.classnames === 'function'
        ? props.classnames
        : (...tokens: any[]) => tokens.filter(Boolean).join(' ')

    const rendered = dataRows.slice(start, end).map((row: any, index: number) => {
      const rowData = getSimpleStaticTextRowData(row)
      const rowIndex = start + index

      return (
        <tr
          key={`preview-row-${row?.id ?? rowIndex}`}
          data-index={rowIndex}
          style={{ height: itemHeight }}
          className={cx(
            'Table-table-tr',
            rowIndex % 2 ? 'Table-tr--even' : 'Table-tr--odd'
          )}
        >
          {dataColumns.map((column: any, columnIndex: number) => {
            const cellKey = `preview-cell-${row?.id ?? rowIndex}-${
              column?.id ?? column?.name ?? columnIndex
            }`
            const type = column?.type ?? column?.pristine?.type

            if (
              String(type || '').startsWith('__') &&
              typeof props.renderCell === 'function'
            ) {
              // 勾选列用正式 cell，保证预览阶段复选框样式与可勾选。
              return props.renderCell(
                `preview/${rowIndex}`,
                column,
                row,
                { key: cellKey, rowPath: String(rowIndex), rowIndex },
                false
              )
            }

            const [stickyStyle = {}, stickyClassName = ''] =
              typeof store?.getStickyStyles === 'function'
                ? store.getStickyStyles(column, dataColumns)
                : [{}, '']
            const classNames = resolveSimpleStaticTextCellClassNames(
              column,
              rowData,
              stickyClassName
            )
            const columnStyle = resolveSimpleStaticTextCellStyle(column)
            const cellStyle = {
              height: itemHeight,
              ...(columnStyle || {}),
              ...stickyStyle,
            }
            const mappingObject = resolvePreviewMappingObject(column, rowData)
            const containerValue = resolvePreviewContainerValue(column, rowData)

            let content: React.ReactNode = resolvePreviewCellText(
              column,
              rowData
            )

            if (mappingObject) {
              content = (
                <span className="cxd-MappingField">
                  <span
                    className={`cxd-Tag cxd-Tag--normal cxd-Tag--normal--${mappingObject.color} cxd-Tag--normal--hasColor`}
                  >
                    <span className="cxd-Tag-text">
                      {mappingObject.label}
                    </span>
                  </span>
                </span>
              )
            } else if (type === 'container') {
              content =
                containerValue === null ||
                containerValue === undefined ||
                containerValue === '' ? (
                  <div className="cxd-Container" data-role="container">
                    <div className="cxd-Container-body">
                      <span className="cxd-TplField fr-view">
                        <span>-</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="cxd-Container" data-role="container">
                    <div className="cxd-Container-body">
                      <button
                        type="button"
                        className="cxd-Button cxd-Button--link cxd-Button--size-default"
                        onClick={() => {
                          previewClickRef.current = {
                            rowIndex,
                            columnIndex,
                          }
                          setPreview(false)
                        }}
                      >
                        <span>{String(containerValue)}</span>
                      </button>
                    </div>
                  </div>
                )
            }

            return (
              <td
                key={cellKey}
                className={cx(...classNames)}
                style={cellStyle}
              >
                {content}
              </td>
            )
          })}
        </tr>
      )
    })
    return rendered
  }, [preview, start, end, props.dataRows, props.columns, props.classnames, store])

  React.useEffect(() => {
    if (preview || !previewClickRef.current) {
      return
    }

    const pending = previewClickRef.current
    previewClickRef.current = null
    requestAnimationFrame(() => {
      const table = tBodyRef.current?.parentElement
      const row = table?.querySelector(
        `tbody tr[data-index="${pending.rowIndex}"]`
      )
      const button = row
        ?.querySelectorAll('td')
        ?.[pending.columnIndex]?.querySelector('button')
      button?.click()
    })
  }, [preview])

  React.useLayoutEffect(() => {
    if (seekingRef.current !== null) {
      return
    }

    const wrap = tBodyRef.current?.closest(
      '.cxd-Table-content'
    ) as HTMLElement | null
    if (!wrap) {
      return
    }

    // 浏览器 scroll anchoring/布局变化可能把实际 scrollTop 拨到与 React state
    // 不一致的位置；此时 start 会用旧值算出一个巨大的 leading spacer，
    // 表现就是“上半屏空白、行被推到下半屏”。在 layout 阶段立即对齐，
    // 避免把错误窗口画到屏幕上。
    if (Math.abs(wrap.scrollTop - scrollTop) > 1) {
      setScrollTop(wrap.scrollTop)
    }
  }, [scrollTop, start, end])

  React.useEffect(() => {
    const tbody = tBodyRef.current
    const table = tbody?.parentElement
    const wrap = table?.parentElement as HTMLElement | null
    if (!tbody || !table || !wrap) {
      return
    }

    // 行窗口只挂载部分行；auto 布局会根据当前挂载行重新分配列宽，
    // 长内容行进出窗口时整表列宽会变化，用户看到的就是“表格在跳”。
    // 这里先让浏览器按首屏内容做一次 auto 布局，测出与线上旧版一致的列宽，
    // 再把列宽写死并切换 fixed，既不改列宽，又不会随窗口内容变化。
    const previousTableLayout = table.style.tableLayout
    const previousTableWidth = table.style.width
    const originalColStyles: Array<{
      col: HTMLTableColElement
      width: string
      minWidth: string
    }> = []

    const freezeAutoLayoutWidths = () => {
      if (table.style.tableLayout === 'fixed') {
        return
      }

      const autoTableWidth = table.getBoundingClientRect().width
      const colElements = Array.from(
        table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col')
      )
      const headerCells = Array.from(
        table.querySelectorAll<HTMLElement>(':scope > thead > tr > th')
      )

      if (
        !colElements.length ||
        headerCells.length < colElements.length ||
        !headerCells.some((cell) => cell.getBoundingClientRect().width > 0)
      ) {
        return
      }

      let measuredWidthCount = 0
      headerCells.slice(0, colElements.length).forEach((cell, index) => {
        const width = cell.getBoundingClientRect().width
        if (!(width > 0)) {
          return
        }

        const col = colElements[index]
        originalColStyles.push({
          col,
          width: col.style.width,
          minWidth: col.style.minWidth,
        })
        col.style.width = `${width}px`
        col.style.minWidth = `${width}px`
        measuredWidthCount += 1
      })

      if (!measuredWidthCount) {
        return
      }

      // 表宽取 auto 布局测得的宽度（与旧版/9200 基本一致），
      // 列宽取各列表头实测值；这样固定布局后列位置和总宽都不变。
      if (autoTableWidth > 0) {
        table.style.width = `${Math.ceil(autoTableWidth)}px`
      }
      table.style.tableLayout = 'fixed'
    }

    freezeAutoLayoutWidths()

    const isInnerScroll = wrap.scrollHeight > wrap.clientHeight + 8
    const toDispose: Array<() => void> = []
    let timer: number | null = null
    let viewportHeight = isInnerScroll ? wrap.clientHeight : window.innerHeight
    let headerHeight =
      (table.querySelector(':scope > thead') as HTMLElement | null)
        ?.getBoundingClientRect().height || 0

    const measureSize = () => {
      // 预览行是纯文本、比正式行矮；预览期间不能拿它更新行高，
      // 否则 spacer/scrollHeight 会跟着变，滚动位置会被浏览器拉走。
      if (previewRef.current) {
        return
      }

      const firstDataRow = tbody.querySelector(':scope > tr')
      let nextItemHeight = itemHeight
      if (firstDataRow) {
        const height = firstDataRow.getBoundingClientRect().height
        if (height > 0) {
          nextItemHeight = height
        }
      }

      headerHeight =
        (table.querySelector(':scope > thead') as HTMLElement | null)
          ?.getBoundingClientRect().height || headerHeight
      viewportHeight = isInnerScroll ? wrap.clientHeight : window.innerHeight
      const nextVisibleRowCount = Math.max(
        VIRTUAL_TABLE_MIN_VISIBLE_ROWS,
        Math.min(
          VIRTUAL_TABLE_MAX_VISIBLE_ROWS,
          Math.ceil(viewportHeight / nextItemHeight) + 1
        )
      )

      setItemHeight((prev) =>
        Math.abs(prev - nextItemHeight) < 0.5 ? prev : nextItemHeight
      )
      setVisibleRowCount((prev) =>
        prev === nextVisibleRowCount ? prev : nextVisibleRowCount
      )
    }

    const check = () => {
      // 滚动路径只更新窗口起点，不做任何 DOM 测量；测量放在 mount/resize，
      // 避免每个滚动帧 getBoundingClientRect/getComputedStyle 强制同步布局。
      const nextScrollTop = isInnerScroll
        ? wrap.scrollTop
        : Math.max(0, -table.getBoundingClientRect().top)
      setScrollTop(nextScrollTop)
    }

    const handleScroll = () => {
      const nextScrollTop = isInnerScroll
        ? wrap.scrollTop
        : Math.max(0, -table.getBoundingClientRect().top)
      const current = virtualStateRef.current

      // 只有“大跨度 seek”（超过约 2 个视口）才走同步预览；
      // 普通滚轮/触控板小步滚动仍走 rAF，避免每帧同步渲染造成不丝滑。
      // 大跨度时 rAF 会晚一帧，目标位置只有 spacer，需要预览先兜底。
      const seekThreshold = Math.max(800, viewportHeight * 2)
      const isLargeSeek =
        Math.abs(nextScrollTop - current.scrollTop) > seekThreshold

      if (isLargeSeek) {
        previewRef.current = true
        ReactDOM.flushSync(() => {
          setScrollTop(nextScrollTop)
          setPreview(true)
        })
        if (previewTimerRef.current !== null) {
          window.clearTimeout(previewTimerRef.current)
        }
        previewTimerRef.current = window.setTimeout(() => {
          previewTimerRef.current = null
          previewRef.current = false
          setPreview(false)
        }, 1500)
        return
      }

      if (timer !== null) {
        cancelAnimationFrame(timer)
      }
      timer = requestAnimationFrame(check)
    }

    const isTargetOutsideRenderedWindow = (target: number, slackRows = 0) => {
      const state = virtualStateRef.current
      const slack = state.itemHeight * slackRows
      const renderedTop = headerHeight + state.start * state.itemHeight
      const renderedBottom = headerHeight + state.end * state.itemHeight
      return (
        target < renderedTop - 1 - slack ||
        target + viewportHeight > renderedBottom + 1 + slack
      )
    }

    const seekToTarget = (target: number) => {
      previewRef.current = true
      if (previewTimerRef.current !== null) {
        window.clearTimeout(previewTimerRef.current)
      }
      // 先移动 scrollTop，再 flushSync 预览；同一任务内不会中间绘制。
      // 反过来会在 flushSync 的 layout effect 里读到旧 scrollTop，把 state 拨回旧值，
      // 产生 3000 -> 0 -> 3000 的窗口抖动（空白帧就是这样来的）。
      // 先提交目标位置预览，再移动 scrollTop：20x 降速下预览提交可能要 1s，
      // 如果先移动滚动条，浏览器会先画出目标位置的空 spacer，用户看到闪白。
      // layout effect 在 seekingRef 期间跳过，避免它读到旧 scrollTop 把 state 拨回。
      seekingRef.current = target
      ReactDOM.flushSync(() => {
        setScrollTop(target)
        setPreview(true)
      })
      wrap.scrollTop = target
      seekingRef.current = null
      previewTimerRef.current = window.setTimeout(() => {
        previewTimerRef.current = null
        previewRef.current = false
        setPreview(false)
      }, 1500)
    }

    const handleWheel = (event: WheelEvent) => {
      if (!isInnerScroll || !event.deltaY) {
        return
      }

      const maxScrollTop = Math.max(
        0,
        wrap.scrollHeight - wrap.clientHeight
      )
      const target = Math.max(
        0,
        Math.min(maxScrollTop, wrap.scrollTop + event.deltaY)
      )


      if (!isTargetOutsideRenderedWindow(target, 4)) {
        return
      }

      // 浏览器的默认 wheel 滚动会在 scroll 事件/React 提交之前先绘制目标位置；
      // 目标行还没挂载时这一帧必然是空白。这里拦截默认滚动，先把目标位置的
      // 轻量预览 flushSync 提交，再设置 scrollTop，保证浏览器第一次绘制就有数据。
      event.preventDefault()
      seekToTarget(target)
    }

    wrap.addEventListener('wheel', handleWheel, { passive: false })
    toDispose.push(() => wrap.removeEventListener('wheel', handleWheel))

    if (isInnerScroll) {
      wrap.addEventListener('scroll', handleScroll)
      toDispose.push(() => wrap.removeEventListener('scroll', handleScroll))
    } else {
      window.addEventListener('scroll', handleScroll, { passive: true })
      toDispose.push(() => window.removeEventListener('scroll', handleScroll))
    }

    toDispose.push(
      resizeSensor(wrap, () => {
        measureSize()
        check()
      })
    )

    measureSize()
    check()

    return () => {
      if (timer !== null) {
        cancelAnimationFrame(timer)
      }
      if (previewTimerRef.current !== null) {
        window.clearTimeout(previewTimerRef.current)
        previewTimerRef.current = null
      }
      table.style.tableLayout = previousTableLayout
      table.style.width = previousTableWidth
      originalColStyles.forEach(({ col, width, minWidth }) => {
        col.style.width = width
        col.style.minWidth = minWidth
      })
      toDispose.forEach((fn) => fn())
      toDispose.length = 0
    }
  }, [store])

  const styles = {
    '--Table-scroll-height': `${itemHeight * rows.length}px`,
    '--Table-scroll-offset': `${start * itemHeight}px`,
    '--Table-frame-height': `${itemHeight * visibleRows.length}px`,
  } as React.CSSProperties

  return (
    <>
      <tbody
        style={styles}
        className="virtual-table-body-placeholder leading"
      >
        <tr>
          <td colSpan={store.filteredColumns?.length || props.columns?.length || 1}>
            <div />
          </td>
        </tr>
      </tbody>
      <tbody className={props.className} ref={tBodyRef}>
        {previewRows ?? visibleRows}
      </tbody>
      <tbody
        style={styles}
        className="virtual-table-body-placeholder trailing"
      >
        <tr>
          <td colSpan={store.filteredColumns?.length || props.columns?.length || 1}>
            <div />
          </td>
        </tr>
      </tbody>
    </>
  )
}

function replaceTableBody(
  node: React.ReactNode,
  renderRichCell?: (...args: any[]) => React.ReactNode
): React.ReactNode {
  if (Array.isArray(node)) {
    return node.map((child) => replaceTableBody(child, renderRichCell))
  }
  if (!React.isValidElement(node)) {
    return node
  }
  if (node.type === AmisTableBody) {
    return (
      <CooperativeTableBody
        {...(node.props as any)}
        renderRichCell={renderRichCell}
        key={node.key ?? undefined}
      />
    )
  }
  if (!(node.props as any)?.children) {
    return node
  }
  return React.cloneElement(
    node,
    undefined,
    React.Children.map((node.props as any).children, (child) =>
      replaceTableBody(child, renderRichCell)
    )
  )
}

class CooperativeTableContentBase extends AmisTableContentBase {
  render() {
    return replaceTableBody(
      super.render(),
      (this.props as any).renderRichCell
    )
  }
}

export const CooperativeTableContent = observer((props: any) => {
  const { store } = props
  const isMaterializationHydrating =
    store.materializationPending || store.viewportHydrationPending
  const materializedRows = getRowCollection(store.rows)
  const sourceRows = isMaterializationHydrating
    ? materializedRows
    : materializedRows.length
      ? materializedRows
      : getRowCollection(props.rows)
  // CooperativeTableContentBase 继承 amis TableContent（React.PureComponent）。
  // store.rows 是 MST 可变数组，删除/新增行时是原地 replace，引用不变；
  // 若把同一个引用透传下去，PureComponent 的浅比较会 bail out，
  // <tbody> 不会随行数据更新（表现为 input-table 删除第一行“无响应”，
  // 再点第二行才一起消失）。这里每次 observer 重渲染都给出新快照数组。
  const rows = sourceRows.slice()
  const className = props.classnames(props.className, {
    'use-virtual-list': shouldUseCooperativePlaceholderClass(store),
  })

  return (
    <CooperativeTableContentBase
      {...props}
      rows={rows}
      className={className}
      store={store}
      columnsKey={
        store.columnsKey ??
        store.columns
          ?.map((column: any) => column?.id || column?.name || column?.type)
          .join('|')
      }
      orderBy={store.orderBy}
      orderDir={store.orderDir}
      materializationPending={store.materializationPending}
    />
  )
})

function defaultCx(...tokens: any[]) {
  return tokens
    .flatMap((token) => {
      if (!token) {
        return []
      }
      if (typeof token === 'string') {
        return [token]
      }
      if (Array.isArray(token)) {
        return token.filter(Boolean)
      }
      if (typeof token === 'object') {
        return Object.keys(token).filter((key) => token[key])
      }
      return []
    })
    .join(' ')
}

function isSpinnerVisibleByConfig(loadingConfig: any) {
  return loadingConfig?.show === true || typeof loadingConfig?.show === 'undefined'
}

function renderControlledTableSpinner(options: {
  classnames?: (...tokens: any[]) => string
  loadingConfig?: any
}) {
  const { loadingConfig } = options
  const cx = options.classnames || defaultCx
  const body = (
    <>
      <div className={cx('Spinner-overlay', 'in')} />
      <div
        data-testid="spinner"
        className={cx('Spinner', 'Spinner--overlay', 'in')}
      >
        <div className={cx('Spinner-icon', 'Spinner-icon--default')} />
      </div>
    </>
  )
  const root = loadingConfig?.root
  const dom =
    typeof root === 'string' && typeof document !== 'undefined'
      ? document.querySelector(root)
      : null

  return dom ? ReactDOM.createPortal(body, dom) : body
}

export const CooperativeTableSpinner = observer(
  ({
    classnames,
    loadingConfig,
    store,
  }: {
    classnames?: (...tokens: any[]) => string
    loadingConfig?: any
    store: any
  }) => {
    const show =
      store.loading ||
      (store.cooperativeLoadingVisible ?? store.cooperativeRenderingPending)

    return show && isSpinnerVisibleByConfig(loadingConfig)
      ? renderControlledTableSpinner({ classnames, loadingConfig })
      : null
  }
)
