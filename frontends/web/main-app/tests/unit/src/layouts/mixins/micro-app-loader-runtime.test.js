import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const {
  loadMicroApp,
  getCommonProps,
  createMicroEntryFetch,
  ensureSameOriginMicroEntryIsSafe,
  normalizeMicroEntry,
} = vi.hoisted(() => ({
  loadMicroApp: vi.fn(),
  getCommonProps: vi.fn(() => ({ shared: true })),
  createMicroEntryFetch: vi.fn(() => vi.fn()),
  ensureSameOriginMicroEntryIsSafe: vi.fn(() => Promise.resolve()),
  normalizeMicroEntry: vi.fn((entry) => entry),
}))

vi.mock('qiankun', () => ({ loadMicroApp }))
vi.mock('@/common/micro/commonProps', () => ({ getCommonProps }))
vi.mock('@/common/micro/entryGuard', () => ({
  createMicroEntryFetch,
  ensureSameOriginMicroEntryIsSafe,
}))
vi.mock('@/common/micro/utils', () => ({ normalizeMicroEntry }))

import microAppLoader from '../../../../../src/layouts/mixins/micro-app-loader.js'

function flushPromises() {
  return Promise.resolve().then(() => Promise.resolve())
}

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

function createVm(overrides = {}) {
  const vm = {
    headerEntry: '/micro/header',
    sidebarEntry: '/micro/sidebar',
    appName: 'Test App',
    logo: 'logo',
    menu: { globalMenu: [] },
    theme: 'default',
    userInfo: { id: 'u1' },
    breadcrumb: [],
    microTopbar: null,
    microSidebar: null,
    microTopbarMounting: false,
    microSidebarMounting: false,
    $nextTick(callback) {
      if (callback) {
        return Promise.resolve().then(callback)
      }
      return Promise.resolve()
    },
    ...overrides,
  }

  vm.recheckPendingMicroApps = microAppLoader.methods.recheckPendingMicroApps.bind(vm)
  vm.buildMicroProps = microAppLoader.methods.buildMicroProps.bind(vm)
  vm.loadTopbarMicro = microAppLoader.methods.loadTopbarMicro.bind(vm)
  vm.loadSidebarMicro = microAppLoader.methods.loadSidebarMicro.bind(vm)
  vm.updateMicroApps = microAppLoader.methods.updateMicroApps.bind(vm)

  return vm
}

describe('micro-app-loader runtime retry', () => {
  const originalDocument = globalThis.document

  beforeEach(() => {
    loadMicroApp.mockReset()
    getCommonProps.mockClear()
    createMicroEntryFetch.mockClear()
    ensureSameOriginMicroEntryIsSafe.mockClear()
    normalizeMicroEntry.mockClear()
  })

  afterEach(() => {
    if (typeof originalDocument === 'undefined') {
      delete globalThis.document
    } else {
      Object.defineProperty(globalThis, 'document', {
        value: originalDocument,
        configurable: true,
        writable: true,
      })
    }
  })

  test('mounts topbar and sidebar micro apps when containers are present on mount', async () => {
    const mountedTopbar = {
      mountPromise: Promise.resolve(),
      getStatus: () => 'MOUNTED',
      update: vi.fn(),
      unmount: vi.fn(),
    }
    const mountedSidebar = {
      mountPromise: Promise.resolve(),
      getStatus: () => 'MOUNTED',
      update: vi.fn(),
      unmount: vi.fn(),
    }
    loadMicroApp.mockReturnValueOnce(mountedTopbar).mockReturnValueOnce(mountedSidebar)

    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelector: vi.fn((selector) => {
          if (selector === '#custom-topbar') {
            return { id: 'custom-topbar' }
          }
          if (selector === '#custom-sidebar') {
            return { id: 'custom-sidebar' }
          }
          return null
        }),
      },
      configurable: true,
      writable: true,
    })

    const vm = createVm()

    await microAppLoader.mounted.call(vm)
    await flushPromises()

    expect(ensureSameOriginMicroEntryIsSafe).toHaveBeenNthCalledWith(1, '/micro/header')
    expect(ensureSameOriginMicroEntryIsSafe).toHaveBeenNthCalledWith(2, '/micro/sidebar')
    expect(createMicroEntryFetch).toHaveBeenCalledTimes(2)
    expect(loadMicroApp).toHaveBeenCalledTimes(2)
    expect(loadMicroApp.mock.calls[0][1]).toEqual({
      fetch: createMicroEntryFetch.mock.results[0].value,
    })
    expect(loadMicroApp.mock.calls[1][1]).toEqual({
      fetch: createMicroEntryFetch.mock.results[1].value,
    })
    expect(vm.microTopbar).toBe(mountedTopbar)
    expect(vm.microSidebar).toBe(mountedSidebar)
  })

  test('no-ops when topbar and sidebar containers are missing on mount', async () => {
    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelector: vi.fn(() => null),
      },
      configurable: true,
      writable: true,
    })

    const vm = createVm()

    await microAppLoader.mounted.call(vm)
    await flushPromises()

    expect(ensureSameOriginMicroEntryIsSafe).not.toHaveBeenCalled()
    expect(loadMicroApp).not.toHaveBeenCalled()
    expect(vm.microTopbar).toBeNull()
    expect(vm.microSidebar).toBeNull()
  })

  test('route, theme, and menu watchers only update mounted micro apps with update handlers', () => {
    const topbarHandle = {
      getStatus: () => 'MOUNTED',
    }
    const sidebarHandle = {
      getStatus: () => 'MOUNTED',
      update: vi.fn(),
    }
    const vm = createVm({
      microTopbar: topbarHandle,
      microSidebar: sidebarHandle,
    })

    expect(() => microAppLoader.watch.$route.handler.call(vm)).not.toThrow()
    expect(() => microAppLoader.watch.theme.call(vm)).not.toThrow()
    expect(() => microAppLoader.watch.menu.handler.call(vm)).not.toThrow()

    expect(sidebarHandle.update).toHaveBeenCalledTimes(3)
  })

  test('beforeDestroy unmounts disposable micro apps and safely clears incomplete handles', () => {
    const sidebarHandle = {
      unmount: vi.fn(),
    }
    const vm = createVm({
      microTopbar: { getStatus: () => 'MOUNTED' },
      microSidebar: sidebarHandle,
      microTopbarMounting: true,
      microSidebarMounting: true,
    })

    expect(() => microAppLoader.beforeDestroy.call(vm)).not.toThrow()

    expect(sidebarHandle.unmount).toHaveBeenCalledTimes(1)
    expect(vm.microTopbar).toBeNull()
    expect(vm.microSidebar).toBeNull()
    expect(vm.microTopbarMounting).toBe(false)
    expect(vm.microSidebarMounting).toBe(false)
  })

  test('unsafe topbar entry rejections skip mounting without warning side effects', async () => {
    const unsafeEntryError = new Error('unsafe topbar entry')
    unsafeEntryError.isUnsafeMicroEntry = true
    ensureSameOriginMicroEntryIsSafe.mockRejectedValueOnce(unsafeEntryError)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelector: vi.fn((selector) => {
          if (selector === '#custom-topbar') {
            return { id: 'custom-topbar' }
          }
          return null
        }),
      },
      configurable: true,
      writable: true,
    })

    const vm = createVm({
      sidebarEntry: '',
    })

    await microAppLoader.mounted.call(vm)
    await flushPromises()

    expect(ensureSameOriginMicroEntryIsSafe).toHaveBeenCalledWith('/micro/header')
    expect(loadMicroApp).not.toHaveBeenCalled()
    expect(vm.microTopbar).toBeNull()
    expect(vm.microTopbarMounting).toBe(false)
    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  test('unsafe sidebar entry rejections skip mounting without warning side effects', async () => {
    const unsafeEntryError = new Error('unsafe sidebar entry')
    unsafeEntryError.isUnsafeMicroEntry = true
    ensureSameOriginMicroEntryIsSafe.mockRejectedValueOnce(unsafeEntryError)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelector: vi.fn((selector) => {
          if (selector === '#custom-sidebar') {
            return { id: 'custom-sidebar' }
          }
          return null
        }),
      },
      configurable: true,
      writable: true,
    })

    const vm = createVm({
      headerEntry: '',
    })

    await microAppLoader.mounted.call(vm)
    await flushPromises()

    expect(ensureSameOriginMicroEntryIsSafe).toHaveBeenCalledWith('/micro/sidebar')
    expect(loadMicroApp).not.toHaveBeenCalled()
    expect(vm.microSidebar).toBeNull()
    expect(vm.microSidebarMounting).toBe(false)
    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  test('retries topbar mount after a later layout update exposes the anchor', async () => {
    const mountedMicroApp = {
      mountPromise: Promise.resolve(),
      getStatus: () => 'MOUNTED',
      update: vi.fn(),
      unmount: vi.fn(),
    }
    loadMicroApp.mockReturnValue(mountedMicroApp)

    let hasTopbarAnchor = false
    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelector: vi.fn((selector) => {
          if (selector === '#custom-topbar' && hasTopbarAnchor) {
            return { id: 'custom-topbar' }
          }
          return null
        }),
      },
      configurable: true,
      writable: true,
    })

    const vm = createVm({
      sidebarEntry: '',
    })

    await microAppLoader.mounted.call(vm)
    await flushPromises()

    expect(loadMicroApp).not.toHaveBeenCalled()

    hasTopbarAnchor = true
    await microAppLoader.updated.call(vm)
    await flushPromises()

    expect(ensureSameOriginMicroEntryIsSafe).toHaveBeenCalledWith('/micro/header')
    expect(loadMicroApp).toHaveBeenCalledTimes(1)
    expect(vm.microTopbar).toBe(mountedMicroApp)
  })

  test('overlapping topbar retry calls do not double-mount the same target', async () => {
    const nextTick = createDeferred()
    const mountedMicroApp = {
      mountPromise: Promise.resolve(),
      getStatus: () => 'MOUNTED',
      update: vi.fn(),
      unmount: vi.fn(),
    }
    loadMicroApp.mockReturnValue(mountedMicroApp)

    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelector: vi.fn((selector) => {
          if (selector === '#custom-topbar') {
            return { id: 'custom-topbar' }
          }
          return null
        }),
      },
      configurable: true,
      writable: true,
    })

    const vm = createVm({
      sidebarEntry: '',
      $nextTick() {
        return nextTick.promise
      },
    })

    const firstAttempt = vm.loadTopbarMicro()
    const secondAttempt = vm.loadTopbarMicro()

    nextTick.resolve()
    await Promise.all([firstAttempt, secondAttempt])

    expect(loadMicroApp).toHaveBeenCalledTimes(1)
    expect(vm.microTopbar).toBe(mountedMicroApp)
    expect(vm.microTopbarMounting).toBe(false)
  })

  test('destroying during an async topbar mount does not reattach the handle after teardown', async () => {
    const mountDeferred = createDeferred()
    const mountedMicroApp = {
      mountPromise: mountDeferred.promise,
      getStatus: () => 'MOUNTED',
      update: vi.fn(),
      unmount: vi.fn(),
    }
    loadMicroApp.mockReturnValue(mountedMicroApp)

    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelector: vi.fn((selector) => {
          if (selector === '#custom-topbar') {
            return { id: 'custom-topbar' }
          }
          return null
        }),
      },
      configurable: true,
      writable: true,
    })

    const vm = createVm({
      sidebarEntry: '',
    })

    const loading = vm.loadTopbarMicro()
    await flushPromises()

    microAppLoader.beforeDestroy.call(vm)
    mountDeferred.resolve()
    await loading

    expect(vm.microTopbar).toBeNull()
    expect(vm.microTopbarMounting).toBe(false)
  })

  test('retries sidebar mount after a later layout update exposes the anchor', async () => {
    const mountedMicroApp = {
      mountPromise: Promise.resolve(),
      getStatus: () => 'MOUNTED',
      update: vi.fn(),
      unmount: vi.fn(),
    }
    loadMicroApp.mockReturnValue(mountedMicroApp)

    let hasSidebarAnchor = false
    Object.defineProperty(globalThis, 'document', {
      value: {
        querySelector: vi.fn((selector) => {
          if (selector === '#custom-sidebar' && hasSidebarAnchor) {
            return { id: 'custom-sidebar' }
          }
          return null
        }),
      },
      configurable: true,
      writable: true,
    })

    const vm = createVm({
      headerEntry: '',
    })

    await microAppLoader.mounted.call(vm)
    await flushPromises()

    expect(loadMicroApp).not.toHaveBeenCalled()

    hasSidebarAnchor = true
    await microAppLoader.updated.call(vm)
    await flushPromises()

    expect(ensureSameOriginMicroEntryIsSafe).toHaveBeenCalledWith('/micro/sidebar')
    expect(loadMicroApp).toHaveBeenCalledTimes(1)
    expect(vm.microSidebar).toBe(mountedMicroApp)
  })
})
