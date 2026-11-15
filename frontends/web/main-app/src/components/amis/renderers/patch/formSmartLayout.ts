import { isPlainObject } from 'lodash'

import {
  normalizeBooleanConfigValue,
  normalizePositiveIntegerConfigValue,
  readSystemConfigValue,
} from './runtimeSystemConfig'

type FormSchema = Record<string, any>

type FormSmartLayoutColumnCountConfig = {
  small: number
  large: number
}

type FormSmartLayoutLabelStyle = 'normal' | 'horizontal'

export type FormSmartLayoutOptions = {
  enabled: boolean
  labelStyle: FormSmartLayoutLabelStyle
  smallItemLimit: number
  columnCount: FormSmartLayoutColumnCountConfig
}

export const FORM_SMART_LAYOUT_SMALL_ITEM_LIMIT = 5
export const FORM_SMART_LAYOUT_SINGLE_COLUMN_COUNT = 1
export const FORM_SMART_LAYOUT_DOUBLE_COLUMN_COUNT = 2

const FORM_SMART_LAYOUT_CONFIG_PREFIX = 'ui.form.smartLayout'
const FORM_SMART_LAYOUT_ENABLED_CONFIG_KEY = `${FORM_SMART_LAYOUT_CONFIG_PREFIX}.enabled`
const FORM_SMART_LAYOUT_LABEL_STYLE_CONFIG_KEY = `${FORM_SMART_LAYOUT_CONFIG_PREFIX}.labelStyle`
const FORM_SMART_LAYOUT_SMALL_ITEM_LIMIT_CONFIG_KEY = `${FORM_SMART_LAYOUT_CONFIG_PREFIX}.smallItemLimit`
const FORM_SMART_LAYOUT_COLUMN_COUNT_CONFIG_KEY = `${FORM_SMART_LAYOUT_CONFIG_PREFIX}.columnCount`
const FORM_SMART_LAYOUT_COLUMN_COUNT_SMALL_CONFIG_KEY = `${FORM_SMART_LAYOUT_COLUMN_COUNT_CONFIG_KEY}.small`
const FORM_SMART_LAYOUT_COLUMN_COUNT_LARGE_CONFIG_KEY = `${FORM_SMART_LAYOUT_COLUMN_COUNT_CONFIG_KEY}.large`
const DEFAULT_FORM_SMART_LAYOUT_OPTIONS: FormSmartLayoutOptions = {
  enabled: false,
  labelStyle: 'normal',
  smallItemLimit: FORM_SMART_LAYOUT_SMALL_ITEM_LIMIT,
  columnCount: {
    small: FORM_SMART_LAYOUT_SINGLE_COLUMN_COUNT,
    large: FORM_SMART_LAYOUT_DOUBLE_COLUMN_COUNT,
  },
}

const FORM_SMART_LAYOUT_EXCLUDED_ITEM_TYPES = ['fieldset', 'hidden', 'formula']
const FORM_SMART_LAYOUT_TABLE_FIELDSET_TYPES = ['input-table', 'table', 'crud']
const FORM_SMART_LAYOUT_SERVICE_TABLE_FIELDSET_TYPES = ['input-table']
const FORM_SMART_LAYOUT_TUNED_LAYOUT_TYPES = ['group', 'flex']

export function normalizeSchemaArray(value: any) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

function normalizeSchemaType(schema: any) {
  return String(schema?.type || '')
    .trim()
    .toLowerCase()
}

export function normalizeFormBodyItems(formSchema: any) {
  const body = normalizeSchemaArray(formSchema?.body)

  if (body.length) {
    return body
  }

  return normalizeSchemaArray(formSchema?.controls)
}

export function isFormSmartLayoutEnabled(formSchema: any, systemConfig?: any) {
  return resolveFormSmartLayoutOptions(formSchema, systemConfig).enabled
}

function normalizeFormSmartLayoutLabelStyle(
  value: any
): FormSmartLayoutLabelStyle | undefined {
  if (value === 'normal' || value === 'top') {
    return 'normal'
  }

  if (value === 'horizontal' || value === 'left') {
    return 'horizontal'
  }

  return undefined
}

function normalizeFormSmartLayoutColumnCountConfig(
  value: any,
  fallback: FormSmartLayoutColumnCountConfig = DEFAULT_FORM_SMART_LAYOUT_OPTIONS.columnCount
) {
  const directValue = normalizePositiveIntegerConfigValue(value)

  if (directValue) {
    return {
      small: directValue,
      large: directValue,
    }
  }

  if (!isPlainObject(value)) {
    return fallback
  }

  return {
    small: normalizePositiveIntegerConfigValue(value.small) ?? fallback.small,
    large: normalizePositiveIntegerConfigValue(value.large) ?? fallback.large,
  }
}

function readFormSmartLayoutSystemColumnCount(systemConfig: any) {
  const groupedValue = readSystemConfigValue(
    systemConfig,
    FORM_SMART_LAYOUT_COLUMN_COUNT_CONFIG_KEY
  )

  if (groupedValue !== undefined) {
    return groupedValue
  }

  const leafValues = {
    small: readSystemConfigValue(
      systemConfig,
      FORM_SMART_LAYOUT_COLUMN_COUNT_SMALL_CONFIG_KEY
    ),
    large: readSystemConfigValue(
      systemConfig,
      FORM_SMART_LAYOUT_COLUMN_COUNT_LARGE_CONFIG_KEY
    ),
  }

  return Object.values(leafValues).some((value) => value !== undefined)
    ? leafValues
    : undefined
}

export function resolveFormSmartLayoutOptions(
  formSchema: any,
  systemConfig?: any
): FormSmartLayoutOptions {
  const smartLayoutConfig = isPlainObject(formSchema?.smartLayout)
    ? formSchema.smartLayout
    : undefined
  const systemEnabled = normalizeBooleanConfigValue(
    readSystemConfigValue(systemConfig, FORM_SMART_LAYOUT_ENABLED_CONFIG_KEY)
  )
  const systemLabelStyle = normalizeFormSmartLayoutLabelStyle(
    readSystemConfigValue(systemConfig, FORM_SMART_LAYOUT_LABEL_STYLE_CONFIG_KEY)
  )
  const schemaEnabled =
    smartLayoutConfig &&
    Object.prototype.hasOwnProperty.call(smartLayoutConfig, 'enabled')
      ? normalizeBooleanConfigValue(smartLayoutConfig.enabled)
      : formSchema?.smartLayout === true
        ? true
        : formSchema?.smartLayout === false
          ? false
          : smartLayoutConfig
            ? true
            : undefined
  const systemColumnCount = normalizeFormSmartLayoutColumnCountConfig(
    readFormSmartLayoutSystemColumnCount(systemConfig)
  )
  const schemaColumnCount = normalizeFormSmartLayoutColumnCountConfig(
    smartLayoutConfig?.columnCount,
    systemColumnCount
  )
  const schemaLabelStyle = normalizeFormSmartLayoutLabelStyle(
    smartLayoutConfig?.labelStyle
  )
  const systemSmallItemLimit = normalizePositiveIntegerConfigValue(
    readSystemConfigValue(systemConfig, FORM_SMART_LAYOUT_SMALL_ITEM_LIMIT_CONFIG_KEY)
  )
  const schemaSmallItemLimit = normalizePositiveIntegerConfigValue(
    smartLayoutConfig?.smallItemLimit
  )

  return {
    enabled: schemaEnabled ?? systemEnabled ?? DEFAULT_FORM_SMART_LAYOUT_OPTIONS.enabled,
    labelStyle:
      schemaLabelStyle ??
      systemLabelStyle ??
      DEFAULT_FORM_SMART_LAYOUT_OPTIONS.labelStyle,
    smallItemLimit:
      schemaSmallItemLimit ??
      systemSmallItemLimit ??
      DEFAULT_FORM_SMART_LAYOUT_OPTIONS.smallItemLimit,
    columnCount: schemaColumnCount,
  }
}

export function isFormTableLikeFieldset(schema: any) {
  if (!isPlainObject(schema) || normalizeSchemaType(schema) !== 'fieldset') {
    return false
  }

  const bodyItems = normalizeSchemaArray(schema.body)

  return bodyItems.every(isFormTableLikeFieldsetItem)
}

function isFormTableLikeFieldsetItem(schema: any): boolean {
  if (!isPlainObject(schema)) {
    return false
  }

  const type = normalizeSchemaType(schema)

  if (FORM_SMART_LAYOUT_TABLE_FIELDSET_TYPES.includes(type)) {
    return true
  }

  if (type !== 'service') {
    return false
  }

  const bodyItems = normalizeSchemaArray(schema.body)

  return (
    bodyItems.length > 0 &&
    bodyItems.every((item) => {
      return (
        isPlainObject(item) &&
        FORM_SMART_LAYOUT_SERVICE_TABLE_FIELDSET_TYPES.includes(normalizeSchemaType(item))
      )
    })
  )
}

export function isFormTunedFieldset(schema: any) {
  return (
    isPlainObject(schema) &&
    normalizeSchemaType(schema) === 'fieldset' &&
    schema.body != null &&
    !isFormTableLikeFieldset(schema)
  )
}

export function hasTunedFormLayout(formSchema: any) {
  const bodyItems = normalizeFormBodyItems(formSchema)

  return bodyItems.some((item) => {
    const type = normalizeSchemaType(item)

    return (
      FORM_SMART_LAYOUT_TUNED_LAYOUT_TYPES.includes(type) || isFormTunedFieldset(item)
    )
  })
}

export function isFormLayoutCountItem(schema: any) {
  if (!isPlainObject(schema)) {
    return Boolean(schema)
  }

  const type = normalizeSchemaType(schema)

  if (FORM_SMART_LAYOUT_EXCLUDED_ITEM_TYPES.includes(type)) {
    return false
  }

  if (schema.hidden === true || schema.visible === false) {
    return false
  }

  return true
}

export function countFormSmartLayoutItems(formSchema: any) {
  return normalizeFormBodyItems(formSchema).filter(isFormLayoutCountItem).length
}

function parseExplicitFormColumnCount(columnCount: any) {
  const numericValue =
    typeof columnCount === 'string' ? Number(columnCount.trim()) : Number(columnCount)

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null
  }

  return Math.max(1, Math.round(numericValue))
}

function stripWidthInputClassName(inputClassName: any) {
  if (typeof inputClassName !== 'string') {
    return inputClassName
  }

  const classNames = inputClassName.split(/\s+/).filter(Boolean)
  const nextClassNames = classNames.filter((className) => !className.startsWith('w-'))

  if (nextClassNames.length === classNames.length) {
    return inputClassName
  }

  return nextClassNames.length ? nextClassNames.join(' ') : undefined
}

function normalizeFormLayoutItem(schema: any) {
  if (!isPlainObject(schema)) {
    return schema
  }

  const inputClassName = stripWidthInputClassName(schema.inputClassName)
  const hasExplicitSize = Object.prototype.hasOwnProperty.call(schema, 'size')

  if (inputClassName === schema.inputClassName && !hasExplicitSize) {
    return schema
  }

  const nextSchema = {
    ...schema,
  }

  if (inputClassName) {
    nextSchema.inputClassName = inputClassName
  } else {
    delete nextSchema.inputClassName
  }

  if (hasExplicitSize) {
    delete nextSchema.size
  }

  return nextSchema
}

function normalizeFormLayoutItems(formSchema: any) {
  const collectionKey = normalizeSchemaArray(formSchema?.body).length
    ? 'body'
    : normalizeSchemaArray(formSchema?.controls).length
      ? 'controls'
      : null

  if (!collectionKey) {
    return formSchema
  }

  const items = normalizeSchemaArray(formSchema[collectionKey])
  let changed = false
  const nextItems = items.map((item) => {
    const nextItem = normalizeFormLayoutItem(item)

    if (nextItem !== item) {
      changed = true
    }

    return nextItem
  })

  if (!changed) {
    return formSchema
  }

  return {
    ...formSchema,
    [collectionKey]: nextItems,
  }
}

export function resolveFormSmartLayoutColumnCount(
  formSchema: any,
  options: FormSmartLayoutOptions = DEFAULT_FORM_SMART_LAYOUT_OPTIONS
) {
  return (
    parseExplicitFormColumnCount(formSchema?.columnCount) ??
    (countFormSmartLayoutItems(formSchema) <= options.smallItemLimit
      ? options.columnCount.small
      : options.columnCount.large)
  )
}

export function normalizeFormSmartLayout<T extends FormSchema>(
  formSchema: T,
  systemConfig?: any
): T
export function normalizeFormSmartLayout(formSchema: any, systemConfig?: any) {
  const smartLayoutOptions = resolveFormSmartLayoutOptions(formSchema, systemConfig)

  if (!smartLayoutOptions.enabled || hasTunedFormLayout(formSchema)) {
    return formSchema
  }

  const normalizedLayoutItemsForm = normalizeFormLayoutItems(formSchema)
  const columnCount = resolveFormSmartLayoutColumnCount(formSchema, smartLayoutOptions)

  if (
    normalizedLayoutItemsForm === formSchema &&
    formSchema.mode === smartLayoutOptions.labelStyle &&
    formSchema.columnCount === columnCount
  ) {
    return formSchema
  }

  return {
    ...normalizedLayoutItemsForm,
    mode: smartLayoutOptions.labelStyle,
    columnCount,
  }
}
