import React from 'react'
import ReactDOM from 'react-dom'

import { renderAmisSchema } from '@/components/amis/AmisComponent'

window.React = React
window.ReactDOM = ReactDOM

const statusElement = document.getElementById(
  'crud-filter-smart-layout-playwright-status'
)
const editorRoot = document.getElementById('crud-filter-smart-layout-editor-root')

const rows = [
  { id: 1, name: '样例 A', status: 'ready' },
  { id: 2, name: '样例 B', status: 'draft' },
]

function selectField(name, label) {
  return {
    type: 'select',
    name,
    label,
    options: [
      { label: '全部', value: '' },
      { label: `${label} A`, value: 'a' },
      { label: `${label} B`, value: 'b' },
    ],
  }
}

function textField(name, label) {
  return {
    type: 'input-text',
    name,
    label,
  }
}

function dateField(name, label) {
  return {
    type: 'input-date',
    name,
    label,
  }
}

function dateTimeRangeField(name, label) {
  return {
    type: 'input-datetime-range',
    name,
    label,
  }
}

function buildScenarioFilter(scenario) {
  if (scenario === 'wide-grid') {
    return {
      smartLayout: { labelStyle: 'label' },
      body: [
        {
          ...selectField('weighingTimeType', '称重时间模式'),
          placeholder: '请选择时间模式',
          columnClassName:
            'crud-filter-item crud-filter-item--field crud-filter-item--span-1 crud-filter-item--wide-candidate',
        },
        dateTimeRangeField('weighingAt', '称重时间'),
        selectField('companyId', '公司'),
        selectField('supplierId', '供应商'),
        textField('keyword', '关键字'),
        selectField('status', '状态'),
      ],
    }
  }

  if (scenario === 'wmp') {
    return {
      smartLayout: { labelStyle: 'label' },
      body: [
        dateTimeRangeField('finishTime', '完成时间'),
        selectField('companyId', '公司'),
        selectField('supplierId', '供应商'),
        textField('keyword', '关键字'),
        dateField('bizDate', '业务日期'),
        selectField('status', '状态'),
        textField('owner', '负责人'),
        selectField('department', '部门'),
      ],
    }
  }

  if (scenario === 'w1e') {
    return {
      smartLayout: { labelStyle: 'label' },
      body: [
        selectField('companyId', '公司'),
        selectField('supplierId', '供应商'),
        textField('keyword', '关键字'),
        dateField('bizDate', '业务日期'),
        dateTimeRangeField('finishTime', '完成时间'),
      ],
    }
  }

  return {
    smartLayout: { labelStyle: 'label' },
    body: [
      selectField('companyId', '公司'),
      selectField('supplierId', '供应商'),
      dateTimeRangeField('finishTime', '完成时间'),
    ],
  }
}

function buildCrudSchema(scenario) {
  return {
    type: 'crud',
    className: `crud-filter-smart-layout-scenario crud-filter-smart-layout-scenario--${scenario}`,
    api: '/api/crud-filter-smart-layout/list',
    filter: {
      ...buildScenarioFilter(scenario),
      actions: [
        { type: 'submit', label: '查询', level: 'primary' },
        { type: 'reset', label: '重置' },
      ],
    },
    headerToolbar: [],
    footerToolbar: [],
    columns: [
      { name: 'id', label: 'ID' },
      { name: 'name', label: '名称' },
      { name: 'status', label: '状态' },
    ],
  }
}

function buildHarnessSchema(scenario) {
  return {
    type: 'page',
    body: [buildCrudSchema(scenario)],
  }
}

function waitForLayout() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
}

function readMetrics() {
  const panel = editorRoot.querySelector('.cxd-Crud-filter.cxd-Crud-filter--flat')
  const form = panel?.querySelector('.cxd-Form')
  const fieldItems = Array.from(editorRoot.querySelectorAll('.crud-filter-item--field'))
  const mobileFieldItems = Array.from(
    editorRoot.querySelectorAll('.crud-filter-item--mobile-stacked')
  )
  const formItems = Array.from(editorRoot.querySelectorAll('.cxd-Form-item'))
  const dateRange = editorRoot.querySelector('.cxd-DateRangeControl.is-datetime')
  const dateItem = dateRange?.closest(
    '.crud-filter-item--wide-head, .crud-filter-item--field, .crud-filter-wide-tooltip, .cxd-Form-item'
  )
  const toolbar = editorRoot.querySelector(
    '.crud-filter-toolbar, .crud-filter-toolbar-item'
  )
  const fillWidthControls = Array.from(
    editorRoot.querySelectorAll('.crud-filter-control--fill-width')
  )
  const visibleFillWidthControls = Array.from(
    editorRoot.querySelectorAll(
      [
        '.crud-filter-control--fill-width',
        '.crud-filter-control--fill-width > .cxd-Select',
        '.crud-filter-control--fill-width > .cxd-TextControl-input',
        '.crud-filter-control--fill-width > .cxd-DateRangePicker',
        '.crud-filter-control--fill-width > .cxd-DatePicker',
      ].join(', ')
    )
  )
  const toolbarButtons = Array.from(
    editorRoot.querySelectorAll(
      '.crud-filter-toolbar--mobile-stacked .cxd-ButtonToolbar > .cxd-Button'
    )
  )
  const formBox = form?.getBoundingClientRect()
  const dateBox = dateRange?.getBoundingClientRect()
  const dateItemBox = dateItem?.getBoundingClientRect()
  const filterRow = panel?.querySelector('.cxd-Form-row')
  const fieldColumns = Array.from(filterRow?.children || []).filter((item) =>
    item.classList?.contains('crud-filter-item--field')
  )
  const readRect = (node) => {
    const rect = node?.getBoundingClientRect?.()

    return rect
      ? {
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
        }
      : null
  }

  return {
    formClassName: form?.className || '',
    columnRects: fieldColumns.map(readRect),
    labelRects: fieldColumns.map((item) =>
      readRect(item.querySelector('.cxd-Form-label'))
    ),
    crudClassNames: Array.from(editorRoot.querySelectorAll('[class*="crud-filter"]')).map(
      (item) => item.className
    ),
    formModeClassName: Array.from(form?.classList || []).filter((className) =>
      className.includes('cxd-Form--')
    ),
    formColumns:
      form?.style.getPropertyValue('--crud-filter-columns') ||
      (form
        ? getComputedStyle(form).getPropertyValue('--crud-filter-columns').trim()
        : ''),
    panelBackground: panel ? getComputedStyle(panel).backgroundColor : '',
    formItemBackgrounds: formItems.map((item) => getComputedStyle(item).backgroundColor),
    fieldWidths: fieldItems.map((item) => Math.round(item.getBoundingClientRect().width)),
    mobileFieldWidths: mobileFieldItems.map((item) =>
      Math.round(item.getBoundingClientRect().width)
    ),
    fillControlWidths: fillWidthControls.map((item) =>
      Math.round(item.getBoundingClientRect().width)
    ),
    visibleFillControlWidths: visibleFillWidthControls.map((item) =>
      Math.round(item.getBoundingClientRect().width)
    ),
    toolbarButtonWidths: toolbarButtons.map((item) =>
      Math.round(item.getBoundingClientRect().width)
    ),
    formWidth: formBox ? Math.round(formBox.width) : 0,
    dateRangeWidth: dateBox ? Math.round(dateBox.width) : 0,
    dateItemWidth: dateItemBox ? Math.round(dateItemBox.width) : 0,
    dateRangeClassName: dateRange?.className || '',
    dateItemClassName: dateItem?.className || '',
    toolbarClassName: toolbar?.className || '',
  }
}

let renderHandle = null

async function renderScenario(scenario, width) {
  editorRoot.style.width = `${width}px`
  editorRoot.style.maxWidth = `${width}px`
  editorRoot.style.padding = '0'

  const schema = buildHarnessSchema(scenario)
  const props = {
    data: {
      SystemConfig: {
        ui: {
          crud: {
            filter: {
              smartLayout: {
                enabled: true,
                labelStyle: 'label',
                fieldsPerRow: {
                  desktop: 5,
                  narrow: 4,
                  mobile: 1,
                },
              },
            },
          },
        },
      },
    },
  }
  const env = {
    fetcher: async () => ({
      ok: true,
      status: 200,
      data: {
        status: 0,
        msg: '',
        data: {
          items: rows,
          total: rows.length,
        },
      },
    }),
  }

  if (renderHandle) {
    renderHandle.destroy()
    renderHandle = null
  }

  renderHandle = await renderAmisSchema(editorRoot, schema, props, env)

  await waitForLayout()
  await waitForLayout()
  statusElement.textContent = `CRUD filter smart layout harness ready: ${scenario}`
}

async function mountHarness() {
  statusElement.textContent = 'Rendering CRUD filter smart layout harness...'

  const harnessApi = {
    ready: false,
    renderScenario,
    readMetrics,
  }
  window.__CRUD_FILTER_SMART_LAYOUT_PLAYWRIGHT_HARNESS__ = harnessApi

  await renderScenario('c1p', 1742)
  harnessApi.ready = true
  statusElement.textContent = 'CRUD filter smart layout harness ready'
}

mountHarness().catch((error) => {
  console.error(error)
  statusElement.textContent = `CRUD filter smart layout harness failed: ${error.message}`
})
