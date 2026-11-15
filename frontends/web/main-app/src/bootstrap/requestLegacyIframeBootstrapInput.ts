import { registerHandler } from '../common/messageEvent'

import { bootstrapLegacyIframeApp } from './bootstrapLegacyIframeApp'

export function requestLegacyIframeBootstrapInput() {
  window.parent.postMessage(
    {
      type: 'request-legacy-iframe-params',
    },
    window.location.origin
  )

  registerHandler('init-legacy-iframe', function (data: any) {
    const { payload } = data
    return bootstrapLegacyIframeApp(payload)
  })
}
