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
  latestClient,
  MockClient,
  Deferred,
} = vi.hoisted(() => {
  const handlers = {}
  const latestClient = {
    current: undefined,
  }
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
      latestClient.current = this
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
      subscribeDestination: vi.fn((destination) => ({
        unsubscribe: vi.fn(),
        destination,
      })),
      store: {
      getters: {
        accessToken: null,
      },
      },
      clientState,
      latestClient,
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

test('stomp connected event is published after queued subscriptions are restored on first connect', async () => {
  const listener = vi.fn()
  const onConnected = vi.fn(() => {
    expect(subscribeDestination).toHaveBeenCalledWith('/topic/helper/logs', expect.any(Function))
  })

  stompModule.onStompConnected(onConnected)
  const unsubscribe = stompModule.subscribe('/topic/helper/logs', listener)

  expect(activate).toHaveBeenCalledTimes(1)
  expect(subscribeDestination).not.toHaveBeenCalled()

  clientState.connected = true
  clientState.onConnect?.({ headers: {} })

  expect(subscribeDestination).toHaveBeenCalledTimes(1)
  expect(onConnected).toHaveBeenCalledTimes(1)
  expect(publish).toHaveBeenCalledWith(
    'stomp:connected',
    expect.objectContaining({ isReconnect: false })
  )

  unsubscribe()
})

test('beforeConnect clears stale token header when access token is missing', async () => {
  store.getters.accessToken = null
  latestClient.current.connectHeaders = { token: 'stale-token', traceId: 'trace-1' }

  await clientState.beforeConnect?.()

  expect(latestClient.current.connectHeaders).toEqual({ traceId: 'trace-1' })
})
