import { resolveShapeMembers, shapeToTypescript } from '../shape'
import type {
  ScriptEditorAdapter,
  ScriptEditorAdapterContext,
  ScriptIntelligenceMember,
  ScriptIntelligenceSnapshot,
} from '../types'

/** Completion for RPC's mixed template: #{key} is configuration, ${...} is invocation SpEL. */
class TemplateEditorAdapter implements ScriptEditorAdapter {
  private readonly disposables: Array<{ dispose: () => void }> = []
  private readonly uri: string | null
  constructor(
    private readonly context: ScriptEditorAdapterContext,
    private readonly language = 'template',
    private readonly completionBuilder = buildTemplateCompletionItems
  ) {
    this.uri = context.editor?.getModel?.()?.uri?.toString?.() || null
  }
  apply(snapshot: ScriptIntelligenceSnapshot) {
    const languages = this.context.monaco?.languages
    if (!languages || !this.uri) return
    if (!languages.getLanguages().some((item: any) => item.id === this.language)) {
      languages.register({ id: this.language })
      languages.setMonarchTokensProvider(this.language, {
        tokenizer: {
          root: [
            [/#\{[^}]*\}/, 'variable'],
            [/\$\{[^}]*\}/, 'identifier'],
          ],
        },
      })
    }
    this.context.monaco.editor?.setModelLanguage(
      this.context.editor.getModel(),
      this.language
    )
    this.disposables.push(
      languages.registerCompletionItemProvider(this.language, {
        triggerCharacters: ['$', '#', '{', '.', ' '],
        provideCompletionItems: (model: any, position: any) => {
          if (model?.uri?.toString?.() !== this.uri) return { suggestions: [] }
          return {
            suggestions: this.completionBuilder(
              this.context.monaco,
              snapshot,
              model,
              position
            ),
          }
        },
      })
    )
    this.disposables.push(
      languages.registerHoverProvider(this.language, {
        provideHover: (model: any, position: any) =>
          model?.uri?.toString?.() === this.uri
            ? hover(this.context.monaco, snapshot, model, position)
            : null,
      })
    )
  }
  dispose() {
    while (this.disposables.length) this.disposables.pop()?.dispose()
  }
}

export function createTemplateEditorAdapter(
  context: ScriptEditorAdapterContext,
  language = 'template',
  completionBuilder = buildTemplateCompletionItems
): ScriptEditorAdapter {
  return new TemplateEditorAdapter(context, language, completionBuilder)
}

export function buildTemplateCompletionItems(
  monaco: any,
  snapshot: ScriptIntelligenceSnapshot,
  model: any,
  position: any
) {
  const prefix = linePrefix(model, position)
  const hints = snapshot.languageProjectionHints || {}
  if (hints.templateMode === 'disabled') return []
  const range = wordRange(model, position)
  const marker = hints.configurationMarker || '#'
  const config = prefix.match(marker === '$' ? /\$\{([^}]*)$/ : /#\{([^}]*)$/)
  const keys = config
    ? configKeys(snapshot)
        .filter((item) => item.key.startsWith(config[1]))
        .map((item) => ({
          label: item.key,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: item.key,
          detail: `${item.valueType || 'configuration'}${item.label ? ` · ${item.label}` : ''}`,
          documentation: item.description,
          range: { ...range, startColumn: position.column - config[1].length },
        }))
    : []
  if (config && marker === '#') return keys
  if (hints.templateMode === 'config-only')
    return [
      ...keys,
      ...(hints.literals || []).map((value: string) => ({
        label: value,
        insertText: value,
        kind: monaco.languages.CompletionItemKind.Value,
        range,
      })),
    ]
  const expression = prefix.match(/(?<!\$)\$\{([^}]*)$/)
  if (expression) {
    const body = expression[1]
    if (hints.templateMode === 'payload-only') {
      return snapshot.globals
        .filter((item) => item.name.startsWith(body))
        .map((item) => ({
          label: item.name,
          insertText: item.name,
          kind: monaco.languages.CompletionItemKind.Field,
          range: { ...range, startColumn: position.column - body.length },
        }))
    }
    const member = body.match(/([A-Za-z_$][\w$.[\]'"()]*)\.([\w$]*)$/)
    if (member)
      return [
        ...keys,
        ...resolveShapeMembers(snapshot, member[1]).map((item) =>
          memberItem(monaco, item, range)
        ),
      ]
    const root = body.match(/[A-Za-z_$][\w$]*$/)?.[0] || ''
    return [
      ...keys,
      ...snapshot.globals
        .filter((item) => !root || item.name.startsWith(root))
        .map((item) => ({
          label: item.name,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: item.name,
          detail: item.typeDisplayName || shapeToTypescript(item.shape),
          documentation: item.documentation,
          range,
        })),
    ]
  }
  const fixed = prefix.match(/\{([^{}]*)$/)
  if (!fixed) return []
  return (hints.placeholders || [])
    .filter((item: string) => item.startsWith(fixed[1]))
    .map((item: string) => ({
      label: `{${item}}`,
      insertText: item,
      kind: monaco.languages.CompletionItemKind.Variable,
      range: { ...range, startColumn: position.column - fixed[1].length },
    }))
}

function hover(
  monaco: any,
  snapshot: ScriptIntelligenceSnapshot,
  model: any,
  position: any
) {
  const prefix = linePrefix(model, position)
  const config = prefix.match(/#\{([^}]*)$/)
  if (config) {
    const item = configKeys(snapshot).find((candidate) => candidate.key === config[1])
    if (item)
      return {
        contents: [
          {
            value: `**#{${item.key}}**\n\n${item.valueType || 'configuration'}\n\n${item.description || ''}`,
          },
        ],
      }
  }
  const member = prefix.match(/\$\{([A-Za-z_$][\w$.]*)$/)
  if (member) {
    const name = member[1].split('.').at(-1) || ''
    const root = member[1].slice(0, -(name.length + 1))
    const found = resolveShapeMembers(snapshot, root).find((item) => item.name === name)
    if (found)
      return {
        contents: [{ value: `**${name}**\n\n${found.returnTypeDisplayName || 'any'}` }],
      }
  }
  return null
}

function configKeys(
  snapshot: ScriptIntelligenceSnapshot
): Array<{ key: string; label?: string; description?: string; valueType?: string }> {
  const values = snapshot.languageProjectionHints?.configurationKeys
  return Array.isArray(values)
    ? values.filter((item) => item && typeof item.key === 'string')
    : []
}
function memberItem(monaco: any, item: ScriptIntelligenceMember, range: any) {
  return {
    label: item.name,
    kind:
      item.memberKind === 'method'
        ? monaco.languages.CompletionItemKind.Method
        : monaco.languages.CompletionItemKind.Field,
    insertText: item.memberKind === 'method' ? `${item.name}()` : item.name,
    detail: item.returnTypeDisplayName || 'any',
    range,
  }
}
function linePrefix(model: any, position: any) {
  return (model.getLineContent(position.lineNumber) || '').slice(0, position.column - 1)
}
function wordRange(model: any, position: any) {
  const word = model.getWordUntilPosition(position)
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  }
}
