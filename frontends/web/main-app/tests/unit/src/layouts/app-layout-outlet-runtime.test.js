import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'

const {
  readCurrentRoute,
  subscribeRouteChanges,
  subscribeState,
  setRoute,
  emitRouteChange,
  resetHostMocks,
} = vi.hoisted(() => {
  let currentRoute = null
  let routeListeners = new Set()
  let storeListeners = new Set()

  return {
    readCurrentRoute: vi.fn(() => currentRoute),
    subscribeRouteChanges: vi.fn((listener) => {
      routeListeners.add(listener)
      return () => routeListeners.delete(listener)
    }),
    subscribeState: vi.fn((listener) => {
      storeListeners.add(listener)
      return () => storeListeners.delete(listener)
    }),
    setRoute(route) {
      currentRoute = route
    },
    emitRouteChange(from = null) {
      routeListeners.forEach((listener) => listener(currentRoute, from))
    },
    resetHostMocks() {
      currentRoute = null
      routeListeners = new Set()
      storeListeners = new Set()
      readCurrentRoute.mockClear()
      subscribeRouteChanges.mockClear()
      subscribeState.mockClear()
    },
  }
})

vi.mock('../../../../src/router/routerFacade.ts', () => ({
  readCurrentRoute,
  subscribeRouteChanges,
}))

vi.mock('../../../../src/store/storeFacade.ts', () => ({
  subscribeState,
}))

const { default: AppLayoutOutlet } = await import('../../../../src/layouts/AppLayoutOutlet.tsx')

function buildRoute(pageComponent, fullPath) {
  return {
    fullPath,
    matched: [{ pageComponent }],
    meta: {},
  }
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
  Object.defineProperty(globalThis, 'MouseEvent', {
    configurable: true,
    writable: true,
    value: dom.window.MouseEvent,
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
  delete globalThis.MouseEvent
  delete globalThis.IS_REACT_ACT_ENVIRONMENT

  dom?.window.close()
  dom = null
  root = null
  container = null
})

test('keeps previously visited route pages mounted when switching away and back', async () => {
  function CounterPage() {
    const [count, setCount] = useState(0)

    return React.createElement(
      'button',
      {
        type: 'button',
        'data-testid': 'counter-page',
        onClick: () => setCount((current) => current + 1),
      },
      `${count}`
    )
  }

  function DetailPage() {
    return React.createElement('div', { 'data-testid': 'detail-page' }, 'detail')
  }

  setRoute(buildRoute(CounterPage, '/dev/apps'))

  await act(async () => {
    root.render(React.createElement(AppLayoutOutlet, { className: 'route-view' }))
  })

  expect(container.querySelectorAll('.route-cache-slot')).toHaveLength(1)
  expect(container.querySelector('.route-cache-slot')?.getAttribute('data-cache-scope')).toBe(
    'route'
  )

  const counterPage = container.querySelector('[data-testid="counter-page"]')
  expect(counterPage?.textContent).toBe('0')

  await act(async () => {
    counterPage.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
  })

  expect(container.querySelector('[data-testid="counter-page"]')?.textContent).toBe('1')

  setRoute(buildRoute(DetailPage, '/dev/model-detail'))

  await act(async () => {
    emitRouteChange(buildRoute(CounterPage, '/dev/apps'))
  })

  expect(container.querySelectorAll('.route-cache-slot')).toHaveLength(2)
  expect(container.querySelector('[data-testid="detail-page"]')?.textContent).toBe('detail')
  expect(container.querySelector('[data-testid="counter-page"]')?.textContent).toBe('1')

  setRoute(buildRoute(CounterPage, '/dev/apps'))

  await act(async () => {
    emitRouteChange(buildRoute(DetailPage, '/dev/model-detail'))
  })

  expect(container.querySelector('[data-testid="counter-page"]')?.textContent).toBe('1')
})

test('remounts one-time pages when a request changes or when navigating back', async () => {
  let nextMount = 0
  function OneTimePage() {
    const [mount] = useState(() => ++nextMount)
    return React.createElement('span', { 'data-testid': 'one-time' }, mount)
  }
  const request = (id) => ({ ...buildRoute(OneTimePage, '/login/oidc?loginRequestId=' + id), meta: { cache: false } })
  setRoute(request('first'))
  await act(async () => root.render(React.createElement(AppLayoutOutlet)))
  const page = () => container.querySelector('[data-testid="one-time"]')
  expect(page().textContent).toBe('1')
  setRoute(request('second'))
  await act(async () => emitRouteChange())
  expect(page().textContent).toBe('2')
  setRoute(buildRoute(() => React.createElement('div', null, 'login'), '/login'))
  await act(async () => emitRouteChange())
  expect(page()).toBeNull()
  setRoute(request('second'))
  await act(async () => emitRouteChange())
  expect(page().textContent).toBe('3')
})
