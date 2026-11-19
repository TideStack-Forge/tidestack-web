const PLAYGROUND_APP_NAME = 'playground-app'

const PLAYGROUND_FLOW_MODEL = {
  name: 'MockOrderFlow',
  entryNode: 'script-node-1',
  inputSchema: { type: 'object', properties: { orderId: { type: 'string' }, submittedAt: { type: 'string' } } },
  nodes: [
    {
      id: 'script-node-1',
      name: 'script-node-1',
      type: 'script',
    },
  ],
}

const BASE_SNAPSHOT = {
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function buildPlaygroundMockSnapshot(request) {
  const language = request && request.language ? request.language : 'unknown'
  return Object.assign(cloneJson(BASE_SNAPSHOT), {
    source: 'playground-mock',
    runtimeProfile: 'playground-mock',
    versionToken: `${language}-playground-v1`,
  })
}

/** Protocol fixture only: fixed candidates exercise the production LSP client, without a compiler. */
function createPlaygroundLanguageMock(buildSnapshot = buildPlaygroundMockSnapshot) {
  const sessions = new Map()
  let sequence = 0
  return function dispatch(method, url, body) {
    const match = url?.match(/\/code-intelligence\/sessions(?:\/([^/]+)(?:\/(context|messages|notifications))?)?$/)
    if (!match) return undefined
    const id = match[1]
    if (!id && method === 'post') {
      const sessionId = `mock-${++sequence}`
      const uri = `ouroboros://mock/${sessionId}`
      sessions.set(sessionId, { text: body.text, snapshot: buildSnapshot(body.context) })
      return { sessionId, uri, messages: [{ jsonrpc: '2.0', id: 'initialize', result: {
        capabilities: { completionProvider: { triggerCharacters: ['.'] } },
      } }] }
    }
    const session = sessions.get(id)
    if (!session) throw new Error('Mock language session not found')
    if (method === 'delete') { sessions.delete(id); return {} }
    if (match[2] !== 'messages') return { messages: [] }
    const messages = []
    for (const message of body || []) {
      if (message.method === 'textDocument/didChange') session.text = message.params.contentChanges.at(-1).text
      if (message.id == null) continue
      const position = message.params?.position
      const prefix = position ? session.text.split('\n')[position.line].slice(0, position.character) : ''
      const receiver = prefix.match(/([\w$]+)\.[\w$]*$/)?.[1]
      const global = session.snapshot.globals.find(item => item.name === receiver)
      const candidates = receiver ? global?.members || [] : session.snapshot.globals
      messages.push({ jsonrpc: '2.0', id: message.id, result: message.method === 'textDocument/completion'
        ? candidates.map(item => ({ label: item.name, insertText: item.name, kind: item.memberKind === 'method' ? 2 : 10 })) : null })
    }
    return { messages }
  }
}

module.exports = {
  PLAYGROUND_APP_NAME,
  PLAYGROUND_FLOW_MODEL,
  buildPlaygroundMockSnapshot,
  createPlaygroundLanguageMock,
}
