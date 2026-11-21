const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const Module = require('node:module')
const ts = require('typescript')

const { mainAppRoot } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

function transpileFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8')
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
    fileName: filePath,
  }).outputText
}

function loadChartWidgetsModule() {
  const filePath = path.join(
    mainAppRoot,
    '../ouroboros-amis-runtime/src/renderers/dashboard/widgets/chartWidgets.ts'
  )
  const module = { exports: {} }
  const localRequire = Module.createRequire(filePath)
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (request) => localRequire(request),
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console,
  })

  new vm.Script(transpileFile(filePath), { filename: filePath }).runInContext(context)
  return module.exports
}

test('chart widget uses select options and is the only new dashboard widget', () => {
  const { chartWidgetDefinition, chartWidgetDefinitions } = loadChartWidgetsModule()

  const chartNameItem = chartWidgetDefinition.configFormItems.find(
    (item) => item.name === 'chartName'
  )

  assert.equal(chartNameItem.type, 'select')
  assert.equal(chartNameItem.source, '/api/dev/${appName}/chart/options')
  assert.equal(chartNameItem.searchable, true)
  assert.equal(chartNameItem.description, '选择要显示的图表')
  assert.equal(
    chartWidgetDefinition.thumbSchema.body[2].tpl,
    '<div class="statistics-chart-widget-thumb__description">选择图表后显示数据</div>'
  )
  assert.equal(
    chartWidgetDefinitions.map((definition) => definition.name).join(','),
    'chart'
  )
})
