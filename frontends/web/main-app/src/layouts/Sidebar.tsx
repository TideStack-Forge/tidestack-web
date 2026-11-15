import { type RefObject, useMemo } from 'react'
import { type SidebarWidthConfig } from './sidebar-width'
import { useSidebarResize } from './useSidebarResize'
import { Brand } from './Brand'
import { MenuDualMode } from './menu/MenuDualMode'
import { MenuTree } from './menu/MenuTree'
import { MenuTreeItems } from './menu/MenuTreeItems'
import { SearchBar } from './SearchBar'
import { ScrollBar } from './ScrollBar'
import { UserMenu } from './UserMenu'

interface SidebarProps {
  className?: string
  config?: any
  appName?: string
  logo?: string
  theme?: string
  menu?: any
  breadcrumb?: any[]
  sidebarExpanded?: boolean
  loadMicroSidebar?: boolean
  appConfig?: any
  themeList?: string[]
  isLockTheme?: boolean
  layoutRootRef?: RefObject<HTMLElement | null>
  lockTheme?: string
  resolvedSidebarWidth?: number | null
  sidebarWidthConfig?: SidebarWidthConfig
  userInfo?: any
  activeTabId?: string
  toggle?: () => void
}

const menuComponents: Record<string, any> = {
  DualModeMenu: MenuDualMode,
  TreeMenu: MenuTree,
}

export function Sidebar({
  className = '',
  config = {},
  appName = '',
  logo = '',
  theme = '',
  menu = {},
  breadcrumb = [],
  sidebarExpanded = false,
  loadMicroSidebar = false,
  appConfig = {},
  themeList = [],
  isLockTheme = false,
  layoutRootRef,
  lockTheme = '',
  resolvedSidebarWidth = null,
  sidebarWidthConfig,
  userInfo = {},
  activeTabId = '',
  toggle,
}: SidebarProps) {
  const globalSubNav = menu?.globalSubNav || []
  const MenuComponent = useMemo(
    () => menuComponents[config.menuStyle || 'DualModeMenu'] || MenuDualMode,
    [config.menuStyle]
  )
  const plainButtonStyle = {
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    background: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    color: 'inherit',
    font: 'inherit',
    lineHeight: 'inherit',
    textAlign: 'inherit' as const,
    boxSizing: 'border-box' as const,
    cursor: 'pointer',
  }
  const { handleProps, isResizable } = useSidebarResize({
    currentWidth: resolvedSidebarWidth,
    enabled: Boolean(config?.enabled),
    layoutRootRef,
    sidebarExpanded,
    widthConfig: sidebarWidthConfig,
  })

  const sidebarClassName = [
    'app-sidebar',
    className,
    sidebarExpanded ? '' : 'is-collapsed',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={sidebarClassName}>
      {config.showBrand || config.showSearch ? (
        <div className="app-sidebar__header">
          {config.showBrand ? (
            <Brand
              appName={appName}
              logo={logo}
              theme={theme}
              showName={sidebarExpanded}
            />
          ) : null}
          {config.showSearch ? (
            <div className="sidebar-search">
              <SearchBar menu={menu} theme={theme} collapsed={!sidebarExpanded} />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="app-sidebar__body">
        <ScrollBar visibilityMode="auto" className="app-sidebar__scrollbar">
          {loadMicroSidebar ? (
            <div id="custom-sidebar" className="app-sidebar__micro"></div>
          ) : (
            <MenuComponent
              appName={appName}
              logo={logo}
              theme={theme}
              menu={menu}
              breadcrumb={breadcrumb}
              activeTabId={activeTabId}
              sidebarExpanded={sidebarExpanded}
              appConfig={appConfig}
            />
          )}
        </ScrollBar>
      </div>

      {isResizable ? (
        <div
          className="app-sidebar__resize-handle"
          role="separator"
          aria-label="调整侧边栏宽度"
          aria-orientation="vertical"
          {...handleProps}></div>
      ) : null}

      <div className="app-sidebar__footer">
        {globalSubNav && globalSubNav.length ? (
          <div className="app-sidebar__subnav">
            <MenuTreeItems
              menuArr={globalSubNav}
              theme={theme}
              level={0}
              breadcrumb={breadcrumb}
            />
          </div>
        ) : null}

        {config.showUserMenu || config.showToggle ? (
          <div className="app-sidebar__user-section">
            {config.showUserMenu && sidebarExpanded ? (
              <UserMenu
                userInfo={userInfo}
                theme={theme}
                themeList={themeList}
                isLockTheme={isLockTheme}
                lockTheme={lockTheme}
              />
            ) : null}
            {config.showToggle ? (
              <div className="app-sidebar__toggle" style={{ position: 'relative' }}>
                <i
                  className="fa-solid fa-indent"
                  style={{
                    transform: sidebarExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}></i>
                <button
                  type="button"
                  aria-label="切换侧边栏"
                  style={{
                    ...plainButtonStyle,
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                  }}
                  onClick={toggle}></button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
