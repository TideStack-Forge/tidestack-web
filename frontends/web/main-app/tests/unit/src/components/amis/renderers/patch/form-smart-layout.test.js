/* @vitest-environment jsdom */

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const { mainAppRoot } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

function loadFormSmartLayoutModule() {
  const filePath = path.join(
    mainAppRoot,
    'src/components/amis/renderers/patch/formSmartLayout.ts'
  )
  const source = fs.readFileSync(filePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
  })

  const localRequire = Module.createRequire(filePath)
  const module = { exports: {} }
  const mockedRequire = (request) => {
    if (request === './runtimeSystemConfig') {
      return loadRuntimeSystemConfigModule()
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
  return module.exports
}

function loadRuntimeSystemConfigModule() {
  const filePath = path.join(
    mainAppRoot,
    'src/components/amis/renderers/patch/runtimeSystemConfig.ts'
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
  const localRequire = Module.createRequire(filePath)
  const context = vm.createContext({
    module,
    exports: module.exports,
    require: localRequire,
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console,
  })

  new vm.Script(transpiled.outputText, { filename: filePath }).runInContext(context)
  return module.exports
}

function loadOuroborosFormModule(formSmartLayoutModule) {
  const filePath = path.join(
    mainAppRoot,
    'src/components/amis/renderers/patch/Form.tsx'
  )
  const source = fs.readFileSync(filePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      jsx: ts.JsxEmit.ReactJSX,
      experimentalDecorators: true,
      esModuleInterop: true,
    },
  })

  class MockFormRendererBase {
    constructor(props) {
      this.props = props
      this.renderFormItems = this.renderFormItems.bind(this)
      this.renderChildren = this.renderChildren.bind(this)
      this.renderChild = this.renderChild.bind(this)
    }

    renderBody() {
      return {
        props: this.props,
        renderFormItemsRef: this.renderFormItems,
        renderedItems: this.renderFormItems({
          body: this.props.body,
        }),
      }
    }

    renderFormItems(schema) {
      return this.renderChildren(schema.body || [])
    }

    renderChildren(children) {
      return children.map((child) => this.renderChild(child))
    }

    renderChild(child) {
      return {
        name: child.name,
        mode: this.props.mode,
        columnCount: this.props.columnCount,
      }
    }
  }
  MockFormRendererBase.defaultProps = {
    mode: 'normal',
    columnCount: 0,
    horizontal: {
      left: 2,
      right: 10,
    },
  }

  const module = { exports: {} }
  const localRequire = Module.createRequire(filePath)
  const mockedRequire = (request) => {
    if (request === 'amis-core/lib/renderers/Form') {
      return {
        FormRendererBase: MockFormRendererBase,
      }
    }

    if (request === 'amis-core') {
      return {
        Renderer: () => (Target) => Target,
        FormStore: {
          name: 'MockFormStore',
        },
        isObjectShallowModified: () => false,
      }
    }

    if (request === './formSmartLayout') {
      return formSmartLayoutModule
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
  return module.exports.default
}

function buildTextItems(count) {
  return Array.from({ length: count }, (_, index) => ({
    type: 'input-text',
    name: `field${index + 1}`,
  }))
}

function toPlainObject(value) {
  return JSON.parse(JSON.stringify(value))
}

test('normalizeFormSmartLayout only normalizes ordinary forms when smartLayout=true', () => {
  const layout = loadFormSmartLayoutModule()

  const smallForm = {
    type: 'form',
    smartLayout: true,
    body: buildTextItems(5),
  }
  const normalizedSmallForm = layout.normalizeFormSmartLayout(smallForm)

  assert.notStrictEqual(normalizedSmallForm, smallForm)
  assert.equal(normalizedSmallForm.mode, 'normal')
  assert.equal(normalizedSmallForm.columnCount, 1)
  assert.strictEqual(normalizedSmallForm.body, smallForm.body)

  assert.deepEqual(
    toPlainObject(
      layout.normalizeFormSmartLayout({
        type: 'form',
        smartLayout: true,
        body: buildTextItems(6),
      })
    ),
    {
      type: 'form',
      smartLayout: true,
      mode: 'normal',
      columnCount: 2,
      body: buildTextItems(6),
    }
  )

  assert.deepEqual(
    toPlainObject(
      layout.normalizeFormSmartLayout({
        type: 'form',
        smartLayout: true,
        columnCount: 4,
        body: buildTextItems(2),
      })
    ),
    {
      type: 'form',
      smartLayout: true,
      mode: 'normal',
      columnCount: 4,
      body: buildTextItems(2),
    }
  )
})

test('normalizeFormSmartLayout keeps ordinary forms unchanged when smartLayout is missing or false', () => {
  const layout = loadFormSmartLayoutModule()

  const defaultOffForm = {
    type: 'form',
    body: [
      {
        type: 'input-text',
        name: 'keyword',
        size: 'full',
        inputClassName: 'w-full custom-class',
      },
    ],
  }
  assert.strictEqual(
    layout.normalizeFormSmartLayout(defaultOffForm),
    defaultOffForm
  )

  const disabledForm = {
    type: 'form',
    smartLayout: false,
    mode: 'row',
    columnCount: 4,
    body: buildTextItems(6),
  }
  assert.strictEqual(layout.normalizeFormSmartLayout(disabledForm), disabledForm)
})

test('normalizeFormSmartLayout resolves system defaults while preserving schema overrides', () => {
  const layout = loadFormSmartLayoutModule()
  const systemConfig = {
    ui: {
      form: {
        smartLayout: {
          enabled: true,
          labelStyle: 'horizontal',
          smallItemLimit: 2,
          columnCount: {
            small: 1,
            large: 3,
          },
        },
      },
    },
  }

  assert.deepEqual(
    toPlainObject(layout.resolveFormSmartLayoutOptions({}, systemConfig)),
    {
      enabled: true,
      labelStyle: 'horizontal',
      smallItemLimit: 2,
      columnCount: {
        small: 1,
        large: 3,
      },
    }
  )

  assert.deepEqual(
    toPlainObject(
      layout.normalizeFormSmartLayout(
        {
          type: 'form',
          body: buildTextItems(3),
        },
        systemConfig
      )
    ),
    {
      type: 'form',
      mode: 'horizontal',
      columnCount: 3,
      body: buildTextItems(3),
    }
  )

  const explicitlyDisabledForm = {
    type: 'form',
    smartLayout: false,
    body: buildTextItems(3),
  }
  assert.strictEqual(
    layout.normalizeFormSmartLayout(explicitlyDisabledForm, systemConfig),
    explicitlyDisabledForm
  )

  assert.deepEqual(
    toPlainObject(
      layout.normalizeFormSmartLayout(
        {
          type: 'form',
          smartLayout: {
            enabled: true,
            labelStyle: 'normal',
            smallItemLimit: 4,
            columnCount: {
              large: 4,
            },
          },
          body: buildTextItems(5),
        },
        {
          'ui.form.smartLayout.enabled': false,
          'ui.form.smartLayout.columnCount.small': 2,
        }
      )
    ),
    {
      type: 'form',
      smartLayout: {
        enabled: true,
        labelStyle: 'normal',
        smallItemLimit: 4,
        columnCount: {
          large: 4,
        },
      },
      mode: 'normal',
      columnCount: 4,
      body: buildTextItems(5),
    }
  )

  assert.equal(
    layout.normalizeFormSmartLayout(
      {
        type: 'form',
        body: buildTextItems(5),
        columnCount: 6,
      },
      systemConfig
    ).columnCount,
    6
  )
})

test('normalizeFormSmartLayout bypasses tuned layouts and supports controls/table-like fieldsets', () => {
  const layout = loadFormSmartLayoutModule()

  const groupedForm = {
    type: 'form',
    smartLayout: true,
    body: [
      {
        type: 'group',
        body: buildTextItems(2),
      },
    ],
  }
  assert.strictEqual(layout.normalizeFormSmartLayout(groupedForm), groupedForm)

  const flexForm = {
    type: 'form',
    smartLayout: true,
    body: [
      {
        type: 'flex',
        items: buildTextItems(2),
      },
    ],
  }
  assert.strictEqual(layout.normalizeFormSmartLayout(flexForm), flexForm)

  const tunedFieldsetForm = {
    type: 'form',
    smartLayout: true,
    body: [
      {
        type: 'fieldset',
        body: buildTextItems(2),
      },
    ],
  }
  assert.strictEqual(
    layout.normalizeFormSmartLayout(tunedFieldsetForm),
    tunedFieldsetForm
  )

  assert.equal(
    layout.normalizeFormSmartLayout({
      type: 'form',
      smartLayout: true,
      body: [
        {
          type: 'fieldset',
          body: [{ type: 'table' }, { type: 'crud' }],
        },
        ...buildTextItems(6),
      ],
    }).columnCount,
    2
  )

  assert.deepEqual(
    toPlainObject(
      layout.normalizeFormSmartLayout({
        type: 'form',
        smartLayout: true,
        body: [
          {
            type: 'fieldset',
            body: {
              type: 'service',
              body: { type: 'input-table' },
            },
          },
          ...buildTextItems(6),
        ],
      })
    ),
    {
      type: 'form',
      smartLayout: true,
      mode: 'normal',
      columnCount: 2,
      body: [
        {
          type: 'fieldset',
          body: {
            type: 'service',
            body: { type: 'input-table' },
          },
        },
        ...buildTextItems(6),
      ],
    }
  )

  const tunedServiceFieldsetForm = {
    type: 'form',
    smartLayout: true,
    body: [
      {
        type: 'fieldset',
        body: {
          type: 'service',
          body: buildTextItems(2),
        },
      },
    ],
  }
  assert.strictEqual(
    layout.normalizeFormSmartLayout(tunedServiceFieldsetForm),
    tunedServiceFieldsetForm
  )

  const controlsForm = {
    type: 'form',
    smartLayout: true,
    controls: buildTextItems(6),
  }
  const normalizedControlsForm = layout.normalizeFormSmartLayout(controlsForm)
  assert.equal(normalizedControlsForm.columnCount, 2)
  assert.strictEqual(normalizedControlsForm.controls, controlsForm.controls)
  assert.ok(
    !Object.prototype.hasOwnProperty.call(normalizedControlsForm, 'body')
  )
})

test('normalizeFormSmartLayout strips root width classes only for enabled forms without mutating the original input', () => {
  const layout = loadFormSmartLayoutModule()

  const widthClassForm = {
    type: 'form',
    smartLayout: true,
    body: [
      {
        type: 'input-text',
        name: 'keyword',
        size: 'full',
        inputClassName: 'border-0 w-full h-full p-0',
      },
    ],
  }
  const normalizedWidthClassForm = layout.normalizeFormSmartLayout(widthClassForm)
  assert.deepEqual(toPlainObject(normalizedWidthClassForm.body), [
    {
      type: 'input-text',
      name: 'keyword',
      inputClassName: 'border-0 h-full p-0',
    },
  ])
  assert.equal(widthClassForm.body[0].inputClassName, 'border-0 w-full h-full p-0')
  assert.equal(widthClassForm.body[0].size, 'full')

  const defaultOffForm = {
    type: 'form',
    body: [
      {
        type: 'input-text',
        name: 'keyword',
        size: 'md',
        inputClassName: 'w-full custom-class',
      },
    ],
  }
  assert.strictEqual(layout.normalizeFormSmartLayout(defaultOffForm), defaultOffForm)
})

test('OuroborosForm only passes normalized props to FormRendererBase when smartLayout=true', () => {
  const layout = loadFormSmartLayoutModule()
  const OuroborosForm = loadOuroborosFormModule(layout)

  const ordinaryFormProps = {
    type: 'form',
    smartLayout: true,
    body: buildTextItems(6),
  }
  const ordinaryForm = new OuroborosForm(ordinaryFormProps)
  const ordinaryRenderResult = ordinaryForm.renderBody()
  const secondOrdinaryRenderResult = ordinaryForm.renderBody()
  assert.equal(ordinaryRenderResult.props.mode, 'normal')
  assert.equal(ordinaryRenderResult.props.columnCount, 2)
  assert.deepEqual(
    ordinaryRenderResult.renderedItems,
    buildTextItems(6).map((item) => ({
      name: item.name,
      mode: 'normal',
      columnCount: 2,
    }))
  )
  assert.strictEqual(ordinaryForm.props, ordinaryFormProps)
  assert.strictEqual(
    ordinaryRenderResult.renderFormItemsRef,
    secondOrdinaryRenderResult.renderFormItemsRef,
    'OuroborosForm should keep normalized render method references stable'
  )

  const serviceWrappedTableProps = {
    type: 'form',
    smartLayout: true,
    body: [
      {
        type: 'fieldset',
        body: {
          type: 'service',
          body: {
            type: 'input-table',
            name: 'items',
          },
        },
      },
      ...buildTextItems(6),
    ],
  }
  const serviceWrappedTableForm = new OuroborosForm(serviceWrappedTableProps)
  const serviceWrappedTableRenderResult = serviceWrappedTableForm.renderBody()
  assert.equal(serviceWrappedTableRenderResult.props.mode, 'normal')
  assert.equal(serviceWrappedTableRenderResult.props.columnCount, 2)

  const defaultOffProps = {
    type: 'form',
    body: buildTextItems(6),
  }
  const defaultOffForm = new OuroborosForm(defaultOffProps)
  assert.strictEqual(defaultOffForm.renderBody().props, defaultOffProps)

  const systemEnabledProps = {
    type: 'form',
    data: {
      SystemConfig: {
        ui: {
          form: {
            smartLayout: {
              enabled: true,
              labelStyle: 'horizontal',
              smallItemLimit: 2,
              columnCount: {
                small: 1,
                large: 3,
              },
            },
          },
        },
      },
    },
    body: buildTextItems(3),
  }
  const systemEnabledForm = new OuroborosForm(systemEnabledProps)
  const systemEnabledRenderResult = systemEnabledForm.renderBody()
  assert.equal(systemEnabledRenderResult.props.mode, 'horizontal')
  assert.equal(systemEnabledRenderResult.props.columnCount, 3)
  assert.strictEqual(systemEnabledForm.props, systemEnabledProps)

  const disabledProps = {
    type: 'form',
    smartLayout: false,
    mode: 'row',
    body: buildTextItems(6),
  }
  const disabledForm = new OuroborosForm(disabledProps)
  assert.strictEqual(disabledForm.renderBody().props, disabledProps)
})

test('OuroborosForm keeps row-form schemas unchanged when smart layout is off', () => {
  const layout = loadFormSmartLayoutModule()
  const OuroborosForm = loadOuroborosFormModule(layout)

  const rowProps = {
    type: 'form',
    mode: 'row',
    body: [
      {
        type: 'input-text',
        name: 'name',
        columnClassName: 'flex-grow-0 min-w-max',
      },
      {
        type: 'select',
        name: 'type',
      },
      {
        type: 'checkbox',
        name: 'required',
        columnClassName: 'flex-grow-0 min-w-max',
        colSize: '25%',
      },
    ],
  }

  const rowForm = new OuroborosForm(rowProps)
  const rendered = rowForm.renderBody()

  assert.strictEqual(rendered.props, rowProps)
  assert.equal(rendered.props.body[0].colSize, undefined)
  assert.equal(rendered.props.body[1].colSize, undefined)
  assert.equal(rendered.props.body[2].colSize, '25%')
})
