/* @vitest-environment jsdom */

const assert = require('node:assert/strict')
const path = require('node:path')
const test = globalThis.test || require('node:test')

const { registerTypescriptRequire } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

registerTypescriptRequire()

const {
  buildGroupedExportButtons,
  patchExportRowData,
  resolveExportColumns,
  resolveExportRows,
  resolveGroupedExportToolbars,
  resolveVisibleGroupedExportToolbars,
} = require(
  path.join(process.cwd(), 'src/components/amis/renderers/patch/tableExcelExport.ts')
)

test('table Excel policy normalizes runtime columns over pristine schema', () => {
  const fallbackColumns = [
    {
      name: 'status',
      label: 'Runtime status',
      width: 180,
      pristine: {
        name: 'status',
        label: 'Schema status',
        type: 'select',
        options: [{ label: 'Enabled', value: 'enabled' }],
      },
    },
  ]

  assert.deepEqual(resolveExportColumns({ type: 'export-excel' }, fallbackColumns), [
    {
      name: 'status',
      label: 'Runtime status',
      type: 'select',
      options: [{ label: 'Enabled', value: 'enabled' }],
      width: 180,
      pristine: fallbackColumns[0].pristine,
    },
  ])
})

test('table Excel policy prefers selected, fetched, then current-page rows', async () => {
  const currentRows = [{ id: 'store-row' }]
  const context = {
    data: { tenantId: 't-1' },
    fetcher: async () => ({ data: { rows: [{ id: 'fetched-row' }] } }),
    getCurrentRows: () => currentRows,
    getSelected: () => [{ id: 'selected-row' }],
    query: { status: 'enabled', page: 3, perPage: 50 },
  }

  assert.deepEqual(
    await resolveExportRows({ type: 'export-excel', exportSelected: true }, context),
    [{ id: 'selected-row' }]
  )

  context.getSelected = () => []
  assert.deepEqual(
    await resolveExportRows(
      {
        type: 'export-excel',
        api: '/api/demo/export',
        exportSelected: true,
      },
      context
    ),
    [{ id: 'fetched-row' }]
  )

  context.fetcher = async () => ({ data: {} })
  assert.equal(
    await resolveExportRows({ type: 'export-excel', exportSelected: true }, context),
    currentRows
  )
})

test('table Excel policy reads current-page fallback after an empty fetch completes', async () => {
  let currentRows = [{ id: 'before-fetch' }]
  let resolveFetch
  const exportRows = resolveExportRows(
    { type: 'export-excel', api: '/api/demo/export' },
    {
      fetcher: () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
      getCurrentRows: () => currentRows,
      getSelected: () => [],
    }
  )

  currentRows = [{ id: 'after-fetch' }]
  resolveFetch({ data: { rows: [] } })

  assert.deepEqual(await exportRows, [{ id: 'after-fetch' }])
})

test('table Excel policy strips default and aliased pagination fields before fetching', async () => {
  const fetchCalls = []
  const context = {
    data: { tenantId: 't-1' },
    getCurrentRows: () => [],
    getSelected: () => [],
    query: {
      status: 'enabled',
      page: 3,
      perPage: 50,
      current: 3,
      pageSize: 50,
    },
    fetcher: async (...args) => {
      fetchCalls.push(args)
      return { data: { items: [{ id: 'row-1' }] } }
    },
  }

  assert.deepEqual(
    await resolveExportRows(
      {
        type: 'export-excel',
        api: '/api/demo/export',
        pageField: 'current',
        perPageField: 'pageSize',
      },
      context
    ),
    [{ id: 'row-1' }]
  )
  assert.equal(fetchCalls[0][0], '/api/demo/export')
  assert.deepEqual({ ...fetchCalls[0][1] }, { status: 'enabled' })
  assert.equal(fetchCalls[0][1].tenantId, 't-1')
})

test('table Excel policy formats project picker, option, user, and date values', () => {
  const columns = [
    { name: 'createdBy', type: 'static-text' },
    { name: 'organization', type: 'organization-picker' },
    { name: 'employees', type: 'employee-picker' },
    { name: 'dictionary', type: 'data-dict-picker' },
    {
      name: 'status',
      pristine: {
        options: [
          { label: 'Enabled', value: 'enabled' },
          { label: 'Disabled', value: 'disabled' },
        ],
      },
    },
    {
      name: 'createdAt',
      type: 'datetime',
      pristine: { format: 'YYYY-MM-DD' },
    },
  ]

  assert.deepEqual(
    patchExportRowData(
      {
        createdBy: 'admin',
        organization: [{ name: '研发部' }, { label: '平台组' }],
        employees: ['admin', { id: 'u-1', name: '张三' }],
        dictionary: [{ label: '高' }, '低'],
        status: ['enabled', { value: 'disabled' }],
        createdAt: '2024-01-02',
        untouched: 'raw',
      },
      columns
    ),
    {
      createdBy: '管理员',
      organization: '研发部,平台组',
      employees: '管理员,张三',
      dictionary: '高,低',
      status: 'Enabled,Disabled',
      createdAt: '2024-01-02',
      untouched: 'raw',
    }
  )
})

test('table Excel policy filters grouped toolbar items and binds export actions', () => {
  const toolbar = {
    type: 'export-excel',
    buttons: [
      { type: 'export-excel', label: 'Authorized', hasAuth: 'export:allowed' },
      { type: 'export-excel', label: 'Denied', hasAuth: 'export:denied' },
      { type: 'button', label: 'Ignored' },
    ],
  }
  const grouped = resolveGroupedExportToolbars(toolbar)
  const visible = resolveVisibleGroupedExportToolbars(grouped, {
    hasAuth: (key) => key === 'export:allowed',
  })
  const exported = []
  const buttons = buildGroupedExportButtons(visible, (item) => exported.push(item.label))

  assert.deepEqual(
    buttons.map((button) => button.label),
    ['Authorized']
  )
  assert.equal(buttons[0].type, 'button')
  buttons[0].onClick()
  assert.deepEqual(exported, ['Authorized'])
})
