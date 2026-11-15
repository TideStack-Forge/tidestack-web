import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'

const {
  subscribeRouteChanges,
  subscribeState,
  emitRouteChange,
  emitStoreMutation,
  resetHostMocks,
} = vi.hoisted(() => {
  let routeListeners = new Set()
  let storeListeners = new Set()

  return {
    subscribeRouteChanges: vi.fn((listener) => {
      routeListeners.add(listener)
      return () => routeListeners.delete(listener)
    }),
    subscribeState: vi.fn((listener) => {
      storeListeners.add(listener)
      return () => storeListeners.delete(listener)
    }),
    emitRouteChange(route, from = null) {
      routeListeners.forEach((listener) => listener(route, from))
    },
    emitStoreMutation(mutation, state = {}) {
      storeListeners.forEach((listener) => listener(mutation, state))
    },
    resetHostMocks() {
      routeListeners = new Set()
      storeListeners = new Set()
      subscribeRouteChanges.mockClear()
      subscribeState.mockClear()
    },
  }
})

vi.mock('../../../../src/router/routerFacade.ts', () => ({
  subscribeRouteChanges,
}))

vi.mock('../../../../src/store/storeFacade.ts', () => ({
  subscribeState,
}))

const { useHostSnapshot } = await import('../../../../src/layouts/useHostSnapshot.ts')

function HostSnapshotHarness({ shouldNotifyRoute, shouldNotifyStore }) {
  const version = useHostSnapshot({
    shouldNotifyRoute,
    shouldNotifyStore,
  })

  return React.createElement('div', {
    'data-testid': 'host-snapshot-version',
    'data-version': String(version),
  })
}

let dom
let root
let container

beforeEach(() => {
  resetHostMocks()
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })
  container = dom.window.document.getElementById('root')

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: dom.window,
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: dom.window.document,
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: dom.window.navigator,
  })
  Object.defineProperty(globalThis, 'HTMLElement', {
    configurable: true,
    writable: true,
    value: dom.window.HTMLElement,
  })
  Object.defineProperty(globalThis, 'Node', {
    configurable: true,
    writable: true,
    value: dom.window.Node,
  })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    writable: true,
    value: true,
  })

  root = createRoot(container)
})

afterEach(async () => {
  if (root) {
    await act(async () => {
      root.unmount()
    })
  }

  delete globalThis.window
  delete globalThis.document
  delete globalThis.navigator
  delete globalThis.HTMLElement
  delete globalThis.Node
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
})

test('keeps host subscriptions stable while honoring the latest route and store filters', async () => {
  const allowDevRouteAndCommittedStore = {
    shouldNotifyRoute: (route) => route.fullPath.startsWith('/dev'),
    shouldNotifyStore: (mutation) => mutation.type === 'committed',
  }
  const allowWelcomeRouteAndPublishedStore = {
    shouldNotifyRoute: (route) => route.fullPath.startsWith('/welcome'),
    shouldNotifyStore: (mutation) => mutation.type === 'published',
  }

  await act(async () => {
    root.render(
      React.createElement(HostSnapshotHarness, allowDevRouteAndCommittedStore)
    )
  })

  expect(subscribeRouteChanges).toHaveBeenCalledTimes(1)
  expect(subscribeState).toHaveBeenCalledTimes(1)

  act(() => {
    emitRouteChange({ fullPath: '/dev/demo/design' })
  })

  expect(container.querySelector('[data-testid="host-snapshot-version"]').dataset.version).toBe(
    '1'
  )

  act(() => {
    emitStoreMutation({ type: 'ignored' })
  })

  expect(container.querySelector('[data-testid="host-snapshot-version"]').dataset.version).toBe(
    '1'
  )

  await act(async () => {
    root.render(React.createElement(HostSnapshotHarness, allowWelcomeRouteAndPublishedStore))
  })

  expect(subscribeRouteChanges).toHaveBeenCalledTimes(1)
  expect(subscribeState).toHaveBeenCalledTimes(1)

  act(() => {
    emitRouteChange({ fullPath: '/dev/demo/design' })
  })

  expect(container.querySelector('[data-testid="host-snapshot-version"]').dataset.version).toBe(
    '1'
  )

  act(() => {
    emitStoreMutation({ type: 'published' })
  })

  expect(container.querySelector('[data-testid="host-snapshot-version"]').dataset.version).toBe(
    '2'
  )
})
