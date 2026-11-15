import type { FormControlProps } from 'amis'

export interface StatisticsDatasourceOption {
  label: string
  value: string
  platformDataSourceName?: string
}

export interface StatisticsSqlVariant {
  variantName: string
  dialect: string
  dialectVersionRange: string
  datasourceTags: string[]
  priority?: number
  sqlText: string
}

export interface StatisticsSqlEditorValue {
  type: string
  datasourceName: string
  datasourceTags: string[]
  genericSql: string
  variants: StatisticsSqlVariant[]
}

export interface StatisticsParameterHint {
  name: string
  title: string
  type: string
  operator: string
  required: boolean
  multiValue: boolean
  visibleInView: boolean
}

export interface StatisticsSqlEditorProps extends FormControlProps {
  datasourceOptions?: StatisticsDatasourceOption[] | string
}
