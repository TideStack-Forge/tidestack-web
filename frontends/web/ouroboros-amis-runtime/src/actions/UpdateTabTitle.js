import { registerAction } from 'amis-core'
import tabs from '#ouroboros-host/common/tabs'

export class UpdateTabTitle {
  async run(action, renderer, event, data) {
    const title = action.args && action.args.title
    if (!title) return
    // TODO: 这里可能会有问题
    const activeTabId = renderer.props.data.SystemContext.activeTabId
    tabs.updateTabTitle(activeTabId, title)
  }
}

registerAction('updateTabTitle', new UpdateTabTitle())
