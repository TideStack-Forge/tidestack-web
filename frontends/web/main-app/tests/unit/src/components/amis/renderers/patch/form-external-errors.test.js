const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const { mainAppRoot } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

function loadOuroborosFormModule() {
  const filePath = path.join(
    mainAppRoot,
    '../ouroboros-amis-runtime/src/renderers/patch/Form.tsx'
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
    }
  }
  MockFormRendererBase.defaultProps = {
    horizontal: {
      left: 2,
      right: 10,
    },
  }

  const module = { exports: {} }
  const sourceRequire = Module.createRequire(filePath)
  const localRequire = (request) => request.startsWith('.') ? sourceRequire(request) : require(request)
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

    if (request === 'mobx') {
      return {
        comparer: {
          shallow(left, right) {
            return left === right
          },
        },
        reaction() {
          return () => {}
        },
      }
    }

    if (request === './formSmartLayout') {
      return {
        normalizeFormSmartLayout(props) {
          return props
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

  new vm.Script(transpiled.outputText, { filename: filePath }).runInContext(
    context
  )
  return module.exports.default
}

function createErrorData(entries = []) {
  const errorData = entries.map((entry) => ({ ...entry }))
  errorData.replace = function replace(nextEntries) {
    this.length = 0
    nextEntries.forEach((entry) => {
      this.push({ ...entry })
    })
  }
  return errorData
}

function createObservableLikeCollection(entries = []) {
  let values = entries.slice()
  return {
    get length() {
      return values.length
    },
    [Symbol.iterator]() {
      return values[Symbol.iterator]()
    },
    map(callback) {
      return values.map(callback)
    },
    filter(callback) {
      return values.filter(callback)
    },
    push(entry) {
      values.push(entry)
    },
    replace(nextEntries) {
      values = nextEntries.slice()
    },
    slice() {
      return values.slice()
    },
  }
}

function createObservableLikeErrorData(entries = []) {
  return createObservableLikeCollection(entries.map((entry) => ({ ...entry })))
}

function createFormStore(items, { observableLikeItems = false } = {}) {
  const itemList = items.slice()
  return {
    items: observableLikeItems ? createObservableLikeCollection(itemList) : itemList,
    getItemById(fieldPath) {
      return itemList.find((item) => item.itemId === fieldPath) || null
    },
    getItemsByName(fieldPath) {
      return itemList.filter((item) => item.name === fieldPath)
    },
    getItemsByPath(fieldPath) {
      return itemList.filter((item) => item.name === fieldPath || item.itemId === fieldPath)
    },
  }
}

function createFormItem({
  itemId,
  name,
  entries = [],
  observableLikeErrorData = false,
}) {
  return {
    itemId,
    name,
    loading: false,
    validatedAt: 0,
    errorData: observableLikeErrorData
      ? createObservableLikeErrorData(entries)
      : createErrorData(entries),
    clearError(tag) {
      if (!tag) {
        this.errorData.replace([])
        return
      }

      this.errorData.replace(
        this.errorData.filter((entry) => entry.tag !== tag)
      )
    },
    addError(messages, tag = 'builtin') {
      ;(Array.isArray(messages) ? messages : [messages]).forEach((message) => {
        this.errorData.push({
          msg: message,
          tag,
        })
      })
    },
  }
}

function snapshotErrors(item) {
  return item.errorData.map((entry) => ({
    msg: entry.msg,
    tag: entry.tag,
    rule: entry.rule,
  }))
}

test('OuroborosForm setExternalErrors preserves internal errors and appends stable external field errors', () => {
  const OuroborosForm = loadOuroborosFormModule()
  const item = createFormItem({
    itemId: 'flowName',
    name: 'flowName',
    entries: [{ msg: '内部校验失败', tag: 'builtin' }],
  })
  const form = new OuroborosForm({
    store: createFormStore([item]),
  })

  form.setExternalErrors(
    {
      flowName: ['流程调用节点不能引用当前流程自身'],
    },
    'logicflow-validation'
  )

  assert.deepEqual(snapshotErrors(item), [
    { msg: '内部校验失败', tag: 'builtin', rule: undefined },
    {
      msg: '流程调用节点不能引用当前流程自身',
      tag: 'ouroboros:external:logicflow-validation',
      rule: undefined,
    },
  ])
})

test('OuroborosForm syncExternalErrors restores external field errors after internal lifecycle clears them', () => {
  const OuroborosForm = loadOuroborosFormModule()
  const item = createFormItem({
    itemId: 'flowName',
    name: 'flowName',
  })
  const form = new OuroborosForm({
    store: createFormStore([item]),
  })

  form.setExternalErrors(
    {
      flowName: ['后端错误'],
    },
    'logicflow-validation'
  )

  item.errorData.replace([])
  form.syncExternalErrors()

  assert.deepEqual(snapshotErrors(item), [
    {
      msg: '后端错误',
      tag: 'ouroboros:external:logicflow-validation',
      rule: undefined,
    },
  ])
})

test('OuroborosForm clearExternalErrors removes only the targeted source and keeps others intact', () => {
  const OuroborosForm = loadOuroborosFormModule()
  const item = createFormItem({
    itemId: 'flowName',
    name: 'flowName',
    entries: [{ msg: '内部错误', tag: 'builtin' }],
  })
  const form = new OuroborosForm({
    store: createFormStore([item]),
  })

  form.setExternalErrors({ flowName: ['后端错误 A'] }, 'logicflow-validation')
  form.setExternalErrors({ flowName: ['后端错误 B'] }, 'other-source')
  form.clearExternalErrors('logicflow-validation')

  assert.deepEqual(snapshotErrors(item), [
    { msg: '内部错误', tag: 'builtin', rule: undefined },
    {
      msg: '后端错误 B',
      tag: 'ouroboros:external:other-source',
      rule: undefined,
    },
  ])
})

test('OuroborosForm replaces legacy external error tags with the managed external source tag', () => {
  const OuroborosForm = loadOuroborosFormModule()
  const item = createFormItem({
    itemId: 'flowName',
    name: 'flowName',
    entries: [
      { msg: '内部错误', tag: 'builtin' },
      { msg: '后端错误', tag: 'logicflow-validation' },
      { msg: '后端错误', tag: 'external:logicflow-validation' },
    ],
  })
  const form = new OuroborosForm({
    store: createFormStore([item]),
  })

  form.setExternalErrors({ flowName: ['后端错误'] }, 'logicflow-validation')

  assert.deepEqual(snapshotErrors(item), [
    { msg: '内部错误', tag: 'builtin', rule: undefined },
    {
      msg: '后端错误',
      tag: 'ouroboros:external:logicflow-validation',
      rule: undefined,
    },
  ])
})

test('OuroborosForm collapses duplicated managed external errors on sync', () => {
  const OuroborosForm = loadOuroborosFormModule()
  const item = createFormItem({
    itemId: 'flowName',
    name: 'flowName',
    observableLikeErrorData: true,
    entries: [
      { msg: '内部错误', tag: 'builtin' },
      { msg: '后端错误', tag: 'ouroboros:external:logicflow-validation' },
      { msg: '后端错误', tag: 'ouroboros:external:logicflow-validation' },
      { msg: '后端错误', tag: 'logicflow-validation' },
      { msg: '后端错误', tag: 'external:logicflow-validation' },
    ],
  })
  const form = new OuroborosForm({
    store: createFormStore([item]),
  })

  form.setExternalErrors({ flowName: ['后端错误'] }, 'logicflow-validation')
  form.syncExternalErrors()

  assert.deepEqual(snapshotErrors(item), [
    { msg: '内部错误', tag: 'builtin', rule: undefined },
    {
      msg: '后端错误',
      tag: 'ouroboros:external:logicflow-validation',
      rule: undefined,
    },
  ])
})

test('OuroborosForm reads observable-like form items when syncing external errors', () => {
  const OuroborosForm = loadOuroborosFormModule()
  const item = createFormItem({
    itemId: 'flowName',
    name: 'flowName',
  })
  const form = new OuroborosForm({
    store: createFormStore([item], { observableLikeItems: true }),
  })

  form.setExternalErrors({ flowName: ['后端错误'] }, 'logicflow-validation')

  assert.deepEqual(snapshotErrors(item), [
    {
      msg: '后端错误',
      tag: 'ouroboros:external:logicflow-validation',
      rule: undefined,
    },
  ])
})

test('OuroborosForm syncs declared external field errors from form props', () => {
  const OuroborosForm = loadOuroborosFormModule()
  const item = createFormItem({
    itemId: 'flowName',
    name: 'flowName',
    entries: [{ msg: '内部错误', tag: 'builtin' }],
  })
  const form = new OuroborosForm({
    store: createFormStore([item]),
    externalErrorSource: 'logicflow-validation',
    externalFieldErrors: {
      flowName: ['后端字段错误'],
    },
  })

  form.componentDidMount()

  assert.deepEqual(snapshotErrors(item), [
    { msg: '内部错误', tag: 'builtin', rule: undefined },
    {
      msg: '后端字段错误',
      tag: 'ouroboros:external:logicflow-validation',
      rule: undefined,
    },
  ])
})

test('OuroborosForm removes declared external field errors when form props clear them', () => {
  const OuroborosForm = loadOuroborosFormModule()
  const item = createFormItem({
    itemId: 'flowName',
    name: 'flowName',
  })
  const store = createFormStore([item])
  const form = new OuroborosForm({
    store,
    externalErrorSource: 'logicflow-validation',
    externalFieldErrors: {
      flowName: ['后端字段错误'],
    },
  })

  form.componentDidMount()
  form.props = {
    store,
    externalErrorSource: 'logicflow-validation',
    externalFieldErrors: {},
  }
  form.componentDidUpdate({
    store,
    externalErrorSource: 'logicflow-validation',
    externalFieldErrors: {
      flowName: ['后端字段错误'],
    },
  })

  assert.deepEqual(snapshotErrors(item), [])
})

test('OuroborosForm restores owned store external error API on store replacement and unmount', () => {
  const OuroborosForm = loadOuroborosFormModule()
  const storeASetExternalErrors = () => {}
  const storeAClearExternalErrors = () => {}
  const storeBSetExternalErrors = () => {}
  const storeBClearExternalErrors = () => {}
  const storeA = {
    ...createFormStore([]),
    setExternalErrors: storeASetExternalErrors,
    clearExternalErrors: storeAClearExternalErrors,
  }
  const storeB = {
    ...createFormStore([]),
    setExternalErrors: storeBSetExternalErrors,
    clearExternalErrors: storeBClearExternalErrors,
  }
  const form = new OuroborosForm({
    store: storeA,
  })

  form.componentDidMount()
  assert.notEqual(storeA.setExternalErrors, storeASetExternalErrors)
  assert.notEqual(storeA.clearExternalErrors, storeAClearExternalErrors)

  form.props = { store: storeB }
  form.componentDidUpdate({ store: storeA })

  assert.equal(storeA.setExternalErrors, storeASetExternalErrors)
  assert.equal(storeA.clearExternalErrors, storeAClearExternalErrors)
  assert.notEqual(storeB.setExternalErrors, storeBSetExternalErrors)
  assert.notEqual(storeB.clearExternalErrors, storeBClearExternalErrors)

  form.componentWillUnmount()

  assert.equal(storeB.setExternalErrors, storeBSetExternalErrors)
  assert.equal(storeB.clearExternalErrors, storeBClearExternalErrors)
})
