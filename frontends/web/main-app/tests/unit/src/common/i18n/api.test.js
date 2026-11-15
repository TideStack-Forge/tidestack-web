import { expect, test, vi } from 'vitest'

import { I18nApi } from '../../../../../src/common/i18n/api.ts'

test('i18n bootstrap requests bypass auth logout redirects on login routes', async () => {
  const httpClient = {
    get: vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          data: {
            items: [{ label: '简体中文', value: 'zh-CN', isDefault: true }],
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            locale: 'zh-CN',
            name: '简体中文',
            version: '1.0.0',
            enabled: true,
            isDefault: true,
            direction: 'LTR',
            messages: {},
          },
        },
      }),
  }

  const api = new I18nApi(httpClient)

  await expect(api.getLanguages()).resolves.toEqual([
    { label: '简体中文', value: 'zh-CN', isDefault: true },
  ])
  await expect(api.getLocale('zh-CN')).resolves.toMatchObject({
    locale: 'zh-CN',
    direction: 'LTR',
  })

  expect(httpClient.get).toHaveBeenNthCalledWith(
    1,
    '/api/i18n/languages',
    {},
    { isSilent: true, skipAuth: true }
  )
  expect(httpClient.get).toHaveBeenNthCalledWith(
    2,
    '/api/i18n/locale/zh-CN',
    {},
    { isSilent: true, skipAuth: true }
  )
})
