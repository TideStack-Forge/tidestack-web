import { useState } from 'react'

import { openDialog } from '@/common/modal'
import { i18nService } from '@/common/i18n'
import { dispatch } from '../store/storeFacade'
import { userMenu } from '@/common/menus/registry'
import type { UserMenuContext } from '@/common/menus/registry'
import '@/common/menus/userMenuBuiltins'

import { Icon } from './Icon'
import { MenuBadge } from './menu/MenuBadge'
import { useUserMenuItems } from './menu/useMenuExtensions'

interface UserMenuProps {
  userInfo?: any
  theme?: string
  themeList?: string[]
  isLockTheme?: boolean
  lockTheme?: string
}

/**
 * 用户菜单（注册制渲染器）
 * 菜单项来自用户菜单注册表（registry.userMenu），内置项（修改密码/切换主题/退出）
 * 由 userMenuBuiltins 以注册方式进入；业务项可经编程接口 / SDK 注册。
 */
export function UserMenu({
  userInfo = {},
  theme = '',
  themeList = [],
  isLockTheme = false,
  lockTheme = '',
}: UserMenuProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const items = useUserMenuItems()
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

  function t(key: string, defaultText: string) {
    return i18nService.getManager().tCommon(key, defaultText)
  }

  const userDisplayName =
    userInfo.displayName ||
    userInfo.employee?.name ||
    userInfo.username ||
    userInfo.nickName ||
    userInfo.userIdentity ||
    t('user.unknown', '未知')

  const userAvatarInitial = (() => {
    const rawName = String(userDisplayName || '').trim()
    if (!rawName) {
      return 'U'
    }
    const firstChar = Array.from(rawName)[0]
    if (!firstChar) {
      return 'U'
    }
    return /[a-zA-Z]/.test(firstChar) ? firstChar.toUpperCase() : firstChar
  })()

  const ctx: UserMenuContext = {
    userInfo,
    theme,
    themeList,
    isLockTheme,
    lockTheme,
    dispatch,
    openDialog,
  }

  const visibleItems = items.filter((item) => (item.visible ? item.visible(ctx) !== false : true))

  return (
    <div className="app-user-menu">
      <div className="app-user-menu__container">
        {showDropdown ? (
          <button
            type="button"
            className="app-user-menu__overlay"
            style={plainButtonStyle}
            onClick={() => setShowDropdown(false)}></button>
        ) : null}
        <div className={`app-user-menu__card${showDropdown ? ' is-open' : ''}`}>
          {showDropdown ? (
            <ul className="app-user-menu__dropdown" x-placement="top-end">
              {visibleItems.map((item) =>
                item.divider ? (
                  <li key={item.id} className="app-user-menu__divider" role="separator"></li>
                ) : (
                  <li
                    key={item.id}
                    className={`app-user-menu__item app-user-menu__item--divided${
                      item.disabled && item.disabled(ctx) ? ' is-disabled' : ''
                    }`}
                    style={{ position: 'relative' }}>
                    {item.icon ? (
                      <Icon icon={item.icon} className="app-user-menu__item-icon" iconWidth="16px" />
                    ) : null}
                    <p>{item.titleKey ? t(item.titleKey, item.title) : item.title}</p>
                    <MenuBadge badge={item.badge} />
                    <button
                      type="button"
                      aria-label={item.titleKey ? t(item.titleKey, item.title) : item.title}
                      disabled={item.disabled ? item.disabled(ctx) === true : false}
                      style={{ ...plainButtonStyle, position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                      onClick={() => {
                        if (item.closeOnClick !== false) {
                          setShowDropdown(false)
                        }
                        void item.onClick(ctx)
                      }}>
                    </button>
                  </li>
                )
              )}
              <div x-arrow="" className="popper__arrow"></div>
            </ul>
          ) : null}
          <div className="app-user-menu__trigger">
            <div className="app-user-menu__avatar" aria-hidden="true">
              {userAvatarInitial}
            </div>
            <p className="app-user-menu__name">{userDisplayName}</p>
            <Icon icon="icon-menu-arrow" className={`app-user-menu__arrow${showDropdown ? ' is-open' : ''}`} iconWidth="16px" />
            <button
              type="button"
              aria-label="打开用户菜单"
              style={{ ...plainButtonStyle, position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              onClick={() => setShowDropdown((current) => !current)}
            ></button>
          </div>
        </div>
      </div>
    </div>
  )
}
