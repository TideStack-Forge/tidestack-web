import React, { act, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'

const { saveUserWidth } = vi.hoisted(() => ({
  saveUserWidth: vi.fn().mockResolvedValue({
    code: 0,
    status: 0,
    msg: 'ok',
    data: null,
  }),
}))

vi.mock('../../../../src/common/api/user.ts', () => ({
  default: {
    saveUserWidth,
  },
}))

const { useSidebarResize } = await import('../../../../src/layouts/useSidebarResize.ts')

function ResizeHarness(props) {
  const layoutRootRef = useRef(null)
  const { handleProps, isResizable } = useSidebarResize({
    layoutRootRef,
    ...props,
  })

  return React.createElement(
    'div',
    { ref: layoutRootRef, 'data-testid': 'layout-root' },
    isResizable
      ? React.createElement('div', {
          'data-testid': 'resize-handle',
          ...handleProps,
        })
      : null
  )
}

let dom
let root
let container
let consoleWarnSpy

beforeEach(() => {
  saveUserWidth.mockClear()
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })
  container = dom.window.document.getElementById('root')
  dom.window.PointerEvent = dom.window.MouseEvent

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
  Object.defineProperty(globalThis, 'PointerEvent', {
    configurable: true,
    writable: true,
    value: dom.window.PointerEvent,
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
  delete globalThis.PointerEvent
  delete globalThis.IS_REACT_ACT_ENVIRONMENT

  consoleWarnSpy?.mockRestore()

  dom?.window.close()
  dom = null
  root = null
  container = null
})

test('useSidebarResize clamps preview width and persists the final width once on pointerup', async () => {
  await act(async () => {
    root.render(
      React.createElement(ResizeHarness, {
        currentWidth: 200,
        enabled: true,
        sidebarExpanded: true,
        widthConfig: {
          width: 200,
          minWidth: 160,
          maxWidth: 360,
          resizable: true,
        },
      })
    )
  })

  const layoutRoot = container.querySelector('[data-testid="layout-root"]')
  const handle = container.querySelector('[data-testid="resize-handle"]')

  await act(async () => {
    handle.dispatchEvent(
      new window.PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 200,
      })
    )
  })

  await act(async () => {
    document.dispatchEvent(
      new window.PointerEvent('pointermove', {
        bubbles: true,
        clientX: 520,
      })
    )
  })

  expect(layoutRoot.style.getPropertyValue('--layout-sidebar-width-open')).toBe('360px')
  expect(layoutRoot.style.getPropertyValue('--sidebar-width-open')).toBe('360px')

  await act(async () => {
    document.dispatchEvent(
      new window.PointerEvent('pointerup', {
        bubbles: true,
        clientX: 520,
      })
    )
  })

  expect(window.sessionStorage.getItem('sidebar-width')).toBe('360')
  expect(saveUserWidth).toHaveBeenCalledTimes(1)
  expect(saveUserWidth).toHaveBeenCalledWith('sidebar-width', 360)
})

test('useSidebarResize starts the next drag from the latest committed width without waiting for a rerender', async () => {
  await act(async () => {
    root.render(
      React.createElement(ResizeHarness, {
        currentWidth: 200,
        enabled: true,
        sidebarExpanded: true,
        widthConfig: {
          width: 200,
          minWidth: 160,
          maxWidth: 360,
          resizable: true,
        },
      })
    )
  })

  const layoutRoot = container.querySelector('[data-testid="layout-root"]')
  const handle = container.querySelector('[data-testid="resize-handle"]')

  await act(async () => {
    handle.dispatchEvent(
      new window.PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 200,
      })
    )
    document.dispatchEvent(
      new window.PointerEvent('pointermove', {
        bubbles: true,
        clientX: 520,
      })
    )
    document.dispatchEvent(
      new window.PointerEvent('pointerup', {
        bubbles: true,
        clientX: 520,
      })
    )
  })

  expect(window.sessionStorage.getItem('sidebar-width')).toBe('360')

  await act(async () => {
    handle.dispatchEvent(
      new window.PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 520,
      })
    )
  })

  await act(async () => {
    document.dispatchEvent(
      new window.PointerEvent('pointermove', {
        bubbles: true,
        clientX: 480,
      })
    )
  })

  expect(layoutRoot.style.getPropertyValue('--layout-sidebar-width-open')).toBe('320px')
  expect(layoutRoot.style.getPropertyValue('--sidebar-width-open')).toBe('320px')

  await act(async () => {
    document.dispatchEvent(
      new window.PointerEvent('pointerup', {
        bubbles: true,
        clientX: 480,
      })
    )
  })

  expect(window.sessionStorage.getItem('sidebar-width')).toBe('320')
  expect(saveUserWidth).toHaveBeenCalledTimes(2)
  expect(saveUserWidth).toHaveBeenNthCalledWith(2, 'sidebar-width', 320)
})

test('useSidebarResize warns when remote persistence reports a failure status', async () => {
  saveUserWidth.mockResolvedValueOnce({
    code: 500,
    status: 500,
    msg: 'boom',
    data: null,
  })

  await act(async () => {
    root.render(
      React.createElement(ResizeHarness, {
        currentWidth: 200,
        enabled: true,
        sidebarExpanded: true,
        widthConfig: {
          width: 200,
          minWidth: 160,
          maxWidth: 360,
          resizable: true,
        },
      })
    )
  })

  const handle = container.querySelector('[data-testid="resize-handle"]')

  await act(async () => {
    handle.dispatchEvent(
      new window.PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 200,
      })
    )
    document.dispatchEvent(
      new window.PointerEvent('pointermove', {
        bubbles: true,
        clientX: 240,
      })
    )
    document.dispatchEvent(
      new window.PointerEvent('pointerup', {
        bubbles: true,
        clientX: 240,
      })
    )
    await Promise.resolve()
  })

  expect(consoleWarnSpy).toHaveBeenCalledWith(
    'OuroborosSidebar: failed to persist sidebar width for "sidebar-width"',
    expect.objectContaining({
      code: 500,
      status: 500,
    })
  )
})

test('useSidebarResize keeps the handle hidden when the sidebar is collapsed', async () => {
  await act(async () => {
    root.render(
      React.createElement(ResizeHarness, {
        currentWidth: 200,
        enabled: true,
        sidebarExpanded: false,
        widthConfig: {
          width: 200,
          minWidth: 160,
          maxWidth: 360,
          resizable: true,
        },
      })
    )
  })

  expect(container.querySelector('[data-testid="resize-handle"]')).toBeNull()
})
