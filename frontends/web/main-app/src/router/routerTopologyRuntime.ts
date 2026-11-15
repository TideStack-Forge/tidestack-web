import { store } from '@/store/storeFacade'
import { ErrorPage } from '@/features/system/pages/ErrorPage'

import { mergeRoutes, routersUnique } from './utils'
import { standaloneInternalRoutes, appLayoutChildren } from './internalRoutes'
import { buildErrorRoutes, buildRouterTopology, buildAppLayoutRoute } from './routerTopology'

export function readRouterTopology(layoutComponent: any) {
  const convergedInitialized =
    store.getters.initialized ?? store.getters['app/initialized']
  const convergedRoutes = store.getters.routes || store.getters['app/routes'] || []
  const convergedMicroWhiteRoutesMap =
    store.getters.microWhiteRoutesMap ||
    store.getters['app/microWhiteRoutesMap'] ||
    {}

  return buildRouterTopology({
    initialized: Boolean(convergedInitialized),
    routes: convergedRoutes,
    microWhiteRoutesMap: convergedMicroWhiteRoutesMap,
    baseRoutes: [
      ...standaloneInternalRoutes,
      buildAppLayoutRoute(layoutComponent, appLayoutChildren),
    ],
    errorRoutes: buildErrorRoutes(ErrorPage),
    mergeRoutes,
    routersUnique,
  })
}
