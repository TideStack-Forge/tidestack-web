import React from 'react'
import ReactDOM from 'react-dom'

import { renderAmisSchema } from '@/components/amis/AmisComponent'

window.React = React
window.ReactDOM = ReactDOM

const statusElement = document.getElementById('form-smart-layout-playwright-status')
const editorRoot = document.getElementById('form-smart-layout-editor-root')

function buildInputTableSchema() {
  return {
    type: 'input-table',
    name: 'items',
    label: false,
    addable: false,
    editable: false,
    columns: [
      {
        type: 'input-text',
        name: 'inspectionItem',
        label: '检查项',
      },
    ],
  }
}

function buildBody(fieldsetBody) {
  return [
    {
      type: 'input-text',
      name: 'name',
      label: '标准名称',
    },
    {
      type: 'input-text',
      name: 'vehicleType',
      label: '适用车辆类型',
    },
    {
      type: 'radios',
      name: 'enabled',
      label: '启用',
      options: [
        { label: '启用', value: true },
        { label: '停用', value: false },
      ],
    },
    {
      type: 'input-text',
      name: 'remark',
      label: '说明',
    },
    {
      type: 'mapping',
      name: 'status',
      label: '状态',
      map: {
        ACTIVE: '启用',
        INACTIVE: '停用',
      },
    },
    {
      type: 'map',
      name: 'statusAlias',
      label: '状态（别名）',
      map: {
        ACTIVE: '启用',
        INACTIVE: '停用',
      },
    },
    {
      type: 'fieldSet',
      title: '检查项目',
      body: fieldsetBody,
    },
  ]
}

function buildForm(className, fieldsetBody) {
  return {
    type: 'form',
    name: className,
    className,
    mode: 'horizontal',
    smartLayout: true,
    columnCount: 2,
    labelWidth: 120,
    body: buildBody(fieldsetBody),
  }
}

const harnessSchema = {
  type: 'page',
  body: [
    buildForm('form-smart-layout-direct-table', buildInputTableSchema()),
    buildForm('form-smart-layout-service-table', {
      type: 'service',
      api: '/api/form-smart-layout/items',
      body: buildInputTableSchema(),
    }),
  ],
}

async function mountHarness() {
  statusElement.textContent = 'Rendering form smart layout harness...'

  await renderAmisSchema(
    editorRoot,
    harnessSchema,
    {
      data: {
        items: [{ inspectionItem: '安全带' }],
        status: 'ACTIVE',
        statusAlias: 'INACTIVE',
      },
    },
    {
      fetcher: async () => ({
        ok: true,
        data: {
          items: [{ inspectionItem: '安全带' }],
        },
      }),
    }
  )

  window.__FORM_SMART_LAYOUT_PLAYWRIGHT_HARNESS__ = { ready: true }
  statusElement.textContent = 'Form smart layout harness ready'
}

mountHarness().catch((error) => {
  console.error(error)
  statusElement.textContent = `Form smart layout harness failed: ${error.message}`
})
