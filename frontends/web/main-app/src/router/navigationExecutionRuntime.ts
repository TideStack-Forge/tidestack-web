import tabs from '@/common/tabs'
import { openMenuAfterLogin } from '@/common/menus'

import { createNavigationExecutor } from './navigationExecution'

export const executeNavigationDecision = createNavigationExecutor({
  openNotFoundPage: (to) => tabs.openNotFoundPage(to),
  openOrSwitchTab: (fullPath, options) => tabs.openOrSwitchTab(fullPath, options),
  openRootMenu: () => openMenuAfterLogin(),
  switchTab: (activeTabId, options) => tabs.switchTab(activeTabId, options),
  updateTab: (activeTabId, fullPath, options) => tabs.updateTab(activeTabId, fullPath, options),
})
