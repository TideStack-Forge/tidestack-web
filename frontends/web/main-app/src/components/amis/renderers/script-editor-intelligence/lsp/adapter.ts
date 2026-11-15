import type { ScriptEditorAdapterContext, ScriptEditorPropsLike } from '../types'
import { EditorLspSession, lspPosition, monacoRange } from './session'

/** Monaco 0.30 providers consume standard LSP results without upgrading the shared editor. */
export async function createLspAdapter(context: ScriptEditorAdapterContext, props: ScriptEditorPropsLike) {
  const { monaco, editor } = context
  const model = editor.getModel()
  const uri = model.uri.toString()
  const session = new EditorLspSession(context, props)
  try { await session.refresh(props) } catch (error) { session.dispose(); throw error }
  const capabilities = session.getCapabilities()
  const language = props.language!
  const providers: { dispose(): void }[] = []
  const scoped = (provide: (...args: any[]) => any) => (current: any, ...args: any[]) =>
    current.uri.toString() === uri ? provide(current, ...args) : undefined
  const request = (method: string, position: any, token: any, extra = {}) => session.request(
    `textDocument/${method}`, { position: lspPosition(position), ...extra }, token)
  const locations = (values: any) => (Array.isArray(values) ? values : values ? [values] : []).filter((location: any) => (location.targetUri || location.uri) === session.documentUri()).map((location: any) => ({
    uri: model.uri, range: monacoRange(location.targetSelectionRange || location.range),
  }))
  const workspaceEdit = (value: any) => {
    const changes = value?.documentChanges || Object.entries(value?.changes || {}).map(([uri, edits]) => ({ textDocument: { uri }, edits }))
    return { edits: changes.flatMap((change: any) => {
      // Sessions expose one virtual document. Never silently apply another file's edits here.
      if (change.textDocument?.uri !== session.documentUri()) throw new Error('跨文档编辑暂不支持')
      return (change.edits || []).map((edit: any) => ({ resource: model.uri, modelVersionId: change.textDocument.version ?? undefined,
        edit: { range: monacoRange(edit.range), text: edit.newText } }))
    }) }
  }
  const markdown = (value: any) => typeof value === 'string' ? value : value?.value || ''
  const kind = (value: number) => ({ 2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function, 5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable, 7: monaco.languages.CompletionItemKind.Class,
    10: monaco.languages.CompletionItemKind.Property }[value] ?? monaco.languages.CompletionItemKind.Text)

  if (capabilities.completionProvider) providers.push(monaco.languages.registerCompletionItemProvider(language, {
    triggerCharacters: capabilities.completionProvider.triggerCharacters || [],
    provideCompletionItems: scoped(async (_model, position, _completionContext, token) => {
      const response = await request('completion', position, token)
      return { suggestions: (Array.isArray(response) ? response : response?.items || []).map((item: any) => ({
        label: item.label, kind: kind(item.kind), detail: item.detail, documentation: markdown(item.documentation),
        insertText: item.textEdit?.newText ?? item.insertText ?? item.label,
        range: item.textEdit?.range ? monacoRange(item.textEdit.range) : undefined,
        sortText: item.sortText, filterText: item.filterText,
      })) }
    }),
  }))
  if (capabilities.hoverProvider) providers.push(monaco.languages.registerHoverProvider(language, {
    provideHover: scoped(async (_model, position, token) => {
      const value = await request('hover', position, token)
      return value ? { range: value.range && monacoRange(value.range), contents: [{ value: markdown(value.contents) }] } : null
    }),
  }))
  if (capabilities.signatureHelpProvider) providers.push(monaco.languages.registerSignatureHelpProvider(language, {
    signatureHelpTriggerCharacters: capabilities.signatureHelpProvider.triggerCharacters || [],
    provideSignatureHelp: scoped(async (_model, position, token) => {
      const value = await request('signatureHelp', position, token)
      return value ? { value: { ...value, activeSignature: value.activeSignature ?? 0, activeParameter: value.activeParameter ?? 0 }, dispose() {} } : null
    }),
  }))
  if (capabilities.definitionProvider) providers.push(monaco.languages.registerDefinitionProvider(language, {
    provideDefinition: scoped(async (_model, position, token) => locations(await request('definition', position, token))),
  }))
  if (capabilities.referencesProvider) providers.push(monaco.languages.registerReferenceProvider(language, {
    provideReferences: scoped(async (_model, position, referenceContext, token) => locations(await request('references', position, token, { context: referenceContext }))),
  }))
  if (capabilities.renameProvider) providers.push(monaco.languages.registerRenameProvider(language, {
    provideRenameEdits: scoped(async (_model, position, newName, token) => workspaceEdit(await request('rename', position, token, { newName }))),
  }))
  if (capabilities.documentSymbolProvider) providers.push(monaco.languages.registerDocumentSymbolProvider(language, {
    provideDocumentSymbols: scoped(async (_model, token) => {
      const values = await session.request('textDocument/documentSymbol', {}, token)
      return (values || []).map((symbol: any) => ({ ...symbol, kind: symbol.kind - 1,
        range: monacoRange(symbol.range), selectionRange: monacoRange(symbol.selectionRange) }))
    }),
  }))
  if (capabilities.documentFormattingProvider) providers.push(monaco.languages.registerDocumentFormattingEditProvider(language, {
    provideDocumentFormattingEdits: scoped(async (_model, options, token) => {
      const values = await session.request('textDocument/formatting', { options }, token)
      return (values || []).map((edit: any) => ({ range: monacoRange(edit.range), text: edit.newText }))
    }),
  }))
  if (capabilities.codeActionProvider) providers.push(monaco.languages.registerCodeActionProvider(language, {
    provideCodeActions: scoped(async (_model, range, _actionContext, token) => {
      const values = await session.request('textDocument/codeAction', { range: {
        start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
        end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
      }, context: { diagnostics: [] } }, token)
      return { actions: (values || []).map((action: any) => ({ title: action.title, kind: action.kind, isPreferred: action.isPreferred, edit: workspaceEdit(action.edit) })), dispose() {} }
    }),
  }))
  if (capabilities.semanticTokensProvider) providers.push(monaco.languages.registerDocumentSemanticTokensProvider(language, {
    getLegend: () => capabilities.semanticTokensProvider.legend,
    provideDocumentSemanticTokens: scoped(async (_model, _lastResultId, token) => {
      const value = await session.request('textDocument/semanticTokens/full', {}, token)
      return value ? { resultId: value.resultId, data: new Uint32Array(value.data) } : null
    }),
    releaseDocumentSemanticTokens() {},
  }))
  return {
    refresh: (next: ScriptEditorPropsLike) => session.refresh(next),
    dispose() { providers.reverse().forEach((provider) => provider.dispose()); session.dispose() },
  }
}
