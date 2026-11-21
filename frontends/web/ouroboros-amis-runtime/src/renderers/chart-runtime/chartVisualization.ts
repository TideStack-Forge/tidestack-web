export type ChartExecutionResponse = {
  chartType: string
  option: Record<string, any>
}

export function buildChartVisualizationSchema(response: ChartExecutionResponse) {
  if (!response?.option || typeof response.option !== 'object') {
    return {
      type: 'alert',
      level: 'warning',
      body: '图表配置不可用',
    }
  }
  return {
    type: 'chart',
    config: response.option,
  }
}
