import { store } from '@/store/storeFacade'

import { navigateTab } from '@/router/tabNavigationCommand'
import { getRouteInfo } from '@/router/utils'
import { openMenuAfterLogin, readPostLoginTarget } from '@/common/menus'
import { EventBus } from '@/common/eventBus'
import { delay, uniqueId } from 'lodash'
import { i18nManager } from '@/common/i18n'
import { DEFAULT_MENU_ICON } from '../../layouts/menu/menuIcon'

import { findBestMatchingTabId, normalizeTabPath } from './tabNavigation'

type TabIconValue = string | Record<string, unknown>

interface TabNavigationOptions {
  syncLocation?: boolean
  isCurrent?: () => boolean
  isFixed?: boolean
  isFixedTab?: boolean
  fixedTab?: boolean
  replaceCurrentTab?: boolean
  title?: string
  breadcrumbs?: Array<{ title?: string; path?: string; key?: string }>
  callback?: (payload: unknown) => void
  icon?: TabIconValue
  defaultIcon?: TabIconValue
}

interface CloseTabOptions {
  syncLocation?: boolean
  isCurrent?: () => boolean
  leaveAccepted?: boolean
  skipEmptyShellFallback?: boolean
  allowFixedTabClose?: boolean
}

interface CloseOtherTabsOptions {
  includeFixedTabs?: boolean
  syncLocation?: boolean
  isCurrent?: () => boolean
}

interface CloseRightTabsOptions {
  includeFixedTabs?: boolean
  syncLocation?: boolean
  isCurrent?: () => boolean
}

type TabMovePosition = 'before' | 'after'

const TAB_ICON_ENABLED_CONFIG_KEY = 'ui.tabs.icon.enabled'
const leaveGuards = new Map<string, Set<() => boolean | Promise<boolean>>>()

async function allowTabLeave(tabId?: string) {
  for (const guard of [...(leaveGuards.get(tabId || '') || [])]) {
    if (!(await guard())) return false
  }
  return true
}

function normalizeTabIcon(icon?: TabIconValue | null) {
  if (!icon) {
    return undefined
  }

  if (typeof icon === 'string') {
    return icon
  }

  if (typeof icon === 'object' && !Array.isArray(icon)) {
    return icon
  }

  return undefined
}

function isTabIconEnabled() {
  const config = store.getters['app/config'] ?? {}
  const enabled = config[TAB_ICON_ENABLED_CONFIG_KEY] ?? config.ui?.tabs?.icon?.enabled
  return enabled !== false
}

function resolveMenuIcon(path: string) {
  const menuGetter = store.getters['user/menuGetter']
  if (typeof menuGetter !== 'function') {
    return undefined
  }

  const [normalizedPath] = `${path || ''}`.split(/[?#]/)
  const menuItem = menuGetter(path) || menuGetter(normalizedPath)
  return normalizeTabIcon(menuItem?.icon)
}

function resolveTabIcon(path: string, tabOption: TabNavigationOptions = {}) {
  if (!isTabIconEnabled()) {
    return DEFAULT_MENU_ICON
  }

  const explicitIcon = normalizeTabIcon(tabOption.icon)
  if (explicitIcon) {
    return explicitIcon
  }

  const routeInfo = getRouteInfo(path)
  const uiModelIcon = normalizeTabIcon(routeInfo?.icon ?? routeInfo?.meta?.icon)
  if (uiModelIcon) {
    return uiModelIcon
  }

  const menuIcon = resolveMenuIcon(path)
  if (menuIcon) {
    return menuIcon
  }

  const defaultIcon = normalizeTabIcon(tabOption.defaultIcon)
  if (defaultIcon) {
    return defaultIcon
  }

  return DEFAULT_MENU_ICON
}

function shouldSyncLocation(options?: TabNavigationOptions) {
  return options?.syncLocation !== false
}

function closeTabState(tabId: string, result: unknown = null) {
  store.dispatch('tabs/closeTab', tabId)
  EventBus.publish('closeTab', { tabId, result })
}

async function runTabNavigation<T extends TabNavigationOptions>(fullPath: string, options: T, project: (options: T) => Promise<any>) {
  let result: any
  const accepted = await navigateTab(fullPath, async isCurrent => {
    result = await project({ ...options, syncLocation: false, isCurrent })
    return result === false ? false : undefined
  })
  return accepted ? result : false
}

function readFixedTabPreference(options?: TabNavigationOptions) {
  if (!options || typeof options !== 'object') {
    return undefined
  }

  if (Object.prototype.hasOwnProperty.call(options, 'isFixed')) {
    return Boolean(options.isFixed)
  }
  if (Object.prototype.hasOwnProperty.call(options, 'isFixedTab')) {
    return Boolean(options.isFixedTab)
  }
  if (Object.prototype.hasOwnProperty.call(options, 'fixedTab')) {
    return Boolean(options.fixedTab)
  }

  return undefined
}

function normalizePromiseResult<T>(callback: () => T | Promise<T>): Promise<T> {
  try {
    return Promise.resolve(callback())
  } catch (error) {
    return Promise.reject(error)
  }
}

EventBus.subscribe('closeTab', (payload: any = {}) => {
  const { tabId, result } = payload
  if (!tabId) return
  if (result) EventBus.publish(`MSG_FROM_TAB_${tabId}`, result)
  EventBus.unsubscribeAll(`MSG_FROM_TAB_${tabId}`)
})

const tabs: any = {
  /** Editors participate before tab state is changed or destroyed. */
  beforeLeave(tabId: string, guard: () => boolean | Promise<boolean>) {
    const guards = leaveGuards.get(tabId) || new Set()
    guards.add(guard)
    leaveGuards.set(tabId, guards)
    return () => {
      guards.delete(guard)
      if (!guards.size) leaveGuards.delete(tabId)
    }
  },
  async replaceTab(id: string, fullPath: string, tabOption: TabNavigationOptions = {}) {
    if (shouldSyncLocation(tabOption)) return runTabNavigation(fullPath, tabOption, options => tabs.replaceTab(id, fullPath, options))
    if (!(await allowTabLeave(id))) return false
    if (id !== store.getters.activeTabId && !(await allowTabLeave(store.getters.activeTabId))) return false
    fullPath = normalizeTabPath(fullPath)
    const [path] = fullPath.split('?')
    const routeInfo = getRouteInfo(path)
    const translatedTitle = i18nManager.tn(path, 'title')
    const finalTitle = translatedTitle !== `${path}.title`
      ? translatedTitle
      : (tabOption.title || routeInfo.title || i18nManager.tCommon('page.unknown', '未知页面'))

    const existingTab = store.getters.tabsList.find((item: any) => item.id === id)
    if (!existingTab) {
      return tabs.openTab(fullPath, { ...tabOption, syncLocation: false })
    }

    const fixedTabPreference = readFixedTabPreference(tabOption)
    const nextTab = {
      ...existingTab,
      path,
      fullPath,
      breadcrumbs: tabOption.breadcrumbs || [],
      title: finalTitle,
      icon: resolveTabIcon(fullPath, tabOption),
      ...(fixedTabPreference === undefined ? {} : { isFixed: fixedTabPreference }),
    }

    if (tabOption.isCurrent?.() === false) return false
    store.dispatch('tabs/changeTab', nextTab)
    store.dispatch('tabs/changeActiveTab', id)

    const { callback } = tabOption
    if (callback && typeof callback === 'function') {
      EventBus.subscribe(`MSG_FROM_TAB_${id}`, callback)
    }

    return id
  },

  async openTab(fullPath: string, tabOption: TabNavigationOptions = {}) {
    if (shouldSyncLocation(tabOption)) return runTabNavigation(fullPath, tabOption, options => tabs.openTab(fullPath, options))
    if (tabOption.isCurrent?.() === false) return false
    if (!(await allowTabLeave(store.getters.activeTabId))) return false
    fullPath = normalizeTabPath(fullPath)
    const { title, breadcrumbs, callback } = tabOption
    const fixedTabPreference = readFixedTabPreference(tabOption)
    const existing = store.getters.tabsList.find((item: any) => item.path === fullPath.split('?')[0])
    if (existing && !(await tabs.getMultiTab(existing.path)) && !(await allowTabLeave(existing.id))) return false

    const [path] = fullPath.split('?')
    const routeInfo = getRouteInfo(path)
    const tabId = `tab-${Date.now()}`

    const translatedTitle = i18nManager.tn(path, 'title')
    const finalTitle = translatedTitle !== `${path}.title`
      ? translatedTitle
      : (title || routeInfo.title || i18nManager.tCommon('page.unknown', '未知页面'))

    const tab = {
      path,
      fullPath,
      title: finalTitle,
      id: tabId,
      breadcrumbs: breadcrumbs || [],
      icon: resolveTabIcon(fullPath, tabOption),
      isFixed: fixedTabPreference === true,
    }

    const isMultiTab = await tabs.getMultiTab(path)
    if (tabOption.isCurrent?.() === false) return false
    const itemIndex = store.getters.tabsList.findIndex((item: any) => item.path === path)
    if (!isMultiTab && itemIndex !== -1) {
      const existingTab = store.getters.tabsList[itemIndex]
      const existTabId = existingTab.id
      tab.isFixed = fixedTabPreference === undefined
        ? Boolean(existingTab?.isFixed)
        : fixedTabPreference
      closeTabState(existTabId)
    }

    if (tabOption.isCurrent?.() === false) return false
    const element = document.querySelector('.content-main') as HTMLElement | null
    const scrollTop = element && element.scrollTop
    store.dispatch('tabs/pushTabScrollTop', scrollTop)
    store.dispatch('tabs/pushTab', tab)
    store.dispatch('tabs/changeActiveTab', tabId)

    if (callback && typeof callback === 'function') {
      EventBus.subscribe(`MSG_FROM_TAB_${tabId}`, callback)
    }
    return tabId
  },

  switchTab(id: string, options: TabNavigationOptions = {}) {
    return normalizePromiseResult(async () => {
      const target = store.getters.tabsList.find((item: any) => item.id === id)
      if (!target) return false
      if (shouldSyncLocation(options)) return runTabNavigation(target.fullPath, options, projection => tabs.switchTab(id, projection))
      if (id !== store.getters.activeTabId && !(await allowTabLeave(store.getters.activeTabId))) return false
      const activeTab = store.getters.tabsList.find((item: any) => item.id === id)
      if (!activeTab) return false
      if (options.isCurrent?.() === false) return false
      const element = document.querySelector('.content-main') as HTMLElement | null
      const scrollTop = element && element.scrollTop
      const activeTabId = store.getters.activeTabId
      if (id !== activeTabId) {
        store.dispatch('tabs/pushTabScrollTop', scrollTop)
      }

      store.dispatch('tabs/changeActiveTab', id)

      delay(() => {
        if (element) {
          element.scrollTop = store.getters.scrollBarScrollTopMap[id]
        }
      }, 100)
      return undefined
    })
  },

  async openOrSwitchTab(fullPath: string, tabOption: TabNavigationOptions = {}) {
    fullPath = normalizeTabPath(fullPath)
    if (shouldSyncLocation(tabOption)) return runTabNavigation(fullPath, tabOption, options => tabs.openOrSwitchTab(fullPath, options))
    const { callback } = tabOption
    const sourceTabId = tabOption?.replaceCurrentTab === true ? store.getters.activeTabId : undefined

    if (sourceTabId) {
      return tabs.replaceTab(sourceTabId, fullPath, tabOption)
    }

    const tabId = findBestMatchingTabId(fullPath, store.getters.tabsList)

    if (tabId) {
      const existingTab = store.getters.tabsList.find((item: any) => item.id === tabId)
      const result = existingTab && existingTab.fullPath !== fullPath
        ? await tabs.updateTab(tabId, fullPath, tabOption)
        : await tabs.switchTab(tabId, tabOption)
      if (result === false || tabOption.isCurrent?.() === false) return false
      const updatedTab = store.getters.tabsList.find((item: any) => item.id === tabId)
      if (updatedTab) {
        const fixedTabPreference = readFixedTabPreference(tabOption)
        store.dispatch('tabs/changeTab', {
          ...updatedTab,
          ...(tabOption.breadcrumbs ? { breadcrumbs: tabOption.breadcrumbs } : {}),
          ...(fixedTabPreference === undefined ? {} : { isFixed: fixedTabPreference }),
        })
      }
      if (callback && typeof callback === 'function') {
        EventBus.subscribe(`MSG_FROM_TAB_${tabId}`, callback)
      }
      return tabId
    }

    return tabs.openTab(fullPath, tabOption)
  },

  updateTab(id: string, fullPath: string, options: TabNavigationOptions = {}) {
    return normalizePromiseResult(async () => {
      if (shouldSyncLocation(options)) return runTabNavigation(fullPath, options, projection => tabs.updateTab(id, fullPath, projection))
      if (!(await allowTabLeave(id))) return false
      if (id !== store.getters.activeTabId && !(await allowTabLeave(store.getters.activeTabId))) return false
      const tab = store.getters.tabsList.find((item: any) => item.id === id)
      if (!tab) return false
      if (options.isCurrent?.() === false) return false
      store.dispatch('tabs/changeTab', {
        ...tab, fullPath, breadcrumbs: options.breadcrumbs || [],
        icon: resolveTabIcon(normalizeTabPath(fullPath), options),
      })
      store.dispatch('tabs/changeActiveTab', id)
    })
  },

  openNotFoundPage(route: any) {
    return normalizePromiseResult(() => {
      const itemIndex = store.getters.tabsList.findIndex((item: any) => item.fullPath === route.fullPath)
      if (itemIndex === -1) {
        const tab = {
          id: uniqueId('tab-notfound-'),
          title: route.meta.title,
          path: route.path,
          fullPath: route.fullPath,
          icon: DEFAULT_MENU_ICON,
        }
        store.dispatch('tabs/pushTab', tab)
        store.dispatch('tabs/changeActiveTab', tab.id)
      } else {
        store.dispatch('tabs/changeActiveTab', store.getters.tabsList[itemIndex].id)
      }
    })
  },

  async closeTab(id?: string, result: any = null, option: CloseTabOptions = {}) {
    const tabsList = [...store.getters.tabsList]
    const activeTabId = store.getters.activeTabId
    const closeId = id || store.getters.activeTabId
    const activeIndex = tabsList.findIndex((item) => item.id === closeId)
    if (activeIndex === -1) {
      return false
    }

    const closingTab = tabsList[activeIndex]
    if (closingTab?.isFixed && option.allowFixedTabClose !== true) {
      return false
    }

    const closesLastTab = closeId === activeTabId && tabsList.length === 1 && !option.skipEmptyShellFallback
    if (closesLastTab && option.syncLocation !== false) {
      await store.dispatch('app/init')
      await store.dispatch('user/fetchMenu')
      return runTabNavigation(readPostLoginTarget().path, option, projection => tabs.closeTab(id, result, projection))
    }
    if (option.syncLocation !== false && closeId === activeTabId && tabsList.length > 1) {
      const nextTab = tabsList[activeIndex > 0 ? activeIndex - 1 : 1]
      return runTabNavigation(nextTab.fullPath, option, projection => tabs.closeTab(id, result, projection))
    }
    if (!option.leaveAccepted && !(await allowTabLeave(closeId))) return false
    if (option.isCurrent?.() === false) return false
    closeTabState(closeId, result)
    if (closeId !== activeTabId) return

    if (store.getters.tabsList.length === 0) {
      if (option.skipEmptyShellFallback) return undefined
      store.dispatch('tabs/changeActiveTab', '')
      await openMenuAfterLogin({ syncLocation: false, isCurrent: option.isCurrent })
      return undefined
    }
    if (store.getters.activeTabId !== activeTabId) return

    const nextIndex = activeIndex > 0 ? activeIndex - 1 : 0
    const newActiveTab = store.getters.tabsList[nextIndex]
    store.dispatch('tabs/changeActiveTab', newActiveTab.id)
    return undefined
  },

  async closeOtherTabs(tabId?: string, option: CloseOtherTabsOptions = {}) {
    const tabsList = store.getters.tabsList
    const activeTabId = store.getters.activeTabId
    const keepId = tabId || activeTabId
    if (tabsList.length === 1) {
      return undefined
    }

    const activeIndex = tabsList.findIndex((item: any) => item.id === keepId)
    if (activeIndex === -1 || !keepId) {
      return undefined
    }

    const closeCandidates = tabsList
      .filter((item: any) => item.id !== keepId)
      .filter((item: any) => option.includeFixedTabs === true || !item.isFixed)

    if (option.syncLocation !== false && keepId !== activeTabId) {
      const target = tabsList.find((item: any) => item.id === keepId)
      return runTabNavigation(target.fullPath, option, projection => tabs.closeOtherTabs(tabId, projection))
    }

    for (const candidate of closeCandidates) {
      if (!(await allowTabLeave(candidate.id))) return false
    }

    if (option.isCurrent?.() === false) return false

    if (closeCandidates.length > 0) {
      closeCandidates
        .forEach((item: any) => {
          EventBus.publish('closeTab', { tabId: item.id })
        })

      store.dispatch('tabs/closeOtherTabs', {
        saveId: keepId,
        includeFixedTabs: option.includeFixedTabs === true,
      })
    } else if (keepId !== activeTabId) {
      store.dispatch('tabs/changeActiveTab', keepId)
    }

    return undefined
  },

  async closeRightTabs(tabId?: string, option: CloseRightTabsOptions = {}) {
    const tabsList = store.getters.tabsList
    const activeTabId = store.getters.activeTabId
    const keepId = tabId || activeTabId
    if (tabsList.length === 1) {
      return undefined
    }

    const keepIndex = tabsList.findIndex((item: any) => item.id === keepId)
    if (keepIndex === -1 || !keepId) {
      return undefined
    }

    const closeCandidates = tabsList
      .slice(keepIndex + 1)
      .filter((item: any) => option.includeFixedTabs === true || !item.isFixed)

    if (option.syncLocation !== false && closeCandidates.some((item: any) => item.id === activeTabId)) {
      const target = tabsList.find((item: any) => item.id === keepId)
      return runTabNavigation(target.fullPath, option, projection => tabs.closeRightTabs(tabId, projection))
    }

    for (const candidate of closeCandidates) {
      if (!(await allowTabLeave(candidate.id))) return false
    }

    if (option.isCurrent?.() === false) return false

    if (closeCandidates.length > 0) {
      closeCandidates.forEach((item: any) => {
        EventBus.publish('closeTab', { tabId: item.id })
      })

      store.dispatch('tabs/closeRightTabs', {
        saveId: keepId,
        includeFixedTabs: option.includeFixedTabs === true,
      })
    }

    const nextActiveTab = store.getters.tabsList.find((item: any) => item.id === activeTabId)
    if (!nextActiveTab) {
      store.dispatch('tabs/changeActiveTab', keepId)
    }
    return undefined
  },

  async toggleFixedTab(tabId?: string, option: { isFixed?: boolean } = {}) {
    const currentTabId = tabId || store.getters.activeTabId
    const tab = store.getters.tabsList.find((item: any) => item.id === currentTabId)
    if (!tab) {
      return false
    }

    const nextFixedState = Object.prototype.hasOwnProperty.call(option, 'isFixed')
      ? Boolean(option.isFixed)
      : !tab.isFixed

    if (Boolean(tab.isFixed) === nextFixedState) {
      return tab.isFixed
    }

    await store.dispatch('tabs/toggleFixedTab', {
      tabId: currentTabId,
      isFixed: nextFixedState,
    })

    return nextFixedState
  },

  async updateTabTitle(id: string | undefined, title: string) {
    const tabId = id || store.getters.activeTabId
    const tab = store.getters.tabsList.find((item: any) => item.id === tabId)
    const translatedTitle = i18nManager.tn(tab.path, 'title')
    const finalTitle = translatedTitle !== `${tab.path}.title` ? translatedTitle : title

    tab.title = finalTitle
    await store.dispatch('tabs/changeTab', tab)
  },

  moveTab(sourceTabId: string, targetTabId?: string, position: TabMovePosition = 'before') {
    return normalizePromiseResult(() => {
      if (!sourceTabId || sourceTabId === targetTabId) {
        return false
      }

      return store.dispatch('tabs/moveTab', {
        sourceTabId,
        targetTabId,
        position,
      })
    })
  },

  sendToOpenerTab(id: string | undefined, data: any) {
    return normalizePromiseResult(() => {
      const currentTabId = id || store.getters.activeTabId
      EventBus.publish(`MSG_FROM_TAB_${currentTabId}`, data)
    })
  },

  getMultiTab(path: string) {
    return normalizePromiseResult(() => {
      const routeInfo = getRouteInfo(path)
      if (!routeInfo) return undefined
      if (routeInfo.type === 'amis') {
        if (routeInfo.isMultiTab === false) {
          return false
        }
        return true
      }
      if (routeInfo.isMultiTab && routeInfo.isMultiTab === true) {
        return true
      }
      return false
    })
  },
}

export default tabs
