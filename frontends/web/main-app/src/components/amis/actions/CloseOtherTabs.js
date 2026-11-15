import { registerAction } from 'amis-core'
import Tabs from '@/common/tabs'
import { store } from '@/store/storeFacade'

export class CloseOtherTabs {
  async run({ args = {} }, renderer) {
    const { tabId, includeFixedTabs = false } = args
    const currentTabId = store?.getters?.activeTabId || renderer?.props?.data?.SystemContext?.activeTabId
    return await Tabs.closeOtherTabs(tabId || currentTabId, { includeFixedTabs })
  }
}

registerAction('closeOtherTabs', new CloseOtherTabs())
