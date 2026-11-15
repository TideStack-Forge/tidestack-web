import { pushLocation } from '@/router/routerFacade'
import { registerBuiltinUserMenuItem } from './registry'

/**
 * 内置用户菜单项注册
 *
 * 修改密码 / 切换主题 / 退出三个内置项以注册方式进入用户菜单。
 * 幂等：以稳定 key 注册，重复注册视为覆盖；登出清理时内置项保留。
 * 模块被 UserMenu 引用即完成注册（副作用导入）。
 */
export function registerBuiltinUserMenuItems(): void {
  registerBuiltinUserMenuItem({
    key: 'builtin.userProfile',
    title: '个人资料',
    order: 5,
    onClick: () => pushLocation('/personal-settings/profile'),
  })

  registerBuiltinUserMenuItem({
    key: 'builtin.changePassword',
    title: '修改密码',
    titleKey: 'userMenu.changePassword',
    order: 10,
    onClick: (ctx) =>
      ctx.openDialog({
        width: '500px',
        url: '/system-setting/user-management/change-password',
      }),
  })

  registerBuiltinUserMenuItem({
    key: 'builtin.changeTheme',
    title: '切换主题',
    titleKey: 'userMenu.changeTheme',
    order: 20,
    visible: (ctx) => !ctx.isLockTheme,
    onClick: (ctx) => {
      const { theme, themeList, lockTheme } = ctx
      const currentIndex = themeList.indexOf(theme)
      const nextIndex = (currentIndex + 1) % themeList.length
      const nextThemeName = themeList[nextIndex]
      if (!nextThemeName || lockTheme) {
        return
      }
      void ctx.dispatch('app/changeTheme', nextThemeName)
    },
  })

  registerBuiltinUserMenuItem({
    key: 'builtin.logout',
    title: '退出',
    titleKey: 'userMenu.logout',
    order: 1000,
    onClick: (ctx) => ctx.dispatch('user/logout'),
  })
}

registerBuiltinUserMenuItems()
