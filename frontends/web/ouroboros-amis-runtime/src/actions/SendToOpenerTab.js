import { registerAction } from 'amis-core'
import tabs from '#ouroboros-host/common/tabs'

export class SendToOpenerTab {
  async run(action, renderer, event, data) {
    const msg = action.args && action.args.msg
    const activeTabId = renderer.props.data.activeTabId
    tabs.sendToOpenerTab(activeTabId, msg)
  }
}

registerAction('sendToOpenerTab', new SendToOpenerTab())
