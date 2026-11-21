import { installHostRouter } from '@/router/installRouter'
import { mountReactApp } from '@/bootstrap/bootstrapHostApp'
import { dispatch, commit } from '@/store/storeFacade'
import { getRouter, refreshRouter } from '@/router/routerFacade'

export const DATASET_SQL_EDITOR_DEBUG_PATH = '/debug/dataset-sql-editor'

export function isDatasetSqlEditorDebugPath(pathname = '') {
  return pathname === DATASET_SQL_EDITOR_DEBUG_PATH
}

export async function initDatasetSqlEditorPlayground() {
  await dispatch('app/init', {
    appName: '数据集 SQL 编辑器调试页',
    defaultTheme: 'default',
    currentTheme: 'default',
    routes: [],
    config: {},
  })

  commit('app/SET_AMIS_COMPONENES_REGISTERED', true)
  installHostRouter()
  refreshRouter()
  getRouter()
  mountReactApp()
}
