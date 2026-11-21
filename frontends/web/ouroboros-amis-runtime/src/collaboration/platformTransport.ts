import { subscribeWithInitial, onStompDisconnected } from '#ouroboros-host/utils/Stomp'
import type { CollaborationMessage, CollaborationTransport } from './YjsWorkspace'

type ApiEnvelope = {
  ok?: boolean
  code?: number
  status?: number
  msg?: string
  data?: unknown
}

export function platformCollaborationTransport(
  appName: string,
  type: string,
  fetcher: (api: {
    method: 'get' | 'post'
    url: string
    data?: Record<string, unknown>
  }) => Promise<unknown>
): CollaborationTransport {
  const app = encodeURIComponent(appName),
    resource = encodeURIComponent(type)
  return {
    subscribe(listener: (message: CollaborationMessage) => void, failed) {
      const disconnected = onStompDisconnected(() =>
        failed(new Error('协同连接已断开，正在重新连接'))
      )
      const subscription = subscribeWithInitial(
        `/user/queue/app/${app}/collaboration/${resource}`,
        listener,
        {
          keepSingleListener: false,
          onInitialError: () => failed(new Error('无法加入协同，请检查应用访问权限')),
        }
      )
      return {
        get bootstrapDone() {
          return subscription.bootstrapDone
        },
        unsubscribe() {
          disconnected()
          subscription.unsubscribe()
        },
      }
    },
    async request(path, data) {
      const response = (await fetcher({
        method: data === undefined ? 'get' : 'post',
        url: `/api/dev/${app}/collaboration/${resource}${path}`,
        ...(data === undefined ? {} : { data }),
      })) as ApiEnvelope
      const envelope =
        response?.data &&
        typeof response.data === 'object' &&
        ('code' in response.data || 'status' in response.data)
          ? (response.data as ApiEnvelope)
          : response
      if (
        envelope?.ok === false ||
        (typeof envelope?.code === 'number' && envelope.code !== 0) ||
        (typeof envelope?.status === 'number' && envelope.status !== 0)
      )
        throw new Error(envelope.msg || '协同同步失败')
      if (!envelope?.data) throw new Error('协同服务返回无效数据')
      return envelope.data
    },
  }
}
