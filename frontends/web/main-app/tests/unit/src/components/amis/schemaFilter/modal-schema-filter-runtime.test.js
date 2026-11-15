import { beforeEach, expect, test, vi } from 'vitest'

const { addSchemaFilter, dataMapping, getRouteInfo, registeredFilters } = vi.hoisted(
  () => {
    const registeredFilters = []
    return {
      addSchemaFilter: vi.fn((filter) => registeredFilters.push(filter)),
      dataMapping: vi.fn((template, data) =>
        template.replace(/\$\{([^}]+)\}/g, (_, key) => data[key] ?? '')
      ),
      getRouteInfo: vi.fn(),
      registeredFilters,
    }
  }
)

vi.mock('amis', () => ({
  addSchemaFilter,
  dataMapping,
}))

vi.mock('@/router/utils', () => ({
  getRouteInfo,
}))

await import('../../../../../../src/components/amis/schemaFilter/modalSchemaFilter.ts')

beforeEach(() => {
  addSchemaFilter.mockClear()
  dataMapping.mockClear()
  getRouteInfo.mockReset()
})

test('dialog url mapping merges route context before row data placeholders', () => {
  getRouteInfo.mockReturnValue({
    type: 'amis',
    schemaId: '/dev/demo-app/builtin-position/post-admin',
    path: '/dev/demo-app/builtin-position/post-admin',
    params: { appName: 'demo-app', key: 'post-admin' },
    query: { tab: 'detail' },
    title: '编辑内置岗位',
  })
  const filter = registeredFilters[0]

  const result = filter(
    {
      type: 'dialog',
      url: '/dev/${appName}/builtin-position/${key}',
    },
    {},
    {
      data: { key: 'post-admin' },
      env: {
        rootData: {
          params: { appName: 'demo-app' },
          query: { tab: 'detail' },
          queryParams: { tab: 'detail' },
          pathVariables: { appName: 'demo-app' },
          SystemConfig: { locale: 'zh-CN' },
          SystemContext: { tenantId: 'demo' },
        },
      },
    }
  )

  expect(dataMapping).toHaveBeenCalledWith('/dev/${appName}/builtin-position/${key}', {
    appName: 'demo-app',
    tab: 'detail',
    key: 'post-admin',
  })
  expect(getRouteInfo).toHaveBeenCalledWith('/dev/demo-app/builtin-position/post-admin')
  expect(result.data.key).toBe('post-admin')
  expect(result.data.params).toEqual({ appName: 'demo-app' })
  expect(result.data.query).toEqual({ tab: 'detail' })
  expect(result.body.schemaId).toBe('/dev/demo-app/builtin-position/post-admin')
})

test('drawer url mapping uses the same referenced schema body defaults as dialog', () => {
  getRouteInfo.mockReturnValue({
    type: 'amis',
    schemaId: '/dev/demo-app/builtin-position/post-admin',
    path: '/dev/demo-app/builtin-position/post-admin',
    params: { appName: 'demo-app', key: 'post-admin' },
    query: {},
    title: '编辑内置岗位',
  })
  const filter = registeredFilters[0]

  const result = filter(
    {
      type: 'drawer',
      url: '/dev/${appName}/builtin-position/${key}',
    },
    {},
    {
      data: { key: 'post-admin' },
      env: {
        rootData: {
          params: { appName: 'demo-app' },
          query: {},
          queryParams: {},
          pathVariables: { appName: 'demo-app' },
        },
      },
    }
  )

  expect(result.title).toBe('编辑内置岗位')
  expect(result.body).toMatchObject({
    type: 'amis-schema',
    schemaId: '/dev/demo-app/builtin-position/post-admin',
    updateActions: true,
  })
  expect(result.data.params).toEqual({ appName: 'demo-app' })
})
