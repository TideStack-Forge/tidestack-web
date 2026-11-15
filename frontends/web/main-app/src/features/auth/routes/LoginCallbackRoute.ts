import { createElement } from 'react'

import { replaceLocation } from '@/router/routerFacade'
import { readCurrentRoute } from '@/router/routerFacade'

import { LoginCallbackPageView } from '../pages/LoginCallbackPage'

export default function LoginCallbackRoute() {
  return createElement(LoginCallbackPageView, {
    route: readCurrentRoute(),
    navigate: replaceLocation,
  })
}
