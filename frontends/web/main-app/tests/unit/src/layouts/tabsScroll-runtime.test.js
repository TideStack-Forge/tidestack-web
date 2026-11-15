import { expect, test, vi } from 'vitest'

import {
  getTabStripWheelDelta,
  hasHorizontalTabOverflow,
  scrollTabsBy,
  scrollTabStripByDelta,
  smoothScrollBehavior,
  tabArrowHoldDelayMs,
  tabArrowHoldFrameDistance,
  tabStripScrollStep,
} from '../../../../src/layouts/Tabs/tabsScroll.ts'

function createScrollHost(overrides = {}) {
  return {
    clientWidth: 240,
    scrollLeft: 0,
    scrollWidth: 640,
    ...overrides,
  }
}

test('getTabStripWheelDelta prefers horizontal gestures and falls back to legacy vertical wheel mapping', () => {
  expect(getTabStripWheelDelta({ deltaX: 36, deltaY: 120, wheelDelta: -120 })).toBe(36)
  expect(getTabStripWheelDelta({ deltaX: 0, deltaY: 12 })).toBe(120)
  expect(getTabStripWheelDelta({ deltaX: 0, deltaY: 12, wheelDelta: -120 })).toBe(30)
  expect(getTabStripWheelDelta({ deltaX: 0, deltaY: 0, wheelDelta: 120 })).toBe(-30)
  expect(getTabStripWheelDelta({ deltaX: 0, deltaY: 0 })).toBe(0)
})

test('scrollTabStripByDelta only moves when horizontal overflow exists and clamps to bounds', () => {
  const overflowHost = createScrollHost()

  expect(hasHorizontalTabOverflow(overflowHost)).toBe(true)
  expect(scrollTabStripByDelta(overflowHost, tabStripScrollStep)).toBe(true)
  expect(overflowHost.scrollLeft).toBe(100)

  expect(scrollTabStripByDelta(overflowHost, 1000)).toBe(true)
  expect(overflowHost.scrollLeft).toBe(400)

  expect(scrollTabStripByDelta(overflowHost, tabStripScrollStep)).toBe(false)
  expect(overflowHost.scrollLeft).toBe(400)

  expect(scrollTabStripByDelta(overflowHost, -1000)).toBe(true)
  expect(overflowHost.scrollLeft).toBe(0)

  const fittedHost = createScrollHost({ clientWidth: 320, scrollWidth: 320 })
  expect(hasHorizontalTabOverflow(fittedHost)).toBe(false)
  expect(scrollTabStripByDelta(fittedHost, tabStripScrollStep)).toBe(false)
  expect(fittedHost.scrollLeft).toBe(0)
})

test('scrollTabsBy prefers scrollBy for smooth and auto requests without forcing fallback refresh', () => {
  const calls = []
  const overflowHost = createScrollHost({
    scrollLeft: 80,
    scrollBy(options) {
      calls.push(options)
    },
  })
  const fallbackSpy = vi.fn()

  expect(scrollTabsBy(overflowHost, 100, smoothScrollBehavior, fallbackSpy)).toBe(true)
  expect(scrollTabsBy(overflowHost, tabArrowHoldFrameDistance, 'auto', fallbackSpy)).toBe(
    true
  )
  expect(calls).toEqual([
    { left: 100, behavior: 'smooth' },
    { left: 8, behavior: 'auto' },
  ])
  expect(fallbackSpy).not.toHaveBeenCalled()
})

test('scrollTabsBy fallback clamps scrollLeft and runs the immediate refresh hook once', () => {
  const overflowHost = createScrollHost({
    clientWidth: 120,
    scrollLeft: 40,
    scrollWidth: 240,
  })
  const fallbackSpy = vi.fn()

  expect(scrollTabsBy(overflowHost, -100, smoothScrollBehavior, fallbackSpy)).toBe(true)
  expect(overflowHost.scrollLeft).toBe(0)
  expect(fallbackSpy).toHaveBeenCalledTimes(1)

  fallbackSpy.mockClear()
  expect(scrollTabsBy(overflowHost, 1000, 'auto', fallbackSpy)).toBe(true)
  expect(overflowHost.scrollLeft).toBe(120)
  expect(fallbackSpy).toHaveBeenCalledTimes(1)
})

test('tabs scroll constants keep the migrated lts-v1 contract values', () => {
  expect(tabArrowHoldDelayMs).toBe(180)
  expect(tabArrowHoldFrameDistance).toBe(8)
  expect(smoothScrollBehavior).toBe('smooth')
})
