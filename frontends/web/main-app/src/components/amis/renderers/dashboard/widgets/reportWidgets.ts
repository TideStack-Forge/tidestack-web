import type { WidgetDefinition } from '../common'

export const reportViewWidgetDefinition: WidgetDefinition = {
  name: 'report-view',
  title: '报表视图',
  description: '显示统计报表图表（柱状图、折线图、饼图等）',
  category: '统计报表',
  allowHeader: true,
  allowFooter: false,
  sizeConstraints: {
    min: { rows: 6, cols: 6 },
    max: { rows: 24, cols: 24 },
  },
  defaultSize: { rows: 10, cols: 12 },
  defaultConfig: {
    title: '报表视图',
    showHeader: true,
  },
  configFormItems: [
    {
      type: 'select',
      name: 'viewName',
      label: 'Report View 名称',
      required: true,
      searchable: true,
      source: '/api/dev/${appName}/statistics-reporting/report-views/options',
      description: '关联的 Report View 定义名称',
    },
    {
      type: 'input-text',
      name: 'title',
      label: '标题',
      description: '显示在 Widget 顶部的标题',
    },
    {
      type: 'switch',
      name: 'showHeader',
      label: '显示标题栏',
      value: true,
    },
  ],
  schemaTpl: {
    type: 'report-view-runtime',
    viewName: '#{viewName}',
  },
  configDialogSize: 'md',
}

export const queryViewWidgetDefinition: WidgetDefinition = {
  name: 'query-view',
  title: '查询视图',
  description: '显示数据列表查询表格',
  category: '统计报表',
  allowHeader: true,
  allowFooter: false,
  sizeConstraints: {
    min: { rows: 8, cols: 8 },
    max: { rows: 24, cols: 24 },
  },
  defaultSize: { rows: 12, cols: 12 },
  defaultConfig: {
    title: '查询视图',
    showHeader: true,
  },
  configFormItems: [
    {
      type: 'input-text',
      name: 'viewName',
      label: 'Query View 名称',
      required: true,
      description: '关联的 Query View 定义名称',
    },
    {
      type: 'input-text',
      name: 'title',
      label: '标题',
      description: '显示在 Widget 顶部的标题',
    },
    {
      type: 'switch',
      name: 'showHeader',
      label: '显示标题栏',
      value: true,
    },
  ],
  schemaTpl: {
    type: 'crud',
    api: '/api/runtime/statistics-reporting/query-views/#{viewName}/execute',
    syncLocation: false,
    columns: '#{columns}',
  },
  configDialogSize: 'md',
}

export const reportWidgetDefinitions: WidgetDefinition[] = [
  reportViewWidgetDefinition,
]
