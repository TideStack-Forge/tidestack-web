import type {
  StatisticsDatasourceOption,
  DatasetSqlEditorValue,
  DatasetSqlDialect,
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

export function normalizeSqlDialect(value: any, index: number): DatasetSqlDialect {
  const record = isRecord(value) ? value : {}
  return {
    dialectName: normalizeString(record.dialectName).trim() || 'dialect-' + (index + 1),
    sql: normalizeString(record.sql),
  }
}

export function normalizeSqlEditorValue(value: any): DatasetSqlEditorValue {
  const record = isRecord(value) ? value : {}
  return {
    type: normalizeString(record.type).trim() || 'sql',
    datasource: normalizeString(record.datasource).trim(),
    sql: normalizeString(record.sql),
    dialects: Array.isArray(record.dialects)
      ? record.dialects.map((item, index) => normalizeSqlDialect(item, index))
      : [],
  }
}

export function isSqlEditorValueEqual(left: any, right: any): boolean {
  const normalizedLeft = normalizeSqlEditorValue(left)
  const normalizedRight = normalizeSqlEditorValue(right)

  if (normalizedLeft.type !== normalizedRight.type) {
    return false
  }
  if (normalizedLeft.datasource !== normalizedRight.datasource) {
    return false
  }
  if (normalizedLeft.sql !== normalizedRight.sql) {
    return false
  }
  if (normalizedLeft.dialects.length !== normalizedRight.dialects.length) {
    return false
  }

  return normalizedLeft.dialects.every((dialect, index) => {
    const rightDialect = normalizedRight.dialects[index]
    return (
      dialect.dialectName === rightDialect.dialectName && dialect.sql === rightDialect.sql
    )
  })
}

export function ensureUniqueDialectName(
  candidate: string,
  dialects: DatasetSqlDialect[],
  currentName?: string
): string {
  const normalizedCandidate = normalizeString(candidate).trim() || 'dialect'
  const occupiedNames = dialects
    .map((item) => item.dialectName)
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

export function buildNextDialectName(value: DatasetSqlEditorValue): string {
  let index = (value.dialects || []).length + 1
  const names = new Set((value.dialects || []).map((item) => item.dialectName))
  while (names.has('dialect-' + index)) {
    index += 1
  }
  return 'dialect-' + index
}
