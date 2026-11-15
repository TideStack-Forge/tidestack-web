import React from 'react'
import ReactDOM from 'react-dom'
import { registerComponentLibrary } from '@/common/micro/registerComponentLibrary'
import { renderAmisSchema } from '@/components/amis/AmisComponent'

window.React = React
window.ReactDOM = ReactDOM

const statusElement = document.getElementById('approval-workflow-playwright-status')
const componentLibraryRoot = document.getElementById('approval-workflow-component-library-root')
const editorRoot = document.getElementById('approval-workflow-editor-root')

const workflowDefinitionFixture = {
  formatVersion: 2,
  id: 'main-app-flow-v2',
  name: '主应用审批流',
  formType: 'default',
  formKey: 'purchase',
  nodes: [
    {
      id: 'start-main-app',
      type: '发起节点',
      name: '发起节点',
    },
    {
      id: 'approve-main-app',
      type: '审批节点',
      name: '经理审批',
      subType: '单签',
      candidates: [{ type: 'user', value: 'u1' }],
    },
  ],
  edges: [
    {
      id: 'edge-main-app-1',
      type: 'SEQUENCE',
      sourceId: 'start-main-app',
      targetId: 'approve-main-app',
    },
  ],
}

const harnessSchema = {
  type: 'page',
  body: [
    {
      type: 'workflow-editor',
      name: 'workflowDefinition',
      showBaseInfo: true,
      showSaveButton: true,
    },
  ],
}

async function mountHarness() {
  statusElement.textContent = 'Loading approval workflow component library...'

  await registerComponentLibrary(
    {
      name: 'approval-workflow-designer-playwright',
      entry: '/micro-workflow-editor/',
    },
    {
      awaitMount: true,
      parentContainer: componentLibraryRoot,
    }
  )

  statusElement.textContent = 'Rendering approval workflow editor...'

  await renderAmisSchema(editorRoot, harnessSchema, {
    data: {
      id: workflowDefinitionFixture.id,
      flowKey: workflowDefinitionFixture.id,
      mode: 'edit',
      workflowDefinition: workflowDefinitionFixture,
    },
  })

  statusElement.textContent = 'Approval workflow editor ready'
}

mountHarness().catch((error) => {
  console.error(error)
  statusElement.textContent = `Approval workflow harness failed: ${error.message}`
})
