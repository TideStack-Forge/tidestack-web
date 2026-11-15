export const TABLE_COLUMN_EXPLICIT_CONTROL_MIN_WIDTH_CLASS =
  'table-cell--explicit-control-min-width'

export const TABLE_COLUMN_CONTROL_MIN_WIDTH_VAR = '--table-cell-control-min-width'

type ColumnSizingValue = {
  cssValue: string
  pixelValue?: number
}

function normalizeNumericSize(value: number): ColumnSizingValue | undefined {
  if (!Number.isFinite(value) || value <= 0) {
    return undefined
  }

  return {
    cssValue: `${value}px`,
    pixelValue: value,
  }
}

export function resolveColumnSizingValue(value: unknown): ColumnSizingValue | undefined {
  if (typeof value === 'number') {
    return normalizeNumericSize(value)
  }

  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  const numericValue = Number(trimmed)
  if (Number.isFinite(numericValue)) {
    return normalizeNumericSize(numericValue)
  }

  const pixelMatch = trimmed.match(/^(\d+(?:\.\d+)?)px$/i)
  if (pixelMatch) {
    return normalizeNumericSize(Number(pixelMatch[1]))
  }

  return /^[\d.]+(?:rem|em|%|vw|vh|vmin|vmax)$/i.test(trimmed)
    ? { cssValue: trimmed }
    : undefined
}

function appendClassName(className: unknown, nextClassName: string) {
  const currentClassName = typeof className === 'string' ? className.trim() : ''
  if (!currentClassName) {
    return nextClassName
  }

  return currentClassName.split(/\s+/).includes(nextClassName)
    ? currentClassName
    : `${currentClassName} ${nextClassName}`
}

export function normalizeTableColumnSizing<T extends Record<string, any>>(column: T): T {
  const minWidth = resolveColumnSizingValue(column.minWidth)
  const width = resolveColumnSizingValue(column.width)
  const sizing = minWidth ?? width

  if (!sizing) {
    return column
  }

  const style =
    column.style && typeof column.style === 'object' && !Array.isArray(column.style)
      ? column.style
      : {}

  return {
    ...column,
    className: appendClassName(
      column.className,
      TABLE_COLUMN_EXPLICIT_CONTROL_MIN_WIDTH_CLASS
    ),
    style: {
      ...style,
      [TABLE_COLUMN_CONTROL_MIN_WIDTH_VAR]: sizing.cssValue,
    },
    ...(typeof minWidth?.pixelValue === 'number' ? { minWidth: minWidth.pixelValue } : {}),
  }
}

export function getExplicitTableColumnMinWidth(column: any) {
  if (column?.pristine) {
    return Object.prototype.hasOwnProperty.call(column.pristine, 'minWidth')
      ? resolveColumnSizingValue(column.pristine.minWidth)?.pixelValue
      : undefined
  }

  return resolveColumnSizingValue(column?.minWidth)?.pixelValue
}
