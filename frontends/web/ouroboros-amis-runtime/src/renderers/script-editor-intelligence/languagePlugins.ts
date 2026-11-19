import { createJavascriptScriptEditorAdapter } from './javascript/adapter'
import { createGroovyScriptEditorAdapter } from './groovy/adapter'
import { createTemplateEditorAdapter } from './template/adapter'
import { createJsonPathEditorAdapter } from './jsonpath/adapter'
import { createFreemarkerEditorAdapter } from './freemarker/adapter'
import type { ScriptEditorAdapter, ScriptEditorAdapterContext } from './types'
import { registerTextmateGroovyLanguage } from './groovy/registerTextmate'

/** Optional lexical setup. Semantic features are negotiated from the backend LSP plugin. */
export interface EditorLanguagePlugin {
  languageId: string
  createAdapter?(context: ScriptEditorAdapterContext): ScriptEditorAdapter
  createReferenceAdapter?(context: ScriptEditorAdapterContext): ScriptEditorAdapter
  prepare?(context: ScriptEditorAdapterContext): void | Promise<void>
}
const plugins = new Map<string, EditorLanguagePlugin>()

export function registerEditorLanguagePlugin(plugin: EditorLanguagePlugin) {
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(plugin.languageId) || plugins.has(plugin.languageId))
    throw new Error(`Invalid or duplicate editor language plugin: ${plugin.languageId}`)
  plugins.set(plugin.languageId, plugin)
  return {
    dispose() {
      if (plugins.get(plugin.languageId) === plugin) plugins.delete(plugin.languageId)
    },
  }
}

registerEditorLanguagePlugin({
  languageId: 'javascript',
  createAdapter: createJavascriptScriptEditorAdapter,
})
registerEditorLanguagePlugin({
  languageId: 'template',
  createAdapter: (context) => createTemplateEditorAdapter(context, 'template'),
})
registerEditorLanguagePlugin({
  languageId: 'rpc-template',
  createAdapter: (context) => createTemplateEditorAdapter(context, 'rpc-template'),
})
registerEditorLanguagePlugin({
  languageId: 'jsonpath',
  createAdapter: createJsonPathEditorAdapter,
})
registerEditorLanguagePlugin({
  languageId: 'freemarker',
  createAdapter: createFreemarkerEditorAdapter,
})
registerEditorLanguagePlugin({ languageId: 'spel', createAdapter: createSpelAdapter })
registerEditorLanguagePlugin({
  languageId: 'groovy',
  createReferenceAdapter: createGroovyScriptEditorAdapter,
  prepare: ({ monaco, editor }) => registerTextmateGroovyLanguage(monaco, editor),
})

export async function prepareEditorLanguage(
  language: string,
  context: ScriptEditorAdapterContext
) {
  if (
    !context.monaco.languages
      .getLanguages()
      .some((item: { id: string }) => item.id === language)
  )
    context.monaco.languages.register({ id: language })
  await plugins.get(language)?.prepare?.(context)
  context.monaco.editor.setModelLanguage(context.editor.getModel(), language)
}

export function hasSnapshotLanguageAdapter(language: string) {
  return Boolean(plugins.get(language)?.createAdapter)
}
export function createSnapshotLanguageAdapter(
  language: string,
  context: ScriptEditorAdapterContext,
  referenceOnly = false
) {
  const plugin = plugins.get(language)
  const factory = plugin?.createAdapter || (referenceOnly && plugin?.createReferenceAdapter)
  if (!factory) throw new Error(`No snapshot language adapter: ${language}`)
  return factory(context)
}

function createSpelAdapter(context: ScriptEditorAdapterContext) {
  const languages = context.monaco.languages
  if (!languages.getLanguages().some((item: any) => item.id === 'ouroboros-spel')) {
    languages.register({ id: 'ouroboros-spel' })
    languages.setMonarchTokensProvider('ouroboros-spel', {
      tokenizer: {
        root: [
          [/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/, 'string'],
          [
            /\b(?:true|false|null|and|or|not|eq|ne|lt|le|gt|ge|matches|instanceof)\b/,
            'keyword',
          ],
          [/\d+(?:\.\d+)?/, 'number'],
          [/[a-zA-Z_$][\w$]*/, 'identifier'],
        ],
      },
    })
  }
  context.monaco.editor.setModelLanguage(context.editor.getModel(), 'ouroboros-spel')
  return createGroovyScriptEditorAdapter(context, 'ouroboros-spel')
}
