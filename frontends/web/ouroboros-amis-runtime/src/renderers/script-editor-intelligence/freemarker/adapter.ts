import {
  buildTemplateCompletionItems,
  createTemplateEditorAdapter,
} from '../template/adapter'
import type {
  ScriptEditorAdapterContext,
  ScriptIntelligenceSnapshot,
  TypeShape,
} from '../types'

export function createFreemarkerEditorAdapter(context: ScriptEditorAdapterContext) {
  return createTemplateEditorAdapter(
    context,
    'freemarker',
    buildFreemarkerCompletionItems
  )
}

export function buildFreemarkerCompletionItems(
  monaco: any,
  snapshot: ScriptIntelligenceSnapshot,
  model: any,
  position: any
) {
  const prefix = model.getValue().slice(0, model.getOffsetAt(position))
  const globals = new Map(snapshot.globals.map((binding) => [binding.name, binding]))
  const scopes: Array<Map<string, any>> = []
  const tags =
    /<#list\s+([\w$.[\]'"0-9]+)\s+as\s+(\w+)\s*>|<\/#list\s*>|<#assign\s+(\w+)\s*=\s*([\w$.[\]'"0-9]+)\s*>/g
  for (const tag of prefix.matchAll(tags)) {
    if (tag[1]) {
      scopes.push(new Map(globals))
      const source = shapeAt(globals, tag[1])
      globals.set(tag[2], {
        name: tag[2],
        kind: 'variable',
        shape: { schema: source?.schema.items || {} },
      })
    } else if (tag[3]) {
      globals.set(tag[3], {
        name: tag[3],
        kind: 'variable',
        shape: shapeAt(globals, tag[4]),
      })
    } else if (scopes.length) {
      globals.clear()
      for (const [key, value] of scopes.pop()!) globals.set(key, value)
    }
  }
  const fragment = prefix.match(/\?([a-z_]*)$/)
  if (fragment)
    return [
      'has_content',
      'exists',
      'default',
      'size',
      'string',
      'upper_case',
      'lower_case',
      'trim',
      'html',
      'json_string',
      'number',
      'date',
      'datetime',
      'join',
      'first',
      'last',
      'sort',
      'keys',
      'values',
    ]
      .filter((name) => name.startsWith(fragment[1]))
      .map((name) => ({
        label: name,
        insertText: name,
        kind: monaco.languages.CompletionItemKind.Function,
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - fragment[1].length,
          endColumn: position.column,
        },
      }))
  return buildTemplateCompletionItems(
    monaco,
    { ...snapshot, globals: [...globals.values()] },
    model,
    position
  ).map((item: any) => {
    if (/^[A-Za-z_$][\w$]*$/.test(item.label)) return item
    const member = /\.\w*$/.exec(prefix)
    return {
      ...item,
      insertText: `${member ? '' : '.vars'}[${JSON.stringify(item.label)}]`,
      range: member
        ? { ...item.range, startColumn: item.range.startColumn - 1 }
        : item.range,
    }
  })
}

function shapeAt(globals: Map<string, any>, expression: string): TypeShape | undefined {
  const parts = expression.match(/[\w$]+|\[(?:\d+|'[^']*'|"[^"]*")\]/g) || []
  let shape: TypeShape | undefined = globals.get(parts.shift() || '')?.shape
  for (const part of parts) {
    const key = part.startsWith('[')
      ? part.slice(1, -1).replace(/^['"]|['"]$/g, '')
      : part
    const schema = /^\[\d+\]$/.test(part)
      ? shape?.schema.items
      : shape?.schema.properties?.[key]
    shape = schema ? { schema } : undefined
  }
  return shape
}
