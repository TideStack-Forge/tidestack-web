import { expect, test, vi } from 'vitest'

vi.mock('@/common/i18n', () => ({
  i18nService: {
    getManager: () => ({ tCommon: (key) => `translated:${key}` }),
  },
}))

const { extractErrorMessage } =
  await import('../../../../../src/utils/http/responseUtils.ts')

test.each([
  [{ code: 'ECONNABORTED' }, 'http.timeout'],
  [{ response: { status: 401 } }, 'auth.sessionExpired'],
  [{ response: { status: 403 } }, 'http.forbidden'],
  [{ response: { status: 503 } }, 'http.unavailable'],
  [{}, 'http.networkError'],
  [{ response: { status: 400 } }, 'http.requestFailed'],
])('translates local HTTP fallback for %j', (error, key) => {
  expect(extractErrorMessage(error)).toBe(`translated:${key}`)
})

test('preserves a server-supplied error message', () => {
  expect(
    extractErrorMessage({ response: { data: { code: 1, msg: 'Server detail' } } })
  ).toBe('Server detail')
})
