import type {
  StatisticsDatasourceOption,
  StatisticsParameterHint,
  StatisticsSqlEditorValue,
  StatisticsSqlVariant,
} from './types'

function isRecord(value: any): value is Record<string, any> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeString(value: any): string {
  if (typeof value === 'string') {
    return value
  }
  if (value == null) {
    return ''
  }
  return String(value)
}

export function normalizeStringArray(value: any): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => normalizeString(item).trim())
    .filter((item) => item.length > 0)
}

export function parseTagInput(value: string): string[] {
  return normalizeString(value)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function formatTagInput(values: string[]): string {
  return normalizeStringArray(values).join(', ')
}

export function extractRendererValue(value: any, fieldName: string): any {
  if (isRecord(value) && Object.prototype.hasOwnProperty.call(value, fieldName)) {
    return value[fieldName]
  }
  return value
}

export function normalizeDatasourceOptions(value: any): StatisticsDatasourceOption[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => {
      if (!isRecord(item)) {
        const text = normalizeString(item).trim()
        return text
          ? {
              label: text,
              value: text,
            }
          : null
      }
      const label = normalizeString(item.label || item.value).trim()
      const optionValue = normalizeString(item.value || item.label).trim()
      if (!optionValue) {
        return null
      }
      return {
        label: label || optionValue,
        value: optionValue,
        platformDataSourceName: normalizeString(item.platformDataSourceName).trim(),
      }
    })
    .filter((item): item is StatisticsDatasourceOption => item != null)
}

export function normalizeSqlVariant(value: any, index: number): StatisticsSqlVariant {
  const record = isRecord(value) ? value : {}
  return {
    variantName: normalizeString(record.variantName).trim() || 'variant-' + (index + 1),
    dialect: normalizeString(record.dialect).trim(),
    dialectVersionRange: normalizeString(record.dialectVersionRange).trim(),
    datasourceTags: normalizeStringArray(record.datasourceTags),
    priority:
      typeof record.priority === 'number' && Number.isFinite(record.priority)
        ? record.priority
        : undefined,
    sqlText: normalizeString(record.sqlText),
  }
}

export function normalizeSqlEditorValue(value: any): StatisticsSqlEditorValue {
  const record = isRecord(value) ? value : {}
  return {
    type: normalizeString(record.type).trim() || 'sql',
    datasourceName: normalizeString(record.datasourceName).trim(),
    datasourceTags: normalizeStringArray(record.datasourceTags),
    genericSql: normalizeString(record.genericSql),
    variants: Array.isArray(record.variants)
      ? record.variants.map((item, index) => normalizeSqlVariant(item, index))
      : [],
  }
}

export function isSqlEditorValueEqual(left: any, right: any): boolean {
  const normalizedLeft = normalizeSqlEditorValue(left)
  const normalizedRight = normalizeSqlEditorValue(right)

  if (normalizedLeft.type !== normalizedRight.type) {
    return false
  }
  if (normalizedLeft.datasourceName !== normalizedRight.datasourceName) {
    return false
  }
  if (normalizedLeft.genericSql !== normalizedRight.genericSql) {
    return false
  }
  if (normalizedLeft.datasourceTags.length !== normalizedRight.datasourceTags.length) {
    return false
  }
  if (
    normalizedLeft.datasourceTags.some(
      (item, index) => item !== normalizedRight.datasourceTags[index]
    )
  ) {
    return false
  }
  if (normalizedLeft.variants.length !== normalizedRight.variants.length) {
    return false
  }

  return normalizedLeft.variants.every((variant, index) => {
    const rightVariant = normalizedRight.variants[index]
    return (
      variant.variantName === rightVariant.variantName &&
      variant.dialect === rightVariant.dialect &&
      variant.dialectVersionRange === rightVariant.dialectVersionRange &&
      variant.priority === rightVariant.priority &&
      variant.sqlText === rightVariant.sqlText &&
      variant.datasourceTags.length === rightVariant.datasourceTags.length &&
      variant.datasourceTags.every((tag, tagIndex) => tag === rightVariant.datasourceTags[tagIndex])
    )
  })
}

export function resolveActiveVariantName(
  value: StatisticsSqlEditorValue,
  currentName?: string
): string {
  const variants = value.variants || []
  if (!variants.length) {
    return ''
  }
  if (currentName && variants.some((item) => item.variantName === currentName)) {
    return currentName
  }
  return variants[0].variantName
}

export function ensureUniqueVariantName(
  candidate: string,
  variants: StatisticsSqlVariant[],
  currentName?: string
): string {
  const normalizedCandidate = normalizeString(candidate).trim() || 'variant'
  const occupiedNames = variants
    .map((item) => item.variantName)
    .filter((item) => item && item !== currentName)
  if (!occupiedNames.includes(normalizedCandidate)) {
    return normalizedCandidate
  }
  let index = 2
  while (occupiedNames.includes(normalizedCandidate + '-' + index)) {
    index += 1
  }
  return normalizedCandidate + '-' + index
}

export function buildNextVariantName(value: StatisticsSqlEditorValue): string {
  let index = (value.variants || []).length + 1
  const names = new Set((value.variants || []).map((item) => item.variantName))
  while (names.has('variant-' + index)) {
    index += 1
  }
  return 'variant-' + index
}

export function buildParameterHints(data: any): StatisticsParameterHint[] {
  const parameters = Array.isArray(data?.dataset?.parameters)
    ? data.dataset.parameters
    : Array.isArray(data?.parameters)
      ? data.parameters
      : []

  return parameters.map((item: any) => ({
    name: normalizeString(item?.name).trim(),
    title: normalizeString(item?.title).trim(),
    type: normalizeString(item?.type).trim() || '-',
    operator: normalizeString(item?.operator).trim() || '=',
    required: Boolean(item?.required),
    multiValue: Boolean(item?.multiValue),
    visibleInView: item?.visibleInView !== false,
  }))
}
