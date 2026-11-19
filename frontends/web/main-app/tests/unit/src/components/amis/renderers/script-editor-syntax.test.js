import { expect, test, vi } from 'vitest'
import { applySyntaxDiagnostics } from 'ouroboros-amis-runtime/renderers/script-editor-intelligence/syntax'
import { createScriptEditorIntelligenceBridge } from 'ouroboros-amis-runtime/renderers/script-editor-intelligence/bridge'

function fixture(initial = '${value +}') {
  let text = initial,
    version = 1
  const listeners = new Set(),
    markers = new Map()
  const model = {
    uri: { toString: () => 'inmemory://syntax-editor' },
    getValue: () => text,
    getVersionId: () => version,
    onDidChangeContent: (fn) => {
      listeners.add(fn)
      return { dispose: () => listeners.delete(fn) }
    },
    getPositionAt: (offset) => {
      const lines = text.slice(0, offset).split(/\r\n|\r|\n/)
      return { lineNumber: lines.length, column: lines.at(-1).length + 1 }
    },
    setValue: (value) => {
      text = value
      version++
      listeners.forEach((fn) => fn())
    },
  }
  const languages = {
    getLanguages: () => [{ id: 'template' }],
    register() {},
    setMonarchTokensProvider() {},
    registerCompletionItemProvider: () => ({ dispose() {} }),
    registerHoverProvider: () => ({ dispose() {} }),
  }
  const monaco = {
    MarkerSeverity: { Error: 8, Warning: 4 },
    languages,
    editor: {
      setModelLanguage() {},
      setModelMarkers: (_model, owner, value) => markers.set(owner, value),
    },
  }
  return { editor: { getModel: () => model }, monaco, model, markers }
}

const issue = (path = []) => ({
  source: 'ouroboros-syntax',
  message: 'missing expression',
  severity: 1,
  path,
  range: { start: { line: 0, character: 8 }, end: { line: 0, character: 9 } },
})
const snapshot = (diagnostics) => ({
  source: 'unavailable',
  runtimeProfile: 'template',
  versionToken: 'version',
  globals: [],
  javaTypes: [],
  javaImports: [],
  diagnostics,
  languageProjectionHints: { syntaxDiagnostics: true },
})

test('syntax diagnostics map decoded JSON strings through escapes and UTF-16 columns', () => {
  const f = fixture('{"nested": {"text": "😀\\n${value +}"}, "literal": "text"}')
  const diagnostic = issue(['nested', 'text'])
  diagnostic.range = { start: { line: 1, character: 8 }, end: { line: 1, character: 9 } }
  applySyntaxDiagnostics(
    f,
    snapshot([diagnostic, { message: 'domain shape unknown', code: 'unknown-binding' }]),
    true
  )
  const [marker] = f.markers.get('editor-syntax')
  expect(marker.severity).toBe(8)
  expect(marker.startLineNumber).toBe(1)
  const rawOffset = f.model.getValue().indexOf('${value +}') + 8
  expect(marker.startColumn).toBe(rawOffset + 1)
  expect(marker.endColumn).toBe(rawOffset + 2)
  applySyntaxDiagnostics(f, snapshot([]), true)
  expect(f.markers.get('editor-syntax')).toEqual([])
})

test('syntax ranges preserve CR, CRLF and LF line boundaries in text and decoded JSON', () => {
  for (const newline of ['\r', '\r\n', '\n']) {
    const text = `literal${newline}\t${'${value +}'}`
    const diagnostic = {
      ...issue(),
      range: { start: { line: 1, character: 9 }, end: { line: 1, character: 10 } },
    }
    const plain = fixture(text)
    applySyntaxDiagnostics(plain, snapshot([diagnostic]), false)
    expect(plain.markers.get('editor-syntax')[0]).toMatchObject({
      startLineNumber: 2,
      startColumn: 10,
      endColumn: 11,
    })
    const json = fixture(JSON.stringify({ expression: text }))
    applySyntaxDiagnostics(
      json,
      snapshot([{ ...diagnostic, path: ['expression'] }]),
      true
    )
    expect(json.markers.get('editor-syntax')[0].startColumn).toBe(
      json.model.getValue().indexOf('${value +}') + 9
    )
  }
})

test('only the latest document diagnostic is applied and repeated context versions still clear corrected errors', async () => {
  vi.useFakeTimers()
  const f = fixture()
  const pending = []
  const props = {
    language: 'template',
    codeSite: 'test.value',
    codePointer: '/value',
    codeResourceType: 'configuration',
    intelligenceApi: '/api/dev/app/code-intelligence/context',
    data: { name: 'sample', key: 'sample', value: '' },
    env: {
      fetcher: (api, body) => new Promise((resolve) => pending.push({ resolve, body })),
    },
  }
  const bridge = createScriptEditorIntelligenceBridge(f)
  const respond = (index, diagnostics) =>
    pending[index].resolve({
      status: 0,
      data: { ...pending[index].body, snapshot: snapshot(diagnostics) },
    })
  try {
    const first = bridge.refresh({ ...props, value: 'old AMIS props' })
    expect(pending[0].body.draft.value).toBe('${value +}')
    respond(0, [issue()])
    await first
    expect(bridge.diagnosticOwner).toBe('editor-syntax')
    expect(f.markers.get('editor-syntax')).toHaveLength(1)
    f.model.setValue('${value + 1}')
    expect(f.markers.get('editor-syntax')).toEqual([])
    const obsolete = bridge.refresh(props)
    f.model.setValue('${value + 2}')
    const latest = bridge.validate(props)
    respond(2, [])
    await latest
    respond(1, [issue()])
    await obsolete
    expect(f.markers.get('editor-syntax')).toEqual([])
    expect(pending[2].body.documentVersion).toBe(3)
  } finally {
    bridge.dispose()
    vi.useRealTimers()
  }
})

test('changing a document and returning to the same text still obtains current-version syntax diagnostics', async () => {
  const f = fixture()
  let calls = 0
  const props = {
    language: 'template',
    codeSite: 'test.value',
    codePointer: '/value',
    codeResourceType: 'configuration',
    intelligenceApi: '/api/dev/app/code-intelligence/context',
    data: { name: 'sample', key: 'sample', value: '' },
    env: {
      fetcher: async (api, body) => {
        calls++
        return { status: 0, data: { ...body, snapshot: snapshot([issue()]) } }
      },
    },
  }
  const bridge = createScriptEditorIntelligenceBridge(f)
  try {
    await bridge.refresh(props)
    f.model.setValue('other')
    f.model.setValue('${value +}')
    await bridge.validate(props)
    expect(calls).toBe(2)
    expect(f.markers.get('editor-syntax')).toHaveLength(1)
  } finally {
    bridge.dispose()
  }
})
