import { useEffect, useRef, useState } from 'react'

import AmisComponent from '@/components/amis/AmisComponent'
import { init } from '@/common/modal'
import { resolveLayoutProjection } from '@/layouts/layout-projection'
import { setThemeClassName } from '@/utils/theme'

import { readCurrentRoute } from '../router/routerFacade'
import { readGetters, readState } from '../store/storeFacade'
import { ContentViewport } from './ContentViewport'
import { useDevWorkspaceMenuSync } from './devWorkspaceMenuSync'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import {
  createSidebarWidthStyle,
  readUserWidthPreference,
  resolveSidebarWidth,
  resolveSidebarWidthConfig,
} from './sidebar-width'
import { Tabs } from './Tabs'
import { useHostSnapshot } from './useHostSnapshot'
import { useMicroLayoutApps } from './useMicroLayoutApps'

const APP_LAYOUT_IGNORED_STORE_MUTATIONS = new Set([
  'tabs/PUSH_TAB_SCROLL_TOP',
  'tabs/SET_PREVENT_TAB_OPERATION',
])

function ModalScopeHost({ appConfig = {} }: { appConfig?: Record<string, any> }) {
  return (
    <AmisComponent
      style={{ height: 0, overflow: 'hidden' }}
      amisSchema={{ type: 'page' }}
      amisProps={{
        data: {
          SystemConfig: appConfig,
          SystemContext: {
            config: appConfig,
          },
        },
        scopeRef: (ref: any) => {
          if (ref) {
            init(ref)
          }
        },
      }}
    />
  )
}

function isOwnedRoute(route: any) {
  return Boolean(route?.matched?.some((record: any) => record.path === '/'))
}

function renderLayout(
  layoutType: string,
  layoutProps: Record<string, any>,
  routeType: string | undefined,
  sidebarExpanded: boolean,
  toggleSidebar: () => void
) {
  const appLayoutClassName = ['app-layout', layoutProps.layoutClass]
    .filter(Boolean)
    .join(' ')
  const shouldShowHeader =
    layoutProps.config?.header?.enabled || layoutProps.loadMicroTopbar
  const content = <ContentViewport routeType={routeType} />
  const tabs = layoutProps.config?.tabs?.enabled ? (
    <div className="app-content__tabs">
      <Tabs
        tabsList={layoutProps.tabsList}
        activeTabId={layoutProps.activeTabId}
        currentPath={layoutProps.fullPath}
      />
    </div>
  ) : null

  if (layoutType === 'fullscreen') {
    return <div className="fullscreen-layout">{content}</div>
  }

  const header = shouldShowHeader ? (
    <Header
      config={layoutProps.config.header}
      appName={layoutProps.appName}
      logo={layoutProps.logo}
      theme={layoutProps.theme}
      userInfo={layoutProps.userInfo}
      menu={layoutProps.menu}
      loadMicroTopbar={layoutProps.loadMicroTopbar}
      themeList={layoutProps.themeList}
      isLockTheme={layoutProps.isLockTheme}
      lockTheme={layoutProps.lockTheme}
      toggleSidebar={toggleSidebar}
    />
  ) : null

  const sidebar = layoutProps.config?.sidebar?.enabled ? (
    <Sidebar
      className={`hidden-xs${sidebarExpanded ? ' is-open' : ''}`}
      config={layoutProps.config.sidebar}
      appName={layoutProps.appName}
      logo={layoutProps.logo}
      theme={layoutProps.theme}
      menu={layoutProps.menu}
      breadcrumb={layoutProps.breadcrumb}
      sidebarExpanded={sidebarExpanded}
      loadMicroSidebar={layoutProps.loadMicroSidebar}
      appConfig={layoutProps.appConfig}
      themeList={layoutProps.themeList}
      isLockTheme={layoutProps.isLockTheme}
      layoutRootRef={layoutProps.layoutRootRef}
      lockTheme={layoutProps.lockTheme}
      resolvedSidebarWidth={layoutProps.resolvedSidebarWidth}
      sidebarWidthConfig={layoutProps.sidebarWidthConfig}
      userInfo={layoutProps.userInfo}
      activeTabId={layoutProps.activeTabId}
      toggle={toggleSidebar}
    />
  ) : null

  if (layoutType === 'header-only') {
    return (
      <div className={appLayoutClassName}>
        {header}
        <div className="app-body">
          <div className="app-content">
            {tabs}
            <div className="app-content__main">{content}</div>
          </div>
        </div>
      </div>
    )
  }

  if (layoutType === 'sidebar-split' || layoutType === 'sidebar-split-no-header') {
    return (
      <div className={appLayoutClassName}>
        <div className="app-body">
          {sidebar}
          <div className="app-content">
            {shouldShowHeader ? (
              <div className="app-content__header">{header}</div>
            ) : null}
            {tabs}
            <div className="app-content__main">{content}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={appLayoutClassName}>
      {header}
      <div className="app-body">
        {sidebar}
        <div className="app-content">
          {tabs}
          <div className="app-content__main">{content}</div>
        </div>
      </div>
    </div>
  )
}

export function AppLayout() {
  useHostSnapshot({
    shouldNotifyStore: (mutation) =>
      !APP_LAYOUT_IGNORED_STORE_MUTATIONS.has(mutation?.type),
  })
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const layoutRootRef = useRef<HTMLDivElement | null>(null)
  const route = readCurrentRoute()
  const getters = readGetters()
  const state = readState()
  const currentUserInfo = state.user?.userInfo || {}
  const ownedRoute = isOwnedRoute(route)

  useDevWorkspaceMenuSync(route.fullPath)

  const layoutProjection = ownedRoute
    ? resolveLayoutProjection({
        routeQuery: route.query,
        fullPath: route.fullPath,
        storeGetters: getters,
        appName: getters.appName,
        logo: getters.logo,
        menu: getters.menu,
        theme: getters.theme,
        userInfo: currentUserInfo,
        tabsList: getters.tabsList,
        activeTabId: getters.activeTabId,
      })
    : null

  useEffect(() => {
    if (layoutProjection?.layoutProps?.theme) {
      setThemeClassName(layoutProjection.layoutProps.theme)
    }
  }, [layoutProjection])

  useMicroLayoutApps({
    appName: layoutProjection?.layoutProps.appName,
    logo: layoutProjection?.layoutProps.logo,
    menu: layoutProjection?.layoutProps.menu,
    theme: layoutProjection?.layoutProps.theme,
    userInfo: layoutProjection?.layoutProps.userInfo,
    breadcrumb: layoutProjection?.layoutProps.breadcrumb,
    currentPath: route.fullPath,
    headerEntry: getters['app/headerEntry'],
    sidebarEntry: getters['app/sidebarEntry'],
  })

  const sidebarWidthConfig = resolveSidebarWidthConfig(
    layoutProjection?.layoutProps?.appConfig
  )
  const sidebarEnabled = Boolean(layoutProjection?.layoutProps?.config?.sidebar?.enabled)
  const resolvedSidebarWidth = sidebarEnabled
    ? resolveSidebarWidth(
        sidebarWidthConfig,
        readUserWidthPreference(
          typeof window !== 'undefined' ? window.sessionStorage : null
        )
      )
    : null
  const rootStyle = createSidebarWidthStyle(sidebarEnabled ? resolvedSidebarWidth : null)

  const rootClassNames = [
    'mothership-app-layout',
    layoutProjection?.layoutProps?.themeClass,
    layoutProjection?.layoutProps?.densityClass,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClassNames} ref={layoutRootRef} style={rootStyle}>
      <ModalScopeHost appConfig={layoutProjection?.layoutProps?.appConfig} />
      {ownedRoute && layoutProjection ? (
        renderLayout(
          layoutProjection.layoutType,
          {
            ...layoutProjection.layoutProps,
            layoutRootRef,
            resolvedSidebarWidth,
            sidebarWidthConfig,
          },
          route.meta?.type,
          sidebarExpanded,
          () => setSidebarExpanded((current: boolean) => !current)
        )
      ) : (
        <ContentViewport routeType={route.meta?.type} />
      )}
    </div>
  )
}
