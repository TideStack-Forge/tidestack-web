import React from 'react'
import { Renderer, buildApi, dataMapping } from 'amis'

import { buildChartVisualizationSchema } from './chartVisualization'

const LOADING_SCHEMA = {
  type: 'spinner',
  show: true,
  icon: 'fa fa-spinner',
  size: 'lg',
  tip: '加载中...',
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
    body: message || '无权限预览当前图表',
  }
}

type ChartRuntimeProps = {
  chartName?: string
  api?: any
  env: {
    fetcher: (api: any, data?: any) => Promise<any>
  }
  data?: Record<string, any>
  render: (region: string, schema: any, props?: Record<string, any>) => React.ReactNode
}

type ChartRuntimeState = {
  schema: any
  schemaKey: number
}

function unwrapFetcherResult(result: any) {
  return result?.data &&
    typeof result.data === 'object' &&
    Object.prototype.hasOwnProperty.call(result.data, 'status')
    ? result.data
    : result
}

function buildApiSignature(api: any, data: Record<string, any>) {
  if (!api) {
    return ''
  }
  const resolvedApi = buildApi(
    typeof api === 'string' ? dataMapping(api, data) : api,
    data
  )
  return JSON.stringify({
    data: resolvedApi.data || {},
    method: resolvedApi.method || 'get',
    url: resolvedApi.url,
  })
}

class ChartRuntime extends React.Component<ChartRuntimeProps, ChartRuntimeState> {
  state: ChartRuntimeState = {
    schema: LOADING_SCHEMA,
    schemaKey: 0,
  }
  private lastRequestSignature = ''
  private requestSequence = 0

  componentDidMount() {
    void this.loadChart()
  }

  componentDidUpdate(prevProps: ChartRuntimeProps) {
    const previousSignature = this.buildRequestSignature(prevProps)
    const currentSignature = this.buildRequestSignature(this.props)
    if (previousSignature !== currentSignature) {
      void this.loadChart()
    }
  }

  componentWillUnmount() {
    this.requestSequence += 1
  }

  buildRequestSignature(props: ChartRuntimeProps) {
    return props.chartName + '|' + buildApiSignature(props.api, props.data || {})
  }

  async loadChart() {
    const { api, data = {}, env, chartName } = this.props
    if (!chartName && !api) {
      this.setState({ schema: getErrorSchema('尚未选择图表') })
      return
    }

    const requestSignature = this.buildRequestSignature(this.props)
    if (
      requestSignature === this.lastRequestSignature &&
      this.state.schema !== LOADING_SCHEMA
    ) {
      return
    }
    this.lastRequestSignature = requestSignature
    const requestSequence = ++this.requestSequence
    this.setState((state) => ({ schema: LOADING_SCHEMA, schemaKey: state.schemaKey + 1 }))

    try {
      const resolvedApi = api
        ? buildApi(typeof api === 'string' ? dataMapping(api, data) : api, data)
        : {
            method: 'post',
            url: `/api/runtime/statistics-reporting/charts/${chartName}/execute`,
            data: {},
          }
      const result = await env.fetcher(resolvedApi, resolvedApi.data || {})
      if (requestSequence !== this.requestSequence) {
        return
      }
      const payload = unwrapFetcherResult(result)
      if (
        payload?.status === 401 ||
        payload?.status === 403 ||
        payload?.code === 401 ||
        payload?.code === 403
      ) {
        this.setState((state) => ({
          schema: getUnauthorizedSchema(payload?.msg),
          schemaKey: state.schemaKey + 1,
        }))
        return
      }
      if (payload?.status !== 0) {
        throw new Error(payload?.msg || '图表加载失败')
      }

      const schema = buildChartVisualizationSchema(payload?.data)
      this.setState((state) => ({ schema, schemaKey: state.schemaKey + 1 }))
    } catch (error) {
      if (requestSequence !== this.requestSequence) {
        return
      }
      this.setState((state) => ({
        schema: getErrorSchema(error instanceof Error ? error.message : String(error)),
        schemaKey: state.schemaKey + 1,
      }))
    }
  }

  retry = () => {
    this.lastRequestSignature = ''
    return this.loadChart()
  }

  render() {
    const content = this.props.render(
      `chart-runtime-body-${this.state.schemaKey}`,
      this.state.schema,
      {
        data: this.props.data,
      }
    )
    return <div className="statistics-chart-runtime" style={{ width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>{content}{this.state.schema?.type === 'alert' ? (
      <button type="button" className="btn btn-default" onClick={this.retry}>重试</button>
    ) : null}</div>
  }
}

Renderer({
  type: 'chart-runtime',
  autoVar: true,
})(ChartRuntime as any)

export default ChartRuntime
