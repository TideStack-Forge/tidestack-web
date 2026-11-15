import { useState } from 'react'

import { Brand } from './Brand'
import { SearchBar } from './SearchBar'
import { UserMenu } from './UserMenu'

interface HeaderProps {
  config?: {
    showToggle?: boolean
    showSearch?: boolean
    showUserMenu?: boolean
  }
  theme?: string
  appName?: string
  menu?: any
  logo?: string
  userInfo?: any
  loadMicroTopbar?: boolean
  themeList?: string[]
  isLockTheme?: boolean
  lockTheme?: string
  toggleSidebar?: () => void
}

export function Header({
  config = {},
  theme = '',
  appName = '',
  menu = {},
  logo = '',
  userInfo = {},
  loadMicroTopbar = false,
  themeList = [],
  isLockTheme = false,
  lockTheme = '',
  toggleSidebar,
}: HeaderProps) {
  const [showSearchXsModal, setShowSearchXsModal] = useState(false)
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

  if (loadMicroTopbar) {
    return <header id="custom-topbar"></header>
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header__left">
          {config.showToggle ? (
            <div className="app-header__toggle">
              <button type="button" onClick={toggleSidebar}>
                <i className="fa-solid fa-bars"></i>
              </button>
            </div>
          ) : null}
          <Brand appName={appName} logo={logo} theme={theme} showName className="hidden-xs" />
          <button
            type="button"
            className="visible-xs xs-menu-icon"
            style={plainButtonStyle}
            onClick={() => setShowSearchXsModal(true)}
          >
            <i className="fa-solid fa-indent"></i>
          </button>
        </div>

        <div className="app-header__center">
          {config.showSearch ? <SearchBar menu={menu} theme={theme} /> : null}
        </div>

        <div className="app-header__right">
          {config.showUserMenu ? (
            <UserMenu
              userInfo={userInfo}
              theme={theme}
              themeList={themeList}
              isLockTheme={isLockTheme}
              lockTheme={lockTheme}
            />
          ) : null}
        </div>
      </header>

      {showSearchXsModal ? (
        <div className="xs-search-modal">
          <div className="search-modal">
            <SearchBar menu={menu} theme={theme} onJump={() => setShowSearchXsModal(false)} />
          </div>
          <button
            type="button"
            className="ouroboros-overlay-dimmed"
            style={plainButtonStyle}
            onClick={() => setShowSearchXsModal(false)}
          ></button>
        </div>
      ) : null}
    </>
  )
}
