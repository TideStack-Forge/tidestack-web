const assert = require('node:assert/strict')
const path = require('node:path')
const React = require('react')
const test = globalThis.test || require('node:test')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadInputTableOverlayModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './InputTable/inputTableOverlay.ts')
}

function loadInputTableInlineEditModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './InputTable/inputTableInlineEdit.ts')
}

function loadInputTableOperationModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './InputTable/inputTableOperation.ts')
}

function loadInputTableRowEnhancementsModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './InputTable/inputTableRowEnhancements.ts')
}

function loadInputTableRenderModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './InputTable/inputTableRender.tsx')
}

function loadInputTableInlineEditPresentationModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(
    __filename,
    './InputTable/inputTableInlineEditPresentation.ts'
  )
}

function loadInputTableDomControlsModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './InputTable/inputTableDomControls.ts')
}

function columnToQuickEdit(column) {
  if ((column.type || '').startsWith('input-') || column.type === 'picker') {
    return {
      ...column,
      label: '',
    }
  }

  return {
    type: 'input-text',
  }
}

test('normalizeInputTableEditMode defaults missing and invalid values to inline', () => {
  const { isInputTableOverlayMode, normalizeInputTableEditMode } =
    loadInputTableOverlayModule()

  assert.equal(normalizeInputTableEditMode(undefined), 'inline')
  assert.equal(normalizeInputTableEditMode(''), 'inline')
  assert.equal(normalizeInputTableEditMode('modal'), 'inline')
  assert.equal(normalizeInputTableEditMode('inline'), 'inline')
  assert.equal(normalizeInputTableEditMode('inline-confirm'), 'inline')
  assert.equal(normalizeInputTableEditMode('dialog'), 'dialog')
  assert.equal(normalizeInputTableEditMode('drawer'), 'drawer')
  assert.equal(isInputTableOverlayMode('dialog'), true)
  assert.equal(isInputTableOverlayMode('drawer'), true)
  assert.equal(isInputTableOverlayMode('inline'), false)
})

test('resolveInputTableActionEditBehavior aligns inline mode with needConfirm semantics', () => {
  const { hasInputTableActionApiConfig, resolveInputTableActionEditBehavior } =
    loadInputTableInlineEditModule()

  assert.equal(
    resolveInputTableActionEditBehavior({ action: 'add', mode: 'inline' }),
    'auto-inline'
  )
  assert.equal(
    resolveInputTableActionEditBehavior({ action: 'edit', mode: 'inline' }),
    'native-immediate'
  )
  assert.equal(
    resolveInputTableActionEditBehavior({
      action: 'add',
      mode: 'inline',
      needConfirm: true,
    }),
    'inline-confirm'
  )
  assert.equal(
    resolveInputTableActionEditBehavior({
      action: 'add',
      mode: 'inline-confirm',
    }),
    'auto-inline'
  )
  assert.equal(
    resolveInputTableActionEditBehavior({ action: 'edit', mode: 'drawer' }),
    'overlay'
  )
  assert.equal(
    resolveInputTableActionEditBehavior({
      action: 'edit',
      mode: 'drawer',
      needConfirm: false,
    }),
    'overlay'
  )
  assert.equal(
    resolveInputTableActionEditBehavior({
      action: 'edit',
      mode: 'drawer',
      needConfirm: false,
      updateApi: '/api/lines/${id}',
    }),
    'overlay'
  )
  assert.equal(
    resolveInputTableActionEditBehavior({
      action: 'add',
      mode: 'inline',
      addApi: '/api/lines',
    }),
    'inline-confirm'
  )
  assert.equal(
    resolveInputTableActionEditBehavior({
      action: 'edit',
      mode: 'inline',
      addApi: '/api/lines',
      needConfirm: false,
    }),
    'native-immediate'
  )
  assert.equal(
    resolveInputTableActionEditBehavior({
      action: 'edit',
      mode: 'inline',
      updateApi: { url: '/api/lines/${id}', method: 'put' },
      needConfirm: false,
    }),
    'inline-confirm'
  )
  assert.equal(
    resolveInputTableActionEditBehavior({
      action: 'add',
      mode: 'inline',
      updateApi: { url: '/api/lines/${id}', method: 'put' },
      needConfirm: false,
    }),
    'auto-inline'
  )
  assert.equal(
    resolveInputTableActionEditBehavior({
      action: 'add',
      mode: 'inline',
      needConfirm: false,
    }),
    'auto-inline'
  )
  assert.equal(
    resolveInputTableActionEditBehavior({
      action: 'add',
      mode: 'inline',
      needConfirm: false,
      addApi: { url: '${disabledApi}' },
    }),
    'inline-confirm'
  )
  assert.equal(hasInputTableActionApiConfig(''), false)
  assert.equal(hasInputTableActionApiConfig(false), false)
  assert.equal(hasInputTableActionApiConfig({}), true)
})

test('input table operation helper normalizes add placement and state-specific buttons', () => {
  const {
    INPUT_TABLE_OPERATION_CONTEXT_MARKER,
    canRunInputTableOperationAction,
    getInputTableAddButtonJustifyContent,
    hasInputTableOperationButtonOverrides,
    isInputTableAddButtonTopPosition,
    isInputTableOperationActionType,
    normalizeInputTableAddButtonPosition,
    normalizeInputTableOperationButtonSchema,
    resolveInputTableOperationButtonSchemas,
  } = loadInputTableOperationModule()
  const operationButtons = [{ label: 'Edit', actionType: 'edit' }]
  const addingOperationButtons = [{ label: 'Add cancel', actionType: 'cancel' }]
  const editingOperationButtons = [{ label: 'Save', actionType: 'save' }]

  assert.equal(normalizeInputTableAddButtonPosition(undefined), 'bottom-left')
  assert.equal(normalizeInputTableAddButtonPosition('top-right'), 'top-right')
  assert.equal(normalizeInputTableAddButtonPosition('right-top'), 'bottom-left')
  assert.equal(isInputTableAddButtonTopPosition('top-left'), true)
  assert.equal(isInputTableAddButtonTopPosition('bottom-right'), false)
  assert.equal(getInputTableAddButtonJustifyContent('bottom-right'), 'flex-end')
  assert.equal(getInputTableAddButtonJustifyContent('top-left'), 'flex-start')
  assert.equal(hasInputTableOperationButtonOverrides({ operationButtons }), true)
  assert.equal(hasInputTableOperationButtonOverrides({}), false)
  assert.deepEqual(
    resolveInputTableOperationButtonSchemas({
      state: 'default',
      operationButtons,
      addingOperationButtons,
      editingOperationButtons,
    }),
    operationButtons
  )
  assert.deepEqual(
    resolveInputTableOperationButtonSchemas({
      state: 'adding',
      operationButtons,
      addingOperationButtons,
      editingOperationButtons,
    }),
    addingOperationButtons
  )
  assert.deepEqual(
    resolveInputTableOperationButtonSchemas({
      state: 'editing',
      operationButtons,
      addingOperationButtons,
      editingOperationButtons,
    }),
    editingOperationButtons
  )
  assert.equal(
    resolveInputTableOperationButtonSchemas({
      state: 'editing',
      operationButtons,
    }),
    undefined
  )
  assert.deepEqual(normalizeInputTableOperationButtonSchema({ label: 'Edit' }), {
    type: 'button',
    label: 'Edit',
  })
  assert.deepEqual(
    normalizeInputTableOperationButtonSchema({
      label: 'Sub add',
      actionType: 'sub-add',
    }),
    {
      type: 'button',
      label: 'Sub add',
      actionType: 'subAdd',
    }
  )
  assert.equal(isInputTableOperationActionType('edit'), true)
  assert.equal(isInputTableOperationActionType('save'), true)
  assert.equal(isInputTableOperationActionType('ajax'), false)
  assert.equal(INPUT_TABLE_OPERATION_CONTEXT_MARKER.includes('Operation'), true)
  assert.equal(
    canRunInputTableOperationAction({
      actionType: 'add',
      rowIndexPath: '0',
      addable: true,
      showTableAddBtn: true,
      canAdd: true,
    }),
    true
  )
  assert.equal(
    canRunInputTableOperationAction({
      actionType: 'add',
      rowIndexPath: '0',
      addable: true,
      showTableAddBtn: true,
      canAdd: false,
    }),
    false
  )
  assert.equal(
    canRunInputTableOperationAction({
      actionType: 'delete',
      rowIndexPath: '0',
      removable: true,
      canRemove: false,
    }),
    false
  )
  assert.equal(
    canRunInputTableOperationAction({
      actionType: 'delete',
      rowIndexPath: '0',
      removable: true,
      canRemove: true,
      isStatic: true,
    }),
    false
  )
  assert.equal(
    canRunInputTableOperationAction({
      actionType: 'copy',
      rowIndexPath: '0',
      copyable: true,
      showCopyBtn: true,
      canAdd: true,
    }),
    true
  )
  assert.equal(
    canRunInputTableOperationAction({
      actionType: 'copy',
      rowIndexPath: '0',
      copyable: true,
      showCopyBtn: true,
      canAdd: false,
    }),
    true
  )
  assert.equal(
    canRunInputTableOperationAction({
      actionType: 'sub-add',
      rowIndexPath: '0',
      childrenAddable: true,
      showTableAddBtn: true,
      canAdd: true,
    }),
    true
  )
  assert.equal(
    canRunInputTableOperationAction({
      actionType: 'sub-add',
      rowIndexPath: '0',
      childrenAddable: true,
      showTableAddBtn: true,
      canAdd: false,
    }),
    true
  )
  assert.equal(
    canRunInputTableOperationAction({
      actionType: 'subAdd',
      rowIndexPath: '0',
      childrenAddable: true,
      showTableAddBtn: false,
      canAdd: true,
    }),
    false
  )
  assert.equal(
    canRunInputTableOperationAction({
      actionType: 'save',
      rowIndexPath: '1',
      editIndex: '0',
    }),
    false
  )
})

test('editing row refs prefer the full nested path before local-index fallback', () => {
  const { getInputTableRowRefValues } = loadInputTableInlineEditModule()
  const topLevel = { id: 'top-level-row-zero' }
  const nested = { id: 'nested-row-two-zero' }

  assert.deepEqual(
    getInputTableRowRefValues(
      {
        '0-0': topLevel,
        '1-2.0': nested,
      },
      '2.0'
    ),
    [nested]
  )
  assert.deepEqual(getInputTableRowRefValues({ '0-0': topLevel }, '2.0'), [topLevel])
})

test('candidate items replace the editing row without leaking the placeholder flag', () => {
  const { buildInputTableCandidateItems, getInputTableTreeItem } =
    loadInputTableInlineEditModule()
  const items = [
    { name: 'Top level', children: [{ name: 'Nested zero-zero' }] },
    {
      name: 'Parent',
      children: [{ name: 'Draft', __isPlaceholder: true }],
    },
  ]

  const candidate = buildInputTableCandidateItems({
    items,
    indexes: [1, 0],
    item: { name: 'Committed', __isPlaceholder: true },
    placeholderKey: '__isPlaceholder',
  })

  assert.deepEqual(getInputTableTreeItem(items, [0, 0]), {
    name: 'Nested zero-zero',
  })
  assert.equal(candidate.item.__isPlaceholder, undefined)
  assert.deepEqual(candidate.items, [
    { name: 'Top level', children: [{ name: 'Nested zero-zero' }] },
    {
      name: 'Parent',
      children: [{ name: 'Committed' }],
    },
  ])
  assert.deepEqual(items[1].children[0], {
    name: 'Draft',
    __isPlaceholder: true,
  })
})

test('candidate validation enforces collection limits and unique columns', () => {
  const { validateInputTableCandidateItems } = loadInputTableInlineEditModule()
  const translate = (key) => key

  assert.equal(
    validateInputTableCandidateItems({
      items: [],
      minLength: 1,
      translate,
    }),
    'Combo.minLength'
  )
  assert.equal(
    validateInputTableCandidateItems({
      items: [{ code: 'A' }, { code: 'B' }],
      maxLength: 1,
      translate,
    }),
    'Combo.maxLength'
  )
  assert.equal(
    validateInputTableCandidateItems({
      items: [{ code: 'A' }, { code: 'A' }],
      columns: [{ name: 'code', label: 'Code', unique: true }],
      translate,
    }),
    'InputTable.uniqueError'
  )
  assert.equal(
    validateInputTableCandidateItems({
      items: [{ name: '', amount: 1 }],
      columns: [{ name: 'name', quickEdit: { required: true } }],
      translate,
    }),
    'Form.validateFailed'
  )
  assert.equal(
    validateInputTableCandidateItems({
      items: [{ name: 'Valid', amount: -1 }],
      columns: [{ name: 'amount', quickEdit: { type: 'input-number', min: 0 } }],
      translate,
    }),
    'Form.validateFailed'
  )
  assert.equal(
    validateInputTableCandidateItems({
      items: [{ name: 'Valid', amount: 0 }],
      columns: [
        { name: 'name', quickEdit: { required: true } },
        { name: 'amount', quickEdit: { type: 'input-number', min: 0 } },
      ],
      translate,
    }),
    ''
  )
  assert.equal(
    validateInputTableCandidateItems({
      items: [
        { name: '', amount: 1 },
        { name: 'Current', amount: 2 },
      ],
      item: { name: 'Current', amount: 2 },
      columns: [{ name: 'name', quickEdit: { required: true } }],
      translate,
    }),
    ''
  )
})

test('input table always marks nested table content as a local virtual scroll viewport', () => {
  const { buildInputTablePatchedTableSchema } = loadInputTableRenderModule()
  const { INPUT_TABLE_SCROLL_CONTAINER_CLASS } =
    loadInputTableInlineEditPresentationModule()

  const tableSchema = buildInputTablePatchedTableSchema({
    addButtonPosition: 'bottom-left',
    columnsTogglable: false,
    renderProps: {},
    schema: {
      tableContentClassName: 'table-body',
    },
    shouldRenderTopAddButton: false,
  })

  assert.equal(
    tableSchema.tableContentClassName,
    `table-body ${INPUT_TABLE_SCROLL_CONTAINER_CLASS}`
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(tableSchema, 'lazyRenderAfterExplicit'),
    false
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(tableSchema, 'loadingMaxDuration'),
    false
  )

  const lazyTableSchema = buildInputTablePatchedTableSchema({
    addButtonPosition: 'bottom-left',
    columnsTogglable: false,
    lazyRenderAfter: 20,
    renderProps: {},
    schema: {},
    shouldRenderTopAddButton: false,
  })

  assert.equal(lazyTableSchema.tableContentClassName, INPUT_TABLE_SCROLL_CONTAINER_CLASS)
  assert.equal(lazyTableSchema.lazyRenderAfter, 20)
  assert.equal(lazyTableSchema.lazyRenderAfterExplicit, true)
})

test('input table sizing props can tune nested table content sizing without custom selectors', () => {
  const { buildInputTablePatchedTableSchema } = loadInputTableRenderModule()

  const tableSchema = buildInputTablePatchedTableSchema({
    addButtonPosition: 'bottom-left',
    columnsTogglable: false,
    inputTableSizing: {
      height: 320,
      minHeight: '160px',
      maxHeight: 'none',
      overflow: 'visible',
    },
    renderProps: {},
    schema: {
      style: {
        color: 'red',
      },
      tableContentClassName: 'table-body',
    },
    shouldRenderTopAddButton: false,
  })

  assert.deepEqual(tableSchema.style, {
    color: 'red',
    '--Table-content-height': '320px',
    '--Table-content-minHeight': '160px',
    '--Table-content-maxHeight': 'none',
    '--Table-content-overflow': 'visible',
  })
})

test('input table render helpers explicitly propagate cooperative materialization state', () => {
  const { buildInputTablePatchedRenderProps, buildInputTablePatchedTableSchema } =
    loadInputTableRenderModule()
  const baseOptions = {
    addButtonPosition: 'bottom-left',
    columnsTogglable: false,
    lazyRenderAfter: 20,
    renderProps: { className: 'render-props' },
    schema: {
      tableContentClassName: 'table-body',
      toolbarClassName: 'table-toolbar',
    },
    shouldRenderTopAddButton: false,
  }

  for (const cooperativeMaterializationDisabled of [true, false]) {
    const options = {
      ...baseOptions,
      cooperativeMaterializationDisabled,
    }
    const tableSchema = buildInputTablePatchedTableSchema(options)
    const renderProps = buildInputTablePatchedRenderProps(options)

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        tableSchema,
        'cooperativeMaterializationDisabled'
      ),
      true
    )
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        renderProps,
        'cooperativeMaterializationDisabled'
      ),
      true
    )
    assert.equal(
      tableSchema.cooperativeMaterializationDisabled,
      cooperativeMaterializationDisabled
    )
    assert.equal(
      renderProps.cooperativeMaterializationDisabled,
      cooperativeMaterializationDisabled
    )
  }

  const tableSchema = buildInputTablePatchedTableSchema(baseOptions)
  const renderProps = buildInputTablePatchedRenderProps(baseOptions)

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      tableSchema,
      'cooperativeMaterializationDisabled'
    ),
    false
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      renderProps,
      'cooperativeMaterializationDisabled'
    ),
    false
  )
})

test('inline edit presentation scrolls rows before optional focus lookup', () => {
  const { JSDOM } = require('jsdom')
  const { INPUT_TABLE_SCROLL_CONTAINER_CLASS, presentInputTableInlineEditRow } =
    loadInputTableInlineEditPresentationModule()
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalHTMLElement = globalThis.HTMLElement
  const originalHTMLInputElement = globalThis.HTMLInputElement
  const originalHTMLTextAreaElement = globalThis.HTMLTextAreaElement
  const originalHTMLSelectElement = globalThis.HTMLSelectElement
  const originalHTMLButtonElement = globalThis.HTMLButtonElement

  const dom = new JSDOM(`
    <div id="root">
      <div id="scroll" class="${INPUT_TABLE_SCROLL_CONTAINER_CLASS}">
        <table><tbody>
          <tr data-index="2"><td><button id="before">Before</button></td></tr>
          <tr data-index="3"><td><button id="target">Target</button></td></tr>
        </tbody></table>
      </div>
    </div>
  `)
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.HTMLInputElement = dom.window.HTMLInputElement
  globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement
  globalThis.HTMLSelectElement = dom.window.HTMLSelectElement
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement
  dom.window.requestAnimationFrame = (callback) => {
    callback()
    return 1
  }
  dom.window.cancelAnimationFrame = () => {}

  try {
    const root = dom.window.document.getElementById('root')
    const scroll = dom.window.document.getElementById('scroll')
    const row = dom.window.document.querySelector('tr[data-index="3"]')
    const target = dom.window.document.getElementById('target')

    Object.defineProperty(scroll, 'scrollHeight', { value: 500, configurable: true })
    Object.defineProperty(scroll, 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(row, 'offsetTop', { value: 300, configurable: true })
    Object.defineProperty(row, 'offsetHeight', { value: 20, configurable: true })
    Object.defineProperty(target, 'offsetWidth', { value: 20, configurable: true })
    Object.defineProperty(target, 'offsetHeight', { value: 20, configurable: true })

    const cancel = presentInputTableInlineEditRow({
      root,
      editIndex: '3',
      isNew: true,
      isActive: () => true,
    })

    assert.equal(scroll.scrollTop, 400)
    assert.equal(dom.window.document.activeElement, target)
    cancel()
  } finally {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
    globalThis.HTMLElement = originalHTMLElement
    globalThis.HTMLInputElement = originalHTMLInputElement
    globalThis.HTMLTextAreaElement = originalHTMLTextAreaElement
    globalThis.HTMLSelectElement = originalHTMLSelectElement
    globalThis.HTMLButtonElement = originalHTMLButtonElement
  }
})

test('configured addFormItems and editFormItems replace column-derived form items', () => {
  const { resolveInputTableOverlayFormItems } = loadInputTableOverlayModule()
  const columns = [
    { name: 'name', type: 'input-text', label: 'Name' },
    { name: 'amount', type: 'input-number', label: 'Amount' },
  ]

  assert.deepEqual(
    resolveInputTableOverlayFormItems({
      action: 'add',
      columns,
      addFormItems: [{ type: 'textarea', name: 'remark', label: 'Remark' }],
      columnToQuickEdit,
    }),
    [{ type: 'textarea', name: 'remark', label: 'Remark' }]
  )

  assert.deepEqual(
    resolveInputTableOverlayFormItems({
      action: 'edit',
      columns,
      editFormItems: [{ type: 'input-text', name: 'code', label: 'Code' }],
      columnToQuickEdit,
    }),
    [{ type: 'input-text', name: 'code', label: 'Code' }]
  )
})

test('column-derived form items respect quickEdit, quickEditOnUpdate, and column type', () => {
  const { resolveInputTableOverlayFormItems } = loadInputTableOverlayModule()
  const columns = [
    {
      name: 'name',
      type: 'input-text',
      label: 'Name',
      quickEdit: { required: true },
    },
    {
      name: 'amount',
      type: 'tpl',
      label: 'Amount',
      quickEdit: { type: 'input-number', min: 0 },
      quickEditOnUpdate: { type: 'input-currency', precision: 2 },
    },
    {
      name: 'picker',
      type: 'picker',
      label: 'Picker',
      quickEdit: { source: '/api/options' },
    },
    {
      name: 'remark',
      type: 'input-text',
      label: 'Remark',
      quickEdit: false,
    },
    {
      type: 'operation',
      buttons: [],
    },
    {
      type: 'tpl',
      label: 'No Name',
    },
  ]

  assert.deepEqual(
    resolveInputTableOverlayFormItems({
      action: 'add',
      columns,
      columnToQuickEdit,
    }),
    [
      { name: 'name', type: 'input-text', label: 'Name', required: true },
      { type: 'input-number', name: 'amount', min: 0, label: 'Amount' },
      {
        name: 'picker',
        type: 'picker',
        label: 'Picker',
        source: '/api/options',
      },
    ]
  )

  assert.deepEqual(
    resolveInputTableOverlayFormItems({
      action: 'edit',
      columns,
      columnToQuickEdit,
    }),
    [
      { name: 'name', type: 'input-text', label: 'Name', required: true },
      {
        type: 'input-currency',
        name: 'amount',
        precision: 2,
        label: 'Amount',
      },
      {
        name: 'picker',
        type: 'picker',
        label: 'Picker',
        source: '/api/options',
      },
    ]
  )
})

test('buildInputTableOverlayFormSchema keeps overlay forms local to the row data', () => {
  const { buildInputTableOverlayActions, buildInputTableOverlayFormSchema } =
    loadInputTableOverlayModule()
  const body = [{ type: 'input-text', name: 'name' }]
  const data = { name: 'Alice' }

  assert.deepEqual(buildInputTableOverlayFormSchema(body, data), {
    type: 'form',
    wrapWithPanel: false,
    canAccessSuperData: false,
    inheritData: false,
    body,
    data,
  })
  assert.deepEqual(
    buildInputTableOverlayActions('dialog', (key) => key),
    [
      { type: 'button', actionType: 'cancel', label: 'cancel' },
      {
        type: 'button',
        actionType: 'confirm',
        label: 'confirm',
        primary: true,
      },
    ]
  )
  assert.equal(
    buildInputTableOverlayActions('drawer', (key) => key)[0].actionType,
    'close'
  )
})

test('row aggregate helper sums declared source rows and preserves unchanged refs', () => {
  const { computeRowAggregates } = loadInputTableRowEnhancementsModule()
  const lineA = { code: { value: 'A' }, amount: '3' }
  const lineB = { code: { value: 'B' }, amount: 4 }
  const lineC = { code: { value: 'C' }, amount: 'not-a-number' }
  const total = { code: { value: 'TOTAL' }, amount: '0', sources: 'A, B, C' }
  const items = [lineA, lineB, lineC, total]

  const next = computeRowAggregates(items, {
    valueField: 'amount',
    keyPaths: ['code'],
    sourcesPaths: ['sources'],
  })

  assert.notEqual(next, items)
  assert.equal(next[0], lineA)
  assert.equal(next[1], lineB)
  assert.equal(next[2], lineC)
  assert.notEqual(next[3], total)
  assert.equal(next[3].amount, '7')

  const unchanged = computeRowAggregates(next, {
    valueField: 'amount',
    keyPaths: ['code'],
    sourcesPaths: ['sources'],
  })

  assert.equal(unchanged, next)
  assert.equal(unchanged[3], next[3])
})

test('row aggregate helper supports array sources, nested source paths, and custom key props', () => {
  const { computeRowAggregates } = loadInputTableRowEnhancementsModule()
  const items = [
    { meta: { key: { customKey: 'A' } }, amount: 1 },
    { meta: { key: { customKey: 'B' } }, amount: 2 },
    {
      meta: { key: { customKey: 'TOTAL' } },
      amount: '0',
      aggregate: {
        sources: [{ customKey: 'A' }, { customKey: 'B' }],
      },
    },
  ]
  const next = computeRowAggregates(items, {
    valueField: 'amount',
    keyPaths: ['meta.key'],
    sourcesPaths: ['aggregate.sources'],
    keyProps: ['customKey'],
  })

  assert.equal(next[2].amount, '3')
})

test('input table DOM controls identify and focus the next editable row control', () => {
  const { JSDOM } = require('jsdom')
  const { findEditableInputTableControl, focusInputTableControl } =
    loadInputTableDomControlsModule()
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalHTMLElement = globalThis.HTMLElement
  const originalHTMLInputElement = globalThis.HTMLInputElement
  const originalHTMLTextAreaElement = globalThis.HTMLTextAreaElement
  const originalHTMLSelectElement = globalThis.HTMLSelectElement
  const originalHTMLButtonElement = globalThis.HTMLButtonElement
  const dom = new JSDOM(`
    <div id="root">
      <table><tbody>
        <tr><td><input id="first" name="amount" /></td><td><input name="note" /></td></tr>
        <tr><td><input id="second" name="amount" /></td><td><input name="note" /></td></tr>
      </tbody></table>
    </div>
  `)

  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.HTMLInputElement = dom.window.HTMLInputElement
  globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement
  globalThis.HTMLSelectElement = dom.window.HTMLSelectElement
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement

  try {
    const root = dom.window.document.getElementById('root')
    const first = dom.window.document.getElementById('first')
    const second = dom.window.document.getElementById('second')
    let focused = false
    let selected = false
    root.arrowRowNavigationConfig = { columns: ['amount'] }

    for (const element of [first, second]) {
      Object.defineProperty(element, 'offsetWidth', {
        value: 20,
        configurable: true,
      })
      Object.defineProperty(element, 'offsetHeight', {
        value: 20,
        configurable: true,
      })
    }
    second.focus = () => {
      focused = true
    }
    second.select = () => {
      selected = true
    }

    const nextControl = findEditableInputTableControl(second.closest('td'))
    focusInputTableControl(nextControl)

    assert.equal(root.contains(nextControl), true)
    assert.equal(first.name, nextControl.name)
    assert.equal(focused, true)
    assert.equal(selected, true)
  } finally {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
    globalThis.HTMLElement = originalHTMLElement
    globalThis.HTMLInputElement = originalHTMLInputElement
    globalThis.HTMLTextAreaElement = originalHTMLTextAreaElement
    globalThis.HTMLSelectElement = originalHTMLSelectElement
    globalThis.HTMLButtonElement = originalHTMLButtonElement
  }
})

test('input table DOM controls reveal focused control in table scroll container', () => {
  const { JSDOM } = require('jsdom')
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalHTMLElement = globalThis.HTMLElement
  const dom = new JSDOM(`
    <div id="root">
      <div id="scroll" style="overflow-y: auto;">
        <table><tbody>
          <tr><td><input id="target" /></td></tr>
        </tbody></table>
      </div>
    </div>
  `)

  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.HTMLElement = dom.window.HTMLElement

  try {
    const { revealInputTableControl } = loadInputTableDomControlsModule()
    const scroll = dom.window.document.getElementById('scroll')
    const target = dom.window.document.getElementById('target')

    Object.defineProperty(scroll, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(scroll, 'clientHeight', { value: 220, configurable: true })
    Object.defineProperty(scroll, 'getBoundingClientRect', {
      value: () => ({ top: 0, bottom: 220, left: 0, right: 800 }),
      configurable: true,
    })
    Object.defineProperty(target, 'getBoundingClientRect', {
      value: () => ({ top: 500, bottom: 530, left: 10, right: 120 }),
      configurable: true,
    })

    revealInputTableControl(target)

    assert.equal(scroll.scrollTop, 326)
  } finally {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
    globalThis.HTMLElement = originalHTMLElement
  }
})

test('input table DOM controls reveal focused control in outer dialog body', () => {
  const { JSDOM } = require('jsdom')
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalHTMLElement = globalThis.HTMLElement
  const dom = new JSDOM(`
    <div id="dialog" style="overflow-y: auto;">
      <div id="tableContent" style="overflow-y: visible;">
        <table><tbody>
          <tr><td><input id="target" /></td></tr>
        </tbody></table>
      </div>
    </div>
  `)

  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.HTMLElement = dom.window.HTMLElement

  try {
    const { revealInputTableControl } = loadInputTableDomControlsModule()
    const dialog = dom.window.document.getElementById('dialog')
    const tableContent = dom.window.document.getElementById('tableContent')
    const target = dom.window.document.getElementById('target')

    Object.defineProperty(dialog, 'scrollHeight', { value: 1200, configurable: true })
    Object.defineProperty(dialog, 'clientHeight', { value: 260, configurable: true })
    Object.defineProperty(dialog, 'getBoundingClientRect', {
      value: () => ({ top: 0, bottom: 260, left: 0, right: 800 }),
      configurable: true,
    })
    Object.defineProperty(tableContent, 'scrollHeight', {
      value: 1000,
      configurable: true,
    })
    Object.defineProperty(tableContent, 'clientHeight', {
      value: 1000,
      configurable: true,
    })
    Object.defineProperty(target, 'getBoundingClientRect', {
      value: () => ({ top: 500, bottom: 530, left: 10, right: 120 }),
      configurable: true,
    })

    revealInputTableControl(target)

    assert.equal(tableContent.scrollTop, 0)
    assert.equal(dialog.scrollTop, 286)
  } finally {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
    globalThis.HTMLElement = originalHTMLElement
  }
})

test('quick-edit space handling is scoped to quick-edit ancestors', () => {
  const { JSDOM } = require('jsdom')
  const { hasInputTableQuickEditableAncestor } = loadInputTableDomControlsModule()
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalHTMLElement = globalThis.HTMLElement
  const originalHTMLInputElement = globalThis.HTMLInputElement
  const originalHTMLTextAreaElement = globalThis.HTMLTextAreaElement
  const originalHTMLSelectElement = globalThis.HTMLSelectElement
  const originalHTMLButtonElement = globalThis.HTMLButtonElement
  const dom = new JSDOM(`
    <div id="root">
      <div class="cxd-Field cxd-Field--quickEditable">
        <input id="quick" />
      </div>
      <div class="cxd-Field">
        <input id="plain" />
      </div>
    </div>
  `)

  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.HTMLInputElement = dom.window.HTMLInputElement
  globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement
  globalThis.HTMLSelectElement = dom.window.HTMLSelectElement
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement

  try {
    const root = dom.window.document.getElementById('root')
    const quick = dom.window.document.getElementById('quick')
    const plain = dom.window.document.getElementById('plain')

    for (const element of [quick, plain]) {
      Object.defineProperty(element, 'offsetWidth', {
        value: 20,
        configurable: true,
      })
      Object.defineProperty(element, 'offsetHeight', {
        value: 20,
        configurable: true,
      })
    }

    assert.equal(hasInputTableQuickEditableAncestor(quick, root), true)
    assert.equal(hasInputTableQuickEditableAncestor(plain, root), false)

    assert.equal(hasInputTableQuickEditableAncestor(quick, root), true)
    assert.equal(hasInputTableQuickEditableAncestor(plain, root), false)
  } finally {
    globalThis.window = originalWindow
    globalThis.document = originalDocument
    globalThis.HTMLElement = originalHTMLElement
    globalThis.HTMLInputElement = originalHTMLInputElement
    globalThis.HTMLTextAreaElement = originalHTMLTextAreaElement
    globalThis.HTMLSelectElement = originalHTMLSelectElement
    globalThis.HTMLButtonElement = originalHTMLButtonElement
  }
})

test('top add render helpers compose toolbar without hidden coupling', () => {
  const { INPUT_TABLE_TOP_ADD_ACTION_TYPE } = loadInputTableOperationModule()
  const {
    buildInputTablePatchedRenderProps,
    buildInputTablePatchedTableSchema,
    buildInputTableTopAddActionSchema,
  } = loadInputTableRenderModule()
  const baseAction = { label: 'Base action' }
  const leftTopAddAction = buildInputTableTopAddActionSchema({
    position: 'top-left',
    translate: (value) => value,
  })
  const rightTopAddAction = buildInputTableTopAddActionSchema({
    position: 'top-right',
    translate: (value) => value,
  })

  assert.equal(leftTopAddAction.type, 'button')
  assert.equal(leftTopAddAction.actionType, INPUT_TABLE_TOP_ADD_ACTION_TYPE)
  assert.deepEqual(
    Object.keys(leftTopAddAction).filter((key) => key.startsWith('tableAction')),
    []
  )
  assert.deepEqual(
    Object.keys(rightTopAddAction).filter((key) => key.startsWith('tableAction')),
    []
  )

  const leftTableSchema = buildInputTablePatchedTableSchema({
    addButtonPosition: 'top-left',
    columnsTogglable: false,
    renderProps: {},
    schema: {
      actions: [baseAction],
      toolbarClassName: 'table-toolbar',
    },
    shouldRenderTopAddButton: true,
    topAddActionSchema: leftTopAddAction,
  })
  const rightTableSchema = buildInputTablePatchedTableSchema({
    addButtonPosition: 'top-right',
    columnsTogglable: false,
    renderProps: {},
    schema: {
      actions: [baseAction],
      toolbarClassName: 'table-toolbar',
    },
    shouldRenderTopAddButton: true,
    topAddActionSchema: rightTopAddAction,
  })

  assert.deepEqual(leftTableSchema.actions, [baseAction])
  assert.match(leftTableSchema.toolbarClassName, /InputTable-addToolbar--top-left/)
  assert.deepEqual(rightTableSchema.actions, [baseAction])
  assert.match(rightTableSchema.toolbarClassName, /InputTable-addToolbar--top-right/)

  const onAction = () => 'handled'
  const existingToolbar = React.createElement('span', { 'data-existing': true })
  const renderTopAddToolbar = (position, actionSchema) => {
    const renderCalls = []
    const renderProps = buildInputTablePatchedRenderProps({
      addButtonPosition: position,
      columnsTogglable: false,
      onAction,
      renderProps: {
        headerToolbarRender: () => existingToolbar,
      },
      schema: {},
      shouldRenderTopAddButton: true,
      topAddActionSchema: actionSchema,
    })
    const toolbar = renderProps.headerToolbarRender(
      {
        classnames: (...tokens) => tokens.filter(Boolean).join(' '),
        data: { id: 1 },
        render: (name, schema, props) => {
          const rendered = { name, schema, props }
          renderCalls.push(rendered)
          return React.createElement('button', {
            name,
            renderProps: props,
            schema,
          })
        },
        store: {
          getData: (data) => ({ scoped: data }),
        },
        testIdBuilder: {
          getChild: (name) => ({ name }),
        },
      },
      undefined
    )

    return {
      children: React.Children.toArray(toolbar.props.children),
      renderCalls,
    }
  }
  const leftToolbar = renderTopAddToolbar('top-left', leftTopAddAction)
  const rightToolbar = renderTopAddToolbar('top-right', rightTopAddAction)

  assert.equal(leftToolbar.children[0].type, 'div')
  assert.equal(leftToolbar.children[0].props.className, 'Table-actions')
  assert.equal(leftToolbar.children[1].type, 'span')
  assert.equal(leftToolbar.children[1].props['data-existing'], true)
  assert.equal(leftToolbar.renderCalls[0].name, 'inputTableTopAdd')
  assert.equal(leftToolbar.renderCalls[0].schema, leftTopAddAction)
  assert.equal(leftToolbar.renderCalls[0].props.onAction, onAction)
  assert.deepEqual(leftToolbar.renderCalls[0].props.data, { scoped: { id: 1 } })
  assert.equal(rightToolbar.children[0].type, 'span')
  assert.equal(rightToolbar.children[0].props['data-existing'], true)
  assert.equal(rightToolbar.children[1].type, 'div')
  assert.deepEqual(rightToolbar.children[1].props.style, { marginLeft: 'auto' })
})
