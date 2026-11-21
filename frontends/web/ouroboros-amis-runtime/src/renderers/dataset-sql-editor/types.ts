import type { FormControlProps } from 'amis'

export interface StatisticsDatasourceOption {
  label: string
  value: string
  platformDataSourceName?: string
}

export interface DatasetSqlDialect {
  dialectName: string
  sql: string
}

export interface DatasetSqlEditorValue {
  type: string
  datasource: string
  sql: string
  dialects: DatasetSqlDialect[]
}

export interface DatasetSqlEditorProps extends FormControlProps {
  datasourceOptions?: StatisticsDatasourceOption[] | string
}

export interface DatasetTestConnection {
  kind: 'application' | 'platform' | 'runtime'
  platformDataSourceName?: string
  envName?: string
  runtimeId?: string
}

export interface DatasetDevConfig {
  appName?: string
  datasetName?: string
  datasource?: string
  parameters?: Record<string, any>
  testConnection?: DatasetTestConnection
}

export interface DatasetDevConfigEntry {
  id: string
  key: string
  value: string
}
