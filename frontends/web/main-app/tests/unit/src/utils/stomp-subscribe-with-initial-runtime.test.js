import { beforeEach, expect, test, vi } from 'vitest'

const {
  publish,
  subscribeEvent,
  unsubscribeEvent,
  activate,
  deactivate,
  publishMessage,
  subscribeDestination,
  store,
  clientState,
  MockClient,
  Deferred,
  subscriptions,
} = vi.hoisted(() => {
  const handlers = {}
  const subscriptions = {}
  const clientState = {
    connected: false,
    active: false,
    beforeConnect: undefined,
    onConnect: undefined,
    onWebSocketClose: undefined,
    onStompError: undefined,
    onDisconnect: undefined,
  }

  class Deferred {
    constructor() {
      this.promise = new Promise((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
      })
    }
  }

  class MockClient {
    constructor() {
      this.connectHeaders = {}
    }

    get connected() {
      return clientState.connected
    }

    set connected(value) {
      clientState.connected = value
    }

    get active() {
      return clientState.active
    }

    set active(value) {
      clientState.active = value
    }

    get beforeConnect() {
      return clientState.beforeConnect
    }

    set beforeConnect(value) {
      clientState.beforeConnect = value
    }

    get onConnect() {
      return clientState.onConnect
    }

    set onConnect(value) {
      clientState.onConnect = value
    }

    get onWebSocketClose() {
      return clientState.onWebSocketClose
    }

    set onWebSocketClose(value) {
      clientState.onWebSocketClose = value
    }

    get onStompError() {
      return clientState.onStompError
    }

    set onStompError(value) {
      clientState.onStompError = value
    }

    get onDisconnect() {
      return clientState.onDisconnect
    }

    set onDisconnect(value) {
      clientState.onDisconnect = value
    }

    activate = activate
    deactivate = deactivate
    publish = publishMessage
    subscribe = subscribeDestination
  }

  return {
    publish: vi.fn((event, payload) => {
      const listeners = handlers[event] || []
      listeners.forEach((listener) => listener(payload))
    }),
    subscribeEvent: vi.fn((event, handler) => {
      handlers[event] = handlers[event] || []
      handlers[event].push(handler)
    }),
    unsubscribeEvent: vi.fn((event, handler) => {
      handlers[event] = (handlers[event] || []).filter((item) => item !== handler)
    }),
    activate: vi.fn(function () {
      clientState.active = true
    }),
    deactivate: vi.fn(async function () {
      clientState.active = false
      clientState.connected = false
    }),
    publishMessage: vi.fn(),
    subscribeDestination: vi.fn((destination, callback) => {
      subscriptions[destination] = callback
      return {
        unsubscribe: vi.fn(() => {
          delete subscriptions[destination]
        }),
        destination,
      }
    }),
    store: {
      getters: {
        accessToken: null,
      },
    },
    subscriptions,
    clientState,
    MockClient,
    Deferred,
  }
})

vi.mock('@/common/eventBus', () => ({
  EventBus: {
    publish,
    subscribe: subscribeEvent,
    unsubscribe: unsubscribeEvent,
  },
}))

vi.mock('@/store/storeFacade', () => ({
  store,
}))

vi.mock('@/utils/Deferred', () => ({
  Deferred,
}))

vi.mock('sockjs-client', () => ({
  default: vi.fn(),
}))

vi.mock('@stomp/stompjs', async () => {
  const actual = await vi.importActual('@stomp/stompjs')
  return {
    ...actual,
    Client: MockClient,
  }
})

const stompModule = await import('../../../../../src/utils/Stomp.ts')

function readBootstrapRequestBody(call) {
  return JSON.parse(call[0].body)
}

function readBootstrapRequestHeaders(call) {
  return call[0].headers
}

function emitRaw(destination, rawMessage) {
  subscribeDestination.mock.calls
    .filter(([currentDestination]) => currentDestination === destination)
    .forEach(([, callback]) => callback(rawMessage))
}

beforeEach(async () => {
  activate.mockClear()
  deactivate.mockClear()
  publishMessage.mockClear()
  subscribeDestination.mockClear()
  publish.mockClear()
  subscribeEvent.mockClear()
  unsubscribeEvent.mockClear()
  clientState.connected = false
  clientState.active = false
  await stompModule.disconnect(true)
})

test('subscribeWithInitial subscribes live lane, then init queue, then sends request', async () => {
  clientState.connected = true
  clientState.active = true

  const listener = vi.fn()

  const handle = stompModule.subscribeWithInitial('/user/queue/app/crm/logs', listener, {
    initialBody: { limit: 10 },
    onInitialComplete: vi.fn(),
    onInitialError: vi.fn(),
  })

  handle.bootstrapDone.catch(() => undefined)

  expect(handle).toHaveProperty('bootstrapDone')
  expect(handle).toHaveProperty('unsubscribe')
  expect(subscribeDestination).toHaveBeenNthCalledWith(
    1,
    '/user/queue/app/crm/logs',
    expect.any(Function)
  )
  expect(subscribeDestination).toHaveBeenNthCalledWith(
    2,
    expect.stringMatching(/^\/queue\/init\/user\/queue\/app\/crm\/logs\/.+$/),
    expect.any(Function)
  )
  expect(publishMessage).toHaveBeenCalledTimes(1)
  expect(publishMessage).toHaveBeenCalledWith(
    expect.objectContaining({ destination: '/app/user/queue/app/crm/logs/init' })
  )
  expect(readBootstrapRequestBody(publishMessage.mock.calls[0])).toEqual({ limit: 10 })
  expect(readBootstrapRequestHeaders(publishMessage.mock.calls[0])).toEqual(
    expect.objectContaining({ subscriptionToken: expect.any(String) })
  )

  handle.unsubscribe()
})

test('subscribeWithInitial routes live and init-data through the default listener', async () => {
  clientState.connected = true
  clientState.active = true

  const listener = vi.fn()
  const onInitialComplete = vi.fn()

  const handle = stompModule.subscribeWithInitial('/user/queue/app/crm/logs', listener, {
    createInitialRequest: () => ({ limit: 2 }),
    onInitialComplete,
  })

  const token = readBootstrapRequestHeaders(
    publishMessage.mock.calls[0]
  ).subscriptionToken

  emitRaw('/user/queue/app/crm/logs', {
    headers: {},
    body: 'live-line',
  })

  emitRaw(`/queue/init/user/queue/app/crm/logs/${token}`, {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'init-data',
      subscriptionToken: token,
      payload: 'boot-line',
    }),
  })

  expect(listener).toHaveBeenCalledWith('live-line', expect.any(Object))
  expect(listener).toHaveBeenCalledWith('boot-line', expect.any(Object))

  emitRaw(`/queue/init/user/queue/app/crm/logs/${token}`, {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'init-complete',
      subscriptionToken: token,
      payload: null,
    }),
  })

  await expect(handle.bootstrapDone).resolves.toBeUndefined()
  expect(onInitialComplete).toHaveBeenCalledWith(null, expect.any(Object))

  emitRaw('/user/queue/app/crm/logs', {
    headers: {},
    body: 'post-bootstrap-live-line',
  })

  expect(listener).toHaveBeenCalledWith('post-bootstrap-live-line', expect.any(Object))
  handle.unsubscribe()
})

test('subscribeWithInitial can split live and init-data handlers when enabled', async () => {
  clientState.connected = true
  clientState.active = true

  const listener = vi.fn()
  const onLive = vi.fn()
  const onInitialData = vi.fn()

  const handle = stompModule.subscribeWithInitial('/user/queue/app/crm/logs', listener, {
    splitInitialHandlers: true,
    onInitialLive: onLive,
    onInitialData,
  })

  const token = readBootstrapRequestHeaders(
    publishMessage.mock.calls[0]
  ).subscriptionToken

  emitRaw('/user/queue/app/crm/logs', {
    headers: {},
    body: 'live-line',
  })

  emitRaw(`/queue/init/user/queue/app/crm/logs/${token}`, {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'init-data',
      subscriptionToken: token,
      payload: 'boot-line',
    }),
  })

  expect(onLive).toHaveBeenCalledWith('live-line', expect.any(Object))
  expect(onInitialData).toHaveBeenCalledWith('boot-line', expect.any(Object))
  expect(listener).not.toHaveBeenCalled()

  handle.unsubscribe()
})

test('subscribeWithInitial rejects on init-error and timeout', async () => {
  clientState.connected = true
  clientState.active = true
  vi.useFakeTimers()

  const onBootstrapError = vi.fn()
  const errorHandle = stompModule.subscribeWithInitial(
    '/user/queue/app/crm/logs',
    vi.fn(),
    {
      initialTimeoutMs: 5,
      onInitialError: onBootstrapError,
    }
  )
  errorHandle.bootstrapDone.catch(() => undefined)

  const errorToken = readBootstrapRequestHeaders(
    publishMessage.mock.calls[0]
  ).subscriptionToken
  const errorListener = subscribeDestination.mock.calls.find(
    ([destination]) => destination === `/queue/init/user/queue/app/crm/logs/${errorToken}`
  )[1]

  errorListener({
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'init-error',
      subscriptionToken: errorToken,
      payload: 'boom',
    }),
  })

  await expect(errorHandle.bootstrapDone).rejects.toThrow('init-error')
  expect(onBootstrapError).toHaveBeenCalledWith('boom', expect.any(Object))
  expect(subscriptions['/user/queue/app/crm/logs']).toBeUndefined()
  expect(subscriptions[`/queue/init/user/queue/app/crm/logs/${errorToken}`]).toBeUndefined()

  const timeoutHandle = stompModule.subscribeWithInitial(
    '/user/queue/app/crm/logs',
    vi.fn(),
    {
      initialTimeoutMs: 1,
    }
  )
  timeoutHandle.bootstrapDone.catch(() => undefined)

  await vi.advanceTimersByTimeAsync(2)
  await expect(timeoutHandle.bootstrapDone).rejects.toThrow('超时')
  const timeoutToken = readBootstrapRequestHeaders(
    publishMessage.mock.calls[1]
  ).subscriptionToken
  expect(subscriptions['/user/queue/app/crm/logs']).toBeUndefined()
  expect(subscriptions[`/queue/init/user/queue/app/crm/logs/${timeoutToken}`]).toBeUndefined()

  errorHandle.unsubscribe()
  timeoutHandle.unsubscribe()
  vi.useRealTimers()
})

test('subscribeWithInitial rejects malformed init destinations immediately', () => {
  const invalidDestinations = [
    '/app/app/../logs/init',
    '/app/app/crm\\logs/init',
    '/app/app/crm logs/init',
  ]

  invalidDestinations.forEach((initialDestination) => {
    expect(() =>
      stompModule.subscribeWithInitial('/user/queue/app/crm/logs', vi.fn(), {
        initialDestination,
      })
    ).toThrow('合法的 init destination')
  })
})

test('subscribeWithInitial derives helper bootstrap queue from the shared init destination contract', () => {
  clientState.connected = true
  clientState.active = true

  const handle = stompModule.subscribeWithInitial(
    '/user/queue/app/crm/helper/logs',
    vi.fn(),
    {
      initialBody: { since: 'latest' },
    }
  )

  handle.bootstrapDone.catch(() => undefined)

  expect(subscribeDestination).toHaveBeenNthCalledWith(
    1,
    '/user/queue/app/crm/helper/logs',
    expect.any(Function)
  )
  expect(subscribeDestination).toHaveBeenNthCalledWith(
    2,
    expect.stringMatching(/^\/queue\/init\/user\/queue\/app\/crm\/helper\/logs\/.+$/),
    expect.any(Function)
  )
  expect(publishMessage).toHaveBeenCalledWith(
    expect.objectContaining({ destination: '/app/user/queue/app/crm/helper/logs/init' })
  )
  expect(readBootstrapRequestBody(publishMessage.mock.calls[0])).toEqual({
    since: 'latest',
  })
  expect(readBootstrapRequestHeaders(publishMessage.mock.calls[0])).toEqual(
    expect.objectContaining({ subscriptionToken: expect.any(String) })
  )

  handle.unsubscribe()
})

test('subscribeWithInitial keeps explicit initialDestination override while deriving reply lane from live destination', () => {
  clientState.connected = true
  clientState.active = true

  const handle = stompModule.subscribeWithInitial('/user/queue/app/crm/logs', vi.fn(), {
    initialDestination: '/app/app/crm/logs/init',
    initialBody: { limit: 1 },
  })

  handle.bootstrapDone.catch(() => undefined)

  expect(subscribeDestination).toHaveBeenNthCalledWith(
    2,
    expect.stringMatching(/^\/queue\/init\/user\/queue\/app\/crm\/logs\/.+$/),
    expect.any(Function)
  )
  expect(publishMessage).toHaveBeenCalledWith(
    expect.objectContaining({ destination: '/app/app/crm/logs/init' })
  )

  handle.unsubscribe()
})

test('subscribeWithInitial ignores stale init frames after reconnect and starts a fresh cycle', async () => {
  vi.useFakeTimers()
  clientState.connected = false
  clientState.active = true

  const listener = vi.fn()
  const onInitialComplete = vi.fn()

  const handle = stompModule.subscribeWithInitial('/user/queue/app/crm/logs', listener, {
    onInitialComplete,
    initialTimeoutMs: 50,
  })

  handle.bootstrapDone.catch(() => undefined)

  clientState.connected = true
  clientState.onConnect?.({ headers: {} })

  const firstToken = readBootstrapRequestHeaders(
    publishMessage.mock.calls[0]
  ).subscriptionToken
  const firstBootstrapListener = subscribeDestination.mock.calls.find(
    ([destination]) => destination === `/queue/init/user/queue/app/crm/logs/${firstToken}`
  )[1]

  const reconnectPromise = stompModule.reconnect()
  clientState.connected = true
  clientState.onConnect?.({ headers: {} })
  await reconnectPromise

  const secondToken = readBootstrapRequestHeaders(
    publishMessage.mock.calls[1]
  ).subscriptionToken
  expect(secondToken).not.toBe(firstToken)

  firstBootstrapListener({
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'init-data',
      subscriptionToken: firstToken,
      payload: 'stale-line',
    }),
  })

  expect(listener).not.toHaveBeenCalledWith('stale-line', expect.any(Object))

  const secondBootstrapListener = subscribeDestination.mock.calls.find(
    ([destination]) => destination === `/queue/init/user/queue/app/crm/logs/${secondToken}`
  )[1]
  secondBootstrapListener({
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'init-complete',
      subscriptionToken: secondToken,
      payload: null,
    }),
  })

  await expect(handle.bootstrapDone).resolves.toBeUndefined()
  expect(onInitialComplete).toHaveBeenCalledTimes(1)

  handle.unsubscribe()
  vi.useRealTimers()
})

test('subscribeWithInitial rejects when unsubscribed before completion', async () => {
  clientState.connected = true
  clientState.active = true

  const handle = stompModule.subscribeWithInitial('/user/queue/app/crm/logs', vi.fn(), {
    initialTimeoutMs: 50,
  })

  handle.bootstrapDone.catch(() => undefined)
  handle.unsubscribe()

  await expect(handle.bootstrapDone).rejects.toThrow('已取消')
})

test('subscribeWithInitial does not send cached bootstrap request after unsubscribe before first connect', async () => {
  clientState.connected = false
  clientState.active = false

  const handle = stompModule.subscribeWithInitial('/user/queue/app/crm/logs', vi.fn(), {
    initialTimeoutMs: 50,
  })

  expect(publishMessage).not.toHaveBeenCalled()

  handle.bootstrapDone.catch(() => undefined)
  handle.unsubscribe()
  await expect(handle.bootstrapDone).rejects.toThrow('已取消')

  clientState.connected = true
  clientState.onConnect?.({ headers: {} })

  expect(publishMessage).not.toHaveBeenCalled()
})

test('subscribe with initial options still drives the bootstrap cycle', async () => {
  clientState.connected = true
  clientState.active = true

  const listener = vi.fn()

  const unsubscribe = stompModule.subscribe('/user/queue/app/crm/logs', listener, {
    initialBody: {},
  })

  expect(typeof unsubscribe).toBe('function')
  expect(subscribeDestination).toHaveBeenNthCalledWith(
    1,
    '/user/queue/app/crm/logs',
    expect.any(Function)
  )
  expect(subscribeDestination).toHaveBeenNthCalledWith(
    2,
    expect.stringMatching(/^\/queue\/init\/user\/queue\/app\/crm\/logs\/.+$/),
    expect.any(Function)
  )

  unsubscribe()
})
