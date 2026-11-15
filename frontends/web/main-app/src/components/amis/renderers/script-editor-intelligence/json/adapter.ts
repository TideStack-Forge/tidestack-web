import { findNodeAtOffset, getNodePath, parseTree } from 'jsonc-parser'
import { buildTemplateCompletionItems } from '../template/adapter'
import { buildGroovyCompletionItems } from '../groovy/adapter'
import type {
  ScriptEditorAdapter,
  ScriptEditorAdapterContext,
  ScriptIntelligenceSnapshot,
} from '../types'

/** Projects a JSON string value into a language view and maps edits back through JSON escaping. */
export function createJsonExpressionAdapter(
  context: ScriptEditorAdapterContext
): ScriptEditorAdapter {
  let disposable: { dispose(): void } | undefined
  const uri = context.editor.getModel()?.uri.toString()
  return {
    apply(snapshot) {
      disposable = context.monaco.languages.registerCompletionItemProvider('json', {
        triggerCharacters: ['.', '$', '{', '#'],
        provideCompletionItems(model: any, position: any) {
          if (model.uri.toString() !== uri) return { suggestions: [] }
          const leaf = jsonStringAt(model.getValue(), model.getOffsetAt(position))
          if (!leaf) return { suggestions: [] }
          const hints = snapshot.languageProjectionHints || {}
          if (
            hints.embeddedArrayValues === false &&
            leaf.path.some((item) => typeof item === 'number')
          )
            return { suggestions: [] }
          if (hints.embeddedExpressionMode === 'legacy-output' && leaf.path.length)
            return { suggestions: [] }
          const prefix = leaf.value.slice(0, leaf.cursor)
          if (
            hints.embeddedPayloadFields &&
            !hints.embeddedPayloadFields.includes(leaf.path.at(-1)) &&
            prefix.includes('${')
          )
            return { suggestions: [] }
          const isTemplate = ['template', 'rpc-template'].includes(
            snapshot.runtimeProfile
          )
          const body = isTemplate ? prefix : expressionPrefix(snapshot, prefix)
          if (body === null) return { suggestions: [] }
          const virtualPosition = { lineNumber: 1, column: body.length + 1 }
          const virtual = {
            getLineContent: () => body,
            getWordUntilPosition: () => {
              const word = body.match(/[A-Za-z_$][\w$]*$/)?.[0] || ''
              return {
                word,
                startColumn: body.length + 1 - word.length,
                endColumn: body.length + 1,
              }
            },
          }
          const suggestions = isTemplate
            ? buildTemplateCompletionItems(
                context.monaco,
                snapshot,
                virtual,
                virtualPosition
              )
            : buildGroovyCompletionItems(
                context.monaco,
                snapshot,
                virtual,
                virtualPosition
              )
          return {
            suggestions: suggestions.map((item: any) => {
              const start = leaf.cursor - (body.length + 1 - item.range.startColumn)
              const end = leaf.cursor - (body.length + 1 - item.range.endColumn)
              const rawStart = model.getPositionAt(leaf.offsets[Math.max(0, start)])
              const rawEnd = model.getPositionAt(leaf.offsets[Math.max(0, end)])
              return {
                ...item,
                insertText: JSON.stringify(item.insertText.replace('($0)', '()')).slice(
                  1,
                  -1
                ),
                insertTextRules: undefined,
                range: {
                  startLineNumber: rawStart.lineNumber,
                  startColumn: rawStart.column,
                  endLineNumber: rawEnd.lineNumber,
                  endColumn: rawEnd.column,
                },
              }
            }),
          }
        },
      })
    },
    dispose() {
      disposable?.dispose()
    },
  }
}

function expressionPrefix(
  snapshot: ScriptIntelligenceSnapshot,
  prefix: string
): string | null {
  const mode = snapshot.languageProjectionHints?.embeddedExpressionMode || 'template'
  if (mode === 'bare') return prefix
  if (mode.startsWith('legacy-')) {
    if (!prefix.startsWith('$.'))
      return mode === 'legacy-event' ? (prefix.match(/\$\{([^}]*)$/)?.[1] ?? null) : null
    return mode === 'legacy-output' ? `result.${prefix.slice(2)}` : prefix.slice(2)
  }
  return prefix.match(/(?<!\$)\$\{([^}]*)$/)?.[1] ?? null
}

/** Partial JSON is accepted by the parser; property keys and non-string values are excluded. */
export function jsonStringAt(text: string, offset: number) {
  const root = parseTree(text)
  if (!root) return null
  const node = findNodeAtOffset(root, offset, true)
  if (
    !node ||
    node.type !== 'string' ||
    text[node.offset] !== '"' ||
    offset <= node.offset
  )
    return null
  if (node.parent?.type === 'property' && node.parent.children?.[0] === node) return null
  const end =
    node.offset + node.length - (text[node.offset + node.length - 1] === '"' ? 1 : 0)
  if (offset > end) return null
  let value = ''
  const offsets = [node.offset + 1]
  for (let index = node.offset + 1; index < end;) {
    let decoded = text[index++]
    if (decoded === '\\' && index < end) {
      const escape = text[index++]
      if (escape === 'u' && /^[\da-f]{4}$/i.test(text.slice(index, index + 4))) {
        decoded = String.fromCharCode(parseInt(text.slice(index, index + 4), 16))
        index += 4
      } else
        decoded =
          ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' } as Record<string, string>)[
            escape
          ] ?? escape
    }
    value += decoded
    offsets.push(index)
  }
  const cursor = offsets.findLastIndex((raw) => raw <= offset)
  return { value, cursor, offsets, path: getNodePath(node) }
}
