import { initLegacyIframe } from '@/initLegacyIframe.js'
import { registerHandler } from './common/messageEvent'

export async function initLegacyIframeFun() {
  // 向主窗口发送消息，获取路由和token
  window.parent.postMessage(
    {
      type: 'request-legacy-iframe-params',
    },
    window.location.origin
  )
  // legacyIframe初始化
  registerHandler('init-legacy-iframe', function (data) {
    const { payload } = data
    initLegacyIframe(payload)
  })
}
