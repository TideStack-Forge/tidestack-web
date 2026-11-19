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
      experimentalDecorators: true,
    },
    fileName: filePath,
  }).outputText
}

function walkTree(nodes, visitor) {
  for (const node of nodes || []) {
    const result = visitor(node)
    if (result) {
      return result
    }
    const childResult = walkTree(node.children || [], visitor)
    if (childResult) {
      return childResult
    }
  }
  return undefined
}

function mapTree(nodes, mapper) {
  return (nodes || []).map((node) => {
    const mapped = mapper({ ...node })
    return node.children
      ? { ...mapped, children: mapTree(node.children, mapper) }
      : mapped
  })
}

function filterTree(nodes, predicate) {
  return (nodes || [])
    .map((node) => {
      const children = filterTree(node.children || [], predicate)
      return predicate(node) || children.length ? { ...node, children } : null
    })
    .filter(Boolean)
}

function loadOrganizationPickerModule() {
  const filePath = path.join(
    mainAppRoot,
    '../ouroboros-amis-runtime/src/renderers/OrganizationPicker.tsx'
  )
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
          FormItem: () => (target) => target,
          Renderer: () => (target) => target,
          filterTree,
          findTree: (nodes, predicate) => walkTree(nodes, predicate),
          findTreeAll: (nodes, predicate) => {
            const results = []
            walkTree(nodes, (node) => {
              if (predicate(node)) {
                results.push(node)
              }
              return undefined
            })
            return results
          },
          mapTree,
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

function renderOrganizationPicker(props) {
  const OrganizationPicker = loadOrganizationPickerModule()
  let rendered = null
  const instance = new OrganizationPicker({
    render: (name, schema, options) => {
      rendered = { name, schema, options }
      return null
    },
    data: {
      SystemContext: {},
    },
    value: 'org-1',
    ...props,
  })

  instance.state.originalData = [
    { id: 'org-1', name: '总部', type: 'company' },
    { id: 'dept-1', name: '研发部', type: 'department' },
  ]
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

test('organization picker renders a local tree-select backed by organization value', () => {
  const rendered = renderOrganizationPicker({})

  assert.equal(rendered.name, 'organization-picker')
  assert.equal(rendered.schema.type, 'tree-select')
  assert.equal(rendered.schema.wrap, false)
  assert.equal(rendered.schema.name, '__organizationPicker')
  assert.deepEqual(toPlain(rendered.options.data), { __organizationPicker: 'org-1' })
})

test('organization picker keeps input-table validation refs on the outer form item', () => {
  const rendered = renderOrganizationPicker({
    inputClassName: 'min-w-15',
    formItem: {
      valid: false,
      errors: ['required'],
    },
    rowIndex: 0,
    colIndex: 1,
    buildItemProps: () => undefined,
    quickEditFormRef: () => undefined,
    quickEditFormItemRef: () => undefined,
    formItemRef: () => undefined,
  })
  const inputClassNames = rendered.schema.inputClassName.split(/\s+/)

  assert.ok(inputClassNames.includes('ouroboros-organization-picker'))
  assert.ok(inputClassNames.includes('min-w-15'))
  assert.ok(inputClassNames.includes('is-error'))
  assert.equal(rendered.schema.formItem, undefined)
  assert.equal(rendered.schema.buildItemProps, undefined)
  assert.equal(rendered.schema.quickEditFormRef, undefined)
  assert.equal(rendered.schema.quickEditFormItemRef, undefined)
  assert.equal(rendered.schema.formItemRef, undefined)
})
