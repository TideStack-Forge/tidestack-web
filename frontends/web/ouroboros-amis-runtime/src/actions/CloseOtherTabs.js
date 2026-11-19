import { registerAction } from 'amis-core'
import Tabs from '#ouroboros-host/common/tabs'
import { store } from '#ouroboros-host/store/storeFacade'

export class CloseOtherTabs {
  async run({ args = {} }, renderer) {
    const { tabId, includeFixedTabs = false } = args
    const currentTabId = store?.getters?.activeTabId || renderer?.props?.data?.SystemContext?.activeTabId
    return await Tabs.closeOtherTabs(tabId || currentTabId, { includeFixedTabs })
  }
}

registerAction('closeOtherTabs', new CloseOtherTabs())
