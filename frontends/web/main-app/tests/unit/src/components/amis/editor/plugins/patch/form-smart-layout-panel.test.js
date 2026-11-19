const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const { mainAppRoot } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createPanelBody() {
  return [
    {
      type: 'tabs',
      tabs: [
        {
          title: '外观',
          body: [
            {
              type: 'collapse-group',
              body: [
                {
                  title: '布局',
                  body: [
                    {
                      type: 'input-text',
                      name: 'layoutPlaceholder',
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

function loadPanelModule() {
  const filePath = path.join(
    mainAppRoot,
    '../ouroboros-amis-runtime/src/editor/plugins/patch/formSmartLayoutPanel.ts'
  )
  const source = fs.readFileSync(filePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
  })

  const module = { exports: {} }
  const context = vm.createContext({
    module,
    exports: module.exports,
    require,
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console,
  })

  new vm.Script(transpiled.outputText, { filename: filePath }).runInContext(
    context
  )
  return module.exports
}

function loadFormPluginModule(panelModule) {
  const filePath = path.join(
    mainAppRoot,
    '../ouroboros-amis-runtime/src/editor/plugins/patch/Form.ts'
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

  class MockFormPlugin {
    patchSchema(schema) {
      return {
        ...schema,
        actions: schema.actions || [],
        feat: schema.initApi ? (schema.api ? 'Edit' : 'View') : schema.feat || 'Insert',
      }
    }
  }

  const module = { exports: {} }
  const sourceRequire = Module.createRequire(filePath)
  const localRequire = (request) => request.startsWith('.') ? sourceRequire(request) : require(request)
  const mockedRequire = (request) => {
    if (request === 'amis-editor') {
      return {
        FormPlugin: MockFormPlugin,
        unRegisterEditorPlugin: () => {},
        registerEditorPlugin: (pluginClass) => {
          registeredPlugin = pluginClass
        },
      }
    }

    if (request === 'amis-editor-core') {
      return {
        defaultValue: fallback => value => value == null ? fallback : value,
        getSchemaTpl: (type, config) => ({
          type,
          ...config,
        }),
        tipedLabel: (label, description) => ({
          label,
          description,
        }),
      }
    }

    if (request === './formSmartLayoutPanel') {
      return panelModule
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
    OuroborosFormPlugin: module.exports.OuroborosFormPlugin,
    OuroborosBaseFormPlugin: module.exports.OuroborosBaseFormPlugin,
  }
}

test('form smart layout panel helpers recognize CRUD filter contexts and inject the control only once', () => {
  const panelModule = loadPanelModule()

  assert.equal(
    panelModule.isCrudFilterFormContext({ path: '/crud/filter/form' }),
    true
  )
  assert.equal(
    panelModule.isCrudFilterFormContext({ path: '/crud2/filter/1/form' }),
    true
  )
  assert.equal(
    panelModule.isCrudFilterFormContext({ schemaPath: 'body/0/filter' }),
    true
  )
  assert.equal(
    panelModule.isCrudFilterFormContext({ path: '/page/form', schemaPath: 'body/1' }),
    false
  )

  const panelBody = createPanelBody()
  const controls = [{ type: 'switch', name: 'smartLayout' }]

  const injected = panelModule.injectFormSmartLayoutControl(panelBody, controls)
  const layoutBody =
    injected[0].tabs[0].body[0].body[0].body
  assert.equal(layoutBody[0].name, 'smartLayout')

  panelModule.injectFormSmartLayoutControl(panelBody, controls)
  assert.equal(
    layoutBody.filter((item) => item.name === 'smartLayout').length,
    1
  )
})

test('OuroborosFormPlugin injects a default-off smartLayout switch for ordinary forms only', () => {
  const panelModule = loadPanelModule()
  const { registeredPlugin, OuroborosFormPlugin } = loadFormPluginModule(panelModule)

  assert.equal(registeredPlugin, OuroborosFormPlugin)

  const plugin = new OuroborosFormPlugin()
  const panelBody = createPanelBody()
  const setDataCalls = []

  plugin.afterBuildPanelBody({
    context: {
      context: { path: '/page/form' },
      data: clone(panelBody),
      plugin,
    },
    setData: (value) => setDataCalls.push(value),
  })

  assert.equal(setDataCalls.length, 1)
  const injectedControl =
    setDataCalls[0][0].tabs[0].body[0].body[0].body[0]
  assert.equal(injectedControl.type, 'switch')
  assert.equal(injectedControl.name, 'smartLayout')
  assert.deepEqual(injectedControl.label, {
    label: '智能布局',
    description:
      '普通 Form 默认关闭。开启后自动按字段数量切到 1/2 列；显式 columnCount 仍优先于自动列数。',
  })
  assert.equal(injectedControl.pipeIn(true), true)
  assert.equal(injectedControl.pipeIn(undefined), false)
  assert.equal(injectedControl.pipeOut(true), true)
  assert.equal(injectedControl.pipeOut(false), undefined)
})

test('OuroborosFormPlugin skips CRUD filter contexts and foreign plugin events', () => {
  const panelModule = loadPanelModule()
  const { OuroborosFormPlugin } = loadFormPluginModule(panelModule)

  const plugin = new OuroborosFormPlugin()
  const panelBody = createPanelBody()
  const setDataCalls = []

  plugin.afterBuildPanelBody({
    context: {
      context: { path: '/crud/filter/form' },
      data: clone(panelBody),
      plugin,
    },
    setData: (value) => setDataCalls.push(value),
  })

  plugin.afterBuildPanelBody({
    context: {
      context: { path: '/page/form' },
      data: clone(panelBody),
      plugin: {},
    },
    setData: (value) => setDataCalls.push(value),
  })

  assert.equal(setDataCalls.length, 0)
})

test('OuroborosFormPlugin does not persist an inferred AMIS form-purpose marker', () => {
  const panelModule = loadPanelModule()
  const { OuroborosFormPlugin } = loadFormPluginModule(panelModule)
  const plugin = new OuroborosFormPlugin()

  assert.deepEqual(
    plugin.patchSchema({ type: 'form' }, {}, {}),
    { type: 'form' }
  )
  assert.deepEqual(
    plugin.patchSchema({ type: 'form', feat: 'View' }, {}, {}),
    { type: 'form', feat: 'View' }
  )
  for (const actions of [[], [{type: 'button', label: 'Custom action', actionType: 'dialog'}]]) {
    const authoredActions = {type: 'form', actions}
    assert.deepEqual(plugin.patchSchema(authoredActions, {}, {}), authoredActions)
  }
  const authoredForm = { type: 'form', feat: 'View', api: '/save', initApi: '/load' }
  assert.deepEqual(
    plugin.patchSchema(authoredForm, {}, {}),
    authoredForm
  )
})


test('form panel displays defaults without initializing fields and retains authored selections', () => {
  const { OuroborosBaseFormPlugin } = loadFormPluginModule(loadPanelModule())
  const plugin = new OuroborosBaseFormPlugin()
  const onChange = () => 'author edit'
  const suppliedPipe = value => value || 'api'
  const panel = [{type: 'group', body: [
    {type: 'select', name: 'dsType', value: 'api', pipeIn: suppliedPipe, onChange},
    {type: 'select', name: 'labelAlign', selectFirst: true, options: [{value: 'left'}, {value: 'right'}]},
    {type: 'input-text', name: 'title'},
  ]}]
  let rendered
  plugin.afterBuildPanelBody({context: {plugin, data: panel}, setData: value => { rendered = value }})
  const [source, align, title] = rendered[0].body
  assert.equal(Object.hasOwn(source, 'value'), false)
  assert.equal(source.selectFirst, false)
  assert.equal(source.pipeIn(undefined), 'api')
  assert.equal(source.pipeIn('custom'), 'custom')
  assert.equal(source.onChange(), 'author edit')
  assert.equal(align.selectFirst, false)
  assert.equal(align.pipeIn(undefined), 'left')
  assert.equal(align.pipeIn('right'), 'right')
  assert.equal(title, panel[0].body[2])
  assert.equal(panel[0].body[0].value, 'api')
  assert.equal(panel[0].body[1].selectFirst, true)
})
