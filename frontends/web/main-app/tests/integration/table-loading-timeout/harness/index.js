import React from 'react'
import ReactDOM from 'react-dom'

import { renderAmisSchema } from '@/components/amis/AmisComponent'

window.React = React
window.ReactDOM = ReactDOM

const statusElement = document.getElementById('table-loading-timeout-playwright-status')
const editorRoot = document.getElementById('table-loading-timeout-editor-root')

const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window)
const originalSetTimeout = window.setTimeout.bind(window)
const originalClearTimeout = window.clearTimeout.bind(window)
let rendered = null
let frameId = 1
let timeoutId = 1
let paintWaitsBlocked = false
let blockedPaintWaits = new Map()

function buildRows(count = 80) {
  return Array.from({ length: count }, (_, index) => {
    const row = { id: `row-${index + 1}` }
    for (let columnIndex = 0; columnIndex < 24; columnIndex += 1) {
      row[`field${columnIndex + 1}`] = `R${index + 1}-C${columnIndex + 1}`
    }
    return row
  })
}

function buildColumns(count = 24) {
  return Array.from({ length: count }, (_, index) => ({
    name: `field${index + 1}`,
    label: `Field ${index + 1}`,
    type: 'text',
  }))
}

function buildSchema(iteration, loadingMaxDuration) {
  return {
    type: 'page',
    title: `Table Loading Timeout ${iteration}`,
    data: {
      items: buildRows(),
    },
    body: [
      {
        type: 'table',
        id: 'tableLoadingTimeoutTarget',
        name: 'tableLoadingTimeoutTarget',
        className: 'table-loading-timeout-target',
        source: '$items',
        lazyRenderAfter: 1,
        lazyRenderAfterExplicit: true,
        loadingMaxDuration,
        columns: buildColumns(),
      },
    ],
  }
}

function blockCooperativeMaterializationFrames() {
  paintWaitsBlocked = true
  window.requestAnimationFrame = () => {
    frameId += 1
    return frameId
  }
  window.setTimeout = (callback, delay, ...args) => {
    if (paintWaitsBlocked && delay === 100 && callback?.name === 'done') {
      timeoutId += 1
      blockedPaintWaits.set(timeoutId, () => callback(...args))
      return timeoutId
    }

    return originalSetTimeout(callback, delay, ...args)
  }
  window.clearTimeout = (id) => {
    blockedPaintWaits.delete(id)
    originalClearTimeout(id)
  }
}

function restoreFrames() {
  paintWaitsBlocked = false
  window.requestAnimationFrame = originalRequestAnimationFrame
  window.setTimeout = originalSetTimeout
  window.clearTimeout = originalClearTimeout
}

function releaseBlockedPaintWaits() {
  const callbacks = Array.from(blockedPaintWaits.values())
  blockedPaintWaits.clear()
  callbacks.forEach((callback) => originalSetTimeout(callback, 0))
}

function readTableStores() {
  return Object.values(window.amisStore?.stores || {})
    .filter((store) => store?.storeType === 'TableStore')
    .map((store) => ({
      id: store.id,
      path: store.path,
      rowCount: store.rows?.length || 0,
      lazyRenderAfter: store.lazyRenderAfter,
      lazyRenderAfterExplicit: store.lazyRenderAfterExplicit,
      loadingMaxDuration: store.loadingMaxDuration,
      materializationPending: Boolean(store.materializationPending),
      cooperativeLoadingVisible: Boolean(store.cooperativeLoadingVisible),
      cooperativeLoadingSuppressed: Boolean(store.cooperativeLoadingSuppressed),
      pendingMaterializationCount: store.pendingMaterializationCount ?? null,
      materializationRowCreateCount: store.materializationRowCreateCount ?? null,
      materializationPublishCount: store.materializationPublishCount ?? null,
    }))
}

function findTargetStore() {
  const scopedStore = rendered
    ?.getScopeRef?.()
    ?.getComponentByName?.('tableLoadingTimeoutTarget')
    ?.props?.store

  if (scopedStore) {
    return scopedStore
  }

  const stores = Object.values(window.amisStore?.stores || {}).filter(
    (store) => store?.storeType === 'TableStore'
  )

  return stores[stores.length - 1] || null
}

function readState() {
  const spinner = document.querySelector(
    '.cxd-Spinner-overlay.in, .cxd-Spinner.in, [class*="Spinner-overlay"].in, [class*="Spinner"].in'
  )
  const table = document.querySelector('.table-loading-timeout-target')
  const rows = Array.from(document.querySelectorAll('.table-loading-timeout-target table tbody tr'))
  const store = findTargetStore()

  return {
    spinnerVisible: Boolean(spinner),
    tableRendered: Boolean(table),
    rowCount: rows.length,
    lazyRenderAfter: store?.lazyRenderAfter ?? null,
    lazyRenderAfterExplicit: store?.lazyRenderAfterExplicit ?? null,
    loadingMaxDuration: store?.loadingMaxDuration ?? null,
    materializationPending: Boolean(store?.materializationPending),
    cooperativeLoadingVisible: Boolean(store?.cooperativeLoadingVisible),
    cooperativeLoadingSuppressed: Boolean(store?.cooperativeLoadingSuppressed),
    pendingMaterializationCount: store?.pendingMaterializationCount ?? null,
    materializationRowCreateCount: store?.materializationRowCreateCount ?? null,
    materializationPublishCount: store?.materializationPublishCount ?? null,
    tableStores: readTableStores(),
  }
}

async function waitUntil(predicate, timeoutMs, label) {
  const startedAt = performance.now()
  let snapshot = readState()

  while (performance.now() - startedAt < timeoutMs) {
    snapshot = readState()
    if (predicate(snapshot)) {
      return snapshot
    }
    await new Promise((resolve) => window.setTimeout(resolve, 20))
  }

  throw new Error(`${label}: ${JSON.stringify(snapshot)}`)
}

async function runScenario(options = {}) {
  const iteration = options.iteration ?? 1
  const loadingMaxDuration = options.loadingMaxDuration ?? 300

  restoreFrames()
  rendered?.destroy?.()
  rendered = null
  releaseBlockedPaintWaits()
  editorRoot.innerHTML = ''
  blockCooperativeMaterializationFrames()

  rendered = await renderAmisSchema(editorRoot, buildSchema(iteration, loadingMaxDuration), {})

  const visibleSnapshot = await waitUntil(
    (snapshot) =>
      snapshot.tableRendered &&
      snapshot.spinnerVisible &&
      snapshot.materializationPending &&
      snapshot.cooperativeLoadingVisible,
    3000,
    `iteration ${iteration} expected cooperative loading to become visible`
  )

  const hiddenSnapshot = await waitUntil(
    (snapshot) =>
      snapshot.tableRendered &&
      !snapshot.spinnerVisible &&
      snapshot.materializationPending &&
      !snapshot.cooperativeLoadingVisible &&
      snapshot.cooperativeLoadingSuppressed,
    Math.max(3000, loadingMaxDuration + 1500),
    `iteration ${iteration} expected cooperative loading to hide after max duration`
  )

  statusElement.textContent = `Iteration ${iteration} passed`

  const finalSnapshot = readState()
  rendered?.destroy?.()
  rendered = null
  restoreFrames()
  releaseBlockedPaintWaits()

  return {
    iteration,
    visibleSnapshot,
    hiddenSnapshot,
    finalSnapshot,
  }
}

window.__TABLE_LOADING_TIMEOUT_PLAYWRIGHT_HARNESS__ = {
  ready: true,
  runScenario,
  readState,
  restoreFrames,
}

statusElement.textContent = 'Table loading timeout harness ready'
