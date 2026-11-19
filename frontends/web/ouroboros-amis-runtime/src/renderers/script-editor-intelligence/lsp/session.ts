import { buildCodeContextRequest } from '../api'
import type { ScriptEditorAdapterContext, ScriptEditorPropsLike } from '../types'

/** One editor document; the platform pool keeps its independent language service warm. */
export class EditorLspSession {
  private props: ScriptEditorPropsLike
  private session?: { sessionId: string; uri: string }
  private pending: Promise<unknown> = Promise.resolve()
  private disposed = false
  private sentVersion = -1
  private sequence = 0
  private draftRevision = 0
  private contextKey = ''
  private capabilities: Record<string, any> = {}
  private diagnosticsKey = ''
  private diagnosticsVersion = -1
  private pollTimer?: ReturnType<typeof setTimeout>
  documentUri() { return this.session?.uri }
  getCapabilities() { return this.capabilities }
  private changeTimer?: ReturnType<typeof setTimeout>
  private readonly changes: { dispose(): void }

  constructor(private readonly context: ScriptEditorAdapterContext, props: ScriptEditorPropsLike) {
    this.props = props
    this.changes = context.editor.getModel().onDidChangeContent(() => {
      if (this.diagnosticsKey) {
        this.diagnosticsKey = ''
        context.monaco.editor.setModelMarkers(context.editor.getModel(), 'editor-lsp', [])
      }
      clearTimeout(this.changeTimer)
      this.changeTimer = setTimeout(() => {
        void this.enqueue(() => this.sync()).catch((error) => console.warn('代码 document synchronization failed', error))
      }, 150)
    })
  }

  refresh(props: ScriptEditorPropsLike) {
    this.props = props
    return this.enqueue(async () => {
      if (this.disposed) return
      await this.open()
      await this.sync()
      const request = this.contextRequest()
      if (!request) throw new Error('缺少 代码 编辑位置和资源草稿')
      const key = JSON.stringify({ ...request, documentVersion: 0, draftRevision: 0 })
      if (key !== this.contextKey) {
        this.diagnosticsVersion = -1
        this.receive((await this.http('post', `/${this.session!.sessionId}/context`, request)).messages)
        this.contextKey = key
      }
    })
  }

  async validate() {
    const deadline = Date.now() + 30_000
    for (;;) {
      await this.enqueue(async () => {
        if (this.disposed) throw new Error('代码编辑器已关闭')
        await this.sync()
        if (this.diagnosticsVersion !== this.context.editor.getModel().getVersionId())
          this.receive((await this.http('get', `/${this.session!.sessionId}/notifications`)).messages)
      })
      if (this.diagnosticsVersion === this.context.editor.getModel().getVersionId()) return
      if (Date.now() >= deadline) throw new Error('等待当前版本的代码诊断超时，请重试')
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  request(method: string, parameters: Record<string, unknown>, token?: any): Promise<any> {
    const model = this.context.editor.getModel()
    const version = model.getVersionId()
    const id = `editor-${++this.sequence}`
    let cancelled = token?.isCancellationRequested || false
    const cancellation = token?.onCancellationRequested?.(() => {
      cancelled = true
      if (this.session) void this.post([{ jsonrpc: '2.0', method: '$/cancelRequest', params: { id } }])
        .catch((error) => console.warn('代码 request cancellation failed', error))
    })
    return this.enqueue(async () => {
      if (cancelled || this.disposed) return null
      await this.open()
      await this.sync()
      if (cancelled || this.disposed || model.getVersionId() !== version) return null
      const messages = await this.post([{ jsonrpc: '2.0', id, method, params: { ...parameters, textDocument: { uri: this.session!.uri } } }])
      if (cancelled || this.disposed || model.getVersionId() !== version) return null
      const response = messages.find((message: any) => message.id === id || message.id === `${this.session!.sessionId}:${id}`)
      if (!response) throw new Error('代码 LSP 缺少请求响应')
      if (response.error) throw new Error(response.error.message)
      return response.result
    }).finally(() => cancellation?.dispose())
  }

  dispose() {
    this.disposed = true
    clearTimeout(this.changeTimer)
    clearTimeout(this.pollTimer)
    this.changes.dispose()
    this.context.monaco.editor.setModelMarkers(this.context.editor.getModel(), 'editor-lsp', [])
    if (this.session) void this.http('delete', `/${this.session.sessionId}`)
      .catch((error) => console.warn('代码 editor session close failed', error))
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation)
    this.pending = result.catch(() => undefined)
    return result
  }

  private contextRequest() {
    const model = this.context.editor.getModel()
    return buildCodeContextRequest({ ...this.props, value: model.getValue() }, {
      documentId: model.uri.toString(), documentVersion: model.getVersionId(), draftRevision: ++this.draftRevision,
    })
  }

  private async open() {
    if (this.session || this.disposed) return
    const request = this.contextRequest()
    if (!request) throw new Error('缺少 代码 编辑位置和资源草稿')
    const opened = await this.http('post', '', { context: request, text: this.context.editor.getModel().getValue() })
    this.session = opened
    this.sentVersion = request.documentVersion
    this.contextKey = JSON.stringify({ ...request, documentVersion: 0, draftRevision: 0 })
    if (this.disposed) {
      await this.http('delete', `/${opened.sessionId}`)
      return
    }
    const initialized = opened.messages?.find((message: any) => message.result?.capabilities)
    this.capabilities = initialized?.result.capabilities || {}
    this.receive(opened.messages)
    this.schedulePoll()

  }

  private schedulePoll() {
    if (this.disposed) return
    this.pollTimer = setTimeout(() => {
      void this.enqueue(async () => {
        if (this.disposed || !this.session) return
        this.receive((await this.http('get', `/${this.session.sessionId}/notifications`)).messages)
      }).catch(error => console.warn('Language diagnostics polling failed', error)).finally(() => this.schedulePoll())
    }, 1000)
  }

  private async sync() {
    if (this.disposed) return
    await this.open()
    if (!this.session || this.disposed) return
    const model = this.context.editor.getModel()
    const version = model.getVersionId()
    if (version === this.sentVersion) return
    await this.post([{ jsonrpc: '2.0', method: 'textDocument/didChange', params: {
      textDocument: { uri: this.session.uri, version }, contentChanges: [{ text: model.getValue() }],
    } }])
    this.sentVersion = version
  }

  private async post(messages: any[]): Promise<any[]> {
    if (!this.session) return []
    try {
      const result = await this.http('post', `/${this.session.sessionId}/messages`, messages)
      this.receive(result.messages)
      return result.messages
    } catch (error) {
      const expired = this.session
      this.session = undefined
      this.contextKey = ''
      this.sentVersion = -1
      this.diagnosticsKey = ''
      this.diagnosticsVersion = -1
      clearTimeout(this.pollTimer)
      this.context.monaco.editor.setModelMarkers(this.context.editor.getModel(), 'editor-lsp', [])
      void this.http('delete', `/${expired.sessionId}`).catch(closeError => console.warn('Could not retire failed editor session', closeError))
      throw error
    }
  }

  private receive(messages: any[]) {
    if (this.disposed) return
    const model = this.context.editor.getModel()
    for (const message of messages || []) {
      if (message.method !== 'textDocument/publishDiagnostics' || message.params.uri !== this.session?.uri
          || message.params.version !== model.getVersionId()) continue
      const key = JSON.stringify(message.params)
      this.diagnosticsVersion = message.params.version
      // Duplicate diagnostics invalidate Monaco's in-flight code action menu.
      if (key === this.diagnosticsKey) continue
      this.diagnosticsKey = key
      this.context.monaco.editor.setModelMarkers(model, 'editor-lsp', message.params.diagnostics.map((diagnostic: any) => ({
        ...monacoRange(diagnostic.range), message: diagnostic.message, source: diagnostic.source,
        severity: diagnostic.severity === 1 ? this.context.monaco.MarkerSeverity.Error : this.context.monaco.MarkerSeverity.Warning,
      })))
    }
  }

  private async http(method: string, suffix: string, data?: unknown) {
    const fetcher = this.props.env?.fetcher
    if (!fetcher || !this.props.intelligenceApi) throw new Error('缺少 代码 语言服务地址')
    const url = this.props.intelligenceApi.replace(/\/context$/, '/sessions') + suffix
    const result = await fetcher({ method, url, data }, data, { ignoreData: true })
    const payload = result?.data?.status !== undefined && result?.status !== 0 ? result.data : result
    if ((payload?.status ?? payload?.code) !== 0) throw new Error(payload?.msg || payload?.message || '代码 语言服务不可用')
    return payload.data
  }
}

export function lspPosition(position: any) { return { line: position.lineNumber - 1, character: position.column - 1 } }
export function monacoRange(range: any) {
  return { startLineNumber: range.start.line + 1, startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1, endColumn: range.end.character + 1 }
}
