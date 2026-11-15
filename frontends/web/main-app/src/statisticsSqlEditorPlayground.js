import { mountReactApp } from '@/bootstrap/bootstrapHostApp'
import { dispatch, commit } from '@/store/storeFacade'
import { getRouter, refreshRouter } from '@/router/routerFacade'

export const STATISTICS_SQL_EDITOR_DEBUG_PATH = '/debug/statistics-sql-editor'

export function isStatisticsSqlEditorDebugPath(pathname = '') {
  return pathname === STATISTICS_SQL_EDITOR_DEBUG_PATH
}

export async function initStatisticsSqlEditorPlayground() {
  await dispatch('app/init', {
    appName: 'Statistics SQL Editor Playground',
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
