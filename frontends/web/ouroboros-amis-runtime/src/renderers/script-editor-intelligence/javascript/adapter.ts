import { acquireBackendJavascriptWorker } from './worker'
import { configurationArgumentItems } from '../configuration'
import { buildJavascriptDeclarations } from './declarationBuilder'
import { candidateOrigin, presentCandidate, platformReferenceLabel } from '../provenance'
import type {
  ScriptEditorAdapter,
  ScriptEditorAdapterContext,
  ScriptIntelligenceSnapshot,
} from '../types'

const languageId = 'ouroboros-javascript'
const registered = new WeakSet<object>()
let nextDocument = 0
const standardGlobals = new Set(
  'Array Boolean Date Error EvalError Function Infinity Intl JSON Map Math NaN Number Object Promise Proxy RangeError ReferenceError Reflect RegExp Set String Symbol SyntaxError TypeError URIError WeakMap WeakSet BigInt decodeURI decodeURIComponent encodeURI encodeURIComponent eval isFinite isNaN parseFloat parseInt undefined'.split(
    ' '
  )
)

/** Each virtual file is an external module, so its declarations never become ambient globals. */
class JavascriptScriptEditorAdapter implements ScriptEditorAdapter {
  readonly diagnosticOwner = 'editor-javascript'
  private readonly editor: any
  private readonly monaco: any
  private readonly disposables: Array<{ dispose(): void }> = []
  private virtualModel: any
  private disposed = false
  private validateDocument?: () => Promise<void>

  constructor(context: ScriptEditorAdapterContext) {
    this.editor = context.editor
    this.monaco = context.monaco
  }

  async apply(snapshot: ScriptIntelligenceSnapshot) {
    const { monaco, editor } = this
    const model = editor?.getModel?.()
    if (!model || !monaco.editor?.createWebWorker) return
    if (!registered.has(monaco)) {
      registered.add(monaco)
      monaco.languages.register({ id: languageId })
      const javascript = monaco.languages
        .getLanguages()
        .find((item: any) => item.id === 'javascript')
      if (javascript?.loader) {
        const syntax = await javascript.loader()
        monaco.languages.setMonarchTokensProvider(languageId, syntax.language)
        monaco.languages.setLanguageConfiguration(languageId, syntax.conf)
      }
    }
    if (this.disposed) return
    // Word suggestions can expose declaration text from the hidden analysis model.
    const wordSuggestions = editor.getRawOptions?.().wordBasedSuggestions ?? true
    editor.updateOptions?.({ wordBasedSuggestions: false })
    this.disposables.push({
      dispose: () => editor.updateOptions?.({ wordBasedSuggestions: wordSuggestions }),
    })
    const uri = monaco.Uri.parse(`inmemory://ouroboros-intelligence/${++nextDocument}.ts`)
    const prefix = `export {};\n${buildJavascriptDeclarations(snapshot)}\nfunction __ouroboros_user_script__() {\n`
    this.virtualModel = monaco.editor.createModel(
      prefix + model.getValue() + '\n}',
      'plaintext',
      uri
    )
    this.disposables.push(this.virtualModel)
    // Keep each worker document's version increasing so TypeScript invalidates its cache.
    const syntaxPrefix = 'function __ouroboros_user_script__() {\n'
    const syntaxUri = monaco.Uri.parse(uri.toString() + '.js')
    const syntaxModel = monaco.editor.createModel(
      syntaxPrefix + model.getValue() + '\n}',
      'plaintext',
      syntaxUri
    )
    this.disposables.push(syntaxModel)
    this.disposables.push(
      model.onDidChangeContent(() => {
        this.virtualModel.setValue(prefix + model.getValue() + '\n}')
        syntaxModel.setValue(syntaxPrefix + model.getValue() + '\n}')
      })
    )
    const modelUri = model.uri.toString()
    const active = (candidate: any) =>
      !this.disposed && candidate.uri.toString() === modelUri
    const backendWorker = acquireBackendJavascriptWorker(monaco)
    this.disposables.push(backendWorker)
    const workerReady = backendWorker.at(uri).then(
      (worker: any) => ({ worker }),
      (error: unknown) => ({ error })
    )
    const current = (version: number, token: any) =>
      !this.disposed &&
      !token?.isCancellationRequested &&
      model.getVersionId() === version
    const queryWorker = async (
      position: any,
      token: any,
      query: (worker: any, offset: number) => Promise<any>
    ) => {
      const version = model.getVersionId()
      const offset = prefix.length + model.getOffsetAt(position)
      try {
        const ready = await workerReady
        if (!current(version, token)) return null
        if ('error' in ready) throw ready.error
        const worker = await backendWorker.at(uri)
        if (!current(version, token)) return null
        const result = await query(worker, offset)
        return current(version, token) ? result : null
      } catch (error) {
        // A refresh disposes this virtual document while its worker query may still be running.
        if (!current(version, token)) return null
        throw error
      }
    }
    const rangeAt = (start: number, length: number) => {
      const from = model.getPositionAt(Math.max(0, start - prefix.length))
      const to = model.getPositionAt(Math.max(0, start + length - prefix.length))
      return new monaco.Range(from.lineNumber, from.column, to.lineNumber, to.column)
    }
    this.validateDocument = async () => {
      const version = model.getVersionId()
      const source = model.getValue()
      // Check JavaScript grammar separately from the generated TypeScript declarations.
      const syntaxWorker = await backendWorker.at(syntaxUri)
      const syntax = await syntaxWorker.getSyntacticDiagnostics(syntaxUri.toString())
      const worker = await backendWorker.at(uri)
      const semantic = await worker.getSemanticDiagnostics(uri.toString())
      if (!current(version, undefined)) return
      const markers = [
        ...syntax.map((item: any) => ({ item, offset: syntaxPrefix.length })),
        ...semantic
          .filter((item: any) => item.start >= prefix.length && item.start < prefix.length + source.length)
          .map((item: any) => ({ item, offset: prefix.length })),
      ].map(({ item, offset }) => {
        const start = Math.min(source.length, Math.max(0, (item.start ?? offset) - offset))
        const from = model.getPositionAt(start)
        const to = model.getPositionAt(Math.min(source.length, start + (item.length || 1)))
        return {
          startLineNumber: from.lineNumber,
          startColumn: from.column,
          endLineNumber: to.lineNumber,
          endColumn: to.column,
          message: diagnosticMessage(item.messageText),
          severity: item.category === 1 ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        }
      })
      monaco.editor.setModelMarkers(model, 'editor-javascript', markers)
    }
    const globals = new Set([
      ...standardGlobals,
      'Java',
      ...(snapshot.languageProjectionHints?.javascript?.engineGlobals || []).map(
        (item: any) => item.name
      ),
      ...snapshot.globals.map((item) => item.name),
    ])
    this.disposables.push(
      monaco.languages.registerCompletionItemProvider(languageId, {
        triggerCharacters: ['.', '"', "'"],
        provideCompletionItems: async (
          candidate: any,
          position: any,
          _context: any,
          token: any
        ) => {
          if (!active(candidate)) return null
          const configuration = configurationArgumentItems(
            monaco,
            snapshot,
            candidate,
            position
          )
          if (configuration) return { suggestions: configuration }
          const info = await queryWorker(position, token, (worker, offset) =>
            worker.getCompletionsAtPosition(uri.toString(), offset)
          )
          if (!info) return null
          const word = model.getWordUntilPosition(position)
          const range = new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn
          )
          return {
            suggestions: info.entries
              .filter(
                (entry: any) =>
                  !info.isGlobalCompletion ||
                  globals.has(entry.name) ||
                  entry.kind === 'keyword' ||
                  (!entry.kindModifiers?.split(',').includes('declare') &&
                    [
                      'const',
                      'let',
                      'var',
                      'local var',
                      'local function',
                      'function',
                      'parameter',
                      'local class',
                      'alias',
                    ].includes(entry.kind))
              )
              .map((entry: any) => presentCandidate({
                label: entry.name,
                insertText: entry.insertText || entry.name,
                sortText: entry.sortText,
                kind:
                  entry.kind === 'method' || entry.kind.includes('function')
                    ? monaco.languages.CompletionItemKind.Function
                    : monaco.languages.CompletionItemKind.Variable,
                range: entry.replacementSpan
                  ? rangeAt(entry.replacementSpan.start, entry.replacementSpan.length)
                  : range,
              }, candidateOrigin(snapshot, model, position, entry.name))),
          }
        },
      })
    )
    this.disposables.push(
      monaco.languages.registerHoverProvider(languageId, {
        provideHover: async (candidate: any, position: any, token: any) => {
          if (!active(candidate)) return null
          const info = await queryWorker(position, token, (worker, offset) =>
            worker.getQuickInfoAtPosition(uri.toString(), offset)
          )
          if (!info) return null
          const word = model.getWordAtPosition?.(position)?.word || ''
          const origin = candidateOrigin(snapshot, model, position, word)
          return {
            range: rangeAt(info.textSpan.start, info.textSpan.length),
            contents: [
              ...(origin === 'PLATFORM_REFERENCE' ? [{ value: platformReferenceLabel }] : []),
              {
                value:
                  '```typescript\n' +
                  info.displayParts.map((part: any) => part.text).join('') +
                  '\n```',
              },
              {
                value: (info.documentation || []).map((part: any) => part.text).join(''),
              },
            ],
          }
        },
      })
    )
    this.disposables.push(
      monaco.languages.registerSignatureHelpProvider(languageId, {
        signatureHelpTriggerCharacters: ['(', ','],
        provideSignatureHelp: async (candidate: any, position: any, token: any) => {
          if (!active(candidate)) return null
          const info = await queryWorker(position, token, (worker, offset) =>
            worker.getSignatureHelpItems(uri.toString(), offset, {})
          )
          if (!info) return null
          const display = (parts: any[]) => parts.map((part) => part.text).join('')
          return {
            value: {
              activeSignature: info.selectedItemIndex,
              activeParameter: info.argumentIndex,
              signatures: info.items.map((item: any) => ({
                label:
                  display(item.prefixDisplayParts) +
                  item.parameters
                    .map((param: any) => display(param.displayParts))
                    .join(display(item.separatorDisplayParts)) +
                  display(item.suffixDisplayParts),
                parameters: item.parameters.map((param: any) => ({
                  label: display(param.displayParts),
                })),
              })),
            },
            dispose() {},
          }
        },
      })
    )
    monaco.editor.setModelLanguage(model, languageId)
  }

  dispose() {
    this.disposed = true
    this.disposables.reverse().forEach((item) => item.dispose())
    this.disposables.length = 0
    this.monaco.editor.setModelMarkers?.(this.editor.getModel(), 'editor-javascript', [])
  }

  async validate() {
    if (!this.validateDocument || this.disposed) throw new Error('JavaScript 校验器尚未就绪')
    await this.validateDocument()
  }
}

function diagnosticMessage(value: any): string {
  return typeof value === 'string'
    ? value
    : [value.messageText, ...(value.next || []).map(diagnosticMessage)].join('\n')
}

export function createJavascriptScriptEditorAdapter(
  context: ScriptEditorAdapterContext
): ScriptEditorAdapter {
  return new JavascriptScriptEditorAdapter(context)
}
