import React from 'react'
import ReactDOM from 'react-dom'

import '@/style/index.scss'
import { bootstrapHostApp } from '@/bootstrap/bootstrapHostApp'
import Tabs from '@/common/tabs'
import { store } from '@/store/storeFacade'

window.React = React
window.ReactDOM = ReactDOM

const statusElement = document.getElementById('debug-topbar-playwright-status')
const searchParams = new URL(window.location.href).searchParams
const initialPath = searchParams.get('path') || '/dev/demo/helper-control-regression'
const initialTabTitle = searchParams.get('title') || (initialPath.startsWith('/dev/') ? 'Debug Topbar Regression' : '个人门户')
const initialTab = {
  id: 'debug-topbar-dev-tab',
  path: initialPath,
  fullPath: initialPath,
  title: initialTabTitle,
}

const harnessState = {
  ready: false,
  instanceId: `debug-topbar-harness-${Date.now()}`,
  beforeUnloadCount: 0,
  initialPath,
  openOrSwitchTab(fullPath, title) {
    return Tabs.openOrSwitchTab(fullPath, title ? { title } : {})
  },
  switchToTab(title) {
    const tab = (store.getters.tabsList || []).find((item) => item.title === title)
    if (!tab) {
      return false
    }

    return Tabs.switchTab(tab.id, { syncLocation: true })
  },
}

window.__DEBUG_TOPBAR_PLAYWRIGHT_HARNESS__ = harnessState
window.localStorage.setItem(
  'Ouroboros_token',
  JSON.stringify({
    accessToken: 'debug-topbar-playwright-access-token',
    refreshToken: 'debug-topbar-playwright-refresh-token',
  })
)
window.sessionStorage.setItem('Ouroboros_tabsList', JSON.stringify([initialTab]))
window.sessionStorage.setItem('Ouroboros_activeTabId', JSON.stringify(initialTab.id))
window.history.replaceState({}, '', initialPath)
window.addEventListener('beforeunload', () => {
  harnessState.beforeUnloadCount += 1
})

statusElement.textContent = 'Rendering debug topbar harness...'

bootstrapHostApp()
  .then(() => {
    harnessState.ready = true
    statusElement.textContent = 'Debug topbar harness ready'
  })
  .catch((error) => {
    console.error(error)
    statusElement.textContent = `Debug topbar harness failed: ${error.message}`
  })
