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

function loadReportWidgetsModule() {
  const filePath = path.join(
    mainAppRoot,
    '../ouroboros-amis-runtime/src/renderers/dashboard/widgets/reportWidgets.ts'
  )
  const module = { exports: {} }
  const sourceRequire = Module.createRequire(filePath)
  const localRequire = (request) => request.startsWith('.') ? sourceRequire(request) : require(request)
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

test('report-view widget uses select options and query-view is not offered for new dashboard widgets', () => {
  const {
    reportViewWidgetDefinition,
    queryViewWidgetDefinition,
    reportWidgetDefinitions,
  } = loadReportWidgetsModule()

  const viewNameItem = reportViewWidgetDefinition.configFormItems.find(
    (item) => item.name === 'viewName'
  )

  assert.equal(viewNameItem.type, 'select')
  assert.equal(viewNameItem.source, '/api/dev/${appName}/statistics-reporting/report-views/options')
  assert.equal(viewNameItem.searchable, true)
  assert.equal(queryViewWidgetDefinition.name, 'query-view')
  assert.equal(
    reportWidgetDefinitions.map((definition) => definition.name).join(','),
    'report-view'
  )
})
