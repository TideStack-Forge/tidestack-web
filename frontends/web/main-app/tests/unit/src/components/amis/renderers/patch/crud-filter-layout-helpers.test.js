/* @vitest-environment node */

const assert = require('node:assert/strict')
const path = require('node:path')

const { clearMirroredSrcModuleCache, registerTypescriptRequire } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

registerTypescriptRequire()

function loadGridModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return require(
    path.join(
      process.cwd(),
      '../ouroboros-amis-runtime/src/renderers/patch/crudFilterGridLayout.ts'
    )
  )
}

test('normalizeCrudFilterGridLayout removes legacy column hints and keeps row grid normalization', () => {
  const grid = loadGridModule()

  assert.deepEqual(
    grid.normalizeCrudFilterGridLayout({
      columnCount: 4,
      columnsCount: 4,
      body: [
        { type: 'input-text', name: 'keyword' },
        {
          type: 'button-toolbar',
          buttons: [{ type: 'submit', label: '搜索' }],
        },
      ],
    }),
    {
      mode: 'row',
      body: [
        {
          type: 'input-text',
          name: 'keyword',
          columnClassName:
            'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--span-1 crud-filter-item--first-compact',
        },
        {
          type: 'button-toolbar',
          buttons: [{ type: 'submit', label: '搜索' }],
          columnClassName:
            'crud-filter-item crud-filter-item--index-1 crud-filter-item--span-1 crud-filter-item--toolbar',
        },
      ],
    }
  )
})

test('resolveCrudFilterGridColumnCount uses 5/4/1 defaults and accepts configured fields per row', () => {
  const grid = loadGridModule()

  assert.equal(grid.resolveCrudFilterGridColumnCount(1920), 5)
  assert.equal(grid.resolveCrudFilterGridColumnCount(1454), 4)
  assert.equal(grid.resolveCrudFilterGridColumnCount(768), 1)
  assert.equal(
    grid.resolveCrudFilterGridColumnCount(1920, {
      desktop: 6,
      narrow: 5,
      mobile: 2,
    }),
    6
  )
  assert.equal(
    grid.resolveCrudFilterGridColumnCount(1454, {
      desktop: 6,
      narrow: 5,
      mobile: 2,
    }),
    5
  )
  assert.equal(
    grid.resolveCrudFilterGridColumnCount(768, {
      desktop: 6,
      narrow: 5,
      mobile: 2,
    }),
    2
  )
})

test('resolveCrudFilterLayoutMode uses the 4-column narrow default for compact rail overflow', () => {
  const grid = loadGridModule()

  assert.deepEqual(
    grid.resolveCrudFilterLayoutMode({
      bodyItems: [
        {
          type: 'input-date-range',
          name: 'createdAt',
          columnClassName:
            'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--wide-candidate crud-filter-item--span-1',
        },
        {
          type: 'input-text',
          name: 'keyword',
          columnClassName:
            'crud-filter-item crud-filter-item--index-1 crud-filter-item--field crud-filter-item--span-1',
        },
        {
          type: 'input-text',
          name: 'code',
          columnClassName:
            'crud-filter-item crud-filter-item--index-2 crud-filter-item--field crud-filter-item--span-1',
        },
        {
          type: 'select',
          name: 'status',
          columnClassName:
            'crud-filter-item crud-filter-item--index-3 crud-filter-item--field crud-filter-item--span-1',
        },
        {
          type: 'button-toolbar',
          buttons: [{ type: 'submit', label: '搜索' }],
          columnClassName:
            'crud-filter-item crud-filter-item--index-4 crud-filter-item--span-1 crud-filter-item--toolbar',
        },
      ],
      containerWidth: 900,
      toolbarInlineMinWidth: 260,
    }),
    {
      columnCount: 4,
      modeCode: 'C1E',
      layoutState: 'rail',
      wideHeadSplit: false,
      alignLabelWidth: false,
    }
  )
})

test('resolveCrudFilterLayoutMode keeps exact single-row compact and wide layouts in the compact topology when no residual space remains', () => {
  const grid = loadGridModule()

  assert.deepEqual(
    grid.resolveCrudFilterLayoutMode({
      bodyItems: [
        {
          type: 'input-date-range',
          name: 'createdAt',
          colSpan: 2,
          columnClassName:
            'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--span-2',
        },
        {
          type: 'button-toolbar',
          buttons: [{ type: 'submit', label: '搜索' }],
          columnClassName:
            'crud-filter-item crud-filter-item--index-1 crud-filter-item--span-1 crud-filter-item--toolbar',
        },
      ],
      containerWidth: 900,
      toolbarInlineMinWidth: 260,
    }),
    {
      columnCount: 4,
      modeCode: 'C1P',
      layoutState: 'inline',
      wideHeadSplit: false,
      alignLabelWidth: false,
    }
  )

  assert.deepEqual(
    grid.resolveCrudFilterLayoutMode({
      bodyItems: [
        {
          type: 'input-date-range',
          name: 'createdAt',
          columnClassName:
            'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--wide-candidate crud-filter-item--span-1',
        },
        {
          type: 'input-text',
          name: 'keyword',
          columnClassName:
            'crud-filter-item crud-filter-item--index-1 crud-filter-item--field crud-filter-item--span-1',
        },
        {
          type: 'input-text',
          name: 'code',
          columnClassName:
            'crud-filter-item crud-filter-item--index-2 crud-filter-item--field crud-filter-item--span-1',
        },
        {
          type: 'input-text',
          name: 'type',
          columnClassName:
            'crud-filter-item crud-filter-item--index-3 crud-filter-item--field crud-filter-item--span-1',
        },
        {
          type: 'input-text',
          name: 'status',
          columnClassName:
            'crud-filter-item crud-filter-item--index-4 crud-filter-item--field crud-filter-item--span-1',
        },
        {
          type: 'button-toolbar',
          buttons: [{ type: 'submit', label: '搜索' }],
          columnClassName:
            'crud-filter-item crud-filter-item--index-5 crud-filter-item--span-1 crud-filter-item--toolbar',
        },
      ],
      containerWidth: 900,
      toolbarInlineMinWidth: 260,
    }),
    {
      columnCount: 4,
      modeCode: 'W1E',
      layoutState: 'rail',
      wideHeadSplit: true,
      alignLabelWidth: true,
    }
  )
})

test('resolveCrudFilterLayoutMode keeps rendered wide-head bodies in the wide topology after the compact tail returns to one row', () => {
  const grid = loadGridModule()

  assert.deepEqual(
    grid.resolveCrudFilterLayoutMode({
      bodyItems: [
        {
          type: 'input-date-range',
          name: 'orderDt',
          columnClassName:
            'crud-filter-item crud-filter-item--index-4 crud-filter-item--field crud-filter-item--wide-candidate crud-filter-item--span-1 crud-filter-item--wide-head crud-filter-item--last-wide',
        },
        {
          type: 'divider',
          className: 'crud-filter-divider',
          lineStyle: 'solid',
          label: false,
          columnClassName:
            'crud-filter-item crud-filter-item--span-full crud-filter-item--divider',
        },
        {
          type: 'organization-picker',
          name: 'orgId',
          columnClassName:
            'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--span-1 crud-filter-item--first-compact',
        },
        {
          type: 'input-text',
          name: 'customerName',
          columnClassName:
            'crud-filter-item crud-filter-item--index-1 crud-filter-item--field crud-filter-item--span-1',
        },
        {
          type: 'select',
          name: 'billStatus',
          columnClassName:
            'crud-filter-item crud-filter-item--index-2 crud-filter-item--field crud-filter-item--span-1',
        },
        {
          type: 'select',
          name: 'auditStatus',
          columnClassName:
            'crud-filter-item crud-filter-item--index-3 crud-filter-item--field crud-filter-item--span-1',
        },
        {
          type: 'select',
          name: 'deliveryStatus',
          columnClassName:
            'crud-filter-item crud-filter-item--index-4 crud-filter-item--field crud-filter-item--span-1',
        },
        {
          type: 'button-toolbar',
          buttons: [{ type: 'submit', label: '搜索' }],
          columnClassName:
            'crud-filter-item crud-filter-item--index-5 crud-filter-item--span-1 crud-filter-item--toolbar',
        },
      ],
      containerWidth: 1454,
      toolbarInlineMinWidth: 128,
    }),
    {
      columnCount: 4,
      modeCode: 'WMP',
      layoutState: 'inline',
      wideHeadSplit: true,
      alignLabelWidth: true,
    }
  )
})

test('resolveCrudFilterLayoutMode keeps the buy day pay three-field filter inline with default columns', () => {
  const grid = loadGridModule()

  assert.deepEqual(
    grid.resolveCrudFilterLayoutMode({
      bodyItems: [
        {
          type: 'input-datetime-range',
          name: 'finishTime',
          columnClassName:
            'crud-filter-item crud-filter-item--index-2 crud-filter-item--field crud-filter-item--wide-candidate crud-filter-item--span-2',
        },
        {
          type: 'select',
          name: 'companyId',
          columnClassName:
            'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--span-1 crud-filter-item--first-compact',
        },
        {
          type: 'select',
          name: 'supplierId',
          columnClassName:
            'crud-filter-item crud-filter-item--index-1 crud-filter-item--field crud-filter-item--span-1',
        },
        {
          type: 'button-toolbar',
          buttons: [{ type: 'submit', label: '搜索' }],
          columnClassName:
            'crud-filter-item crud-filter-item--index-3 crud-filter-item--span-1 crud-filter-item--toolbar',
        },
      ],
      containerWidth: 1742,
      toolbarInlineMinWidth: 122,
    }),
    {
      columnCount: 4,
      modeCode: 'C1P',
      layoutState: 'inline',
      wideHeadSplit: false,
      alignLabelWidth: false,
    }
  )
})

test('applyCrudFilterLayoutBody marks auto-width datetime ranges to fill their allocated column span', () => {
  const grid = loadGridModule()

  const body = grid.applyCrudFilterLayoutBody({
    modeCode: 'C1P',
    bodyItems: [
      {
        type: 'select',
        name: 'companyId',
        columnClassName:
          'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--span-1 crud-filter-item--first-compact',
      },
      {
        type: 'select',
        name: 'supplierId',
        columnClassName:
          'crud-filter-item crud-filter-item--index-1 crud-filter-item--field crud-filter-item--span-1',
      },
      {
        type: 'input-datetime-range',
        name: 'finishTime',
        columnClassName:
          'crud-filter-item crud-filter-item--index-2 crud-filter-item--field crud-filter-item--wide-candidate crud-filter-item--span-2',
      },
      {
        type: 'button-toolbar',
        buttons: [{ type: 'submit', label: '搜索' }],
        columnClassName:
          'crud-filter-item crud-filter-item--index-3 crud-filter-item--span-1 crud-filter-item--toolbar',
      },
    ],
  })

  assert.equal(body[0].name, 'finishTime')
  assert.equal(body[0].mode, 'inline')
  assert.equal(body[0].columnClassName, undefined)
  assert.match(body[0].inputClassName, /crud-filter-control--fill-width/)
  assert.equal(body[1].name, 'companyId')
  assert.equal(body[2].name, 'supplierId')
  assert.equal(body[3].type, 'button-toolbar')
})

test('applyCrudFilterLayoutBody keeps wide-head datetime ranges as grid columns at intrinsic width', () => {
  const grid = loadGridModule()

  const body = grid.applyCrudFilterLayoutBody({
    modeCode: 'WMP',
    wideHeadSplit: true,
    bodyItems: [
      {
        type: 'select',
        name: 'companyId',
        columnClassName:
          'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--span-1 crud-filter-item--first-compact',
      },
      {
        type: 'input-datetime-range',
        name: 'finishTime',
        columnClassName:
          'crud-filter-item crud-filter-item--index-1 crud-filter-item--field crud-filter-item--wide-candidate crud-filter-item--span-2',
      },
      {
        type: 'button-toolbar',
        buttons: [{ type: 'submit', label: '搜索' }],
        columnClassName:
          'crud-filter-item crud-filter-item--index-2 crud-filter-item--span-1 crud-filter-item--toolbar',
      },
    ],
  })

  assert.equal(body[0].name, 'finishTime')
  assert.equal(body[0].mode, undefined)
  assert.match(body[0].columnClassName, /crud-filter-item--wide-head/)
  assert.match(body[0].columnClassName, /crud-filter-item--span-2/)
  assert.doesNotMatch(body[0].columnClassName, /crud-filter-item--span-full/)
  assert.equal(body[0].inputClassName, undefined)
  assert.equal(body[1].type, 'divider')
  assert.equal(body[2].name, 'companyId')
  assert.equal(body[3].type, 'button-toolbar')
})

test('applyCrudFilterLayoutBody keeps wide-head items in the column grid for the inline partial topology', () => {
  const grid = loadGridModule()

  const body = grid.applyCrudFilterLayoutBody({
    modeCode: 'W1P',
    wideHeadSplit: true,
    bodyItems: [
      {
        type: 'input-datetime-range',
        name: 'finishTime',
        columnClassName:
          'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--wide-candidate crud-filter-item--span-2',
      },
      {
        type: 'select',
        name: 'companyId',
        columnClassName:
          'crud-filter-item crud-filter-item--index-1 crud-filter-item--field crud-filter-item--span-1 crud-filter-item--first-compact',
      },
      {
        type: 'button-toolbar',
        buttons: [{ type: 'submit', label: '搜索' }],
        columnClassName:
          'crud-filter-item crud-filter-item--index-2 crud-filter-item--span-1 crud-filter-item--toolbar',
      },
    ],
  })

  assert.equal(body[0].name, 'finishTime')
  assert.equal(body[0].mode, undefined)
  assert.match(body[0].columnClassName, /crud-filter-item--wide-head/)
  assert.match(body[0].columnClassName, /crud-filter-item--span-2/)
  assert.equal(body[1].type, 'divider')
  assert.equal(body[2].name, 'companyId')
  assert.equal(body[3].type, 'button-toolbar')
  assert.equal(body[3].mode, 'inline')
  assert.equal(body[3].className, 'crud-filter-toolbar-item')
})

test('applyCrudFilterLayoutBody expresses mobile stacked full-width semantics in schema', () => {
  const grid = loadGridModule()

  const body = grid.applyCrudFilterLayoutBody({
    modeCode: 'C1P',
    mobileStacked: true,
    bodyItems: [
      {
        type: 'select',
        name: 'companyId',
        columnClassName:
          'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--span-1 crud-filter-item--first-compact',
      },
      {
        type: 'input-datetime-range',
        name: 'finishTime',
        columnClassName:
          'crud-filter-item crud-filter-item--index-1 crud-filter-item--field crud-filter-item--wide-candidate crud-filter-item--span-2',
      },
      {
        type: 'button-toolbar',
        buttons: [{ type: 'submit', label: '搜索' }],
        columnClassName:
          'crud-filter-item crud-filter-item--index-2 crud-filter-item--span-1 crud-filter-item--toolbar',
      },
    ],
  })

  assert.equal(body[0].name, 'finishTime')
  assert.equal(body[0].mode, undefined)
  assert.match(body[0].className, /crud-filter-item--mobile-stacked/)
  assert.match(body[0].columnClassName, /crud-filter-item--span-full/)
  assert.match(body[0].inputClassName, /crud-filter-control--fill-width/)
  assert.equal(
    body[0].inputClassName
      .split(/\s+/)
      .filter((item) => item === 'crud-filter-control--fill-width').length,
    1
  )
  assert.equal(body[1].name, 'companyId')
  assert.equal(body[1].mode, undefined)
  assert.match(body[1].className, /crud-filter-item--mobile-stacked/)
  assert.match(body[1].columnClassName, /crud-filter-item--span-full/)
  assert.match(body[1].inputClassName, /crud-filter-control--fill-width/)
  assert.equal(body[2].type, 'button-toolbar')
  assert.equal(body[2].mode, undefined)
  assert.match(body[2].className, /crud-filter-toolbar--mobile-stacked/)
  assert.match(body[2].columnClassName, /crud-filter-item--span-full/)
})

test('buildCrudFilterLayoutContext exposes pre-mode facts for inline-fitting wide candidates', () => {
  const grid = loadGridModule()

  const context = grid.buildCrudFilterLayoutContext({
    bodyItems: [
      {
        type: 'input-date-range',
        name: 'createdAt',
        columnClassName:
          'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--wide-candidate crud-filter-item--span-1',
      },
      {
        type: 'input-text',
        name: 'keyword',
        columnClassName:
          'crud-filter-item crud-filter-item--index-1 crud-filter-item--field crud-filter-item--span-1',
      },
      {
        type: 'input-text',
        name: 'code',
        columnClassName:
          'crud-filter-item crud-filter-item--index-2 crud-filter-item--field crud-filter-item--span-1',
      },
      {
        type: 'select',
        name: 'status',
        columnClassName:
          'crud-filter-item crud-filter-item--index-3 crud-filter-item--field crud-filter-item--span-1',
      },
      {
        type: 'button-toolbar',
        buttons: [{ type: 'submit', label: '搜索' }],
        columnClassName:
          'crud-filter-item crud-filter-item--index-4 crud-filter-item--span-1 crud-filter-item--toolbar',
      },
    ],
    columnCount: 6,
    containerWidth: 900,
    toolbarInlineMinWidth: 260,
    gapPx: 16,
  })

  assert.deepEqual(
    {
      wideItems: context.wideItems.length,
      compactItems: context.compactItems.length,
      unsplitRowCount: context.unsplitRowCount,
      shouldSplitWideHead: context.shouldSplitWideHead,
      tailRowsCode: context.tailRowsCode,
      tailFitCode: context.tailFitCode,
    },
    {
      wideItems: 1,
      compactItems: 3,
      unsplitRowCount: 1,
      shouldSplitWideHead: false,
      tailRowsCode: '1',
      tailFitCode: 'P',
    }
  )
})

test('applyCrudFilterLayoutBody uses semantic toolbar root in inline partial layouts', () => {
  const grid = loadGridModule()

  const body = grid.applyCrudFilterLayoutBody({
    bodyItems: [
      {
        type: 'input-text',
        name: 'keyword',
        label: false,
        placeholder: '关键字',
        columnClassName:
          'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--span-1',
      },
      {
        type: 'button-toolbar',
        buttons: [{ type: 'submit', label: '搜索' }],
        columnClassName:
          'crud-filter-item crud-filter-item--index-1 crud-filter-item--span-1 crud-filter-item--toolbar',
      },
    ],
    modeCode: 'C1P',
  })

  assert.equal(body[0].mode, 'inline')
  assert.equal(body[0].className, undefined)
  assert.equal(body[1].mode, 'inline')
  assert.equal(body[1].className, 'crud-filter-toolbar-item')
  assert.equal(body[1].columnClassName, undefined)
})

test('applyCrudFilterCompactSingleRowBody only reorders the promoted wide field and keeps field affordance untouched', () => {
  const grid = loadGridModule()

  const body = grid.applyCrudFilterCompactSingleRowBody([
    {
      type: 'input-text',
      name: 'keyword',
      label: '关键字',
      placeholder: '请输入关键字',
      columnClassName:
        'crud-filter-item crud-filter-item--index-1 crud-filter-item--field crud-filter-item--span-1',
    },
    {
      type: 'input-date-range',
      name: 'createdAt',
      label: '更新时间',
      columnClassName:
        'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--wide-candidate crud-filter-item--span-2',
    },
    {
      type: 'button-toolbar',
      buttons: [{ type: 'submit', label: '搜索' }],
      columnClassName:
        'crud-filter-item crud-filter-item--index-2 crud-filter-item--span-1 crud-filter-item--toolbar',
    },
  ])

  assert.equal(body[0].name, 'createdAt')
  assert.equal(body[0].label, '更新时间')
  assert.equal(body[1].name, 'keyword')
  assert.equal(body[1].label, '关键字')
  assert.equal(body[1].placeholder, '请输入关键字')
  assert.equal(body[2].type, 'button-toolbar')
})

test('applyCrudFilterLayoutBody enables compact lts affordance through configuration', () => {
  const grid = loadGridModule()

  const body = grid.applyCrudFilterLayoutBody({
    labelStyle: 'placeholder',
    modeCode: 'C1P',
    bodyItems: [
      {
        type: 'input-text',
        name: 'keyword',
        label: '关键字',
        className: 'w-40 keyword-filter',
        inputClassName: 'existing-keyword-input',
        columnClassName:
          'crud-filter-item crud-filter-item--index-1 crud-filter-item--field crud-filter-item--span-1',
      },
      {
        type: 'input-date-range',
        name: 'createdAt',
        label: '创建日期',
        className: 'w-56 date-filter',
        inputClassName: 'existing-range-input',
        columnClassName:
          'crud-filter-item crud-filter-item--index-0 crud-filter-item--field crud-filter-item--wide-candidate crud-filter-item--span-2',
      },
      {
        type: 'button-toolbar',
        buttons: [{ type: 'submit', label: '搜索' }],
        columnClassName:
          'crud-filter-item crud-filter-item--index-2 crud-filter-item--span-1 crud-filter-item--toolbar',
      },
    ],
  })

  assert.deepEqual(body, [
    {
      type: 'tooltip-wrapper',
      wrapperComponent: 'div',
      className:
        'date-filter crud-filter-wide-tooltip crud-filter-wide-tooltip--auto-width crud-filter-wide-tooltip--date-range',
      content: '创建日期',
      body: {
        type: 'input-date-range',
        name: 'createdAt',
        inputClassName: 'existing-range-input',
        label: false,
        wrap: false,
      },
      mode: 'inline',
    },
    {
      type: 'input-text',
      name: 'keyword',
      label: false,
      placeholder: '关键字',
      className: 'keyword-filter',
      inputClassName: 'existing-keyword-input w-40',
      mode: 'inline',
    },
    {
      type: 'button-toolbar',
      buttons: [{ type: 'submit', label: '搜索' }],
      className: 'crud-filter-toolbar-item',
      mode: 'inline',
    },
  ])
})

test('resolveCrudFilterSmartLayoutOptions resolves granular defaults and lets schema override system config', () => {
  const grid = loadGridModule()

  assert.deepEqual(
    grid.resolveCrudFilterSmartLayoutOptions(
      {},
      {
        ui: {
          crud: {
            filter: {
              smartLayout: {
                enabled: false,
                labelStyle: 'placeholder',
                fieldsPerRow: {
                  desktop: 5,
                  narrow: 4,
                  mobile: 2,
                },
              },
            },
          },
        },
      }
    ),
    {
      enabled: false,
      labelStyle: 'placeholder',
      fieldsPerRow: {
        desktop: 5,
        narrow: 4,
        mobile: 2,
      },
    }
  )

  assert.deepEqual(
    grid.resolveCrudFilterSmartLayoutOptions(
      {
        smartLayout: {
          enabled: true,
          labelStyle: 'label',
          fieldsPerRow: 3,
        },
      },
      {
        'ui.crud.filter.smartLayout.enabled': false,
        'ui.crud.filter.smartLayout.labelStyle': 'placeholder',
        'ui.crud.filter.smartLayout.fieldsPerRow': {
          desktop: 5,
          narrow: 4,
          mobile: 2,
        },
      }
    ),
    {
      enabled: true,
      labelStyle: 'label',
      fieldsPerRow: {
        desktop: 3,
        narrow: 3,
        mobile: 2,
      },
    }
  )

  assert.deepEqual(
    grid.resolveCrudFilterSmartLayoutOptions(
      {},
      {
        'ui.crud.filter.smartLayout.fieldsPerRow.desktop': '8',
        'ui.crud.filter.smartLayout.fieldsPerRow.narrow': 5,
        'ui.crud.filter.smartLayout.fieldsPerRow.mobile': '2',
      }
    ),
    {
      enabled: true,
      labelStyle: 'label',
      fieldsPerRow: {
        desktop: 8,
        narrow: 5,
        mobile: 2,
      },
    }
  )

  assert.deepEqual(
    grid.resolveCrudFilterSmartLayoutOptions(
      {
        smartLayout: {
          fieldAffordance: 'compact',
        },
      },
      {}
    ),
    {
      enabled: true,
      labelStyle: 'placeholder',
      fieldsPerRow: {
        desktop: 5,
        narrow: 4,
        mobile: 1,
      },
    }
  )
})
