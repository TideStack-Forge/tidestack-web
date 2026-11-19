const assert = require('node:assert/strict')
const path = require('node:path')
const test = globalThis.test || require('node:test')

const { registerTypescriptRequire } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

registerTypescriptRequire()

const {
  applySelectableClickSelectionDefault,
  isPageBodyDirectCrudPath,
  normalizeCrudHeaderToolbar,
  normalizeFilterSchema,
  patchCrudBodySchema,
  resolveFilterInitValues,
} = require(
  path.join(process.cwd(), '../ouroboros-amis-runtime/src/renderers/patch/crudSchemaPolicy.ts')
)

test('crud schema policy keeps path and selection defaults explicit', () => {
  assert.equal(isPageBodyDirectCrudPath('page/body/0/crud'), true)
  assert.equal(isPageBodyDirectCrudPath('page/body/0/panel/0/crud'), false)

  const schema = { type: 'table', columns: [] }
  assert.deepEqual(applySelectableClickSelectionDefault(schema, true), {
    ...schema,
    checkOnItemClick: true,
  })
  assert.equal(applySelectableClickSelectionDefault(schema, false), schema)
})

test('crud schema policy recursively patches ellipsis columns', () => {
  const schema = {
    type: 'table',
    columns: [
      {
        name: 'group',
        columns: [
          {
            name: 'profile.name',
            textOverflow: 'ellipsis',
            width: 120,
          },
        ],
      },
    ],
  }

  const patched = patchCrudBodySchema(schema)
  const column = patched.columns[0].columns[0]

  assert.equal(schema.columns[0].columns[0].popOver, undefined)
  assert.equal(column.popOverEnableOn, '${profile.name}')
  assert.equal(column.popOver.body.type, 'static-text')
  assert.equal(column.popOver.body.static, true)
  assert.equal(column.popOver.body.width, undefined)
})

test('crud schema policy owns filter, toolbar, and finalized init data normalization', () => {
  const translate = (key) => ({ search: '搜索', reset: '重置' })[key] || key
  const normalizedFilter = normalizeFilterSchema(
    { controls: [{ type: 'input-text', name: 'keyword' }] },
    translate
  )

  assert.deepEqual(
    normalizedFilter.body.at(-1).buttons.map((button) => button.label),
    ['搜索', '重置']
  )

  const headerToolbar = normalizeCrudHeaderToolbar([
    { type: 'export-excel', label: '导出当前页', className: 'first' },
    { type: 'export-excel', label: '导出全部' },
  ])
  assert.deepEqual(headerToolbar[0], { type: 'columns-toggler' })
  assert.equal(headerToolbar[1].type, 'export-excel')
  assert.equal(headerToolbar[1].className, 'first')
  assert.equal(headerToolbar[1].buttons.length, 2)

  const finalized = { keyword: 'after-hook' }
  assert.equal(
    resolveFilterInitValues({ keyword: 'before-hook' }, { store: { data: finalized } }),
    finalized
  )
})
