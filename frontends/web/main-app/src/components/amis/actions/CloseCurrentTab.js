import { registerAction } from 'amis-core'
import Tabs from '@/common/tabs'
export class CloseCurrentTab {
  async run({ args = {} }, renderer) {
    const { tabId, result, allowFixedTabClose = false } = args
    // TODO: 这里可能会有问题
    const currentTabId = renderer.props.data.SystemContext.activeTabId
    return await Tabs.closeTab(tabId || currentTabId, result, { allowFixedTabClose })
  }
}

registerAction('closeCurrentTab', new CloseCurrentTab())
registerAction('closeTab', new CloseCurrentTab())
