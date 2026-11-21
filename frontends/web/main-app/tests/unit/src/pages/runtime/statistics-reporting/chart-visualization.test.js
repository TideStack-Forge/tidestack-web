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
    '../../../components/amis/renderers/chart-runtime'
  )
  return requireMirroredSrcModule(
    __filename,
    '../../../components/amis/renderers/chart-runtime/chartVisualization.ts'
  )
}

test('chart visualization should pass backend ECharts option to AMIS unchanged', () => {
  const { buildChartVisualizationSchema } = loadModule()
  const option = {
    title: { text: 'Sales trend' },
    xAxis: { type: 'category', data: ['2026-01-01', '2026-01-02'] },
    yAxis: { type: 'value' },
    series: [{ type: 'line', data: [15, 7] }],
  }

  const schema = buildChartVisualizationSchema({
    chartType: 'line',
    option,
  })

  assert.equal(schema.type, 'chart')
  assert.equal(schema.config, option)
})

test('chart visualization should report a missing backend option', () => {
  const { buildChartVisualizationSchema } = loadModule()

  const schema = buildChartVisualizationSchema({ chartType: 'line' })

  assert.deepEqual(schema, {
    type: 'alert',
    level: 'warning',
    body: '图表配置不可用',
  })
})
