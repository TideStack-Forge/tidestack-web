/* @vitest-environment node */

const assert = require('node:assert/strict')
const path = require('node:path')

const { clearMirroredSrcModuleCache, registerTypescriptRequire } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

registerTypescriptRequire()

const TOOLBAR_SELECTOR =
  '.crud-filter-item--toolbar, .crud-filter-toolbar-item, .crud-filter-toolbar--mobile-stacked'

const translations = {
  search: '搜索',
  reset: '重置',
  'CRUD.filter': '筛选',
}

function translate(value) {
  return translations[value] || value
}

function loadRuntimeClass() {
  clearMirroredSrcModuleCache(__filename, '.')

  return require(
    path.join(
      process.cwd(),
      '../ouroboros-amis-runtime/src/renderers/patch/crudFilterSmartLayoutRuntime.ts'
    )
  ).CrudFilterSmartLayoutRuntime
}

function createRuntime(overrides = {}) {
  const Runtime = loadRuntimeClass()

  return new Runtime({
    getRootElement: () => null,
    requestUpdate: () => undefined,
    ...overrides,
  })
}

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

test('CrudFilterSmartLayoutRuntime renders the normalized filter form schema with label defaults', () => {
  const runtime = createRuntime()

  const rendered = runtime.renderFilter({
    filter: {
      controls: [{ type: 'input-text', name: 'keyword', label: '关键字' }],
    },
    translate,
  })

  assert.equal(rendered.title, '筛选')
  assert.equal(rendered.mode, 'row')
  assert.equal(rendered.submitText, '搜索')
  assert.equal(rendered.type, 'form')
  assert.equal(rendered.api, null)
  assert.equal(rendered.smartLayout, false)
  assert.equal(rendered.className, 'crud-filter-form')
  assert.deepEqual(rendered.style, { '--crud-filter-columns': '5' })
  assert.equal(rendered.body[0].label, '关键字')
  assert.equal(rendered.body[0].placeholder, undefined)
  assert.match(rendered.body[0].columnClassName, /crud-filter-item--field/)
  assert.deepEqual(
    rendered.body[1].buttons.map((button) => button.label),
    ['搜索', '重置']
  )
})

test('CrudFilterSmartLayoutRuntime lets schema label style override system placeholder config', () => {
  const runtime = createRuntime()

  const rendered = runtime.renderFilter({
    systemConfig: {
      ui: {
        crud: {
          filter: {
            smartLayout: {
              labelStyle: 'placeholder',
            },
          },
        },
      },
    },
    filter: {
      smartLayout: {
        labelStyle: 'label',
        fieldsPerRow: {
          desktop: 4,
          narrow: 3,
        },
      },
      body: [{ type: 'input-text', name: 'keyword', label: '关键字' }],
      actions: [{ type: 'submit', label: '查询' }],
    },
    translate,
  })

  assert.equal(rendered.body[0].label, '关键字')
  assert.deepEqual(rendered.style, { '--crud-filter-columns': '4' })
  assert.match(rendered.body[0].columnClassName, /crud-filter-item--field/)
  assert.deepEqual(rendered.body[1].buttons, [{ type: 'submit', label: '查询' }])
})

test('CrudFilterSmartLayoutRuntime honors disabled system smart layout config', () => {
  const runtime = createRuntime()

  const rendered = runtime.renderFilter({
    systemConfig: {
      'ui.crud.filter.smartLayout.enabled': false,
    },
    filter: {
      body: [{ type: 'input-text', name: 'keyword' }],
    },
    translate,
  })

  assert.equal(rendered.className, 'crud-filter-form')
  assert.equal(rendered.body[0].columnClassName, undefined)
  assert.equal(rendered.body[1].columnClassName, undefined)
})

test('CrudFilterSmartLayoutRuntime owns measurement lifecycle and returns display facts', () => {
  const originalElement = global.Element
  const originalResizeObserver = global.ResizeObserver
  const originalWindow = global.window
  const scheduled = []
  const observed = []
  let updateCalls = 0

  class FakeResizeObserver {
    observe(element) {
      observed.push(element)
    }

    unobserve() {
      return undefined
    }

    disconnect() {
      return undefined
    }
  }

  global.Element = FakeElement
  global.ResizeObserver = FakeResizeObserver
  global.window = {
    requestAnimationFrame: (callback) => {
      scheduled.push(callback)
      return scheduled.length
    },
    cancelAnimationFrame: () => undefined,
  }

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
  const fieldA = new FakeElement({
    rect: createRect({ width: 180, height: 40, left: 40, top: 124 }),
  })
  const fieldB = new FakeElement({
    rect: createRect({ width: 180, height: 40, left: 240, top: 124 }),
  })
  const row = new FakeElement({ children: [fieldA, fieldB, toolbar] })
  const form = new FakeElement({
    rect: createRect({ width: 960, height: 80, left: 100, top: 120 }),
  })
    .setQuerySelector(TOOLBAR_SELECTOR, toolbar)
    .setQuerySelector(':scope > .cxd-Form-row', row)
  const root = new FakeElement().setQuerySelector(
    '.cxd-Crud-filter.cxd-Crud-filter--flat .cxd-Form',
    form
  )
  const Runtime = loadRuntimeClass()
  const runtime = new Runtime({
    getRootElement: () => root,
    requestUpdate: () => {
      updateCalls += 1
    },
  })
  const filter = {
    body: [
      { type: 'input-date-range', name: 'createdAt' },
      { type: 'input-text', name: 'keyword' },
    ],
    actions: [{ type: 'submit', label: '查询' }],
  }

  try {
    runtime.renderFilter({ filter, translate })
    runtime.syncLifecycle(filter)

    assert.equal(scheduled.length, 1)
    assert.deepEqual(observed, [form])

    scheduled[0]()
    const rendered = runtime.renderFilter({ filter, translate })

    assert.equal(updateCalls, 1)
    assert.match(rendered.className, /crud-filter-layout--/)
    assert.equal(rendered.style['--crud-filter-toolbar-width'], '92px')
    assert.equal(rendered.style['--crud-filter-toolbar-height'], '32px')
    assert.notEqual(rendered.style['--crud-filter-columns'], undefined)
  } finally {
    runtime.dispose()
    global.Element = originalElement
    global.ResizeObserver = originalResizeObserver
    global.window = originalWindow
  }
})

test('CrudFilterSmartLayoutRuntime renders mobile stacked schema from measured column count', () => {
  const originalElement = global.Element
  const originalResizeObserver = global.ResizeObserver
  const originalWindow = global.window
  const scheduled = []

  class FakeResizeObserver {
    observe() {
      return undefined
    }

    unobserve() {
      return undefined
    }

    disconnect() {
      return undefined
    }
  }

  global.Element = FakeElement
  global.ResizeObserver = FakeResizeObserver
  global.window = {
    requestAnimationFrame: (callback) => {
      scheduled.push(callback)
      return scheduled.length
    },
    cancelAnimationFrame: () => undefined,
  }

  const buttonA = new FakeElement({
    rect: createRect({ width: 36, height: 28, left: 260, top: 132 }),
  })
  const buttonB = new FakeElement({
    rect: createRect({ width: 44, height: 32, left: 300, top: 132 }),
  })
  const toolbar = new FakeElement({
    rect: createRect({ width: 120, height: 40, left: 224, top: 128 }),
    classNames: ['crud-filter-item--toolbar'],
  }).setQuerySelectorAll('.cxd-Button', [buttonA, buttonB])
  const fieldA = new FakeElement({
    rect: createRect({ width: 320, height: 40, left: 24, top: 84 }),
  })
  const fieldB = new FakeElement({
    rect: createRect({ width: 320, height: 40, left: 24, top: 132 }),
  })
  const row = new FakeElement({ children: [fieldA, fieldB, toolbar] })
  const form = new FakeElement({
    rect: createRect({ width: 360, height: 180, left: 16, top: 80 }),
  })
    .setQuerySelector(TOOLBAR_SELECTOR, toolbar)
    .setQuerySelector(':scope > .cxd-Form-row', row)
  const root = new FakeElement().setQuerySelector(
    '.cxd-Crud-filter.cxd-Crud-filter--flat .cxd-Form',
    form
  )
  const Runtime = loadRuntimeClass()
  const runtime = new Runtime({
    getRootElement: () => root,
    requestUpdate: () => undefined,
  })
  const filter = {
    body: [
      { type: 'input-datetime-range', name: 'finishTime' },
      { type: 'select', name: 'companyId' },
    ],
    actions: [{ type: 'submit', label: '查询' }],
  }

  try {
    runtime.renderFilter({ filter, translate })
    runtime.syncLifecycle(filter)
    scheduled[0]()
    const rendered = runtime.renderFilter({ filter, translate })

    assert.match(rendered.className, /crud-filter-form--mobile-stacked/)
    assert.equal(rendered.mode, 'normal')
    assert.equal(rendered.style['--crud-filter-columns'], '1')
    assert.equal(rendered.body[0].mode, undefined)
    assert.match(rendered.body[0].className, /crud-filter-item--mobile-stacked/)
    assert.match(rendered.body[0].columnClassName, /crud-filter-item--span-full/)
    assert.match(rendered.body[0].inputClassName, /crud-filter-control--fill-width/)
    assert.equal(rendered.body[1].mode, undefined)
    assert.match(rendered.body[1].className, /crud-filter-item--mobile-stacked/)
    assert.match(rendered.body[1].columnClassName, /crud-filter-item--span-full/)
    assert.match(rendered.body[1].inputClassName, /crud-filter-control--fill-width/)
    assert.match(rendered.body[2].className, /crud-filter-toolbar--mobile-stacked/)
    assert.match(rendered.body[2].columnClassName, /crud-filter-item--span-full/)
  } finally {
    runtime.dispose()
    global.Element = originalElement
    global.ResizeObserver = originalResizeObserver
    global.window = originalWindow
  }
})
