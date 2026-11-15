export interface MicroLayoutAppHandle {
  mountPromise?: Promise<unknown>
  getStatus?: () => string
  update?: (props: any) => Promise<unknown> | unknown
  unmount?: () => Promise<unknown> | unknown
}

export interface MicroLayoutSlot {
  app: MicroLayoutAppHandle | null
  container: any | null
  entry: string | null
  mountPromise: Promise<void> | null
  pendingRevision: number
  pendingEntry: string | null
  pendingContainer: any | null
  pendingProps: Record<string, any> | null
}

interface DestroyedFlag {
  current: boolean
}

interface SyncMicroLayoutSlotOptions {
  slot: MicroLayoutSlot
  entry?: string
  name: string
  selector: string
  props: Record<string, any>
  destroyedRef?: DestroyedFlag
  queryContainer?: (selector: string) => any
  ensureEntrySafe: (entry: string) => Promise<unknown>
  normalizeEntry: (entry: string) => string
  loadMicroApp: (config: {
    name: string
    container: any
    entry: string
    props: Record<string, any>
  }) => MicroLayoutAppHandle
  warn?: (error: unknown) => void
}

export function createMicroLayoutSlot(): MicroLayoutSlot {
  return {
    app: null,
    container: null,
    entry: null,
    mountPromise: null,
    pendingRevision: 0,
    pendingEntry: null,
    pendingContainer: null,
    pendingProps: null,
  }
}

function isContainerNode(value: any) {
  return Boolean(value && typeof value === 'object')
}

function readMicroAppStatus(app: MicroLayoutAppHandle | null) {
  if (!app || typeof app.getStatus !== 'function') {
    return null
  }

  return app.getStatus()
}

function isMountedMicroApp(app: MicroLayoutAppHandle | null) {
  return readMicroAppStatus(app) === 'MOUNTED'
}

function isStaleMountedSlot(slot: MicroLayoutSlot, nextContainer: any, nextEntry: string) {
  if (!slot.app) {
    return false
  }

  if (slot.entry !== nextEntry) {
    return true
  }

  if (slot.container !== nextContainer) {
    return true
  }

  if (slot.container && typeof slot.container.isConnected === 'boolean' && !slot.container.isConnected) {
    return true
  }

  const status = readMicroAppStatus(slot.app)
  return Boolean(status && status !== 'MOUNTED')
}

function isParcelNotMountedUpdateError(error: unknown) {
  const message = typeof (error as any)?.message === 'string' ? (error as any).message : ''
  return (
    message.includes('single-spa minified message #32') ||
    message.includes('single-spa.js.org/error/?code=32') ||
    /Cannot update parcel .* because it is not mounted/.test(message)
  )
}

async function safeUnmountMicroApp(app: MicroLayoutAppHandle | null) {
  if (!app || typeof app.unmount !== 'function') {
    return
  }

  await Promise.resolve(app.unmount())
}

function invalidatePendingMicroLayoutState(slot: MicroLayoutSlot) {
  slot.pendingRevision += 1
  slot.pendingEntry = null
  slot.pendingContainer = null
  slot.pendingProps = null
}

function setPendingMicroLayoutState(
  slot: MicroLayoutSlot,
  entry: string | null,
  container: any | null,
  props: Record<string, any> | null
) {
  slot.pendingRevision += 1
  slot.pendingEntry = entry
  slot.pendingContainer = container
  slot.pendingProps = props
}

function clearMountedMicroLayoutSlot(slot: MicroLayoutSlot) {
  const currentApp = slot.app
  slot.app = null
  slot.container = null
  slot.entry = null
  return currentApp
}

function clearMicroLayoutContainer(container: any) {
  if (!isContainerNode(container)) {
    return
  }

  if (typeof container.innerHTML === 'string') {
    container.innerHTML = ''
    return
  }

  if (typeof container.removeChild === 'function') {
    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }
  }
}

export async function resetMicroLayoutSlot(slot: MicroLayoutSlot, warn?: (error: unknown) => void) {
  invalidatePendingMicroLayoutState(slot)
  const currentContainer = slot.container
  const currentApp = clearMountedMicroLayoutSlot(slot)
  clearMicroLayoutContainer(currentContainer)

  try {
    await safeUnmountMicroApp(currentApp)
  } catch (error) {
    warn?.(error)
  }
}

async function updateMicroLayoutSlot(
  slot: MicroLayoutSlot,
  props: Record<string, any>,
  warn?: (error: unknown) => void
) {
  if (!slot.app || typeof slot.app.update !== 'function' || !isMountedMicroApp(slot.app)) {
    return false
  }

  try {
    await Promise.resolve(slot.app.update(props))
    return true
  } catch (error) {
    if (isParcelNotMountedUpdateError(error)) {
      slot.app = null
      slot.container = null
      slot.entry = null
      return false
    }

    slot.app = null
    slot.container = null
    slot.entry = null
    warn?.(error)
    return false
  }
}

function defaultQueryContainer(selector: string) {
  if (typeof document === 'undefined') {
    return null
  }

  return document.querySelector(selector)
}

export async function syncMicroLayoutSlot({
  slot,
  entry,
  name,
  selector,
  props,
  destroyedRef,
  queryContainer = defaultQueryContainer,
  ensureEntrySafe,
  normalizeEntry,
  loadMicroApp,
  warn,
}: SyncMicroLayoutSlotOptions) {
  const normalizedEntry = entry ? normalizeEntry(entry) : null
  const container = normalizedEntry ? queryContainer(selector) : null

  if (!normalizedEntry || !isContainerNode(container)) {
    invalidatePendingMicroLayoutState(slot)
    if (slot.app) {
      await resetMicroLayoutSlot(slot, warn)
    }
    return
  }

  setPendingMicroLayoutState(slot, normalizedEntry, container, props)

  if (slot.app && isStaleMountedSlot(slot, container, normalizedEntry)) {
    const currentApp = clearMountedMicroLayoutSlot(slot)

    try {
      await safeUnmountMicroApp(currentApp)
    } catch (error) {
      warn?.(error)
    }
  }

  if (slot.app) {
    const didUpdate = await updateMicroLayoutSlot(slot, props, warn)
    if (didUpdate) {
      return
    }
  }

  if (slot.mountPromise) {
    return slot.mountPromise
  }

  const mountRevision = slot.pendingRevision
  slot.mountPromise = (async () => {
    await ensureEntrySafe(normalizedEntry)
    if (destroyedRef?.current) {
      return
    }

    if (slot.pendingEntry !== normalizedEntry || slot.pendingContainer !== container) {
      return
    }

    const activeContainer = queryContainer(selector)
    if (!isContainerNode(activeContainer) || activeContainer !== container) {
      return
    }

    const microApp = loadMicroApp({
      name,
      container,
      entry: normalizedEntry,
      props,
    })

    await microApp.mountPromise


    if (destroyedRef?.current) {
      await safeUnmountMicroApp(microApp)
      return
    }

    if (slot.pendingEntry !== normalizedEntry || slot.pendingContainer !== container) {
      await safeUnmountMicroApp(microApp)
      return
    }

    const latestContainer = queryContainer(selector)
    if (!isContainerNode(latestContainer) || latestContainer !== container) {
      await safeUnmountMicroApp(microApp)
      return
    }

    slot.app = microApp
    slot.container = container
    slot.entry = normalizedEntry

    if (slot.pendingRevision !== mountRevision) {
      const latestProps = slot.pendingProps || props
      const didUpdate = await updateMicroLayoutSlot(slot, latestProps, warn)

      if (
        !didUpdate &&
        slot.pendingEntry === normalizedEntry &&
        slot.pendingContainer === container
      ) {
        const retryMicroApp = loadMicroApp({
          name,
          container,
          entry: normalizedEntry,
          props: latestProps,
        })

        await retryMicroApp.mountPromise

        if (destroyedRef?.current) {
          await safeUnmountMicroApp(retryMicroApp)
          return
        }

        if (slot.pendingEntry !== normalizedEntry || slot.pendingContainer !== container) {
          await safeUnmountMicroApp(retryMicroApp)
          return
        }

        const latestContainer = queryContainer(selector)
        if (!isContainerNode(latestContainer) || latestContainer !== container) {
          await safeUnmountMicroApp(retryMicroApp)
          return
        }

        slot.app = retryMicroApp
        slot.container = container
        slot.entry = normalizedEntry
      }
    }
  })()
    .catch((error) => {
      warn?.(error)
    })
    .finally(() => {
      slot.mountPromise = null
    })

  return slot.mountPromise
}
