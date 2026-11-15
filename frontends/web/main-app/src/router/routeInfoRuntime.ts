import { store } from '@/store/storeFacade'
import { resolveLocation } from '@/router/routerFacade'

import { buildRouteInfo, hasRouteDefinition, type VueResolvedRoute } from './routeInfo'

export function getRouteInfo(path: string) {
  const route = resolveLocation(path) as VueResolvedRoute
  return buildRouteInfo(path, route)
}

export function hasRoute(route: any) {
  if (!route || !route.path) {
    return false
  }
  const routes = store.getters.routes || store.getters['app/routes'] || []
  return hasRouteDefinition(route, routes)
}
