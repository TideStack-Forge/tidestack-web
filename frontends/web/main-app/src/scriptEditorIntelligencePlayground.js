import { mountReactApp } from '@/bootstrap/bootstrapHostApp'
import { dispatch, commit } from '@/store/storeFacade'
import { getRouter, refreshRouter } from '@/router/routerFacade'

export const SCRIPT_EDITOR_INTELLIGENCE_DEBUG_PATH = '/debug/script-editor-intelligence'

export function isScriptEditorIntelligenceDebugPath(pathname = '') {
  return pathname === SCRIPT_EDITOR_INTELLIGENCE_DEBUG_PATH
}

export async function initScriptEditorIntelligencePlayground() {
  await dispatch('app/init', {
    appName: 'Script Editor Intelligence Playground',
    defaultTheme: 'default',
    currentTheme: 'default',
    routes: [],
    config: {},
  })

  commit('app/SET_AMIS_COMPONENES_REGISTERED', true)
  refreshRouter()
  getRouter()
  mountReactApp()
}
