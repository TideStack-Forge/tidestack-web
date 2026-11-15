const assert = require('node:assert/strict')
const path = require('node:path')
const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadModule() {
  clearMirroredSrcModuleCache(
    __filename,
    '../../../components/amis/renderers/report-view-runtime'
  )
  return requireMirroredSrcModule(
    __filename,
    '../../../components/amis/renderers/report-view-runtime/reportViewVisualization.ts'
  )
}

test('report view visualization should build aggregated line chart schema from runtime projection', () => {
  const { buildReportVisualizationSchema } = loadModule()

  const schema = buildReportVisualizationSchema({
    displayType: 'line',
    dimensionFields: ['productCategory'],
    metricFields: ['salesAmount'],
    timeField: 'orderDate',
    seriesField: 'region',
    displayConfig: {
      titleText: '销售趋势',
      showLegend: true,
      legendPosition: 'bottom',
      smooth: true,
    },
    columns: [
      { name: 'orderDate', title: '下单日期' },
      { name: 'salesAmount', title: '销售额' },
      { name: 'region', title: '区域' },
    ],
    rows: [
      { orderDate: '2026-01-01', salesAmount: 10, region: 'east' },
      { orderDate: '2026-01-01', salesAmount: 5, region: 'east' },
      { orderDate: '2026-01-02', salesAmount: 7, region: 'west' },
    ],
  })

  assert.equal(schema.type, 'chart')
  assert.equal(schema.config.title.text, '销售趋势')
  assert.equal(schema.config.legend.bottom, 0)
  assert.deepEqual(schema.config.xAxis.data, ['2026-01-01', '2026-01-02'])
  assert.deepEqual(schema.config.series[0].data, [15, 0])
  assert.equal(schema.config.series[0].name, 'east')
  assert.equal(schema.config.series[0].smooth, true)
  assert.deepEqual(schema.config.series[1].data, [0, 7])
  assert.equal(schema.config.series[1].name, 'west')
})

test('report view visualization should build metric-card grid from projected cards', () => {
  const { buildReportVisualizationSchema } = loadModule()

  const schema = buildReportVisualizationSchema({
    displayType: 'metric-card',
    cards: [
      { field: 'salesAmount', title: '销售额', value: 128 },
      { field: 'grossProfit', title: '毛利', value: 64 },
    ],
  })

  assert.equal(schema.type, 'grid')
  assert.equal(schema.columns.length, 2)
  assert.equal(schema.columns[0].body[0].body[0].value, '销售额')
  assert.equal(schema.columns[1].body[0].body[1].value, 64)
})

test('report view data table should map crosstab rows into table columns', () => {
  const { buildReportDataTableSchema } = loadModule()

  const schema = buildReportDataTableSchema({
    displayType: 'crosstab',
    rowDimensionField: 'region',
    columnHeaders: ['paid', 'pending'],
    rows: [
      { rowHeader: 'east', cells: [10, 2] },
    ],
    columns: [
      { name: 'region', title: '区域' },
    ],
  })

  assert.equal(schema.type, 'crud')
  assert.deepEqual(
    schema.columns.map((column) => column.name),
    ['rowHeader', 'cells.0', 'cells.1']
  )
  assert.equal(schema.columns[0].label, '区域')
  assert.equal(schema.columns[1].label, 'paid')
  assert.equal(schema.syncLocation, false)
})
