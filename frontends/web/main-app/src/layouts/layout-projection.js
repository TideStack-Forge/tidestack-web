import { getLayoutConfig } from './layout-config'
import {
  resolveBreadcrumbs,
  resolveDensityClass,
  resolveLayoutClass,
  resolveLayoutType,
  resolveMicroLoadState,
  resolveThemeClass,
} from './layout-utils'

export function resolveLayoutProjection({
  routeQuery,
  fullPath,
  storeGetters,
  appName,
  logo,
  menu,
  theme,
  userInfo,
  tabsList,
  activeTabId,
}) {
  const layoutType = resolveLayoutType(routeQuery, storeGetters['app/layoutType'])
  const layoutConfig = getLayoutConfig(layoutType)
  const breadcrumb = resolveBreadcrumbs({
    tabsList,
    activeTabId,
    menu,
    fullPath,
    currentSidebarGetter: storeGetters['app/currentSidebarGetter'],
  })
  const { loadMicroTopbar, loadMicroSidebar } = resolveMicroLoadState(storeGetters)
  const themeClass = resolveThemeClass(theme)
  const densityClass = resolveDensityClass()
  const layoutClass = resolveLayoutClass(layoutType)
  const themeList = storeGetters['app/themeList']
  const isLockTheme = storeGetters['app/isLockTheme']
  const lockTheme = storeGetters['app/lockTheme']
  const appConfig = storeGetters['app/config']

  return {
    layoutType,
    layoutConfig,
    breadcrumb,
    loadMicroTopbar,
    loadMicroSidebar,
    themeClass,
    densityClass,
    layoutClass,
    themeList,
    isLockTheme,
    lockTheme,
    appConfig,
    layoutProps: {
      config: layoutConfig,
      appName,
      logo,
      menu,
      theme,
      userInfo,
      breadcrumb,
      tabsList,
      activeTabId,
      loadMicroTopbar,
      loadMicroSidebar,
      themeList,
      isLockTheme,
      lockTheme,
      appConfig,
      themeClass,
      densityClass,
      layoutClass,
    },
  }
}
