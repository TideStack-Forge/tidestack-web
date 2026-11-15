import { beforeEach, expect, test, vi } from 'vitest'

import {
  createMicroEntryFetch,
  ensureSameOriginMicroEntryIsSafe,
  resetMicroEntryHealthCache,
} from '../../../../../src/common/micro/entryGuard.js'

const MOTHERSHIP_HTML = `<!doctype html>
<html>
  <head><meta name="app-name" content="ouroboros-mothership-app" /></head>
  <body><div id="mothership-app-root"></div></body>
</html>`

function createResponse(body, contentType = 'text/html', ok = true) {
  return {
    ok,
    status: ok ? 200 : 404,
    headers: {
      get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null),
    },
    clone: () => createResponse(body, contentType, ok),
    text: vi.fn(async () => body),
  }
}

beforeEach(() => {
  resetMicroEntryHealthCache()
  Object.defineProperty(globalThis, 'window', {
    value: {
      location: {
        origin: 'http://host.test',
      },
      fetch: vi.fn(),
    },
    configurable: true,
    writable: true,
  })
})

test('ensureSameOriginMicroEntryIsSafe rejects entries that fall back to the host shell', async () => {
  window.fetch.mockResolvedValue(createResponse(MOTHERSHIP_HTML))

  await expect(ensureSameOriginMicroEntryIsSafe('/missing-micro/')).rejects.toMatchObject({
    isUnsafeMicroEntry: true,
  })
  await expect(ensureSameOriginMicroEntryIsSafe('/missing-micro/')).rejects.toMatchObject({
    isUnsafeMicroEntry: true,
  })

  expect(window.fetch).toHaveBeenCalledTimes(1)
})

test('createMicroEntryFetch rejects same-origin script assets that fall back to the host shell', async () => {
  const baseFetch = vi.fn(async () => createResponse(MOTHERSHIP_HTML))
  const guardedFetch = createMicroEntryFetch(baseFetch)

  await expect(guardedFetch('/static/js/missing.js')).rejects.toMatchObject({
    isUnsafeMicroEntry: true,
  })

  expect(baseFetch).toHaveBeenCalledWith('/static/js/missing.js', undefined)
})

test('createMicroEntryFetch leaves external resources to their native loader path', async () => {
  const response = createResponse(MOTHERSHIP_HTML)
  const baseFetch = vi.fn(async () => response)
  const guardedFetch = createMicroEntryFetch(baseFetch)

  await expect(guardedFetch('https://cdn.example.com/micro.js')).resolves.toBe(response)
})

test('createMicroEntryFetch allows same-origin non-host html entries', async () => {
  const html = '<!doctype html><html><body><div id="micro-root"></div></body></html>'
  const response = createResponse(html)
  const baseFetch = vi.fn(async () => response)
  const guardedFetch = createMicroEntryFetch(baseFetch)

  await expect(guardedFetch('/micro-app/')).resolves.toBe(response)
})
