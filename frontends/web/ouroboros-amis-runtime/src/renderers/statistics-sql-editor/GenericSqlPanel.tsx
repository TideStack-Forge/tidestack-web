import React from 'react'

import { extractRendererValue, normalizeString } from './utils'
import type { StatisticsDatasourceOption, StatisticsSqlEditorValue } from './types'

interface GenericSqlPanelProps {
  render: any
  language?: string
  value: StatisticsSqlEditorValue
  disabled: boolean
  datasourceOptions: StatisticsDatasourceOption[]
  onDatasourceNameChange(value: string): void
  onGenericSqlChange(value: string): void
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 'var(--Form-input-height)',
  borderRadius: 'var(--Form-input-borderRadius)',
  border: '1px solid var(--Form-input-borderColor)',
  padding: 'var(--Form-input-paddingY) var(--Form-input-paddingX)',
  backgroundColor: 'var(--Form-input-bg)',
  color: 'var(--text-color)',
  fontSize: 'var(--fontSizeBase)',
}

export default function GenericSqlPanel(props: GenericSqlPanelProps) {
  const {
    datasourceOptions,
    disabled,
    language = 'sql',
    onDatasourceNameChange,
    onGenericSqlChange,
    render,
    value,
  } = props

  return (
    <section>
      <div
        style={{
          maxWidth: '320px',
          marginBottom: '16px',
        }}>
        <label>
          <span className="block m-b-xs">数据源</span>
          <select
            value={value.datasourceName || 'default'}
            disabled={disabled}
            onChange={(event) => onDatasourceNameChange(event.target.value)}
            style={inputStyle}>
            {!datasourceOptions.some((option) => option.value === 'default') && (
              <option value="default">默认数据源</option>
            )}
            {datasourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ marginBottom: '8px' }}>
        <h5 className="m-t-none m-b-sm">通用 SQL</h5>
        {render(
          'statistics-sql-editor-generic-sql',
          {
            type: 'script-editor',
            name: 'statisticsSqlEditorGenericSql',
            label: false,
            language,
            value: value.genericSql,
            disabled,
            static: disabled,
            size: 'lg',
            options: {
              automaticLayout: true,
              minimap: {
                enabled: false,
              },
            },
          },
          {
            data: {
              statisticsSqlEditorGenericSql: value.genericSql,
            },
            onChange: (nextValue: any) => {
              onGenericSqlChange(
                normalizeString(
                  extractRendererValue(nextValue, 'statisticsSqlEditorGenericSql')
                )
              )
            },
          }
        )}
      </div>
    </section>
  )
}
