import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const { axiosCreate, axiosInstance, axiosIsCancel, store, toast, i18nService } =
  vi.hoisted(() => {
    const axiosInstance = {
      request: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn(),
        },
      },
    }

    return {
      axiosCreate: vi.fn(() => axiosInstance),
      axiosInstance,
      axiosIsCancel: vi.fn(() => false),
      store: {
        getters: {
          token: null,
        },
        commit: vi.fn(),
        dispatch: vi.fn(),
      },
      toast: {
        error: vi.fn(),
        warning: vi.fn(),
      },
      i18nService: {
        getManager: vi.fn(() => ({
          tCommon: (_key, fallback) => fallback,
          getLocale: vi.fn(() => 'zh-CN'),
        })),
      },
    }
  })

vi.mock('axios', () => ({
  default: {
    create: axiosCreate,
    isCancel: axiosIsCancel,
  },
}))

vi.mock('@/store/storeFacade', () => ({
  store,
}))

vi.mock('@/utils/toast', () => ({
  default: toast,
}))

vi.mock('@/common/i18n', () => ({
  i18nService,
}))

const originalWindow = globalThis.window
const originalDocument = globalThis.document
const originalFileReader = globalThis.FileReader
const validFutureExpiresAt = new Date('2099-01-01T00:00:00Z').getTime()

function installBrowserGlobals() {
  Object.defineProperty(globalThis, 'window', {
    value: {
      location: {
        href: 'https://host.test/app',
        host: 'host.test',
      },
      sessionStorage: {
        getItem: vi.fn(() => null),
      },
      addEventListener: vi.fn(),
    },
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'document', {
    value: {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
    },
    configurable: true,
    writable: true,
  })
}

async function loadHttp() {
  vi.resetModules()
  installBrowserGlobals()
  axiosInstance.request.mockResolvedValue({
    status: 200,
    headers: {},
    data: { code: 0, data: 'ok' },
  })
  return import('../../../../src/utils/http/index.ts')
}

function flushAsyncWork() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.restoreAllMocks()
  axiosCreate.mockImplementation(() => axiosInstance)
  axiosIsCancel.mockReturnValue(false)
  axiosInstance.request.mockReset()
  axiosInstance.post.mockReset()
  axiosInstance.interceptors.request.use.mockReset()
  store.getters.token = null
  store.commit.mockReset()
  store.dispatch.mockReset()
  toast.error.mockReset()
  toast.warning.mockReset()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()

  if (typeof originalWindow === 'undefined') {
    delete globalThis.window
  } else {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    })
  }

  if (typeof originalDocument === 'undefined') {
    delete globalThis.document
  } else {
    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      configurable: true,
      writable: true,
    })
  }

  if (typeof originalFileReader === 'undefined') {
    delete globalThis.FileReader
  } else {
    Object.defineProperty(globalThis, 'FileReader', {
      value: originalFileReader,
      configurable: true,
      writable: true,
    })
  }
})

test.each([false, 0, '', null])(
  'preserves falsy request body %s instead of replacing it with an object',
  async (body) => {
    const { Client } = await loadHttp()

    await Client.request('post', '/api/echo', body, { isSilent: true, skipAuth: true })

    expect(axiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'post',
        url: 'api/echo',
        data: body,
      })
    )
  }
)

test('keeps the historical empty-object default only when request body is undefined', async () => {
  const { Client } = await loadHttp()

  await Client.request('post', '/api/echo', undefined, {
    isSilent: true,
    skipAuth: true,
  })

  expect(axiosInstance.request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: 'post',
      url: 'api/echo',
      data: {},
    })
  )
})

test('keeps public request instance configurable through configAxios', async () => {
  const { configAxios, request } = await loadHttp()
  const configure = vi.fn()

  configAxios(configure)

  expect(request).toBe(axiosInstance)
  expect(configure).toHaveBeenCalledWith(axiosInstance)
  expect(axiosInstance.interceptors.request.use).toHaveBeenCalledTimes(1)
})

test('request interceptor adds language and valid authorization headers', async () => {
  store.getters.token = {
    accessToken: 'access-token',
    expiresAt: validFutureExpiresAt,
  }
  await loadHttp()

  const interceptor = axiosInstance.interceptors.request.use.mock.calls[0][0]
  const config = await interceptor({ headers: {} })

  expect(config.headers).toMatchObject({
    'Accept-Language': 'zh-CN',
    Authorization: 'Bearer access-token',
  })
})

test('getLatestToken waits for refresh already in flight', async () => {
  const oldToken = {
    accessToken: 'old-access-token',
    expiresAt: 0,
    refreshToken: {
      token: 'refresh-token',
      expiresAt: validFutureExpiresAt,
    },
  }
  const newToken = {
    accessToken: 'new-access-token',
    expiresAt: validFutureExpiresAt,
  }
  store.getters.token = oldToken
  store.commit.mockImplementation((type, token) => {
    if (type === 'user/SET_TOKEN') {
      store.getters.token = token
    }
  })

  let resolveRefresh
  axiosInstance.post.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveRefresh = resolve
      })
  )

  const { getLatestToken } = await loadHttp()
  const interceptor = axiosInstance.interceptors.request.use.mock.calls[0][0]
  const interceptedConfig = interceptor({ headers: {} })
  await flushAsyncWork()

  expect(axiosInstance.post).toHaveBeenCalledWith(
    '/api/auth/refresh-token/refresh-token',
    null,
    expect.objectContaining({ skipAuth: true })
  )

  const latestToken = getLatestToken()
  resolveRefresh({ data: { code: 0, data: newToken } })

  await expect(latestToken).resolves.toBe(newToken)
  await expect(interceptedConfig).resolves.toMatchObject({
    headers: {
      'Accept-Language': 'zh-CN',
      Authorization: 'Bearer new-access-token',
    },
  })
})

test('routes get params and upload bodies through the shared axios instance', async () => {
  const { Client } = await loadHttp()

  await Client.get('/api/items', { page: 1 }, { isSilent: true, skipAuth: true })
  await Client.upload(
    '/api/upload',
    { file: 'demo' },
    {
      isSilent: true,
      skipAuth: true,
    }
  )

  expect(axiosInstance.request).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      method: 'get',
      url: 'api/items',
      params: { page: 1 },
    })
  )
  expect(axiosInstance.request).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      method: 'post',
      url: 'api/upload',
      data: { file: 'demo' },
    })
  )
})

test('normalizes legacy response code, message, and array payloads', async () => {
  axiosInstance.request.mockResolvedValueOnce({
    status: 200,
    headers: {},
    data: {
      code: 7,
      message: 'legacy-message',
      data: [{ id: 1 }],
    },
  })
  const { Client } = await loadHttp()

  const response = await Client.get('/api/items', undefined, {
    isSilent: true,
    skipAuth: true,
  })

  expect(response.data).toEqual({
    code: 7,
    status: 7,
    msg: 'legacy-message',
    data: { items: [{ id: 1 }] },
  })
})

test('normalizes top-level items into response data items', async () => {
  axiosInstance.request.mockResolvedValueOnce({
    status: 200,
    headers: {},
    data: {
      code: 0,
      items: [{ id: 2 }],
    },
  })
  const { Client } = await loadHttp()

  const response = await Client.get('/api/items', undefined, {
    isSilent: true,
    skipAuth: true,
  })

  expect(response.data).toEqual({
    code: 0,
    status: 0,
    msg: '',
    data: { items: [{ id: 2 }] },
  })
})

test('keeps legacy normalization for empty successful responses', async () => {
  axiosInstance.request.mockResolvedValueOnce({
    status: 204,
    headers: {},
    data: null,
  })
  const { Client } = await loadHttp()

  const response = await Client.delete('/api/items/1', undefined, {
    isSilent: true,
    skipAuth: true,
  })

  expect(response.data).toEqual({
    code: 0,
    status: 0,
    msg: '',
    data: null,
  })
})

test('returns file metadata for blob attachment responses without forcing save when disabled', async () => {
  const fileContent = new Blob(['demo'], { type: 'text/plain' })
  axiosInstance.request.mockResolvedValueOnce({
    status: 200,
    headers: {
      'content-disposition': 'attachment; filename="demo.txt"',
      'content-type': 'text/plain',
    },
    data: fileContent,
  })
  const { Client } = await loadHttp()

  const response = await Client.get('/api/download', undefined, {
    isSilent: true,
    skipAuth: true,
    noSave: false,
  })

  expect(response.data).toEqual({
    code: 0,
    status: 0,
    msg: '文件下载成功',
    data: {
      fileName: 'demo.txt',
      fileContent,
      fileSize: fileContent.size,
      fileType: 'text/plain',
    },
  })
})

test.each([
  { throwOnError: false, malformed: false },
  { throwOnError: true, malformed: false },
  { throwOnError: false, malformed: true },
  { throwOnError: true, malformed: true },
])('JSON blob failures remain failures with %j', async ({ throwOnError, malformed }) => {
  class MockFileReader {
    onload = null
    onerror = null
    result = ''

    readAsText(file) {
      file
        .text()
        .then((text) => {
          this.result = text
          this.onload?.({ target: this })
        })
        .catch((error) => {
          this.onerror?.(error)
        })
    }
  }
  Object.defineProperty(globalThis, 'FileReader', {
    value: MockFileReader,
    configurable: true,
    writable: true,
  })

  axiosInstance.request.mockResolvedValueOnce({
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
    data: new Blob(
      [
        malformed
          ? '{broken'
          : JSON.stringify({ code: 400, msg: 'blob-error', data: { id: 1 } }),
      ],
      {
        type: 'application/json',
      }
    ),
  })
  const { Client } = await loadHttp()

  const responsePromise = Client.get('/api/download', undefined, {
    skipAuth: true,
    responseType: 'blob',
    noSave: false,
    throwOnError,
  })

  if (throwOnError) {
    await expect(responsePromise).rejects.toThrow(
      malformed ? '下载响应不是有效的 JSON' : 'blob-error'
    )
    expect(axiosInstance.request).toHaveBeenCalledTimes(1)
    return
  }
  const response = await responsePromise

  if (malformed) {
    expect(toast.error).toHaveBeenCalledWith('下载响应不是有效的 JSON')
    expect(response.data.code).toBe(-1)
    expect(response.data.data).toBeNull()
    expect(axiosInstance.request).toHaveBeenCalledTimes(1)
    return
  }

  expect(toast.error).toHaveBeenCalledWith('blob-error')
  expect(response.data).toEqual({
    code: 400,
    status: 400,
    msg: 'blob-error',
    data: { id: 1 },
  })
})

test('logs out on same-origin 401 responses and preserves the error category', async () => {
  axiosInstance.request.mockRejectedValueOnce({
    response: {
      status: 401,
      data: { msg: 'expired' },
      headers: {},
      config: {},
    },
    request: {
      responseURL: 'https://host.test/api/user',
    },
    config: {},
  })
  const { Client } = await loadHttp()

  const response = await Client.get('/api/user', undefined, { isSilent: true })

  expect(toast.warning).toHaveBeenCalledWith('登录已过期，请重新登录')
  expect(store.dispatch).toHaveBeenCalledWith('user/logout', { revoke: false })
  expect(response.data).toEqual({
    code: 401,
    status: 401,
    httpStatus: 401,
    msg: '登录已过期，请重新登录',
    data: null,
  })
})

test('refreshes token and retries once before logging out on same-origin 401 responses', async () => {
  const oldToken = {
    accessToken: 'old-access-token',
    expiresAt: validFutureExpiresAt,
    refreshToken: {
      token: 'refresh-token',
      expiresAt: validFutureExpiresAt,
    },
  }
  const newToken = {
    accessToken: 'new-access-token',
    expiresAt: validFutureExpiresAt,
    refreshToken: {
      token: 'new-refresh-token',
      expiresAt: validFutureExpiresAt,
    },
  }
  store.getters.token = oldToken
  store.commit.mockImplementation((type, token) => {
    if (type === 'user/SET_TOKEN') {
      store.getters.token = token
    }
  })
  axiosInstance.request
    .mockRejectedValueOnce({
      response: {
        status: 401,
        data: { msg: 'expired' },
        headers: {},
        config: {},
      },
      request: {
        responseURL: 'https://host.test/api/user',
      },
      config: {},
    })
    .mockResolvedValueOnce({
      status: 200,
      headers: {},
      data: { code: 0, data: { id: 1 } },
    })
  axiosInstance.post.mockResolvedValueOnce({ data: { code: 0, data: newToken } })
  const { Client } = await loadHttp()

  const response = await Client.get('/api/user', undefined, {
    isSilent: true,
    headers: {
      Authorization: 'Bearer old-access-token',
      'X-Trace-Id': 'trace-1',
    },
  })

  expect(axiosInstance.post).toHaveBeenCalledWith(
    '/api/auth/refresh-token/refresh-token',
    null,
    expect.objectContaining({ skipAuth: true })
  )
  expect(store.commit).toHaveBeenCalledWith('user/SET_TOKEN', newToken)
  expect(store.dispatch).not.toHaveBeenCalledWith('user/logout', { revoke: false })
  expect(axiosInstance.request).toHaveBeenCalledTimes(2)
  expect(axiosInstance.request.mock.calls[1][0].headers).toMatchObject({
    'X-Trace-Id': 'trace-1',
  })
  expect(axiosInstance.request.mock.calls[1][0].headers.Authorization).toBeUndefined()
  expect(axiosInstance.request.mock.calls[1][0].headers.authorization).toBeUndefined()
  expect(response.data).toEqual({
    code: 0,
    status: 0,
    msg: '',
    data: { id: 1 },
  })
})

test('RPC test POST with replay disabled is sent once even when a refresh token exists', async () => {
  const { Client } = await loadHttp()
  store.getters.token = {
    accessToken: 'current-access-token',
    expiresAt: validFutureExpiresAt,
    refreshToken: { token: 'refresh-token', expiresAt: validFutureExpiresAt },
  }
  axiosInstance.request.mockRejectedValueOnce({
    response: { status: 401, data: { msg: 'expired' }, headers: {}, config: {} },
    request: { responseURL: 'https://host.test/api/dev/demo/rpc-model/example/test' },
    config: {},
  })
  const response = await Client.request(
    'post',
    '/api/dev/demo/rpc-model/example/test',
    { revision: 'r1', variables: {}, configValues: {} },
    { isSilent: true, throwOnError: false, authRefreshRetry: true }
  )
  expect(axiosInstance.request).toHaveBeenCalledTimes(1)
  expect(axiosInstance.post).not.toHaveBeenCalled()
  expect(response.data.httpStatus).toBe(401)
})

test('logs out after same-origin 401 when refresh token renewal fails', async () => {
  const oldToken = {
    accessToken: 'old-access-token',
    expiresAt: validFutureExpiresAt,
    refreshToken: {
      token: 'refresh-token',
      expiresAt: validFutureExpiresAt,
    },
  }
  store.getters.token = oldToken
  axiosInstance.request.mockRejectedValueOnce({
    response: {
      status: 401,
      data: { msg: 'expired' },
      headers: {},
      config: {},
    },
    request: {
      responseURL: 'https://host.test/api/user',
    },
    config: {},
  })
  axiosInstance.post.mockResolvedValueOnce({
    data: { code: 401, msg: '登录已过期，请重新登录' },
  })
  const { Client } = await loadHttp()

  const response = await Client.get('/api/user', undefined, { isSilent: true })

  expect(axiosInstance.post).toHaveBeenCalledWith(
    '/api/auth/refresh-token/refresh-token',
    null,
    expect.objectContaining({ skipAuth: true })
  )
  expect(toast.warning).toHaveBeenCalledWith('登录已过期，请重新登录')
  expect(store.dispatch).toHaveBeenCalledWith('user/logout', { revoke: false })
  expect(response.data).toEqual({
    code: 401,
    status: 401,
    httpStatus: 401,
    msg: '登录已过期，请重新登录',
    data: null,
  })
})

test('does not log out on cross-origin 401 responses', async () => {
  axiosInstance.request.mockRejectedValueOnce({
    response: {
      status: 401,
      data: { msg: 'expired' },
      headers: {},
      config: {},
    },
    request: {
      responseURL: 'https://api.other.test/user',
    },
    config: {},
  })
  const { Client } = await loadHttp()

  const response = await Client.get('/api/user', undefined, { isSilent: true })

  expect(store.dispatch).not.toHaveBeenCalledWith('user/logout', { revoke: false })
  expect(response.data).toEqual({
    code: 401,
    status: 401,
    httpStatus: 401,
    msg: '登录已过期，请重新登录',
    data: null,
  })
})

test('throws normalized forbidden errors when throwOnError is enabled', async () => {
  axiosInstance.request.mockRejectedValueOnce({
    response: {
      status: 403,
      data: { msg: 'denied' },
      headers: {},
      config: {},
    },
    request: {
      responseURL: 'https://host.test/api/admin',
    },
    config: {},
  })
  const { Client } = await loadHttp()

  await expect(
    Client.get('/api/admin', undefined, { throwOnError: true })
  ).rejects.toMatchObject({
    message: '无权限',
    response: {
      data: { code: 403, status: 403, httpStatus: 403, msg: '无权限', data: null },
    },
  })

  expect(toast.error).toHaveBeenCalledWith('无权限')
})

test.each([
  { response: { status: 500, data: { code: 50000, msg: '服务暂时不可用，请稍后重试' } } },
  { code: 'ECONNABORTED', message: 'PRIVATE_PROXY_DIAGNOSTIC' },
])(
  '401 followed by a service or transport refresh failure preserves the session',
  async (refreshFailure) => {
    store.getters.token = {
      accessToken: 'access',
      expiresAt: validFutureExpiresAt,
      refreshToken: { token: 'refresh', expiresAt: validFutureExpiresAt },
    }
    const { Client } = await loadHttp()
    axiosInstance.request.mockRejectedValueOnce({
      response: { status: 401, data: {} },
      request: { responseURL: 'https://host.test/api/user' },
    })
    axiosInstance.post.mockRejectedValueOnce(refreshFailure)
    const response = await Client.get('/api/user', {}, { isSilent: true })
    expect(store.dispatch).not.toHaveBeenCalledWith('user/logout', { revoke: false })
    expect(axiosInstance.request).toHaveBeenCalledTimes(1)
    expect(response.data.msg).not.toContain('PRIVATE_PROXY_DIAGNOSTIC')
    if (refreshFailure.response)
      expect(response.data).toMatchObject({ code: 50000, httpStatus: 500 })
  }
)

test('request-time refresh failure aborts before an anonymous request can be sent', async () => {
  store.getters.token = {
    accessToken: 'expired',
    expiresAt: 1,
    refreshToken: { token: 'refresh', expiresAt: validFutureExpiresAt },
  }
  await loadHttp()
  const failure = {
    response: { status: 500, data: { code: 50000, msg: '服务暂时不可用，请稍后重试' } },
  }
  axiosInstance.post.mockRejectedValueOnce(failure)
  const interceptor = axiosInstance.interceptors.request.use.mock.calls[0][0]
  await expect(interceptor({ headers: {} })).rejects.toBe(failure)
  expect(axiosInstance.request).not.toHaveBeenCalled()
  expect(store.dispatch).not.toHaveBeenCalledWith('user/logout', { revoke: false })
})

test.each([
  [{ code: 50000, msg: '服务暂时不可用，请稍后重试', data: null }, 50000],
  ['<html>PRIVATE_PROXY_DIAGNOSTIC</html>', 500],
  [{ message: 'PRIVATE_PROXY_DIAGNOSTIC' }, 500],
])(
  'server failure retains platform codes and hides unstructured diagnostics',
  async (body, code) => {
    const { Client } = await loadHttp()
    axiosInstance.request.mockRejectedValueOnce({ response: { status: 500, data: body } })
    const response = await Client.get('/api/user', {}, { isSilent: true })
    expect(response.data).toMatchObject({
      code,
      httpStatus: 500,
      msg: '服务暂时不可用，请稍后重试',
    })
    expect(toast.error).not.toHaveBeenCalled()
  }
)
