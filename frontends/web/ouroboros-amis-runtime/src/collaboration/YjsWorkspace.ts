import * as Y from 'yjs'

export type StoredDocument = {
  id: string
  revision: number
  seed: string
  checkpoint: string | null
  updates: { id: string; data: string }[]
}
export type CollaborationMessage =
  | { kind: 'bootstrap'; writable: boolean; documents: StoredDocument[] }
  | { kind: 'document'; document: StoredDocument }

export interface CollaborationTransport {
  subscribe(
    listener: (message: CollaborationMessage) => void,
    failed: (error: Error) => void
  ): {
    bootstrapDone: Promise<void>
    unsubscribe(): void
  }
  request(path: string, data?: Record<string, unknown>): Promise<unknown>
}
export interface DocumentCodec<T> {
  entries(value: T): Record<string, unknown>
  value(id: string, entries: Record<string, unknown>, seed: T): T
}
type OpenDocument<T> = {
  doc: Y.Doc
  seed: T
  confirmed: StoredDocument | null
  pending: { id: string; data: string }[]
  sending: boolean
  initialized: boolean
  operationSequence: number
}

function applyStoredDocument(doc: Y.Doc, stored: StoredDocument, origin: unknown) {
  if (stored.checkpoint) Y.applyUpdate(doc, decodeUpdate(stored.checkpoint), origin)
  for (const update of stored.updates)
    Y.applyUpdate(doc, decodeUpdate(update.data), origin)
}

export function encodeUpdate(update: Uint8Array): string {
  let binary = ''
  for (const byte of update) binary += String.fromCharCode(byte)
  return btoa(binary)
}
export function decodeUpdate(update: string): Uint8Array {
  return Uint8Array.from(atob(update), (character) => character.charCodeAt(0))
}

/** One workspace carries independent Yjs documents over the host's existing messaging connection. */
export class YjsWorkspace<T> {
  private documents = new Map<string, OpenDocument<T>>()
  private subscription?: ReturnType<CollaborationTransport['subscribe']>
  private timer?: ReturnType<typeof setInterval>
  private receiving = Promise.resolve()
  private disposed = false
  private refreshing = false
  private lastError?: string
  private transportError?: string
  writable = false

  constructor(
    private transport: CollaborationTransport,
    private codec: DocumentCodec<T>,
    private changed: (value: T) => void,
    private status: (pending: number, writable: boolean, error?: string) => void
  ) {}

  async start() {
    this.subscription = this.transport.subscribe(
      (message) => {
        this.receiving = this.receiving
          .then(() => this.receive(message, true))
          .catch((error) => this.report(error))
      },
      (error) => {
        this.transportError = error.message
        this.report()
      }
    )
    await this.subscription.bootstrapDone
    await this.receiving
    if (this.disposed) return
    // Reconciliation covers a missed final broker notification as well as reconnects.
    this.timer = setInterval(() => void this.refresh(), 15000)
  }

  async refresh() {
    if (this.disposed || this.refreshing) return
    this.refreshing = true
    try {
      await this.receive((await this.transport.request('')) as CollaborationMessage)
      await this.retry()
    } catch (error) {
      this.report(error)
    } finally {
      this.refreshing = false
    }
  }

  has(id: string) {
    return this.documents.has(id)
  }

  private async receive(message: CollaborationMessage, live = false) {
    if (this.disposed) return
    if (message.kind === 'bootstrap') {
      if (live) this.transportError = undefined
      this.writable = message.writable
      for (const document of message.documents) await this.accept(document)
      await this.retry()
    } else if (message.kind === 'document') await this.accept(message.document)
    this.report()
  }

  async create(id: string, seed: T) {
    if (this.disposed) throw new Error('协同会话已关闭')
    if (!this.writable) throw new Error('当前应用仅有查看权限')
    const initial = new Y.Doc()
    const root = initial.getMap('content')
    initial.transact(() => {
      for (const [key, value] of Object.entries(this.codec.entries(seed)))
        root.set(key, value)
    })
    try {
      const document = (await this.transport.request(
        `/${encodeURIComponent(id)}/initialize`,
        {
          seed: JSON.stringify(seed),
          checkpoint: encodeUpdate(Y.encodeStateAsUpdate(initial)),
        }
      )) as StoredDocument
      await this.accept(document)
    } finally {
      initial.destroy()
    }
  }

  private async accept(document: StoredDocument) {
    if (this.disposed) return
    let open = this.documents.get(document.id)
    if (!open) {
      open = {
        doc: new Y.Doc(),
        seed: JSON.parse(document.seed),
        confirmed: null,
        pending: [],
        sending: false,
        initialized: false,
        operationSequence: 0,
      }
      this.documents.set(document.id, open)
      const target = open
      open.doc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin === this || this.disposed) return
        target.pending.push({
          id: `${target.doc.clientID}-${++target.operationSequence}`,
          data: encodeUpdate(update),
        })
        this.emit(document.id, target)
        this.report()
        void this.flush(document.id, target)
      })
    }
    if (!document.checkpoint) {
      if (!open.initialized) this.changed(open.seed)
      if (this.writable) await this.create(document.id, open.seed)
      return
    }
    applyStoredDocument(open.doc, document, this)
    if (!open.confirmed || document.revision > open.confirmed.revision)
      open.confirmed = document
    open.initialized = true
    this.emit(document.id, open)
  }

  /** All changed entity values form one Yjs transaction. Unrelated concurrent edits stay untouched. */
  change(id: string, before: T, after: T) {
    const open = this.documents.get(id)
    if (!this.writable || this.transportError || !open?.initialized)
      throw new Error('协同文档尚未就绪或没有编辑权限')
    const previous = this.codec.entries(before),
      next = this.codec.entries(after)
    const root = open.doc.getMap('content')
    open.doc.transact(() => {
      for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
        if (JSON.stringify(previous[key]) === JSON.stringify(next[key])) continue
        if (key in next) root.set(key, next[key])
        else root.delete(key)
      }
    })
  }

  private emit(id: string, open: OpenDocument<T>) {
    if (!this.disposed)
      this.changed(this.codec.value(id, open.doc.getMap('content').toJSON(), open.seed))
  }

  private async flush(id: string, open: OpenDocument<T>) {
    if (
      open.sending ||
      !open.confirmed ||
      !this.writable ||
      this.transportError ||
      this.disposed
    )
      return
    open.sending = true
    try {
      while (
        open.pending.length &&
        !this.disposed &&
        this.writable &&
        !this.transportError
      ) {
        const update = open.pending[0]
        const confirmed = open.confirmed
        const checkpoint = new Y.Doc()
        let encoded: string
        try {
          applyStoredDocument(checkpoint, confirmed, this)
          Y.applyUpdate(checkpoint, decodeUpdate(update.data), this)
          encoded = encodeUpdate(Y.encodeStateAsUpdate(checkpoint))
        } finally {
          checkpoint.destroy()
        }
        const stored = (await this.transport.request(
          `/${encodeURIComponent(id)}/updates`,
          {
            ...update,
            baseRevision: confirmed.revision,
            checkpoint: encoded,
          }
        )) as StoredDocument
        await this.accept(stored)
        open.pending.shift()
      }
      this.report()
    } catch (error) {
      this.report(error)
    } finally {
      open.sending = false
    }
  }

  async retry() {
    await Promise.all([...this.documents].map(([id, open]) => this.flush(id, open)))
  }

  get pending() {
    return [...this.documents.values()].reduce(
      (count, open) => count + open.pending.length,
      0
    )
  }

  private report(error?: unknown) {
    if (error !== undefined)
      this.lastError = error instanceof Error ? error.message : String(error)
    else if (!this.pending) this.lastError = undefined
    if (!this.disposed)
      this.status(
        this.pending,
        this.writable &&
          !this.transportError &&
          [...this.documents.values()].every((document) => document.initialized),
        this.transportError || this.lastError
      )
  }

  destroy() {
    this.disposed = true
    clearInterval(this.timer)
    this.subscription?.unsubscribe()
    for (const open of this.documents.values()) open.doc.destroy()
    this.documents.clear()
  }
}
