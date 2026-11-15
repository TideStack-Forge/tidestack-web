import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'

const { registerTypescriptRequire } = require(path.join(
  process.cwd(),
  'tests/unit/helpers/mainAppTestKit'
))

registerTypescriptRequire()

const {
  createMicroLayoutSlot,
  resetMicroLayoutSlot,
  syncMicroLayoutSlot,
} = require('../../../../src/layouts/microLayoutController.ts')

function createDeferred() {
  let resolve
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve
  })

  return {
    promise,
    resolve,
  }
}

function createMountedMicroApp(overrides = {}) {
  return {
    mountPromise: Promise.resolve(),
    getStatus: () => 'MOUNTED',
    update: vi.fn(() => Promise.resolve()),
    unmount: vi.fn(() => Promise.resolve()),
    ...overrides,
  }
}

describe('micro layout controller', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('remounts the header micro app when the container anchor changes', async () => {
    const topbarA = { id: 'custom-topbar-a', isConnected: true }
    const topbarB = { id: 'custom-topbar-b', isConnected: true }
    let currentContainer = topbarA

    const firstHandle = createMountedMicroApp()
    const secondHandle = createMountedMicroApp()
    const loadMicroApp = vi.fn()
      .mockReturnValueOnce(firstHandle)
      .mockReturnValueOnce(secondHandle)

    const slot = createMicroLayoutSlot()
    const sharedOptions = {
      slot,
      entry: '/micro/header',
      name: 'micro-custom-header',
      selector: '#custom-topbar',
      props: { breadcrumb: [{ title: 'tab-1' }] },
      queryContainer: vi.fn(() => currentContainer),
      ensureEntrySafe: vi.fn(() => Promise.resolve()),
      normalizeEntry: vi.fn((entry) => entry),
      loadMicroApp,
    }

    await syncMicroLayoutSlot(sharedOptions)

    expect(loadMicroApp).toHaveBeenCalledTimes(1)
    expect(slot.app).toBe(firstHandle)
    expect(slot.container).toBe(topbarA)

    topbarA.isConnected = false
    currentContainer = topbarB

    await syncMicroLayoutSlot({
      ...sharedOptions,
      props: { breadcrumb: [{ title: 'tab-2' }] },
    })

    expect(firstHandle.unmount).toHaveBeenCalledTimes(1)
    expect(loadMicroApp).toHaveBeenCalledTimes(2)
    expect(slot.app).toBe(secondHandle)
    expect(slot.container).toBe(topbarB)
  })

  test('replaces the stale handle after single-spa not-mounted update errors', async () => {
    const topbar = { id: 'custom-topbar', isConnected: true }
    const staleHandle = createMountedMicroApp({
      update: vi.fn(() =>
        Promise.reject(
          new Error(
            'single-spa minified message #32: See https://single-spa.js.org/error/?code=32&arg=micro-custom-header'
          )
        )
      ),
    })
    const freshHandle = createMountedMicroApp()
    const slot = createMicroLayoutSlot()

    slot.app = staleHandle
    slot.container = topbar
    slot.entry = '/micro/header'

    const loadMicroApp = vi.fn().mockReturnValue(freshHandle)
    const warn = vi.fn()

    await syncMicroLayoutSlot({
      slot,
      entry: '/micro/header',
      name: 'micro-custom-header',
      selector: '#custom-topbar',
      props: { breadcrumb: [{ title: 'tab-2' }] },
      queryContainer: vi.fn(() => topbar),
      ensureEntrySafe: vi.fn(() => Promise.resolve()),
      normalizeEntry: vi.fn((entry) => entry),
      loadMicroApp,
      warn,
    })

    expect(staleHandle.update).toHaveBeenCalledTimes(1)
    expect(loadMicroApp).toHaveBeenCalledTimes(1)
    expect(loadMicroApp).toHaveBeenCalledWith({
      name: 'micro-custom-header',
      container: topbar,
      entry: '/micro/header',
      props: { breadcrumb: [{ title: 'tab-2' }] },
    })
    expect(warn).not.toHaveBeenCalled()
    expect(slot.app).toBe(freshHandle)
    expect(slot.container).toBe(topbar)
  })

  test('does not double-mount while a micro app is still mounting', async () => {
    const topbar = { id: 'custom-topbar', isConnected: true }
    const mountDeferred = createDeferred()
    const mountingHandle = createMountedMicroApp({
      mountPromise: mountDeferred.promise,
    })
    const slot = createMicroLayoutSlot()
    const loadMicroApp = vi.fn().mockReturnValue(mountingHandle)

    const firstSync = syncMicroLayoutSlot({
      slot,
      entry: '/micro/header',
      name: 'micro-custom-header',
      selector: '#custom-topbar',
      props: { breadcrumb: [{ title: 'tab-1' }] },
      queryContainer: vi.fn(() => topbar),
      ensureEntrySafe: vi.fn(() => Promise.resolve()),
      normalizeEntry: vi.fn((entry) => entry),
      loadMicroApp,
    })

    const secondSync = syncMicroLayoutSlot({
      slot,
      entry: '/micro/header',
      name: 'micro-custom-header',
      selector: '#custom-topbar',
      props: { breadcrumb: [{ title: 'tab-2' }] },
      queryContainer: vi.fn(() => topbar),
      ensureEntrySafe: vi.fn(() => Promise.resolve()),
      normalizeEntry: vi.fn((entry) => entry),
      loadMicroApp,
    })

    mountDeferred.resolve()
    await Promise.all([firstSync, secondSync])

    expect(loadMicroApp).toHaveBeenCalledTimes(1)
    expect(slot.app).toBe(mountingHandle)
    expect(slot.mountPromise).toBeNull()
  })

  test('replays the latest props after a mount finishes', async () => {
    const topbar = { id: 'custom-topbar', isConnected: true }
    const mountDeferred = createDeferred()
    const mountingHandle = createMountedMicroApp({
      mountPromise: mountDeferred.promise,
    })
    const slot = createMicroLayoutSlot()
    const loadMicroApp = vi.fn().mockReturnValue(mountingHandle)

    const firstSync = syncMicroLayoutSlot({
      slot,
      entry: '/micro/header',
      name: 'micro-custom-header',
      selector: '#custom-topbar',
      props: { breadcrumb: [{ title: 'tab-1' }], currentPath: '/dev/demo/tab-1' },
      queryContainer: vi.fn(() => topbar),
      ensureEntrySafe: vi.fn(() => Promise.resolve()),
      normalizeEntry: vi.fn((entry) => entry),
      loadMicroApp,
    })

    const secondSync = syncMicroLayoutSlot({
      slot,
      entry: '/micro/header',
      name: 'micro-custom-header',
      selector: '#custom-topbar',
      props: { breadcrumb: [{ title: 'tab-2' }], currentPath: '/dev/demo/tab-2' },
      queryContainer: vi.fn(() => topbar),
      ensureEntrySafe: vi.fn(() => Promise.resolve()),
      normalizeEntry: vi.fn((entry) => entry),
      loadMicroApp,
    })

    mountDeferred.resolve()
    await Promise.all([firstSync, secondSync])

    expect(loadMicroApp).toHaveBeenCalledTimes(1)
    expect(mountingHandle.update).toHaveBeenCalledTimes(1)
    expect(mountingHandle.update).toHaveBeenCalledWith({
      breadcrumb: [{ title: 'tab-2' }],
      currentPath: '/dev/demo/tab-2',
    })
  })

  test('clears stale container DOM when reset happens before the parcel reaches mounted', async () => {
    const topbar = {
      innerHTML: '<div class="dev-topbar">stale</div>',
    }
    const transitionalHandle = createMountedMicroApp({
      getStatus: () => 'MOUNTING',
      unmount: vi.fn(() => Promise.resolve()),
    })
    const slot = createMicroLayoutSlot()

    slot.app = transitionalHandle
    slot.container = topbar
    slot.entry = '/micro/header'

    const resetPromise = resetMicroLayoutSlot(slot)

    expect(topbar.innerHTML).toBe('')

    await resetPromise

    expect(transitionalHandle.unmount).toHaveBeenCalledTimes(1)
    expect(slot.app).toBeNull()
    expect(slot.container).toBeNull()
    expect(slot.entry).toBeNull()
  })

  test('remounts with the latest route props when the post-mount update is not mounted', async () => {
    const topbar = { id: 'custom-topbar', isConnected: true }
    const mountDeferred = createDeferred()
    const firstHandle = createMountedMicroApp({
      mountPromise: mountDeferred.promise,
      update: vi.fn(() =>
        Promise.reject(
          new Error(
            'single-spa minified message #32: See https://single-spa.js.org/error/?code=32&arg=micro-custom-header'
          )
        )
      ),
    })
    const secondHandle = createMountedMicroApp()
    const slot = createMicroLayoutSlot()
    const loadMicroApp = vi.fn()
      .mockReturnValueOnce(firstHandle)
      .mockReturnValueOnce(secondHandle)

    const firstSync = syncMicroLayoutSlot({
      slot,
      entry: '/micro/header',
      name: 'micro-custom-header',
      selector: '#custom-topbar',
      props: { breadcrumb: [{ title: 'tab-1' }], currentPath: '/dev/demo/tab-1' },
      queryContainer: vi.fn(() => topbar),
      ensureEntrySafe: vi.fn(() => Promise.resolve()),
      normalizeEntry: vi.fn((entry) => entry),
      loadMicroApp,
    })

    const secondSync = syncMicroLayoutSlot({
      slot,
      entry: '/micro/header',
      name: 'micro-custom-header',
      selector: '#custom-topbar',
      props: { breadcrumb: [{ title: 'tab-2' }], currentPath: '/user-dashboard?page=1' },
      queryContainer: vi.fn(() => topbar),
      ensureEntrySafe: vi.fn(() => Promise.resolve()),
      normalizeEntry: vi.fn((entry) => entry),
      loadMicroApp,
    })

    mountDeferred.resolve()
    await Promise.all([firstSync, secondSync])

    expect(firstHandle.update).toHaveBeenCalledTimes(1)
    expect(loadMicroApp).toHaveBeenCalledTimes(2)
    expect(loadMicroApp).toHaveBeenNthCalledWith(1, {
      name: 'micro-custom-header',
      container: topbar,
      entry: '/micro/header',
      props: { breadcrumb: [{ title: 'tab-1' }], currentPath: '/dev/demo/tab-1' },
    })
    expect(loadMicroApp).toHaveBeenNthCalledWith(2, {
      name: 'micro-custom-header',
      container: topbar,
      entry: '/micro/header',
      props: { breadcrumb: [{ title: 'tab-2' }], currentPath: '/user-dashboard?page=1' },
    })
    expect(slot.app).toBe(secondHandle)
    expect(slot.container).toBe(topbar)
    expect(slot.entry).toBe('/micro/header')
  })

})
