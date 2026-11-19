import { store } from '@/store/storeFacade'
import tabs from '@/common/tabs'
import { isExternal } from '@/utils/url'
import { replaceLocation } from '@/router/routerFacade'
import { getRouteInfo } from '@/router/utils'
import { resolvePostLoginFallbackPath } from '@/common/menus/post-login'
function getCanJumpMenu(menu) {
  if (!menu) return
  const url = menu.url || menu.path || menu.fullPath
  if (!url) {
    if (menu.children && menu.children[0]) {
      return getCanJumpMenu(menu.children && menu.children[0])
    }
    return
  }
  if (menu.showMode === 'newWindow') return menu
  if (isExternal(url)) return menu
  const [path] = url.split('?')
  const routeInfo = getRouteInfo(path)
  if (routeInfo.name !== 'notFound') return menu
  const menu_ = getCanJumpMenu(menu.children && menu.children[0])
  return menu_
}
// data：要遍历的数据， target：查找目标， result用于装查找结果的数组
function findParent(data, target, result) {
  // 如果父key 相同，增加target是否存在当前父中
  for (const item of data) {
    if (
      item.key === target.parent &&
      item.children.some((item) => item.key === target.key)
    ) {
      // 将查找到的目标数据加入结果数组中
      result.unshift({
        title: item.title,
        path: item.url || item.path || item.fullPath,
        key: item.key,
      })
      return true
    }
    if (item.children && item.children.length > 0) {
      // 根据查找到的结果往上找父级节点
      const found = findParent(item.children, target, result)
      if (found) {
        result.unshift({
          title: item.title,
          path: item.url || item.path || item.fullPath,
          key: item.key,
        })
        return true
      }
    }
  }
  // 走到这说明没找到目标
  return false
}
// 获取面包屑
function getCurrentBreadcrumbs(currentMenu) {
  const menuList = store.getters['menu'].globalMenu || []

  const result = []
  if (!currentMenu) return []
  if (!currentMenu.parent) {
    const { title, path, key } = currentMenu
    result.push({
      title,
      path,
      key,
    })
    return result
  }
  const hasParent = findParent(menuList, currentMenu, result)
  if (hasParent) {
    const { title, path, key } = currentMenu
    result.push({
      title,
      path,
      key,
    })
  }
  return result
}

function readFixedTabPreference(menu) {
  if (!menu || typeof menu !== 'object') return undefined
  if (menu.extraProps && Object.prototype.hasOwnProperty.call(menu.extraProps, 'isFixedTab')) {
    return Boolean(menu.extraProps.isFixedTab)
  }
  if (Object.prototype.hasOwnProperty.call(menu, 'isFixedTab')) return Boolean(menu.isFixedTab)
  if (Object.prototype.hasOwnProperty.call(menu, 'fixedTab')) return Boolean(menu.fixedTab)
  if (Object.prototype.hasOwnProperty.call(menu, 'isFixed')) return Boolean(menu.isFixed)
  return undefined
}

async function openMenuItem(menu, tabOptions = {}) {
  if (typeof menu === 'string') {
    menu = store.getters['user/menuGetter'](menu)
  }
  if (!menu) {
    console.error('menu is null')
    return
  }

  // 判断是否存在路由表中，不在取children下第一个
  const finalMenu = getCanJumpMenu(menu)
  if (!finalMenu) return
  const url = finalMenu.url || finalMenu.path || finalMenu.fullPath
  const title = finalMenu.title || ''
  const fixedTabPreference = readFixedTabPreference(finalMenu)
  if (!url) {
    console.error('url is undefined')
    return
  }
  // 如果是外部链接，则直接打开
  if (isExternal(url)) return window.open(url)

  // 如果是内部链接，则根据showMode打开
  const showMode = finalMenu.showMode
  switch (showMode) {
    case 'newWindow':
      window.open(url)
      break
    case 'fullScreen':
      return tabOptions.syncLocation === false ? true : openFullScreen(url)
    default:
      return (await tabs.openOrSwitchTab(url, {
        ...tabOptions,
        title,
        breadcrumbs: getCurrentBreadcrumbs(finalMenu),
        defaultIcon: finalMenu.icon || '',
        ...(fixedTabPreference === undefined ? {} : { isFixed: fixedTabPreference }),
      })) !== false
  }
  return true
}

function getFullScreenUrl(url) {
  const newUrl = new URL(url, window.location.origin)
  const searchParams = newUrl.searchParams
  if (searchParams.get('isfullscreen') !== 'true') {
    searchParams.set('isfullscreen', 'true')
  }
  return newUrl.pathname + newUrl.search + newUrl.hash
}

function openFullScreen(url) {
  return replaceLocation(getFullScreenUrl(url))
}

function openFirstMenuItem() {
  const menu = store.getters['user/menu']
  const firstMenu = findFirstMenu(menu && menu.globalMenu)
  if (!firstMenu) return
  openMenuItem(firstMenu)
}

function findFirstMenu(menus) {
  if (!menus || !menus.length) return null
  const menu = menus[0]
  if (!menu.children || !menu.children.length) return menu
  return findFirstMenu(menu.children)
}

function readPostLoginTarget() {
  const menu = store.getters['user/menu']
  const menuTarget = (targetMenu) => {
    const url = targetMenu.url || targetMenu.path || targetMenu.fullPath
    const path = isExternal(url) || targetMenu.showMode === 'newWindow'
      ? resolvePostLoginFallbackPath(menu)
      : targetMenu.showMode === 'fullScreen' ? getFullScreenUrl(url) : url
    return { menu: targetMenu, path }
  }
  const homePage = store.getters['app/homePage']
  if (homePage) {
    const homeMenu = store.getters['user/menuGetter'](homePage)
    const targetMenu = homeMenu && getCanJumpMenu(homeMenu)
    if (targetMenu) return menuTarget(targetMenu)
    const route = getRouteInfo(homePage)
    if (route && route.name !== 'notFound') return { path: homePage, route: true }
  }
  const first = findFirstMenu(menu && menu.globalMenu)
  const targetMenu = first && getCanJumpMenu(first)
  if (targetMenu) return menuTarget(targetMenu)
  return { path: resolvePostLoginFallbackPath(menu) }
}

async function openMenuAfterLogin(tabOptions = {}) {
  const target = readPostLoginTarget()
  if (target.menu) return openMenuItem(target.menu, tabOptions)
  if (target.route) return tabs.openOrSwitchTab(target.path, tabOptions)
  if (tabOptions.syncLocation !== false) return replaceLocation(target.path)
  return true
}
// 跳转
function doJump() {
  const url = new URL(window.location.href)
  const redirect = url.searchParams.get('redirect')
  if (!redirect) return openMenuAfterLogin()
  return replaceLocation(redirect)
}

export { openMenuItem, openFirstMenuItem, openMenuAfterLogin, readPostLoginTarget, doJump }
