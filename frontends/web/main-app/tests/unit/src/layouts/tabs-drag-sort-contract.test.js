import { JSDOM } from 'jsdom'
import { expect, test } from 'vitest'

import {
  consumeTabShellClickSuppression,
  hasCommittedTabMoveReflected,
  resolveTabDragAnchorOffset,
  resolveDraggedTabPointerOffset,
  resolveDisplacedTabOffset,
  resolveStableTabDropTarget,
  resolveTabDropBehavior,
  shouldCancelTabPointerDragOnReleasedButtons,
  shouldCancelTabPointerDragOnVisibilityChange,
  shouldIgnoreTabPointerDown,
  shouldStartTabPointerDrag,
  tabPointerDragThreshold,
} from '../../../../src/layouts/Tabs/tabsDragMath.ts'

const tabsList = [{ id: 'tab-1' }, { id: 'tab-2' }, { id: 'tab-3' }, { id: 'tab-4' }]

const geometryCache = {
  draggingTabId: 'tab-2',
  draggingWidth: 106,
  stripLeft: 100,
  scrollLeft: 0,
  draggingBounds: { left: 100, right: 200 },
  stableTabs: [
    { tabId: 'tab-1', left: 0, right: 100, width: 100, midpoint: 50 },
    { tabId: 'tab-3', left: 200, right: 300, width: 100, midpoint: 250 },
    { tabId: 'tab-4', left: 300, right: 400, width: 100, midpoint: 350 },
  ],
  boundaries: [
    { coordinate: 0, target: { tabId: 'tab-1', position: 'before' } },
    { coordinate: 100, target: { tabId: 'tab-1', position: 'after' } },
    { coordinate: 200, target: { tabId: 'tab-3', position: 'before' } },
    { coordinate: 300, target: { tabId: 'tab-3', position: 'after' } },
    { coordinate: 300, target: { tabId: 'tab-4', position: 'before' } },
    { coordinate: 400, target: { tabId: 'tab-4', position: 'after' } },
  ],
}

test('pointer drag threshold keeps ordinary clicks below threshold and starts once movement crosses it', () => {
  expect(shouldStartTabPointerDrag(100, 40, 103, 43)).toBe(false)
  expect(shouldStartTabPointerDrag(100, 40, 100, 45)).toBe(false)
  expect(shouldStartTabPointerDrag(100, 40, 105, 40)).toBe(true)
  expect(tabPointerDragThreshold).toBe(5)
})

test('displaced tab math shifts only the affected tabs for forward and backward drags', () => {
  expect(resolveDisplacedTabOffset(0, 1, 3, 'before', 106)).toBe(0)
  expect(resolveDisplacedTabOffset(2, 1, 3, 'before', 106)).toBe(-106)
  expect(resolveDisplacedTabOffset(3, 1, 3, 'before', 106)).toBe(0)

  expect(resolveDisplacedTabOffset(0, 3, 1, 'before', 106)).toBe(0)
  expect(resolveDisplacedTabOffset(1, 3, 1, 'before', 106)).toBe(106)
  expect(resolveDisplacedTabOffset(2, 3, 1, 'after', 106)).toBe(106)
  expect(resolveDisplacedTabOffset(3, 3, 1, 'after', 106)).toBe(0)
})

test('drag anchor offset keeps the pointer grab point stable relative to the dragged tab', () => {
  expect(resolveTabDragAnchorOffset(250, geometryCache)).toBe(50)
  expect(resolveTabDragAnchorOffset(218, geometryCache)).toBe(18)
})

test('dragged tab pointer offset follows pointer X directly instead of docking to the insertion gap', () => {
  const anchorOffsetX = 18

  expect(resolveDraggedTabPointerOffset(218, geometryCache, anchorOffsetX)).toBe(0)
  expect(resolveDraggedTabPointerOffset(306, geometryCache, anchorOffsetX)).toBe(88)
  expect(resolveDraggedTabPointerOffset(306, geometryCache, anchorOffsetX)).not.toBe(
    resolveDraggedTabPointerOffset(401, geometryCache, anchorOffsetX)
  )
})

test('drop behavior preserves dragging-tab self targets so release handling can skip redundant commits', () => {
  expect(resolveTabDropBehavior('tab-2', 'tab-2', 'before')).toEqual({
    type: 'preserve-for-dragend',
  })
})

test('tab shell click suppression consumes only the immediate post-drag click and always clears afterward', () => {
  expect(consumeTabShellClickSuppression(true)).toEqual({
    shouldSwitchTab: false,
    nextSuppressNextClick: false,
  })
  expect(consumeTabShellClickSuppression(false)).toEqual({
    shouldSwitchTab: true,
    nextSuppressNextClick: false,
  })
})

test('tab-level drop still commits canonical moves for real targets', () => {
  expect(resolveTabDropBehavior('tab-2', 'tab-4', 'after')).toEqual({
    type: 'commit',
    targetTabId: 'tab-4',
    position: 'after',
  })
  expect(resolveTabDropBehavior('', 'tab-4', 'after')).toEqual({ type: 'ignore' })
})

test('committed move reflection waits for the tabsList render order to match the committed adjacency', () => {
  expect(
    hasCommittedTabMoveReflected(tabsList, {
      sourceTabId: 'tab-2',
      targetTabId: 'tab-4',
      position: 'before',
    })
  ).toBe(false)

  expect(
    hasCommittedTabMoveReflected(
      [{ id: 'tab-1' }, { id: 'tab-3' }, { id: 'tab-2' }, { id: 'tab-4' }],
      {
        sourceTabId: 'tab-2',
        targetTabId: 'tab-4',
        position: 'before',
      }
    )
  ).toBe(true)

  expect(
    hasCommittedTabMoveReflected(
      [{ id: 'tab-1' }, { id: 'tab-3' }, { id: 'tab-4' }, { id: 'tab-2' }],
      {
        sourceTabId: 'tab-2',
        targetTabId: 'tab-4',
        position: 'after',
      }
    )
  ).toBe(true)
})

test('pointer down ignores close buttons and modified clicks so drag does not hijack tab controls', () => {
  const dom = new JSDOM(
    '<div class="tab"><button data-tab-drag-ignore="true">close</button></div>'
  )
  const currentTarget = dom.window.document.querySelector('.tab')
  const closeButton = dom.window.document.querySelector('button')

  expect(
    shouldIgnoreTabPointerDown({
      button: 0,
      target: closeButton,
      currentTarget,
    })
  ).toBe(true)
  expect(
    shouldIgnoreTabPointerDown({
      button: 2,
      target: currentTarget,
      currentTarget,
    })
  ).toBe(true)
  expect(
    shouldIgnoreTabPointerDown({
      button: 0,
      metaKey: true,
      target: currentTarget,
      currentTarget,
    })
  ).toBe(true)
  expect(
    shouldIgnoreTabPointerDown({
      button: 0,
      target: currentTarget,
      currentTarget,
    })
  ).toBe(false)
})

test('stable resolver preserves the previous target only inside the shared boundary hysteresis zone', () => {
  expect(
    resolveStableTabDropTarget(geometryCache, { tabId: 'tab-1', position: 'after' }, 24)
  ).toEqual({ tabId: 'tab-1', position: 'after' })
})

test('stable resolver yields once the dragged tab overlaps the neighbor by the Chrome-like lower threshold', () => {
  expect(
    resolveStableTabDropTarget(geometryCache, { tabId: 'tab-1', position: 'after' }, 26)
  ).toEqual({ tabId: 'tab-3', position: 'after' })
})

test('stable resolver keeps advancing toward the tail once the dragged body continues moving right', () => {
  expect(
    resolveStableTabDropTarget(geometryCache, { tabId: 'tab-1', position: 'after' }, 88)
  ).toEqual({ tabId: 'tab-3', position: 'after' })
})

test('stable resolver uses the same overlap threshold to restore the original side when the dragged tab moves back', () => {
  expect(
    resolveStableTabDropTarget(geometryCache, { tabId: 'tab-3', position: 'after' }, 24)
  ).toEqual({ tabId: 'tab-1', position: 'after' })
})

test('stable resolver returns trailing insertion target for strip tail drop semantics', () => {
  const stableDropTarget = resolveStableTabDropTarget(geometryCache, null, 200)

  expect(stableDropTarget).toEqual({ tabId: 'tab-4', position: 'after' })
  expect(
    resolveTabDropBehavior('tab-2', stableDropTarget.tabId, stableDropTarget.position)
  ).toEqual({
    type: 'commit',
    targetTabId: 'tab-4',
    position: 'after',
  })
})

test('visibilitychange cancel helper only tears down active pointer drags when the document becomes hidden', () => {
  expect(shouldCancelTabPointerDragOnVisibilityChange(true, true)).toBe(true)
  expect(shouldCancelTabPointerDragOnVisibilityChange(false, true)).toBe(false)
  expect(shouldCancelTabPointerDragOnVisibilityChange(true, false)).toBe(false)
})

test('released-buttons cancel helper self-heals stale pointer sessions after mouseup is missed', () => {
  expect(shouldCancelTabPointerDragOnReleasedButtons(0, true)).toBe(true)
  expect(shouldCancelTabPointerDragOnReleasedButtons(1, true)).toBe(false)
  expect(shouldCancelTabPointerDragOnReleasedButtons(0, false)).toBe(false)
})
