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

function loadDataDictPickerModule(dataMapping = () => undefined) {
  const filePath = path.join(
    mainAppRoot,
    'src/components/amis/renderers/DataDictPicker.tsx'
  )
  const module = { exports: {} }
  const localRequire = Module.createRequire(filePath)

  const context = vm.createContext({
    module,
    exports: module.exports,
    require: (request) => {
      if (request === 'react') {
        return React
      }
      if (request === 'amis') {
        return {
          dataMapping,
          FormItem: () => () => undefined,
        }
      }
      if (request === '../platform/context') {
        return {
          getPlatformAdapter: () => undefined,
          resolvePlatformContext: () => undefined,
        }
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

function renderDataDictPicker(props) {
  const DataDictPicker = loadDataDictPickerModule((expression, data) => {
    const match = /^\$\{([^}]+)\}$/.exec(expression)
    if (match) {
      return data?.[match[1]]
    }
    return undefined
  })
  let rendered = null
  const instance = new DataDictPicker({
    render: (name, schema) => {
      rendered = { name, schema }
      return null
    },
    dataDictName: 'status',
    name: 'statusCodes',
    data: {
      statusCodes: ['enabled', 'archived'],
    },
    multiple: true,
    ...props,
  })

  instance.render()
  return rendered
}

function toPlain(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toPlain(item))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).map((key) => [key, toPlain(value[key])]))
  }
  return value
}

test('data dict picker leaves omitted value-shape flags undefined for inner defaults', () => {
  const rendered = renderDataDictPicker({})

  assert.equal(rendered.name, 'data-dict-select')
  assert.equal(rendered.schema.joinValues, undefined)
  assert.equal(rendered.schema.extractValue, undefined)
  assert.deepEqual(rendered.schema.value, ['enabled', 'archived'])
})

test('data dict picker keeps input-table validation refs on the outer form item', () => {
  const rendered = renderDataDictPicker({
    formItem: {
      valid: false,
      errors: ['required'],
    },
    rowIndex: 0,
    colIndex: 0,
    buildItemProps: () => undefined,
    quickEditFormRef: () => undefined,
    quickEditFormItemRef: () => undefined,
    formItemRef: () => undefined,
  })
  const inputClassNames = rendered.schema.inputClassName.split(/\s+/)

  assert.ok(inputClassNames.includes('ouroboros-data-dict-picker'))
  assert.ok(inputClassNames.includes('is-error'))
  assert.equal(rendered.schema.formItem, undefined)
  assert.equal(rendered.schema.buildItemProps, undefined)
  assert.equal(rendered.schema.quickEditFormRef, undefined)
  assert.equal(rendered.schema.quickEditFormItemRef, undefined)
  assert.equal(rendered.schema.formItemRef, undefined)
})

test('data dict picker forwards explicit value-shape flags to the inner selector', () => {
  const rendered = renderDataDictPicker({
    joinValues: false,
    extractValue: true,
  })

  assert.equal(rendered.name, 'data-dict-select')
  assert.equal(rendered.schema.joinValues, false)
  assert.equal(rendered.schema.extractValue, true)
  assert.deepEqual(rendered.schema.value, ['enabled', 'archived'])
})

test('data dict picker forwards explicit false extractValue flag', () => {
  const rendered = renderDataDictPicker({
    joinValues: true,
    extractValue: false,
  })

  assert.equal(rendered.schema.joinValues, true)
  assert.equal(rendered.schema.extractValue, false)
})

test('data dict picker keeps explicit flags even without mapped value', () => {
  const DataDictPicker = loadDataDictPickerModule((expression, data) => {
    const match = /^\$\{([^}]+)\}$/.exec(expression)
    if (match) {
      return data?.[match[1]]
    }
    return undefined
  })
  let rendered = null
  const instance = new DataDictPicker({
    render: (name, schema) => {
      rendered = { name, schema }
      return null
    },
    dataDictName: 'status',
    name: 'missingCodes',
    data: {
      statusCodes: ['enabled', 'archived'],
    },
    multiple: true,
    joinValues: false,
    extractValue: true,
  })

  instance.render()

  assert.equal(rendered.name, 'data-dict-select')
  assert.equal(rendered.schema.joinValues, false)
  assert.equal(rendered.schema.extractValue, true)
  assert.equal(rendered.schema.value, undefined)
})

test('data dict picker normalizeValue preserves shape with shallow object null cleanup', () => {
  const DataDictPicker = loadDataDictPickerModule()
  const instance = new DataDictPicker({})

  assert.equal(instance.normalizeValue(undefined), '')
  assert.equal(instance.normalizeValue(null), '')
  assert.deepEqual(
    toPlain(
      instance.normalizeValue([
        { code: 'enabled', children: null },
        undefined,
        0,
        false,
        '',
      ])
    ),
    [{ code: 'enabled', children: undefined }, undefined, 0, false, '']
  )
  assert.deepEqual(
    toPlain(
      instance.normalizeValue({
        code: null,
        nested: {
          parentCode: null,
        },
        values: [null, { code: null }],
      })
    ),
    {
      code: undefined,
      nested: {
        parentCode: null,
      },
      values: [null, { code: null }],
    }
  )
})

test('data dict picker preserves explicit falsy scalar values', () => {
  const cases = [0, false, '']

  cases.forEach((value) => {
    const rendered = renderDataDictPicker({
      value,
      data: {
        statusCodes: ['enabled', 'archived'],
      },
    })

    assert.equal(rendered.schema.value, value)
  })
})

test('data dict picker preserves mapped falsy scalar values', () => {
  const cases = [0, false, '']

  cases.forEach((statusCode) => {
    const rendered = renderDataDictPicker({
      name: 'statusCode',
      data: {
        statusCode,
      },
    })

    assert.equal(rendered.schema.value, statusCode)
  })
})

test('data dict picker treats explicit null as cleared value', () => {
  const rendered = renderDataDictPicker({
    value: null,
    data: {
      statusCodes: ['enabled', 'archived'],
    },
  })

  assert.equal(rendered.schema.value, '')
})
