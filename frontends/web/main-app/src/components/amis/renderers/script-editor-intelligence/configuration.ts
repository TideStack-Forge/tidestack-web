import type { ScriptIntelligenceSnapshot } from './types'

/** Method argument candidates use the same filtered name catalog as configuration templates. */
export function configurationArgumentItems(
  monaco: any,
  snapshot: ScriptIntelligenceSnapshot,
  model: any,
  position: any
) {
  const prefix = (model.getLineContent(position.lineNumber) || '').slice(
    0,
    position.column - 1
  )
  const match = prefix.match(/\bConfig\.get\(\s*(['"])([^'"]*)$/)
  if (!match) return null
  return (snapshot.languageProjectionHints?.configurationKeys || [])
    .filter((item: any) => item.key.startsWith(match[2]))
    .map((item: any) => ({
      label: item.key,
      insertText: item.key,
      kind: monaco.languages.CompletionItemKind.Value,
      detail: item.label || item.valueType || 'configuration',
      range: {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column - match[2].length,
        endColumn: position.column,
      },
    }))
}
