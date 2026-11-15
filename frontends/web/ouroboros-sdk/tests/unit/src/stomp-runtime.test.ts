import { beforeEach, describe, test, expect, vi } from 'vitest'

function createDeferred() {
  let resolve: (() => void) | null = null
  let reject: ((reason?: any) => void) | null = null
  const promise = new Promise<void>((innerResolve, innerReject) => {
    resolve = innerResolve
    reject = innerReject
  })
  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  }
}

async function loadSDK() {
  globalThis.window = globalThis.window || ({} as Window)
  return await import('../../../src/main?test=' + Date.now())
}

function createInjectedStomp() {
  const bootstrapDeferred = createDeferred()
  const subscribeWithInitial = vi.fn().mockImplementation(() => ({
    bootstrapDone: bootstrapDeferred.promise,
    unsubscribe: vi.fn(),
  }))

  return {
    subscribeTopic: vi.fn().mockReturnValue(() => {}),
    subscribeQueue: vi.fn().mockReturnValue(() => {}),
    subscribeUserTopic: vi.fn().mockReturnValue(() => {}),
    subscribe: vi.fn().mockReturnValue(() => {}),
    subscribeWithInitial,
    unsubscribeTopic: vi.fn(),
    unsubscribeQueue: vi.fn(),
    unsubscribeUserTopic: vi.fn(),
    unsubscribe: vi.fn(),
    unsubscribeAll: vi.fn(),
    unsubscribeAllTopics: vi.fn(),
    unsubscribeAllQueues: vi.fn(),
    unsubscribeAllUserTopics: vi.fn(),
    sendBinary: vi.fn().mockResolvedValue(undefined),
    sendText: vi.fn().mockResolvedValue(undefined),
    sendJson: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    reconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    isActive: vi.fn().mockReturnValue(true),
    isStompAuthenticated: vi.fn().mockReturnValue(true),
    onStompConnected: vi.fn().mockReturnValue(() => {}),
    onStompDisconnected: vi.fn().mockReturnValue(() => {}),
    __bootstrapDeferred: bootstrapDeferred,
  }
}

async function injectStomp(SDK: any, stomp: any) {
  globalThis.window = globalThis.window || ({} as Window)
  const lifecycle = SDK.initMicroApp({
    render: async () => ({ app: 'mock-app' }),
  })

  await lifecycle.mount({
    __utils__: {
      stomp,
    },
  })
}

describe('Stomp subscribe initial 运行时行为测试', () => {
  let SDK: any

  beforeEach(async () => {
    vi.restoreAllMocks()
    SDK = await loadSDK()
  })

  test('注入前 subscribe 返回取消函数并保留 initial 选项', () => {
    const unsubscribe = SDK.Stomp.subscribe('/user/queue/app/crm/logs', () => {}, {
      initialBody: {},
    })

    expect(typeof unsubscribe).toBe('function')
  })

  test('注入前取消会阻止后续转发', async () => {
    const unsubscribe = SDK.Stomp.subscribe('/user/queue/app/crm/logs', () => {}, {
      initialBody: {},
    })
    unsubscribe()

    const stomp = createInjectedStomp()
    await injectStomp(SDK, stomp)

    expect(stomp.subscribe).not.toHaveBeenCalled()
  })

  test('注入后会按现有活绑定机制转发到真实实现', async () => {
    const unsubscribe = SDK.Stomp.subscribe('/user/queue/app/crm/logs', () => {}, {
      initialBody: { since: 'latest' },
    })

    const stomp = createInjectedStomp()
    await injectStomp(SDK, stomp)

    expect(stomp.subscribe).toHaveBeenCalledTimes(1)
    expect(stomp.subscribe.mock.calls[0]).toEqual([
      '/user/queue/app/crm/logs',
      expect.any(Function),
      expect.objectContaining({
        initialBody: { since: 'latest' },
      }),
    ])

    unsubscribe()
  })
})

describe('Stomp subscribeWithInitial 兼容行为测试', () => {
  let SDK: any

  beforeEach(async () => {
    vi.restoreAllMocks()
    SDK = await loadSDK()
  })

  test('兼容 helper init/live 合同仍然返回 bootstrapDone 句柄', async () => {
    const handle = SDK.Stomp.subscribeWithInitial('/user/queue/app/crm/helper/logs', () => {}, {
      initialBody: {},
    })

    expect(handle).toBeDefined()
    expect(typeof handle.unsubscribe).toBe('function')
    expect(handle.bootstrapDone).toBeInstanceOf(Promise)

    handle.unsubscribe()
    await expect(handle.bootstrapDone).rejects.toThrow('subscribeWithInitial 已取消')
  })

  test('helper init/live 选项在注入后会转发到真实 subscribeWithInitial 实现', async () => {
    const handle = SDK.Stomp.subscribeWithInitial('/user/queue/app/crm/helper/logs', () => {}, {
      initialBody: { since: 'latest' },
    })

    const stomp = createInjectedStomp()
    await injectStomp(SDK, stomp)

    expect(stomp.subscribeWithInitial).toHaveBeenCalledTimes(1)
    expect(stomp.subscribeWithInitial).toHaveBeenCalledWith(
      '/user/queue/app/crm/helper/logs',
      expect.any(Function),
      expect.objectContaining({
        initialBody: { since: 'latest' },
      })
    )

    handle.unsubscribe()
  })
})

describe('Stomp 运行时行为测试', () => {
  let SDK: any

  beforeEach(async () => {
    vi.restoreAllMocks()
    SDK = await loadSDK()
  })

  test('订阅方法返回取消订阅函数', () => {
    const unsubscribe = SDK.Stomp.subscribeTopic('test', () => {})
    expect(typeof unsubscribe).toBe('function')

    const unsubscribe2 = SDK.Stomp.subscribeQueue('test', () => {})
    expect(typeof unsubscribe2).toBe('function')

    const unsubscribe3 = SDK.Stomp.subscribeUserTopic('test', () => {})
    expect(typeof unsubscribe3).toBe('function')

    const unsubscribe4 = SDK.Stomp.subscribe('test', () => {})
    expect(typeof unsubscribe4).toBe('function')
  })

  test('取消订阅函数可以安全调用', () => {
    const unsubscribe = SDK.Stomp.subscribeTopic('test', () => {})
    expect(() => unsubscribe()).not.toThrow()
  })

  test('未注入时非订阅方法触发 console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    SDK.Stomp.unsubscribeTopic('test')
    expect(warnSpy).toHaveBeenCalledWith('Stomp 尚未注入，unsubscribeTopic 调用被忽略')

    SDK.Stomp.send('test', {})
    expect(warnSpy).toHaveBeenCalledWith('Stomp 尚未注入，send 调用被忽略')

    SDK.Stomp.connect()
    expect(warnSpy).toHaveBeenCalledWith('Stomp 尚未注入，connect 调用被忽略')

    warnSpy.mockRestore()
  })
})

describe('Stomp 状态检查方法测试', () => {
  let SDK: any

  beforeEach(async () => {
    vi.restoreAllMocks()
    SDK = await loadSDK()
  })

  test('状态检查方法返回 boolean 值', () => {
    const isConnected = SDK.Stomp.isConnected()
    expect(typeof isConnected).toBe('boolean')
    expect(isConnected).toBe(false)

    const isActive = SDK.Stomp.isActive()
    expect(typeof isActive).toBe('boolean')
    expect(isActive).toBe(false)

    const isAuthenticated = SDK.Stomp.isStompAuthenticated()
    expect(typeof isAuthenticated).toBe('boolean')
    expect(isAuthenticated).toBe(false)
  })
})

describe('Stomp 事件订阅方法测试', () => {
  let SDK: any

  beforeEach(async () => {
    vi.restoreAllMocks()
    SDK = await loadSDK()
  })

  test('事件订阅方法返回取消订阅函数', () => {
    const unsubscribe1 = SDK.Stomp.onStompConnected(() => {})
    expect(typeof unsubscribe1).toBe('function')

    const unsubscribe2 = SDK.Stomp.onStompDisconnected(() => {})
    expect(typeof unsubscribe2).toBe('function')
  })

  test('取消订阅函数可以安全调用', () => {
    const unsubscribe = SDK.Stomp.onStompConnected(() => {})
    expect(() => unsubscribe()).not.toThrow()
  })
})
