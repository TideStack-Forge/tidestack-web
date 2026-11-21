// This transport persists the same checkpoint/log envelope as the Java service, with controllable delivery.
export class Room {
  documents = new Map()
  listeners = new Set()
  requests = []
  paused = false
  fail = false
  queue = []
  transport(writable = true) {
    let listener, failed
    return {
      subscribe: (callback, errorCallback) => {
        listener = callback
        failed = errorCallback
        this.listeners.add(callback)
        callback({ kind: 'bootstrap', writable, documents: [...this.documents.values()] })
        return {
          bootstrapDone: Promise.resolve(),
          unsubscribe: () => this.listeners.delete(callback),
        }
      },
      request: async (path, input) => {
        this.requests.push({ path, input })
        if (!path)
          return { kind: 'bootstrap', writable, documents: [...this.documents.values()] }
        if (!writable) throw new Error('forbidden')
        if (this.fail) throw new Error('connection unavailable')
        const id = path.split('/')[1]
        const apply = () => {
          let current = this.documents.get(id)
          if (path.endsWith('/initialize')) {
            if (!current?.checkpoint)
              current = {
                id,
                revision: 1,
                seed: input.seed,
                checkpoint: input.checkpoint,
                updates: [],
              }
          } else {
            const compact = current.revision === input.baseRevision
            current = {
              ...current,
              revision: current.revision + 1,
              checkpoint: compact ? input.checkpoint : current.checkpoint,
              updates: [
                ...(compact ? [] : current.updates),
                { id: input.id, data: input.data },
              ],
            }
          }
          this.documents.set(id, current)
          for (const callback of this.listeners)
            callback({ kind: 'document', document: current })
          return current
        }
        if (this.paused && path.endsWith('/updates'))
          return new Promise((resolve) => this.queue.push(() => resolve(apply())))
        return apply()
      },
      mute: () => this.listeners.delete(listener),
      disconnect: () => {
        this.listeners.delete(listener)
        failed(new Error('disconnected'))
      },
      reconnect: () => {
        this.listeners.add(listener)
        listener({ kind: 'bootstrap', writable, documents: [...this.documents.values()] })
      },
    }
  }
}
