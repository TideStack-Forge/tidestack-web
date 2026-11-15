import { expect, test, vi } from 'vitest'

const { patch } = vi.hoisted(() => ({
  patch: vi.fn().mockResolvedValue({
    data: {
      code: 0,
      status: 0,
      msg: 'ok',
      data: null,
    },
  }),
}))

vi.mock('@/utils/http', () => ({
  Client: {
    patch,
  },
}))

import userApi from '../../../../../src/common/api/user.ts'

test('saveUserWidth persists the sidebar width through the existing user-setting contract', async () => {
  await expect(userApi.saveUserWidth('sidebar-width', 280)).resolves.toEqual({
    code: 0,
    status: 0,
    msg: 'ok',
    data: null,
  })

  expect(patch).toHaveBeenCalledWith(
    '/api/user-setting',
    {
      settingName: 'sidebar-width',
      settingValue: 280,
      isAutoLoad: true,
    },
    {
      isSilent: true,
    }
  )
})
