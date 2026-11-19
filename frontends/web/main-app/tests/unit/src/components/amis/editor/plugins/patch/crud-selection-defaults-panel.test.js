const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const { mainAppRoot } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

function loadCrudPluginModule() {
  const filePath = path.join(
    mainAppRoot,
    '../ouroboros-amis-runtime/src/editor/plugins/patch/CRUD.ts'
  )
  const source = fs.readFileSync(filePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
  })

  let registeredPlugin = null

  class MockCRUDPlugin {}

  const module = { exports: {} }
  const sourceRequire = Module.createRequire(filePath)
  const localRequire = (request) => request.startsWith('.') ? sourceRequire(request) : require(request)
  const mockedRequire = (request) => {
    if (request === 'amis-editor') {
      return {
        CRUDPlugin: MockCRUDPlugin,
        registerEditorPlugin: (pluginClass) => {
          registeredPlugin = pluginClass
        },
      }
    }

    if (request === 'amis-editor-core') {
      return {}
    }

    return localRequire(request)
  }

  const context = vm.createContext({
    module,
    exports: module.exports,
    require: mockedRequire,
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console,
  })

  new vm.Script(transpiled.outputText, { filename: filePath }).runInContext(
    context
  )

  return {
    registeredPlugin,
    OuroborosCRUDPlugin: module.exports.OuroborosCRUDPlugin,
  }
}

function buildPanelBody() {
  return [
    {
      type: 'tabs',
      tabs: [
        {
          title: '属性',
          body: [],
        },
        {
          title: '功能',
          body: [
            {
              type: 'collapse-group',
              body: [
                {
                  title: '选择',
                  body: [
                    {
                      name: 'selectable',
                      type: 'switch',
                    },
                    {
                      name: 'checkOnItemClick',
                      type: 'switch',
                      visibleOn:
                        'this.bulkActions && this.bulkActions.length || this.pickerMode',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ]
}

function findControlByName(node, controlName) {
  if (Array.isArray(node)) {
    for (const item of node) {
      const match = findControlByName(item, controlName)
      if (match) {
        return match
      }
    }
    return null
  }

  if (!node || typeof node !== 'object') {
    return null
  }

  if (node.name === controlName) {
    return node
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value) || (value && typeof value === 'object')) {
      const match = findControlByName(value, controlName)
      if (match) {
        return match
      }
    }
  }

  return null
}

test('OuroborosCRUDPlugin mirrors checkOnItemClick defaults for effective selectable CRUD', () => {
  const { registeredPlugin, OuroborosCRUDPlugin } = loadCrudPluginModule()

  assert.equal(registeredPlugin, OuroborosCRUDPlugin)

  const plugin = new OuroborosCRUDPlugin()
  const event = {
    context: {
      plugin,
      data: buildPanelBody(),
    },
    setData(nextValue) {
      this.context.data = nextValue
    },
  }

  plugin.afterBuildPanelBody(event)

  const control = findControlByName(event.context.data, 'checkOnItemClick')

  assert.ok(control)
  assert.equal(
    control.visibleOn,
    'this.selectable || this.bulkActions && this.bulkActions.length || this.pickerMode'
  )
  assert.equal(control.pipeIn(undefined, { selectable: true }), true)
  assert.equal(control.pipeIn(undefined, { selectable: false }), false)
  assert.equal(
    control.pipeIn(undefined, {
      selectable: false,
      bulkActions: [{ type: 'button' }],
      headerToolbar: ['bulkActions'],
    }),
    true
  )
  assert.equal(
    control.pipeIn(undefined, {
      selectable: false,
      bulkActions: [{ type: 'button' }],
    }),
    false
  )
  assert.equal(control.pipeOut(true, undefined, { selectable: true }), undefined)
  assert.equal(control.pipeOut(false, undefined, { selectable: true }), false)
  assert.equal(control.pipeOut(true, undefined, { selectable: false }), true)
  assert.equal(
    control.pipeOut(true, undefined, {
      selectable: false,
      bulkActions: [{ type: 'button' }],
      headerToolbar: ['bulkActions'],
    }),
    undefined
  )
})

test('OuroborosCRUDPlugin ignores foreign plugin events', () => {
  const { OuroborosCRUDPlugin } = loadCrudPluginModule()

  const plugin = new OuroborosCRUDPlugin()
  let setDataCalled = false

  plugin.afterBuildPanelBody({
    context: {
      plugin: {},
      data: buildPanelBody(),
    },
    setData() {
      setDataCalled = true
    },
  })

  assert.equal(setDataCalled, false)
})
