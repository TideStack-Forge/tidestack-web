import { createJsonExpressionAdapter } from './json/adapter'
import { buildCodeContextRequest, fetchScriptIntelligenceSnapshot } from './api'
import { createLspAdapter } from './lsp/adapter'
import {
  prepareEditorLanguage,
  hasSnapshotLanguageAdapter,
  createSnapshotLanguageAdapter,
} from './languagePlugins'
import type {
  ScriptEditorAdapter,
  ScriptEditorAdapterContext,
  ScriptEditorIntelligenceBridge,
  ScriptEditorPropsLike,
} from './types'

class CodeEditorIntelligenceBridge implements ScriptEditorIntelligenceBridge {
  private readonly context: ScriptEditorAdapterContext
  private adapter: ScriptEditorAdapter | null = null
  private lspAdapter: Awaited<ReturnType<typeof createLspAdapter>> | null = null
  private lspKey: string | undefined
  private lastAppliedVersionKey: string | null = null
  private lastRequestKey: string | null = null
  private generation = 0
  private disposed = false
  private latestProps: ScriptEditorPropsLike | null = null
  private environmentApp: string | null = null
  private unsubscribeEnvironment?: () => void

  constructor(context: ScriptEditorAdapterContext) {
    this.context = context
  }

  async refresh(props: ScriptEditorPropsLike) {
    if (this.disposed) return
    this.latestProps = props
    if (!props.codeSite && props.intelligenceScene !== 'logicflow-script-node') {
      this.stopObservingEnvironment()
      this.reset()
      return
    }
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(props.language || '')) {
      this.stopObservingEnvironment()
      this.reset()
      return
    }

    this.observeEnvironment(props)
    if (
      props.codeSite &&
      props.codeEmbedding !== 'json' &&
      !hasSnapshotLanguageAdapter(props.language!)
    ) {
      const generation = ++this.generation
      const key = `${props.language}:${props.intelligenceApi}`
      if (this.lspKey !== key) this.clearAdapter()
      if (!this.lspAdapter) {
        this.clearAdapter()
        await prepareEditorLanguage(props.language!, this.context)
        if (this.disposed || generation !== this.generation) return
        const adapter = await createLspAdapter(this.context, props)
        if (this.disposed || generation !== this.generation) {
          adapter.dispose()
          return
        }
        this.lspAdapter = adapter
        this.lspKey = key
      }
      await this.lspAdapter.refresh(props)
      if (typeof window !== 'undefined')
        (window as any).__OUROBOROS_SCRIPT_EDITOR_DEBUG__?.onIntelligenceApplied?.({
          language: props.language,
          snapshot: { source: 'editor-lsp' },
        })
      return
    }
    if (this.lspAdapter) this.clearAdapter()
    const requestKey = buildLogicFlowContextRequestKey(props)
    if (requestKey === this.lastRequestKey && this.adapter) {
      return
    }

    const generation = ++this.generation
    this.lastRequestKey = requestKey
    try {
      const model = this.context.editor?.getModel?.()
      const snapshot = await fetchScriptIntelligenceSnapshot(props, {
        documentId: model?.uri?.toString?.() || 'code-editor',
        documentVersion: model?.getVersionId?.() || 0,
        draftRevision: generation,
      })
      if (this.disposed || generation !== this.generation) return
      if (!snapshot) {
        this.reset()
        this.lastRequestKey = requestKey
        return
      }

      const versionKey = `${props.language || 'unknown'}:${snapshot.versionToken}`
      if (this.lastAppliedVersionKey === versionKey && this.adapter) {
        this.lastRequestKey = requestKey
        return
      }

      this.clearAdapter()
      if (props.codeEmbedding === 'json') {
        this.adapter = createJsonExpressionAdapter(this.context)
      } else {
        this.adapter = createSnapshotLanguageAdapter(props.language!, this.context)
      }
      const adapter = this.adapter
      await adapter.apply(snapshot)
      if (this.disposed || generation !== this.generation) {
        adapter.dispose()
        return
      }
      if (typeof window !== 'undefined') {
        ;(window as any).__OUROBOROS_SCRIPT_EDITOR_DEBUG__?.onIntelligenceApplied?.({
          language: props.language,
          snapshot,
        })
      }
      this.lastAppliedVersionKey = versionKey
      this.lastRequestKey = requestKey
    } catch (error) {
      if (this.disposed || generation !== this.generation) return
      this.reset()
      console.warn('script-editor intelligence refresh failed', error)
    }
  }

  dispose() {
    this.disposed = true
    this.latestProps = null
    this.stopObservingEnvironment()
    this.reset()
  }

  private stopObservingEnvironment() {
    this.unsubscribeEnvironment?.()
    this.unsubscribeEnvironment = undefined
    this.environmentApp = null
  }

  private observeEnvironment(props: ScriptEditorPropsLike) {
    const match = props.intelligenceApi?.match(/\/api\/dev\/([^/]+)\//)
    const appName = match?.[1] || null
    if (this.environmentApp === appName) return
    this.unsubscribeEnvironment?.()
    this.environmentApp = appName
    this.unsubscribeEnvironment = appName
      ? this.context.subscribeEnvironment?.(appName, () => {
          if (this.disposed || !this.latestProps) return
          this.reset()
          void this.refresh(this.latestProps)
        })
      : undefined
  }

  private reset() {
    this.generation++
    this.clearAdapter()
    this.lastRequestKey = null
  }

  private clearAdapter() {
    this.lspAdapter?.dispose()
    this.lspAdapter = null
    this.lspKey = undefined
    this.adapter?.dispose()
    this.adapter = null
    this.lastAppliedVersionKey = null
    this.lastRequestKey = null
  }
}

function buildLogicFlowContextRequestKey(props: ScriptEditorPropsLike): string {
  const data = props.data || {}
  if (props.codeSite)
    return JSON.stringify({
      api: props.intelligenceApi,
      embedding: props.codeEmbedding,
      request: buildCodeContextRequest(props, {
        documentId: 'context-key',
        documentVersion: 0,
        draftRevision: 0,
      }),
    })
  return JSON.stringify({
    intelligenceScene: props.intelligenceScene,
    intelligenceApi: props.intelligenceApi,
    language: props.language,
    codeSite: props.codeSite,
    codePointer: props.codePointer,
    value: props.value,
    draft: data.__CODE_RESOURCE_DRAFT,
    nodeName: data.__CURRENT_NODE_NAME,
    nodeType: data.__CURRENT_NODE_TYPE,
    flowName: data.__FLOW_MODEL?.name,
    flowModel: data.__FLOW_MODEL,
  })
}

export function createScriptEditorIntelligenceBridge(
  context: ScriptEditorAdapterContext
): ScriptEditorIntelligenceBridge {
  return new CodeEditorIntelligenceBridge(context)
}
