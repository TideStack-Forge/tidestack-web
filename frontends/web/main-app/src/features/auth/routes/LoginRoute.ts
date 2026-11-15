import { createElement } from 'react'

import { LoginPageView } from '../pages/LoginPage'
import {
  readCurrentRoute,
  replaceLocation,
} from '@/router/routerFacade'

function buildRoute(route: any) {
  return {
    path: route.path,
    fullPath: route.fullPath,
    query: route.query || {},
  }
}

export default function LoginRoute() {
  return createElement(LoginPageView, {
    route: buildRoute(readCurrentRoute()),
    navigate: (target: any) => replaceLocation(target),
  })
}
