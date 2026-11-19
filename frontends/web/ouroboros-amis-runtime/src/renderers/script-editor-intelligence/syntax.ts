import { findNodeAtLocation, parseTree } from 'jsonc-parser'
import { jsonStringAt } from './json/adapter'
import type { ScriptEditorAdapterContext, ScriptIntelligenceSnapshot } from './types'

export const syntaxDiagnosticOwner = 'editor-syntax'

/** The server reports UTF-16 ranges in decoded values; Monaco needs ranges in the JSON source. */
export function applySyntaxDiagnostics(
  { editor, monaco }: ScriptEditorAdapterContext,
  snapshot: ScriptIntelligenceSnapshot,
  json: boolean
) {
  const model = editor.getModel()
  const text = model.getValue()
  const root = json ? parseTree(text) : undefined
  const markers = []
  for (const issue of snapshot.diagnostics || []) {
    if (issue.source !== 'ouroboros-syntax' || !issue.range) continue
    let start, end
    if (json) {
      const node = root && findNodeAtLocation(root, issue.path || [])
      const leaf = node && jsonStringAt(text, node.offset + 1)
      if (!leaf) continue
      start = model.getPositionAt(leaf.offsets[offsetAt(leaf.value, issue.range.start)])
      end = model.getPositionAt(leaf.offsets[offsetAt(leaf.value, issue.range.end)])
    } else {
      start = model.getPositionAt(offsetAt(text, issue.range.start))
      end = model.getPositionAt(offsetAt(text, issue.range.end))
    }
    markers.push({
      source: issue.source,
      message: issue.message,
      severity:
        issue.severity === 1
          ? monaco.MarkerSeverity.Error
          : monaco.MarkerSeverity.Warning,
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: end.lineNumber,
      endColumn: end.column,
    })
  }
  monaco.editor.setModelMarkers(model, syntaxDiagnosticOwner, markers)
}

function offsetAt(text: string, position: { line: number; character: number }) {
  let start = 0
  const newline = /\r\n|\r|\n/g
  for (let line = 0; line < position.line; line++) {
    const next = newline.exec(text)
    if (!next) return text.length
    start = next.index + next[0].length
  }
  const end = newline.exec(text)?.index ?? text.length
  return Math.min(end, start + position.character)
}
