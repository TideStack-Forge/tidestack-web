export interface RouteRecordLike {
  path: string
  meta?: { [key: string]: any }
  [key: string]: any
}

export interface ResolvedRouteLike {
  matched: RouteRecordLike[]
  query: { [key: string]: any }
  params: { [key: string]: any }
  fullPath: string
  path: string
  hash: string
  name?: string
}

export interface VueResolvedRoute {
  location: Location
  route: ResolvedRouteLike
  href: string
  normalizedTo: Location
  resolved: ResolvedRouteLike
}

export interface RouteInfo {
  href: string
  path: string
  fullPath: string
  hash: string
  matched: RouteRecordLike[]
  lastMatched?: RouteRecordLike
  meta: { [key: string]: any }
  params: { [key: string]: any }
  query: { [key: string]: any }
  [key: string]: any
  type: string
}

export function buildRouteInfo(path: string, route: VueResolvedRoute): RouteInfo {
  if (route.resolved.matched.length === 0) {
    return {
      href: route.href,
      type: 'internal',
      name: 'notFound',
      path,
      fullPath: path,
      params: {},
      query: {},
      hash: '',
      matched: [],
      meta: {},
    }
  }

  const { matched, query, params, fullPath, path: resolvedPath, hash } = route.resolved
  const lastMatched = matched[matched.length - 1]
  const meta = lastMatched.meta || {}

  return {
    href: route.href,
    type: meta.type || 'internal',
    query,
    params,
    path: resolvedPath,
    fullPath,
    hash,
    matched,
    lastMatched,
    meta,
    ...meta,
  }
}

export function hasRouteDefinition(route: any, routes: any[] = []) {
  return routes.some((item: any) => item.path === route.path)
}
