import type { WidgetDefinition } from '../common'

export const chartWidgetDefinition: WidgetDefinition = {
  name: 'chart',
  title: '图表',
  description: '显示图表定义',
  category: '统计报表',
  allowHeader: true,
  allowFooter: false,
  sizeConstraints: {
    min: { rows: 6, cols: 6 },
    max: { rows: 24, cols: 24 },
  },
  defaultSize: { rows: 10, cols: 12 },
  defaultConfig: {
    title: '图表',
    showHeader: true,
  },
  thumbSchema: {
    type: 'container',
    className: 'statistics-chart-widget-thumb',
    body: [
      {
        type: 'tpl',
        tpl: '<div class="statistics-chart-widget-thumb__icon"><i class="fa fa-bar-chart"></i></div>',
      },
      {
        type: 'tpl',
        tpl: '<div class="statistics-chart-widget-thumb__title">图表</div>',
      },
      {
        type: 'tpl',
        tpl: '<div class="statistics-chart-widget-thumb__description">选择图表后显示数据</div>',
      },
    ],
  },
  configFormItems: [
    {
      type: 'select',
      name: 'chartName',
      label: '图表名称',
      required: true,
      searchable: true,
      source: '/api/dev/${appName}/chart/options',
      description: '选择要显示的图表',
    },
  ],
  schemaTpl: {
    type: 'chart-runtime',
    chartName: '#{chartName}',
  },
  configDialogSize: 'md',
}

export const chartWidgetDefinitions: WidgetDefinition[] = [chartWidgetDefinition]
