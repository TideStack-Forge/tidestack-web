const assert = require('node:assert/strict')
const path = require('node:path')
const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function createMockSnapshot() {
  return {
    runtimeProfile: 'mock-runtime',
    versionToken: 'mock-v1',
    languageProjectionHints: {},
    javaImports: ['java.time.LocalDate'],
    javaTypes: [
      {
        qualifiedName: 'java.time.LocalDate',
        simpleName: 'LocalDate',
        packageName: 'java.time',
        constructors: [
          {
            name: 'LocalDate',
            memberKind: 'constructor',
            parameterTypeDisplayNames: ['int', 'int', 'int'],
          },
        ],
        staticMethods: [
          {
            name: 'now',
            memberKind: 'method',
            returnTypeDisplayName: 'LocalDate',
            parameterTypeDisplayNames: [],
          },
        ],
        staticFields: [
          {
            name: 'MIN',
            memberKind: 'field',
            returnTypeDisplayName: 'LocalDate',
          },
        ],
        instanceMethods: [
          {
            name: 'getYear',
            memberKind: 'method',
            returnTypeDisplayName: 'int',
            parameterTypeDisplayNames: [],
          },
        ],
      },
    ],
    globals: [
      {
        name: '$input',
        kind: 'object',
        typeDisplayName: 'OrderInput',
        documentation: 'Logicflow node input payload',
        members: [
          {
            name: 'orderId',
            memberKind: 'field',
            returnTypeDisplayName: 'String',
          },
          {
            name: 'submittedAt',
            memberKind: 'field',
            returnTypeDisplayName: 'LocalDate',
          },
          {
            name: 'toMap',
            memberKind: 'method',
            returnTypeDisplayName: 'Map',
            parameterTypeDisplayNames: [],
          },
        ],
      },
      {
        name: 'LocalDate',
        kind: 'class',
        typeDisplayName: 'java.time.LocalDate',
        qualifiedTypeName: 'java.time.LocalDate',
      },
    ],
  }
}

function loadModule(relativePath) {
  clearMirroredSrcModuleCache(__filename, 'script-editor-intelligence')
  return requireMirroredSrcModule(__filename, relativePath)
}

function createJavascriptContext() {
  const ts = require('typescript')
  const files = new Map()
  const providers = { completion: [], hover: [], signature: [] }
  const state = { files, providers, compilerOptionsHistory: [], extraLibs: [], modelLanguages: [], markers: [] }
  let version = 0
  const model = createTextModel('LocalDate.', 'inmemory://logicflow-script.js')
  model.getValue = () => model.text || 'LocalDate.'
  model.getVersionId = () => version
  model.getOffsetAt = position => position.column - 1
  model.getPositionAt = offset => ({ lineNumber: 1, column: offset + 1 })
  model.onDidChangeContent = handler => { model.changed = handler; return { dispose() { model.changed = null } } }
  model.setValue = value => { model.text = value; version++; model.changed?.() }
  model.getLineContent = () => model.getValue()
  const service = ts.createLanguageService({
    getScriptFileNames: () => [...files.keys()],
    getScriptVersion: file => String(files.get(file)?.version ?? version),
    getScriptSnapshot: file => {
      const value = files.get(file)?.source ?? ts.sys.readFile(file)
      return value == null ? undefined : ts.ScriptSnapshot.fromString(value)
    },
    getCurrentDirectory: () => process.cwd(), getCompilationSettings: () => state.backendOptions || ({ target: ts.ScriptTarget.ES2020 }),
    getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
    fileExists: file => files.has(file) || ts.sys.fileExists(file), readFile: ts.sys.readFile,
  })
  const register = key => (_language, provider) => {
    const item = { provider, disposed: false }; providers[key].push(item)
    return { dispose() { item.disposed = true } }
  }
  return {
    editor: { getModel: () => model },
    monaco: {
      MarkerSeverity: { Error: 8, Warning: 4 },
      Uri: { parse: text => ({ toString: () => text }) },
      Range: class { constructor(startLineNumber, startColumn, endLineNumber, endColumn) { Object.assign(this, { startLineNumber, startColumn, endLineNumber, endColumn }) } },
      editor: {
        setModelMarkers(_model, _owner, markers) { state.markers = markers },
        createModel(source, language, uri) {
          const item = { source, uri, language, version: 1, disposed: false, setValue(value) { item.source = value; item.version++ }, dispose() { item.disposed = true; files.delete(uri.toString()) } }
          files.set(uri.toString(), item); return item
        },
        setModelLanguage(_model, language) { state.modelLanguages.push(language) },
        createWebWorker(options) {
          state.backendOptions = options.createData.compilerOptions
          return { withSyncedResources: async () => ({
            getCompletionsAtPosition: (file, offset) => service.getCompletionsAtPosition(file, offset, {}),
            getQuickInfoAtPosition: (file, offset) => service.getQuickInfoAtPosition(file, offset),
            getSignatureHelpItems: (file, offset) => service.getSignatureHelpItems(file, offset, {}),
            getSyntacticDiagnostics: file => service.getSyntacticDiagnostics(file),
            getSemanticDiagnostics: file => service.getSemanticDiagnostics(file),
          }), dispose() {} }
        },
      },
      languages: {
        getLanguages: () => [], register() {}, setMonarchTokensProvider() {}, setLanguageConfiguration() {},
        CompletionItemKind: { Function: 1, Variable: 2 },
        CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
        registerCompletionItemProvider: register('completion'), registerHoverProvider: register('hover'), registerSignatureHelpProvider: register('signature'),
        typescript: {
          ScriptTarget: ts.ScriptTarget,
          javascriptDefaults: { setCompilerOptions(value) { state.compilerOptionsHistory.push(value) }, addExtraLib(...args) { state.extraLibs.push(args) } },
          getJavaScriptWorker: async () => async () => ({
            getCompletionsAtPosition: (file, offset) => service.getCompletionsAtPosition(file, offset, {}),
            getQuickInfoAtPosition: (file, offset) => service.getQuickInfoAtPosition(file, offset),
            getSignatureHelpItems: (file, offset) => service.getSignatureHelpItems(file, offset, {}),
          }),
        },
      },
    },
    state, model, service,
  }
}

test('JavaScript validation uses real grammar and types without executing scripts or leaking declaration errors', async () => {
  const { createJavascriptScriptEditorAdapter } = loadModule('script-editor-intelligence/javascript/adapter.ts')
  const context = createJavascriptContext()
  const adapter = createJavascriptScriptEditorAdapter(context)
  try {
    context.model.setValue('const value = ;')
    await adapter.apply(createMockSnapshot())
    await adapter.validate()
    assert.ok(context.state.markers.some(marker => marker.severity === 8 && /Expression expected/.test(marker.message)))
    context.model.setValue('const value: string = "hello";')
    await adapter.validate()
    assert.ok(context.state.markers.some(marker => /Type annotations/.test(marker.message)))
    context.model.setValue('const value = 1; value.toUpperCase();')
    await adapter.validate()
    assert.ok(context.state.markers.some(marker => /toUpperCase/.test(marker.message)))
    context.model.setValue('throw new Error("must never execute"); return $input.orderId;')
    await adapter.validate()
    assert.deepEqual(context.state.markers, [])
  } finally { adapter.dispose() }
})

test('javascript discards worker queries rejected after their document is disposed', async () => {
  const { createJavascriptScriptEditorAdapter } = loadModule('script-editor-intelligence/javascript/adapter.ts')
  const context = createJavascriptContext()
  let rejectQuery, started
  const queried = new Promise(resolve => { started = resolve })
  context.monaco.editor.createWebWorker = () => ({
    withSyncedResources: async () => ({ getCompletionsAtPosition() {
      started()
      return new Promise((_resolve, reject) => { rejectQuery = reject })
    } }),
    dispose() {},
  })
  const adapter = createJavascriptScriptEditorAdapter(context)
  await adapter.apply(createMockSnapshot())
  const provider = context.state.providers.completion.at(-1).provider
  const pending = provider.provideCompletionItems(context.model, { lineNumber: 1, column: 11 }, {}, {})
  await queried
  adapter.dispose()
  rejectQuery(new Error('Could not find source file: disposed virtual document'))
  assert.equal(await pending, null)
})

function createGroovyMonaco() {
  const providers = {
    completion: null,
    hover: null,
    signature: null,
  }
  const disposed = []

  const monaco = {
    Range: class Range {
      constructor(startLineNumber, startColumn, endLineNumber, endColumn) {
        this.startLineNumber = startLineNumber
        this.startColumn = startColumn
        this.endLineNumber = endLineNumber
        this.endColumn = endColumn
      }
    },
    languages: {
      CompletionItemKind: {
        Class: 'Class',
        Variable: 'Variable',
        Method: 'Method',
        Field: 'Field',
      },
      CompletionItemInsertTextRule: {
        InsertAsSnippet: 'InsertAsSnippet',
      },
      registerCompletionItemProvider(language, provider) {
        providers.completion = {
          language,
          provider,
        }
        return {
          dispose() {
            disposed.push('completion')
          },
        }
      },
      registerHoverProvider(language, provider) {
        providers.hover = {
          language,
          provider,
        }
        return {
          dispose() {
            disposed.push('hover')
          },
        }
      },
      registerSignatureHelpProvider(language, provider) {
        providers.signature = {
          language,
          provider,
        }
        return {
          dispose() {
            disposed.push('signature')
          },
        }
      },
    },
  }

  return {
    monaco,
    state: {
      disposed,
      providers,
    },
  }
}

function createTextModel(lineContent, uriText) {
  return {
    uri: {
      toString() {
        return uriText
      },
    },
    getLineContent() {
      return lineContent
    },
    getWordUntilPosition(position) {
      const prefix = lineContent.slice(0, position.column - 1)
      const match = prefix.match(/[A-Za-z_$][\w$]*$/)
      const word = match ? match[0] : ''
      return {
        word,
        startColumn: position.column - word.length,
        endColumn: position.column,
      }
    },
    getWordAtPosition(position) {
      const index = Math.max(0, position.column - 2)
      const left = lineContent.slice(0, index + 1)
      const right = lineContent.slice(index + 1)
      const leftMatch = left.match(/[A-Za-z_$][\w$]*$/)
      const rightMatch = right.match(/^[\w$]*/)
      const leftWord = leftMatch ? leftMatch[0] : ''
      const rightWord = rightMatch ? rightMatch[0] : ''
      const word = `${leftWord}${rightWord}`
      if (!word) {
        return null
      }
      return {
        word,
        startColumn: index + 2 - leftWord.length,
        endColumn: index + 2 + rightWord.length,
      }
    },
  }
}

test('bridge fetches mocked javascript snapshot and installs graaljs declarations', async () => {
  const { createScriptEditorIntelligenceBridge } = loadModule(
    'script-editor-intelligence/bridge.ts'
  )
  const context = createJavascriptContext()
  const snapshot = createMockSnapshot()
  const fetchCalls = []
  const bridge = createScriptEditorIntelligenceBridge({
    editor: context.editor,
    monaco: context.monaco,
  })

  const props = {
    codeSite: 'logicflow.script', codePointer: '/script',
    intelligenceApi: '/api/mock/code-intelligence/context',
    language: 'javascript',
    value: 'return LocalDate.now()',
    data: {
      __CURRENT_NODE_NAME: 'script-node-1',
      __CURRENT_NODE_TYPE: 'script',
      __FLOW_MODEL: {
        name: 'OrderFlow',
        nodes: [{ name: 'script-node-1', type: 'script' }],
      },
    },
    env: {
      async fetcher(api, body, options) {
        fetchCalls.push({ api, body, options })
        return {
          status: 0,
          data: { ...body, snapshot },
        }
      },
    },
  }

  await bridge.refresh(props)
  await bridge.refresh(props)

  assert.equal(fetchCalls.length, 1)
  assert.deepEqual(fetchCalls[0].api, {
    method: 'post',
    url: '/api/mock/code-intelligence/context',
    data: fetchCalls[0].body,
  })
  assert.equal(fetchCalls[0].body.codeSite, 'logicflow.script')
  assert.equal(fetchCalls[0].body.location.nodeName, 'script-node-1')
  assert.equal(fetchCalls[0].body.draft.nodes[0].script, context.model.getValue(), 'send the current document even when AMIS props lag')
  assert.equal(fetchCalls[0].body.documentId, context.model.uri.toString())
  assert.deepEqual(fetchCalls[0].body, fetchCalls[0].api.data)
  assert.deepEqual(fetchCalls[0].options, { ignoreData: true })
  const virtual = [...context.state.files.values()][0]
  assert.match(virtual.source, /export \{\};/)
  assert.match(virtual.source, /declare const \$input:/)
  assert.match(virtual.source, /type\(name: 'java\.time\.LocalDate'\)/)
  const completions = await context.state.providers.completion[0].provider.provideCompletionItems(context.model, { lineNumber: 1, column: 11 })
  assert(completions.suggestions.some(item => item.label === 'now'))
  assert.deepEqual(context.state.compilerOptionsHistory, [])
  assert.deepEqual(context.state.extraLibs, [])
  bridge.dispose()
  assert.equal(virtual.disposed, true)
  assert(context.state.providers.completion.every(item => item.disposed))

})

test('bridge accepts axios-style snapshot responses from env fetcher', async () => {
  const { createScriptEditorIntelligenceBridge } = loadModule(
    'script-editor-intelligence/bridge.ts'
  )
  const context = createJavascriptContext()
  const snapshot = createMockSnapshot()
  const warnings = []
  const bridge = createScriptEditorIntelligenceBridge({
    editor: context.editor,
    monaco: context.monaco,
  })
  const originalWarn = console.warn
  console.warn = (...args) => {
    warnings.push(args)
  }

  try {
    await bridge.refresh({
      codeSite: 'logicflow.script', codePointer: '/script',
      intelligenceApi: '/api/dev/playground-app/code-intelligence/context',
      language: 'javascript',
      value: 'return LocalDate.now()',
      data: {
        __CURRENT_NODE_NAME: 'script-node-1',
        __CURRENT_NODE_TYPE: 'script',
        __FLOW_MODEL: {
          name: 'OrderFlow',
          nodes: [{ name: 'script-node-1', type: 'script' }],
        },
      },
      env: {
        async fetcher(api) {
          return {
            status: 200,
            data: {
              code: 0,
              status: 0,
              msg: '',
              data: { ...api.data, snapshot },
            },
          }
        },
      },
    })
  } finally {
    console.warn = originalWarn
  }

  assert.equal(warnings.length, 0)
  const suggestions = await context.state.providers.completion.at(-1).provider.provideCompletionItems(
    context.model, { lineNumber: 1, column: 11 }, {}, {}
  )
  assert.ok(suggestions.suggestions.some(item => item.label === 'now'))
  bridge.dispose()
})

test('snapshot adapter exposes completions hover and signatures for expression profiles', () => {
  const { createGroovyScriptEditorAdapter } = loadModule(
    'script-editor-intelligence/groovy/adapter.ts'
  )
  const snapshot = createMockSnapshot()
  const groovy = createGroovyMonaco()
  const activeUri = 'inmemory://logicflow-script.groovy'
  const editorModel = createTextModel('', activeUri)
  const adapter = createGroovyScriptEditorAdapter({
    editor: {
      getModel() {
        return editorModel
      },
    },
    monaco: groovy.monaco,
  })

  adapter.apply(snapshot)

  const importSuggestions =
    groovy.state.providers.completion.provider.provideCompletionItems(
      createTextModel('import java.t', activeUri),
      { lineNumber: 1, column: 14 }
    ).suggestions
  assert.deepEqual(
    importSuggestions.map((item) => item.label),
    ['java.time.LocalDate']
  )

  const memberSuggestions =
    groovy.state.providers.completion.provider.provideCompletionItems(
      createTextModel('LocalDate.', activeUri),
      { lineNumber: 1, column: 11 }
    ).suggestions
  assert.deepEqual(
    memberSuggestions.map((item) => item.label),
    ['now', 'MIN']
  )

  const globalSuggestions =
    groovy.state.providers.completion.provider.provideCompletionItems(
      createTextModel('$input.', activeUri),
      { lineNumber: 1, column: 8 }
    ).suggestions
  assert.deepEqual(
    globalSuggestions.map((item) => item.label),
    ['orderId', 'submittedAt', 'toMap']
  )

  const hover = groovy.state.providers.hover.provider.provideHover(
    createTextModel('LocalDate.now', activeUri),
    { lineNumber: 1, column: 14 }
  )
  assert.match(hover.contents[0].value, /\*\*LocalDate\.now\*\*/)

  const signature = groovy.state.providers.signature.provider.provideSignatureHelp(
    createTextModel('new LocalDate(', activeUri),
    { lineNumber: 1, column: 15 }
  )
  assert.equal(signature.value.activeParameter, 0)
  assert.match(
    signature.value.signatures[0].label,
    /LocalDate\(arg0: int, arg1: int, arg2: int\)/
  )

  adapter.dispose()

  assert.deepEqual(groovy.state.disposed, ['signature', 'hover', 'completion'])
})

test('reference JavaScript candidates and members are labelled while draft fields remain ordinary', async () => {
  const { createJavascriptScriptEditorAdapter } = loadModule('script-editor-intelligence/javascript/adapter.ts')
  const context = createJavascriptContext()
  const snapshot = createMockSnapshot()
  snapshot.source = 'dev-platform-fallback'
  snapshot.globals[0].origin = 'DRAFT_INFERENCE'
  snapshot.globals[1].origin = 'PLATFORM_REFERENCE'
  snapshot.javaTypes[0].origin = 'PLATFORM_REFERENCE'
  const adapter = createJavascriptScriptEditorAdapter(context)
  try {
    await adapter.apply(snapshot)
    const provider = context.state.providers.completion[0].provider
    const references = (await provider.provideCompletionItems(context.model, { lineNumber: 1, column: 11 })).suggestions
    assert(references.some(item => item.label === 'now'))
    assert(references.every(item => item.detail.includes('平台参考') && item.sortText.startsWith('zz-reference-')))
    assert(references.every(item => item.documentation.value.includes('应用环境未验证')))
    context.model.setValue('$input.')
    const draft = (await provider.provideCompletionItems(context.model, { lineNumber: 1, column: 8 })).suggestions
    assert(draft.some(item => item.label === 'orderId'))
    assert(draft.every(item => !item.detail?.includes('平台参考')))
  } finally { adapter.dispose() }
})

test('expression candidates propagate reference provenance to nested members and hover', () => {
  const { createGroovyScriptEditorAdapter } = loadModule('script-editor-intelligence/groovy/adapter.ts')
  const snapshot = createMockSnapshot()
  snapshot.globals[0].origin = 'DRAFT_INFERENCE'
  snapshot.globals[1].origin = 'PLATFORM_REFERENCE'
  snapshot.javaTypes[0].origin = 'PLATFORM_REFERENCE'
  const fixture = createGroovyMonaco()
  const uri = 'inmemory://expression'
  const adapter = createGroovyScriptEditorAdapter({ editor: { getModel: () => createTextModel('', uri) }, monaco: fixture.monaco }, 'spel')
  adapter.apply(snapshot)
  const members = fixture.state.providers.completion.provider.provideCompletionItems(createTextModel('LocalDate.', uri), { lineNumber: 1, column: 11 }).suggestions
  assert(members.every(item => item.detail.includes('应用环境未验证')))
  const hover = fixture.state.providers.hover.provider.provideHover(createTextModel('LocalDate.now', uri), { lineNumber: 1, column: 14 })
  assert(hover.contents.some(item => item.value.includes('平台参考')))
  adapter.dispose()
})


test('javascript module scopes preserve nested shapes and local inference without leaking between editors', async () => {
  const { createJavascriptScriptEditorAdapter } = loadModule('script-editor-intelligence/javascript/adapter.ts')
  const context = createJavascriptContext()
  const snapshot = createMockSnapshot()
  snapshot.globals.push({ name: '$0', shape: { schema: { type: 'object', properties: { customer: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false } }, required: ['customer'], additionalProperties: false } } })
  context.model.setValue('const customer = $0.customer; customer.')
  const adapter = createJavascriptScriptEditorAdapter(context)
  await adapter.apply(snapshot)
  const provider = context.state.providers.completion[0].provider
  const items = await provider.provideCompletionItems(context.model, { lineNumber: 1, column: context.model.getValue().length + 1 })
  assert(items.suggestions.some(item => item.label === 'name'))
  assert.equal(await provider.provideCompletionItems(createTextModel('', 'inmemory://different-editor'), { lineNumber: 1, column: 1 }), null)
  const otherModel = context.monaco.editor.createModel('export {}; $input', 'typescript', context.monaco.Uri.parse('inmemory://other.ts'))
  assert.doesNotMatch(otherModel.source, /declare const \$input/)
  context.model.setValue('const localValue = 1; ')
  const roots = await provider.provideCompletionItems(context.model, { lineNumber: 1, column: context.model.getValue().length + 1 })
  assert(roots.suggestions.some(item => item.label === 'localValue'))
  assert(!roots.suggestions.some(item => ['window', 'document', 'alert', 'fetch'].includes(item.label)))
  adapter.dispose()
})

test('javascript global completion excludes browser ambient declarations', async () => {
  const { createJavascriptScriptEditorAdapter } = loadModule(
    'script-editor-intelligence/javascript/adapter.ts'
  )
  const context = createJavascriptContext()
  context.model.setValue('const localValue = 1; function localFunction() {} ')
  const adapter = createJavascriptScriptEditorAdapter(context)
  await adapter.apply(createMockSnapshot())
  const provider = context.state.providers.completion[0].provider
  const result = await provider.provideCompletionItems(context.model, {
    lineNumber: 1,
    column: context.model.getValue().length + 1,
  })
  const names = new Set(result.suggestions.map((item) => item.label))
  for (const name of [
    'window',
    'document',
    'fetch',
    'console',
    'setTimeout',
    'requestAnimationFrame',
    'localStorage',
    'HTMLElement',
    'XMLHttpRequest',
    'URL',
    'Request',
    'Response',
  ]) {
    assert(!names.has(name), `browser global leaked into suggestions: ${name}`)
  }
  for (const name of [
    'Array',
    'Math',
    'JSON',
    'Promise',
    'Java',
    '$input',
    'LocalDate',
    'localValue',
    'localFunction',
  ]) {
    assert(names.has(name), `script symbol missing from suggestions: ${name}`)
  }
  adapter.dispose()
})

test('javascript completion preserves business members named like browser globals', async () => {
  const { createJavascriptScriptEditorAdapter } = loadModule(
    'script-editor-intelligence/javascript/adapter.ts'
  )
  const context = createJavascriptContext()
  context.model.setValue(
    'const payload = { window: 1, document: "title", fetch: true }; payload.'
  )
  const adapter = createJavascriptScriptEditorAdapter(context)
  await adapter.apply(createMockSnapshot())
  const provider = context.state.providers.completion[0].provider
  const result = await provider.provideCompletionItems(context.model, {
    lineNumber: 1,
    column: context.model.getValue().length + 1,
  })
  assert.deepEqual(result.suggestions.map((item) => item.label).sort(), [
    'document',
    'fetch',
    'window',
  ])
  adapter.dispose()
})

test('javascript completion respects explicit runtime bindings and local shadowing', async () => {
  const { createJavascriptScriptEditorAdapter } = loadModule(
    'script-editor-intelligence/javascript/adapter.ts'
  )
  const context = createJavascriptContext()
  const snapshot = createMockSnapshot()
  snapshot.globals.push({ name: 'fetch', typeDisplayName: 'Object' })
  context.model.setValue('const window = { value: 1 }; ')
  const adapter = createJavascriptScriptEditorAdapter(context)
  await adapter.apply(snapshot)
  const provider = context.state.providers.completion[0].provider
  const result = await provider.provideCompletionItems(context.model, {
    lineNumber: 1,
    column: context.model.getValue().length + 1,
  })
  const names = new Set(result.suggestions.map((item) => item.label))
  assert(names.has('window'))
  assert(names.has('fetch'))
  assert(!names.has('document'))
  adapter.dispose()
})

test('bridge discards responses after newer requests and after disposal', async () => {
  const { createScriptEditorIntelligenceBridge } = loadModule('script-editor-intelligence/bridge.ts')
  const context = createJavascriptContext()
  const bridge = createScriptEditorIntelligenceBridge(context)
  const pending = []
  const props = { codeSite: 'logicflow.script', codePointer: '/script', language: 'javascript', intelligenceApi: '/context',
    data: { __CURRENT_NODE_NAME: 'node', __FLOW_MODEL: { name: 'flow', nodes: [{ name: 'node', type: 'script' }] } },
    env: { fetcher: (_api, body) => new Promise(resolve => pending.push({ resolve, body })) } }
  context.model.setValue('old')
  const first = bridge.refresh({ ...props, value: 'old' })
  context.model.setValue('new')
  const second = bridge.refresh({ ...props, value: 'new' })
  const respond = (index, token) => pending[index].resolve({ status: 0, data: { ...pending[index].body, snapshot: { ...createMockSnapshot(), versionToken: token } } })
  respond(1, 'new'); await second
  const installed = [...context.state.files.values()][0]
  respond(0, 'old'); await first
  assert.equal([...context.state.files.values()][0], installed)
  context.model.setValue('disposed')
  const third = bridge.refresh({ ...props, value: 'disposed' })
  bridge.dispose(); respond(2, 'disposed'); await third
  assert.equal(context.state.files.size, 0)
})

test('environment invalidation refreshes current app and detaches on app/language change', async () => {
  const { createScriptEditorIntelligenceBridge } = loadModule('script-editor-intelligence/bridge.ts')
  const context = createJavascriptContext()
  const subscriptions = new Map()
  const removed = []
  let requests = 0
  const bridge = createScriptEditorIntelligenceBridge({ ...context,
    subscribeEnvironment(app, invalidate) { subscriptions.set(app, invalidate); return () => { removed.push(app); subscriptions.delete(app) } },
  })
  const props = { codeSite: 'node.script', codePointer: '/script', language: 'javascript', intelligenceApi: '/api/dev/first/code-intelligence/context',
    data: { __CURRENT_NODE_NAME: 'node', __FLOW_MODEL: { name: 'flow', nodes: [{ name: 'node', type: 'script' }] } },
    env: { fetcher: async (_api, body) => { requests++; return { status: 0, data: { ...body, snapshot: { ...createMockSnapshot(), versionToken: `v${requests}` } } } } },
  }
  await bridge.refresh(props)
  subscriptions.get('first')()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(requests, 2)
  await bridge.refresh({ ...props, intelligenceApi: '/api/dev/second/code-intelligence/context' })
  assert.deepEqual(removed, ['first'])
  await bridge.refresh({ ...props, language: '' })
  assert.deepEqual(removed, ['first', 'second'])
  assert.equal(context.state.files.size, 0)
  bridge.dispose()
})

test('context requests use enclosing AMIS resource and overlay only the current pointer', () => {
  const { buildCodeContextRequest } = loadModule('script-editor-intelligence/api.ts')
  const root = { name: 'rpc', type: 'OpenApi', request: { url: '/old', parameters: [{ name: 'id', value: '${old}' }] } }
  const row = { name: 'id', value: '${old}', __super: root }
  const identity = { documentId: 'editor', documentVersion: 4, draftRevision: 2 }
  const result = buildCodeContextRequest({ codeSite: 'rpc.value', codeResourceType: 'rpc-model', codePointer: '/request/parameters/*/value',
    language: 'rpc-template', value: '${newValue}', data: row, index: 0 }, identity)
  assert.equal(result.resource.name, 'rpc')
  assert.equal(result.draft.request.parameters[0].value, '${newValue}')
  assert.equal(root.request.parameters[0].value, '${old}')
  assert.equal(result.documentVersion, 4)
  assert.equal(buildCodeContextRequest({ codeSite: 'invalid', codeResourceType: 'rpc-model', codePointer: '/__proto__/pollute', language: 'rpc-template', data: root }, identity), null)
})

test('RPC template completion separates configuration keys, expression members and literal text', () => {
  const { createTemplateEditorAdapter } = loadModule('script-editor-intelligence/template/adapter.ts')
  const context = createJavascriptContext()
  const snapshot = createMockSnapshot()
  snapshot.languageProjectionHints.configurationKeys = [{ key: 'rpc.base-url', valueType: 'STRING', label: '服务地址' }]
  const adapter = createTemplateEditorAdapter(context)
  adapter.apply(snapshot)
  const provider = context.state.providers.completion[0].provider
  const items = text => provider.provideCompletionItems(createTextModel(text, context.model.uri.toString()), { lineNumber: 1, column: text.length + 1 }).suggestions
  assert.deepEqual(items('#{rpc.ba').map(item => item.label), ['rpc.base-url'])
  assert.equal(items('#{rpc.ba')[0].range.startColumn, 3)
  assert.deepEqual(items('${$input.').map(item => item.label), ['orderId', 'submittedAt', 'toMap'])
  assert.deepEqual(items('https://service/'), [])
  snapshot.languageProjectionHints.templateMode = 'config-only'
  assert.deepEqual(items('${$input.'), [])
  adapter.dispose()
  assert(context.state.providers.completion.every(item => item.disposed))
})


test('JSON mapping completion edits decoded string values and preserves keys, arrays and escaping', () => {
  const { createJsonExpressionAdapter, jsonStringAt } = loadModule('script-editor-intelligence/json/adapter.ts')
  const context = createJavascriptContext()
  const snapshot = createMockSnapshot()
  snapshot.languageProjectionHints.embeddedExpressionMode = 'template'
  const adapter = createJsonExpressionAdapter(context)
  adapter.apply(snapshot)
  const provider = context.state.providers.completion[0].provider
  const run = (text, offset = text.length) => {
    const model = { ...createTextModel(text, context.model.uri.toString()), getValue: () => text,
      getOffsetAt: pos => pos.column - 1, getPositionAt: pos => ({ lineNumber: 1, column: pos + 1 }) }
    return provider.provideCompletionItems(model, { lineNumber: 1, column: offset + 1 }).suggestions
  }
  const text = '{"nested": {"value": "${$input.'
  assert.deepEqual(run(text).map(item => item.label), ['orderId', 'submittedAt', 'toMap'])
  assert.equal(run(text)[0].range.startColumn, text.length + 1)
  assert.equal(run('{"${$input.').length, 0)
  assert.equal(run('{"value": "literal').length, 0)
  assert.equal(run('{"value": 10').length, 0)
  snapshot.languageProjectionHints.embeddedExpressionMode = 'bare'
  snapshot.languageProjectionHints.embeddedArrayValues = false
  assert.equal(run('{"value": ["$input.').length, 0)
  assert(run('{"value": "$input.').some(item => item.label === 'orderId'))
  assert.equal(jsonStringAt('{"v":"a\\u002eb"}', 13).value, 'a.b')
  adapter.dispose()
  assert(context.state.providers.completion.every(item => item.disposed))
})

test('nullable and nested union schemas retain member completion', () => {
  const { resolveShapeMembers } = loadModule('script-editor-intelligence/shape.ts')
  const snapshot = { globals: [{ name: 'record', shape: { schema: { anyOf: [
    { type: 'object', properties: { id: { type: 'integer' }, child: { oneOf: [{ type: 'null' }, { type: 'object', properties: { name: { type: 'string' } } }] } } }, { type: 'null' },
  ] } } }] }
  assert.deepEqual(resolveShapeMembers(snapshot, 'record').map(item => item.name), ['id', 'child'])
  assert.deepEqual(resolveShapeMembers(snapshot, 'record.child').map(item => item.name), ['name'])
})

test('backend javascript has ECMAScript and Graal globals without DOM on globalThis or explicit browser names', async () => {
  const { createJavascriptScriptEditorAdapter } = loadModule('script-editor-intelligence/javascript/adapter.ts')
  const context = createJavascriptContext()
  const snapshot = createMockSnapshot()
  snapshot.languageProjectionHints = { javascript: { engineGlobals: [
    { name: 'Java', kind: 'object', members: [{ name: 'type', kind: 'function' }, { name: 'from', kind: 'function' }] },
    { name: 'Polyglot', kind: 'object', members: [{ name: 'import', kind: 'function' }] },
    { name: 'print', kind: 'function', members: [] },
    { name: 'Array', kind: 'function', members: [] },
  ] } }
  const adapter = createJavascriptScriptEditorAdapter(context)
  await adapter.apply(snapshot)
  const provider = context.state.providers.completion[0].provider
  const complete = async text => {
    context.model.setValue(text)
    const result = await provider.provideCompletionItems(context.model, { lineNumber: 1, column: text.length + 1 }, {}, {})
    return (result?.suggestions || []).map(item => item.label)
  }
  const global = await complete('globalThis.')
  for (const name of ['Java', 'Polyglot', 'print', 'Array']) assert(global.includes(name), name)
  for (const name of ['window', 'document', 'fetch', 'localStorage', 'navigator', 'setTimeout', 'process', 'require']) assert(!global.includes(name), name)
  for (const name of ['window', 'document', 'navigator', 'localStorage']) assert.deepEqual(await complete(`${name}.`), [])
  assert((await complete('Java.')).includes('from'))
  assert((await complete('Polyglot.')).includes('import'))
  assert((await complete('const name = "test"; name.')).includes('toUpperCase'))
  assert.equal(context.state.compilerOptionsHistory.length, 0)
  adapter.dispose()
})

test('failed LSP and fallback requests are contained during refresh and reported by explicit validation', async () => {
  const { createScriptEditorIntelligenceBridge } = loadModule('script-editor-intelligence/bridge.ts')
  const context = createJavascriptContext()
  const bridge = createScriptEditorIntelligenceBridge(context)
  const unavailable = new Error('Editor service unavailable')
  const props = { codeSite: 'business-model.api-script', codeResourceType: 'business-model',
    codePointer: '/apis/search/beforeScript', language: 'unavailable-fixture', intelligenceApi: '/api/dev/app/code-intelligence/context',
    data: { name: 'Business', apis: { search: { beforeScript: 'return input' } } },
    env: { fetcher: async () => { throw unavailable } } }
  try {
    await assert.doesNotReject(bridge.refresh(props))
    await assert.rejects(bridge.validate(props), error => error === unavailable)
  } finally { bridge.dispose() }
})

for (const dispose of [false, true]) test(`late LSP failure preserves ${dispose ? 'disposal' : 'the newer language adapter'}`, async () => {
  const { createScriptEditorIntelligenceBridge } = loadModule('script-editor-intelligence/bridge.ts')
  const context = createJavascriptContext()
  const bridge = createScriptEditorIntelligenceBridge(context)
  let rejectSession
  const props = { codeSite: 'business-model.api-script', codeResourceType: 'business-model',
    codePointer: '/apis/search/beforeScript', language: 'unavailable-fixture', intelligenceApi: '/api/dev/app/code-intelligence/context',
    data: { name: 'Business', apis: { search: { beforeScript: 'return input' } } },
    env: { fetcher: async api => {
      if (api.url.endsWith('/sessions')) return new Promise((_resolve, reject) => { rejectSession = reject })
      throw new Error('Previous service unavailable')
    } } }
  try {
    const previous = bridge.refresh(props)
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(typeof rejectSession, 'function')
    await bridge.refresh({ ...props, language: 'javascript', env: { fetcher: async (_api, body) =>
      ({ status: 0, data: { ...body, snapshot: createMockSnapshot() } }) } })
    assert(context.state.files.size > 0)
    if (dispose) bridge.dispose()
    const installed = [...context.state.files.entries()]
    rejectSession(new Error('Previous service unavailable'))
    await assert.doesNotReject(previous)
    assert.deepEqual([...context.state.files.entries()], installed)
  } finally { bridge.dispose() }
})

test('unavailable semantic service uses labelled reference candidates until the environment changes', async () => {
  const { createScriptEditorIntelligenceBridge } = loadModule('script-editor-intelligence/bridge.ts')
  const { registerEditorLanguagePlugin } = requireMirroredSrcModule(__filename, './script-editor-intelligence/languagePlugins.ts')
  const { createGroovyScriptEditorAdapter } = requireMirroredSrcModule(__filename, './script-editor-intelligence/groovy/adapter.ts')
  const registration = registerEditorLanguagePlugin({ languageId: 'reference-fixture',
    createReferenceAdapter: context => createGroovyScriptEditorAdapter(context, 'reference-fixture') })
  const context = createJavascriptContext(), calls = []
  const snapshot = createMockSnapshot()
  snapshot.source = 'dev-platform-fallback'
  snapshot.globals.forEach(binding => { binding.origin = 'PLATFORM_REFERENCE' })
  snapshot.javaTypes.forEach(type => { type.origin = 'PLATFORM_REFERENCE' })
  context.model.setValue('LocalDate.')
  let invalidate
  const bridge = createScriptEditorIntelligenceBridge({ ...context, subscribeEnvironment: (_app, listener) => {
    invalidate = listener; return () => { invalidate = undefined }
  } })
  const props = { codeSite: 'logicflow.script', codePointer: '/script', language: 'reference-fixture',
    intelligenceApi: '/api/dev/app/code-intelligence/context', data: { __CURRENT_NODE_NAME: 'script',
      __FLOW_MODEL: { name: 'flow', nodes: [{ name: 'script', type: 'script' }] } },
    env: { fetcher: async (api, body) => {
      calls.push(api.url)
      if (api.url.endsWith('/sessions')) throw new Error('Application is unavailable')
      return { status: 0, data: { ...body, snapshot } }
    } } }
  try {
    await bridge.refresh(props)
    await bridge.refresh({ ...props, value: 'LocalDate.n' })
    assert.equal(calls.filter(url => url.endsWith('/sessions')).length, 1)
    const result = context.state.providers.completion.at(-1).provider.provideCompletionItems(context.model, { lineNumber: 1, column: 11 })
    assert(result.suggestions.some(item => item.label === 'now' && item.detail.includes('应用环境未验证')))
    assert.equal(typeof invalidate, 'function')
  } finally { bridge.dispose(); registration.dispose() }
})
