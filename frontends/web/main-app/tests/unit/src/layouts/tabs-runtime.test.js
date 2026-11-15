import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'

const {
  mockTabs,
  mockI18nService,
  flushAnimationFrames,
  getPendingAnimationFrameCount,
  resolveMoveTab,
  rejectMoveTab,
  rotateMoveTabDeferred,
  resetHarness,
  requestAnimationFrameMock,
  cancelAnimationFrameMock,
} = vi.hoisted(() => {
  function createDeferred() {
    let resolve
    let reject

    const promise = new Promise((promiseResolve, promiseReject) => {
      resolve = promiseResolve
      reject = promiseReject
    })

    return { promise, resolve, reject }
  }

  let moveTabDeferred = createDeferred()
  const rafCallbacks = new Map()
  let nextRafId = 1

  const mockTabs = {
    moveTab: vi.fn(() => moveTabDeferred.promise),
    switchTab: vi.fn(),
    closeTab: vi.fn(),
    closeOtherTabs: vi.fn(),
    closeRightTabs: vi.fn(),
    toggleFixedTab: vi.fn(),
  }

  const mockI18nService = {
    getManager: vi.fn(() => ({
      tCommon: vi.fn((_key, defaultText) => defaultText),
    })),
  }

  function resetHarness() {
    moveTabDeferred = createDeferred()
    rafCallbacks.clear()
    nextRafId = 1
    mockTabs.moveTab.mockClear()
    mockTabs.switchTab.mockClear()
    mockTabs.closeTab.mockClear()
    mockTabs.closeOtherTabs.mockClear()
    mockTabs.closeRightTabs.mockClear()
    mockTabs.toggleFixedTab.mockClear()
    mockTabs.moveTab.mockImplementation(() => moveTabDeferred.promise)
    mockI18nService.getManager.mockClear()
  }

  function flushAnimationFrames() {
    const pendingCallbacks = Array.from(rafCallbacks.values())
    rafCallbacks.clear()
    pendingCallbacks.forEach((callback) => {
      callback(0)
    })
  }

  function getPendingAnimationFrameCount() {
    return rafCallbacks.size
  }

  function resolveMoveTab(value) {
    moveTabDeferred.resolve(value)
  }

  function rejectMoveTab(error) {
    moveTabDeferred.reject(error)
  }

  function rotateMoveTabDeferred() {
    const previousDeferred = moveTabDeferred
    moveTabDeferred = createDeferred()
    return previousDeferred
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

  return {
    mockTabs,
    mockI18nService,
    flushAnimationFrames,
    getPendingAnimationFrameCount,
    resolveMoveTab,
    rejectMoveTab,
    rotateMoveTabDeferred,
    resetHarness,
    requestAnimationFrameMock,
    cancelAnimationFrameMock,
  }
})

vi.mock('@/common/tabs', () => ({
  default: mockTabs,
}))

vi.mock('@/common/i18n', () => ({
  i18nService: mockI18nService,
}))

const { Tabs } = await import('../../../../src/layouts/Tabs/index.tsx')

let dom
let root
let container

function createTabsList() {
  return [
    { id: 'tab-1', path: '/tab-1', title: 'Alpha' },
    { id: 'tab-2', path: '/tab-2', title: 'Beta' },
    { id: 'tab-3', path: '/tab-3', title: 'Gamma' },
    { id: 'tab-4', path: '/tab-4', title: 'Delta' },
  ]
}

function dispatchMouseEvent(target, type, init = {}) {
  target.dispatchEvent(
    new dom.window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: type === 'mouseup' ? 0 : 1,
      clientX: 0,
      clientY: 0,
      ...init,
    })
  )
}

function getTabShells() {
  return Array.from(container.querySelectorAll('.app-tabs__item'))
}

function dispatchTransitionEnd(target, propertyName = 'transform') {
  const event = new dom.window.Event('transitionend', {
    bubbles: true,
  })
  Object.defineProperty(event, 'propertyName', {
    configurable: true,
    value: propertyName,
  })
  target.dispatchEvent(event)
}

function getCloseButton(tabTitle) {
  return container.querySelector(`[aria-label="关闭标签 ${tabTitle}"]`)
}

function getContextMenuButtons() {
  return Array.from(container.querySelectorAll('.app-tabs__menu button'))
}

function getArrowButton(direction) {
  const label = direction === 'left' ? '向左滚动标签' : '向右滚动标签'
  return container.querySelector(`[aria-label="${label}"]`)
}

function setTabGeometry({ getTransformOffset = () => 0 } = {}) {
  const wrapper = container.querySelector('.app-tabs__wrapper')
  if (!wrapper) {
    throw new Error('Tabs wrapper not found')
  }

  Object.defineProperty(wrapper, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: 0,
  })
  Object.defineProperty(wrapper, 'clientWidth', {
    configurable: true,
    value: 240,
  })
  Object.defineProperty(wrapper, 'offsetWidth', {
    configurable: true,
    value: 240,
  })
  Object.defineProperty(wrapper, 'scrollWidth', {
    configurable: true,
    value: 530,
  })
  Object.defineProperty(wrapper, 'scrollBy', {
    configurable: true,
    writable: true,
    value: ({ left }) => {
      wrapper.scrollLeft += left
      wrapper.dispatchEvent(new dom.window.Event('scroll', { bubbles: true }))
    },
  })
  Object.defineProperty(wrapper, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 0,
      right: 480,
      top: 0,
      bottom: 32,
      width: 480,
      height: 32,
      x: 0,
      y: 0,
      toJSON() {},
    }),
  })

  getTabShells().forEach((tabShell) => {
    const getDynamicLeft = () =>
      Array.from(container.querySelectorAll('.app-tabs__item')).indexOf(tabShell) * 106
    Object.defineProperty(tabShell, 'offsetLeft', {
      configurable: true,
      get: getDynamicLeft,
    })
    Object.defineProperty(tabShell, 'offsetWidth', {
      configurable: true,
      value: 100,
    })
    Object.defineProperty(tabShell, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: getDynamicLeft() + getTransformOffset(tabShell),
        right: getDynamicLeft() + getTransformOffset(tabShell) + 100,
        top: 0,
        bottom: 32,
        width: 100,
        height: 32,
        x: getDynamicLeft() + getTransformOffset(tabShell),
        y: 0,
        toJSON() {},
      }),
    })
  })
}

beforeEach(() => {
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
  Object.defineProperty(globalThis, 'TransitionEvent', {
    configurable: true,
    writable: true,
    value: dom.window.TransitionEvent,
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
  delete globalThis.TransitionEvent
  delete globalThis.requestAnimationFrame
  delete globalThis.cancelAnimationFrame
  delete globalThis.IS_REACT_ACT_ENVIRONMENT

  dom?.window.close()
  dom = null
  root = null
  container = null
})

test('tabs surface renders svg arrows, track shell, and overflow affordances', async () => {
  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  await act(async () => {
    dom.window.dispatchEvent(new dom.window.Event('resize'))
  })

  const leftArrow = getArrowButton('left')
  const rightArrow = getArrowButton('right')
  const track = container.querySelector('.app-tabs__track')
  const shadows = Array.from(container.querySelectorAll('.app-tabs__edge-shadow'))

  expect(leftArrow.className).toContain('is-hidden')
  expect(rightArrow.className).not.toContain('is-hidden')
  expect(leftArrow.querySelector('use')?.getAttribute('xlink:href')).toBe(
    '#icon-tab-arrow-left'
  )
  expect(rightArrow.querySelector('use')?.getAttribute('xlink:href')).toBe(
    '#icon-tab-arrow-right'
  )
  expect(track).not.toBeNull()
  expect(shadows).toHaveLength(2)
  expect(shadows[0].className).not.toContain('is-visible')
  expect(shadows[1].className).toContain('is-visible')
})

test('short arrow clicks request smooth scrolling and update hidden states through scroll events', async () => {
  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  const wrapper = container.querySelector('.app-tabs__wrapper')
  const rightArrow = getArrowButton('right')
  const leftArrow = getArrowButton('left')
  const scrollBySpy = vi.spyOn(wrapper, 'scrollBy')

  await act(async () => {
    dispatchMouseEvent(rightArrow, 'click', { clientX: 0, clientY: 0 })
  })

  expect(scrollBySpy).toHaveBeenCalledWith({ left: 100, behavior: 'smooth' })
  expect(wrapper.scrollLeft).toBe(100)
  expect(leftArrow.className).not.toContain('is-hidden')
  expect(rightArrow.className).not.toContain('is-hidden')
})

test('long arrow hold steps continuously, stops on mouseup, and consumes the trailing click once', async () => {
  vi.useFakeTimers()

  try {
    await act(async () => {
      root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
    })
    setTabGeometry()

    const wrapper = container.querySelector('.app-tabs__wrapper')
    const rightArrow = getArrowButton('right')
    const scrollBySpy = vi.spyOn(wrapper, 'scrollBy')

    await act(async () => {
      dispatchMouseEvent(rightArrow, 'mousedown', { clientX: 0, clientY: 0 })
      vi.advanceTimersByTime(180)
    })

    expect(scrollBySpy).toHaveBeenLastCalledWith({ left: 8, behavior: 'auto' })

    await act(async () => {
      flushAnimationFrames()
    })

    expect(scrollBySpy).toHaveBeenLastCalledWith({ left: 8, behavior: 'auto' })

    const callCountAfterHold = scrollBySpy.mock.calls.length
    await act(async () => {
      dispatchMouseEvent(dom.window.document, 'mouseup', {
        clientX: 0,
        clientY: 0,
        buttons: 0,
      })
      dispatchMouseEvent(rightArrow, 'click', { clientX: 0, clientY: 0 })
    })

    expect(scrollBySpy.mock.calls.length).toBe(callCountAfterHold)

    await act(async () => {
      vi.runAllTimers()
    })

    await act(async () => {
      dispatchMouseEvent(rightArrow, 'click', { clientX: 0, clientY: 0 })
    })

    expect(scrollBySpy).toHaveBeenLastCalledWith({ left: 100, behavior: 'smooth' })
  } finally {
    vi.useRealTimers()
  }
})

test('arrow scroll fallback clamps scrollLeft and still refreshes hidden states immediately', async () => {
  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  const wrapper = container.querySelector('.app-tabs__wrapper')
  const rightArrow = getArrowButton('right')
  const leftArrow = getArrowButton('left')
  delete wrapper.scrollBy

  await act(async () => {
    dispatchMouseEvent(rightArrow, 'click', { clientX: 0, clientY: 0 })
  })

  expect(wrapper.scrollLeft).toBe(100)
  expect(leftArrow.className).not.toContain('is-hidden')
  expect(rightArrow.className).not.toContain('is-hidden')
})

test('plain clicks switch tabs, but a threshold-crossing drag commits moveTab and suppresses the follow-up click', async () => {
  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  const [firstTab, secondTab] = getTabShells()

  await act(async () => {
    dispatchMouseEvent(firstTab, 'mousedown', { clientX: 20, clientY: 20 })
    dispatchMouseEvent(firstTab, 'mouseup', { clientX: 20, clientY: 20, buttons: 0 })
    dispatchMouseEvent(firstTab, 'click', { clientX: 20, clientY: 20 })
  })

  expect(mockTabs.switchTab).toHaveBeenCalledWith('tab-1')

  mockTabs.switchTab.mockClear()

  await act(async () => {
    dispatchMouseEvent(secondTab, 'mousedown', { clientX: 120, clientY: 20 })
    dispatchMouseEvent(dom.window.document, 'mousemove', {
      clientX: 206,
      clientY: 20,
      buttons: 1,
    })
  })

  expect(secondTab.className).toContain('is-dragging')
  expect(secondTab.style.getPropertyValue('--app-tabs-drag-offset')).toBe('86px')

  await act(async () => {
    dispatchMouseEvent(dom.window.document, 'mouseup', {
      clientX: 206,
      clientY: 20,
      buttons: 0,
    })
    dispatchMouseEvent(secondTab, 'click', { clientX: 206, clientY: 20 })
  })

  expect(mockTabs.moveTab).toHaveBeenCalledWith('tab-2', 'tab-3', 'after')
  expect(mockTabs.switchTab).not.toHaveBeenCalled()

  await act(async () => {
    resolveMoveTab(true)
  })
})

test('a rejected moveTab promise reverts the drag and leaves tabs interactive', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  const [, secondTab] = getTabShells()

  await act(async () => {
    dispatchMouseEvent(secondTab, 'mousedown', { clientX: 120, clientY: 20 })
    dispatchMouseEvent(dom.window.document, 'mousemove', {
      clientX: 206,
      clientY: 20,
      buttons: 1,
    })
    dispatchMouseEvent(dom.window.document, 'mouseup', {
      clientX: 246,
      clientY: 20,
      buttons: 0,
    })
  })

  expect(mockTabs.moveTab).toHaveBeenCalledWith('tab-2', 'tab-3', 'after')

  await act(async () => {
    rejectMoveTab(new Error('move failed'))
    await Promise.resolve()
  })

  expect(warn).toHaveBeenCalledWith(
    'OuroborosTabs: failed to move tab',
    expect.objectContaining({ message: 'move failed' })
  )
  warn.mockRestore()
  expect(secondTab.className).toContain('is-settling--revert')

  await act(async () => {
    flushAnimationFrames()
  })

  await act(async () => {
    dispatchTransitionEnd(secondTab)
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0))
  })

  expect(secondTab.className).not.toContain('is-settling')

  await act(async () => {
    dispatchMouseEvent(getTabShells()[0], 'click')
  })

  expect(mockTabs.switchTab).toHaveBeenCalledWith('tab-1')

  await act(async () => {
    dispatchMouseEvent(getCloseButton('Beta'), 'click')
  })

  expect(mockTabs.closeTab).toHaveBeenCalledWith('tab-2')
})

test.each([
  ['rejects', (deferred) => deferred.reject(new Error('stale move failed'))],
  ['resolves false', (deferred) => deferred.resolve(false)],
])(
  'a stale moveTab result that %s cannot clear a newer drag session',
  async (_, settleOldMove) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await act(async () => {
      root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
    })
    setTabGeometry()

    const [, secondTab, thirdTab] = getTabShells()

    await act(async () => {
      dispatchMouseEvent(secondTab, 'mousedown', { clientX: 120, clientY: 20 })
      dispatchMouseEvent(dom.window.document, 'mousemove', {
        clientX: 206,
        clientY: 20,
        buttons: 1,
      })
      dispatchMouseEvent(dom.window.document, 'mouseup', {
        clientX: 246,
        clientY: 20,
        buttons: 0,
      })

      dispatchMouseEvent(thirdTab, 'mousedown', { clientX: 226, clientY: 20 })
      dispatchMouseEvent(dom.window.document, 'mousemove', {
        clientX: 312,
        clientY: 20,
        buttons: 1,
      })
    })

    expect(mockTabs.moveTab).toHaveBeenCalledTimes(1)
    expect(thirdTab.className).not.toContain('is-dragging')

    const oldMoveDeferred = rotateMoveTabDeferred()
    const movedTabsList = [
      { id: 'tab-1', path: '/tab-1', title: 'Alpha' },
      { id: 'tab-3', path: '/tab-3', title: 'Gamma' },
      { id: 'tab-2', path: '/tab-2', title: 'Beta' },
      { id: 'tab-4', path: '/tab-4', title: 'Delta' },
    ]

    await act(async () => {
      root.render(React.createElement(Tabs, { tabsList: movedTabsList }))
    })
    setTabGeometry()

    await act(async () => {
      flushAnimationFrames()
    })
    await act(async () => {
      dispatchTransitionEnd(getTabShells()[2])
    })

    const nextDraggingTab = getTabShells()[1]
    await act(async () => {
      dispatchMouseEvent(nextDraggingTab, 'mousedown', { clientX: 120, clientY: 20 })
      dispatchMouseEvent(dom.window.document, 'mousemove', {
        clientX: 206,
        clientY: 20,
        buttons: 1,
      })
    })

    expect(nextDraggingTab.className).toContain('is-dragging')

    await act(async () => {
      settleOldMove(oldMoveDeferred)
      await Promise.resolve()
    })

    expect(nextDraggingTab.className).toContain('is-dragging')
    warn.mockRestore()
  }
)

test('close button clicks stay isolated from shell selection', async () => {
  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  const closeButton = getCloseButton('Beta')

  await act(async () => {
    dispatchMouseEvent(closeButton, 'click', { clientX: 120, clientY: 20 })
  })

  expect(mockTabs.closeTab).toHaveBeenCalledWith('tab-2')
  expect(mockTabs.switchTab).not.toHaveBeenCalled()
  expect(mockTabs.moveTab).not.toHaveBeenCalled()
})

test('context menu keeps item order and routes fixed-toggle, close-others, and close-right actions through tabs runtime', async () => {
  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  const [, secondTab] = getTabShells()

  await act(async () => {
    dispatchMouseEvent(secondTab, 'contextmenu', {
      button: 2,
      buttons: 2,
      clientX: 120,
      clientY: 20,
    })
  })

  expect(getContextMenuButtons().map((button) => button.textContent?.trim())).toEqual([
    '关闭',
    '固定标签',
    '关闭其他',
    '关闭右侧标签',
  ])

  await act(async () => {
    dispatchMouseEvent(getContextMenuButtons()[1], 'click', { clientX: 120, clientY: 20 })
  })

  expect(mockTabs.toggleFixedTab).toHaveBeenCalledWith('tab-2')

  await act(async () => {
    dispatchMouseEvent(secondTab, 'contextmenu', {
      button: 2,
      buttons: 2,
      clientX: 120,
      clientY: 20,
    })
    dispatchMouseEvent(getContextMenuButtons()[2], 'click', {
      clientX: 120,
      clientY: 20,
    })
  })

  expect(mockTabs.closeOtherTabs).toHaveBeenCalledWith('tab-2')

  await act(async () => {
    dispatchMouseEvent(secondTab, 'contextmenu', {
      button: 2,
      buttons: 2,
      clientX: 120,
      clientY: 20,
    })
    dispatchMouseEvent(getContextMenuButtons()[3], 'click', { clientX: 120, clientY: 20 })
  })

  expect(mockTabs.closeRightTabs).toHaveBeenCalledWith('tab-2')
})

test('context menu and tab switching consume action rejections', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  try {
    await act(async () => {
      root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
    })
    setTabGeometry()

    const [, secondTab] = getTabShells()
    const rejectedAction = (action, errorMessage) => {
      const error = new Error(errorMessage)
      action.mockRejectedValueOnce(error)
      return error
    }
    const openContextMenu = async () => {
      await act(async () => {
        dispatchMouseEvent(secondTab, 'contextmenu', {
          button: 2,
          buttons: 2,
          clientX: 120,
          clientY: 20,
        })
      })
    }
    const clickContextMenuAction = async (index) => {
      await act(async () => {
        dispatchMouseEvent(getContextMenuButtons()[index], 'click', {
          clientX: 120,
          clientY: 20,
        })
        await Promise.resolve()
      })
    }

    const closeError = new Error('close failed')
    mockTabs.closeTab.mockRejectedValueOnce(closeError)
    await act(async () => {
      dispatchMouseEvent(getCloseButton('Beta'), 'click', { clientX: 120, clientY: 20 })
      await Promise.resolve()
    })
    expect(warn).toHaveBeenCalledWith('OuroborosTabs: failed to close tab', closeError)

    await openContextMenu()
    const fixedError = await rejectedAction(mockTabs.toggleFixedTab, 'fixed failed')
    await clickContextMenuAction(1)
    expect(warn).toHaveBeenCalledWith(
      'OuroborosTabs: failed to toggle fixed tab',
      fixedError
    )

    await openContextMenu()
    const closeOthersError = rejectedAction(mockTabs.closeOtherTabs, 'others failed')
    await clickContextMenuAction(2)
    expect(warn).toHaveBeenCalledWith(
      'OuroborosTabs: failed to close other tabs',
      closeOthersError
    )

    await openContextMenu()
    const closeRightError = await rejectedAction(mockTabs.closeRightTabs, 'right failed')
    await clickContextMenuAction(3)
    expect(warn).toHaveBeenCalledWith(
      'OuroborosTabs: failed to close right tabs',
      closeRightError
    )

    const switchClickError = new Error('click switch failed')
    mockTabs.switchTab.mockRejectedValueOnce(switchClickError)
    await act(async () => {
      dispatchMouseEvent(getTabShells()[0], 'click')
      await Promise.resolve()
    })
    expect(warn).toHaveBeenCalledWith(
      'OuroborosTabs: failed to switch tab',
      switchClickError
    )

    const switchKeyError = new Error('key switch failed')
    mockTabs.switchTab.mockRejectedValueOnce(switchKeyError)
    await act(async () => {
      getTabShells()[0].dispatchEvent(
        new dom.window.KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Enter',
        })
      )
      await Promise.resolve()
    })
    expect(warn).toHaveBeenCalledWith(
      'OuroborosTabs: failed to switch tab',
      switchKeyError
    )
  } finally {
    warn.mockRestore()
  }
})

test('context menu clamps to the viewport width instead of the tab shell width', async () => {
  Object.defineProperty(dom.window.document.documentElement, 'clientWidth', {
    configurable: true,
    value: 200,
  })

  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  const [, secondTab] = getTabShells()

  await act(async () => {
    dispatchMouseEvent(secondTab, 'contextmenu', {
      button: 2,
      buttons: 2,
      clientX: 190,
      clientY: 20,
    })
  })

  expect(container.querySelector('.app-tabs__menu')?.style.left).toBe('76px')
  expect(container.querySelector('.app-tabs__menu')?.style.top).toBe('20px')
})

test('visibilitychange cancels an active drag without committing a move', async () => {
  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  const [, secondTab] = getTabShells()

  Object.defineProperty(dom.window.document, 'hidden', {
    configurable: true,
    value: true,
  })

  await act(async () => {
    dispatchMouseEvent(secondTab, 'mousedown', { clientX: 120, clientY: 20 })
    dispatchMouseEvent(dom.window.document, 'mousemove', {
      clientX: 206,
      clientY: 20,
      buttons: 1,
    })
    dom.window.document.dispatchEvent(
      new dom.window.Event('visibilitychange', { bubbles: true })
    )
  })

  expect(mockTabs.moveTab).not.toHaveBeenCalled()
  expect(mockTabs.switchTab).not.toHaveBeenCalled()
})

test('a committed move settles from the release offset into the committed slot and clears on transform end', async () => {
  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  const [, secondTab] = getTabShells()

  await act(async () => {
    dispatchMouseEvent(secondTab, 'mousedown', { clientX: 120, clientY: 20 })
    dispatchMouseEvent(dom.window.document, 'mousemove', {
      clientX: 312,
      clientY: 20,
      buttons: 1,
    })
    dispatchMouseEvent(dom.window.document, 'mouseup', {
      clientX: 312,
      clientY: 20,
      buttons: 0,
    })
  })

  const movedTabsList = [
    { id: 'tab-1', path: '/tab-1', title: 'Alpha' },
    { id: 'tab-3', path: '/tab-3', title: 'Gamma' },
    { id: 'tab-4', path: '/tab-4', title: 'Delta' },
    { id: 'tab-2', path: '/tab-2', title: 'Beta' },
  ]

  await act(async () => {
    resolveMoveTab(true)
    await Promise.resolve()
  })

  await act(async () => {
    root.render(
      React.createElement(Tabs, {
        tabsList: movedTabsList,
      })
    )
  })
  setTabGeometry()

  const draggedTab = getTabShells()[3]
  expect(draggedTab.className).toContain('is-settling')
  expect(draggedTab.className).toContain('is-settling--commit')
  expect(draggedTab.style.getPropertyValue('--app-tabs-drag-offset')).toBe('-20px')

  await act(async () => {
    flushAnimationFrames()
  })

  expect(getTabShells()[3].style.getPropertyValue('--app-tabs-drag-offset')).toBe('0px')

  await act(async () => {
    dispatchTransitionEnd(getTabShells()[3])
  })

  expect(getTabShells()[3].className).not.toContain('is-settling')
})

test('a no-op commit with zero settle offset clears the drag lock without transitionend', async () => {
  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  const [, secondTab] = getTabShells()

  await act(async () => {
    dispatchMouseEvent(secondTab, 'mousedown', { clientX: 120, clientY: 20 })
    dispatchMouseEvent(dom.window.document, 'mousemove', {
      clientX: 206,
      clientY: 20,
      buttons: 1,
    })
    dispatchMouseEvent(dom.window.document, 'mouseup', {
      clientX: 120,
      clientY: 20,
      buttons: 0,
    })
  })

  expect(mockTabs.moveTab).toHaveBeenCalledWith('tab-2', 'tab-1', 'after')

  await act(async () => {
    resolveMoveTab(true)
    await Promise.resolve()
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0))
  })

  await act(async () => {
    dispatchMouseEvent(getTabShells()[0], 'click')
  })

  expect(mockTabs.switchTab).toHaveBeenCalledWith('tab-1')
  expect(getTabShells()[1].className).not.toContain('is-settling')
})

test('a zero-offset cancel clears the drag lock without transitionend', async () => {
  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  const [, secondTab] = getTabShells()
  Object.defineProperty(dom.window.document, 'hidden', {
    configurable: true,
    value: true,
  })

  await act(async () => {
    dispatchMouseEvent(secondTab, 'mousedown', { clientX: 120, clientY: 20 })
    dispatchMouseEvent(dom.window.document, 'mousemove', {
      clientX: 206,
      clientY: 20,
      buttons: 1,
    })
    dispatchMouseEvent(dom.window.document, 'mousemove', {
      clientX: 120,
      clientY: 20,
      buttons: 1,
    })
    dom.window.document.dispatchEvent(
      new dom.window.Event('visibilitychange', { bubbles: true })
    )
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0))
  })

  expect(mockTabs.moveTab).not.toHaveBeenCalled()
  expect(getTabShells()[1].className).not.toContain('is-settling')

  await act(async () => {
    dispatchMouseEvent(getTabShells()[0], 'click')
  })

  expect(mockTabs.switchTab).toHaveBeenCalledWith('tab-1')
})

test('a release settle starts from the mouseup position instead of the last drag frame', async () => {
  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  const [, secondTab] = getTabShells()

  await act(async () => {
    dispatchMouseEvent(secondTab, 'mousedown', { clientX: 120, clientY: 20 })
    dispatchMouseEvent(dom.window.document, 'mousemove', {
      clientX: 206,
      clientY: 20,
      buttons: 1,
    })
    dispatchMouseEvent(dom.window.document, 'mouseup', {
      clientX: 246,
      clientY: 20,
      buttons: 0,
    })
  })

  await act(async () => {
    resolveMoveTab(true)
    await Promise.resolve()
  })

  const movedTabsList = [
    { id: 'tab-1', path: '/tab-1', title: 'Alpha' },
    { id: 'tab-3', path: '/tab-3', title: 'Gamma' },
    { id: 'tab-2', path: '/tab-2', title: 'Beta' },
    { id: 'tab-4', path: '/tab-4', title: 'Delta' },
  ]

  await act(async () => {
    root.render(
      React.createElement(Tabs, {
        tabsList: movedTabsList,
      })
    )
  })
  setTabGeometry()

  const draggedTab = getTabShells()[2]
  expect(draggedTab.style.getPropertyValue('--app-tabs-drag-offset')).toBe('20px')
})

test('unmounting during pointer drag and arrow hold clears listeners, timers, and animation frames', async () => {
  vi.useFakeTimers()
  globalThis.requestAnimationFrame = requestAnimationFrameMock
  globalThis.cancelAnimationFrame = cancelAnimationFrameMock

  try {
    await act(async () => {
      root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
    })
    setTabGeometry()

    const documentRemoveEventListenerSpy = vi.spyOn(
      dom.window.document,
      'removeEventListener'
    )
    const windowRemoveEventListenerSpy = vi.spyOn(dom.window, 'removeEventListener')
    const rightArrow = getArrowButton('right')
    const [, secondTab] = getTabShells()

    await act(async () => {
      dispatchMouseEvent(rightArrow, 'mousedown', { clientX: 0, clientY: 0 })
      vi.advanceTimersByTime(180)
      dispatchMouseEvent(secondTab, 'mousedown', { clientX: 120, clientY: 20 })
      dispatchMouseEvent(dom.window.document, 'mousemove', {
        clientX: 206,
        clientY: 20,
        buttons: 1,
      })
    })

    expect(getPendingAnimationFrameCount()).toBeGreaterThan(0)

    await act(async () => {
      root.unmount()
    })
    root = null

    expect(documentRemoveEventListenerSpy).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function)
    )
    expect(documentRemoveEventListenerSpy).toHaveBeenCalledWith(
      'mouseup',
      expect.any(Function)
    )
    expect(windowRemoveEventListenerSpy).toHaveBeenCalledWith(
      'blur',
      expect.any(Function)
    )
    expect(getPendingAnimationFrameCount()).toBe(0)
    expect(vi.getTimerCount()).toBe(0)

    await act(async () => {
      flushAnimationFrames()
      vi.runOnlyPendingTimers()
      dispatchMouseEvent(dom.window.document, 'mouseup', {
        clientX: 206,
        clientY: 20,
        buttons: 0,
      })
      dom.window.document.dispatchEvent(
        new dom.window.Event('visibilitychange', { bubbles: true })
      )
    })

    expect(mockTabs.moveTab).not.toHaveBeenCalled()
  } finally {
    vi.useRealTimers()
  }
})

test('commit settle measures the destination slot from layout position instead of the transformed rect', async () => {
  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  const [, secondTab] = getTabShells()

  await act(async () => {
    dispatchMouseEvent(secondTab, 'mousedown', { clientX: 120, clientY: 20 })
    dispatchMouseEvent(dom.window.document, 'mousemove', {
      clientX: 246,
      clientY: 20,
      buttons: 1,
    })
    dispatchMouseEvent(dom.window.document, 'mouseup', {
      clientX: 246,
      clientY: 20,
      buttons: 0,
    })
  })

  await act(async () => {
    resolveMoveTab(true)
    await Promise.resolve()
  })

  const movedTabsList = [
    { id: 'tab-1', path: '/tab-1', title: 'Alpha' },
    { id: 'tab-3', path: '/tab-3', title: 'Gamma' },
    { id: 'tab-2', path: '/tab-2', title: 'Beta' },
    { id: 'tab-4', path: '/tab-4', title: 'Delta' },
  ]

  const getCommittedTransformOffset = (tabShell) =>
    tabShell.getAttribute('aria-label') === '切换到标签 Beta' ? 20 : 0
  setTabGeometry({ getTransformOffset: getCommittedTransformOffset })
  vi.spyOn(dom.window, 'getComputedStyle').mockImplementation((element) => ({
    transform:
      element.getAttribute('aria-label') === '切换到标签 Beta'
        ? 'matrix(1, 0, 0, 1, 20, 0)'
        : 'none',
  }))

  await act(async () => {
    root.render(
      React.createElement(Tabs, {
        tabsList: movedTabsList,
      })
    )
  })
  setTabGeometry({ getTransformOffset: getCommittedTransformOffset })

  const draggedTab = getTabShells()[2]
  expect(draggedTab.style.getPropertyValue('--app-tabs-drag-offset')).toBe('20px')
})

test('cancel-like release paths queue a revert settle and clear after transform end without committing moveTab', async () => {
  await act(async () => {
    root.render(React.createElement(Tabs, { tabsList: createTabsList() }))
  })
  setTabGeometry()

  const [, secondTab] = getTabShells()

  Object.defineProperty(dom.window.document, 'hidden', {
    configurable: true,
    value: true,
  })

  await act(async () => {
    dispatchMouseEvent(secondTab, 'mousedown', { clientX: 120, clientY: 20 })
    dispatchMouseEvent(dom.window.document, 'mousemove', {
      clientX: 206,
      clientY: 20,
      buttons: 1,
    })
    dom.window.document.dispatchEvent(
      new dom.window.Event('visibilitychange', { bubbles: true })
    )
  })

  expect(mockTabs.moveTab).not.toHaveBeenCalled()
  expect(secondTab.className).toContain('is-settling')
  expect(secondTab.className).toContain('is-settling--revert')
  expect(secondTab.style.getPropertyValue('--app-tabs-drag-offset')).toBe('86px')

  await act(async () => {
    flushAnimationFrames()
  })

  expect(secondTab.style.getPropertyValue('--app-tabs-drag-offset')).toBe('0px')

  await act(async () => {
    dispatchTransitionEnd(secondTab)
  })

  expect(secondTab.className).not.toContain('is-settling')
})
