import { registerAction } from 'amis-core'
import { EventBus } from '#ouroboros-host/common/eventBus'
export class PublishEvent {
  async run({ args = {} }) {
    const { eventName, eventData, options } = args
    if (!eventName) return
    EventBus.publish(eventName, eventData, options)
  }
}

registerAction('publish', new PublishEvent())
