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
                  body: [{ type: 'button-group-select', name: 'position' }],
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

function loadDrawerPluginModule() {
  const filePath = path.join(
    mainAppRoot,
    '../ouroboros-amis-runtime/src/editor/plugins/OuroborosDrawer.tsx'
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

  class MockDrawerPlugin {
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
  const sourceRequire = Module.createRequire(filePath)
  const localRequire = (request) => request.startsWith('.') ? sourceRequire(request) : require(request)
  const mockedRequire = (request) => {
    if (request === 'amis-editor') {
      return {
        DrawerPlugin: MockDrawerPlugin,
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

test('OuroborosDrawerPlugin appends the shared modal reference panel', () => {
  const { registeredPlugin, OuroborosDrawerPlugin } = loadDrawerPluginModule()

  assert.equal(registeredPlugin, OuroborosDrawerPlugin)

  const plugin = new OuroborosDrawerPlugin()
  const panelBody = plugin.panelBodyCreator({ schema: { type: 'drawer' } })

  assert.equal(findControlByName(panelBody, 'title').type, 'input-text')
  assert.equal(findControlByName(panelBody, 'url').type, 'input-text')
  assert.equal(findControlByName(panelBody, 'schemaId').type, 'input-text')
  assert.equal(findControlByName(panelBody, 'updateActions').type, 'switch')
  assert.equal(findControlByName(panelBody, 'sizeSwitchable'), null)
  assert.equal(findControlByName(panelBody, 'resizable'), null)
})

test('drawer body region stays editable for inline content and is hidden for referenced pages', () => {
  const { OuroborosDrawerPlugin } = loadDrawerPluginModule()

  const plugin = new OuroborosDrawerPlugin()
  const bodyRegion = plugin.regions.find((region) => region.key === 'body')
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

  assert.equal(render.call(createRenderer({ body: [] }), {}, 'body'), 'inserted-body')
  assert.equal(insertCalls.length, 1)

  insertCalls.splice(0, insertCalls.length)
  assert.equal(
    render.call(createRenderer({ url: '/dev/app/detail' }), {}, 'body'),
    'body-dom'
  )
  assert.equal(
    render.call(createRenderer({ schemaId: '/dev/app/detail' }), {}, 'body'),
    'body-dom'
  )
  assert.equal(insertCalls.length, 0)
})
