const assert = require('node:assert/strict')
const path = require('node:path')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
  resolveMirroredSrcPath,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadTableLayoutModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './tableLayout.ts')
}

function loadTableDomLifecycleClass() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './tableDomLifecycle.ts').TableDomLifecycle
}

test('affix-header tables default to fixed layout when tableLayout is omitted', () => {
  const { resolvePatchedTableLayout } = loadTableLayoutModule()

  assert.equal(
    resolvePatchedTableLayout({
      affixHeader: true,
      autoFillHeight: false,
      tableLayout: undefined,
    }),
    'fixed'
  )

  assert.equal(
    resolvePatchedTableLayout({
      affixHeader: false,
      autoFillHeight: false,
      tableLayout: undefined,
    }),
    'auto'
  )
})

test('auto-fill-height tables keep auto layout by default', () => {
  const { resolvePatchedTableLayout } = loadTableLayoutModule()

  assert.equal(
    resolvePatchedTableLayout({
      affixHeader: true,
      autoFillHeight: true,
      tableLayout: undefined,
    }),
    'auto'
  )
})

test('explicit tableLayout values are preserved', () => {
  const { resolvePatchedTableLayout } = loadTableLayoutModule()

  assert.equal(
    resolvePatchedTableLayout({
      affixHeader: true,
      autoFillHeight: false,
      tableLayout: 'auto',
    }),
    'auto'
  )

  assert.equal(
    resolvePatchedTableLayout({
      affixHeader: true,
      autoFillHeight: false,
      tableLayout: 'fixed',
    }),
    'fixed'
  )
})

test('affix-header scrollbar gutter compensation only applies in fixed-header non-auto-fill mode', () => {
  const {
    shouldReserveAffixHeaderScrollbarGutter,
    resolveAffixHeaderWrapperPaddingRight,
  } = loadTableLayoutModule()

  assert.equal(
    shouldReserveAffixHeaderScrollbarGutter({
      affixHeader: true,
      autoFillHeight: false,
    }),
    true
  )

  assert.equal(
    shouldReserveAffixHeaderScrollbarGutter({
      affixHeader: false,
      autoFillHeight: false,
    }),
    false
  )

  assert.equal(
    shouldReserveAffixHeaderScrollbarGutter({
      affixHeader: true,
      autoFillHeight: true,
    }),
    false
  )

  assert.equal(
    resolveAffixHeaderWrapperPaddingRight(
      {
        affixHeader: true,
        autoFillHeight: false,
      },
      {
        offsetWidth: 1472,
        clientWidth: 1457,
      }
    ),
    '15px'
  )

  assert.equal(
    resolveAffixHeaderWrapperPaddingRight(
      {
        affixHeader: false,
        autoFillHeight: false,
      },
      {
        offsetWidth: 1472,
        clientWidth: 1457,
      }
    ),
    ''
  )

  assert.equal(
    resolveAffixHeaderWrapperPaddingRight(
      {
        affixHeader: true,
        autoFillHeight: true,
      },
      {
        offsetWidth: 1472,
        clientWidth: 1457,
      }
    ),
    ''
  )
})

test('scrollbar gutter helper returns zero for no scrollbar and clears stale padding', () => {
  const { resolveAffixHeaderWrapperPaddingRight, resolveScrollbarGutterWidth } =
    loadTableLayoutModule()

  assert.equal(
    resolveScrollbarGutterWidth({
      offsetWidth: 1457,
      clientWidth: 1457,
    }),
    0
  )

  assert.equal(
    resolveScrollbarGutterWidth({
      offsetWidth: 1457,
      clientWidth: 1472,
    }),
    0
  )

  assert.equal(resolveScrollbarGutterWidth(null), 0)

  assert.equal(
    resolveAffixHeaderWrapperPaddingRight(
      {
        affixHeader: true,
        autoFillHeight: false,
      },
      {
        offsetWidth: 1457,
        clientWidth: 1457,
      }
    ),
    ''
  )

  assert.equal(
    resolveAffixHeaderWrapperPaddingRight({
      affixHeader: true,
      autoFillHeight: false,
    }),
    ''
  )
})

test('table DOM lifecycle syncs and clears affix-header gutter with a custom class prefix', () => {
  const originalDocument = global.document
  const queriedSelectors = []
  const fixedTopWrapper = {
    style: {
      paddingRight: '',
    },
  }
  const tableContent = {
    offsetWidth: 120,
    clientWidth: 108,
  }
  const root = {
    querySelector(selector) {
      queriedSelectors.push(selector)
      if (selector.includes('Table-fixedTop')) {
        return fixedTopWrapper
      }
      if (selector.includes('Table-contentWrap')) {
        return tableContent
      }
      return null
    },
  }
  let layoutProps = {
    affixHeader: true,
    autoFillHeight: false,
  }

  global.document = {
    removeEventListener() {},
  }

  try {
    const TableDomLifecycle = loadTableDomLifecycleClass()
    const lifecycle = new TableDomLifecycle({
      clearBaseResizeSession() {},
      getClassPrefix: () => 'custom-',
      getColumns: () => [],
      getLayoutProps: () => layoutProps,
      getResizeListeners: () => ({
        mousemove() {},
        mouseup() {},
      }),
      getRoot: () => root,
      setBaseResizeSession() {},
    })

    lifecycle.syncAffixHeaderScrollbarGutter()
    assert.equal(fixedTopWrapper.style.paddingRight, '12px')
    assert.ok(queriedSelectors.every((selector) => selector.includes('custom-')))

    layoutProps = {
      affixHeader: false,
      autoFillHeight: false,
    }
    lifecycle.syncAffixHeaderScrollbarGutter()
    assert.equal(fixedTopWrapper.style.paddingRight, '')

    fixedTopWrapper.style.paddingRight = '12px'
    lifecycle.dispose()
    assert.equal(fixedTopWrapper.style.paddingRight, '')
  } finally {
    global.document = originalDocument
  }
})

test('renderer patch bundle imports the table override', () => {
  const Module = require('node:module')
  const patchIndexPath = resolveMirroredSrcPath(__filename, './index.ts')
  const originalLoad = Module._load
  const importedPatchModules = []

  clearMirroredSrcModuleCache(__filename, '.')
  Module._load = function loadPatchedRendererImport(request, parent, isMain) {
    if (parent?.filename === patchIndexPath && request.startsWith('./')) {
      importedPatchModules.push(request)
      return {}
    }

    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    require(patchIndexPath)
  } finally {
    Module._load = originalLoad
    clearMirroredSrcModuleCache(__filename, '.')
  }

  assert.ok(importedPatchModules.includes('./Table'))
})
