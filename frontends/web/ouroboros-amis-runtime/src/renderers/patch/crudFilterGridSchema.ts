import { isPlainObject } from 'lodash'

import {
  normalizeBooleanConfigValue,
  normalizePositiveIntegerConfigValue,
  readSystemConfigValue,
} from './runtimeSystemConfig'

import {
  CRUD_FILTER_DESKTOP_WIDE_BREAKPOINT,
  CRUD_FILTER_FIELD_AFFORDANCE_COMPACT,
  CRUD_FILTER_FIELD_AFFORDANCE_PRESERVE,
  CRUD_FILTER_GRID_DIVIDER_CLASS,
  CRUD_FILTER_GRID_FIELD_CLASS,
  CRUD_FILTER_GRID_FIRST_COMPACT_CLASS,
  CRUD_FILTER_GRID_FULL_WIDTH_CLASS,
  CRUD_FILTER_GRID_INDEX_CLASS_PREFIX,
  CRUD_FILTER_GRID_ITEM_CLASS,
  CRUD_FILTER_GRID_SPAN_CLASS_PREFIX,
  CRUD_FILTER_GRID_TOOLBAR_CLASS,
  CRUD_FILTER_GRID_WIDE_CANDIDATE_CLASS,
  CRUD_FILTER_GRID_WIDE_HEAD_ITEM_CLASS,
  CRUD_FILTER_LABEL_STYLE_LABEL,
  CRUD_FILTER_LABEL_STYLE_PLACEHOLDER,
  CRUD_FILTER_MOBILE_BREAKPOINT,
  CRUD_FILTER_SINGLE_SPAN_TYPES,
  CRUD_FILTER_WIDE_CANDIDATE_TYPES,
  type CrudFilterFieldsPerRowConfig,
  type CrudFilterLabelStyle,
  type CrudFilterSchema,
  type CrudFilterSmartLayoutOptions,
} from './crudFilterLayoutConstants'

const CRUD_FILTER_SMART_LAYOUT_CONFIG_PREFIX = 'ui.crud.filter.smartLayout'
const CRUD_FILTER_SMART_LAYOUT_ENABLED_CONFIG_KEY = `${CRUD_FILTER_SMART_LAYOUT_CONFIG_PREFIX}.enabled`
const CRUD_FILTER_LABEL_STYLE_CONFIG_KEY = `${CRUD_FILTER_SMART_LAYOUT_CONFIG_PREFIX}.labelStyle`
const CRUD_FILTER_FIELDS_PER_ROW_CONFIG_KEY = `${CRUD_FILTER_SMART_LAYOUT_CONFIG_PREFIX}.fieldsPerRow`
const CRUD_FILTER_FIELDS_PER_ROW_DESKTOP_CONFIG_KEY = `${CRUD_FILTER_FIELDS_PER_ROW_CONFIG_KEY}.desktop`
const CRUD_FILTER_FIELDS_PER_ROW_NARROW_CONFIG_KEY = `${CRUD_FILTER_FIELDS_PER_ROW_CONFIG_KEY}.narrow`
const CRUD_FILTER_FIELDS_PER_ROW_MOBILE_CONFIG_KEY = `${CRUD_FILTER_FIELDS_PER_ROW_CONFIG_KEY}.mobile`
const CRUD_FILTER_FIELD_AFFORDANCE_CONFIG_KEY = `${CRUD_FILTER_SMART_LAYOUT_CONFIG_PREFIX}.fieldAffordance`
const DEFAULT_CRUD_FILTER_FIELDS_PER_ROW: CrudFilterFieldsPerRowConfig = {
  desktop: 5,
  narrow: 4,
  mobile: 1,
}
const DEFAULT_CRUD_FILTER_LABEL_STYLE = CRUD_FILTER_LABEL_STYLE_LABEL

export function normalizeSchemaArray(value: any) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

export function isCrudFilterSmartLayoutEnabled(filterSchema: any, systemConfig?: any) {
  return resolveCrudFilterSmartLayoutOptions(filterSchema, systemConfig).enabled
}

function normalizeCrudFilterLabelStyle(value: any): CrudFilterLabelStyle | undefined {
  if (
    value === CRUD_FILTER_LABEL_STYLE_PLACEHOLDER ||
    value === CRUD_FILTER_FIELD_AFFORDANCE_COMPACT
  ) {
    return CRUD_FILTER_LABEL_STYLE_PLACEHOLDER
  }

  if (
    value === CRUD_FILTER_LABEL_STYLE_LABEL ||
    value === CRUD_FILTER_FIELD_AFFORDANCE_PRESERVE
  ) {
    return CRUD_FILTER_LABEL_STYLE_LABEL
  }

  return undefined
}

function normalizeCrudFilterFieldAffordanceLabelStyle(
  value: any
): CrudFilterLabelStyle | undefined {
  if (value === CRUD_FILTER_FIELD_AFFORDANCE_COMPACT) {
    return CRUD_FILTER_LABEL_STYLE_PLACEHOLDER
  }

  if (value === CRUD_FILTER_FIELD_AFFORDANCE_PRESERVE) {
    return CRUD_FILTER_LABEL_STYLE_LABEL
  }

  return undefined
}

function normalizeCrudFilterFieldsPerRow(
  value: any,
  fallback: CrudFilterFieldsPerRowConfig = DEFAULT_CRUD_FILTER_FIELDS_PER_ROW
): CrudFilterFieldsPerRowConfig {
  const directValue = normalizePositiveIntegerConfigValue(value)

  if (directValue) {
    return {
      desktop: directValue,
      narrow: directValue,
      mobile: fallback.mobile,
    }
  }

  if (!isPlainObject(value)) {
    return fallback
  }

  return {
    desktop: normalizePositiveIntegerConfigValue(value.desktop) ?? fallback.desktop,
    narrow:
      normalizePositiveIntegerConfigValue(value.narrow) ??
      normalizePositiveIntegerConfigValue(value.tablet) ??
      fallback.narrow,
    mobile: normalizePositiveIntegerConfigValue(value.mobile) ?? fallback.mobile,
  }
}

function readCrudFilterSystemFieldsPerRow(systemConfig: any) {
  const groupedValue = readSystemConfigValue(
    systemConfig,
    CRUD_FILTER_FIELDS_PER_ROW_CONFIG_KEY
  )

  if (groupedValue !== undefined) {
    return groupedValue
  }

  const leafValues = {
    desktop: readSystemConfigValue(
      systemConfig,
      CRUD_FILTER_FIELDS_PER_ROW_DESKTOP_CONFIG_KEY
    ),
    narrow: readSystemConfigValue(
      systemConfig,
      CRUD_FILTER_FIELDS_PER_ROW_NARROW_CONFIG_KEY
    ),
    mobile: readSystemConfigValue(
      systemConfig,
      CRUD_FILTER_FIELDS_PER_ROW_MOBILE_CONFIG_KEY
    ),
  }

  return Object.values(leafValues).some((value) => value !== undefined)
    ? leafValues
    : undefined
}

export function resolveCrudFilterSmartLayoutOptions(
  filterSchema: any,
  systemConfig?: any
): CrudFilterSmartLayoutOptions {
  const smartLayoutConfig = isPlainObject(filterSchema?.smartLayout)
    ? filterSchema.smartLayout
    : undefined
  const systemEnabled = normalizeBooleanConfigValue(
    readSystemConfigValue(systemConfig, CRUD_FILTER_SMART_LAYOUT_ENABLED_CONFIG_KEY)
  )
  const schemaEnabled =
    smartLayoutConfig &&
    Object.prototype.hasOwnProperty.call(smartLayoutConfig, 'enabled')
      ? normalizeBooleanConfigValue(smartLayoutConfig.enabled)
      : filterSchema?.smartLayout === true
        ? true
        : filterSchema?.smartLayout === false
          ? false
          : smartLayoutConfig
            ? true
            : undefined
  const systemLabelStyle =
    normalizeCrudFilterLabelStyle(
      readSystemConfigValue(systemConfig, CRUD_FILTER_LABEL_STYLE_CONFIG_KEY)
    ) ??
    normalizeCrudFilterFieldAffordanceLabelStyle(
      readSystemConfigValue(systemConfig, CRUD_FILTER_FIELD_AFFORDANCE_CONFIG_KEY)
    )
  const schemaLabelStyle =
    normalizeCrudFilterLabelStyle(smartLayoutConfig?.labelStyle) ??
    normalizeCrudFilterFieldAffordanceLabelStyle(smartLayoutConfig?.fieldAffordance)
  const systemFieldsPerRow = normalizeCrudFilterFieldsPerRow(
    readCrudFilterSystemFieldsPerRow(systemConfig)
  )
  const schemaFieldsPerRow = normalizeCrudFilterFieldsPerRow(
    smartLayoutConfig?.fieldsPerRow,
    systemFieldsPerRow
  )

  return {
    enabled: schemaEnabled ?? systemEnabled ?? true,
    labelStyle: schemaLabelStyle ?? systemLabelStyle ?? DEFAULT_CRUD_FILTER_LABEL_STYLE,
    fieldsPerRow: schemaFieldsPerRow,
  }
}

export function normalizeCrudFilterBodyItems(
  filterSchema: CrudFilterSchema,
  preserveFilterLayout = false
) {
  const body = normalizeSchemaArray(filterSchema.body)

  if (body.length) {
    return body
  }

  if (!filterSchema.controls) {
    return []
  }

  if (!preserveFilterLayout) {
    return normalizeSchemaArray(filterSchema.controls)
  }

  return [
    {
      size: 'none',
      type: 'wrapper',
      wrap: false,
      controls: filterSchema.controls,
    },
  ]
}

export function appendSchemaClassName(
  schemaClassName: string | undefined,
  ...nextClassNames: Array<string | false | null | undefined>
) {
  const classNames: string[] = []
  const seenClassNames = new Set<string>()

  ;[schemaClassName, ...nextClassNames].forEach((className) => {
    if (typeof className !== 'string') {
      return
    }

    className.split(/\s+/).forEach((item) => {
      if (!item || seenClassNames.has(item)) {
        return
      }

      seenClassNames.add(item)
      classNames.push(item)
    })
  })

  return classNames.join(' ')
}

function isCrudFilterGridClassName(className: string) {
  return (
    className === CRUD_FILTER_GRID_ITEM_CLASS ||
    className === CRUD_FILTER_GRID_FIELD_CLASS ||
    className === CRUD_FILTER_GRID_FIRST_COMPACT_CLASS ||
    className === CRUD_FILTER_GRID_WIDE_CANDIDATE_CLASS ||
    className === CRUD_FILTER_GRID_WIDE_HEAD_ITEM_CLASS ||
    className === CRUD_FILTER_GRID_TOOLBAR_CLASS ||
    className === CRUD_FILTER_GRID_DIVIDER_CLASS ||
    className === CRUD_FILTER_GRID_FULL_WIDTH_CLASS ||
    className.startsWith(CRUD_FILTER_GRID_SPAN_CLASS_PREFIX) ||
    className.startsWith(CRUD_FILTER_GRID_INDEX_CLASS_PREFIX)
  )
}

export function stripCrudFilterGridClassName(className: any) {
  if (typeof className !== 'string') {
    return undefined
  }

  const classNames = className
    .split(/\s+/)
    .filter((item) => item && !isCrudFilterGridClassName(item))

  return classNames.length ? classNames.join(' ') : undefined
}

function parseCrudFilterColSpan(colSpan: any) {
  const numericValue =
    typeof colSpan === 'string' ? Number(colSpan.trim()) : Number(colSpan)

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null
  }

  return Math.max(1, Math.round(numericValue))
}

export function hasExplicitCrudFilterGridLayout(schema: any) {
  return Boolean(schema?.colSize || schema?.columnClassName)
}

export function isCrudFilterToolbarSchema(schema: any) {
  return isPlainObject(schema) && schema.type === 'button-toolbar'
}

export function isCrudFilterDividerSchema(schema: any) {
  return (
    isPlainObject(schema) &&
    (schema.type === 'divider' ||
      String(schema.columnClassName || '').includes(CRUD_FILTER_GRID_DIVIDER_CLASS))
  )
}

export function isCrudFilterWideCandidateSchema(schema: any) {
  const type = String(schema?.type || '')
    .trim()
    .toLowerCase()

  return Boolean(type) && CRUD_FILTER_WIDE_CANDIDATE_TYPES.includes(type)
}

export function hasCrudFilterWideCandidateClassName(className: string | undefined) {
  return (
    typeof className === 'string' &&
    className.includes(CRUD_FILTER_GRID_WIDE_CANDIDATE_CLASS)
  )
}

export function hasCrudFilterWideHeadClassName(className: string | undefined) {
  return (
    typeof className === 'string' &&
    className.includes(CRUD_FILTER_GRID_WIDE_HEAD_ITEM_CLASS)
  )
}

export function isCrudFilterAutoWideCandidateSchema(schema: any) {
  if (hasCrudFilterWideCandidateClassName(schema?.columnClassName)) {
    return true
  }

  if (parseCrudFilterColSpan(schema?.colSpan)) {
    return false
  }

  return (
    isCrudFilterWideCandidateSchema(schema) && !hasExplicitCrudFilterGridLayout(schema)
  )
}

export function resolveCrudFilterGridSpan(schema: any) {
  const colSpan = parseCrudFilterColSpan(schema?.colSpan)

  if (colSpan) {
    return colSpan
  }

  const type = String(schema?.type || '')
    .trim()
    .toLowerCase()

  if (!type) {
    return 1
  }

  if (CRUD_FILTER_SINGLE_SPAN_TYPES.includes(type)) {
    return 1
  }

  if (CRUD_FILTER_WIDE_CANDIDATE_TYPES.includes(type)) {
    return 2
  }

  return 1
}

function extractCrudFilterGridSpanFromClassName(className: string | undefined) {
  if (typeof className !== 'string') {
    return null
  }

  const matched = className.match(/crud-filter-item--span-(\d+)/)

  if (!matched) {
    return null
  }

  const span = Number(matched[1])

  return Number.isFinite(span) && span > 0 ? span : null
}

function parseCrudFilterColSizeToSpan(colSize: string | undefined, columnCount: number) {
  if (typeof colSize !== 'string' || !colSize.trim()) {
    return null
  }

  const normalizedColumnCount =
    Number.isFinite(columnCount) && columnCount > 0 ? columnCount : 1
  const value = colSize.trim()
  const parts = value.split('/')

  if (parts.length === 2) {
    const numerator = Number(parts[0])
    const denominator = Number(parts[1])

    if (
      Number.isFinite(numerator) &&
      numerator > 0 &&
      Number.isFinite(denominator) &&
      denominator > 0
    ) {
      return Math.max(
        1,
        Math.min(
          normalizedColumnCount,
          Math.round((numerator / denominator) * normalizedColumnCount)
        )
      )
    }
  }

  const numericValue = Number(value)

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return Math.max(1, Math.min(normalizedColumnCount, Math.round(numericValue)))
  }

  return null
}

export function resolveCrudFilterCompactSpan(schema: any, columnCount: number) {
  const normalizedColumnCount =
    Number.isFinite(columnCount) && columnCount > 0 ? columnCount : 1

  if (String(schema?.columnClassName || '').includes(CRUD_FILTER_GRID_FULL_WIDTH_CLASS)) {
    return Math.max(1, normalizedColumnCount)
  }

  const colSpan = parseCrudFilterColSpan(schema?.colSpan)

  if (colSpan) {
    return Math.max(1, Math.min(normalizedColumnCount, colSpan))
  }

  const colSizeSpan = parseCrudFilterColSizeToSpan(schema?.colSize, columnCount)

  if (colSizeSpan) {
    return colSizeSpan
  }

  const classSpan = extractCrudFilterGridSpanFromClassName(schema?.columnClassName)

  if (classSpan) {
    return classSpan
  }

  return resolveCrudFilterGridSpan(schema)
}

export function resolveCrudFilterGridColumnCount(
  containerWidth: number,
  fieldsPerRow: CrudFilterFieldsPerRowConfig = DEFAULT_CRUD_FILTER_FIELDS_PER_ROW
) {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return fieldsPerRow.desktop
  }

  if (containerWidth <= CRUD_FILTER_MOBILE_BREAKPOINT) {
    return fieldsPerRow.mobile
  }

  if (containerWidth <= CRUD_FILTER_DESKTOP_WIDE_BREAKPOINT) {
    return fieldsPerRow.narrow
  }

  return fieldsPerRow.desktop
}

export function buildCrudFilterGridColumnClassName(
  schemaClassName: string | undefined,
  span: number,
  options: {
    index: number
    isToolbar?: boolean
    isWideCandidate?: boolean
    includeDefaultSpan?: boolean
  }
) {
  const {
    index,
    isToolbar = false,
    isWideCandidate = false,
    includeDefaultSpan = true,
  } = options

  return appendSchemaClassName(
    schemaClassName,
    CRUD_FILTER_GRID_ITEM_CLASS,
    Number.isFinite(index) && index >= 0
      ? `${CRUD_FILTER_GRID_INDEX_CLASS_PREFIX}${index}`
      : undefined,
    !isToolbar && CRUD_FILTER_GRID_FIELD_CLASS,
    !isToolbar && isWideCandidate && CRUD_FILTER_GRID_WIDE_CANDIDATE_CLASS,
    includeDefaultSpan && `${CRUD_FILTER_GRID_SPAN_CLASS_PREFIX}${span}`,
    isToolbar && CRUD_FILTER_GRID_TOOLBAR_CLASS
  )
}

export function extractCrudFilterGridItemIndex(className: string | undefined) {
  if (typeof className !== 'string') {
    return null
  }

  const matched = className.match(/crud-filter-item--index-(\d+)/)

  if (!matched) {
    return null
  }

  const index = Number(matched[1])

  return Number.isFinite(index) && index >= 0 ? index : null
}

export function normalizeCrudFilterGridItem(schema: any, index: number) {
  if (!isPlainObject(schema) || hasExplicitCrudFilterGridLayout(schema)) {
    return schema
  }

  const isToolbar = isCrudFilterToolbarSchema(schema)
  const isWideCandidate = isCrudFilterAutoWideCandidateSchema(schema)
  const span = resolveCrudFilterGridSpan(schema)

  return {
    ...schema,
    columnClassName: buildCrudFilterGridColumnClassName(schema.columnClassName, span, {
      index,
      isToolbar,
      isWideCandidate,
      includeDefaultSpan: true,
    }),
  }
}

export function normalizeCrudFilterGridLayout(filterSchema: any) {
  if (
    !isPlainObject(filterSchema) ||
    !isCrudFilterSmartLayoutEnabled(filterSchema) ||
    filterSchema.preserveFilterLayout === true
  ) {
    return filterSchema
  }

  const restFilterSchema = { ...filterSchema }
  delete restFilterSchema.columnCount
  delete restFilterSchema.columnsCount
  const bodyItems = normalizeSchemaArray(filterSchema.body)
  let firstCompactMarked = false

  return {
    ...restFilterSchema,
    mode: 'row',
    body: bodyItems.map((item, index) => {
      const normalizedItem = normalizeCrudFilterGridItem(item, index)

      if (
        !firstCompactMarked &&
        isPlainObject(normalizedItem) &&
        !isCrudFilterToolbarSchema(normalizedItem) &&
        !isCrudFilterAutoWideCandidateSchema(normalizedItem)
      ) {
        firstCompactMarked = true

        return {
          ...normalizedItem,
          columnClassName: appendSchemaClassName(
            normalizedItem.columnClassName,
            CRUD_FILTER_GRID_FIRST_COMPACT_CLASS
          ),
        }
      }

      return normalizedItem
    }),
  }
}
