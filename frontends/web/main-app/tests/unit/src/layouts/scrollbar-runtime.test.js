import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'

const {
  flushAnimationFrames,
  mutationObserverInstances,
  requestAnimationFrameMock,
  cancelAnimationFrameMock,
  MockResizeObserver,
  MockMutationObserver,
  resetHarness,
} = vi.hoisted(() => {
  const rafCallbacks = new Map()
  let nextRafId = 1
  const mutationObserverInstances = []

  class MockResizeObserver {
    constructor(callback) {
      this.callback = callback
    }

    observe() {}

    disconnect() {}
  }

  class MockMutationObserver {
    constructor(callback) {
      this.callback = callback
      mutationObserverInstances.push(this)
    }

    observe() {}

    disconnect() {}
  }

  function requestAnimationFrameMock(callback) {
    const id = nextRafId
    nextRafId += 1
    rafCallbacks.set(id, callback)
    return id
  }

  function cancelAnimationFrameMock(id) {
    rafCallbacks.delete(id)
  }

  function flushAnimationFrames() {
    const callbacks = Array.from(rafCallbacks.values())
    rafCallbacks.clear()
    callbacks.forEach((callback) => callback(0))
  }

  function resetHarness() {
    rafCallbacks.clear()
    nextRafId = 1
    mutationObserverInstances.length = 0
  }

  return {
    flushAnimationFrames,
    mutationObserverInstances,
    requestAnimationFrameMock,
    cancelAnimationFrameMock,
    MockResizeObserver,
    MockMutationObserver,
    resetHarness,
  }
})

const { ScrollBar } = await import('../../../../src/layouts/ScrollBar.tsx')

let dom
let root
let container

function setFixedMetric(target, property, value) {
  Object.defineProperty(target, property, {
    configurable: true,
    get: () => value,
  })
}

function setMutableMetric(target, property, initialValue) {
  let currentValue = initialValue
  Object.defineProperty(target, property, {
    configurable: true,
    get: () => currentValue,
    set: (nextValue) => {
      currentValue = nextValue
    },
  })
}

function applyVerticalGeometry() {
  const viewport = container.querySelector('.c-scrollbar__viewport')
  const rail = container.querySelector('.c-scrollbar__rail')

  expect(viewport).toBeTruthy()
  expect(rail).toBeTruthy()

  setFixedMetric(viewport, 'clientHeight', 100)
  setFixedMetric(viewport, 'clientWidth', 200)
  setFixedMetric(viewport, 'scrollHeight', 400)
  setFixedMetric(viewport, 'scrollWidth', 200)
  setMutableMetric(viewport, 'scrollTop', 0)
  setMutableMetric(viewport, 'scrollLeft', 0)

  setFixedMetric(rail, 'clientHeight', 100)
  setFixedMetric(rail, 'clientWidth', 4)
  Object.defineProperty(rail, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      top: 0,
      left: 0,
      right: 4,
      bottom: 100,
      width: 4,
      height: 100,
      x: 0,
      y: 0,
      toJSON() {},
    }),
  })

  return { viewport, rail }
}

function getRail() {
  return container.querySelector('.c-scrollbar__rail')
}

function getThumb() {
  return container.querySelector('.c-scrollbar__thumb')
}

beforeEach(() => {
  vi.useFakeTimers()
  resetHarness()
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
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: requestAnimationFrameMock,
  })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    writable: true,
    value: cancelAnimationFrameMock,
  })
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: MockResizeObserver,
  })
  Object.defineProperty(globalThis, 'MutationObserver', {
    configurable: true,
    writable: true,
    value: MockMutationObserver,
  })

  root = createRoot(container)
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  delete globalThis.window
  delete globalThis.document
  delete globalThis.requestAnimationFrame
  delete globalThis.cancelAnimationFrame
  delete globalThis.ResizeObserver
  delete globalThis.MutationObserver
})

test('always mode keeps the rail visible and supports rail click jumps', () => {
  act(() => {
    root.render(
      React.createElement(
        ScrollBar,
        null,
        React.createElement('div', null, 'overflow content')
      )
    )
  })

  const { viewport, rail } = applyVerticalGeometry()

  act(() => {
    flushAnimationFrames()
  })

  expect(getRail()?.className).toContain('is-visible')
  expect(getThumb()?.style.height).toBe('25px')
  expect(getThumb()?.style.transform).toBe('translateY(0px)')

  act(() => {
    rail.dispatchEvent(
      new dom.window.MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientY: 80,
      })
    )
    flushAnimationFrames()
  })

  expect(viewport.scrollTop).toBeGreaterThan(0)
  expect(getThumb()?.style.transform).not.toBe('translateY(0px)')
})

test('auto mode reveals on scroll and hides again after 1000ms idle', () => {
  act(() => {
    root.render(
      React.createElement(
        ScrollBar,
        { visibilityMode: 'auto' },
        React.createElement('div', null, 'overflow content')
      )
    )
  })

  const { viewport } = applyVerticalGeometry()

  act(() => {
    flushAnimationFrames()
  })

  expect(getRail()?.className).not.toContain('is-visible')

  act(() => {
    viewport.scrollTop = 60
    viewport.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    flushAnimationFrames()
  })

  expect(getRail()?.className).toContain('is-visible')

  act(() => {
    vi.advanceTimersByTime(1000)
  })

  expect(getRail()?.className).not.toContain('is-visible')
})

test('auto mode reveals again after the 120ms content-change debounce', () => {
  act(() => {
    root.render(
      React.createElement(
        ScrollBar,
        { visibilityMode: 'auto' },
        React.createElement('div', null, 'overflow content')
      )
    )
  })

  applyVerticalGeometry()

  act(() => {
    flushAnimationFrames()
  })

  expect(getRail()?.className).not.toContain('is-visible')
  expect(mutationObserverInstances.length).toBeGreaterThan(0)

  act(() => {
    mutationObserverInstances[0].callback()
    vi.advanceTimersByTime(119)
  })

  expect(getRail()?.className).not.toContain('is-visible')

  act(() => {
    vi.advanceTimersByTime(1)
    flushAnimationFrames()
    flushAnimationFrames()
  })

  expect(getRail()?.className).toContain('is-visible')
})

test('thumb drag toggles the body drag class and updates scroll position', () => {
  act(() => {
    root.render(
      React.createElement(
        ScrollBar,
        { visibilityMode: 'auto' },
        React.createElement('div', null, 'overflow content')
      )
    )
  })

  const { viewport } = applyVerticalGeometry()

  act(() => {
    flushAnimationFrames()
  })

  const thumb = getThumb()
  expect(thumb).toBeTruthy()

  act(() => {
    thumb.dispatchEvent(
      new dom.window.MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientY: 10,
      })
    )
  })

  expect(document.body.classList.contains('is-c-scrollbar-dragging')).toBe(true)

  act(() => {
    document.dispatchEvent(
      new dom.window.MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientY: 40,
      })
    )
    flushAnimationFrames()
  })

  expect(viewport.scrollTop).toBeGreaterThan(0)

  act(() => {
    document.dispatchEvent(
      new dom.window.MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
      })
    )
    flushAnimationFrames()
  })

  expect(document.body.classList.contains('is-c-scrollbar-dragging')).toBe(false)
})
