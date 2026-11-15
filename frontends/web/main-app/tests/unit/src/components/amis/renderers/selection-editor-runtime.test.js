const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const Module = require('node:module')
const ts = require('typescript')
require('amis-core/lib/utils/filter')
const { dataMapping } = require('amis-core/lib/utils/dataMapping')
const { mainAppRoot } = require('../../../../helpers/mainAppTestKit')

function loadModule(filePath) {
  const module = { exports: {} }
  const localRequire = Module.createRequire(filePath)
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (request) => {
      if (request === 'amis') {
        return { dataMapping, FormItem: () => () => undefined }
      }
      if (request === '@/utils/Deferred') {
        return loadModule(path.join(mainAppRoot, 'src/utils/Deferred.ts'))
      }
      if (request.endsWith('.scss')) return undefined
      return localRequire(request)
    },
  })
  const output = ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: filePath,
  }).outputText
  new vm.Script(output, { filename: filePath }).runInContext(context)
  return module.exports
}

const { default: SelectionEditor } = loadModule(
  path.join(mainAppRoot, 'src/components/amis/renderers/SelectionEditor.tsx')
)
const repoRoot = path.resolve(mainAppRoot, '../../..')
const roleSchemas = [
  'security/ouroboros-web-security/ouroboros-web-security-rbac-manage/src/main/metadata/system-setting/role-management/edit.ui-schema.json',
  'security/ouroboros-web-security/ouroboros-web-security-rbac-manage/src/main/metadata/system-setting/role-management/view.ui-schema.json',
  'dev-module/ouroboros-dev-app-management/src/main/metadata/dev/{appName}/builtin-role/add.ui-schema.json',
  'dev-module/ouroboros-dev-app-management/src/main/metadata/dev/{appName}/builtin-role/edit.ui-schema.json',
]

async function selectItem(selectedData, item) {
  let selected
  const editor = new SelectionEditor({
    primaryField: 'fullName',
    selectedData,
    onChange: (value) => {
      selected = value
    },
  })
  await editor.handleSelect([item])
  return selected
}

test('selection editor preserves an explicitly mapped empty string', async () => {
  const selected = await selectItem(
    { fullName: '$fullName', accessControlParams: '' },
    { fullName: 'example.item' }
  )
  assert.equal(selected[0].accessControlParams, '')
})

test.each(roleSchemas)(
  'role schema generates object params and preserves configured values: %s',
  async (schemaPath) => {
    const { schema } = JSON.parse(
      fs.readFileSync(path.join(repoRoot, schemaPath), 'utf8')
    )
    const editor = schema.body.find((item) => item.type === 'selection-editor')
    const params = { allowedFields: ['name'], filters: { department: ['D1'] } }
    const candidates = [
      { fullName: 'workflow.approve' },
      { fullName: 'workflow.approve', accessControlParams: null },
      { fullName: 'workflow.approve', accessControlParams: '' },
      { fullName: 'workflow.approve', accessControlParams: params },
    ]
    for (const candidate of candidates) {
      const selected = await selectItem(editor.selectedData, candidate)
      const payload = dataMapping(schema.api.data, { authorities: selected })
      const authorities = Array.isArray(payload) ? payload : payload.authorities
      assert.deepEqual(JSON.parse(JSON.stringify(authorities)), [
        {
          authority: 'workflow.approve',
          accessControlParams: candidate.accessControlParams || {},
        },
      ])
    }
  }
)
