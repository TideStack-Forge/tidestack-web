const assert = require('node:assert/strict')
const Module = require('node:module')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const { mainAppRoot, registerTypescriptRequire } = require(
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
                  body: [{ type: 'input-text', name: 'title' }],
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
                  title: '尺寸',
                  body: [{ type: 'button-group-select', name: 'size' }],
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

function loadDialogPluginModule() {
  const filePath = path.join(
    mainAppRoot,
    'src/components/amis/editor/plugins/OuroborosDialog.tsx'
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

  class MockDialogPlugin {
    constructor() {
      this.regions = [
        {
          key: 'body',
          renderMethod: 'renderBody',
        },
        {
          key: 'actions',
          renderMethod: 'renderFooter',
        },
      ]
      this.panelBodyCreator = () => createPanelBody()
    }
  }

  const module = { exports: {} }
  const localRequire = Module.createRequire(filePath)
  const mockedRequire = (request) => {
    if (request === 'amis-editor') {
      return {
        DialogPlugin: MockDialogPlugin,
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

  const unregisterTypescript = registerTypescriptRequire()
  try {
    new vm.Script(transpiled.outputText, { filename: filePath }).runInContext(context)
  } finally {
    unregisterTypescript?.()
  }

  return {
    registeredPlugin,
    ...module.exports,
  }
}

test('OuroborosDialogPlugin keeps inherited panels and appends dialog extension panels', () => {
  const { registeredPlugin, OuroborosDialogPlugin } = loadDialogPluginModule()

  assert.equal(registeredPlugin, OuroborosDialogPlugin)

  const plugin = new OuroborosDialogPlugin()
  const panelBody = plugin.panelBodyCreator({ schema: { type: 'dialog' } })

  const title = findControlByName(panelBody, 'title')
  const url = findControlByName(panelBody, 'url')
  const schemaId = findControlByName(panelBody, 'schemaId')
  const updateActions = findControlByName(panelBody, 'updateActions')
  const sizeSwitchable = findControlByName(panelBody, 'sizeSwitchable')
  const sizeOptions = findControlByName(panelBody, 'sizeOptions')
  const resizable = findControlByName(panelBody, 'resizable')

  assert.equal(title.type, 'input-text')
  assert.equal(url.type, 'input-text')
  assert.equal(schemaId.type, 'input-text')
  assert.equal(updateActions.type, 'switch')
  assert.equal(sizeSwitchable.type, 'switch')
  assert.equal(sizeOptions.type, 'select')
  assert.equal(sizeOptions.multiple, true)
  assert.equal(resizable.type, 'switch')
})

test('dialog editor panel injection is idempotent and skips confirm dialogs', () => {
  const { injectDialogEditorPanels, OuroborosDialogPlugin } = loadDialogPluginModule()

  const panelBody = createPanelBody()
  injectDialogEditorPanels(panelBody)
  injectDialogEditorPanels(panelBody)

  const resizePanels = panelBody[0].tabs[1].body[0].body.filter(
    (item) => item.title === '尺寸调整'
  )
  const referencePanels = panelBody[0].tabs[0].body[0].body.filter(
    (item) => item.title === '引用页面'
  )
  assert.equal(resizePanels.length, 1)
  assert.equal(referencePanels.length, 1)

  const plugin = new OuroborosDialogPlugin()
  const confirmPanelBody = plugin.panelBodyCreator({
    schema: { type: 'dialog', dialogType: 'confirm' },
  })

  assert.equal(findControlByName(confirmPanelBody, 'sizeSwitchable'), null)
  assert.equal(findControlByName(confirmPanelBody, 'schemaId'), null)
})

test('dialog body region stays editable for inline content and is hidden for referenced pages', () => {
  const { OuroborosDialogPlugin, isReferencedDialogSchema } = loadDialogPluginModule()

  assert.equal(isReferencedDialogSchema({ url: '/dev/app/detail' }), true)
  assert.equal(isReferencedDialogSchema({ schemaId: '/dev/app/detail' }), true)
  assert.equal(isReferencedDialogSchema({ url: '  ', body: [] }), false)

  const plugin = new OuroborosDialogPlugin()
  const bodyRegion = plugin.regions.find((region) => region.key === 'body')
  const actionsRegion = plugin.regions.find((region) => region.key === 'actions')
  const insertCalls = []
  const render = bodyRegion.renderMethodOverride(['body'], (...args) => {
    insertCalls.push(args)
    return 'inserted-body'
  })

  function createRenderer(schema) {
    return {
      props: {
        $$editor: {
          schema,
          plugin: { manager: 'manager' },
        },
      },
      super: () => 'body-dom',
    }
  }

  assert.equal(actionsRegion.renderMethod, 'renderFooter')
  const inlineRenderer = createRenderer({ body: [] })
  assert.equal(render.call(inlineRenderer, {}, 'body'), 'inserted-body')
  assert.equal(insertCalls.length, 1)
  assert.equal(insertCalls[0][0], inlineRenderer)
  assert.equal(insertCalls[0][1], 'body-dom')
  assert.deepEqual(insertCalls[0][2], ['body'])
  assert.deepEqual(insertCalls[0][3].schema, { body: [] })
  assert.equal(insertCalls[0][4], 'manager')

  insertCalls.splice(0, insertCalls.length)
  assert.equal(
    render.call(createRenderer({ url: '/dev/app/detail' }), {}, 'body'),
    'body-dom'
  )
  assert.equal(
    render.call(createRenderer({ schemaId: '/dev/app/detail' }), {}, 'body'),
    'body-dom'
  )
  assert.equal(render.call(createRenderer({ body: [] }), {}, 'header'), 'body-dom')
  assert.equal(insertCalls.length, 0)
})
