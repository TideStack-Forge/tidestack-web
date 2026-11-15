/**
 * 布局切换工具
 * 用于开发和测试时快速切换布局
 */

const FULLSCREEN_QUERY_PARAMS = [
  'isFullscreen',
  'isfullscreen',
  'isFullScreen',
  'fullscreen',
  'fullScreen',
]

export function resolveLayoutType(routeQuery, layoutType) {
  const query = routeQuery || {}
  for (const param of FULLSCREEN_QUERY_PARAMS) {
    const value = query[param]
    if (value === 'true' || value === '1') {
      return 'fullscreen'
    }
  }

  return layoutType || 'header-sidebar'
}

export function shouldLoadMicroTopbar(headerEntry) {
  return !!headerEntry
}

export function shouldLoadMicroSidebar(sidebarEntry) {
  return !!sidebarEntry
}

export function resolveMicroLoadState(appGetters) {
  return {
    loadMicroTopbar: shouldLoadMicroTopbar(appGetters['app/headerEntry']),
    loadMicroSidebar: shouldLoadMicroSidebar(appGetters['app/sidebarEntry']),
  }
}

export function resolveBreadcrumbs({ tabsList, activeTabId, menu, fullPath, currentSidebarGetter }) {
  const currentSidebarTree = currentSidebarGetter(
    [...(menu?.globalMenu || []), ...(menu?.globalSubNav || [])],
    fullPath
  )
  if (currentSidebarTree?.[0]?.length) {
    return currentSidebarTree[0].map((item) => ({
      title: item.title,
      path: item.url || item.path,
      key: item.key,
    }))
  }
  if (tabsList && tabsList.length && activeTabId) {
    const activeTab = tabsList.find((item) => item.id === activeTabId)
    if (activeTab && activeTab.breadcrumbs && activeTab.breadcrumbs.length) {
      return activeTab.breadcrumbs
    }
  }

  if (!menu || !menu.globalMenu || !menu.globalMenu.length) {
    return []
  }

  return ((currentSidebarTree && currentSidebarTree[0]) || []).map((item) => ({
    title: item.title,
    path: item.path,
    key: item.key,
  }))
}

export function resolveThemeClass(theme) {
  return theme ? `theme-${theme}` : 'theme-default'
}

export function resolveDensityClass() {
  return 'density-normal'
}

export function resolveLayoutClass(layoutType) {
  return layoutType
}

export function switchLayout(layoutType) {
  const store = require('@/store/storeFacade').store
  store.dispatch('app/setLayoutType', layoutType)
}

export function getAvailableLayouts() {
  return [
    { value: 'header-sidebar', label: 'Header + Sidebar' },
    { value: 'sidebar-split', label: 'Sidebar Split (with header)' },
    { value: 'header-only', label: 'Header Only' },
  ]
}

// 在浏览器控制台使用：
// import { switchLayout } from '@/layouts/layout-utils'
// switchLayout('sidebar-split')
