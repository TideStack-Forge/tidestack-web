import { filterDate, getVariable } from 'amis-core'
import type { IColumn } from 'amis-core'
import { filter } from 'amis-core/lib/utils/tpl'

type SimpleStaticTextColumn = Partial<IColumn> & {
  pristine?: Record<string, any>
}

type SimpleStaticTextCellOptions = {
  allowTplType?: boolean
}

type ResolveSimpleStaticTextCellTextOptions = {
  emptyText?: string | null
  stringify?: boolean
}

const SIMPLE_STATIC_TEXT_CELL_TYPES = new Set<unknown>([
  'text',
  'tpl',
  'plain',
  'static-text',
  'static',
  undefined,
  null,
])

const SIMPLE_DISPLAY_CELL_TYPES = new Set<unknown>([
  'static-number',
  'static-date',
  'static-datetime',
  'mapping',
])

const DATE_DISPLAY_CELL_TYPES = new Set<unknown>([
  'static-date',
  'static-datetime',
])

// 这些字段对日期列是正常显示配置，不应阻止直出。
const DATE_DISPLAY_ALLOWED_FIELDS = new Set([
  'format',
  'valueFormat',
  'utc',
  'placeholder',
])

// 数字列只有纯精度展示时可以直出；千分位、前后缀、单位等仍需原渲染器。
const NUMBER_DISPLAY_UNSUPPORTED_FIELDS = [
  'prefix',
  'suffix',
  'kilobitSeparator',
  'unitOptions',
  'showAsPercent',
  'displayMode',
]

const UNSUPPORTED_SIMPLE_STATIC_TEXT_CELL_FIELDS = [
  'quickEdit',
  'quickEditEnabledOn',
  'quickEditOnUpdate',
  'popOver',
  'popOverEnableOn',
  'textOverflow',
  'copyable',
  'remark',
  'onEvent',
  'innerClassName',
  'cellClassName',
  'cellClassNameExpr',
  'html',
  'text',
  'raw',
  'body',
  'children',
  'value',
  'options',
  'prefix',
  'suffix',
  'format',
  'displayFormat',
  'valueFormat',
  'align',
  'vAlign',
  'innerStyle',
  'backgroundScale',
  'trackExpression',
  'canAccessSuperData',
]

const SIMPLE_STATIC_TEXT_TPL_PATTERN =
  /^\$\{\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\}$/

function hasOwnConfig(source: any, key: string) {
  return !!source && Object.prototype.hasOwnProperty.call(source, key)
}

function hasMeaningfulConfig(source: any, key: string) {
  if (!hasOwnConfig(source, key)) {
    return false
  }

  const value = source[key]
  if (value === undefined || value === null || value === false || value === '') {
    return false
  }

  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0
  }

  return true
}

function getSimpleStaticTextCellConfig(column: SimpleStaticTextColumn, key: string) {
  const pristine = column?.pristine

  if (hasOwnConfig(pristine, key)) {
    return pristine?.[key]
  }

  return (column as any)?.[key]
}

function hasSimpleStaticTextCellConfig(column: SimpleStaticTextColumn, key: string) {
  return hasOwnConfig(column?.pristine, key) || hasOwnConfig(column, key)
}

function getSimpleStaticTextCellType(column: SimpleStaticTextColumn) {
  return column?.type ?? column?.pristine?.type
}

function canRenderSimpleStaticTextTpl(
  column: SimpleStaticTextColumn,
  columnType: unknown
) {
  const tpl = getSimpleStaticTextCellConfig(column, 'tpl')

  if (!hasMeaningfulConfig({ tpl }, 'tpl')) {
    return true
  }

  return (
    columnType !== 'tpl' &&
    typeof tpl === 'string' &&
    SIMPLE_STATIC_TEXT_TPL_PATTERN.test(tpl)
  )
}

function canRenderSimpleStaticTextClassNameExpr(column: SimpleStaticTextColumn) {
  const classNameExpr = getSimpleStaticTextCellConfig(column, 'classNameExpr')

  return (
    !hasMeaningfulConfig({ classNameExpr }, 'classNameExpr') ||
    typeof classNameExpr === 'string'
  )
}

export function isSimpleStaticTextCellCandidate(
  column: SimpleStaticTextColumn,
  options: SimpleStaticTextCellOptions = {}
) {
  const columnType = getSimpleStaticTextCellType(column)

  if (!SIMPLE_STATIC_TEXT_CELL_TYPES.has(columnType)) {
    return false
  }

  if (!options.allowTplType && columnType === 'tpl') {
    return false
  }

  return !!column?.name && !String(columnType || '').startsWith('__')
}

function canRenderSimpleMappingCell(column: SimpleStaticTextColumn) {
  const map = getSimpleStaticTextCellConfig(column, 'map')
  const source = getSimpleStaticTextCellConfig(column, 'source')

  if (source !== undefined && source !== null && source !== '') {
    return false
  }

  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    return false
  }

  return Object.values(map).every(
    (value) => value === null || value === undefined || typeof value !== 'object'
  )
}

function canRenderSimpleNumberCell(column: SimpleStaticTextColumn) {
  if (getSimpleStaticTextCellConfig(column, 'quickEdit')) {
    return false
  }

  return !NUMBER_DISPLAY_UNSUPPORTED_FIELDS.some((field) =>
    hasMeaningfulConfig(column, field)
  )
}

function hasUnsupportedSimpleDisplayField(
  column: SimpleStaticTextColumn,
  columnType: unknown
) {
  const pristine = column?.pristine || {}
  const isDateType = DATE_DISPLAY_CELL_TYPES.has(columnType)
  const isNumberType = columnType === 'static-number'
  const isMappingType = columnType === 'mapping'

  return UNSUPPORTED_SIMPLE_STATIC_TEXT_CELL_FIELDS.some((field) => {
    if (isDateType && DATE_DISPLAY_ALLOWED_FIELDS.has(field)) {
      return false
    }

    if (isNumberType && field === 'format') {
      return false
    }

    if (isMappingType && field === 'format') {
      return false
    }

    return hasMeaningfulConfig(column, field) || hasMeaningfulConfig(pristine, field)
  })
}

export function isSimpleDisplayCellCandidate(column: SimpleStaticTextColumn) {
  const columnType = getSimpleStaticTextCellType(column)

  if (!SIMPLE_DISPLAY_CELL_TYPES.has(columnType)) {
    return false
  }

  return !!column?.name
}

export function canRenderSimpleStaticTextCell(
  column: SimpleStaticTextColumn,
  options: SimpleStaticTextCellOptions = {}
) {
  const columnType = getSimpleStaticTextCellType(column)
  const isSimpleTextType = SIMPLE_STATIC_TEXT_CELL_TYPES.has(columnType)

  if (!isSimpleTextType && !isSimpleDisplayCellCandidate(column)) {
    return false
  }

  if (!column?.name || String(columnType || '').startsWith('__')) {
    return false
  }

  if (
    !isSimpleTextType &&
    !canRenderSimpleStaticTextClassNameExpr(column)
  ) {
    return false
  }

  if (
    isSimpleTextType &&
    (!canRenderSimpleStaticTextTpl(column, columnType) ||
      !canRenderSimpleStaticTextClassNameExpr(column))
  ) {
    return false
  }

  if (columnType === 'static-number' && !canRenderSimpleNumberCell(column)) {
    return false
  }

  if (columnType === 'mapping' && !canRenderSimpleMappingCell(column)) {
    return false
  }

  if (hasUnsupportedSimpleDisplayField(column, columnType)) {
    return false
  }

  return true
}

export function getSimpleStaticTextRowData(row: any) {
  return row?.locals || row?.data || row || {}
}

function resolveSimpleStaticTextPlaceholder(column: SimpleStaticTextColumn) {
  if (!hasSimpleStaticTextCellConfig(column, 'placeholder')) {
    return '-'
  }

  const placeholder = getSimpleStaticTextCellConfig(column, 'placeholder')

  return placeholder === null || placeholder === undefined ? '' : String(placeholder)
}

function isEmptyTextValue(value: any) {
  return value === null || value === undefined || value === ''
}

export function resolveSimpleStaticTextCellText(
  column: SimpleStaticTextColumn,
  rowData: any,
  options: ResolveSimpleStaticTextCellTextOptions = {}
) {
  const tpl = getSimpleStaticTextCellConfig(column, 'tpl')
  const hasTpl = typeof tpl === 'string' && tpl
  const value = hasTpl
    ? filter(tpl, rowData)
    : getVariable(rowData, column.name as string)

  if (isEmptyTextValue(value)) {
    if (hasOwnConfig(options, 'emptyText')) {
      return options.emptyText === undefined ? null : options.emptyText
    }

    if (!hasTpl) {
      return resolveSimpleStaticTextPlaceholder(column)
    }
  }

  return hasTpl && !options.stringify ? value : String(value)
}

export type SimpleStaticTextCellContent = {
  text: string
  muted: boolean
}

function resolveNumberDisplay(column: SimpleStaticTextColumn, value: any) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return null
  }

  const precision = getSimpleStaticTextCellConfig(column, 'precision')
  if (typeof precision === 'number' && Number.isInteger(precision) && precision >= 0) {
    return numberValue.toFixed(precision)
  }

  return String(value)
}

function resolveDateDisplay(column: SimpleStaticTextColumn, rowData: any, value: any) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const columnType = getSimpleStaticTextCellType(column)
  const format = getSimpleStaticTextCellConfig(column, 'format') ||
    (columnType === 'static-datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD')
  const valueFormat = getSimpleStaticTextCellConfig(column, 'valueFormat')
  const utc = Boolean(getSimpleStaticTextCellConfig(column, 'utc'))

  try {
    const date = filterDate(value, rowData, valueFormat || format, utc)
    return date && typeof date.format === 'function' ? date.format(format) : null
  } catch {
    return null
  }
}

function resolveMappingDisplay(column: SimpleStaticTextColumn, value: any) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const map = getSimpleStaticTextCellConfig(column, 'map') || {}
  const mapped =
    map[value] ??
    (value === true ? map['1'] : undefined) ??
    (value === false ? map['0'] : undefined) ??
    map['*']

  if (mapped !== undefined && mapped !== null) {
    return typeof mapped === 'object' ? null : String(mapped)
  }

  return String(value)
}

/**
 * 直接输出型单元格：数字/日期/简单映射列不经过 amis Form/Static 渲染器，
 * 由 td 直接给出与渲染器一致的文本，减少宽表首屏的组件与 DOM 开销。
 */
export function resolveSimpleStaticTextCellContent(
  column: SimpleStaticTextColumn,
  rowData: any
): SimpleStaticTextCellContent | null {
  const columnType = getSimpleStaticTextCellType(column)

  if (SIMPLE_STATIC_TEXT_CELL_TYPES.has(columnType)) {
    const text = resolveSimpleStaticTextCellText(column, rowData)
    const tpl = getSimpleStaticTextCellConfig(column, 'tpl')
    const muted =
      !(typeof tpl === 'string' && tpl) &&
      isEmptyTextValue(getVariable(rowData, column.name as string))
    return { text, muted }
  }

  const value = getVariable(rowData, column?.name as string)
  let text: string | null = null

  if (columnType === 'static-number') {
    text = resolveNumberDisplay(column, value)
  } else if (DATE_DISPLAY_CELL_TYPES.has(columnType)) {
    text = resolveDateDisplay(column, rowData, value)
  } else if (columnType === 'mapping') {
    text = resolveMappingDisplay(column, value)
  }

  if (text === null) {
    return {
      text: resolveSimpleStaticTextPlaceholder(column),
      muted: true,
    }
  }

  return { text, muted: false }
}

export function resolveSimpleStaticTextCellClassNames(
  column: SimpleStaticTextColumn,
  rowData: any,
  stickyClassName: string
) {
  const className = getSimpleStaticTextCellConfig(column, 'className')
  const classNameExpr = getSimpleStaticTextCellConfig(column, 'classNameExpr')
  const resolvedClassName =
    typeof classNameExpr === 'string' && classNameExpr
      ? filter(classNameExpr, rowData)
      : ''

  return [className, stickyClassName, resolvedClassName]
}

export function resolveSimpleStaticTextCellStyle(column: SimpleStaticTextColumn) {
  const style = getSimpleStaticTextCellConfig(column, 'style')

  return style && typeof style === 'object' && !Array.isArray(style)
    ? (style as Record<string, any>)
    : undefined
}
