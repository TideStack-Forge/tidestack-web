import { getBootstrapMode } from '@/utils'

import { bootstrapHostApp } from './bootstrapHostApp'
import { requestLegacyIframeBootstrapInput } from './requestLegacyIframeBootstrapInput'

export function bootstrap() {
  switch (getBootstrapMode(window.location.href)) {
    case 'legacyIframe':
      return requestLegacyIframeBootstrapInput()
    default:
      return bootstrapHostApp()
  }
}
