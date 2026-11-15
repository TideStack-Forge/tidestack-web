import React from 'react'
import ReactDOM from 'react-dom'
import { renderAmisSchema } from '@/components/amis/AmisComponent'
import { store } from '@/store/storeFacade'
import '@/style/index.scss'

window.React = React
window.ReactDOM = ReactDOM
async function mount() {
  store.commit('user/SET_AUTHORITIES', { 'systemSetting.notificationTemplate': {} })
  const page = await fetch('/notification-management-page').then((response) =>
    response.json()
  )
  const handle = await renderAmisSchema(
    document.getElementById('notification-harness'),
    page.schema,
    { data: { name: 'alpha-template' } }
  )
  window.notificationManagementHarness = {
    ready: true,
    changeName: (name) => handle.update(page.schema, { data: { name } }),
  }
}
mount().catch((error) => {
  document.body.textContent = error.stack
})
