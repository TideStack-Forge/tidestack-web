import { installHostRouter } from '@/router/installRouter'
import { commit, dispatch } from '@/store/storeFacade'
import { getRouter, refreshRouter } from '@/router/routerFacade'
import { mountReactApp } from '@/bootstrap/bootstrapHostApp'

export async function initLegacyIframe(initOptions = {}) {
  const { token, config } = initOptions
  await commit('user/SET_TOKEN', token)
  await dispatch('app/init', config)
  commit('app/SET_LAYOUT_TYPE', 'fullscreen')
  refreshRouter()
  installHostRouter()
  getRouter()
  mountReactApp()
}
