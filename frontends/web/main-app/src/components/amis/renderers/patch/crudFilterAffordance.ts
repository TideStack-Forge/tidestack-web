import { isPlainObject } from 'lodash'

import {
  CRUD_FILTER_CONTROL_FILL_WIDTH_CLASS,
  CRUD_FILTER_DATETIME_RANGE_MIN_WIDTH_CLASS_UNITS,
  CRUD_FILTER_DATE_RANGE_MIN_WIDTH_CLASS_UNITS,
  CRUD_FILTER_FIELD_AFFORDANCE_COMPACT,
  CRUD_FILTER_LABEL_STYLE_PLACEHOLDER,
  CRUD_FILTER_WIDE_TOOLTIP_AUTO_WIDTH_CLASS,
  CRUD_FILTER_WIDE_TOOLTIP_CLASS,
  type CrudFilterFieldAffordanceOptions,
} from './crudFilterLayoutConstants'
import {
  appendSchemaClassName,
  hasCrudFilterWideCandidateClassName,
  hasCrudFilterWideHeadClassName,
  isCrudFilterDividerSchema,
  isCrudFilterToolbarSchema,
  isCrudFilterWideCandidateSchema,
  stripCrudFilterGridClassName,
} from './crudFilterGridSchema'

function shouldCompactCrudFilterFieldAffordance(
  options: CrudFilterFieldAffordanceOptions = {}
) {
  return (
    options.labelStyle === CRUD_FILTER_LABEL_STYLE_PLACEHOLDER ||
    options.fieldAffordance === CRUD_FILTER_FIELD_AFFORDANCE_COMPACT
  )
}

function resolveCrudFilterPlaceholderLabel(schema: any) {
  if (typeof schema?.label === 'string' && schema.label.trim()) {
    return schema.label
  }

  if (typeof schema?.label === 'number') {
    return String(schema.label)
  }

  return schema?.placeholder
}

function normalizeCrudFilterPlaceholderField(
  schema: any,
  options: CrudFilterFieldAffordanceOptions = {}
) {
  const placeholder = resolveCrudFilterPlaceholderLabel(schema)
  const normalizedSchema = options.moveWidthClassToInput
    ? normalizeCrudFilterInputClassNamePlacement(schema)
    : schema

  return {
    ...normalizedSchema,
    label: false,
    ...(placeholder !== undefined ? { placeholder } : {}),
  }
}

function parseCrudFilterWidthClassNameUnits(className: string) {
  const matched = /^w-(\d+)$/.exec(className)

  return matched ? Number(matched[1]) : null
}

function isCrudFilterWidthClassNameTooNarrow(
  className: string,
  minWidthClassUnits?: number
) {
  if (!minWidthClassUnits) {
    return false
  }

  const widthClassUnits = parseCrudFilterWidthClassNameUnits(className)

  return widthClassUnits !== null && widthClassUnits < minWidthClassUnits
}

function omitCrudFilterTooNarrowWidthClassName(
  className: any,
  minWidthClassUnits?: number
) {
  if (typeof className !== 'string' || !minWidthClassUnits) {
    return className
  }

  const classNames = className.split(/\s+/).filter(Boolean)
  const nextClassNames = classNames.filter(
    (item) =>
      !item.startsWith('w-') ||
      !isCrudFilterWidthClassNameTooNarrow(item, minWidthClassUnits)
  )

  if (nextClassNames.length === classNames.length) {
    return className
  }

  return nextClassNames.length ? nextClassNames.join(' ') : undefined
}

function splitCrudFilterWidthClassName(className: any, minWidthClassUnits?: number) {
  if (typeof className !== 'string') {
    return {
      className,
      widthClassName: undefined,
    }
  }

  const classNames = className.split(/\s+/).filter(Boolean)
  const hasWidthClassNames = classNames.some((item) => item.startsWith('w-'))

  if (!hasWidthClassNames) {
    return {
      className,
      widthClassName: undefined,
    }
  }

  const usableClassNames = classNames.filter(
    (item) => !isCrudFilterWidthClassNameTooNarrow(item, minWidthClassUnits)
  )
  const layoutClassNames = usableClassNames.filter((item) => !item.startsWith('w-'))
  const widthClassNames = usableClassNames.filter((item) => item.startsWith('w-'))

  return {
    className: layoutClassNames.length ? layoutClassNames.join(' ') : undefined,
    widthClassName: widthClassNames.length ? widthClassNames.join(' ') : undefined,
  }
}

function hasCrudFilterWidthClassName(className: any, minWidthClassUnits?: number) {
  return (
    typeof className === 'string' &&
    className
      .split(/\s+/)
      .some(
        (item) =>
          item.startsWith('w-') &&
          !isCrudFilterWidthClassNameTooNarrow(item, minWidthClassUnits)
      )
  )
}

function hasCrudFilterWidthStyle(style: any) {
  return (
    isPlainObject(style) &&
    ['width', 'minWidth', 'maxWidth'].some((key) => typeof style[key] !== 'undefined')
  )
}

function hasCrudFilterExplicitWidth(schema: any, minWidthClassUnits?: number) {
  return (
    hasCrudFilterWidthClassName(schema?.className, minWidthClassUnits) ||
    hasCrudFilterWidthClassName(schema?.inputClassName, minWidthClassUnits) ||
    hasCrudFilterWidthStyle(schema?.style) ||
    hasCrudFilterWidthStyle(schema?.inputStyle) ||
    typeof schema?.width !== 'undefined'
  )
}

function moveCrudFilterWidthClassNameToInput(
  className: any,
  inputClassName: any,
  minWidthClassUnits?: number
) {
  const splitClassName = splitCrudFilterWidthClassName(className, minWidthClassUnits)

  if (!splitClassName.widthClassName) {
    return {
      className: splitClassName.className,
      inputClassName,
    }
  }

  if (inputClassName && typeof inputClassName !== 'string') {
    return {
      className,
      inputClassName,
    }
  }

  const nextInputClassName = appendSchemaClassName(
    inputClassName,
    splitClassName.widthClassName
  )

  return {
    className: splitClassName.className,
    inputClassName: nextInputClassName || undefined,
  }
}

function normalizeCrudFilterInputClassNamePlacement(schema: any) {
  if (!isPlainObject(schema)) {
    return schema
  }

  const normalizedClassName = moveCrudFilterWidthClassNameToInput(
    schema.className,
    schema.inputClassName
  )

  if (
    normalizedClassName.className === schema.className &&
    normalizedClassName.inputClassName === schema.inputClassName
  ) {
    return schema
  }

  const nextSchema = {
    ...schema,
  }

  if (normalizedClassName.className) {
    nextSchema.className = normalizedClassName.className
  } else {
    delete nextSchema.className
  }

  if (normalizedClassName.inputClassName) {
    nextSchema.inputClassName = normalizedClassName.inputClassName
  } else {
    delete nextSchema.inputClassName
  }

  return nextSchema
}

function resolveCrudFilterTooltipLabel(schema: any) {
  if (typeof schema?.label === 'string' && schema.label.trim()) {
    return schema.label
  }

  if (typeof schema?.label === 'number') {
    return String(schema.label)
  }

  if (typeof schema?.placeholder === 'string' && schema.placeholder.trim()) {
    return schema.placeholder
  }

  if (typeof schema?.placeholder === 'number') {
    return String(schema.placeholder)
  }

  return undefined
}

function isCrudFilterLayoutEligibleItem(item: any) {
  return (
    isPlainObject(item) &&
    !isCrudFilterToolbarSchema(item) &&
    !isCrudFilterDividerSchema(item)
  )
}

export function isCrudFilterPlaceholderEligibleItem(item: any) {
  return isCrudFilterLayoutEligibleItem(item)
}

function hasCrudFilterTimeFormatToken(value: any) {
  return typeof value === 'string' && /(?:HH?|hh?|mm?|ss?|SSS?|A|a)/.test(value)
}

function isCrudFilterDateTimeRangeSchema(schema: any) {
  const type = String(schema?.type || '')
    .trim()
    .toLowerCase()

  if (type === 'input-datetime-range') {
    return true
  }

  if (type !== 'input-date-range') {
    return false
  }

  return [
    schema?.format,
    schema?.valueFormat,
    schema?.inputFormat,
    schema?.displayFormat,
    schema?.timeFormat,
  ].some((value) => hasCrudFilterTimeFormatToken(value))
}

function resolveCrudFilterRangeMinWidthClassUnits(schema: any) {
  if (!isCrudFilterWideCandidateSchema(schema)) {
    return undefined
  }

  return isCrudFilterDateTimeRangeSchema(schema)
    ? CRUD_FILTER_DATETIME_RANGE_MIN_WIDTH_CLASS_UNITS
    : CRUD_FILTER_DATE_RANGE_MIN_WIDTH_CLASS_UNITS
}

function resolveCrudFilterWideTooltipTypeClass(schema: any) {
  const type = String(schema?.type || '')
    .trim()
    .toLowerCase()

  if (!type) {
    return undefined
  }

  if (isCrudFilterDateTimeRangeSchema(schema)) {
    return `${CRUD_FILTER_WIDE_TOOLTIP_CLASS}--datetime-range`
  }

  return `${CRUD_FILTER_WIDE_TOOLTIP_CLASS}--${type.replace(/^input-/, '')}`
}

function normalizeCrudFilterWideTooltipField(
  schema: any,
  options: CrudFilterFieldAffordanceOptions = {}
) {
  const tooltipLabel = resolveCrudFilterTooltipLabel(schema)
  const {
    className,
    columnClassName,
    colSize,
    mode,
    hidden,
    hiddenOn,
    visible,
    visibleOn,
    ...innerSchema
  } = schema || {}
  const renderedClassName =
    typeof className === 'string'
      ? (stripCrudFilterGridClassName(className) ?? undefined)
      : className
  const inlineMode = mode === 'inline'
  const minWidthClassUnits = options.addInlineDefaultWidth
    ? resolveCrudFilterRangeMinWidthClassUnits(innerSchema)
    : undefined
  const normalizedInputClassName = omitCrudFilterTooNarrowWidthClassName(
    innerSchema.inputClassName,
    minWidthClassUnits
  )
  const normalizedInnerSchema = {
    ...innerSchema,
  }

  if (normalizedInputClassName) {
    normalizedInnerSchema.inputClassName = normalizedInputClassName
  } else {
    delete normalizedInnerSchema.inputClassName
  }

  const normalizedClassName = options.moveWidthClassToInput
    ? moveCrudFilterWidthClassNameToInput(
        renderedClassName,
        normalizedInnerSchema.inputClassName,
        minWidthClassUnits
      )
    : {
        className: omitCrudFilterTooNarrowWidthClassName(
          renderedClassName,
          minWidthClassUnits
        ),
        inputClassName: normalizedInnerSchema.inputClassName,
      }
  const shouldUseDefaultInlineWidth =
    (inlineMode || options.addInlineDefaultWidth) &&
    !hasCrudFilterExplicitWidth(
      {
        ...normalizedInnerSchema,
        className: normalizedClassName.className,
        inputClassName: normalizedClassName.inputClassName,
      },
      minWidthClassUnits
    )
  const tooltipClassName = appendSchemaClassName(
    normalizedClassName.className,
    inlineMode ? stripCrudFilterGridClassName(columnClassName) : undefined,
    CRUD_FILTER_WIDE_TOOLTIP_CLASS,
    shouldUseDefaultInlineWidth && CRUD_FILTER_WIDE_TOOLTIP_AUTO_WIDTH_CLASS,
    resolveCrudFilterWideTooltipTypeClass(innerSchema)
  )

  return {
    type: 'tooltip-wrapper',
    ...(inlineMode ? { inline: true } : {}),
    wrapperComponent: 'div',
    className: tooltipClassName,
    ...(tooltipLabel !== undefined ? { content: tooltipLabel } : {}),
    ...(!inlineMode && typeof columnClassName !== 'undefined' ? { columnClassName } : {}),
    ...(typeof colSize !== 'undefined' ? { colSize } : {}),
    ...(typeof mode !== 'undefined' ? { mode } : {}),
    ...(typeof hidden !== 'undefined' ? { hidden } : {}),
    ...(typeof hiddenOn !== 'undefined' ? { hiddenOn } : {}),
    ...(typeof visible !== 'undefined' ? { visible } : {}),
    ...(typeof visibleOn !== 'undefined' ? { visibleOn } : {}),
    body: {
      ...normalizedInnerSchema,
      ...(typeof normalizedClassName.inputClassName !== 'undefined'
        ? { inputClassName: normalizedClassName.inputClassName }
        : {}),
      label: false,
      wrap: false,
    },
  }
}

function normalizeCrudFilterFieldAffordance(
  schema: any,
  options: CrudFilterFieldAffordanceOptions = {}
) {
  if (isCrudFilterWideCandidateSchema(schema)) {
    return normalizeCrudFilterWideTooltipField(schema, options)
  }

  return normalizeCrudFilterPlaceholderField(schema, options)
}

export function applyCrudFilterPlaceholderBody(
  bodyItems: any[],
  options: CrudFilterFieldAffordanceOptions = {}
) {
  if (!shouldCompactCrudFilterFieldAffordance(options)) {
    return bodyItems.map((item) =>
      normalizeCrudFilterAllocatedWidthField(item, options)
    )
  }

  return bodyItems.map((item) => {
    if (!isCrudFilterPlaceholderEligibleItem(item)) {
      return item
    }

    return normalizeCrudFilterFieldAffordance(item, options)
  })
}

function isCrudFilterPromotedWideItem(item: any) {
  return (
    isCrudFilterLayoutEligibleItem(item) &&
    (hasCrudFilterWideCandidateClassName(item.columnClassName) ||
      isCrudFilterWideCandidateSchema(item))
  )
}

function shouldFillCrudFilterAllocatedWidth(
  schema: any,
  options: CrudFilterFieldAffordanceOptions = {}
) {
  if (!options.addInlineDefaultWidth || !isCrudFilterWideCandidateSchema(schema)) {
    return false
  }

  if (hasCrudFilterWideHeadClassName(schema?.columnClassName)) {
    return false
  }

  return !hasCrudFilterExplicitWidth(
    schema,
    resolveCrudFilterRangeMinWidthClassUnits(schema)
  )
}

function normalizeCrudFilterAllocatedWidthField(
  schema: any,
  options: CrudFilterFieldAffordanceOptions = {}
) {
  if (!shouldFillCrudFilterAllocatedWidth(schema, options)) {
    return schema
  }

  return {
    ...schema,
    inputClassName: appendSchemaClassName(
      schema.inputClassName,
      CRUD_FILTER_CONTROL_FILL_WIDTH_CLASS
    ),
  }
}

export function applyCrudFilterCompactSingleRowBody(
  bodyItems: any[],
  options: CrudFilterFieldAffordanceOptions = {}
) {
  const promotedWideField =
    bodyItems.find((item) => isCrudFilterPromotedWideItem(item)) ?? null
  const reorderedItems = promotedWideField
    ? [promotedWideField, ...bodyItems.filter((item) => item !== promotedWideField)]
    : bodyItems

  if (!shouldCompactCrudFilterFieldAffordance(options)) {
    return reorderedItems.map((item) =>
      normalizeCrudFilterAllocatedWidthField(item, options)
    )
  }

  return reorderedItems.map((item) => {
    if (!isCrudFilterPlaceholderEligibleItem(item)) {
      return item
    }

    return normalizeCrudFilterFieldAffordance(item, options)
  })
}

export function moveCrudFilterInlineClassNameToRoot(
  schema: any,
  semanticClassName?: string,
  options: CrudFilterFieldAffordanceOptions = {}
) {
  const { className, columnClassName, inputClassName, ...rest } = schema || {}
  delete rest.colSize
  const renderedClassName =
    typeof className === 'string' ? stripCrudFilterGridClassName(className) : className
  const normalizedClassName = shouldCompactCrudFilterFieldAffordance(options)
    ? moveCrudFilterWidthClassNameToInput(renderedClassName, inputClassName)
    : {
        className: renderedClassName,
        inputClassName,
      }
  const nextClassName = appendSchemaClassName(
    normalizedClassName.className,
    stripCrudFilterGridClassName(columnClassName),
    semanticClassName
  )

  const nextSchema = {
    ...rest,
  }

  if (nextClassName) {
    nextSchema.className = nextClassName
  }

  if (typeof normalizedClassName.inputClassName !== 'undefined') {
    nextSchema.inputClassName = normalizedClassName.inputClassName
  }

  return nextSchema
}
