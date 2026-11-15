export function buildErrorRoutes(errorPageComponent: any) {
  return [
    {
      path: '*',
      name: 'error',
      meta: {
        title: '错误页面',
        authIds: [],
        type: 'internal',
      },
      pageComponent: errorPageComponent,
    },
  ]
}

export function buildAppLayoutRoute(layoutComponent: any, children: any[] = []) {
  return {
    path: '/',
    pageComponent: layoutComponent,
    children: [...children],
  }
}

export function buildRouterTopology({
  initialized,
  routes = [],
  microWhiteRoutesMap = {},
  baseRoutes,
  errorRoutes,
  mergeRoutes,
  routersUnique,
}: {
  initialized: boolean
  routes?: any[]
  microWhiteRoutesMap?: Record<string, Array<{ path: string; name?: string }>>
  baseRoutes: any[]
  errorRoutes: any[]
  mergeRoutes: (baseRoutes: any[], anotherRoutes: any[]) => any[]
  routersUnique: (routes: any[]) => any[]
}) {
  if (!initialized) {
    return errorRoutes
  }

  const unionRoutes = routersUnique(routes)
  const microWhiteRouters = Object.keys(microWhiteRoutesMap).flatMap((entry) => {
    return (microWhiteRoutesMap[entry] || []).map(({ path, name }) => {
      return {
        path,
        name,
        type: 'micro',
        config: {
          entry,
        },
      }
    })
  })

  return mergeRoutes(baseRoutes, [...unionRoutes, ...microWhiteRouters])
}
