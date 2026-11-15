import { renderAmisSchema } from '@/components/amis/AmisComponent'

const statusElement = document.getElementById('input-table-lazy-delete-status')
const editorRoot = document.getElementById('input-table-lazy-delete-editor-root')
const snapshotElement = document.getElementById('input-table-lazy-delete-live-data')

const ROW_COUNT = 40
const METRIC_COLUMN_COUNT = 22

const lazyDeleteRows = Array.from({ length: ROW_COUNT }, (_, index) => {
  const row = {
    id: `row-${index + 1}`,
    code: `ROW-${String(index + 1).padStart(2, '0')}`,
    name: `Lazy Row ${index + 1}`,
  }

  for (let metricIndex = 1; metricIndex <= METRIC_COLUMN_COUNT; metricIndex += 1) {
    row[`metric${metricIndex}`] = `${index + 1}-${metricIndex}`
  }

  return row
})

const metricColumns = Array.from({ length: METRIC_COLUMN_COUNT }, (_, index) => {
  const metricIndex = index + 1

  return {
    name: `metric${metricIndex}`,
    label: `M${metricIndex}`,
    type: 'tpl',
    tpl: `\${metric${metricIndex}}`,
    width: 72,
  }
})

let currentRows = cloneValue(lazyDeleteRows)
let previousTbody = null
let tbodyReplacementCount = 0
let previousRowSignature = ''
let previousRowNodesByKey = new Map()
let lastDomChange = {
  currentFirstRowKey: null,
  previousFirstRowKey: null,
  retainedRowNodeCount: 0,
}

function buildHarnessSchema() {
  return {
    type: 'page',
    title: 'Input Table Lazy Delete Harness',
    body: [
      {
        type: 'input-table',
        name: 'lazyDeleteRows',
        label: '宽表 + 行级懒渲染 + 删除按钮',
        className: 'input-table-lazy-delete-case',
        addable: false,
        editable: false,
        removable: true,
        needConfirm: false,
        showIndex: true,
        lazyRenderAfter: 3,
        tableContentClassName: 'input-table-lazy-delete-scroll',
        deleteBtnLabel: '删除',
        value: currentRows,
        columns: [
          {
            name: 'code',
            label: '编码',
            type: 'tpl',
            tpl: '${code}',
            width: 110,
          },
          {
            name: 'name',
            label: '名称',
            type: 'tpl',
            tpl: '${name}',
            width: 140,
          },
          ...metricColumns,
        ],
      },
    ],
  }
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function getRowKey(row, index) {
  return (
    row.getAttribute('data-lazy-row-key') ||
    row.getAttribute('data-index') ||
    row.textContent?.match(/ROW-\d+/)?.[0] ||
    `dom-index-${index}`
  )
}

function readCurrentTableState() {
  const table = editorRoot.querySelector('.input-table-lazy-delete-case')
  const tbody = table?.querySelector('tbody') || null
  const rows = Array.from(tbody?.querySelectorAll('tr') || [])
  const rowKeys = rows.map(getRowKey)
  const rowNodesByKey = new Map(rowKeys.map((key, index) => [key, rows[index]]))

  return {
    table,
    tbody,
    rows,
    rowKeys,
    rowNodesByKey,
    rowSignature: rowKeys.join('|'),
  }
}

function resetDomTrackingBaseline() {
  const { tbody, rowKeys, rowNodesByKey, rowSignature } = readCurrentTableState()

  previousTbody = tbody
  tbodyReplacementCount = 0
  previousRowSignature = rowSignature
  previousRowNodesByKey = rowNodesByKey
  lastDomChange = {
    currentFirstRowKey: rowKeys[0] || null,
    previousFirstRowKey: null,
    retainedRowNodeCount: rowKeys.length,
  }
}

function readDomSummary() {
  const { table, tbody, rows, rowKeys, rowNodesByKey, rowSignature } =
    readCurrentTableState()
  const deleteButtons = Array.from(table?.querySelectorAll('button') || []).filter(
    (button) => /删除/.test(button.textContent || '') || button.querySelector('svg')
  )

  if (tbody && previousTbody && tbody !== previousTbody) {
    tbodyReplacementCount += 1
  }
  if (tbody) {
    previousTbody = tbody
  }

  if (rowSignature !== previousRowSignature) {
    const retainedRowNodeCount = rowKeys.filter(
      (key) => previousRowNodesByKey.get(key) === rowNodesByKey.get(key)
    ).length
    const previousFirstRowKey = previousRowSignature.split('|').filter(Boolean)[0] || null

    lastDomChange = {
      currentFirstRowKey: rowKeys[0] || null,
      previousFirstRowKey,
      retainedRowNodeCount: previousRowSignature
        ? retainedRowNodeCount
        : rowKeys.length,
    }
    previousRowSignature = rowSignature
  }
  previousRowNodesByKey = rowNodesByKey

  return {
    domRows: rows.length,
    visibleDeleteButtons: deleteButtons.length,
    tbodyReplacementCount,
    lastDomChange,
    visibleRowKeys: rowKeys.slice(0, 8),
    firstVisibleRow: rows[0]?.textContent?.replace(/\s+/g, ' ').trim() || null,
    lastVisibleRow: rows[rows.length - 1]?.textContent?.replace(/\s+/g, ' ').trim() || null,
  }
}

function updateSnapshot() {
  snapshotElement.textContent = JSON.stringify(
    {
      valueRowCount: currentRows.length,
      firstValueRow: currentRows[0]?.code ?? null,
      lastValueRow: currentRows[currentRows.length - 1]?.code ?? null,
      ...readDomSummary(),
    },
    null,
    2
  )
}

async function waitForRenderedTable(timeoutMs = 10000) {
  const startAt = Date.now()

  while (Date.now() - startAt <= timeoutMs) {
    if (editorRoot.querySelector('.input-table-lazy-delete-case tbody tr')) {
      return true
    }
    await new Promise((resolve) => window.setTimeout(resolve, 100))
  }

  return false
}

async function mountHarness() {
  statusElement.textContent = 'Rendering input-table lazy delete harness...'

  const rendered = await renderAmisSchema(editorRoot, buildHarnessSchema(), {
    data: {
      lazyDeleteRows: currentRows,
    },
    onChange(nextValue) {
      if (Array.isArray(nextValue)) {
        currentRows = cloneValue(nextValue)
        updateSnapshot()
      }
    },
  })
  const tableRendered = await waitForRenderedTable()

  if (!tableRendered) {
    throw new Error('Input-table lazy delete table did not render')
  }
  resetDomTrackingBaseline()

  const harnessApi = {
    ready: true,
    getValues() {
      return {
        lazyDeleteRows: cloneValue(currentRows),
      }
    },
    getSummary() {
      return {
        values: {
          lazyDeleteRows: cloneValue(currentRows),
        },
        dom: readDomSummary(),
      }
    },
  }

  window.__INPUT_TABLE_LAZY_DELETE_HARNESS__ = harnessApi

  updateSnapshot()
  const poller = window.setInterval(updateSnapshot, 250)
  const baselineResetTimer = window.setTimeout(() => {
    resetDomTrackingBaseline()
    updateSnapshot()
  }, 1500)
  window.addEventListener(
    'beforeunload',
    () => {
      window.clearInterval(poller)
      window.clearTimeout(baselineResetTimer)
    },
    {
      once: true,
    }
  )

  statusElement.textContent = 'Input-table lazy delete harness ready'
}

mountHarness().catch((error) => {
  console.error(error)
  statusElement.textContent = `Input-table lazy delete harness failed: ${error.message}`
  snapshotElement.textContent = `Harness failed: ${error.message}`
})
