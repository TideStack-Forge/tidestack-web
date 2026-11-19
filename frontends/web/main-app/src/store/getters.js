import { cloneDeep } from 'lodash'
import { i18nService } from '@/common/i18n'

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function asString(value) {
  return typeof value === 'string' ? value : ''
}

function asObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value
}

const getters = {
  appName: (state) => {
    const rawAppName = state.app.appName
    
    // 依赖 state.app.locale 触发响应式更新
    state.app.locale
    
    // 使用 tCommon 翻译，key 是 'app.appName'，defaultText 是原始值
    return i18nService.getManager().tCommon('app.appName', rawAppName)
  },
  // 获取最新的 appName（不依赖响应式）
  getAppName: (state) => () => {
    const rawAppName = state.app.appName
    return i18nService.getManager().tCommon('app.appName', rawAppName)
  },
  sidebar: (state) => state.app.sidebar,
  submenu: (state) => state.app.submenu,
  menu: (state) => state.user.menu,
  userInfo: (state) => cloneDeep(state.user.userInfo),
  token: (state) => cloneDeep(state.user.token),
  accessToken: (state) => state.user.token && state.user.token.accessToken,
  theme: (state) => state.app.theme,
  logo: (state) => state.app.logo,
  tabsList: (state) => asArray(state.tabs.tabsList),
  activeTabId: (state) => asString(state.tabs.activeTabId),
  keepAliveList: (state) => asArray(state.tabs.tabsList),
  appLoading: (state) => state.tabs.appLoading,
  loadedMicroPages: (state) => state.tabs.loadedMicroPages,
  mode: (state) => state.app.mode,
  scrollBarScrollTopMap: (state) => asObject(state.tabs.scrollBarScrollTopMap),
  routes: (state) => asArray(state.app.routes),
  whiteList: (state) => asArray(state.app.whiteList),
  microWhiteRoutesMap: (state) => asObject(state.app.microWhiteRoutesMap),
  initialized: (state) => Boolean(state.app.initialized),
}
export default getters
