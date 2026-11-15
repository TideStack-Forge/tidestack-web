const assert = require('node:assert/strict')
const path = require('node:path')
const { registerTypescriptRequire, requireMirroredSrcModule } = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))
registerTypescriptRequire()
const { EditorLspSession } = requireMirroredSrcModule(__filename, './script-editor-intelligence/lsp/session.ts')

function fixture() {
  let version = 1, text = 'String text = "hello"', listener
  const calls = [], markers = []
  const model = { getVersionId: () => version, getValue: () => text, uri: { toString: () => 'inmemory://groovy' },
    onDidChangeContent: callback => { listener = callback; return { dispose() { listener = undefined } } } }
  const props = { codeSite: 'logicflow.script', codePointer: '/script', language: 'groovy', intelligenceApi: '/api/dev/app/code-intelligence/context',
    data: { __FLOW_MODEL: { name: 'flow', nodes: [{ name: 'script', script: text }] }, __CURRENT_NODE_NAME: 'script' },
    env: { fetcher: async ({ method, url, data }) => {
      calls.push({ method, url, data })
      if (url.endsWith('/sessions')) return { status: 0, data: { sessionId: 'session', uri: 'ouroboros://session', contextVersion: 'v1', messages: [] } }
      const messages = Array.isArray(data) ? data.filter(message => message.id).map(message => ({ id: `session:${message.id}`, result: [{ label: 'substring' }] })) : []
      return { status: 0, data: { messages } }
    } } }
  const session = new EditorLspSession({ editor: { getModel: () => model }, monaco: { MarkerSeverity: { Error: 8, Warning: 4 }, editor: { setModelMarkers: (_model, _owner, value) => markers.push(value) } } }, props)
  return { session, props, calls, markers, change: value => { text = value; version++; listener?.() } }
}

test('uses named LSP batches and synchronizes the current document before requesting completion', async () => {
  const f = fixture()
  try {
    await f.session.refresh(f.props)
    f.change('String text = "hello"\ntext.')
    assert.deepEqual(await f.session.request('textDocument/completion', { position: { line: 1, character: 5 } }), [{ label: 'substring' }])
    const changes = f.calls.flatMap(call => Array.isArray(call.data) ? call.data : []).filter(message => message.method === 'textDocument/didChange')
    assert.equal(changes.at(-1).params.contentChanges[0].text, 'String text = "hello"\ntext.')
    assert.equal(changes.at(-1).params.textDocument.version, 2)
    await f.session.refresh({ ...f.props, data: { ...f.props.data, __FLOW_MODEL: { ...f.props.data.__FLOW_MODEL, inputSchema: { type: 'string' } } } })
    assert.equal(f.calls.filter(call => call.url.endsWith('/context')).length, 2)
  } finally { f.session.dispose() }
  assert.equal(f.calls.at(-1).method, 'delete')
  assert.deepEqual(f.markers.at(-1), [])
})

test('does not send cancelled language requests or reopen a disposed editor', async () => {
  const f = fixture()
  await f.session.refresh(f.props)
  const count = f.calls.length
  assert.equal(await f.session.request('textDocument/hover', {}, { isCancellationRequested: true }), null)
  assert.equal(f.calls.length, count)
  f.session.dispose()
  await f.session.refresh(f.props)
  assert.equal(await f.session.request('textDocument/completion', {}), null)
  assert.equal(f.calls.filter(call => call.url.endsWith('/sessions')).length, 1)
})


test('a new language negotiates only its declared Monaco features using the shared session', async () => {
  const { createLspAdapter } = requireMirroredSrcModule(__filename, './script-editor-intelligence/lsp/adapter.ts')
  const f = fixture()
  f.session.dispose()
  const registrations = [], calls = []
  const model = { uri: { toString: () => 'inmemory://fixture' }, getValue: () => 'customer:', getVersionId: () => 1,
    onDidChangeContent: () => ({ dispose() {} }) }
  const props = { ...f.props, language: 'fixture-language', env: { fetcher: async ({ method, url, data }) => {
    calls.push({ method, url, data })
    if (url.endsWith('/sessions')) return { status: 0, data: { sessionId: 'fixture', uri: 'ouroboros://fixture', messages: [
      { id: 'init', result: { capabilities: { completionProvider: { triggerCharacters: [':'] } } } },
    ] } }
    return { status: 0, data: { messages: Array.isArray(data) ? data.filter(m => m.id).map(m => ({ id: m.id, result: [{ label: 'customerName' }] })) : [] } }
  } } }
  const context = { editor: { getModel: () => model }, monaco: {
    languages: { CompletionItemKind: { Text: 0 }, registerCompletionItemProvider: (language, provider) => {
      const item = { language, provider, disposed: false }; registrations.push(item)
      return { dispose() { item.disposed = true } }
    } }, editor: { setModelMarkers() {} },
  } }
  const adapter = await createLspAdapter(context, props)
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].language, 'fixture-language')
  assert.deepEqual(registrations[0].provider.triggerCharacters, [':'])
  const result = await registrations[0].provider.provideCompletionItems(model, { lineNumber: 1, column: 10 }, {}, {})
  assert.equal(result.suggestions[0].label, 'customerName')
  assert.equal(calls[0].data.context.language, 'fixture-language')
  adapter.dispose()
  assert.equal(registrations[0].disposed, true)
  assert.equal(calls.at(-1).method, 'delete')
})


test('retires a failed process session and reopens the current text on the next request', async () => {
  const f = fixture()
  const original = f.props.env.fetcher
  let fail = true
  f.props.env.fetcher = async api => {
    if (fail && api.url.endsWith('/messages') && api.data.some(m => m.id)) {
      fail = false
      return { status: 1, msg: 'Language session expired' }
    }
    return original(api)
  }
  try {
    await f.session.refresh(f.props)
    await assert.rejects(f.session.request('textDocument/completion', {}), /expired/)
    assert.deepEqual(await f.session.request('textDocument/completion', {}), [{ label: 'substring' }])
    assert.equal(f.calls.filter(call => call.method === 'post' && call.url.endsWith('/sessions')).length, 2)
  } finally { f.session.dispose() }
})


test('diagnostics are scoped to the current document version and clearing results remove markers', async () => {
  const f = fixture()
  const original = f.props.env.fetcher
  let notifications = []
  f.props.env.fetcher = async api => {
    const response = await original(api)
    if (api.url.endsWith('/messages')) response.data.messages.push(...notifications)
    return response
  }
  const diagnostic = (uri, version, message) => ({ jsonrpc: '2.0', method: 'textDocument/publishDiagnostics', params: { uri, version,
    diagnostics: message ? [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, severity: 1, message }] : [] } })
  try {
    await f.session.refresh(f.props)
    f.change('changed')
    notifications = [diagnostic('ouroboros://session', 1, 'stale'), diagnostic('ouroboros://other', 2, 'other'), diagnostic('ouroboros://session', 2, 'current')]
    await f.session.request('textDocument/completion', {})
    assert.deepEqual(f.markers.at(-1).map(marker => marker.message), ['current'])
    notifications = [diagnostic('ouroboros://session', 2)]
    await f.session.request('textDocument/hover', {})
    assert.deepEqual(f.markers.at(-1), [])
  } finally { f.session.dispose() }
})
