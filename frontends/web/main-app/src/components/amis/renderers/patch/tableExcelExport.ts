import { createObject, getVariable, isVisible } from 'amis-core'
import type { ExportExcelToolbar } from 'amis/lib/renderers/Table/index'
import moment from 'moment'

export type EnhancedExportExcelToolbar = ExportExcelToolbar & {
  exportSelected?: boolean
}

export type GroupedExportExcelToolbar = EnhancedExportExcelToolbar & {
  buttons?: EnhancedExportExcelToolbar[]
}

type ExportRowContext = {
  data?: Record<string, any>
  fetcher?: (api: any, data: any) => Promise<any>
  getCurrentRows: () => any[]
  getSelected: () => any[]
  query?: Record<string, any>
}

type ExportVisibilityContext = {
  data?: Record<string, any>
  hasAuth?: (key: string) => boolean
  page?: number
  perPage?: number
  query?: Record<string, any>
  total?: number
}

const BUILT_IN_USER_NAME: Record<string, string> = {
  admin: '管理员',
  anonymousUser: '系统',
}

const EXPORT_USER_FIELD_NAMES = new Set(['createdBy', 'updatedBy'])

export const EXPORT_EXCEL_BUTTON_ICON = 'filetype-xlsx'
export const EXPORT_EXCEL_BUTTON_LABEL = '导出'

function resolvePositiveInteger(value: any): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function resolveColumnPrecision(column: Record<string, any>) {
  return resolvePositiveInteger(column.pristine?.precision ?? column.precision)
}

function buildDecimalNumberFormat(precision: number) {
  return `0.${'0'.repeat(precision)}`
}

function resolveNumericColumnFormats(columns: Array<Record<string, any>>) {
  const formats = new Map<number, string>()

  columns.forEach((column, index) => {
    const precision = resolveColumnPrecision(column)
    if (precision) {
      formats.set(index + 1, buildDecimalNumberFormat(precision))
    }
  })

  return formats
}

function clearCellNumberFormat(cell: any) {
  cell.numFmt = undefined
  if (cell.style) {
    delete cell.style.numFmt
  }
}

function applyNumericColumnFormats(workbook: any, formats: Map<number, string>) {
  const worksheets = Array.isArray(workbook?.worksheets) ? workbook.worksheets : []

  worksheets.forEach((worksheet: any) => {
    worksheet.eachRow?.({ includeEmpty: false }, (row: any, rowNumber: number) => {
      if (rowNumber === 1) {
        return
      }

      row.eachCell?.({ includeEmpty: false }, (cell: any) => {
        if (cell?.numFmt === '0') {
          clearCellNumberFormat(cell)
        }
      })

      formats.forEach((format, columnIndex) => {
        const cell = row.getCell(columnIndex)
        if (typeof cell?.value === 'number') {
          cell.numFmt = format
        }
      })
    })
  })
}

export function decorateExcelJSForNumericColumnFormats(
  ExcelJS: any,
  columns: Array<Record<string, any>>
) {
  const formats = resolveNumericColumnFormats(columns)
  const Workbook = ExcelJS?.Workbook

  if (typeof Workbook !== 'function') {
    return ExcelJS
  }

  class WorkbookWithNumericColumnFormats extends Workbook {
    constructor(...args: any[]) {
      super(...args)

      const originalWriteBuffer = this.xlsx?.writeBuffer?.bind(this.xlsx)
      if (originalWriteBuffer) {
        this.xlsx.writeBuffer = async (...writeArgs: any[]) => {
          applyNumericColumnFormats(this, formats)
          return originalWriteBuffer(...writeArgs)
        }
      }
    }
  }

  return {
    ...ExcelJS,
    Workbook: WorkbookWithNumericColumnFormats,
  }
}

function toDisplayArray(value: any): any[] {
  if (value === null || value === undefined || value === '') {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => toDisplayArray(item))
  }

  if (typeof value === 'string' && value.includes(',')) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return [value]
}

function extractRowsFromFetcherResult(result: any): any[] {
  const data = result?.data
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.rows)) {
    return data.rows
  }

  if (Array.isArray(data?.items)) {
    return data.items
  }

  if (data && typeof data === 'object') {
    const firstArrayKey = Object.keys(data).find((key) => Array.isArray(data[key]))
    if (firstArrayKey) {
      return data[firstArrayKey]
    }
  }

  return []
}

function toExportColumn(column: any) {
  const pristine =
    column?.pristine && typeof column.pristine === 'object' ? column.pristine : column

  return {
    ...pristine,
    ...column,
    pristine,
  }
}

function formatDateTimeValue(value: any, column: Record<string, any>) {
  const fromNow = column.pristine?.fromNow ?? column.fromNow
  const format =
    column.pristine?.format ||
    column.format ||
    column.pristine?.displayFormat ||
    column.displayFormat ||
    'YYYY-MM-DD HH:mm:ss'

  if (fromNow) {
    return moment(value).fromNow()
  }

  const isoDate = moment(value, moment.ISO_8601, true)
  if (isoDate.isValid()) {
    return isoDate.format(format)
  }

  const normalDate = moment(value)
  return normalDate.isValid() ? normalDate.format(format) : value
}

function resolveExportCellValue(
  column: Record<string, any>,
  rowData: Record<string, any>
) {
  const name = column.name
  if (!name) {
    return undefined
  }

  const rawValue = getVariable(rowData, name)
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return undefined
  }

  if (EXPORT_USER_FIELD_NAMES.has(name) && typeof rawValue === 'string') {
    return BUILT_IN_USER_NAME[rawValue] || rawValue
  }

  if (column.type === 'datetime' || column.type === 'static-datetime') {
    return formatDateTimeValue(rawValue, column)
  }

  if (column.type === 'organization-picker') {
    return toDisplayArray(rawValue)
      .map((item) => item?.name || item?.label || item)
      .filter(Boolean)
      .join(',')
  }

  if (column.type === 'employee-picker') {
    return toDisplayArray(rawValue)
      .map((item) => {
        if (item?.name) {
          return item.name
        }

        const id = item?.id || item
        return BUILT_IN_USER_NAME[id] || id
      })
      .filter(Boolean)
      .join(',')
  }

  if (column.type === 'data-dict-picker') {
    return toDisplayArray(rawValue)
      .map((item) => item?.label || item)
      .filter(Boolean)
      .join(',')
  }

  if (Array.isArray(column.pristine?.options)) {
    const { labelField = 'label', valueField = 'value' } = column.pristine
    return toDisplayArray(rawValue)
      .map((item) => {
        const rawOptionValue =
          item && typeof item === 'object' ? (item[valueField] ?? item.value) : item
        const matchedOption = column.pristine.options.find(
          (option: any) => option?.[valueField] === rawOptionValue
        )

        if (matchedOption?.[labelField]) {
          return matchedOption[labelField]
        }

        if (item && typeof item === 'object' && item[labelField]) {
          return item[labelField]
        }

        return rawOptionValue
      })
      .filter(Boolean)
      .join(',')
  }

  return undefined
}

async function fetchFilteredRows(
  toolbar: EnhancedExportExcelToolbar,
  context: ExportRowContext
): Promise<any[]> {
  const sourceApi = toolbar.api
  if (!sourceApi || !context.fetcher) {
    return []
  }

  const pageField = toolbar.pageField || 'page'
  const perPageField = toolbar.perPageField || 'perPage'
  const params = {
    ...(context.query || {}),
  }

  delete params.page
  delete params.perPage
  delete params[pageField]
  delete params[perPageField]

  const result = await context.fetcher(
    sourceApi,
    createObject(context.data || {}, params)
  )
  return extractRowsFromFetcherResult(result)
}

export function resolveGroupedExportToolbars(
  toolbar: EnhancedExportExcelToolbar
): EnhancedExportExcelToolbar[] {
  const groupedToolbars = (toolbar as GroupedExportExcelToolbar).buttons

  if (!Array.isArray(groupedToolbars)) {
    return []
  }

  return groupedToolbars.filter(
    (item): item is EnhancedExportExcelToolbar =>
      !!item &&
      !Array.isArray(item) &&
      typeof item === 'object' &&
      item.type === 'export-excel'
  )
}

export function resolveVisibleGroupedExportToolbars(
  toolbars: EnhancedExportExcelToolbar[],
  context: ExportVisibilityContext
) {
  const hasAuth = context.hasAuth ?? (() => true)
  const data = createObject(context.data || {}, {
    ...(context.query || {}),
    page: context.page,
    perPage: context.perPage,
    total: context.total,
    query: context.query,
  })

  return toolbars.filter((toolbar) => {
    const authKey = (toolbar as Record<string, any>).hasAuth

    if (authKey && !hasAuth(authKey)) {
      return false
    }

    return isVisible(toolbar as any, data)
  })
}

export function buildGroupedExportButtons(
  toolbars: EnhancedExportExcelToolbar[],
  onExport: (toolbar: EnhancedExportExcelToolbar) => void
) {
  return toolbars.map((toolbar) => ({
    ...(toolbar as Record<string, any>),
    type: 'button',
    onClick: () => onExport(toolbar),
  }))
}

export function resolveExportColumns(
  toolbar: EnhancedExportExcelToolbar,
  fallbackColumns: any[]
) {
  const sourceColumns = Array.isArray(toolbar.exportColumns)
    ? toolbar.exportColumns
    : fallbackColumns

  return sourceColumns.map((column: any) => toExportColumn(column))
}

export async function resolveExportRows(
  toolbar: EnhancedExportExcelToolbar,
  context: ExportRowContext
): Promise<any[]> {
  const selectedRows = toolbar.exportSelected ? context.getSelected() : []
  if (selectedRows.length) {
    return selectedRows
  }

  const fetchedRows = await fetchFilteredRows(toolbar, context)
  return fetchedRows.length ? fetchedRows : context.getCurrentRows()
}

export function patchExportRowData(
  rowData: Record<string, any>,
  columns: Array<Record<string, any>>
) {
  const overrides = columns.reduce<Record<string, any>>((acc, column) => {
    if (!column.name) {
      return acc
    }

    const nextValue = resolveExportCellValue(column, rowData)
    if (typeof nextValue !== 'undefined') {
      acc[column.name] = nextValue
    }
    return acc
  }, {})

  return {
    ...rowData,
    ...overrides,
  }
}
