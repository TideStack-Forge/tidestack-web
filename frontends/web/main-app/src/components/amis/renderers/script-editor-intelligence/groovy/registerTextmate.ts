import { wireTmGrammars } from 'monaco-editor-textmate'
import { Registry } from 'monaco-textmate'
import type { IGrammarDefinition } from 'monaco-textmate'
import { loadWASM } from 'onigasm'
import groovyGrammar from './groovy.tmLanguage.json'

const onigasmWasmPath = buildPublicAssetPath('vendor/onigasm.wasm')

const GROOVY_LANGUAGE_ID = 'groovy'
const GROOVY_SCOPE_NAME = 'source.groovy'
const groovyGrammarMap = new Map([[GROOVY_LANGUAGE_ID, GROOVY_SCOPE_NAME]])

let groovyRegistryPromise: Promise<any> | null = null

function getGroovyRegistry() {
  if (!groovyRegistryPromise) {
    groovyRegistryPromise = Promise.resolve(loadWASM(onigasmWasmPath)).then(() => {
      return new Registry({
        getGrammarDefinition: async (scopeName: string): Promise<IGrammarDefinition> => {
          if (scopeName === GROOVY_SCOPE_NAME) {
            return {
              format: 'json' as const,
              content: groovyGrammar,
            }
          }
          return buildEmptyGrammarDefinition(scopeName)
        },
      })
    })
  }
  return groovyRegistryPromise
}

export async function registerTextmateGroovyLanguage(monaco: any, editor: any) {
  if (!editor) {
    return
  }
  const registry = await getGroovyRegistry()
  await wireTmGrammars(monaco, registry, groovyGrammarMap, editor)
}

function buildPublicAssetPath(assetPath: string) {
  const baseUrl = process.env.BASE_URL || '/'
  return `${baseUrl.replace(/\/$/, '')}/${assetPath.replace(/^\//, '')}`
}

function buildEmptyGrammarDefinition(scopeName: string): IGrammarDefinition {
  return {
    format: 'json',
    content: {
      scopeName,
      patterns: [],
      repository: {},
    },
  }
}
