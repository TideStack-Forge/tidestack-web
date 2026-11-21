import { expect, test, vi } from 'vitest'
const messaging = vi.hoisted(() => ({
  subscribeWithInitial: vi.fn(),
  onStompDisconnected: vi.fn(),
}))
vi.mock('#ouroboros-host/utils/Stomp', () => messaging)
import { platformCollaborationTransport } from 'ouroboros-amis-runtime/collaboration/platformTransport'

test('reuses the shared STOMP bootstrap subscription and releases both subscriptions', async () => {
  const unsubscribe = vi.fn(),
    disconnected = vi.fn(),
    bootstrapDone = Promise.resolve()
  messaging.subscribeWithInitial.mockReturnValue({ unsubscribe, bootstrapDone })
  messaging.onStompDisconnected.mockReturnValue(disconnected)
  const transport = platformCollaborationTransport('app', 'canvas', vi.fn())
  const listener = vi.fn(),
    failed = vi.fn(),
    subscription = transport.subscribe(listener, failed)
  expect(messaging.subscribeWithInitial).toHaveBeenCalledWith(
    '/user/queue/app/app/collaboration/canvas',
    listener,
    expect.objectContaining({ keepSingleListener: false })
  )
  messaging.onStompDisconnected.mock.calls.at(-1)[0]()
  expect(failed.mock.calls.at(-1)[0]).toBeInstanceOf(Error)
  await subscription.bootstrapDone
  subscription.unsubscribe()
  expect(unsubscribe).toHaveBeenCalledOnce()
  expect(disconnected).toHaveBeenCalledOnce()
})

test('uses the platform HTTP envelope and propagates rejected durable writes', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue({
      data: { code: 0, data: { kind: 'bootstrap', writable: true, documents: [] } },
    })
  const transport = platformCollaborationTransport('app', 'canvas', fetcher)
  expect((await transport.request('')).writable).toBe(true)
  expect(fetcher).toHaveBeenCalledWith({
    method: 'get',
    url: '/api/dev/app/collaboration/canvas',
  })
  fetcher.mockResolvedValue({ ok: false, msg: '无编辑权限' })
  await expect(transport.request('/overview/updates', { id: 'op' })).rejects.toThrow(
    '无编辑权限'
  )
  expect(fetcher).toHaveBeenLastCalledWith({
    method: 'post',
    url: '/api/dev/app/collaboration/canvas/overview/updates',
    data: { id: 'op' },
  })
})
