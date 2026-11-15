import createAmisPage from '@/components/amis/AmisPage'
import { isExternal } from '@/utils/url'
export { getRouteInfo, hasRoute } from './routeInfoRuntime'
export type { RouteInfo, VueResolvedRoute } from './routeInfo'

const topLayRoutes = ['/', '/login', '*']
/**
 * 合并路由表
 *
 * @param {Object[]} baseRoutes
 * @param {Object[]} anotherRoutes
 * @returns
 */
export function mergeRoutes(baseRoutes: any[], anotherRoutes: any[]) {
  // 配置新路由表
  // 路由去重
  const routes = anotherRoutes
    .map((item, i) => {
      // 处理中文路径
      const [url] = item.path.split('?')
      const path = url ? encodeURI(url) : ''
      switch (item.type) {
        case 'internal':
          return null
        case 'amis':
          {
            const routeSchemaId = item.schemaId || item.config?.schemaId
          return {
            path,
            meta: {
              title: item.title,
              type: item.type,
              schemaId: routeSchemaId,
              ...item.config,
            },
            pageComponent: createAmisPage(routeSchemaId),
          }
          }
        // 默认为 micro
        default:
          return {
            path,
            meta: {
              title: item.title,
              type: item.type,
              ...item.config,
            },
          }
      }
    })
    .filter((item) => item !== null)
    .sort(routeSorter)
  // 新的顶层路由表
  const newTopLayerRoutes = routes.filter(
    (item) => topLayRoutes.includes(item?.path || '') && item?.path !== '/'
  )
  // 新的普通路由表
  const newNormalRoutes = routes.filter(
    (item) => !topLayRoutes.includes(item?.path || '')
  )
  // 原来的顶层路由表，过滤掉布局和新的顶层路由表
  const baseTopLayerRoutes = baseRoutes
    .filter((item) => item.path !== '/')
    .filter((item) => !newTopLayerRoutes.find((newItem) => newItem?.path === item.path))

  // 原来的布局路由项
  const baseLayoutRoute = baseRoutes.find((item) => item.path === '/')
  // 原来的普通路由表
  const baseNormalRoutes = (baseLayoutRoute.children || []).filter(
    (item: any) => !newNormalRoutes.find((newItem) => newItem?.path === item.path)
  )
  const newLayoutRoute = {
    ...baseLayoutRoute,
    children: [...newNormalRoutes, ...baseNormalRoutes],
  }
  return [...baseTopLayerRoutes, ...newTopLayerRoutes, newLayoutRoute]
}
/**
  路由表去重，并统一处理path
*/
export function routersUnique(arr: any[]) {
  const map = new Map()
  for (const item of arr) {
    const url = item.path.split('?')[0]
    map.set(url, item)
  }
  return [...map.values()]
}

export function routeSorter(a: any, b: any) {
  // 根据路径变量数量排序
  const aPathVariables = (a.path.match(/:/g) || []).length
  const bPathVariables = (b.path.match(/:/g) || []).length
  return aPathVariables - bPathVariables
}
