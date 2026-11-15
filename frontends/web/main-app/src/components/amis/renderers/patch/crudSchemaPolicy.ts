import { isPlainObject } from 'lodash'

import {
  normalizeCrudFilterBodyItems,
  normalizeSchemaArray,
} from './crudFilterGridLayout'

type FilterActionSchema = Record<string, any>
type ExportToolbarSchema = Record<string, any>

export type FilterInitFormProps = {
  store?: {
    data?: unknown
  }
}

const FILTER_ACTION_CONTROL_TYPES = [
  'action',
  'button',
  'button-group',
  'button-toolbar',
  'reset',
  'submit',
]

const FILTER_ACTION_CHILD_KEYS = [
  'body',
  'buttons',
  'columns',
  'controls',
  'fieldSet',
  'items',
  'tabs',
]

const EXPORT_CURRENT_PAGE_LABEL = '导出当前页'
const EXPORT_ALL_ROWS_LABEL = '导出全部'
const EXPORT_TOOLBAR_CONTAINER_KEYS = [
  'align',
  'btnClassName',
  'className',
  'hideCaret',
  'icon',
  'id',
  'level',
  'menuClassName',
  'rightIcon',
  'size',
  'tooltip',
  'tooltipPlacement',
  'trigger',
] as const

function tokenizeSchemaPath(path: unknown) {
  if (typeof path !== 'string') {
    return []
  }

  return path.split('/').filter(Boolean)
}

export function isPageBodyDirectCrudPath(path: unknown) {
  const segments = tokenizeSchemaPath(path)
  if (segments.length < 3) {
    return false
  }

  if (segments[0] !== 'page' || segments[1] !== 'body') {
    return false
  }

  if (segments[segments.length - 1] !== 'crud') {
    return false
  }

  return segments.slice(2, -1).every((segment) => /^\d+$/.test(segment))
}

function patchEllipsisColumn(column: Record<string, any>) {
  const nextColumn: Record<string, any> = {
    ...column,
  }

  if (Array.isArray(column.children)) {
    nextColumn.children = column.children.map((item: Record<string, any>) =>
      patchEllipsisColumn(item)
    )
  }

  if (Array.isArray(column.columns)) {
    nextColumn.columns = column.columns.map((item: Record<string, any>) =>
      patchEllipsisColumn(item)
    )
  }

  if (
    nextColumn.textOverflow !== 'ellipsis' ||
    nextColumn.popOver === false ||
    nextColumn.popOver
  ) {
    return nextColumn
  }

  const popOverBody = {
    ...nextColumn,
    label: false,
    static: nextColumn.static ?? true,
    type: nextColumn.type ?? 'static-text',
    textOverflow: undefined,
    popOver: undefined,
    width: undefined,
  }

  return {
    ...nextColumn,
    ...(nextColumn.name
      ? {
          popOverEnableOn: `\${${nextColumn.name}}`,
        }
      : {}),
    popOver: {
      trigger: 'hover',
      showIcon: false,
      popOverClassName: 'table-cell-popover',
      position:
        'center-bottom-center-top center-top-center-bottom left-bottom-left-top right-bottom-right-top left-top-left-bottom right-top-right-bottom',
      body: popOverBody,
    },
  }
}

export function patchCrudBodySchema(subSchema: any) {
  if (!isPlainObject(subSchema) || !Array.isArray(subSchema.columns)) {
    return subSchema
  }

  return {
    ...subSchema,
    columns: subSchema.columns.map((column: Record<string, any>) =>
      patchEllipsisColumn(column)
    ),
  }
}

export function applySelectableClickSelectionDefault(schema: any, selectable?: boolean) {
  if (
    !isPlainObject(schema) ||
    selectable !== true ||
    typeof schema.checkOnItemClick !== 'undefined'
  ) {
    return schema
  }

  return {
    ...schema,
    checkOnItemClick: true,
  }
}

function extractFilterActions(actions: any) {
  if (!Array.isArray(actions)) {
    return []
  }

  return actions.filter((action): action is FilterActionSchema => isPlainObject(action))
}

function hasFilterActionControl(schema: any): boolean {
  if (Array.isArray(schema)) {
    return schema.some((item) => hasFilterActionControl(item))
  }

  if (!isPlainObject(schema)) {
    return false
  }

  if (
    typeof schema.type === 'string' &&
    FILTER_ACTION_CONTROL_TYPES.includes(schema.type)
  ) {
    return true
  }

  return FILTER_ACTION_CHILD_KEYS.some((key) => hasFilterActionControl(schema[key]))
}

function buildDefaultFilterActions(__: (key: string) => string) {
  return [
    {
      type: 'submit',
      label: __('search'),
      level: 'primary',
    },
    {
      type: 'reset',
      label: __('reset'),
      actionType: 'clear-and-submit',
    },
  ]
}

function createFilterToolbar(buttons: FilterActionSchema[]) {
  if (!buttons.length) {
    return null
  }

  return {
    className: 'crud-filter-toolbar',
    type: 'button-toolbar',
    label: false,
    buttons,
  }
}

export function normalizeFilterSchema(filterSchema: any, __: (key: string) => string) {
  if (!isPlainObject(filterSchema)) {
    return filterSchema
  }

  const { actions } = filterSchema
  const rest = { ...filterSchema }
  delete rest.actions
  delete rest.body
  delete rest.controls
  const bodyItems = normalizeCrudFilterBodyItems(
    filterSchema,
    filterSchema.preserveFilterLayout === true
  )
  const filterActions = extractFilterActions(actions)
  const hasExplicitActions = filterActions.length > 0
  const explicitEmptyActions = Array.isArray(actions) && actions.length === 0
  const hasBodyActionControl = hasFilterActionControl(bodyItems)
  const shouldSuppressDefaultActions = filterSchema.wrapWithPanel === false
  const toolbarButtons = hasExplicitActions
    ? filterActions
    : explicitEmptyActions
      ? []
      : hasBodyActionControl
        ? []
        : shouldSuppressDefaultActions
          ? []
          : buildDefaultFilterActions(__)
  const toolbar = createFilterToolbar(toolbarButtons)

  return {
    ...rest,
    body: toolbar ? [...bodyItems, toolbar] : bodyItems,
    actions: [],
  }
}

export function hasFilterToolbarItem(schema: any): boolean {
  if (Array.isArray(schema)) {
    return schema.some((item) => hasFilterToolbarItem(item))
  }

  return isPlainObject(schema) && schema.type === 'button-toolbar'
}

function hasColumnsTogglerToolbar(schema: any): boolean {
  if (Array.isArray(schema)) {
    return schema.some((item) => hasColumnsTogglerToolbar(item))
  }

  if (typeof schema === 'string') {
    return schema === 'columns-toggler'
  }

  return isPlainObject(schema) && schema.type === 'columns-toggler'
}

function isExportExcelToolbar(toolbar: any): toolbar is ExportToolbarSchema {
  return isPlainObject(toolbar) && toolbar.type === 'export-excel'
}

function isCurrentPageExportToolbar(toolbar: any) {
  return (
    isExportExcelToolbar(toolbar) &&
    String(toolbar.label || '').trim() === EXPORT_CURRENT_PAGE_LABEL
  )
}

function isAllRowsExportToolbar(toolbar: any) {
  return (
    isExportExcelToolbar(toolbar) &&
    String(toolbar.label || '').trim() === EXPORT_ALL_ROWS_LABEL
  )
}

function pickExportToolbarContainerProps(...toolbars: ExportToolbarSchema[]) {
  return EXPORT_TOOLBAR_CONTAINER_KEYS.reduce<ExportToolbarSchema>((acc, key) => {
    const value = toolbars.find((toolbar) => typeof toolbar?.[key] !== 'undefined')?.[key]

    if (typeof value !== 'undefined') {
      acc[key] = value
    }

    return acc
  }, {})
}

function createGroupedExportToolbar(
  currentPageToolbar: ExportToolbarSchema,
  allRowsToolbar: ExportToolbarSchema
) {
  return {
    type: 'export-excel',
    ...pickExportToolbarContainerProps(currentPageToolbar, allRowsToolbar),
    buttons: [currentPageToolbar, allRowsToolbar],
  }
}

function normalizeGroupedExportToolbars(headerToolbar: any): any {
  if (!Array.isArray(headerToolbar)) {
    return headerToolbar
  }

  const normalized: any[] = []

  for (let index = 0; index < headerToolbar.length; index += 1) {
    const currentToolbar = headerToolbar[index]
    const nextToolbar = headerToolbar[index + 1]

    if (Array.isArray(currentToolbar)) {
      normalized.push(normalizeGroupedExportToolbars(currentToolbar))
      continue
    }

    if (
      isCurrentPageExportToolbar(currentToolbar) &&
      isAllRowsExportToolbar(nextToolbar)
    ) {
      normalized.push(createGroupedExportToolbar(currentToolbar, nextToolbar))
      index += 1
      continue
    }

    normalized.push(currentToolbar)
  }

  return normalized
}

function ensureColumnsTogglerToolbar(headerToolbar: any, mode?: string) {
  if (mode && mode !== 'table') {
    return headerToolbar
  }

  if (hasColumnsTogglerToolbar(headerToolbar)) {
    return headerToolbar
  }

  return [{ type: 'columns-toggler' }, ...normalizeSchemaArray(headerToolbar)]
}

export function normalizeCrudHeaderToolbar(headerToolbar: any, mode?: string) {
  const nextHeaderToolbar = ensureColumnsTogglerToolbar(headerToolbar, mode)

  if (mode && mode !== 'table') {
    return nextHeaderToolbar
  }

  return normalizeGroupedExportToolbars(nextHeaderToolbar)
}

export function resolveFilterInitValues(
  values: object,
  formProps?: FilterInitFormProps
): object {
  const finalizedValues = formProps?.store?.data
  return isPlainObject(finalizedValues) ? (finalizedValues as object) : values
}
