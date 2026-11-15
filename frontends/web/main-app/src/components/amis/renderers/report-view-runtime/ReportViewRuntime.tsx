import React from 'react'
import { Renderer, buildApi, dataMapping } from 'amis'

import {
  buildReportDataTableSchema,
  buildReportVisualizationSchema,
} from './reportViewVisualization'

const LOADING_SCHEMA = {
  type: 'spinner',
  show: true,
  icon: 'fa fa-spinner',
  size: 'lg',
  tip: '加载中...',
}

const EMPTY_SCHEMA = {
  type: 'alert',
  level: 'info',
  showIcon: true,
  body: '暂无可预览数据',
}

function getErrorSchema(message: string) {
  return {
    type: 'alert',
    level: 'danger',
    showIcon: true,
    body: message,
  }
}

function getUnauthorizedSchema(message?: string) {
  return {
    type: 'alert',
    level: 'warning',
    showIcon: true,
    body: message || '无权限预览当前 report view',
  }
}

function hasPreviewRows(projection: any) {
  const rows = Array.isArray(projection?.rows) ? projection.rows : []
  const cards = Array.isArray(projection?.cards) ? projection.cards : []
  return rows.length > 0 || cards.length > 0
}

type ReportViewRuntimeProps = {
  viewName?: string
  api?: any
  mode?: 'visualization' | 'table'
  env: {
    fetcher: (api: any, data?: any) => Promise<any>
  }
  data?: Record<string, any>
  render: (region: string, schema: any, props?: Record<string, any>) => React.ReactNode
}

type ReportViewRuntimeState = {
  schema: any
  schemaKey: number
}

function unwrapFetcherResult(result: any) {
  return result?.data && typeof result.data === 'object' && Object.prototype.hasOwnProperty.call(result.data, 'status')
    ? result.data
    : result
}

function buildApiSignature(api: any, data: Record<string, any>) {
  if (!api) {
    return ''
  }
  const resolvedApi = buildApi(typeof api === 'string' ? dataMapping(api, data) : api, data)
  return JSON.stringify({
    data: resolvedApi.data || {},
    method: resolvedApi.method || 'get',
    url: resolvedApi.url,
  })
}

class ReportViewRuntime extends React.Component<ReportViewRuntimeProps, ReportViewRuntimeState> {
  state: ReportViewRuntimeState = {
    schema: LOADING_SCHEMA,
    schemaKey: 0,
  }
  private lastRequestSignature = ''

  componentDidMount() {
    void this.loadProjection()
  }

  componentDidUpdate(prevProps: ReportViewRuntimeProps) {
    const previousSignature = this.buildRequestSignature(prevProps)
    const currentSignature = this.buildRequestSignature(this.props)
    if (
      previousSignature !== currentSignature ||
      prevProps.mode !== this.props.mode
    ) {
      void this.loadProjection()
    }
  }

  buildRequestSignature(props: ReportViewRuntimeProps) {
    return props.viewName + '|' + buildApiSignature(props.api, props.data || {})
  }

  async loadProjection() {
    const { api, data = {}, env, mode = 'visualization', viewName } = this.props
    if (!viewName && !api) {
      this.setState({ schema: getErrorSchema('缺少 report view 标识') })
      return
    }

    const requestSignature = this.buildRequestSignature(this.props)
    if (requestSignature === this.lastRequestSignature && this.state.schema !== LOADING_SCHEMA) {
      return
    }
    this.lastRequestSignature = requestSignature

    if (this.state.schema === LOADING_SCHEMA) {
      this.setState((state) => ({ schema: LOADING_SCHEMA, schemaKey: state.schemaKey + 1 }))
    }

    try {
      const resolvedApi = api
        ? buildApi(typeof api === 'string' ? dataMapping(api, data) : api, data)
        : {
            method: 'post',
            url: `/api/runtime/statistics-reporting/report-views/${viewName}/execute`,
            data: {},
          }
      const result = await env.fetcher(resolvedApi, resolvedApi.data || {})
      if (requestSignature !== this.lastRequestSignature) {
        return
      }
      const payload = unwrapFetcherResult(result)
      if (payload?.status === 401 || payload?.status === 403 || payload?.code === 401 || payload?.code === 403) {
        this.setState((state) => ({
          schema: getUnauthorizedSchema(payload?.msg),
          schemaKey: state.schemaKey + 1,
        }))
        return
      }
      if (payload?.status !== 0) {
        throw new Error(payload?.msg || 'report view request failed')
      }

      const datasetResult = payload?.data || {}
      const projection = datasetResult?.projection || datasetResult
      if (!hasPreviewRows(projection)) {
        this.setState((state) => ({ schema: EMPTY_SCHEMA, schemaKey: state.schemaKey + 1 }))
        return
      }
      const schema =
        mode === 'table'
          ? buildReportDataTableSchema(projection)
          : buildReportVisualizationSchema(projection)
      this.setState((state) => ({ schema, schemaKey: state.schemaKey + 1 }))
    } catch (error) {
      if (requestSignature !== this.lastRequestSignature) {
        return
      }
      this.setState((state) => ({
        schema: getErrorSchema(error instanceof Error ? error.message : String(error)),
        schemaKey: state.schemaKey + 1,
      }))
    }
  }

  render() {
    return this.props.render(`report-view-runtime-body-${this.state.schemaKey}`, this.state.schema, {
      data: this.props.data,
    })
  }
}

Renderer({
  type: 'report-view-runtime',
  autoVar: true,
})(ReportViewRuntime as any)

export default ReportViewRuntime
