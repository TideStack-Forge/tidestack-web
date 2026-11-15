import { store } from '@/store/storeFacade'
import { resolvePostLoginFallbackPath } from '@/common/menus/post-login'

import { createNavigationContext } from './navigationContext'

export function readNavigationContext(to: any) {
  const menu = store.getters['user/menu']

  return createNavigationContext(to, {
    isLogin: Boolean(store.getters['user/isLogin']),
    hasInitializationError: Boolean(
      store.getters.token && store.getters['user/initializationError']
    ),
    postLoginFallbackPath: resolvePostLoginFallbackPath(menu),
    whiteList: store.getters['app/whiteList'] || [],
    preventTabOperation: Boolean(store.getters.preventTabOperation),
    activeTabId: store.getters.activeTabId || '',
    tabsList: store.getters.tabsList || [],
  })
}
