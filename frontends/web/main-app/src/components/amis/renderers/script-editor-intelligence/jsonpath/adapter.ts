import { resolveShapeMembers } from '../shape'
import {
  buildTemplateCompletionItems,
  createTemplateEditorAdapter,
} from '../template/adapter'
import type { ScriptEditorAdapterContext, ScriptIntelligenceSnapshot } from '../types'

/** JSONPath reads the token RPC response; it has no Java/application globals. */
export function createJsonPathEditorAdapter(context: ScriptEditorAdapterContext) {
  return createTemplateEditorAdapter(context, 'jsonpath', buildJsonPathCompletionItems)
}

export function buildJsonPathCompletionItems(
  monaco: any,
  snapshot: ScriptIntelligenceSnapshot,
  model: any,
  position: any
) {
  const prefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
  if (/#\{[^}]*$/.test(prefix))
    return buildTemplateCompletionItems(monaco, snapshot, model, position)
  const member = prefix.match(
    /^(\$(?:(?:\.[\w$]+)|\[(?:\d+|\*|'[^']*'|"[^"]*")\])*)(?:\.([\w$]*)|\[['"]([^'"]*))$/
  )
  if (!member) return []
  const root = snapshot.languageProjectionHints?.rootShape
  const globals = [{ name: '$', shape: { schema: root || {} }, kind: 'variable' }]
  const members = resolveShapeMembers(
    { ...snapshot, globals },
    member[1].replace(/\[\*\]/g, '[0]')
  )
  const fragment = member[2] ?? member[3] ?? ''
  const bracket = member[3] !== undefined
  const range = {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: position.column - fragment.length,
    endColumn: position.column,
  }
  return members
    .filter((item) => item.name.startsWith(fragment))
    .map((item) => {
      const identifier = /^[A-Za-z_$][\w$]*$/.test(item.name)
      return {
        label: item.name,
        kind: monaco.languages.CompletionItemKind.Field,
        insertText: bracket
          ? item.name
          : identifier
            ? item.name
            : `[${JSON.stringify(item.name)}]`,
        detail: item.returnTypeDisplayName,
        range:
          !bracket && !identifier
            ? { ...range, startColumn: range.startColumn - 1 }
            : range,
      }
    })
}
