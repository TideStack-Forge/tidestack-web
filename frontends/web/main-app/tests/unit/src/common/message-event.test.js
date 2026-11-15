import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const originalWindow = globalThis.window
let messageListener

function installWindow(origin = 'https://host.test') {
  messageListener = undefined
  Object.defineProperty(globalThis, 'window', {
    value: {
      location: { origin },
      addEventListener: vi.fn((eventName, listener) => {
        if (eventName === 'message') {
          messageListener = listener
        }
      }),
    },
    configurable: true,
    writable: true,
  })
}

async function loadMessageEvent(origin) {
  vi.resetModules()
  installWindow(origin)
  return import('../../../../src/common/messageEvent/index.js')
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  if (typeof originalWindow === 'undefined') {
    delete globalThis.window
    return
  }

  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
    writable: true,
  })
})

test('ignores cross-origin messages and does not reuse their source for replies', async () => {
  const { registerHandler, replyToMessageSource, sendMessage } =
    await loadMessageEvent('https://host.test')
  const handler = vi.fn()
  const source = { postMessage: vi.fn() }

  registerHandler('request-legacy-iframe-params', handler)
  messageListener({
    origin: 'https://evil.test',
    source,
    data: { type: 'request-legacy-iframe-params' },
  })
  sendMessage({ type: 'init-legacy-iframe' })
  replyToMessageSource(
    { origin: 'https://evil.test', source },
    { type: 'init-legacy-iframe' }
  )

  expect(handler).not.toHaveBeenCalled()
  expect(source.postMessage).not.toHaveBeenCalled()
})

test('replies to accepted same-origin message sources with an explicit target origin', async () => {
  const { registerHandler, replyToMessageSource, sendMessage } =
    await loadMessageEvent('https://host.test')
  const handler = vi.fn()
  const source = { postMessage: vi.fn() }
  const event = {
    origin: 'https://host.test',
    source,
    data: { type: 'request-legacy-iframe-params' },
  }

  registerHandler('request-legacy-iframe-params', handler)
  messageListener(event)
  sendMessage({ type: 'init-legacy-iframe' })
  replyToMessageSource(event, { type: 'init-legacy-iframe' })

  expect(handler).toHaveBeenCalledWith(event.data, event)
  expect(source.postMessage).toHaveBeenNthCalledWith(
    1,
    { type: 'init-legacy-iframe' },
    'https://host.test'
  )
  expect(source.postMessage).toHaveBeenNthCalledWith(
    2,
    { type: 'init-legacy-iframe' },
    'https://host.test'
  )
})
