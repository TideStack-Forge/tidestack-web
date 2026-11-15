import Storage from '@/utils/Storage'

const TABS_STORAGE_TYPE = 'sessionStorage'

function normalizeTabsList(tabsList) {
  return Array.isArray(tabsList) ? tabsList : []
}

function normalizeActiveTabId(activeTabId) {
  return typeof activeTabId === 'string' ? activeTabId : ''
}

function normalizeScrollBarScrollTopMap(scrollBarScrollTopMap) {
  if (
    !scrollBarScrollTopMap ||
    typeof scrollBarScrollTopMap !== 'object' ||
    Array.isArray(scrollBarScrollTopMap)
  ) {
    return {}
  }
  return scrollBarScrollTopMap
}

function reorderTabsList(tabsList, sourceTabId, targetTabId, position = 'before') {
  if (!Array.isArray(tabsList) || !sourceTabId) {
    return null
  }

  const nextTabsList = tabsList.slice()
  const sourceIndex = nextTabsList.findIndex((item) => item.id === sourceTabId)
  if (sourceIndex === -1) {
    return null
  }

  const [movedTab] = nextTabsList.splice(sourceIndex, 1)
  if (!movedTab) {
    return null
  }

  if (!targetTabId) {
    nextTabsList.push(movedTab)
    return nextTabsList
  }

  const targetIndex = nextTabsList.findIndex((item) => item.id === targetTabId)
  if (targetIndex === -1) {
    return null
  }

  const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex
  nextTabsList.splice(insertIndex, 0, movedTab)
  return nextTabsList
}

function readTabId(value) {
  return typeof value === 'string' ? value : value?.id || ''
}

function isFixedTab(tab) {
  return Boolean(tab?.isFixed)
}

function readTabIdPayload(payload) {
  return typeof payload === 'string' ? payload : payload?.tabId || payload?.id || ''
}

function readFixedStatePayload(payload, currentFixedState) {
  if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'isFixed')) {
    return Boolean(payload.isFixed)
  }

  return !currentFixedState
}

function closeTabsToRight(tabsList, keepId, includeFixedTabs = false) {
  if (!Array.isArray(tabsList) || !keepId) {
    return null
  }

  const keepIndex = tabsList.findIndex((item) => item.id === keepId)
  if (keepIndex === -1) {
    return null
  }

  return tabsList.filter((item, index) => index <= keepIndex || (!includeFixedTabs && isFixedTab(item)))
}

const initialState = {
  appLoading: false, // 微应用加载状态
  activeTabId: '', // 当前活跃tab
  tabsList: [],
  preventTabOperation: false,
  scrollBarScrollTopMap: {},
  tabStorage: null,
}

const mutations = {
  // 初始化tabs Storage
  INIT_TAB_STORAGE(state, storage) {
    state.tabStorage = storage
    state.tabsList = normalizeTabsList(state.tabStorage.getItem('tabsList'))
    state.activeTabId = normalizeActiveTabId(state.tabStorage.getItem('activeTabId'))
  },

  // 添加活跃的tabs
  PUSH_TAB(state, tab) {
    state.tabsList.push(tab)
    state.tabStorage?.setItem('tabsList', state.tabsList)
  },

  // 更新tabsList
  CHANGE_TAB(state, tab) {
    const tabsList = state.tabsList
    const item = tabsList.find((item) => item.id === tab.id)
    if (!item) {
      return
    }
    Object.assign(item, tab)
    state.tabStorage?.setItem('tabsList', state.tabsList)
  },

  // 改变活跃的activeTab
  CHANGE_ACTIVE_TAB(state, id) {
    state.activeTabId = id
    state.tabStorage?.setItem('activeTabId', state.activeTabId)
  },

  // 添加挂载微应用
  CHANGE_APP_LOADING(state, data) {
    state.appLoading = data
  },

  SET_PREVENT_TAB_OPERATION(state, preventTabOperation) {
    state.preventTabOperation = Boolean(preventTabOperation)
  },

  // 删除活跃的tabs
  REMOVE_TAB(state, id) {
    const tabsList = state.tabsList
    const itemIndex = tabsList.findIndex((item) => item.id === id)
    if (itemIndex !== -1) {
      tabsList.splice(itemIndex, 1)
      delete state.scrollBarScrollTopMap[id]
      // 更新sessionStorage数据
      state.tabStorage?.setItem('tabsList', state.tabsList)
    }
  },

  CLEAR_TABS(state) {
    state.tabsList = []
    state.activeTabId = ''
    state.tabStorage?.removeItem('tabsList')
    state.tabStorage?.removeItem('activeTabId')
  },
  CLOSE_OTHERS_TABS(state, payload) {
    const saveId = typeof payload === 'string' ? payload : payload?.saveId
    const includeFixedTabs = Boolean(typeof payload === 'object' && payload?.includeFixedTabs)

    state.tabsList = state.tabsList.filter((item) => item.id === saveId || (!includeFixedTabs && isFixedTab(item)))
    state.activeTabId = state.tabsList.some((item) => item.id === saveId)
      ? saveId
      : readTabId(state.tabsList[0])
    state.tabStorage?.setItem('tabsList', state.tabsList)
    state.tabStorage?.setItem('activeTabId', state.activeTabId)
  },
  CLOSE_RIGHT_TABS(state, payload) {
    const saveId = typeof payload === 'string' ? payload : payload?.saveId
    const includeFixedTabs = Boolean(typeof payload === 'object' && payload?.includeFixedTabs)
    const nextTabsList = closeTabsToRight(state.tabsList, saveId, includeFixedTabs)

    if (!nextTabsList) {
      return
    }

    const activeWasRemoved = !nextTabsList.some((item) => item.id === state.activeTabId)
    state.tabsList = nextTabsList
    state.activeTabId = activeWasRemoved ? saveId : state.activeTabId
    state.tabStorage?.setItem('tabsList', state.tabsList)
    state.tabStorage?.setItem('activeTabId', state.activeTabId)
  },
  SET_TAB_FIXED_STATE(state, payload) {
    const tabId = readTabIdPayload(payload)
    const tab = state.tabsList.find((item) => item.id === tabId)

    if (!tab) {
      return
    }

    tab.isFixed = readFixedStatePayload(payload, tab.isFixed)
    state.tabStorage?.setItem('tabsList', state.tabsList)
  },
  PUSH_TAB_SCROLL_TOP(state, scrollTop, tabId) {
    const id = tabId || state.activeTabId
    state.scrollBarScrollTopMap[id] = scrollTop
  },
  REORDER_TABS(state, tabsList) {
    state.tabsList = normalizeTabsList(tabsList)
    state.tabStorage?.setItem('tabsList', state.tabsList)
  },
}

const actions = {
  initStorage({ commit, rootState }) {
    const prefix = rootState.app.storagePrefix
    const storage = new Storage({ prefix, type: TABS_STORAGE_TYPE })
    commit('INIT_TAB_STORAGE', storage)
  },
  pushTab({ commit }, tab) {
    commit('PUSH_TAB', tab)
  },
  changeTab({ commit }, tab) {
    commit('CHANGE_TAB', tab)
  },
  changeActiveTab({ commit }, data) {
    commit('CHANGE_ACTIVE_TAB', data)
  },

  changeAppLoading({ state, commit }, data) {
    if (state.appLoading === data) {
      return
    }
    commit('CHANGE_APP_LOADING', data)
  },
  setPreventTabOperation({ commit }) {
    commit('SET_PREVENT_TAB_OPERATION', true)
  },
  clearPreventTabOperation({ commit }) {
    commit('SET_PREVENT_TAB_OPERATION', false)
  },
  // 关闭指定tab
  async closeTab({ commit }, id) {
    commit('REMOVE_TAB', id)
  },
  clearAll({ commit }) {
    commit('CLEAR_TABS')
  },
  closeOtherTabs({ commit }, payload) {
    commit('CLOSE_OTHERS_TABS', payload)
  },
  closeRightTabs({ commit }, payload) {
    commit('CLOSE_RIGHT_TABS', payload)
  },
  toggleFixedTab({ commit, state }, payload) {
    const tabId = readTabIdPayload(payload)
    const tab = state.tabsList.find((item) => item.id === tabId)

    if (!tab) {
      return false
    }

    commit('SET_TAB_FIXED_STATE', {
      tabId,
      isFixed: readFixedStatePayload(payload, tab.isFixed),
    })
    return tab.isFixed
  },
  pushTabScrollTop({ commit }, scrollTop, tabId) {
    commit('PUSH_TAB_SCROLL_TOP', scrollTop, tabId)
  },
  moveTab({ commit, state }, payload = {}) {
    const { sourceTabId, targetTabId, position = 'before' } = payload
    if (!sourceTabId || sourceTabId === targetTabId) {
      return false
    }

    const nextTabsList = reorderTabsList(state.tabsList, sourceTabId, targetTabId, position)
    if (!nextTabsList) {
      return false
    }

    commit('REORDER_TABS', nextTabsList)
    return true
  },
}

const getters = {
  tabsList: (state) => normalizeTabsList(state.tabsList),
  activeTabId: (state) => normalizeActiveTabId(state.activeTabId),
  preventTabOperation: (state) => Boolean(state.preventTabOperation),
  scrollBarScrollTopMap: (state) => normalizeScrollBarScrollTopMap(state.scrollBarScrollTopMap),
}

export default {
  namespaced: true,
  state: initialState,
  getters,
  mutations,
  actions,
}
