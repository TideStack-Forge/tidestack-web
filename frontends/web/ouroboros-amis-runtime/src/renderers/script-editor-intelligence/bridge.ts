import { createJsonExpressionAdapter } from './json/adapter'
import { buildCodeContextRequest, fetchScriptIntelligenceSnapshot } from './api'
import { createLspAdapter } from './lsp/adapter'
import { applySyntaxDiagnostics, syntaxDiagnosticOwner } from './syntax'
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
  private referenceOnly = false
  private lastAppliedVersionKey: string | null = null
  private lastRequestKey: string | null = null
  private generation = 0
  private disposed = false
  private latestProps: ScriptEditorPropsLike | null = null
  private environmentApp: string | null = null
  private unsubscribeEnvironment?: () => void
  private refreshing: Promise<void> = Promise.resolve()
  private refreshError?: unknown
  private syntaxEnabled = false
  private syntaxVersion = -1
  private syntaxTimer?: ReturnType<typeof setTimeout>
  private readonly modelChanges?: { dispose(): void }

  constructor(context: ScriptEditorAdapterContext) {
    this.context = context
    this.modelChanges = context.editor.getModel()?.onDidChangeContent?.(() => {
      if (!this.syntaxEnabled) return
      this.syntaxVersion = -1
      context.monaco.editor.setModelMarkers(context.editor.getModel(), syntaxDiagnosticOwner, [])
      clearTimeout(this.syntaxTimer)
      this.syntaxTimer = setTimeout(() => {
        if (this.latestProps) void this.refresh(this.latestProps)
      }, 150)
    })
  }

  get diagnosticOwner() {
    return this.syntaxEnabled ? syntaxDiagnosticOwner : (this.lspAdapter || this.adapter)?.diagnosticOwner
  }

  refresh(props: ScriptEditorPropsLike) {
    this.refreshing = this.applyContext(props)
    return this.refreshing
  }

  async validate(props: ScriptEditorPropsLike) {
    await this.refresh(props)
    let refreshing
    do {
      refreshing = this.refreshing
      await refreshing
    } while (refreshing !== this.refreshing)
    if (this.disposed) throw new Error('代码编辑器已关闭')
    if (this.refreshError) throw this.refreshError
    if (this.referenceOnly) throw new Error('应用环境未验证，无法完成代码校验')
    if (this.syntaxEnabled && this.syntaxVersion !== this.context.editor.getModel().getVersionId())
      throw new Error('当前代码诊断尚未完成，请重新提交')
    await (this.lspAdapter || this.adapter)?.validate?.()
  }

  private async applyContext(props: ScriptEditorPropsLike) {
    if (this.disposed) return
    const model = this.context.editor.getModel()
    // Form props can lag the Monaco change event; diagnostics must describe what the user sees.
    if (model && props.codeSite) {
      let value = model.getValue()
      if (props.codeEmbedding === 'json') {
        try { value = JSON.parse(value) }
        catch { this.syntaxVersion = -1; return }
      }
      props = { ...props, value }
    }
    this.refreshError = undefined
    this.latestProps = props
    if (!props.codeSite) {
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
    let generation = this.generation
    try {
      if (
        props.codeSite &&
        props.codeEmbedding !== 'json' &&
        !this.referenceOnly &&
        !hasSnapshotLanguageAdapter(props.language!)
      ) {
        this.clearSyntax()
        generation = ++this.generation
        const key = `${props.language}:${props.intelligenceApi}`
        if (this.lspKey !== key) this.clearAdapter()
        if (!this.lspAdapter) {
          this.clearAdapter()
          await prepareEditorLanguage(props.language!, this.context)
          if (this.disposed || generation !== this.generation) return
          let adapter
          try {
            adapter = await createLspAdapter(this.context, props)
          } catch (error) {
            const snapshot = await fetchScriptIntelligenceSnapshot(props, {
              documentId: this.context.editor.getModel().uri.toString(),
              documentVersion: this.context.editor.getModel().getVersionId(),
              draftRevision: generation,
            })
            if (this.disposed || generation !== this.generation) return
            if (snapshot?.source !== 'dev-platform-fallback') throw error
            this.referenceOnly = true
            await this.refresh(props)
            return
          }
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
      if (requestKey === this.lastRequestKey && this.adapter &&
          (!this.syntaxEnabled || this.syntaxVersion === model?.getVersionId?.())) {
        return
      }

      generation = ++this.generation
      this.lastRequestKey = requestKey
      const version = model?.getVersionId?.()
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

      if (version !== model?.getVersionId?.()) return
      const syntaxEnabled = snapshot.languageProjectionHints?.syntaxDiagnostics === true
      if (!syntaxEnabled) this.clearSyntax()
      this.syntaxEnabled = syntaxEnabled
      if (this.syntaxEnabled) {
        applySyntaxDiagnostics(this.context, snapshot, props.codeEmbedding === 'json')
        this.syntaxVersion = version!
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
        this.adapter = createSnapshotLanguageAdapter(props.language!, this.context, this.referenceOnly)
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
      this.refreshError = error
      console.warn('script-editor intelligence refresh failed', error)
    }
  }

  dispose() {
    this.disposed = true
    this.latestProps = null
    this.stopObservingEnvironment()
    clearTimeout(this.syntaxTimer)
    this.modelChanges?.dispose()
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
    this.referenceOnly = false
    this.clearSyntax()
    this.clearAdapter()
    this.lastRequestKey = null
  }

  private clearSyntax() {
    if (this.syntaxEnabled)
      this.context.monaco.editor.setModelMarkers(this.context.editor.getModel(), syntaxDiagnosticOwner, [])
    this.syntaxEnabled = false
    this.syntaxVersion = -1
    clearTimeout(this.syntaxTimer)
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
  return JSON.stringify({
    api: props.intelligenceApi,
    embedding: props.codeEmbedding,
    request: buildCodeContextRequest(props, {
      documentId: 'context-key',
      documentVersion: 0,
      draftRevision: 0,
    }),
  })
}

export function createScriptEditorIntelligenceBridge(
  context: ScriptEditorAdapterContext
): ScriptEditorIntelligenceBridge {
  return new CodeEditorIntelligenceBridge(context)
}
