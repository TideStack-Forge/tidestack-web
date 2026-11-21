import { installHostRouter } from '@/router/installRouter'
import React from 'react'
import ReactDOM from 'react-dom'
import '@/style/index.scss'
import { store } from '@/store/storeFacade'
import { getRouter } from '@/router/routerFacade'
import { mountReactApp } from '@/bootstrap/bootstrapHostApp'
import { EventBus } from '@/common/eventBus'

window.React = React
window.ReactDOM = ReactDOM

const statusElement = document.getElementById('statistics-reporting-playwright-status')
const appRoot = document.getElementById('statistics-reporting-app-root')
const initialDatasetEditorPath = '/dev/demo/dataset/demo.sales'
const datasetListPath = '/dev/demo/dataset'
const initialChartPath = '/dev/demo/chart/demo.sales-by-region'
const initialDashboardBusinessModelPath = '/dev/demo/business-model/demo.sales-dashboard'
const leaveTargetPath = '/playwright/statistics-reporting/leave-target'

function buildHarnessAppInfo() {
  return {
    appName: 'Statistics Reporting Harness',
    layoutType: 'fullscreen',
    defaultTheme: 'default',
    currentTheme: 'default',
    routes: [
      {
        path: '/dev/:appName/dataset',
        title: 'Datasets',
        type: 'amis',
        config: {
          schemaId: '/dev/{appName}/dataset',
        },
      },
      {
        path: '/dev/:appName/dataset/:datasetName',
        title: 'Dataset Editor',
        type: 'amis',
        config: {
          schemaId: '/dev/{appName}/dataset/{datasetName}',
        },
      },
      {
        path: '/dev/:appName/chart/:fullName',
        title: 'Chart Editor',
        type: 'amis',
        config: {
          schemaId: '/dev/{appName}/chart/{fullName}',
        },
      },
      {
        path: '/dev/:appName/business-model/:fullName',
        title: 'Business Model Editor',
        type: 'amis',
        config: {
          schemaId: '/dev/{appName}/business-model/{fullName}',
        },
      },
      {
        path: leaveTargetPath,
        title: 'Leave Target',
        type: 'amis',
        config: {
          schemaId: leaveTargetPath,
        },
      },
    ],
  }
}

function createHarnessDebugApi(router, debugState) {
  return {
    ready: false,
    setSqlValue(value) {
      debugState.sqlEditor?.setValue?.(value)
      debugState.sqlEditor?.focus?.()
    },
    publishSavedEvent() {
      EventBus.publish('statisticsReporting.datasetEditor.saved', {
        datasetName: 'demo.sales',
      })
    },
    navigateToLeaveTarget() {
      return router.push(leaveTargetPath)
    },
    getCurrentPath() {
      return router.currentRoute.fullPath
    },
    openChartEditor() {
      return router.push(initialChartPath)
    },
    openDatasetList() {
      return router.push(datasetListPath)
    },
    openDashboardBusinessModelEditor() {
      return router.push(initialDashboardBusinessModelPath)
    },
    async reopenDashboardBusinessModelEditor() {
      await router.push(leaveTargetPath)
      return router.push(initialDashboardBusinessModelPath)
    },
  }
}

async function mountHarness() {
  const debugState = {
    sqlEditor: null,
  }
  const initialTab = {
    id: 'statistics-reporting-playwright-tab',
    path: initialDatasetEditorPath,
    fullPath: initialDatasetEditorPath,
    title: 'Dataset Editor',
  }

  statusElement.textContent = 'Preparing statistics reporting harness...'

  await store.dispatch('app/init', buildHarnessAppInfo())
  store.commit('app/SET_AMIS_COMPONENES_REGISTERED', true)
  store.commit('user/SET_TOKEN', {
    accessToken: 'playwright-access-token',
    expiresIn: 3600,
    issuedAt: Date.now(),
  })
  store.commit('user/SET_USERINFO', {
    userIdentity: 'playwright-user',
    username: 'playwright-user',
    roles: [],
  })
  store.commit('user/SET_IS_LOGIN', true)
  store.commit('user/GLOBAL_MENU', [])
  store.commit('user/GLOBAL_SUB_MENU', [])

  window.history.replaceState({}, '', initialDatasetEditorPath)
  await store.dispatch('tabs/clearAll')
  await store.dispatch('tabs/pushTab', initialTab)
  await store.dispatch('tabs/changeActiveTab', initialTab.id)

  appRoot.id = 'mothership-app-root'

  const router = (installHostRouter(), getRouter())
  const harnessApi = createHarnessDebugApi(router, debugState)
  window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__ = harnessApi
  window.__OUROBOROS_SCRIPT_EDITOR_DEBUG__ = {
    onMounted: ({ editor, props }) => {
      if (props?.name !== 'datasetSqlEditorSql') {
        return
      }
      debugState.sqlEditor = editor
      harnessApi.ready = true
      statusElement.textContent = 'Statistics reporting harness ready'
    },
  }

  statusElement.textContent = 'Rendering statistics reporting app...'

  mountReactApp()
}

mountHarness().catch((error) => {
  console.error(error)
  statusElement.textContent = `Statistics reporting harness failed: ${error.message}`
})
