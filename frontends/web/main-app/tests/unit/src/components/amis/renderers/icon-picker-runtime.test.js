const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const Module = require('node:module')
const React = require('react')
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
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
    fileName: filePath,
  }).outputText
}

function loadIconPickerModule({ getIconNames = () => [] } = {}) {
  const filePath = path.join(mainAppRoot, '../ouroboros-amis-runtime/src/renderers/IconPicker.tsx')
  const module = { exports: {} }
  const sourceRequire = Module.createRequire(filePath)
  const localRequire = (request) => request.startsWith('.') ? sourceRequire(request) : require(request)

  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (request) => {
      if (request === 'react') {
        return React
      }
      if (request === 'amis') {
        return {
          FormItem: () => (Component) => Component,
          Icon: () => null,
          InputBox: () => null,
          getIconNames,
        }
      }
      if (request === 'downshift') {
        return () => null
      }
      if (request.endsWith('.scss') || request.endsWith('.css')) {
        return undefined
      }
      return localRequire(request)
    },
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console,
  })

  new vm.Script(transpileFile(filePath), { filename: filePath }).runInContext(context)
  return module.exports.default
}

function createIconPickerInstance(IconPicker, props = {}) {
  const instance = new IconPicker(props)
  instance.setState = (partial) => {
    const patch =
      typeof partial === 'function' ? partial(instance.state, instance.props) : partial
    instance.state = { ...instance.state, ...patch }
  }
  return instance
}

test('icon picker lazy-imports only the FontAwesome 6 icon data by default', async () => {
  const IconPicker = loadIconPickerModule()

  const instance = createIconPickerInstance(IconPicker)
  await instance.componentDidMount()

  assert.equal(instance.state.options.length, 1)
  assert.equal(instance.state.selectedTab.name, '图标集3')
  assert.equal(instance.state.selectedTab.type, 'fontawesome')
})

test('icon picker keeps internal icon data optional', async () => {
  const IconPicker = loadIconPickerModule({
    getIconNames: () => ['amis-add'],
  })

  const instance = createIconPickerInstance(IconPicker, { showInternalIcons: true })
  await instance.componentDidMount()

  assert.equal(instance.state.options.length, 2)
  assert.equal(instance.state.options[1].name, '内置')
  assert.equal(instance.state.options[1]['amis-add'].value, 'amis-add')
})
