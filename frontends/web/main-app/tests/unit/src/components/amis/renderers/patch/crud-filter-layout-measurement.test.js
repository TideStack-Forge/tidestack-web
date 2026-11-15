/* @vitest-environment node */

const assert = require('node:assert/strict')
const path = require('node:path')

const { clearMirroredSrcModuleCache, registerTypescriptRequire } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

registerTypescriptRequire()

const TOOLBAR_SELECTOR =
  '.crud-filter-item--toolbar, .crud-filter-toolbar-item, .crud-filter-toolbar--mobile-stacked'

class FakeClassList {
  constructor(classNames = []) {
    this.classNames = new Set(classNames)
  }

  contains(className) {
    return this.classNames.has(className)
  }
}

class FakeElement {
  constructor({
    rect = { width: 0, height: 0, left: 0, right: 0, top: 0 },
    classNames = [],
    children = [],
    scrollWidth = 0,
  } = {}) {
    this.rect = rect
    this.children = children
    this.scrollWidth = scrollWidth
    this.classList = new FakeClassList(classNames)
    this.lastElementChild = null
    this.querySelectorMap = new Map()
    this.querySelectorAllMap = new Map()
    this.styleValues = new Map()
    this.style = {
      removeProperty: (name) => this.styleValues.delete(name),
      setProperty: (name, value) => this.styleValues.set(name, value),
    }
  }

  setQuerySelector(selector, value) {
    this.querySelectorMap.set(selector, value)
    return this
  }

  setQuerySelectorAll(selector, value) {
    this.querySelectorAllMap.set(selector, value)
    return this
  }

  getBoundingClientRect() {
    return this.rect
  }

  querySelector(selector) {
    return this.querySelectorMap.get(selector) || null
  }

  querySelectorAll(selector) {
    return this.querySelectorAllMap.get(selector) || []
  }
}

function createRect({ width, height, left, top }) {
  return {
    width,
    height,
    left,
    top,
    right: left + width,
  }
}

function loadMeasurementModule() {
  clearMirroredSrcModuleCache(__filename, '.')

  return require(
    path.join(
      process.cwd(),
      'src/components/amis/renderers/patch/crudFilterLayoutMeasurement.ts'
    )
  )
}

function loadControllerClass() {
  clearMirroredSrcModuleCache(__filename, '.')

  return require(
    path.join(
      process.cwd(),
      'src/components/amis/renderers/patch/crudFilterLayoutController.ts'
    )
  ).CrudFilterLayoutController
}

test('measureCrudFilterLayout returns toolbar, label, and rail facts while clearing no-toolbar forms to null', () => {
  const measurement = loadMeasurementModule()

  const form = new FakeElement({
    rect: createRect({ width: 960, height: 80, left: 100, top: 120 }),
  })
  const root = new FakeElement().setQuerySelector(
    '.cxd-Crud-filter.cxd-Crud-filter--flat .cxd-Form',
    form
  )

  assert.strictEqual(measurement.findCrudFilterFormElement(root), form)

  const buttonA = new FakeElement({
    rect: createRect({ width: 36, height: 28, left: 300, top: 132 }),
  })
  const buttonB = new FakeElement({
    rect: createRect({ width: 44, height: 32, left: 340, top: 132 }),
  })
  const toolbar = new FakeElement({
    rect: createRect({ width: 120, height: 40, left: 292, top: 128 }),
    classNames: ['crud-filter-item--toolbar'],
  }).setQuerySelectorAll('.cxd-Button', [buttonA, buttonB])

  const labelTextA = new FakeElement({
    rect: createRect({ width: 58, height: 20, left: 0, top: 0 }),
    scrollWidth: 64,
  })
  const labelA = new FakeElement({
    rect: createRect({ width: 58, height: 20, left: 0, top: 0 }),
  }).setQuerySelector('.cxd-TplField', labelTextA)
  const fieldA = new FakeElement().setQuerySelector('.cxd-Form-label', labelA)

  const labelTextB = new FakeElement({
    rect: createRect({ width: 72, height: 20, left: 0, top: 0 }),
    scrollWidth: 68,
  })
  const labelB = new FakeElement({
    rect: createRect({ width: 72, height: 20, left: 0, top: 0 }),
  })
  labelB.lastElementChild = labelTextB
  const fieldB = new FakeElement().setQuerySelector('.cxd-Form-label', labelB)

  const row = new FakeElement({ children: [fieldA, fieldB, toolbar] })
  form
    .setQuerySelector(TOOLBAR_SELECTOR, toolbar)
    .setQuerySelector(':scope > .cxd-Form-row', row)

  assert.deepEqual(
    measurement.measureCrudFilterLayout(form, {
      alignLabelWidth: true,
      wideHeadSplit: false,
      layoutState: 'inline',
    }),
    {
      containerWidth: 960,
      toolbarWidth: 92,
      toolbarHeight: 32,
      labelWidth: '72px',
      railTop: null,
    }
  )

  const compactLabelText = new FakeElement({
    rect: createRect({ width: 64, height: 20, left: 0, top: 0 }),
    scrollWidth: 60,
  })
  const compactLabel = new FakeElement({
    rect: createRect({ width: 64, height: 20, left: 0, top: 0 }),
  }).setQuerySelector('.cxd-TplField', compactLabelText)
  const compactField = new FakeElement({
    rect: createRect({ width: 180, height: 40, left: 120, top: 168 }),
  }).setQuerySelector('.cxd-Form-label', compactLabel)

  const wideLabelText = new FakeElement({
    rect: createRect({ width: 140, height: 20, left: 0, top: 0 }),
    scrollWidth: 140,
  })
  const wideLabel = new FakeElement({
    rect: createRect({ width: 140, height: 20, left: 0, top: 0 }),
  }).setQuerySelector('.cxd-TplField', wideLabelText)
  const wideField = new FakeElement({
    rect: createRect({ width: 360, height: 40, left: 120, top: 124 }),
    classNames: ['crud-filter-item--wide-head', 'crud-filter-item--wide-candidate'],
  }).setQuerySelector('.cxd-Form-label', wideLabel)

  const divider = new FakeElement({
    classNames: ['crud-filter-item--divider'],
  })
  const wideRow = new FakeElement({
    children: [wideField, divider, compactField, toolbar],
  })
  const wideForm = new FakeElement({
    rect: createRect({ width: 1120, height: 120, left: 40, top: 100 }),
  })
    .setQuerySelector(TOOLBAR_SELECTOR, toolbar)
    .setQuerySelector(':scope > .cxd-Form-row', wideRow)
    .setQuerySelectorAll('.crud-filter-item--field:not(.crud-filter-item--wide-head)', [
      compactField,
    ])

  assert.deepEqual(
    measurement.measureCrudFilterLayout(wideForm, {
      alignLabelWidth: true,
      wideHeadSplit: true,
      layoutState: 'rail',
    }),
    {
      containerWidth: 1120,
      toolbarWidth: 92,
      toolbarHeight: 32,
      labelWidth: '140px',
      railTop: '68px',
    }
  )

  const mobileToolbar = new FakeElement({
    rect: createRect({ width: 320, height: 72, left: 40, top: 280 }),
    classNames: ['crud-filter-toolbar--mobile-stacked'],
  }).setQuerySelectorAll('.cxd-Button', [buttonA, buttonB])
  const mobileForm = new FakeElement({
    rect: createRect({ width: 360, height: 180, left: 16, top: 80 }),
  })
    .setQuerySelector(TOOLBAR_SELECTOR, mobileToolbar)
    .setQuerySelector(':scope > .cxd-Form-row', row)

  assert.equal(
    measurement.measureCrudFilterLayout(mobileForm, {
      alignLabelWidth: false,
      wideHeadSplit: false,
      layoutState: 'stacked',
    })?.containerWidth,
    360
  )

  const noToolbarForm = new FakeElement({
    rect: createRect({ width: 860, height: 80, left: 0, top: 0 }),
  }).setQuerySelector(':scope > .cxd-Form-row', row)

  assert.strictEqual(
    measurement.measureCrudFilterLayout(noToolbarForm, {
      alignLabelWidth: true,
      wideHeadSplit: false,
      layoutState: 'inline',
    }),
    null
  )
})

test('crud filter measurement observer target switches and clears without stale nodes', () => {
  const measurement = loadMeasurementModule()
  const form = new FakeElement({
    rect: createRect({ width: 960, height: 80, left: 100, top: 120 }),
  })
  const nextForm = new FakeElement({
    rect: createRect({ width: 1120, height: 120, left: 40, top: 100 }),
  })
  const observer = {
    observed: [],
    unobserved: [],
    observe(target) {
      this.observed.push(target)
    },
    unobserve(target) {
      this.unobserved.push(target)
    },
  }

  measurement.switchCrudFilterLayoutObserverTarget(observer, form)
  measurement.switchCrudFilterLayoutObserverTarget(observer, form)
  measurement.switchCrudFilterLayoutObserverTarget(observer, nextForm)
  measurement.clearCrudFilterLayoutObserverTarget(observer)

  assert.deepEqual(observer.observed, [form, nextForm])
  assert.deepEqual(observer.unobserved, [form, nextForm])
  assert.equal(observer.__ouroborosFilterLayoutObserved, undefined)
})

test('crud filter layout controller exposes one render snapshot and owns raf and observer lifecycle', () => {
  const originalElement = global.Element
  const originalResizeObserver = global.ResizeObserver
  const originalWindow = global.window
  const scheduled = []
  const cancelled = []
  const observerCalls = {
    disconnected: 0,
    observed: [],
    unobserved: [],
  }
  let enabled = true
  let updateCalls = 0

  global.Element = FakeElement
  global.window = {
    cancelAnimationFrame: (id) => cancelled.push(id),
    requestAnimationFrame: (callback) => {
      scheduled.push(callback)
      return scheduled.length
    },
  }
  global.ResizeObserver = class ResizeObserver {
    constructor(callback) {
      this.callback = callback
    }

    observe(target) {
      observerCalls.observed.push(target)
    }

    unobserve(target) {
      observerCalls.unobserved.push(target)
    }

    disconnect() {
      observerCalls.disconnected += 1
    }
  }

  const form = new FakeElement({
    rect: createRect({ width: 900, height: 80, left: 0, top: 0 }),
  })
  const root = new FakeElement().setQuerySelector(
    '.cxd-Crud-filter.cxd-Crud-filter--flat .cxd-Form',
    form
  )
  const buttonA = new FakeElement({
    rect: createRect({ width: 36, height: 28, left: 0, top: 0 }),
  })
  const buttonB = new FakeElement({
    rect: createRect({ width: 44, height: 32, left: 40, top: 0 }),
  })
  const toolbar = new FakeElement({
    rect: createRect({ width: 92, height: 32, left: 0, top: 0 }),
    classNames: ['crud-filter-item--toolbar'],
  }).setQuerySelectorAll('.cxd-Button', [buttonA, buttonB])
  const row = new FakeElement({ children: [toolbar] })
  form
    .setQuerySelector(TOOLBAR_SELECTOR, toolbar)
    .setQuerySelector(':scope > .cxd-Form-row', row)

  try {
    const Controller = loadControllerClass()
    const controller = new Controller({
      getRootElement: () => root,
      isEnabled: () => enabled,
      requestUpdate: () => {
        updateCalls += 1
      },
    })
    const normalizedFilter = {
      body: [
        { type: 'input-date-range', name: 'createdAt' },
        { type: 'input-text', name: 'keyword' },
        { type: 'select', name: 'status' },
        { type: 'button-toolbar', buttons: [] },
      ],
    }

    assert.equal(controller.getSnapshot(normalizedFilter).renderState.layoutState, null)

    controller.syncLifecycle()
    controller.syncLifecycle()

    assert.equal(scheduled.length, 2)
    assert.deepEqual(cancelled, [1])
    assert.deepEqual(observerCalls.observed, [form])

    scheduled[1]()
    const snapshot = controller.getSnapshot(normalizedFilter)

    assert.equal(updateCalls, 1)
    assert.equal(snapshot.renderState.toolbarWidth, '92px')
    assert.equal(snapshot.renderState.toolbarHeight, '32px')
    assert.notEqual(snapshot.renderState.layoutState, null)
    assert.equal(snapshot.renderedSchema.body.at(-1).type, 'button-toolbar')

    enabled = false
    controller.syncLifecycle()
    assert.equal(controller.getSnapshot(normalizedFilter).renderState.layoutState, null)
    assert.deepEqual(observerCalls.unobserved, [form])
    assert.equal(observerCalls.disconnected, 1)

    controller.dispose()
  } finally {
    global.Element = originalElement
    global.ResizeObserver = originalResizeObserver
    global.window = originalWindow
  }
})
