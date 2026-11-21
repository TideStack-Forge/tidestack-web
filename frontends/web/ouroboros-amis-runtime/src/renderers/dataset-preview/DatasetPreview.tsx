import React from 'react'
import { Renderer, buildApi, dataMapping } from 'amis'
import { Client } from '#ouroboros-host/utils/http'

type DatasetPreviewProps = {
  api: any
  data?: Record<string, any>
  env: {
    fetcher: (api: any, data?: any) => Promise<any>
  }
}

type DatasetPreviewState = {
  loading: boolean
  error: string
  result: Record<string, any> | null
  pageNo: number
}

const PAGE_SIZE = 100

function unwrapFetcherResult(result: any) {
  return result?.data &&
    typeof result.data === 'object' &&
    Object.prototype.hasOwnProperty.call(result.data, 'status')
    ? result.data
    : result
}

function displayValue(value: any): string {
  if (value == null) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function restoreDatasetSql(apiData: Record<string, any>, sourceDataset: any) {
  const sourceQueryDefinition = sourceDataset?.queryDefinition
  const mappedDataset = apiData.dataset
  const sourceSql = sourceQueryDefinition?.sql
  if (
    !sourceQueryDefinition ||
    !mappedDataset ||
    typeof mappedDataset !== 'object' ||
    typeof sourceQueryDefinition !== 'object' ||
    typeof sourceSql !== 'string' ||
    !sourceSql.trim()
  ) {
    return apiData
  }

  return {
    ...apiData,
    dataset: {
      ...mappedDataset,
      tags: Array.isArray(mappedDataset.tags) ? mappedDataset.tags : [],
      queryDefinition: {
        ...(mappedDataset.queryDefinition || {}),
        sql: sourceQueryDefinition.sql,
        dialects: sourceQueryDefinition.dialects,
      },
    },
  }
}

class DatasetPreview extends React.Component<DatasetPreviewProps, DatasetPreviewState> {
  state: DatasetPreviewState = {
    loading: true,
    error: '',
    result: null,
    pageNo: 1,
  }

  componentDidMount() {
    void this.loadPage(1)
  }

  async loadPage(pageNo: number) {
    this.setState({ loading: true, error: '' })
    try {
      const data = this.props.data || {}
      const resolvedApi = buildApi(
        typeof this.props.api === 'string'
          ? dataMapping(this.props.api, data)
          : this.props.api,
        data
      )
      resolvedApi.data = {
        ...(resolvedApi.data || {}),
        page: {
          pageNo,
          pageSize: PAGE_SIZE,
        },
      }
      const restoredData = restoreDatasetSql(resolvedApi.data, data.dataset)
      resolvedApi.data = restoredData
      if (resolvedApi.body && typeof resolvedApi.body === 'object') {
        resolvedApi.body = restoreDatasetSql(resolvedApi.body, data.dataset)
      }
      const response = await Client.post(resolvedApi.url, resolvedApi.data, {
        isSilent: true,
      })
      const payload = unwrapFetcherResult(response.data)
      if (payload?.status !== 0 && payload?.code !== 0) {
        throw new Error(payload?.msg || '数据集预览失败')
      }
      this.setState({
        loading: false,
        result: payload?.data || {},
        pageNo,
      })
    } catch (error) {
      this.setState({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  getFields() {
    const result = this.state.result || {}
    const schemaFields = result.resolvedSchema?.fields
    if (Array.isArray(schemaFields) && schemaFields.length) {
      return schemaFields
    }
    const firstRow = Array.isArray(result.rows) ? result.rows[0] : null
    return firstRow && typeof firstRow === 'object'
      ? Object.keys(firstRow).map((name) => ({ name, title: name }))
      : []
  }

  renderDiagnostics() {
    const result = this.state.result || {}
    const diagnostics = result.diagnostics || {}
    const datasource =
      result.executionMeta?.datasource || diagnostics.attributes?.datasource
    const dialect =
      diagnostics.matchedSqlDialect || result.executionMeta?.dialect || '通用 SQL'
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 20px',
          padding: '10px 0 14px',
          color: '#475569',
          fontSize: '12px',
        }}>
        <span>数据源：{datasource || '-'}</span>
        <span>SQL：{dialect}</span>
      </div>
    )
  }

  renderTable() {
    const result = this.state.result || {}
    const rows = Array.isArray(result.rows) ? result.rows : []
    const fields = this.getFields()
    if (!fields.length) {
      return (
        <div style={{ padding: '56px 16px', textAlign: 'center', color: '#64748b' }}>
          查询成功，未返回字段。
        </div>
      )
    }
    return (
      <div style={{ overflow: 'auto', border: '1px solid #e5e7eb' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'auto',
            fontSize: '13px',
          }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              {fields.map((field: any) => (
                <th
                  key={field.name}
                  style={{
                    minWidth: '140px',
                    padding: '10px 12px',
                    borderBottom: '1px solid #dbe2ea',
                    textAlign: 'left',
                    color: '#1f2937',
                  }}>
                  <div>{field.title || field.name}</div>
                  <div style={{ marginTop: '2px', color: '#64748b', fontSize: '11px' }}>
                    {field.name} · {field.dataType || 'unknown'}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: Record<string, any>, rowIndex: number) => (
              <tr key={rowIndex}>
                {fields.map((field: any) => (
                  <td
                    key={field.name}
                    style={{
                      padding: '9px 12px',
                      borderBottom: '1px solid #eef2f7',
                      color: row[field.name] == null ? '#94a3b8' : '#334155',
                      whiteSpace: 'nowrap',
                    }}>
                    {row[field.name] == null ? 'NULL' : displayValue(row[field.name])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: '#64748b' }}>
            查询成功，没有符合条件的数据。
          </div>
        ) : null}
      </div>
    )
  }

  renderPagination() {
    const pageInfo = this.state.result?.pageInfo || {}
    const rows = Array.isArray(this.state.result?.rows) ? this.state.result.rows : []
    const pageInfoTotal = Number(pageInfo.total)
    const total = Number.isFinite(pageInfoTotal)
      ? Math.max(pageInfoTotal, rows.length)
      : rows.length
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '12px',
          color: '#64748b',
          fontSize: '12px',
        }}>
        <span>
          共 {total} 条，第 {this.state.pageNo} / {totalPages} 页
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            title="上一页"
            aria-label="上一页"
            disabled={this.state.pageNo <= 1 || this.state.loading}
            onClick={() => void this.loadPage(this.state.pageNo - 1)}
            className="btn btn-default btn-sm">
            <i className="fa fa-chevron-left" aria-hidden="true" />
          </button>
          <button
            type="button"
            title="下一页"
            aria-label="下一页"
            disabled={this.state.pageNo >= totalPages || this.state.loading}
            onClick={() => void this.loadPage(this.state.pageNo + 1)}
            className="btn btn-default btn-sm">
            <i className="fa fa-chevron-right" aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  render() {
    if (this.state.loading && !this.state.result) {
      return <div style={{ padding: '56px', textAlign: 'center' }}>正在执行查询...</div>
    }
    if (this.state.error) {
      return (
        <div className="alert alert-danger" role="alert">
          {this.state.error}
        </div>
      )
    }
    return (
      <div>
        {this.renderDiagnostics()}
        {this.renderTable()}
        {this.renderPagination()}
      </div>
    )
  }
}

Renderer({
  type: 'dataset-preview',
  autoVar: true,
})(DatasetPreview as any)

export default DatasetPreview
