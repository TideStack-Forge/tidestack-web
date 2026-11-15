import { beforeEach, expect, test, vi } from 'vitest'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/utils/http', () => ({ Client: { get } }))
const { listProviders } = await import('../../../../../src/common/api/auth')
beforeEach(() => get.mockReset())

test.each([
  { data: [{ key: 'corporate', type: 'ldap' }] },
  { data: { items: [{ key: 'corporate', type: 'ldap' }] } },
])(
  'provider discovery returns an array with the shared HTTP collection contract',
  async ({ data }) => {
    get.mockResolvedValue({ data: { code: 0, data } })
    expect(await listProviders()).toEqual({
      code: 0,
      data: [{ key: 'corporate', type: 'ldap' }],
    })
  }
)

test('provider discovery keeps failures distinguishable from an empty successful list', async () => {
  get.mockResolvedValue({
    data: { code: 50000, msg: '服务暂时不可用，请稍后重试', data: null },
  })
  expect(await listProviders()).toMatchObject({
    code: 50000,
    msg: '服务暂时不可用，请稍后重试',
  })
})
