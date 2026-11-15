import { createElement } from 'react'

import { replaceLocation } from '@/router/routerFacade'
import { readCurrentRoute } from '@/router/routerFacade'

import { LoginBindPageView } from '../pages/LoginBindPage'

function buildRoute(route: any) {
  return {
    path: route.path,
    fullPath: route.fullPath,
    query: route.query || {},
  }
}

export default function LoginBindRoute() {
  return createElement(LoginBindPageView, {
    route: buildRoute(readCurrentRoute()),
    navigate: (target: any) => replaceLocation(target),
  })
}
