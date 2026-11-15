import type { NormalizedModelMeta } from '../model-meta/model-meta-types'

export type WhereFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'time'
  | 'datetime'
  | 'boolean'
  | 'select'

export type WhereFieldDefinition = {
  name: string
  label: string
  type: WhereFieldType
  operators: string[]
  options?: any[]
  optionsSource?: any
}

export const WHERE_FIELD_OPERATOR_MATRIX: Record<WhereFieldType, string[]> = {
  text: [
    'equal',
    'not_equal',
    'like',
    'not_like',
    'starts_with',
    'ends_with',
    'is_empty',
    'is_not_empty',
  ],
  number: [
    'equal',
    'not_equal',
    'greater',
    'greater_or_equal',
    'less',
    'less_or_equal',
    'between',
    'not_between',
    'is_empty',
    'is_not_empty',
  ],
  date: [
    'equal',
    'not_equal',
    'greater',
    'greater_or_equal',
    'less',
    'less_or_equal',
    'between',
    'not_between',
    'is_empty',
    'is_not_empty',
  ],
  time: [
    'equal',
    'not_equal',
    'greater',
    'greater_or_equal',
    'less',
    'less_or_equal',
    'between',
    'not_between',
    'is_empty',
    'is_not_empty',
  ],
  datetime: [
    'equal',
    'not_equal',
    'greater',
    'greater_or_equal',
    'less',
    'less_or_equal',
    'between',
    'not_between',
    'is_empty',
    'is_not_empty',
  ],
  boolean: ['equal', 'not_equal', 'is_empty', 'is_not_empty'],
  select: [
    'equal',
    'not_equal',
    'select_any_in',
    'select_not_any_in',
    'is_empty',
    'is_not_empty',
  ],
}

export function buildWhereFields(
  fields: NormalizedModelMeta['fields']
): WhereFieldDefinition[] {
  return (fields ?? []).map((field) => {
    const type = normalizeWhereFieldType(field?.type)
    return {
      name: field.name,
      label: field.label,
      type,
      operators: WHERE_FIELD_OPERATOR_MATRIX[type],
      options: field.options,
      optionsSource: field.optionsSource,
    }
  })
}

export function normalizeWhereFieldType(type?: string): WhereFieldType {
  const normalizedType = String(type ?? '')
    .trim()
    .toLowerCase()

  if (!normalizedType) {
    return 'text'
  }
  if (isSelectType(normalizedType)) {
    return 'select'
  }
  if (isDateTimeType(normalizedType)) {
    return 'datetime'
  }
  if (isDateType(normalizedType)) {
    return 'date'
  }
  if (isTimeType(normalizedType)) {
    return 'time'
  }
  if (isBooleanType(normalizedType)) {
    return 'boolean'
  }
  if (isNumberType(normalizedType)) {
    return 'number'
  }
  return 'text'
}

function isSelectType(type: string) {
  return (
    type === 'select' ||
    type.includes('字典') ||
    type.includes('枚举') ||
    type.includes('option')
  )
}

function isDateTimeType(type: string) {
  return type === 'datetime' || type.includes('日期时间')
}

function isDateType(type: string) {
  return type === 'date' || (type.includes('日期') && !type.includes('日期时间'))
}

function isTimeType(type: string) {
  return type === 'time' || (type.includes('时间') && !type.includes('日期时间'))
}

function isBooleanType(type: string) {
  return type === 'boolean' || type.includes('布尔')
}

function isNumberType(type: string) {
  return (
    type === 'number' ||
    type.includes('数字') ||
    type.includes('整数') ||
    type.includes('货币') ||
    type.includes('金额') ||
    type.includes('decimal') ||
    type.includes('float') ||
    type.includes('double')
  )
}
