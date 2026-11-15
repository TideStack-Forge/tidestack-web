// @ts-ignore
import '@/style/index.scss'

import './icons/svgIcon'

import '@/common/eventBus/subscribers/replayEvents'
import '@/common/eventBus/subscribers'
import { EventBus } from '@/common/eventBus'
import { initDevTools } from './dev-tools'

export function initializeMainAppEntry() {
  if (process.env.PLAYWRIGHT_HARNESS !== 'true') {
    initDevTools()
  }

  EventBus.publish('SYS_INIT_BOOTSTRAP', null)
}
