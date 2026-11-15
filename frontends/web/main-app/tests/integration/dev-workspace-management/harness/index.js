import React from 'react'
import ReactDOM from 'react-dom'
import { renderAmisSchema } from '@/components/amis/AmisComponent'
import tabs from '@/common/tabs/tabNavigationRuntime'
import '@/style/index.scss'
window.React = React
window.ReactDOM = ReactDOM
const opened = []
tabs.openTab = async (url) => { opened.push(url) }
async function mount() {
  const fixture = await fetch('/workspace-management-fixture').then((response) => response.json())
  await renderAmisSchema(document.getElementById('workspace-harness'), fixture, {})
  window.workspaceHarness = { ready: true, opened }
}
mount().catch((error) => { document.body.textContent = error.stack })
