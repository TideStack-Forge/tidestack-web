const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const { mainAppRoot } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

function loadInputTreePluginModule() {
  const filePath = path.join(
    mainAppRoot,
    'src/components/amis/editor/plugins/patch/InputTree.ts'
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
  class MockTreeControlPlugin {}

  const module = { exports: {} }
  const localRequire = Module.createRequire(filePath)
  const mockedRequire = (request) => {
    if (request === 'amis-editor') {
      return {
        TreeControlPlugin: MockTreeControlPlugin,
        registerEditorPlugin: (pluginClass) => {
          registeredPlugin = pluginClass
        },
      }
    }

    if (request === 'amis-editor-core') {
      return {
        getSchemaTpl: (type, config) => ({ type, ...config }),
        tipedLabel: (label, description) => ({ label, description }),
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
    ...module.exports,
    registeredPlugin,
  }
}

function createPanelBody(originalOnChange) {
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
                      type: 'button-group-select',
                      name: 'heightAuto',
                      onChange: originalOnChange,
                    },
                    {
                      type: 'input-text',
                      name: 'wrapperCustomStyle.root.height',
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

function findControls(value, name, result = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => findControls(item, name, result))
  } else if (value && typeof value === 'object') {
    if (value.name === name) result.push(value)
    Object.values(value).forEach((item) => findControls(item, name, result))
  }

  return result
}

test('input-tree editor adds one autoFillHeight switch beside native heightAuto', () => {
  const {
    OuroborosInputTreePlugin,
    injectInputTreeAutoFillHeightControl,
    registeredPlugin,
  } = loadInputTreePluginModule()
  const panelBody = createPanelBody(() => undefined)

  const once = injectInputTreeAutoFillHeightControl(panelBody)
  const twice = injectInputTreeAutoFillHeightControl(once)
  const controls = findControls(twice, 'autoFillHeight')

  assert.equal(registeredPlugin, OuroborosInputTreePlugin)
  assert.equal(controls.length, 1)
  assert.equal(controls[0].type, 'switch')
  assert.equal(controls[0].label.label, '自动填充高度')
  assert.equal(
    controls[0].label.description,
    '填满有明确高度的父容器，搜索框固定在树内容上方。'
  )
  assert.equal(controls[0].pipeIn(undefined), false)
  assert.equal(controls[0].pipeIn(true), true)
  assert.equal(controls[0].pipeOut(false), undefined)
  assert.equal(controls[0].pipeOut(true), true)
})

test('input-tree editor keeps the two height modes mutually exclusive', () => {
  const { injectInputTreeAutoFillHeightControl } = loadInputTreePluginModule()
  const nativeHeightChanges = []
  const panelBody = injectInputTreeAutoFillHeightControl(
    createPanelBody((...args) => nativeHeightChanges.push(args))
  )
  const autoFillHeight = findControls(panelBody, 'autoFillHeight')[0]
  const heightAuto = findControls(panelBody, 'heightAuto')[0]
  const deletedValues = []
  const form = {
    deleteValueByName: (name) => deletedValues.push(name),
  }

  autoFillHeight.onChange(true, false, null, form)
  heightAuto.onChange(true, false, null, form)

  assert.deepEqual(deletedValues, ['heightAuto', 'autoFillHeight'])
  assert.equal(nativeHeightChanges.length, 1)
  assert.equal(nativeHeightChanges[0][0], true)
})

test('input-tree editor plugin only patches its own panel event', () => {
  const { OuroborosInputTreePlugin } = loadInputTreePluginModule()
  const plugin = new OuroborosInputTreePlugin()
  const panelBody = createPanelBody(() => undefined)
  const setDataCalls = []

  plugin.afterBuildPanelBody({
    context: { data: panelBody, plugin },
    setData: (value) => setDataCalls.push(value),
  })
  plugin.afterBuildPanelBody({
    context: { data: panelBody, plugin: {} },
    setData: (value) => setDataCalls.push(value),
  })

  assert.equal(plugin.rendererName, 'OuroborosInputTree')
  assert.equal(plugin.disabledRendererPlugin, true)
  assert.equal(setDataCalls.length, 1)
  assert.equal(findControls(setDataCalls[0], 'autoFillHeight').length, 1)
})
