const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const { mainAppRoot } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

function createPanelBody() {
  return [
    {
      type: 'tabs',
      tabs: [
        {
          title: '属性',
          body: [
            {
              type: 'collapse-group',
              body: [
                {
                  title: '基础',
                  body: [{ type: 'ae-switch-more', name: 'needConfirm' }],
                },
              ],
            },
          ],
        },
        {
          title: '外观',
          body: [
            {
              type: 'collapse-group',
              body: [
                {
                  title: '常规',
                  body: [{ type: 'switch', name: 'showFooterAddBtn' }],
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
    const match = findControlByName(value, controlName)
    if (match) {
      return match
    }
  }

  return null
}

function loadInputTablePluginModule() {
  const filePath = path.join(
    mainAppRoot,
    '../ouroboros-amis-runtime/src/editor/plugins/patch/InputTable.ts'
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

  class MockTableControlPlugin {
    constructor() {
      this.panelBodyCreator = () => createPanelBody()
    }
  }

  const module = { exports: {} }
  const sourceRequire = Module.createRequire(filePath)
  const localRequire = (request) => request.startsWith('.') ? sourceRequire(request) : require(request)
  const mockedRequire = (request) => {
    if (request === 'amis-editor') {
      return {
        TableControlPlugin: MockTableControlPlugin,
        registerEditorPlugin: (pluginClass) => {
          registeredPlugin = pluginClass
        },
      }
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

  new vm.Script(transpiled.outputText, { filename: filePath }).runInContext(context)

  return {
    registeredPlugin,
    ...module.exports,
  }
}

test('OuroborosInputTablePlugin appends editor controls for runtime enhancements', () => {
  const { registeredPlugin, OuroborosInputTablePlugin } = loadInputTablePluginModule()

  assert.equal(registeredPlugin, OuroborosInputTablePlugin)

  const plugin = new OuroborosInputTablePlugin()
  const panelBody = plugin.panelBodyCreator({ schema: { type: 'input-table' } })

  assert.equal(findControlByName(panelBody, 'needConfirm').type, 'ae-switch-more')
  assert.equal(findControlByName(panelBody, 'addMode').type, 'button-group-select')
  assert.equal(findControlByName(panelBody, 'editMode').type, 'button-group-select')
  assert.equal(
    findControlByName(panelBody, 'addButtonPosition').type,
    'button-group-select'
  )
  assert.equal(findControlByName(panelBody, 'operationButtons').type, 'combo')
  assert.equal(findControlByName(panelBody, 'addingOperationButtons').type, 'combo')
  assert.equal(findControlByName(panelBody, 'editingOperationButtons').type, 'combo')
  assert.equal(findControlByName(panelBody, 'arrowRowNavigation').type, 'combo')
  assert.equal(findControlByName(panelBody, 'rowAggregate').type, 'combo')
  assert.equal(findControlByName(panelBody, 'lazyRenderAfter').type, 'input-number')
  assert.equal(findControlByName(panelBody, 'loadingMaxDuration').type, 'input-number')
})

test('input-table enhancement panel injection is idempotent and preserves defaults', () => {
  const { injectInputTableEnhancementPanel } = loadInputTablePluginModule()

  const panelBody = createPanelBody()
  injectInputTableEnhancementPanel(panelBody)
  injectInputTableEnhancementPanel(panelBody)

  const propertyPanels = panelBody[0].tabs[0].body[0].body
  const enhancementPanels = propertyPanels.filter(
    (item) => item.title === 'Ouroboros 增强'
  )

  assert.equal(enhancementPanels.length, 1)

  const addMode = findControlByName(panelBody, 'addMode')
  const addButtonPosition = findControlByName(panelBody, 'addButtonPosition')
  const operationButtons = findControlByName(panelBody, 'operationButtons')
  const rowAggregate = findControlByName(panelBody, 'rowAggregate')

  assert.equal(addMode.pipeIn(undefined), 'inline')
  assert.equal(addButtonPosition.pipeIn(undefined), 'bottom-left')
  assert.equal(operationButtons.scaffold.actionType, 'edit')
  assert.equal(
    operationButtons.items.some((item) => item.name === 'visibleOn'),
    true
  )
  assert.equal(
    rowAggregate.items.some((item) => item.name === 'keyPaths'),
    true
  )
  assert.equal(
    rowAggregate.items.some((item) => item.name === 'sourcesPaths'),
    true
  )
})
