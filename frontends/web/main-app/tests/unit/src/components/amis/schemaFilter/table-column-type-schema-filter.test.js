import { expect, test, vi } from 'vitest'

const { addSchemaFilter, registeredFilters } = vi.hoisted(() => {
  const registeredFilters = []
  return {
    addSchemaFilter: vi.fn((filter) => registeredFilters.push(filter)),
    registeredFilters,
  }
})

vi.mock('amis', () => ({
  addSchemaFilter,
}))

const { normalizeTableStaticColumnTypes } =
  await import('../../../../../../../ouroboros-amis-runtime/src/schemaFilter/tableColumnTypeSchemaFilter.ts')

test('registers table column type normalization through the AMIS schema filter', () => {
  expect(addSchemaFilter).toHaveBeenCalledTimes(1)

  const schema = {
    type: 'table',
    columns: [
      {
        name: 'status',
        type: 'static-text',
        tpl: '${status}',
      },
    ],
  }

  expect(registeredFilters[0](schema, {})).toEqual({
    type: 'table',
    columns: [
      {
        name: 'status',
        tpl: '${status}',
      },
    ],
  })
})

test('removes only static table column type and keeps tpl unchanged', () => {
  const schema = {
    type: 'crud',
    columns: [
      {
        name: 'status',
        type: 'static-text',
        tpl: '${status}',
        label: '状态',
      },
      {
        name: 'owner',
        type: 'static',
        tpl: '${owner}',
      },
      {
        name: 'createdAt',
        type: 'datetime',
        format: 'YYYY-MM-DD',
      },
    ],
  }

  expect(normalizeTableStaticColumnTypes(schema)).toEqual({
    type: 'crud',
    columns: [
      {
        name: 'status',
        tpl: '${status}',
        label: '状态',
      },
      {
        name: 'owner',
        tpl: '${owner}',
      },
      {
        name: 'createdAt',
        type: 'datetime',
        format: 'YYYY-MM-DD',
      },
    ],
  })
})

test('preserves configured control column types while normalizing static display columns', () => {
  const schema = {
    type: 'crud',
    columns: [
      {
        name: 'name',
        type: 'input-text',
      },
      {
        name: 'status',
        type: 'select',
        options: [
          {
            label: 'Enabled',
            value: 'enabled',
          },
        ],
      },
      {
        name: 'enabled',
        type: 'switch',
      },
      {
        name: 'owner',
        type: 'static-text',
        tpl: '${owner}',
      },
    ],
  }

  expect(normalizeTableStaticColumnTypes(schema)).toEqual({
    type: 'crud',
    columns: [
      {
        name: 'name',
        type: 'input-text',
      },
      {
        name: 'status',
        type: 'select',
        options: [
          {
            label: 'Enabled',
            value: 'enabled',
          },
        ],
      },
      {
        name: 'enabled',
        type: 'switch',
      },
      {
        name: 'owner',
        tpl: '${owner}',
      },
    ],
  })
})

test('returns the original schema when no table column needs normalization', () => {
  const schema = {
    type: 'table',
    columns: [
      {
        name: 'createdAt',
        type: 'datetime',
      },
    ],
  }

  expect(normalizeTableStaticColumnTypes(schema)).toBe(schema)
  expect(normalizeTableStaticColumnTypes({ type: 'tpl', tpl: 'plain' })).toEqual({
    type: 'tpl',
    tpl: 'plain',
  })
})

test('does not normalize non-table schemas that also have columns', () => {
  const schema = {
    type: 'grid',
    columns: [
      {
        body: {
          type: 'static',
          tpl: '${status}',
        },
      },
    ],
  }

  expect(normalizeTableStaticColumnTypes(schema)).toBe(schema)
})
