import React from 'react'
import ReactDOM from 'react-dom'
import { renderAmisSchema } from '@/components/amis/AmisComponent'
import { store } from '@/store/storeFacade'
import '@/style/index.scss'

window.React = React
window.ReactDOM = ReactDOM
async function mount() {
  store.commit('user/SET_AUTHORITIES', { 'systemSetting.userManagement': {} })
  const page = await fetch('/integration-test-page').then((response) => response.json())
  await renderAmisSchema(document.getElementById('integration-harness'), page.schema, {
    data: { userIdentity: 'alice' },
  })
  window.integrationHarness = { ready: true }
}
mount().catch((error) => {
  document.body.textContent = error.stack
})
