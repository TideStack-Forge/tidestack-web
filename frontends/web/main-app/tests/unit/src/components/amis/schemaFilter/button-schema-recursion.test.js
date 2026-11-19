import { expect, test, vi } from 'vitest'

const { registeredFilters } = vi.hoisted(() => ({
  registeredFilters: [],
}))

vi.mock('amis', () => ({
  addSchemaFilter: (filter) => registeredFilters.push(filter),
}))

async function loadSchemaFilter(relativeFileName) {
  registeredFilters.length = 0
  vi.resetModules()
  await import(`ouroboros-amis-runtime/schemaFilter/${relativeFileName}`)
  return { registeredFilters }
}

test('hasAuth schema filter recurses through nested buttons arrays', async () => {
  const { registeredFilters: filters } = await loadSchemaFilter('hasAuthSchemaFilter.ts')
  const hasAuthCalls = []
  const schema = {
    type: 'button-toolbar',
    buttons: [
      {
        type: 'button',
        label: 'Allowed',
        hasAuth: 'allowed',
      },
      'divider',
      {
        type: 'dropdown-button',
        label: 'More',
        buttons: [
          'nested-divider',
          {
            type: 'button',
            label: 'Denied',
            hasAuth: 'denied',
          },
        ],
      },
    ],
  }

  const result = filters[0](
    schema,
    {},
    {
      SystemContext: {
        hasAuth: (key) => {
          hasAuthCalls.push(key)
          return key === 'allowed'
        },
      },
    }
  )

  expect(hasAuthCalls).toEqual(['allowed', 'denied'])
  expect(result.buttons[0].visible).toBeUndefined()
  expect(result.buttons[1]).toBe('divider')
  expect(result.buttons[2].buttons[0]).toBe('nested-divider')
  expect(result.buttons[2].buttons[1].visible).toBe(false)
})

test('hasRole schema filter recurses through nested buttons arrays', async () => {
  const { registeredFilters: filters } = await loadSchemaFilter('hasRoleSchemaFilter.ts')
  const schema = {
    type: 'button-toolbar',
    buttons: [
      {
        type: 'button',
        label: 'Allowed',
        hasRole: 'admin',
      },
      {
        type: 'dropdown-button',
        label: 'More',
        buttons: [
          {
            type: 'button',
            label: 'Denied',
            hasRole: 'operator',
          },
        ],
      },
    ],
  }

  const result = filters[0](
    schema,
    {},
    {
      SystemContext: {
        hasRole: (role) => role === 'admin',
      },
    }
  )

  expect(result.buttons[0].visible).toBeUndefined()
  expect(result.buttons[1].buttons[0].visible).toBe(false)
})

test('buttonDisabledOnAction recurses through nested buttons arrays', async () => {
  const { registeredFilters: filters } = await loadSchemaFilter(
    'buttonDisabledOnAction.ts'
  )
  const schema = {
    type: 'button-toolbar',
    buttons: [
      {
        type: 'button',
        label: 'Top',
      },
      {
        type: 'dropdown-button',
        label: 'More',
        buttons: [
          {
            type: 'action',
            label: 'Nested',
          },
        ],
      },
    ],
  }

  const result = filters[0](schema, {}, {})

  expect(result.buttons[0].disabledOnAction).toBe(true)
  expect(result.buttons[1].buttons[0].disabledOnAction).toBe(true)
})

test('hasAuth schema filter recurses through bulkActions and itemActions', async () => {
  const { registeredFilters: filters } = await loadSchemaFilter('hasAuthSchemaFilter.ts')
  const hasAuthCalls = []
  const schema = {
    type: 'crud',
    bulkActions: [
      {
        type: 'button',
        label: 'Bulk Denied',
        hasAuth: 'bulk.denied',
      },
      {
        type: 'button',
        label: 'Bulk Allowed',
        hasAuth: 'bulk.allowed',
      },
    ],
    itemActions: [
      {
        type: 'button',
        label: 'Item Denied',
        hasAuth: 'item.denied',
      },
    ],
  }

  const result = filters[0](
    schema,
    {},
    {
      SystemContext: {
        hasAuth: (key) => {
          hasAuthCalls.push(key)
          return key === 'bulk.allowed'
        },
      },
    }
  )

  expect(hasAuthCalls).toEqual(['bulk.denied', 'bulk.allowed', 'item.denied'])
  expect(result.bulkActions[0].visible).toBe(false)
  expect(result.bulkActions[1].visible).toBeUndefined()
  expect(result.itemActions[0].visible).toBe(false)
})

test('hasAuth schema filter recurses through headerToolbar and footerToolbar', async () => {
  const { registeredFilters: filters } = await loadSchemaFilter('hasAuthSchemaFilter.ts')
  const hasAuthCalls = []
  const schema = {
    type: 'crud',
    headerToolbar: [
      'bulkActions',
      {
        type: 'button',
        label: 'Header Denied',
        hasAuth: 'header.denied',
      },
      {
        type: 'button-toolbar',
        buttons: [
          {
            type: 'button',
            label: 'Header Nested Allowed',
            hasAuth: 'header.nested.allowed',
          },
        ],
      },
    ],
    footerToolbar: [
      'statistics',
      {
        type: 'dropdown-button',
        label: 'Footer More',
        buttons: [
          {
            type: 'button',
            label: 'Footer Nested Denied',
            hasAuth: 'footer.nested.denied',
          },
        ],
      },
      'pagination',
    ],
  }

  const result = filters[0](
    schema,
    {},
    {
      SystemContext: {
        hasAuth: (key) => {
          hasAuthCalls.push(key)
          return key === 'header.nested.allowed'
        },
      },
    }
  )

  expect(hasAuthCalls).toEqual([
    'header.denied',
    'header.nested.allowed',
    'footer.nested.denied',
  ])
  expect(result.headerToolbar[0]).toBe('bulkActions')
  expect(result.headerToolbar[1].visible).toBe(false)
  expect(result.headerToolbar[2].buttons[0].visible).toBeUndefined()
  expect(result.footerToolbar[0]).toBe('statistics')
  expect(result.footerToolbar[1].buttons[0].visible).toBe(false)
  expect(result.footerToolbar[2]).toBe('pagination')
})

test('hasRole schema filter recurses through headerToolbar buttons', async () => {
  const { registeredFilters: filters } = await loadSchemaFilter('hasRoleSchemaFilter.ts')
  const schema = {
    type: 'crud',
    headerToolbar: [
      {
        type: 'button',
        label: 'Admin Only',
        hasRole: 'admin',
      },
    ],
  }

  const result = filters[0](
    schema,
    {},
    {
      SystemContext: {
        hasRole: (role) => role === 'admin',
      },
    }
  )

  expect(result.headerToolbar[0].visible).toBeUndefined()
})

test('buttonDisabledOnAction recurses through itemActions', async () => {
  const { registeredFilters: filters } = await loadSchemaFilter(
    'buttonDisabledOnAction.ts'
  )
  const schema = {
    type: 'crud',
    itemActions: [
      {
        type: 'button',
        label: 'Edit',
      },
    ],
  }

  const result = filters[0](schema, {}, {})

  expect(result.itemActions[0].disabledOnAction).toBe(true)
})
