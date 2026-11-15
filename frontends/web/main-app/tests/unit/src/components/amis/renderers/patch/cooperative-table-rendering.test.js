/* @vitest-environment jsdom */

const assert = require('node:assert/strict')
const path = require('node:path')
const React = require('react')
const { createRoot } = require('react-dom/client')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
registerTypescriptRequire()

globalThis.__OUROBOROS_TABLE_LAZY_RENDER__ = true

function loadCooperativeTableRenderingModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './cooperativeTableRendering.tsx')
}

function loadLazyRowModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './tableLazyRow/LazyRow.tsx')
}

function loadLazyCellModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './tableLazyRow/LazyCell.tsx')
}

function cx(...tokens) {
  return tokens
    .flatMap((token) => {
      if (!token) {
        return []
      }
      if (typeof token === 'string') {
        return [token]
      }
      if (Array.isArray(token)) {
        return token.filter(Boolean)
      }
      if (typeof token === 'object') {
        return Object.keys(token).filter((key) => token[key])
      }
      return []
    })
    .join(' ')
}

function createRow(id, index) {
  return {
    id,
    index,
    depth: 1,
    locals: {},
    children: [],
    expanded: false,
    rowSpans: {},
  }
}

function createColumns(count = 2) {
  return Array.from({ length: count }, (_, index) => ({
    id: `col-${index + 1}`,
    name: `col${index + 1}`,
  }))
}

function createTableBodyProps(overrides = {}) {
  const columns = overrides.columns || createColumns()
  const store = {
    lazyRenderAfter: 2,
    cooperativeRenderingPending: false,
    materializationPending: false,
    viewportHydrationPending: false,
    combineNum: 0,
    isNested: false,
    filteredColumns: columns,
    tableLayout: 'auto',
    initTableWidth: () => undefined,
    getStickyStyles: () => [{}, ''],
    ...(overrides.store || {}),
  }

  return {
    className: 'cxd-Table-tbody',
    classnames: cx,
    columns,
    data: {},
    rows: [
      createRow('row-1', 0),
      createRow('row-2', 1),
      createRow('row-3', 2),
    ],
    rowsProps: {},
    footable: false,
    footableColumns: [],
    render: () => undefined,
    renderCell: () => undefined,
    store,
    translate: (value) => value,
    ...Object.fromEntries(
      Object.entries(overrides).filter(
        ([key]) => key !== 'store' && key !== 'columns'
      )
    ),
  }
}

function installIntersectionObserverMock() {
  const original = global.IntersectionObserver
  const originalRequestAnimationFrame = window.requestAnimationFrame
  const originalCancelAnimationFrame = window.cancelAnimationFrame
  const observers = []
  let nextFrameId = 1
  const frameCallbacks = new Map()

  window.requestAnimationFrame = (callback) => {
    const frameId = nextFrameId
    nextFrameId += 1
    frameCallbacks.set(frameId, callback)
    return frameId
  }
  window.cancelAnimationFrame = (frameId) => {
    frameCallbacks.delete(frameId)
  }

  class MockIntersectionObserver {
    constructor(callback, options = {}) {
      this.callback = callback
      this.options = options
      this.elements = new Set()
      this.thresholds = [0]
      observers.push(this)
    }

    observe(element) {
      this.elements.add(element)
    }

    unobserve(element) {
      this.elements.delete(element)
    }

    disconnect() {
      this.elements.clear()
    }

    trigger(isIntersecting) {
      const targets = this.elements.size
        ? Array.from(this.elements)
        : [document.createElement('tr')]

      this.callback(
        targets.map((target) => ({
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          target,
          time: 0,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: target.getBoundingClientRect(),
        }))
      )
    }
  }

  global.IntersectionObserver = MockIntersectionObserver

  return {
    observers,
    restore() {
      frameCallbacks.clear()
      window.requestAnimationFrame = originalRequestAnimationFrame
      window.cancelAnimationFrame = originalCancelAnimationFrame
      global.IntersectionObserver = original
    },
  }
}

async function actRender(root, element) {
  await React.act(async () => {
    root.render(element)
  })
}

test('LazyRow keeps rendered content after a later non-visible observer callback', async () => {
  const { observers, restore } = installIntersectionObserverMock()
  try {
    const { LazyRow, flushLazyRowRenderQueue } = loadLazyRowModule()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const row = createRow('row-2', 1)
    let renderRowsCallCount = 0

    await actRender(
      root,
      React.createElement(
        'table',
        null,
        React.createElement(
          'tbody',
          null,
          React.createElement(LazyRow, {
            row,
            rowIndex: 1,
            columns: createColumns(2),
            rowsProps: {},
            lazyRenderAfter: 1,
            renderRow: (nextRow) => {
              renderRowsCallCount += 1
              return React.createElement(
                'tr',
                { key: nextRow.id, 'data-row-id': nextRow.id },
                React.createElement('td', null, nextRow.id)
              )
            },
            renderPlaceholderRow: (nextRow, rowIndex, rowRef) =>
              React.createElement(
                'tr',
                {
                  key: `placeholder-${rowIndex}`,
                  ref: rowRef,
                  'data-lazy-row-placeholder': 'true',
                },
                React.createElement(
                  'td',
                  null,
                  React.createElement('div', { className: 'cxd-Table-emptyBlock' }, '\u00a0')
                ),
                React.createElement(
                  'td',
                  null,
                  React.createElement('div', { className: 'cxd-Table-emptyBlock' }, '\u00a0')
                )
              ),
          })
        )
      )
    )

    assert.equal(container.querySelectorAll('[data-lazy-row-placeholder]').length, 1)
    assert.equal(container.querySelectorAll('[data-row-id="row-2"]').length, 0)
    assert.equal(renderRowsCallCount, 0)

    await React.act(async () => {
      observers[0].trigger(true)
    })

    assert.equal(container.querySelectorAll('[data-lazy-row-placeholder]').length, 1)
    assert.equal(container.querySelectorAll('[data-row-id="row-2"]').length, 0)
    assert.equal(renderRowsCallCount, 0)

    await React.act(async () => {
      flushLazyRowRenderQueue()
    })

    assert.equal(container.querySelectorAll('[data-lazy-row-placeholder]').length, 0)
    assert.equal(container.querySelectorAll('[data-row-id="row-2"]').length, 1)
    assert.equal(renderRowsCallCount, 1)

    await React.act(async () => {
      observers[0].trigger(false)
    })

    assert.equal(container.querySelectorAll('[data-lazy-row-placeholder]').length, 0)
    assert.equal(container.querySelectorAll('[data-row-id="row-2"]').length, 1)
    assert.equal(renderRowsCallCount, 1)

    await React.act(async () => {
      root.unmount()
    })
    container.remove()
  } finally {
    restore()
  }
})

test('LazyRow rescues a visible placeholder when IntersectionObserver misses the callback', async () => {
  const { restore } = installIntersectionObserverMock()
  try {
    const {
      LazyRow,
      flushLazyRowRenderQueue,
      flushLazyRowVisibilityChecks,
    } = loadLazyRowModule()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const row = createRow('row-2', 1)
    let renderRowsCallCount = 0

    await actRender(
      root,
      React.createElement(
        'table',
        null,
        React.createElement(
          'tbody',
          null,
          React.createElement(LazyRow, {
            row,
            rowIndex: 1,
            columns: createColumns(2),
            rowsProps: {},
            lazyRenderAfter: 1,
            renderRow: (nextRow) => {
              renderRowsCallCount += 1
              return React.createElement(
                'tr',
                { key: nextRow.id, 'data-row-id': nextRow.id },
                React.createElement('td', null, nextRow.id)
              )
            },
            renderPlaceholderRow: (nextRow, rowIndex, rowRef) =>
              React.createElement(
                'tr',
                {
                  key: `placeholder-${rowIndex}`,
                  ref: rowRef,
                  'data-lazy-row-placeholder': 'true',
                },
                React.createElement(
                  'td',
                  null,
                  React.createElement('div', { className: 'cxd-Table-emptyBlock' }, '\u00a0')
                )
              ),
          })
        )
      )
    )

    const placeholder = container.querySelector('[data-lazy-row-placeholder]')
    placeholder.getBoundingClientRect = () => ({
      bottom: 132,
      height: 32,
      left: 0,
      right: 320,
      top: 100,
      width: 320,
      x: 0,
      y: 100,
      toJSON: () => undefined,
    })

    await React.act(async () => {
      flushLazyRowVisibilityChecks()
    })

    assert.ok(renderRowsCallCount <= 1)

    await React.act(async () => {
      flushLazyRowRenderQueue()
    })

    assert.equal(renderRowsCallCount, 1)
    assert.equal(container.querySelectorAll('[data-lazy-row-placeholder]').length, 0)
    assert.equal(container.querySelectorAll('[data-row-id="row-2"]').length, 1)

    await React.act(async () => {
      root.unmount()
    })
    container.remove()
  } finally {
    restore()
  }
})

test('LazyRow rescues placeholder rows sitting just beyond the scroll viewport edge', async () => {
  const { restore } = installIntersectionObserverMock()
  try {
    const {
      LazyRow,
      flushLazyRowRenderQueue,
      flushLazyRowVisibilityChecks,
    } = loadLazyRowModule()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const row = createRow('row-edge', 2)
    let renderRowsCallCount = 0

    await actRender(
      root,
      React.createElement(
        'div',
        {
          style: {
            overflowY: 'auto',
          },
          ref: (node) => {
            if (node) {
              node.getBoundingClientRect = () => ({
                bottom: 400,
                height: 300,
                left: 0,
                right: 320,
                top: 100,
                width: 320,
                x: 0,
                y: 100,
                toJSON: () => undefined,
              })
            }
          },
        },
        React.createElement(
          'table',
          null,
          React.createElement(
            'tbody',
            null,
            React.createElement(LazyRow, {
              row,
              rowIndex: 2,
              columns: createColumns(2),
              rowsProps: {},
              lazyRenderAfter: 1,
              renderRow: (nextRow) => {
                renderRowsCallCount += 1
                return React.createElement(
                  'tr',
                  { key: nextRow.id, 'data-row-id': nextRow.id },
                  React.createElement('td', null, nextRow.id)
                )
              },
              renderPlaceholderRow: (nextRow, rowIndex, rowRef) =>
                React.createElement(
                  'tr',
                  {
                    key: `placeholder-${rowIndex}`,
                    ref: rowRef,
                    'data-lazy-row-placeholder': 'true',
                  },
                  React.createElement(
                    'td',
                    null,
                    React.createElement('div', { className: 'cxd-Table-emptyBlock' }, '\u00a0')
                  )
                ),
            })
          )
        )
      )
    )

    const placeholder = container.querySelector('[data-lazy-row-placeholder]')
    placeholder.getBoundingClientRect = () => ({
      bottom: 552,
      height: 32,
      left: 0,
      right: 320,
      top: 520,
      width: 320,
      x: 0,
      y: 520,
      toJSON: () => undefined,
    })

    await React.act(async () => {
      flushLazyRowVisibilityChecks()
    })
    await React.act(async () => {
      flushLazyRowRenderQueue()
    })

    assert.equal(renderRowsCallCount, 1)
    assert.equal(container.querySelectorAll('[data-lazy-row-placeholder]').length, 0)
    assert.equal(container.querySelectorAll('[data-row-id="row-edge"]').length, 1)

    await React.act(async () => {
      root.unmount()
    })
    container.remove()
  } finally {
    restore()
  }
})

test('LazyRow keeps a visible placeholder renderable across repeated visibility rescue checks', async () => {
  const { restore } = installIntersectionObserverMock()
  try {
    const {
      LazyRow,
      flushLazyRowRenderQueue,
      flushLazyRowVisibilityChecks,
    } = loadLazyRowModule()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const row = createRow('row-reschedule', 2)
    let renderRowsCallCount = 0

    await actRender(
      root,
      React.createElement(
        'table',
        null,
        React.createElement(
          'tbody',
          null,
          React.createElement(LazyRow, {
            row,
            rowIndex: 2,
            columns: createColumns(12),
            rowsProps: {},
            lazyRenderAfter: 1,
            renderRow: (nextRow) => {
              renderRowsCallCount += 1
              return React.createElement(
                'tr',
                { key: nextRow.id, 'data-row-id': nextRow.id },
                React.createElement('td', null, nextRow.id)
              )
            },
            renderPlaceholderRow: (nextRow, rowIndex, rowRef) =>
              React.createElement(
                'tr',
                {
                  key: `placeholder-${rowIndex}`,
                  ref: rowRef,
                  'data-lazy-row-placeholder': 'true',
                },
                React.createElement(
                  'td',
                  null,
                  React.createElement('div', { className: 'cxd-Table-emptyBlock' }, '\u00a0')
                )
              ),
          })
        )
      )
    )

    const placeholder = container.querySelector('[data-lazy-row-placeholder]')
    placeholder.getBoundingClientRect = () => ({
      bottom: 245,
      height: 32,
      left: 0,
      right: 320,
      top: 213,
      width: 320,
      x: 0,
      y: 213,
      toJSON: () => undefined,
    })

    await React.act(async () => {
      flushLazyRowVisibilityChecks()
    })
    assert.equal(renderRowsCallCount, 0)

    await React.act(async () => {
      flushLazyRowVisibilityChecks()
    })
    assert.equal(renderRowsCallCount, 0)

    await React.act(async () => {
      flushLazyRowRenderQueue()
    })

    assert.equal(renderRowsCallCount, 1)
    assert.equal(container.querySelectorAll('[data-lazy-row-placeholder]').length, 0)
    assert.equal(container.querySelectorAll('[data-row-id="row-reschedule"]').length, 1)

    await React.act(async () => {
      root.unmount()
    })
    container.remove()
  } finally {
    restore()
  }
})

test('LazyRow skips already-rendered row work when parent props are referentially stable', async () => {
  const { observers, restore } = installIntersectionObserverMock()
  try {
    const { LazyRow, flushLazyRowRenderQueue } = loadLazyRowModule()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const row = createRow('row-2', 1)
    const columns = createColumns(2)
    const rowsProps = {}
    const renderPlaceholderRow = (nextRow, rowIndex, rowRef) =>
      React.createElement(
        'tr',
        {
          key: `placeholder-${rowIndex}`,
          ref: rowRef,
          'data-lazy-row-placeholder': 'true',
        },
        React.createElement('td', null)
      )
    let renderRowsCallCount = 0
    const renderRow = (nextRow) => {
      renderRowsCallCount += 1
      return React.createElement(
        'tr',
        { key: nextRow.id, 'data-row-id': nextRow.id },
        React.createElement('td', null, nextRow.id)
      )
    }
    const createElement = () =>
      React.createElement(
        'table',
        null,
        React.createElement(
          'tbody',
          null,
          React.createElement(LazyRow, {
            row,
            rowIndex: 1,
            columns,
            rowsProps,
            lazyRenderAfter: 1,
            renderRow,
            renderPlaceholderRow,
          })
        )
      )

    await actRender(root, createElement())
    await React.act(async () => {
      observers[0].trigger(true)
    })
    await React.act(async () => {
      flushLazyRowRenderQueue()
    })
    assert.equal(renderRowsCallCount, 1)

    await actRender(root, createElement())

    assert.equal(container.querySelectorAll('[data-row-id="row-2"]').length, 1)
    assert.equal(renderRowsCallCount, 1)

    await React.act(async () => {
      root.unmount()
    })
    container.remove()
  } finally {
    restore()
  }
})

test('LazyRow scheduler releases wide visible rows across frames instead of one burst', async () => {
  const { observers, restore } = installIntersectionObserverMock()
  try {
    const { LazyRow, flushLazyRowRenderQueue } = loadLazyRowModule()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const columns = createColumns(59)
    const rows = [createRow('row-2', 1), createRow('row-3', 2)]
    let renderRowsCallCount = 0
    const renderRow = (nextRow) => {
      renderRowsCallCount += 1
      return React.createElement(
        'tr',
        { key: nextRow.id, 'data-row-id': nextRow.id },
        React.createElement('td', null, nextRow.id)
      )
    }
    const renderPlaceholderRow = (nextRow, rowIndex, rowRef) =>
      React.createElement(
        'tr',
        {
          key: `placeholder-${rowIndex}`,
          ref: rowRef,
          'data-lazy-row-placeholder': 'true',
        },
        React.createElement(
          'td',
          null,
          React.createElement('div', { className: 'cxd-Table-emptyBlock' }, '\u00a0')
        )
      )

    await actRender(
      root,
      React.createElement(
        'table',
        null,
        React.createElement(
          'tbody',
          null,
          rows.map((row, index) =>
            React.createElement(LazyRow, {
              key: row.id,
              row,
              rowIndex: index + 1,
              columns,
              rowsProps: {},
              lazyRenderAfter: 1,
              renderRow,
              renderPlaceholderRow,
            })
          )
        )
      )
    )

    await React.act(async () => {
      observers.forEach((observer) => observer.trigger(true))
    })

    assert.ok(renderRowsCallCount <= 1)
    assert.ok(container.querySelectorAll('[data-lazy-row-placeholder]').length >= 1)
    const renderedAfterObserver = renderRowsCallCount

    await React.act(async () => {
      flushLazyRowRenderQueue()
    })

    assert.equal(renderRowsCallCount, renderedAfterObserver + 1)
    assert.equal(
      container.querySelectorAll('[data-lazy-row-placeholder]').length,
      Math.max(0, 2 - renderRowsCallCount)
    )

    if (renderRowsCallCount < 2) {
      await React.act(async () => {
        flushLazyRowRenderQueue()
      })
    }

    assert.equal(renderRowsCallCount, 2)
    assert.equal(container.querySelectorAll('[data-lazy-row-placeholder]').length, 0)

    await React.act(async () => {
      root.unmount()
    })
    container.remove()
  } finally {
    restore()
  }
})

test('LazyCell schedules visible cell materialization and keeps rendered content', async () => {
  const { observers, restore } = installIntersectionObserverMock()
  try {
    const { LazyCell } = loadLazyCellModule()
    const { flushLazyRowRenderQueue } = requireMirroredSrcModule(
      __filename,
      './tableLazyRow/LazyRow.tsx'
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    let renderCellCallCount = 0

    await actRender(
      root,
      React.createElement(
        'table',
        null,
        React.createElement(
          'tbody',
          null,
          React.createElement(
            'tr',
            null,
            React.createElement(LazyCell, {
              cellKey: 'row-2:col-24',
              classnames: cx,
              column: {
                id: 'col-24',
                name: 'col24',
              },
              deferRender: true,
              item: {
                rowSpans: {},
              },
              props: {
                key: 'col-24',
              },
              renderCell: () => {
                renderCellCallCount += 1
                return React.createElement(
                  'td',
                  { 'data-cell-rendered': 'true' },
                  'value'
                )
              },
            })
          )
        )
      )
    )

    assert.equal(renderCellCallCount, 0)
    assert.equal(container.querySelectorAll('[data-lazy-cell-placeholder]').length, 1)

    await React.act(async () => {
      observers[0].trigger(true)
    })

    assert.equal(renderCellCallCount, 0)
    assert.equal(container.querySelectorAll('[data-lazy-cell-placeholder]').length, 1)

    await React.act(async () => {
      flushLazyRowRenderQueue()
    })

    assert.equal(renderCellCallCount, 1)
    assert.equal(container.querySelectorAll('[data-lazy-cell-placeholder]').length, 0)
    assert.equal(container.querySelectorAll('[data-cell-rendered]').length, 1)

    await React.act(async () => {
      observers[0].trigger(false)
      flushLazyRowRenderQueue()
    })

    assert.equal(renderCellCallCount, 1)
    assert.equal(container.querySelectorAll('[data-cell-rendered]').length, 1)

    await React.act(async () => {
      root.unmount()
    })
    container.remove()
  } finally {
    restore()
  }
})

test('LazyCell renders cells immediately when deferral is disabled', async () => {
  const { restore } = installIntersectionObserverMock()
  try {
    const { LazyCell } = loadLazyCellModule()
    const { flushLazyRowRenderQueue } = requireMirroredSrcModule(
      __filename,
      './tableLazyRow/LazyRow.tsx'
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const appearedChanges = []
    let renderCellCallCount = 0

    await actRender(
      root,
      React.createElement(
        'table',
        null,
        React.createElement(
          'tbody',
          null,
          React.createElement(
            'tr',
            null,
            React.createElement(LazyCell, {
              cellKey: 'row-2:col-24',
              deferRender: false,
              classnames: cx,
              column: {
                id: 'col-24',
                name: 'col24',
                markAppeared: (appeared) => appearedChanges.push(appeared),
              },
              item: {
                rowSpans: {},
              },
              props: {
                key: 'col-24',
              },
              renderCell: () => {
                renderCellCallCount += 1
                return React.createElement(
                  'td',
                  { 'data-cell-rendered': 'true' },
                  'value'
                )
              },
            })
          )
        )
      )
    )

    assert.equal(renderCellCallCount, 1)
    assert.equal(container.querySelectorAll('[data-lazy-cell-placeholder]').length, 0)
    assert.equal(container.querySelectorAll('[data-cell-rendered]').length, 1)

    await React.act(async () => {
      flushLazyRowRenderQueue()
    })

    assert.equal(renderCellCallCount, 1)

    await React.act(async () => {
      root.unmount()
    })
    container.remove()
  } finally {
    restore()
  }
})

test('LazyCell keeps already appeared columns lazy until the cell is visible', async () => {
  const { observers, restore } = installIntersectionObserverMock()
  try {
    const { LazyCell } = loadLazyCellModule()
    const { flushLazyRowRenderQueue } = requireMirroredSrcModule(
      __filename,
      './tableLazyRow/LazyRow.tsx'
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    let renderCellCallCount = 0

    await actRender(
      root,
      React.createElement(
        'table',
        null,
        React.createElement(
          'tbody',
          null,
          React.createElement(
            'tr',
            null,
            React.createElement(LazyCell, {
              cellKey: 'row-2:col-24',
              deferRender: true,
              classnames: cx,
              column: {
                appeared: true,
                id: 'col-24',
                name: 'col24',
              },
              item: {
                rowSpans: {},
              },
              props: {
                key: 'col-24',
              },
              renderCell: () => {
                renderCellCallCount += 1
                return React.createElement(
                  'td',
                  { 'data-cell-rendered': 'true' },
                  'value'
                )
              },
            })
          )
        )
      )
    )

    assert.equal(renderCellCallCount, 0)
    assert.equal(container.querySelectorAll('[data-lazy-cell-placeholder]').length, 1)
    assert.equal(container.querySelectorAll('[data-cell-rendered]').length, 0)

    await React.act(async () => {
      observers[0].trigger(true)
    })
    await React.act(async () => {
      flushLazyRowRenderQueue()
    })

    assert.equal(renderCellCallCount, 1)
    assert.equal(container.querySelectorAll('[data-lazy-cell-placeholder]').length, 0)
    assert.equal(container.querySelectorAll('[data-cell-rendered]').length, 1)

    await React.act(async () => {
      root.unmount()
    })
    container.remove()
  } finally {
    restore()
  }
})

test('CooperativeTableSpinner renders a controlled table loading mask', async () => {
  const { observable, runInAction } = require('mobx')
  const { CooperativeTableSpinner } = loadCooperativeTableRenderingModule()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const store = observable.object({
    loading: true,
    cooperativeLoadingVisible: false,
    cooperativeRenderingPending: false,
  })

  await actRender(
    root,
    React.createElement(CooperativeTableSpinner, {
      classnames: cx,
      store,
    })
  )

  assert.equal(container.querySelectorAll('.Spinner-overlay.in').length, 1)
  assert.equal(container.querySelectorAll('[data-testid="spinner"].Spinner.in').length, 1)

  await React.act(async () => {
    runInAction(() => {
      store.loading = false
    })
  })

  assert.equal(container.querySelectorAll('.Spinner-overlay.in').length, 0)
  assert.equal(container.querySelectorAll('[data-testid="spinner"].Spinner.in').length, 0)

  await React.act(async () => {
    runInAction(() => {
      store.loading = true
    })
  })

  assert.equal(container.querySelectorAll('.Spinner-overlay.in').length, 1)
  assert.equal(container.querySelectorAll('[data-testid="spinner"].Spinner.in').length, 1)

  await React.act(async () => {
    root.unmount()
  })
  container.remove()
})

test('CooperativeTableSpinner respects loadingConfig.show=false', async () => {
  const { observable } = require('mobx')
  const { CooperativeTableSpinner } = loadCooperativeTableRenderingModule()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const store = observable.object({
    loading: false,
    cooperativeLoadingVisible: false,
    cooperativeRenderingPending: false,
  })

  await actRender(
    root,
    React.createElement(CooperativeTableSpinner, {
      classnames: cx,
      loadingConfig: { show: false },
      store,
    })
  )

  assert.equal(container.querySelectorAll('.Spinner-overlay.in').length, 0)
  assert.equal(container.querySelectorAll('[data-testid="spinner"].Spinner.in').length, 0)

  await React.act(async () => {
    root.unmount()
  })
  container.remove()
})

test('CooperativeTableBody renders placeholders as normal table cells and reveals rows one-way', async () => {
  const { observers, restore } = installIntersectionObserverMock()
  try {
    const {
      CooperativeTableBody,
      flushLazyRowRenderQueue,
    } = loadCooperativeTableRenderingModule()
    const instance = new CooperativeTableBody(createTableBodyProps())
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    let renderRowsCallCount = 0

    instance.renderRows = (rows) => {
      renderRowsCallCount += rows.length
      return rows.map((row) =>
        React.createElement(
          'tr',
          { key: row.id, item: row, 'data-row-id': row.id },
          React.createElement('td', null, row.id),
          React.createElement('td', null, `value-${row.id}`)
        )
      )
    }

    await actRender(root, React.createElement('table', null, instance.render()))

    assert.equal(container.querySelectorAll('tbody[data-lazy-row-body="true"]').length, 1)
    assert.equal(container.querySelectorAll('[data-row-id="row-1"]').length, 1)
    assert.equal(container.querySelectorAll('[data-row-id="row-2"]').length, 0)
    assert.equal(container.querySelectorAll('[data-lazy-row-placeholder]').length, 2)
    assert.equal(container.querySelectorAll('[data-lazy-row-placeholder] td').length, 4)
    assert.equal(renderRowsCallCount, 1)

    await React.act(async () => {
      observers[0].trigger(true)
    })

    assert.equal(container.querySelectorAll('[data-lazy-row-placeholder]').length, 2)
    assert.equal(container.querySelectorAll('[data-row-id="row-2"]').length, 0)
    assert.equal(renderRowsCallCount, 1)

    await React.act(async () => {
      flushLazyRowRenderQueue()
    })

    assert.equal(container.querySelectorAll('[data-lazy-row-placeholder]').length, 0)
    assert.equal(container.querySelectorAll('[data-row-id="row-2"]').length, 1)
    assert.equal(container.querySelectorAll('[data-row-id="row-3"]').length, 1)
    assert.equal(renderRowsCallCount, 3)

    await React.act(async () => {
      observers[0].trigger(false)
    })

    assert.equal(container.querySelectorAll('[data-lazy-row-placeholder]').length, 0)
    assert.equal(container.querySelectorAll('[data-row-id="row-2"]').length, 1)
    assert.equal(container.querySelectorAll('[data-row-id="row-3"]').length, 1)
    assert.equal(renderRowsCallCount, 3)

    await React.act(async () => {
      root.unmount()
    })
    container.remove()
  } finally {
    restore()
  }
})

test('CooperativeTableContent keeps the lazy table body mounted when deleting the first row', async () => {
  const { CooperativeTableContent } = loadCooperativeTableRenderingModule()
  const columns = [
    { id: 'code', name: 'code', label: 'Code', index: 0, pristine: {} },
  ]
  const store = {
    lazyRenderAfter: 2,
    cooperativeRenderingPending: false,
    materializationPending: false,
    viewportHydrationPending: false,
    combineNum: 0,
    rows: [],
    columns,
    filteredColumns: columns,
    tableLayout: 'auto',
    getStickyStyles: () => [{}, ''],
    initTableWidth: () => undefined,
    syncTableWidth: () => undefined,
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const originalResizeObserver = global.ResizeObserver

  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  function createContentProps(rows) {
    return {
      placeholder: 'placeholder.noData',
      className: '',
      tableClassName: '',
      classnames: cx,
      columns,
      columnsGroup: [],
      rows,
      render: (_region, node) => node,
      renderHeadCell: (column, props) =>
        React.createElement('th', props, column.label),
      renderCell: (_region, _column, item, props) =>
        React.createElement(
          'td',
          { key: props.key, 'data-cell-row-id': item.id },
          item.id
        ),
      data: {},
      footable: false,
      footableColumns: [],
      loading: false,
      store,
      translate: (value) => value,
      dispatchEvent: () => undefined,
      onEvent: () => undefined,
    }
  }

  try {
    await actRender(
      root,
      React.createElement(
        CooperativeTableContent,
        createContentProps([
          createRow('row-1', 0),
          createRow('row-2', 1),
          createRow('row-3', 2),
          createRow('row-4', 3),
        ])
      )
    )

    const initialTbody = container.querySelector('tbody[data-lazy-row-body="true"]')
    assert.ok(initialTbody)

    await actRender(
      root,
      React.createElement(
        CooperativeTableContent,
        createContentProps([
          createRow('row-2', 0),
          createRow('row-3', 1),
          createRow('row-4', 2),
        ])
      )
    )

    assert.equal(
      container.querySelector('tbody[data-lazy-row-body="true"]'),
      initialTbody
    )
    assert.equal(container.querySelectorAll('[data-lazy-row-key="row-1-0"]').length, 0)
  } finally {
    await React.act(async () => {
      root.unmount()
    })
    container.remove()
    global.ResizeObserver = originalResizeObserver
  }
})

test('CooperativeTableContent re-renders when store.rows is mutated in place', async () => {
  const { observable, runInAction } = require('mobx')
  const { CooperativeTableContent } = loadCooperativeTableRenderingModule()
  const columns = [{ id: 'code', name: 'code', label: 'Code', index: 0, pristine: {} }]
  const rows = observable.array([createRow('row-1', 0), createRow('row-2', 1)])
  const store = observable.object({
    lazyRenderAfter: 10,
    cooperativeRenderingPending: false,
    materializationPending: false,
    viewportHydrationPending: false,
    combineNum: 0,
    rows,
    columns,
    filteredColumns: columns,
    tableLayout: 'auto',
    getStickyStyles: () => [{}, ''],
    initTableWidth: () => undefined,
    syncTableWidth: () => undefined,
  })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const originalResizeObserver = global.ResizeObserver

  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  const props = {
    placeholder: 'placeholder.noData',
    className: '',
    tableClassName: '',
    classnames: cx,
    columns,
    columnsGroup: [],
    rows,
    render: (_region, node) => node,
    renderHeadCell: (column, headerProps) =>
      React.createElement('th', headerProps, column.label),
    renderCell: (_region, _column, item, cellProps) =>
      React.createElement(
        'td',
        { key: cellProps.key, 'data-cell-row-id': item.id },
        item.id
      ),
    data: {},
    footable: false,
    footableColumns: [],
    loading: false,
    store,
    translate: (value) => value,
    dispatchEvent: () => undefined,
    onEvent: () => undefined,
  }

  try {
    await actRender(root, React.createElement(CooperativeTableContent, props))

    assert.equal(container.querySelectorAll('[data-cell-row-id="row-1"]').length, 1)
    assert.equal(container.querySelectorAll('[data-cell-row-id="row-2"]').length, 1)

    // input-table 删除行时 store.rows 是原地 replace/splice，引用不变。
    // 若不把行快照传给 PureComponent 的 TableContent，tbody 不会更新。
    await React.act(async () => {
      runInAction(() => {
        store.rows.splice(0, 1)
      })
    })

    assert.equal(container.querySelectorAll('[data-cell-row-id="row-1"]').length, 0)
    assert.equal(container.querySelectorAll('[data-cell-row-id="row-2"]').length, 1)
  } finally {
    await React.act(async () => {
      root.unmount()
    })
    container.remove()
    global.ResizeObserver = originalResizeObserver
  }
})

test('CooperativeTableBody renders simple static placeholder cells eagerly', async () => {
  const { observers, restore } = installIntersectionObserverMock()
  try {
    const {
      CooperativeTableBody,
      flushLazyRowRenderQueue,
    } = loadCooperativeTableRenderingModule()
    const columns = [
      {
        id: 'status',
        name: 'status',
        type: 'plain',
        pristine: {
          name: 'status',
          type: 'static-text',
          tpl: '${status}',
          className: 'status-cell',
          classNameExpr: "${scale == '2' ? 'is-alert' : ''}",
        },
      },
      {
        id: 'action',
        name: 'action',
        type: 'operation',
        pristine: {
          name: 'action',
          type: 'operation',
          buttons: [{ type: 'button', label: 'Edit' }],
        },
      },
    ]
    const rows = [
      {
        ...createRow('row-1', 0),
        locals: { status: 'first', scale: '0' },
      },
      {
        ...createRow('row-2', 1),
        locals: { status: 'enabled', scale: '2' },
      },
      {
        ...createRow('row-3', 2),
        locals: { status: 'pending', scale: '0' },
      },
    ]
    const instance = new CooperativeTableBody(
      createTableBodyProps({
        columns,
        rows,
        store: {
          filteredColumns: columns,
        },
      })
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    let renderRowsCallCount = 0

    instance.renderRows = (nextRows) => {
      renderRowsCallCount += nextRows.length
      return nextRows.map((row) =>
        React.createElement(
          'tr',
          { key: row.id, item: row, 'data-row-id': row.id },
          React.createElement('td', null, row.locals.status),
          React.createElement('td', null, `action-${row.id}`)
        )
      )
    }

    await actRender(root, React.createElement('table', null, instance.render()))

    const row2Placeholder = container.querySelector(
      '[data-lazy-row-placeholder][data-lazy-row-key="row-2-1"]'
    )
    const row2Cells = row2Placeholder.querySelectorAll('td')

    assert.equal(renderRowsCallCount, 1)
    assert.equal(container.querySelectorAll('[data-row-id="row-2"]').length, 0)
    assert.equal(row2Cells[0].textContent, 'enabled')
    assert.match(row2Cells[0].className, /status-cell/)
    assert.match(row2Cells[0].className, /is-alert/)
    assert.equal(row2Cells[1].querySelectorAll('.Table-emptyBlock').length, 1)
    assert.equal(
      container.querySelectorAll('[data-lazy-row-placeholder] .Table-emptyBlock').length,
      2
    )

    await React.act(async () => {
      observers[0].trigger(true)
    })

    await React.act(async () => {
      flushLazyRowRenderQueue()
    })

    assert.equal(container.querySelectorAll('[data-lazy-row-placeholder]').length, 0)
    assert.equal(container.querySelectorAll('[data-row-id="row-2"]').length, 1)
    assert.equal(renderRowsCallCount, 3)

    await React.act(async () => {
      root.unmount()
    })
    container.remove()
  } finally {
    restore()
  }
})
