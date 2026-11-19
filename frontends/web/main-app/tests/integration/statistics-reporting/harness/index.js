import { installHostRouter } from '@/router/installRouter'
import React from 'react'
import ReactDOM from 'react-dom'
import { store } from '@/store/storeFacade'
import { getRouter } from '@/router/routerFacade'
import { mountReactApp } from '@/bootstrap/bootstrapHostApp'
import { EventBus } from '@/common/eventBus'

window.React = React
window.ReactDOM = ReactDOM

const statusElement = document.getElementById('statistics-reporting-playwright-status')
const appRoot = document.getElementById('statistics-reporting-app-root')
const initialStudioPath = '/dev/demo/analytics/datasets/demo.sales/studio'
const initialReportViewPath = '/dev/demo/analytics/report-views/demo.sales-by-region'
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
        path: '/dev/:appName/analytics/datasets/:datasetName/studio',
        title: 'Dataset Studio',
        type: 'amis',
        config: {
          schemaId: '/dev/{appName}/analytics/datasets/{datasetName}/studio',
        },
      },
      {
        path: '/dev/:appName/analytics/report-views/:fullName',
        title: 'Chart Editor',
        type: 'amis',
        config: {
          schemaId: '/dev/{appName}/analytics/report-views/{fullName}',
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
    setGenericSqlValue(value) {
      debugState.genericSqlEditor?.setValue?.(value)
      debugState.genericSqlEditor?.focus?.()
    },
    publishSavedEvent() {
      EventBus.publish('statisticsReporting.datasetStudio.saved', {
        datasetName: 'demo.sales',
      })
    },
    navigateToLeaveTarget() {
      return router.push(leaveTargetPath)
    },
    getCurrentPath() {
      return router.currentRoute.fullPath
    },
    openReportViewEditor() {
      return router.push(initialReportViewPath)
    },
    openDashboardBusinessModelEditor() {
      return router.push(initialDashboardBusinessModelPath)
    },
  }
}

async function mountHarness() {
  const debugState = {
    genericSqlEditor: null,
  }
  const initialTab = {
    id: 'statistics-reporting-playwright-tab',
    path: initialStudioPath,
    fullPath: initialStudioPath,
    title: 'Dataset Studio',
  }

  statusElement.textContent = 'Preparing statistics reporting harness...'

  await store.dispatch('app/init', buildHarnessAppInfo())
  store.commit('app/SET_AMIS_COMPONENES_REGISTERED', true)
  store.commit('user/SET_TOKEN', {
    accessToken: 'playwright-access-token',
  })
  store.commit('user/SET_USERINFO', {
    userIdentity: 'playwright-user',
    username: 'playwright-user',
    roles: [],
  })
  store.commit('user/SET_IS_LOGIN', true)
  store.commit('user/GLOBAL_MENU', [])
  store.commit('user/GLOBAL_SUB_MENU', [])

  window.history.replaceState({}, '', initialStudioPath)
  await store.dispatch('tabs/clearAll')
  await store.dispatch('tabs/pushTab', initialTab)
  await store.dispatch('tabs/changeActiveTab', initialTab.id)

  appRoot.id = 'mothership-app-root'

  const router = (installHostRouter(), getRouter())
  const harnessApi = createHarnessDebugApi(router, debugState)
  window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__ = harnessApi
  window.__OUROBOROS_SCRIPT_EDITOR_DEBUG__ = {
    onMounted: ({ editor, props }) => {
      if (props?.name !== 'statisticsSqlEditorGenericSql') {
        return
      }
      debugState.genericSqlEditor = editor
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
