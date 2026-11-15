import React from 'react'
import ReactDOM from 'react-dom'

import { renderAmisSchema } from '@/components/amis/AmisComponent'

window.React = React
window.ReactDOM = ReactDOM

const statusElement = document.getElementById('business-model-populate-playwright-status')
const editorRoot = document.getElementById('business-model-populate-editor-root')
const snapshotElement = document.getElementById('business-model-populate-live-data')

const HARNESS_FORM_NAME = 'businessModelPopulateHarnessForm'

const staticMeta = {
  'crm.order': {
    model: { name: 'crm.order', label: '订单' },
    fields: [
      { name: 'orderNo', label: '订单号', type: 'text' },
      {
        name: 'status',
        label: '状态',
        type: 'select',
        options: [
          { label: '待审核', value: 'PENDING' },
          { label: '已完成', value: 'DONE' },
        ],
      },
      { name: 'totalAmount', label: '订单金额', type: 'number' },
      { name: 'createdAt', label: '创建时间', type: 'datetime' },
    ],
    relations: [
      {
        name: 'customer',
        label: '客户',
        targetModel: 'crm.customer',
        targetModelLabel: '客户',
        type: 'model',
      },
      {
        name: 'owner',
        label: '负责人',
        targetModel: 'sys.user',
        targetModelLabel: '用户',
        type: 'model',
      },
      {
        name: 'items',
        label: '订单明细',
        targetModel: 'crm.order-item',
        targetModelLabel: '订单明细',
        type: 'list',
      },
      {
        name: 'auditLogs',
        label: '审计日志',
        targetModel: 'crm.audit-log',
        targetModelLabel: '审计日志',
        type: 'list',
      },
    ],
  },
  'crm.customer': {
    model: { name: 'crm.customer', label: '客户' },
    fields: [
      { name: 'name', label: '客户名称', type: 'text' },
      {
        name: 'level',
        label: '客户等级',
        type: 'select',
        options: [
          { label: '普通', value: 'NORMAL' },
          { label: '重点', value: 'VIP' },
        ],
      },
      { name: 'city', label: '城市', type: 'text' },
    ],
    relations: [
      {
        name: 'accountManager',
        label: '客户经理',
        targetModel: 'sys.user',
        targetModelLabel: '用户',
        type: 'model',
      },
    ],
  },
  'crm.order-item': {
    model: { name: 'crm.order-item', label: '订单明细' },
    fields: [
      { name: 'sku', label: 'SKU', type: 'text' },
      { name: 'quantity', label: '数量', type: 'number' },
      { name: 'price', label: '单价', type: 'number' },
      {
        name: 'status',
        label: '明细状态',
        type: 'select',
        options: [
          { label: '有效', value: 'ACTIVE' },
          { label: '作废', value: 'VOID' },
        ],
      },
    ],
    relations: [
      {
        name: 'product',
        label: '产品',
        targetModel: 'crm.product',
        targetModelLabel: '产品',
        type: 'model',
      },
    ],
  },
  'crm.product': {
    model: { name: 'crm.product', label: '产品' },
    fields: [
      { name: 'id', label: '产品 ID', type: 'text' },
      { name: 'name', label: '产品名称', type: 'text' },
      { name: 'category', label: '产品分类', type: 'text' },
      { name: 'listPrice', label: '标价', type: 'number' },
      { name: 'costPrice', label: '成本价', type: 'number' },
    ],
    relations: [
      {
        name: 'brand',
        label: '品牌',
        targetModel: 'crm.brand',
        targetModelLabel: '品牌',
        type: 'model',
      },
    ],
  },
  'crm.audit-log': {
    model: { name: 'crm.audit-log', label: '审计日志' },
    fields: [
      { name: 'id', label: '日志 ID', type: 'text' },
      { name: 'action', label: '动作', type: 'text' },
      { name: 'operator', label: '操作人', type: 'text' },
      { name: 'createdAt', label: '操作时间', type: 'datetime' },
    ],
    relations: [
      {
        name: 'operatorUser',
        label: '操作用户',
        targetModel: 'sys.user',
        targetModelLabel: '用户',
        type: 'model',
      },
    ],
  },
  'sys.user': {
    model: { name: 'sys.user', label: '用户' },
    fields: [
      { name: 'id', label: '用户 ID', type: 'text' },
      { name: 'nickname', label: '昵称', type: 'text' },
      { name: 'email', label: '邮箱', type: 'text' },
      {
        name: 'status',
        label: '用户状态',
        type: 'select',
        options: [
          { label: '启用', value: 'ENABLED' },
          { label: '停用', value: 'DISABLED' },
        ],
      },
    ],
    relations: [
      {
        name: 'department',
        label: '部门',
        targetModel: 'sys.department',
        targetModelLabel: '部门',
        type: 'model',
      },
    ],
  },
  'sys.department': {
    model: { name: 'sys.department', label: '部门' },
    fields: [
      { name: 'name', label: '部门名称', type: 'text' },
      { name: 'code', label: '部门编码', type: 'text' },
    ],
    relations: [],
  },
  'crm.brand': {
    model: { name: 'crm.brand', label: '品牌' },
    fields: [
      { name: 'name', label: '品牌名', type: 'text' },
      { name: 'country', label: '国家', type: 'text' },
    ],
    relations: [],
  },
}

const initialHarnessData = {
  rootModelRef: 'crm.order',
  rootWhereValue: {
    status: 'PENDING',
    totalAmount: { $gte: 1000 },
  },
  populateValue: [
    'customer',
    {
      owner: ['id', 'nickname'],
    },
    {
      items: {
        where: {
          status: 'ACTIVE',
          quantity: { $gte: 1 },
        },
        populate: {
          product: {
            omit: ['costPrice'],
          },
        },
      },
    },
  ],
}

const harnessSchema = {
  type: 'page',
  title: 'Populate / Where 编辑器 Smoke Harness',
  subTitle: '使用静态模型元数据挂载通用组件，便于页面级 smoke 与截图验证。',
  body: [
    {
      type: 'alert',
      level: 'info',
      showIcon: true,
      body: '左侧是真实渲染的 AMIS 编辑器，右侧会实时回显当前序列化结果，用于核对 populate 与 where 透传形态。',
    },
    {
      type: 'form',
      name: HARNESS_FORM_NAME,
      id: HARNESS_FORM_NAME,
      wrapWithPanel: false,
      mode: 'horizontal',
      submitOnChange: true,
      body: [
        {
          type: 'hidden',
          name: 'rootModelRef',
        },
        {
          type: 'fieldSet',
          title: 'Standalone Where',
          className: 'business-model-populate-standalone-where',
          body: [
            {
              type: 'where-editor',
              name: 'rootWhereValue',
              label: 'Where',
              modelMetaProvider: {
                modelRefKey: 'rootModelRef',
                staticMeta,
              },
            },
          ],
        },
        {
          type: 'fieldSet',
          title: 'Populate Editor',
          className: 'business-model-populate-editor-section',
          body: [
            {
              type: 'populate-editor',
              name: 'populateValue',
              label: 'Populate',
              modelMetaProvider: {
                modelRefKey: 'rootModelRef',
                staticMeta,
              },
            },
          ],
        },
      ],
    },
  ],
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function getHarnessForm(scopeRef) {
  return (
    scopeRef?.getComponentByName?.(HARNESS_FORM_NAME) ||
    scopeRef?.getComponentById?.(HARNESS_FORM_NAME) ||
    null
  )
}

function readHarnessValues(scopeRef) {
  const form = getHarnessForm(scopeRef)
  if (!form?.getValues) {
    return null
  }
  return cloneValue(form.getValues())
}

function updateSnapshot(scopeRef) {
  const values = readHarnessValues(scopeRef)
  snapshotElement.textContent = values
    ? JSON.stringify(values, null, 2)
    : 'Harness form is not ready.'
}

function createHarnessDebugApi(scopeRef) {
  return {
    ready: false,
    getValues() {
      return readHarnessValues(scopeRef)
    },
    setValues(nextValues, replace = false) {
      const form = getHarnessForm(scopeRef)
      form?.setValues?.(cloneValue(nextValues), replace)
      updateSnapshot(scopeRef)
    },
    reset() {
      const form = getHarnessForm(scopeRef)
      form?.setValues?.(cloneValue(initialHarnessData), true)
      updateSnapshot(scopeRef)
    },
  }
}

async function waitForHarnessForm(scopeRef, timeoutMs = 5000) {
  const startAt = Date.now()

  while (Date.now() - startAt <= timeoutMs) {
    const form = getHarnessForm(scopeRef)
    if (form?.getValues) {
      return form
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100))
  }

  return null
}

async function mountHarness() {
  statusElement.textContent = 'Rendering business model populate harness...'

  const rendered = await renderAmisSchema(editorRoot, harnessSchema, {
    data: cloneValue(initialHarnessData),
  })

  const scopeRef = rendered.getScopeRef()
  const form = await waitForHarnessForm(scopeRef)
  if (!form?.getValues) {
    throw new Error('Harness form did not register correctly')
  }

  const harnessApi = createHarnessDebugApi(scopeRef)
  window.__BUSINESS_MODEL_POPULATE_PLAYWRIGHT_HARNESS__ = harnessApi

  updateSnapshot(scopeRef)
  const poller = window.setInterval(() => updateSnapshot(scopeRef), 150)
  window.addEventListener('beforeunload', () => window.clearInterval(poller), {
    once: true,
  })

  harnessApi.ready = true
  statusElement.textContent = 'Business model populate harness ready'
}

mountHarness().catch((error) => {
  console.error(error)
  statusElement.textContent = `Business model populate harness failed: ${error.message}`
  snapshotElement.textContent = `Harness failed: ${error.message}`
})
