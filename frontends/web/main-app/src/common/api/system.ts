import { Client } from '@/utils/http'
import type { ApiResponse } from '@/utils/http'
import { classifyStartupProbe } from './startupProbe'
import type { StartupProbeResult } from './startupProbe'

const systemApi = {
  /**
   * 获取 web 应用信息
   * 成功返回标准对象；失败返回 false（保持你的原语义）
   */
  async getAppInfo(): Promise<ApiResponse | false> {
    const { data } = await Client.get('/api/sys/web-app-info', {}, { isSilent: true })
    if (data?.code !== 0) {
      return false
    }
    return data.data
  },

  async getAppStartupProbe(): Promise<StartupProbeResult> {
    try {
      const response = await Client.get('/api/sys/web-app-info', {}, { isSilent: true })
      return classifyStartupProbe(response)
    } catch (error: any) {
      return classifyStartupProbe(error?.response || false)
    }
  },

  /**
   * 获取消息通知数量
   * 统一返回标准对象 { code, status, msg, data }
   */
  async getNotificationNumbers(): Promise<ApiResponse> {
    const res = await Client.get(
      '/api/notification/unread-count',
      {
        type: '1',
        receiver: 'PC',
        state: 0,
        channelName: 'internal-message',
      },
      { isSilent: true }
    )
    return res.data
  },
}

export default systemApi
