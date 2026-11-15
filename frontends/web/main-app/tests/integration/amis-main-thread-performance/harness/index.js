import React from 'react'
import ReactDOM from 'react-dom'
import { getActionByType } from 'amis-core'
import * as amisFactory from 'amis-core/lib/factory'
import { makeTranslator } from 'amis-core/lib/locale'
import { SchemaRenderer } from 'amis-core/lib/SchemaRenderer'
import { TableRendererBase } from 'amis/lib/renderers/Table/index'
import { TableBody as AmisTableBody } from 'amis/lib/renderers/Table/TableBody'
import { TableControlRenderer } from 'amis/lib/renderers/Form/InputTable'
import { FormRendererBase } from 'amis-core/lib/renderers/Form'

import { renderAmisSchema } from '@/components/amis/AmisComponent'
import OuroborosTableRenderer from '@/components/amis/renderers/patch/Table'
import { configAxios } from '@/utils/http'

import performanceData from '../fixtures/performanceData'
import {
  createChecksum,
  createPerformanceMetrics,
  waitForPaints,
} from '../helpers/performanceMetrics'
import { installAmisMainThreadPerformanceAxiosInstrumentation } from '../helpers/axiosTransformInstrumentation'
import { installMstActionInstrumentation } from '../helpers/mstActionInstrumentation'

window.React = React
window.ReactDOM = ReactDOM

const {
  CRUD_COLUMNS,
  INPUT_TABLE_COLUMNS,
  createDialogFormSchema,
  createRealFormData,
  makeRows,
} = performanceData

const statusElement = document.getElementById('amis-main-thread-performance-status')
const editorRoot = document.getElementById('amis-main-thread-performance-editor-root')
const metrics = createPerformanceMetrics()
const attribution = createPerformanceAttribution()

let rendered = null
let cleanupAxiosInstrumentation = null
let cleanupStoreInstrumentation = null
let tablePhaseSequence = 0
let actionPhaseSequence = 0
let attributionInstrumentationStatus = []

function roundMetric(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000
}

function safeSchemaType(schema) {
  if (Array.isArray(schema)) {
    return 'array'
  }
  return typeof schema?.type === 'string' ? schema.type : 'unknown'
}

function safeColumnType(column) {
  return typeof column?.type === 'string' ? column.type : 'text'
}

function createAttributionKey(category, detail = {}) {
  return [
    category,
    detail.schemaType,
    detail.rendererName,
    detail.columnType,
    detail.columnName,
    detail.lookupName,
    detail.safeStatic === true ? 'safe-static' : null,
  ]
    .filter(Boolean)
    .join('|')
}

function summarizeAttributionRecords(records) {
  const byCategory = new Map()
  const byKey = new Map()
  let totalDurationMs = 0
  let maxDurationMs = 0

  for (const record of records) {
    totalDurationMs += record.durationMs
    maxDurationMs = Math.max(maxDurationMs, record.durationMs)

    const category = byCategory.get(record.category) || {
      category: record.category,
      count: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
    }
    category.count += 1
    category.totalDurationMs += record.durationMs
    category.maxDurationMs = Math.max(category.maxDurationMs, record.durationMs)
    byCategory.set(record.category, category)

    const key = createAttributionKey(record.category, record.detail)
    const bucket = byKey.get(key) || {
      key,
      category: record.category,
      detail: record.detail,
      count: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
    }
    bucket.count += 1
    bucket.totalDurationMs += record.durationMs
    bucket.maxDurationMs = Math.max(bucket.maxDurationMs, record.durationMs)
    byKey.set(key, bucket)
  }

  const normalize = (item) => ({
    ...item,
    totalDurationMs: roundMetric(item.totalDurationMs),
    maxDurationMs: roundMetric(item.maxDurationMs),
    avgDurationMs: roundMetric(item.totalDurationMs / Math.max(1, item.count)),
  })

  return {
    count: records.length,
    totalDurationMs: roundMetric(totalDurationMs),
    maxDurationMs: roundMetric(maxDurationMs),
    byCategory: Array.from(byCategory.values())
      .map(normalize)
      .sort((left, right) => right.totalDurationMs - left.totalDurationMs),
    topBuckets: Array.from(byKey.values())
      .map(normalize)
      .sort((left, right) => right.totalDurationMs - left.totalDurationMs)
      .slice(0, 20),
  }
}

function createPerformanceAttribution() {
  let records = []

  function reset() {
    records = []
  }

  function record(category, detail, startTime, durationMs) {
    records.push({
      category,
      detail,
      startTime,
      durationMs,
    })
  }

  function measure(category, detailFactory, callback, context, args) {
    const startTime = window.performance.now()
    try {
      return callback.apply(context, args)
    } finally {
      const durationMs = window.performance.now() - startTime
      const detail =
        typeof detailFactory === 'function' ? detailFactory(context, args) : detailFactory
      record(category, detail || {}, startTime, durationMs)
    }
  }

  function findWindow(marks, startName, endName) {
    const start = marks.find((mark) => mark.name === startName)
    const end = marks.find(
      (mark) => mark.name === endName && (!start || mark.time >= start.time)
    )
    if (!start || !end) {
      return {
        status: 'missing',
        startName,
        endName,
      }
    }
    return {
      status: 'ok',
      startName,
      endName,
      startTime: start.time,
      endTime: end.time,
      durationMs: end.time - start.time,
    }
  }

  function snapshot(marks) {
    const windows = {
      overall: {
        status: 'ok',
        startTime: records.length ? records[0].startTime : 0,
        endTime: records.length
          ? records[records.length - 1].startTime +
            records[records.length - 1].durationMs
          : 0,
        durationMs: records.length
          ? records[records.length - 1].startTime +
            records[records.length - 1].durationMs -
            records[0].startTime
          : 0,
      },
      firstScreen: findWindow(marks, 'fetcher-resolved', 'ready'),
      verticalSeek: findWindow(marks, 'vertical-seek-start', 'vertical-seek-settled'),
      verticalReturn: findWindow(
        marks,
        'vertical-return-start',
        'vertical-return-settled'
      ),
      horizontalSweep: findWindow(
        marks,
        'horizontal-sweep-start',
        'horizontal-sweep-end'
      ),
    }

    const windowSummaries = Object.fromEntries(
      Object.entries(windows).map(([name, window]) => {
        const windowRecords =
          window.status === 'ok'
            ? records.filter(
                (record) =>
                  record.startTime >= window.startTime &&
                  record.startTime <= window.endTime
              )
            : []
        return [
          name,
          {
            ...window,
            durationMs: roundMetric(window.durationMs),
            attribution: summarizeAttributionRecords(windowRecords),
          },
        ]
      })
    )
    return {
      instrumentationStatus: attributionInstrumentationStatus,
      windows: windowSummaries,
    }
  }

  return {
    measure,
    reset,
    snapshot,
  }
}

function wrapMethod(target, methodName, category, detailFactory) {
  const original = target?.[methodName]
  if (typeof original !== 'function' || original.__ouroborosAttributionInstrumented) {
    return false
  }

  function instrumentedMethod(...args) {
    return attribution.measure(category, detailFactory, original, this, args)
  }

  instrumentedMethod.__ouroborosAttributionInstrumented = true
  try {
    target[methodName] = instrumentedMethod
    return target[methodName] === instrumentedMethod
  } catch {
    return false
  }
}

function installAttributionInstrumentation() {
  const statuses = []
  statuses.push({
    target: 'OuroborosTableRenderer.renderCell',
    installed: wrapMethod(
      OuroborosTableRenderer?.prototype,
      'renderCell',
      'table-render-cell-total',
      (context, args) => {
        const column = args[1]
        const item = args[2]
        const safeStatic =
          typeof context?.canRenderSafeStaticTextCell === 'function'
            ? context.canRenderSafeStaticTextCell(column, item)
            : false
        return {
          columnName: column?.name || null,
          columnType: safeColumnType(column),
          fixed: column?.fixed || null,
          safeStatic,
        }
      }
    ),
  })
  statuses.push({
    target: 'TableRendererBase.renderCell',
    installed: wrapMethod(
      TableRendererBase?.prototype,
      'renderCell',
      'table-native-render-cell',
      (_context, args) => {
        const column = args[1]
        return {
          columnName: column?.name || null,
          columnType: safeColumnType(column),
          fixed: column?.fixed || null,
        }
      }
    ),
  })
  statuses.push({
    target: 'TableBody.renderRows',
    installed: wrapMethod(
      AmisTableBody?.prototype,
      'renderRows',
      'table-render-rows',
      (_context, args) => ({
        rowCount: Array.isArray(args[0]) ? args[0].length : 0,
        columnCount: Array.isArray(args[1]) ? args[1].length : 0,
      })
    ),
  })
  statuses.push({
    target: 'SchemaRenderer.resolveRenderer',
    installed: wrapMethod(
      SchemaRenderer?.prototype,
      'resolveRenderer',
      'schema-resolve-renderer',
      (_context, args) => {
        const props = args[0] || {}
        return {
          schemaType: safeSchemaType(props.schema),
          pathLength: String(props.$path || '').length,
        }
      }
    ),
  })
  statuses.push({
    target: 'SchemaRenderer.render',
    installed: wrapMethod(
      SchemaRenderer?.prototype,
      'render',
      'schema-render',
      (context) => ({
        schemaType: safeSchemaType(context?.props?.schema),
        rendererName: context?.renderer?.name || null,
      })
    ),
  })

  for (const [methodName, category, detailFactory] of [
    [
      'resolveRenderer',
      'renderer-registry-lookup',
      (_context, args) => ({
        schemaType: safeSchemaType(args[1]),
        pathLength: String(args[0] || '').length,
      }),
    ],
    [
      'filterSchema',
      'schema-filter',
      (_context, args) => ({
        schemaType: safeSchemaType(args[0]),
        rendererName: args[1]?.name || args[1]?.type || null,
      }),
    ],
    [
      'getRendererByName',
      'renderer-by-name-lookup',
      (_context, args) => ({
        lookupName: args[0] || null,
      }),
    ],
  ]) {
    statuses.push({
      target: `factory.${methodName}`,
      installed: wrapMethod(amisFactory, methodName, category, detailFactory),
    })
  }

  attributionInstrumentationStatus = statuses
}

installAttributionInstrumentation()

function markTablePhase(name, detail = {}) {
  window.__AMIS_MAIN_THREAD_PERF__?.mark?.(name, detail)
}

function installTablePhaseInstrumentation() {
  const tableClass = TableRendererBase
  if (tableClass.__ouroborosPerformanceInstrumented) {
    return
  }

  const originalSyncRows = tableClass.syncRows
  tableClass.syncRows = function instrumentedSyncRows(store, props, ...rest) {
    const token = `table-sync-rows-${tablePhaseSequence++}`
    const detail = {
      token,
      rowsBefore: store?.rows?.length || 0,
    }
    markTablePhase('table-sync-rows-start', detail)
    try {
      return originalSyncRows.call(this, store, props, ...rest)
    } finally {
      markTablePhase('table-sync-rows-end', {
        ...detail,
        rowsAfter: store?.rows?.length || 0,
      })
    }
  }

  const originalComponentDidUpdate = tableClass.prototype.componentDidUpdate
  tableClass.prototype.componentDidUpdate = function instrumentedComponentDidUpdate(
    prevProps
  ) {
    const token = `table-component-update-${tablePhaseSequence++}`
    const detail = {
      token,
      rowsBefore: this.props?.store?.rows?.length || 0,
    }
    markTablePhase('table-component-update-start', detail)
    try {
      return originalComponentDidUpdate.call(this, prevProps)
    } finally {
      markTablePhase('table-component-update-end', {
        ...detail,
        rowsAfter: this.props?.store?.rows?.length || 0,
      })
    }
  }

  tableClass.__ouroborosPerformanceInstrumented = true
}

installTablePhaseInstrumentation()

function installActionPhaseInstrumentation() {
  for (const registeredType of ['custom', 'component']) {
    const actionInstance = getActionByType(registeredType)
    if (!actionInstance || actionInstance.__ouroborosPerformanceInstrumented) {
      continue
    }
    const originalRun = actionInstance.run
    actionInstance.run = async function instrumentedActionRun(
      action,
      renderer,
      event,
      ...rest
    ) {
      const token = `amis-action-${actionPhaseSequence++}`
      const detail = {
        token,
        registeredType,
        actionType: action?.actionType,
        componentId: action?.componentId || null,
        componentName: action?.componentName || null,
      }
      markTablePhase('amis-action-start', detail)
      try {
        return await originalRun.call(this, action, renderer, event, ...rest)
      } finally {
        markTablePhase('amis-action-end', detail)
      }
    }
    actionInstance.__ouroborosPerformanceInstrumented = true
  }
}

function instrumentAsyncMethod(target, methodName, phaseName) {
  const original = target?.[methodName]
  if (typeof original !== 'function' || original.__ouroborosPerformanceInstrumented) {
    return
  }
  async function instrumentedMethod(...args) {
    const token = `${phaseName}-${actionPhaseSequence++}`
    const detail = { token }
    markTablePhase(`${phaseName}-start`, detail)
    try {
      return await original.apply(this, args)
    } finally {
      markTablePhase(`${phaseName}-end`, detail)
    }
  }
  instrumentedMethod.__ouroborosPerformanceInstrumented = true
  target[methodName] = instrumentedMethod
}

installActionPhaseInstrumentation()
instrumentAsyncMethod(
  TableControlRenderer.prototype,
  'setData',
  'input-table-set-data'
)
instrumentAsyncMethod(FormRendererBase.prototype, 'flush', 'form-flush')
instrumentAsyncMethod(FormRendererBase.prototype, 'validate', 'form-validate')
instrumentAsyncMethod(FormRendererBase.prototype, 'submit', 'form-submit')

function apiUrl(name) {
  return `/api/amis-main-thread-performance/${name}`
}

function createObserver(scenarioId, runId) {
  return {
    onFetcherEntered(event) {
      metrics.mark('fetcher-entered', {
        scenarioId,
        runId,
        url: event.url,
        method: event.method,
      })
    },
    onFetcherResolved(event) {
      metrics.mark('fetcher-resolved', {
        scenarioId,
        runId,
        url: event.url,
        method: event.method,
        status: event.status,
      })
    },
    onCommit(event) {
      const tableStates = readTableStoreStates()
      metrics.mark('react-commit', {
        scenarioId,
        runId,
        phase: event.phase,
        actualDuration: event.actualDuration,
        baseDuration: event.baseDuration,
        startTime: event.startTime,
        commitTime: event.commitTime,
        visibleBusinessRowCount: readBusinessRowCount(),
        tableStates,
      })
    },
  }
}

function markHarness(name, detail = {}) {
  metrics.mark(name, detail)
}

function normalizeColumnForFunctionalHash(column) {
  return {
    name: column.name || null,
    label: column.label || null,
    type: column.type || 'text',
    className: column.className || null,
    fixed: column.fixed || null,
  }
}

function createLoadScenarioFunctionalHash(scenarioId, rowCount, options = {}) {
  const columns = Array.isArray(options.columns)
    ? options.columns
    : scenarioId === 'C2'
    ? INPUT_TABLE_COLUMNS
    : CRUD_COLUMNS
  const rows = makeRows(rowCount, columns.length)

  return createChecksum({
    scenarioId,
    rowCount,
    columns: columns.map(normalizeColumnForFunctionalHash),
    firstRow: rows[0] || null,
    lastRow: rows[rows.length - 1] || null,
  })
}

function hasExpectedFirstRowValue(scenarioId, root = editorRoot, options = {}) {
  if (scenarioId === 'C2') {
    return readFirstInputTableValue(root) === 'row-1-value-0'
  }

  const rootText = root.textContent || ''
  if (options.fixtureProfile === 'raw-check') {
    return rootText.includes('RM203281810001')
  }

  return rootText.includes('row-1-value-0')
}

async function resetScenario(scenarioId, runId) {
  cleanupStoreInstrumentation?.()
  cleanupStoreInstrumentation = null
  cleanupAxiosInstrumentation?.()
  cleanupAxiosInstrumentation = installAmisMainThreadPerformanceAxiosInstrumentation(
    configAxios,
    {
      scenarioId,
      runId,
      onMark: (name, detail) => metrics.mark(name, detail),
    }
  )
  rendered?.destroy()
  rendered = null
  attribution.reset()
  metrics.reset()
  metrics.mark('scenario-start', { scenarioId, runId })
}

function appendQueryParam(url, name, value) {
  if (value === undefined || value === null || value === '') {
    return url
  }

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${encodeURIComponent(name)}=${encodeURIComponent(value)}`
}

function createCrudSchema(scenarioId, url, rowCount, options = {}) {
  const effectiveRowCount = rowCount || (scenarioId === 'C0' ? 20 : 2000)
  const columns = Array.isArray(options.columns)
    ? options.columns
    : CRUD_COLUMNS
  const effectiveUrl = appendQueryParam(
    url,
    'fixtureProfile',
    options.fixtureProfile
  )
  return {
    type: 'page',
    title: `${scenarioId} CRUD`,
    body: [
      {
        type: 'crud',
        name: `${scenarioId}Crud`,
        api: {
          method: 'get',
          url: effectiveUrl,
        },
        syncLocation: false,
        perPage: effectiveRowCount,
        perPageAvailable: Array.from(
          new Set([100, 200, 250, 500, 1000, effectiveRowCount])
        ),
        selectable: options.selectable === true,
        multiple: options.multiple === true,
        columnsTogglable: options.columnsTogglable === true,
        columns: columns.map((column) => ({
          ...column,
          type: column.type || 'text',
          tpl:
            column.type === 'tpl'
              ? column.tpl || `\${${column.name}}`
              : column.tpl,
        })),
      },
    ],
  }
}

function createInputTableFormSchema(scenarioId, rowCount, options = {}) {
  return {
    type: 'page',
    title: `${scenarioId} InputTable`,
    body: [
      {
        type: 'form',
        name: `${scenarioId}Form`,
        wrapWithPanel: false,
        initApi: {
          method: 'get',
          url: `${apiUrl('c2-input-table')}?rows=${rowCount}`,
        },
        body: [
          {
            type: 'input-table',
            name: 'lines',
            label: `${scenarioId} Lines`,
            needConfirm: false,
            addable: false,
            perPage: rowCount,
            columns: INPUT_TABLE_COLUMNS,
          },
        ],
      },
    ],
  }
}

function createDialogSchema() {
  const body = createDialogFormSchema(500)

  return {
    type: 'page',
    title: 'C3 Dialog',
    body: [
      {
        type: 'button',
        label: 'Open inline body dialog',
        actionType: 'dialog',
        dialog: {
          title: 'Inline Body Dialog',
          size: 'lg',
          ouroborosDialogScheduling: true,
          body,
        },
      },
      {
        type: 'button',
        label: 'Open lazy body dialog',
        actionType: 'dialog',
        dialog: {
          title: 'Lazy Body Dialog',
          size: 'lg',
          lazyRender: true,
          body,
        },
      },
      {
        type: 'button',
        label: 'Open amis-schema dialog',
        actionType: 'dialog',
        dialog: {
          title: 'Amis Schema Dialog',
          size: 'lg',
          schemaId: '/amis-main-thread-performance/dialog-form',
        },
      },
    ],
  }
}

function createSubmitSchema(variant, responseMode = 'empty', validationMode = 'unique-on') {
  const isAmisJson = variant === 'amis-json'
  const isUniqueEnabled = validationMode !== 'unique-off'
  const form = {
    type: 'form',
    name: 'submitForm',
    wrapWithPanel: false,
    api: {
      method: 'post',
      url: apiUrl(responseMode === 'echo' ? 'c4-echo' : 'c4-submit'),
      ...(isAmisJson ? { dataType: 'json' } : {}),
    },
    data: {
      lines: makeRows(1000, INPUT_TABLE_COLUMNS.length),
    },
    body: [
      {
        type: 'input-table',
        name: 'lines',
        label: 'Submit Lines',
        needConfirm: false,
        addable: false,
        columns: INPUT_TABLE_COLUMNS.map((column, index) => ({
          ...column,
          required: index === 0,
          unique: isUniqueEnabled && index === 0,
        })),
      },
    ],
  }

  return {
    type: 'page',
    title: `C4 Submit ${variant}`,
    body: [
      {
        type: 'button',
        actionType: 'dialog',
        label: 'Open Submit Dialog',
        dialog: {
          title: 'Complex Submit Dialog',
          size: 'lg',
          lazyRender: true,
          body: form,
          actions: [
            {
              type: 'button',
              actionType: 'close',
              label: 'Cancel Submit',
            },
            {
              type: 'button',
              actionType: 'confirm',
              label: 'Confirm Submit',
              level: 'primary',
            },
          ],
        },
      },
    ],
  }
}

function instrumentRequestAdaptor(script, variant) {
  if (typeof script !== 'string' || !script.trim()) {
    return script
  }
  const detail = JSON.stringify({ variant })
  return [
    `window.__AMIS_MAIN_THREAD_PERF__.mark('request-adaptor-start', ${detail});`,
    'try {',
    `  return (function () { ${script} }).call(this);`,
    '} finally {',
    `  window.__AMIS_MAIN_THREAD_PERF__.mark('request-adaptor-end', ${detail});`,
    '}',
  ].join('\n')
}

function createRealSubmitSchema(realForm, variant, rowCount) {
  const form = JSON.parse(JSON.stringify(realForm.schema))
  delete form.initApi
  form.wrapWithPanel = true
  form.closeDialogOnSubmit = false
  form.data = createRealFormData(rowCount)
  form.api = {
    ...(form.api || {}),
    method: 'post',
    url: apiUrl('c5-real-form-submit'),
  }
  if (form.api.requestAdaptor) {
    form.api.requestAdaptor = instrumentRequestAdaptor(
      form.api.requestAdaptor,
      variant
    )
  }

  return {
    type: 'page',
    title: `C5 Real Form ${variant}`,
    body: [
      {
        type: 'button',
        actionType: 'dialog',
        label: 'Open Real Form Dialog',
        dialog: {
          title: 'Real Complex Form',
          size: 'xl',
          ouroborosDialogScheduling: true,
          body: form,
          actions: [],
        },
      },
    ],
  }
}

async function waitForElement(selector, timeoutMs = 15000) {
  const startAt = Date.now()
  while (Date.now() - startAt < timeoutMs) {
    const element = document.querySelector(selector)
    if (element) {
      return element
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50))
  }
  throw new Error(`Timed out waiting for ${selector}`)
}

async function waitForButtonText(text, timeoutMs = 15000) {
  const startAt = Date.now()
  while (Date.now() - startAt < timeoutMs) {
    const button = Array.from(document.querySelectorAll('button')).find((item) =>
      item.textContent?.trim().includes(text)
    )
    if (button) {
      return button
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50))
  }
  throw new Error(`Timed out waiting for button text ${text}`)
}

async function waitForMetricMark(name, predicate = null, timeoutMs = 15000) {
  const startAt = Date.now()
  while (Date.now() - startAt < timeoutMs) {
    const snapshot = metrics.snapshot()
    if (
      snapshot.marks.some(
        (mark) => mark.name === name && (!predicate || predicate(mark.detail))
      )
    ) {
      return
    }
    await new Promise((resolve) => window.setTimeout(resolve, 50))
  }
  throw new Error(`Timed out waiting for metric mark ${name}`)
}

async function waitForRealFormTableData(expectedRowCount, root, timeoutMs = 60000) {
  const startAt = Date.now()
  let latestStates = []
  while (Date.now() - startAt < timeoutMs) {
    latestStates = readTableStoreStates()
    const tableStore = latestStates.find(
      (store) =>
        store.rowCount === expectedRowCount && store.pendingMaterialization === 0
    )
    const firstValue = root.querySelector('input[name="sortNum"]')?.value
    if (
      tableStore &&
      firstValue === '1' &&
      readBusinessRowCount(root) >= Math.min(expectedRowCount, 30)
    ) {
      return tableStore
    }
    await new Promise((resolve) => window.setTimeout(resolve, 16))
  }
  throw new Error(
    `Timed out waiting for real Form table: expectedRows=${expectedRowCount}, visibleBusinessRows=${readBusinessRowCount(
      root
    )}, stores=${JSON.stringify(latestStates)}`
  )
}

function readRealFormState(expectedRowCount) {
  const formStore = Object.values(window.amisStore?.stores || {}).find(
    (store) =>
      store?.storeType === 'FormStore' &&
      Array.isArray(store.data?.detail) &&
      store.data.detail.length === expectedRowCount
  )
  if (!formStore) {
    return null
  }
  const detail = formStore.data.detail
  return {
    detailCount: detail.length,
    checkResult: formStore.data.checkResult ?? null,
    firstRow: {
      id: detail[0]?.id ?? null,
      checkValue: detail[0]?.checkValue ?? null,
      innerCheckResult:
        detail[0]?.innerCheckResult?.code ??
        detail[0]?.innerCheckResult ??
        null,
      fixResult: detail[0]?.fixResult ?? null,
    },
    lastRow: {
      id: detail[detail.length - 1]?.id ?? null,
      checkValue: detail[detail.length - 1]?.checkValue ?? null,
      innerCheckResult:
        detail[detail.length - 1]?.innerCheckResult?.code ??
        detail[detail.length - 1]?.innerCheckResult ??
        null,
      fixResult: detail[detail.length - 1]?.fixResult ?? null,
    },
  }
}

async function renderScenario(scenarioId, schema, runId, options = {}) {
  const translate = createInstrumentedTranslate()
  rendered = await renderAmisSchema(editorRoot, schema, {
    translate,
  }, {
    translate,
    __performanceObserver: createObserver(scenarioId, runId),
  })
  cleanupStoreInstrumentation = installMstActionInstrumentation(
    window.amisStore,
    {
      onMark: (name, detail) =>
        metrics.mark(name, { scenarioId, runId, ...detail }),
      cooperativeScheduling: options.cooperativeScheduling === true,
    }
  )
  await waitForPaints(2)
}

function createInstrumentedTranslate() {
  const translate = makeTranslator('zh-CN')
  return function instrumentedTranslate(...args) {
    return attribution.measure(
      'translate',
      {
        lookupName: typeof args[0] === 'string' ? args[0] : null,
      },
      translate,
      this,
      args
    )
  }
}

function findScrollableElement(direction) {
  const localVirtualScroll = editorRoot.querySelector('.input-table-virtual-scroll')
  const candidates = direction === 'horizontal'
    ? [
        editorRoot.querySelector('.cxd-Table-content'),
        localVirtualScroll,
        editorRoot.querySelector('.cxd-Crud-body'),
        editorRoot,
      ]
    : [
        localVirtualScroll,
        document.scrollingElement,
        editorRoot.querySelector('.cxd-Crud-body'),
        editorRoot.querySelector('.cxd-Crud'),
        editorRoot,
        editorRoot.querySelector('.cxd-Table-content'),
      ]
  const uniqueCandidates = Array.from(new Set(candidates.filter(Boolean)))

  return uniqueCandidates.find((element) => {
    if (direction === 'horizontal') {
      return element.scrollWidth - element.clientWidth > 16
    }

    return element.scrollHeight - element.clientHeight > 16
  }) || null
}

function setScrollTop(scrollElement, value) {
  scrollElement.scrollTop = value
  if (scrollElement === document.scrollingElement) {
    window.dispatchEvent(new Event('scroll'))
    return
  }
  scrollElement.dispatchEvent(new Event('scroll', { bubbles: true }))
}

function setScrollLeft(scrollElement, value) {
  scrollElement.scrollLeft = value
  scrollElement.dispatchEvent(new Event('scroll', { bubbles: true }))
}

async function waitForScrollInteractionToSettle() {
  await waitForPaints(2)
  await new Promise((resolve) => window.setTimeout(resolve, 220))
  await waitForPaints(2)
}

function readTableMaterializationCounters() {
  return readTableStoreStates().reduce(
    (summary, store) => ({
      rowCreateCount:
        summary.rowCreateCount + Number(store.materializationRowCreateCount || 0),
      publishCount:
        summary.publishCount + Number(store.materializationPublishCount || 0),
    }),
    { rowCreateCount: 0, publishCount: 0 }
  )
}

function diffTableMaterializationCounters(after, before) {
  return {
    rowCreateDelta: Math.max(0, after.rowCreateCount - before.rowCreateCount),
    publishDelta: Math.max(0, after.publishCount - before.publishCount),
  }
}

async function performVerticalInteractionProbe(scenarioId, runId) {
  const scrollElement = findScrollableElement('vertical')
  if (!scrollElement) {
    return {
      verticalInteractionStatus: 'no-scroll-target',
    }
  }

  const maxScrollTop = Math.max(
    0,
    scrollElement.scrollHeight - scrollElement.clientHeight
  )
  const targetScrollTop = Math.max(
    0,
    Math.floor(maxScrollTop * 0.85)
  )
  const beforeSeekCounters = readTableMaterializationCounters()

  metrics.mark('vertical-seek-start', {
    scenarioId,
    runId,
    targetScrollTop,
    scrollTarget:
      scrollElement === document.scrollingElement
        ? 'document'
        : scrollElement.className || scrollElement.tagName,
  })
  setScrollTop(scrollElement, targetScrollTop)
  await waitForScrollInteractionToSettle()
  metrics.mark('vertical-seek-settled', {
    scenarioId,
    runId,
    scrollTop: scrollElement.scrollTop,
  })
  const afterSeekCounters = readTableMaterializationCounters()

  metrics.mark('vertical-return-start', { scenarioId, runId })
  setScrollTop(scrollElement, 0)
  await waitForScrollInteractionToSettle()
  metrics.mark('vertical-return-settled', {
    scenarioId,
    runId,
    scrollTop: scrollElement.scrollTop,
  })
  const afterReturnCounters = readTableMaterializationCounters()
  const verticalSeekMaterializationDelta =
    diffTableMaterializationCounters(afterSeekCounters, beforeSeekCounters)
  const verticalReturnMaterializationDelta =
    diffTableMaterializationCounters(afterReturnCounters, afterSeekCounters)

  return {
    verticalInteractionStatus: 'ok',
    verticalScrollExtent: maxScrollTop,
    verticalSeekMaterializationDelta,
    verticalReturnMaterializationDelta,
    verticalSeekResponsiveness: metrics.summarizeWindow(
      'vertical-seek-start',
      'vertical-seek-settled'
    ),
    verticalReturnResponsiveness: metrics.summarizeWindow(
      'vertical-return-start',
      'vertical-return-settled'
    ),
  }
}

async function performHorizontalInteractionProbe(scenarioId, runId) {
  const scrollElement = findScrollableElement('horizontal')
  if (!scrollElement) {
    return {
      horizontalInteractionStatus: 'no-scroll-target',
    }
  }

  const maxScrollLeft = Math.max(
    0,
    scrollElement.scrollWidth - scrollElement.clientWidth
  )
  const beforeSweepCounters = readTableMaterializationCounters()

  metrics.mark('horizontal-sweep-start', { scenarioId, runId, maxScrollLeft })
  setScrollLeft(scrollElement, maxScrollLeft)
  await waitForScrollInteractionToSettle()
  setScrollLeft(scrollElement, 0)
  await waitForScrollInteractionToSettle()
  metrics.mark('horizontal-sweep-end', {
    scenarioId,
    runId,
    scrollLeft: scrollElement.scrollLeft,
  })
  const afterSweepCounters = readTableMaterializationCounters()

  return {
    horizontalInteractionStatus: 'ok',
    horizontalScrollExtent: maxScrollLeft,
    horizontalSweepMaterializationDelta: diffTableMaterializationCounters(
      afterSweepCounters,
      beforeSweepCounters
    ),
    horizontalSweepResponsiveness: metrics.summarizeWindow(
      'horizontal-sweep-start',
      'horizontal-sweep-end'
    ),
  }
}

async function performPostReadyInteractionProbes(scenarioId, runId, options) {
  const fixtureProfile = options.fixtureProfile || 'load'
  const probes = {}

  if (
    fixtureProfile === 'scroll' ||
    fixtureProfile === 'dynamic-vertical' ||
    fixtureProfile === 'cross-axis' ||
    fixtureProfile === 'raw-check'
  ) {
    Object.assign(
      probes,
      await performVerticalInteractionProbe(scenarioId, runId)
    )
  }

  if (
    fixtureProfile === 'wide-horizontal' ||
    fixtureProfile === 'cross-axis' ||
    fixtureProfile === 'raw-check'
  ) {
    Object.assign(
      probes,
      await performHorizontalInteractionProbe(scenarioId, runId)
    )
  }

  return probes
}

async function runLoadScenario(
  scenarioId,
  schemaFactory,
  readySelector,
  runIndex = 1,
  rowCount = null,
  options = {}
) {
  const rowSuffix = rowCount ? `-rows-${rowCount}` : ''
  const profileSuffix = options.fixtureProfile
    ? `-${options.fixtureProfile}`
    : ''
  const runId = `${scenarioId}${profileSuffix}${rowSuffix}-run-${runIndex}`
  await resetScenario(scenarioId, runId)
  await renderScenario(scenarioId, schemaFactory(), runId, options)
  await waitForElement(readySelector)
  await waitForMetricMark('fetcher-resolved')
  const expectedRowCount =
    rowCount || (scenarioId === 'C0' ? 20 : scenarioId === 'C1' ? 2000 : 1000)
  const tableStoreState = await waitForFullTableData(
    scenarioId,
    expectedRowCount,
    editorRoot,
    30000,
    options
  )
  await waitForPaints(2)
  metrics.mark('ready', { scenarioId, runId })
  const interactionProbes = await performPostReadyInteractionProbes(
    scenarioId,
    runId,
    options
  )
  const rootText = editorRoot.textContent || ''
  const tableRows = Array.from(editorRoot.querySelectorAll('tbody tr'))
  const visibleRowShellCoverage = readVisibleRowShellCoverage()
  const performanceAttribution = attribution.snapshot(metrics.snapshot().marks)
  return metrics.snapshot({
    scenarioId,
    runId,
    rowCount: expectedRowCount,
    ...(options.cooperativeScheduling
      ? { cooperativeScheduling: true }
      : {}),
    fixtureProfile: options.fixtureProfile || 'load',
    visibleRowCount: tableRows.length,
    visibleBusinessRowCount: visibleRowShellCoverage.rowCount,
    visibleRowShellCoverage,
    hasFirstRowValue:
      hasExpectedFirstRowValue(scenarioId, editorRoot, options),
    tableStoreState,
    postResponseResponsiveness: metrics.summarizeWindow(
      'fetcher-resolved',
      'ready'
    ),
    performanceAttribution,
    ...interactionProbes,
    functionalHash: createLoadScenarioFunctionalHash(
      scenarioId,
      expectedRowCount,
      options
    ),
  })
}

function readTableStoreStates() {
  return Object.values(window.amisStore?.stores || {})
    .filter((store) => store?.storeType === 'TableStore')
    .map((store) => ({
      id: store.id,
      path: store.path,
      rowCount: store.rows?.length || 0,
      materializationRowCreateCount: store.materializationRowCreateCount || 0,
      materializationPublishCount: store.materializationPublishCount || 0,
      pendingMaterialization:
        Number(store.pendingMaterializationCount || 0) +
        (store.materializationPending === true ? 1 : 0) +
        (store.viewportHydrationPending === true ? 1 : 0),
    }))
}

const TABLE_EMPTY_BLOCK_SELECTOR = '[class*="Table-emptyBlock"]'

function isVisibleRowShellCandidate(row) {
  let current = row
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const style = window.getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false
    }
    current = current.parentElement
  }
  return true
}

function readVisibleTableRows(root = editorRoot) {
  return Array.from(root.querySelectorAll('tbody > tr')).filter((row) => {
    const hasShellCells = Array.from(row.children).some((cell) =>
      cell.matches('td, th')
    )
    return hasShellCells && isVisibleRowShellCandidate(row)
  })
}

function readVisibleRowShellCoverage(root = editorRoot) {
  const rows = readVisibleTableRows(root)
  const lazyBodies = Array.from(root.querySelectorAll('tbody[data-lazy-row-body]'))
  let minCellCount = rows.length ? Number.POSITIVE_INFINITY : 0
  let maxCellCount = 0
  let rowsWithoutCells = 0
  let placeholderRowCount = 0
  let placeholderCellCount = 0
  let placeholderRowsWithoutCellPlaceholder = 0
  let emptyBlocksOutsideCells = 0

  for (const row of rows) {
    const cells = Array.from(row.children).filter((cell) =>
      cell.matches('td, th')
    )
    const emptyBlocks = Array.from(
      row.querySelectorAll(TABLE_EMPTY_BLOCK_SELECTOR)
    )
    const rowPlaceholderCellCount = cells.filter((cell) =>
      cell.querySelector(TABLE_EMPTY_BLOCK_SELECTOR)
    ).length

    minCellCount = Math.min(minCellCount, cells.length)
    maxCellCount = Math.max(maxCellCount, cells.length)
    if (!cells.length) {
      rowsWithoutCells += 1
    }
    if (row.hasAttribute('data-lazy-row-placeholder')) {
      placeholderRowCount += 1
      if (!rowPlaceholderCellCount) {
        placeholderRowsWithoutCellPlaceholder += 1
      }
    }
    placeholderCellCount += rowPlaceholderCellCount
    emptyBlocksOutsideCells += emptyBlocks.filter(
      (block) => !block.closest('td')
    ).length
  }

  return {
    rowCount: rows.length,
    lazyBodyCount: lazyBodies.length,
    renderedLazyRowCount: rows.filter((row) =>
      row.hasAttribute('data-lazy-row-rendered')
    ).length,
    minCellCount: rows.length ? minCellCount : 0,
    maxCellCount,
    rowsWithoutCells,
    placeholderRowCount,
    placeholderCellCount,
    placeholderRowsWithoutCellPlaceholder,
    emptyBlocksOutsideCells,
  }
}

function readBusinessRowCount(root = editorRoot) {
  return readVisibleRowShellCoverage(root).rowCount
}

function readFirstInputTableValue(root = editorRoot) {
  return (
    root.querySelector('input[name="field0"]')?.value || ''
  )
}

async function waitForFullTableData(
  scenarioId,
  expectedRowCount,
  root = editorRoot,
  timeoutMs = 30000,
  options = {}
) {
  const startAt = Date.now()
  let latestStates = []

  while (Date.now() - startAt < timeoutMs) {
    latestStates = readTableStoreStates()
    const tableStore = latestStates.find(
      (store) =>
        store.rowCount === expectedRowCount && store.pendingMaterialization === 0
    )
    const firstValueReady = hasExpectedFirstRowValue(scenarioId, root, options)
    const expectedVisibleRows = Math.min(expectedRowCount, 1)
    const visibleRowShellCoverage = readVisibleRowShellCoverage(root)
    const visibleRowsReady =
      visibleRowShellCoverage.rowCount >= expectedVisibleRows &&
      visibleRowShellCoverage.minCellCount > 0 &&
      visibleRowShellCoverage.rowsWithoutCells === 0 &&
      visibleRowShellCoverage.placeholderRowsWithoutCellPlaceholder === 0 &&
      visibleRowShellCoverage.emptyBlocksOutsideCells === 0

    if (tableStore && firstValueReady && visibleRowsReady) {
      return tableStore
    }

    await new Promise((resolve) => window.setTimeout(resolve, 16))
  }

  throw new Error(
    `Timed out waiting for ${scenarioId} full table data: expectedRows=${expectedRowCount}, visibleRowShellCoverage=${JSON.stringify(
      readVisibleRowShellCoverage(root)
    )}, firstInputValue=${readFirstInputTableValue(root)}, stores=${JSON.stringify(latestStates)}, recentActions=${JSON.stringify(
      metrics
        .snapshot()
        .marks.filter(
          (mark) =>
            mark.name === 'mst-action-start' ||
            mark.name === 'mst-action-end'
        )
        .slice(-40)
        .map((mark) => ({
          name: mark.name,
          time: mark.time,
          actionName: mark.detail?.actionName,
          token: mark.detail?.token,
        }))
    )}`
  )
}

function dialogButtonLabel(variant) {
  if (variant === 'lazy') {
    return 'Open lazy body dialog'
  }
  if (variant === 'amis-schema') {
    return 'Open amis-schema dialog'
  }
  return 'Open inline body dialog'
}

function withVariantDetail(variant) {
  return variant ? { variant } : {}
}

async function runDialogScenario(variant = null, runIndex = 1) {
  const scenarioId = 'C3'
  const effectiveVariant = variant || 'inline'
  const runId = variant
    ? `${scenarioId}-${variant}-run-${runIndex}`
    : `${scenarioId}-run-${runIndex}`
  await resetScenario(scenarioId, runId)
  await renderScenario(scenarioId, createDialogSchema(), runId)
  const button = await waitForButtonText(dialogButtonLabel(effectiveVariant))
  metrics.mark('click', { scenarioId, runId, ...withVariantDetail(variant) })
  button.click()
  const dialog = await waitForElement('[role="dialog"]')
  await waitForPaints(1)
  metrics.mark('shell-first-paint', {
    scenarioId,
    runId,
    ...withVariantDetail(variant),
  })
  await waitForElement('[role="dialog"] .cxd-Table')
  const tableStoreState = await waitForFullTableData('C2', 500, dialog)
  await waitForPaints(2)
  metrics.mark('body-ready', {
    scenarioId,
    runId,
    ...withVariantDetail(variant),
  })
  metrics.mark('ready', { scenarioId, runId, ...withVariantDetail(variant) })
  const visibleRowShellCoverage = readVisibleRowShellCoverage(dialog)
  return metrics.snapshot({
    scenarioId,
    runId,
    ...withVariantDetail(variant),
    visibleBusinessRowCount: visibleRowShellCoverage.rowCount,
    visibleRowShellCoverage,
    tableStoreState,
    dialogShellResponsiveness: metrics.summarizeWindow(
      'click',
      'shell-first-paint'
    ),
    dialogBodyResponsiveness: metrics.summarizeWindow(
      'shell-first-paint',
      'body-ready'
    ),
    functionalHash: createChecksum(dialog.textContent || ''),
  })
}

async function runSubmitScenario(
  scenarioId,
  variant,
  responseMode = 'empty',
  validationMode = null,
  runIndex = 1,
  options = {}
) {
  const validationSuffix = validationMode ? `-${validationMode}` : ''
  const runId = `${scenarioId}-${variant}-${responseMode}${validationSuffix}-run-${runIndex}`
  const markDetail = {
    scenarioId,
    runId,
    variant,
    responseMode,
    ...(validationMode ? { validationMode } : {}),
  }
  await resetScenario(scenarioId, runId)
  await renderScenario(
    scenarioId,
    createSubmitSchema(variant, responseMode, validationMode || 'unique-on'),
    runId,
    options
  )
  const openButton = await waitForButtonText('Open Submit Dialog')
  openButton.click()
  await waitForElement('[role="dialog"] .cxd-Table')
  await waitForElement('[role="dialog"] input[name="field0"]')
  await waitForPaints(2)
  const setupSnapshot = metrics.snapshot()
  metrics.reset()
  metrics.mark('scenario-start', markDetail)
  await waitForPaints(2)
  const button = await waitForButtonText('Confirm Submit')
  metrics.mark('click', markDetail)
  button.click()
  await waitForMetricMark('fetcher-entered')
  await waitForPaints(2)
  metrics.mark('busy-first-paint', markDetail)
  await waitForMetricMark('fetcher-resolved')
  await waitForPaints(2)
  metrics.mark('submit-complete', markDetail)
  metrics.mark('ready', markDetail)
  return metrics.snapshot({
    scenarioId,
    runId,
    variant,
    responseMode,
    ...(validationMode ? { validationMode } : {}),
    ...(options.cooperativeScheduling
      ? { cooperativeScheduling: true }
      : {}),
    setupMaxFrameGapMs: setupSnapshot.maxFrameGapMs,
    setupMaxLongTaskMs: setupSnapshot.maxLongTaskMs,
    functionalHash: createChecksum(editorRoot.textContent || ''),
  })
}

async function runRealFormScenario(options, runIndex = 1) {
  const scenarioId = 'C5'
  const variant = options.variant || 'stuck'
  const rowCount = options.rowCount || 1000
  const runId = `${scenarioId}-${variant}-rows-${rowCount}-run-${runIndex}`
  const markDetail = { scenarioId, runId, variant, rowCount }
  await resetScenario(scenarioId, runId)
  await renderScenario(
    scenarioId,
    createRealSubmitSchema(options.realForm, variant, rowCount),
    runId
  )
  const openButton = await waitForButtonText('Open Real Form Dialog')
  openButton.click()
  const dialog = await waitForElement('[role="dialog"]')
  await waitForElement('[role="dialog"] .cxd-Table')
  const tableStoreState = await waitForRealFormTableData(rowCount, dialog)
  await waitForPaints(2)

  metrics.reset()
  metrics.mark('scenario-start', markDetail)
  await waitForPaints(2)
  const saveButton = Array.from(dialog.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === '\u4fdd\u5b58'
  )
  if (!saveButton) {
    throw new Error('Real Form save button was not found')
  }
  metrics.mark('click', markDetail)
  saveButton.click()
  const isSubmitRequest = (detail) =>
    String(detail?.url || '').includes('/c5-real-form-submit')
  await waitForMetricMark('fetcher-entered', isSubmitRequest, 60000)
  await waitForPaints(2)
  metrics.mark('busy-first-paint', markDetail)
  await waitForMetricMark('fetcher-resolved', isSubmitRequest, 60000)
  const settledTableStoreState = await waitForRealFormTableData(
    rowCount,
    dialog,
    60000
  )
  await waitForPaints(2)
  metrics.mark('submit-complete', markDetail)
  metrics.mark('ready', markDetail)
  const formState = readRealFormState(rowCount)
  return metrics.snapshot({
    scenarioId,
    runId,
    runIndex,
    variant,
    rowCount,
    schemaSourceFile: options.realForm.sourceFile,
    schemaSourceSha256: options.realForm.sourceSha256,
    tableStoreState: settledTableStoreState || tableStoreState,
    formState,
    preSendResponsiveness: metrics.summarizeWindow('click', 'fetcher-entered'),
    busyPaintResponsiveness: metrics.summarizeWindow(
      'click',
      'busy-first-paint'
    ),
    functionalHash: createChecksum(JSON.stringify(formState)),
  })
}

async function runScenario(scenarioId, options = {}) {
  const runIndex = options.runIndex || 1
  statusElement.textContent = `Running ${scenarioId} run ${runIndex}...`
  if (scenarioId === 'C0') {
    return runLoadScenario(
      scenarioId,
      () => createCrudSchema('C0', apiUrl('c0-crud'), null, options),
      '.cxd-Crud',
      runIndex,
      null,
      options
    )
  }
  if (scenarioId === 'C1') {
    return runLoadScenario(
      scenarioId,
      () =>
        createCrudSchema(
          'C1',
          apiUrl('c1-crud'),
          options.rowCount || 2000,
          options
        ),
      '.cxd-Crud',
      runIndex,
      options.rowCount || null,
      options
    )
  }
  if (scenarioId === 'C2') {
    return runLoadScenario(
      scenarioId,
      () =>
        createInputTableFormSchema(
          'C2',
          options.rowCount || 1000,
          options
        ),
      '.cxd-Table',
      runIndex,
      options.rowCount || null,
      options
    )
  }
  if (scenarioId === 'C3') {
    return runDialogScenario(options.variant || null, runIndex)
  }
  if (scenarioId === 'C4a' || scenarioId === 'C4b') {
    return runSubmitScenario(
      scenarioId,
      options.variant || 'object-default',
      'empty',
      options.validationMode || null,
      runIndex,
      options
    )
  }
  if (scenarioId === 'C4c') {
    return runSubmitScenario(
      scenarioId,
      options.variant || 'object-default',
      options.responseMode || 'echo',
      options.validationMode || null,
      runIndex,
      options
    )
  }
  if (scenarioId === 'C5') {
    return runRealFormScenario(options, runIndex)
  }
  throw new Error(`Unknown scenario: ${scenarioId}`)
}

const harnessApi = {
  ready: false,
  getMetrics() {
    return metrics.snapshot()
  },
  mark(name, detail = {}) {
    return markHarness(name, detail)
  },
  runScenario,
}

window.__AMIS_MAIN_THREAD_PERF__ = harnessApi
metrics.start()
harnessApi.ready = true
statusElement.textContent = 'AMIS main-thread performance harness ready'

window.addEventListener('beforeunload', () => {
  cleanupStoreInstrumentation?.()
  cleanupAxiosInstrumentation?.()
  rendered?.destroy()
  metrics.stop()
})
