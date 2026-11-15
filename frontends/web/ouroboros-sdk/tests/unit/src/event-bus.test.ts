import { beforeEach, describe, expect, test, vi } from 'vitest'
import * as SDK from '../../../src/main'
import { EventBus as hostEventBus } from '../../../../main-app/src/common/eventBus/index'

global.window = global.window || ({} as Window & typeof globalThis)

describe('宿主注入后的 EventBus 合同', () => {
  beforeEach(async () => {
    hostEventBus.eventsHandlers = {}
    const lifecycle = SDK.initMicroApp({ render: async () => ({}) })
    await lifecycle.mount({ __utils__: { eventBus: hostEventBus } })
  })

  test('支持两参数订阅，并通过同一 handler 取消', () => {
    const handler = vi.fn()
    expect(SDK.EventBus.subscribe('message', handler)).toBeUndefined()
    SDK.EventBus.publish('message', { value: 1 })
    expect(handler).toHaveBeenCalledWith({ value: 1 })
    SDK.EventBus.unsubscribe('message', handler)
    SDK.EventBus.publish('message', { value: 2 })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('第三个参数过滤数据，第二个参数处理匹配事件', () => {
    const handler = vi.fn()
    SDK.EventBus.subscribe('message', handler, (data: { accepted: boolean }) => data.accepted)
    SDK.EventBus.publish('message', { accepted: false })
    expect(handler).not.toHaveBeenCalled()
    SDK.EventBus.publish('message', { accepted: true })
    expect(handler).toHaveBeenCalledExactlyOnceWith({ accepted: true })
  })

  test('一次性订阅只消耗首个匹配事件', () => {
    const handler = vi.fn()
    SDK.EventBus.subscribeOnce('message', handler, (data: number) => data > 0)
    SDK.EventBus.publish('message', 0)
    SDK.EventBus.publish('message', 1)
    SDK.EventBus.publish('message', 2)
    expect(handler).toHaveBeenCalledExactlyOnceWith(1)
  })
})
