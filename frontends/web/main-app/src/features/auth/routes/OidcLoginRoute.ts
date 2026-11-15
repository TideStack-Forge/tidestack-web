import { createElement } from 'react'
import { replaceLocation } from '@/router/routerFacade'
import { OidcLoginPage } from '../pages/OidcLoginPage'

function continueAuthorization(target: string) {
  window.location.assign(target)
}

export default function OidcLoginRoute() {
  return createElement(OidcLoginPage, {
    navigate: replaceLocation,
    continueAuthorization,
  })
}
