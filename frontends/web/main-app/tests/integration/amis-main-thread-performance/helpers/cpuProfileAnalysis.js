const IDLE_CATEGORIES = new Set(['idle', 'program'])

function getMark(snapshot, name, after = -Infinity) {
  return (
    (snapshot?.marks || []).find(
      (mark) => mark.name === name && mark.time >= after
    ) || null
  )
}

function createWindow(snapshot, name, startName, endName) {
  const start = getMark(snapshot, startName)
  const end = start ? getMark(snapshot, endName, start.time) : null
  if (!start || !end || end.time < start.time) {
    return null
  }
  return {
    name,
    startMs: start.time,
    endMs: end.time,
    durationMs: end.time - start.time,
  }
}

function createStageWindows(snapshot) {
  const submitWindow = createWindow(
    snapshot,
    'submit-busy-paint',
    'click',
    'busy-first-paint'
  )
  return [
    createWindow(snapshot, 'measurement', 'scenario-start', 'ready'),
    createWindow(snapshot, 'network', 'requestWillBeSent', 'fetcher-resolved'),
    createWindow(snapshot, 'post-response', 'fetcher-resolved', 'ready'),
    createLargestMstActionWindow(snapshot, 'initRows', 'table-init-rows'),
    createLargestMstActionWindow(
      snapshot,
      'appendCooperativeRows',
      'row-materialization-batch'
    ),
    createLargestMstActionWindow(
      snapshot,
      'finishCooperativeMaterialization',
      'row-attachment'
    ),
    createLargestMstActionWindow(
      snapshot,
      'prepareCooperativeEventContext',
      'table-event-context-warmup'
    ),
    createMaterializingTableUpdateWindow(snapshot),
    createLargestReactCommitWindow(snapshot),
    createWindow(snapshot, 'submit-pre-send', 'click', 'fetcher-entered'),
    submitWindow,
    ...createAmisActionWindows(snapshot),
    createLargestPairedWindow(
      snapshot,
      'form-flush-start',
      'form-flush-end',
      'form-flush-pre-send',
      (window) => isInsideSubmitPreSend(snapshot, window)
    ),
    createLargestPairedWindow(
      snapshot,
      'form-validate-start',
      'form-validate-end',
      'form-validate-pre-send',
      (window) => isInsideSubmitPreSend(snapshot, window)
    ),
    createWindow(
      snapshot,
      'request-adaptor',
      'request-adaptor-start',
      'request-adaptor-end'
    ),
    createLargestPairedWindow(
      snapshot,
      'table-component-update-start',
      'table-component-update-end',
      'submit-table-update',
      (window) =>
        !submitWindow ||
        (window.startMs >= submitWindow.startMs &&
          window.endMs <= submitWindow.endMs)
    ),
    createWindow(snapshot, 'submit-network', 'fetcher-entered', 'fetcher-resolved'),
    createWindow(snapshot, 'submit-post-response', 'fetcher-resolved', 'ready'),
  ].filter(Boolean)
}

function isInsideSubmitPreSend(snapshot, window) {
  const submitPreSend = createWindow(
    snapshot,
    'submit-pre-send',
    'click',
    'fetcher-entered'
  )
  return (
    !submitPreSend ||
    (window.startMs >= submitPreSend.startMs &&
      window.endMs <= submitPreSend.endMs)
  )
}

function createAmisActionWindows(snapshot) {
  const windows = summarizePairedWindows(
    snapshot,
    'amis-action-start',
    'amis-action-end'
  )
  const customWindows = windows
    .filter((window) => window.startDetail?.registeredType === 'custom')
    .sort((left, right) => left.startMs - right.startMs)
    .map((window, index) => ({
      name: `custom-script-${index + 1}`,
      startMs: window.startMs,
      endMs: window.endMs,
      durationMs: window.durationMs,
    }))
  const inputTableSetValue = windows.find(
    (window) =>
      window.startDetail?.registeredType === 'component' &&
      window.startDetail?.actionType === 'setValue' &&
      window.startDetail?.componentId === 'detail'
  )
  return [
    ...customWindows,
    inputTableSetValue
      ? {
          name: 'input-table-set-value-action',
          startMs: inputTableSetValue.startMs,
          endMs: inputTableSetValue.endMs,
          durationMs: inputTableSetValue.durationMs,
        }
      : null,
  ].filter(Boolean)
}

function createLargestPairedWindow(
  snapshot,
  startName,
  endName,
  name,
  predicate = () => true
) {
  const largest = summarizePairedWindows(snapshot, startName, endName)
    .filter(predicate)
    .sort((left, right) => right.durationMs - left.durationMs)[0]
  return largest
    ? {
        name,
        startMs: largest.startMs,
        endMs: largest.endMs,
        durationMs: largest.durationMs,
      }
    : null
}

function createLargestMstActionWindow(snapshot, actionName, name) {
  const starts = new Map()
  const windows = []
  for (const mark of snapshot?.marks || []) {
    const token = mark.detail?.token
    if (
      mark.name === 'mst-action-start' &&
      mark.detail?.actionName === actionName &&
      token
    ) {
      starts.set(token, mark)
      continue
    }
    if (
      mark.name !== 'mst-action-end' ||
      mark.detail?.actionName !== actionName ||
      !token
    ) {
      continue
    }
    const start = starts.get(token)
    if (start && mark.time >= start.time) {
      windows.push({
        name,
        startMs: start.time,
        endMs: mark.time,
        durationMs: mark.time - start.time,
      })
    }
  }
  return windows.sort((left, right) => right.durationMs - left.durationMs)[0] || null
}

function createMaterializingTableUpdateWindow(snapshot) {
  const largest = summarizePairedWindows(
    snapshot,
    'table-component-update-start',
    'table-component-update-end'
  )
    .filter((window) => window.rowsAfter > window.rowsBefore)
    .sort((left, right) => right.durationMs - left.durationMs)[0]
  return largest
    ? {
        name: 'table-component-update',
        startMs: largest.startMs,
        endMs: largest.endMs,
        durationMs: largest.durationMs,
      }
    : null
}

function createLargestReactCommitWindow(snapshot) {
  const postResponse = createWindow(
    snapshot,
    'post-response',
    'fetcher-resolved',
    'ready'
  )
  const commit = (snapshot?.marks || [])
    .filter(
      (mark) =>
        mark.name === 'react-commit' &&
        typeof mark.detail?.startTime === 'number' &&
        typeof mark.detail?.commitTime === 'number' &&
        (!postResponse ||
          (mark.detail.commitTime >= postResponse.startMs &&
            mark.detail.startTime <= postResponse.endMs))
    )
    .sort(
      (left, right) =>
        (right.detail?.actualDuration || 0) -
        (left.detail?.actualDuration || 0)
    )[0]
  if (!commit) {
    return null
  }
  return {
    name: 'dominant-react-render',
    startMs: commit.detail.startTime,
    endMs: commit.detail.commitTime,
    durationMs: commit.detail.commitTime - commit.detail.startTime,
  }
}

function classifyFrame(callFrame = {}) {
  const functionName = callFrame.functionName || ''
  const url = callFrame.url || ''
  const source = `${functionName} ${url}`.toLowerCase()

  if (/\(idle\)|\bidle\b/.test(source)) {
    return 'idle'
  }
  if (/\(program\)/.test(source)) {
    return 'program'
  }
  if (/garbage collector|\(gc\)/.test(source)) {
    return 'gc'
  }
  if (/src\/components\/amis\/renderers|ouroboros.*(form|table|crud)/.test(source)) {
    return 'ouroboros-renderer'
  }
  if (
    /complextype\.create|createobjectnode|createobservableinstance|initializechildnodes|instantiate/.test(
      source
    )
  ) {
    return 'mst-materialization'
  }
  if (/mobx-state-tree|objectnode|modeltype|arraytype/.test(source)) {
    if (
      /instantiate|createnode|createobjectnode|modeltype.*create|row\.create/.test(
        source
      )
    ) {
      return 'mst-materialization'
    }
    if (/reconcile|applysnapshot|replace|willchange|didchange/.test(source)) {
      return 'mst-reconciliation'
    }
    if (/unbox|assertalive|\.get\b| get /.test(source)) {
      return 'mst-node-access'
    }
    return 'mst-other'
  }
  if (/node_modules\/mobx\/|mobx\.module|mobx\.esm|reaction@/.test(source)) {
    if (/reaction|runreactions|trackderivedfunction/.test(source)) {
      return 'mobx-reactions'
    }
    if (/propagatechanged|reportchanged|notifylisteners|setobservablepropvalue/.test(source)) {
      return 'mobx-observable-notification'
    }
    if (/addobserver|getadministration|dehancevalues|definecomputedproperty/.test(source)) {
      return 'mobx-observable-access-setup'
    }
    return 'mobx-other'
  }
  if (
    /react-dom|react-reconciler|react\.development|node_modules\/react\/|performunitofwork|beginwork|completework|commitroot/.test(
      source
    )
  ) {
    if (/commit|flushsync|performsyncworkonroot/.test(source)) {
      return 'react-sync-commit'
    }
    if (/beginwork|completework|performunitofwork|renderrootsync|reconcile/.test(source)) {
      return 'react-reconcile-render'
    }
    if (/createelement|reactelement/.test(source)) {
      return 'react-element-construction'
    }
    if (/classinstance|classcomponent|renderwithhooks|updatefunctioncomponent/.test(source)) {
      return 'react-component-lifecycle'
    }
    return 'react-other'
  }
  if (/amis-core\/(src|lib)\/store|node_modules\/amis-core\/.*store/.test(source)) {
    return 'amis-store'
  }
  if (/amis-core\/lib\/schemarenderer|amis-core\/src\/schemarenderer/.test(source)) {
    return 'amis-schema-renderer'
  }
  if (/amis\/lib\/renderers\/table|packages\/amis\/src\/renderers\/table/.test(source)) {
    return 'amis-table-renderer'
  }
  if (/amis\/lib\/renderers\/form|amis-core\/lib\/renderers\/item/.test(source)) {
    return 'amis-form-renderer'
  }
  if (/amis\/lib\/renderers\/crud|packages\/amis\/src\/renderers\/crud/.test(source)) {
    return 'amis-crud-renderer'
  }
  if (/node_modules\/amis\/|packages\/amis\/src\/renderers|amis\/lib\/renderers/.test(source)) {
    return 'amis-other-renderer'
  }
  if (/lodash/.test(source)) {
    return 'utility'
  }
  if (/json\.parse|json\.stringify/.test(source)) {
    return 'json'
  }
  return null
}

function layerForCategory(category) {
  if (category.startsWith('mst-')) {
    return 'mst'
  }
  if (category.startsWith('mobx-')) {
    return 'mobx'
  }
  if (category.startsWith('react-')) {
    return 'react'
  }
  if (/^amis-.*-renderer$/.test(category)) {
    return 'amis-renderer'
  }
  return category
}

function formatFrame(callFrame = {}) {
  const line =
    typeof callFrame.lineNumber === 'number' ? callFrame.lineNumber + 1 : null
  return {
    functionName: callFrame.functionName || '(anonymous)',
    url: callFrame.url || '(unknown)',
    lineNumber: line,
  }
}

function buildProfileGraph(profile) {
  const nodesById = new Map((profile?.nodes || []).map((node) => [node.id, node]))
  const parentById = new Map()
  for (const node of profile?.nodes || []) {
    for (const childId of node.children || []) {
      parentById.set(childId, node.id)
    }
  }
  return { nodesById, parentById }
}

function stackForNode(nodeId, graph) {
  const stack = []
  const visited = new Set()
  let currentId = nodeId
  while (currentId != null && !visited.has(currentId)) {
    visited.add(currentId)
    const node = graph.nodesById.get(currentId)
    if (!node) {
      break
    }
    stack.push(node)
    currentId = graph.parentById.get(currentId)
  }
  return stack
}

function classifyStack(stack) {
  for (const node of stack) {
    const category = classifyFrame(node.callFrame)
    if (category) {
      return category
    }
  }
  return 'other'
}

function classifyOwnerStack(stack) {
  const frames = stack.map((node) => {
    const callFrame = node.callFrame || {}
    return `${callFrame.functionName || ''} ${callFrame.url || ''}`.toLowerCase()
  })
  const has = (pattern) => frames.some((frame) => pattern.test(frame))

  if (has(/get eventcontext|preparecooperativeeventcontext|getunselectedrows|get unselectedrows/)) {
    return 'table-event-context'
  }
  if (/appendcooperativerows|finishcooperativematerialization/.test(frames.join(' '))) {
    return 'table-row-materialization'
  }
  if (has(/get locals/)) {
    return 'table-row-locals'
  }
  if (has(/cooperativetablebody.*render|renderrows/)) {
    return 'table-viewport-render'
  }
  if (has(/\bcell\b|tablerow|formitem|inputtext|inputnumber/)) {
    return 'table-cell-render'
  }
  if (has(/table\.renderheader|table\.renderfooter|table\.renderheading/)) {
    return 'table-chrome-render'
  }
  if (has(/table\.render|tablecontent/)) {
    return 'table-shell-render'
  }
  if (has(/mobx-state-tree|objectnode|modeltype|arraytype/)) {
    return 'mst-internal'
  }
  if (has(/mobx/)) {
    return 'mobx-internal'
  }
  if (has(/react-dom|react-reconciler|react\.development/)) {
    return 'react-internal'
  }
  return 'other'
}

function mapSampleTimeToPerformance(sampleTimeUs, profile, timing) {
  const profileDurationUs = Math.max(1, profile.endTime - profile.startTime)
  const performanceDurationMs = Math.max(
    0.001,
    timing.profileEndPerformanceMs - timing.profileStartPerformanceMs
  )
  const ratio = (sampleTimeUs - profile.startTime) / profileDurationUs
  return timing.profileStartPerformanceMs + ratio * performanceDurationMs
}

function buildSamples(profile, timing) {
  const graph = buildProfileGraph(profile)
  let timestampUs = profile.startTime
  return (profile.samples || []).map((nodeId, index) => {
    const weightUs = profile.timeDeltas?.[index] || 0
    timestampUs += weightUs
    const stack = stackForNode(nodeId, graph)
    const category = classifyStack(stack)
    return {
      nodeId,
      weightMs: weightUs / 1000,
      performanceTimeMs: mapSampleTimeToPerformance(
        timestampUs,
        profile,
        timing
      ),
      category,
      layer: layerForCategory(category),
      owner: IDLE_CATEGORIES.has(category)
        ? category
        : classifyOwnerStack(stack),
      stack,
    }
  })
}

function percentage(value, total) {
  return total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0
}

function summarizeSamples(samples) {
  const categoryWeights = new Map()
  const layerWeights = new Map()
  const ownerWeights = new Map()
  const selfFrames = new Map()
  const inclusiveFrames = new Map()

  for (const sample of samples) {
    categoryWeights.set(
      sample.category,
      (categoryWeights.get(sample.category) || 0) + sample.weightMs
    )
    layerWeights.set(
      sample.layer,
      (layerWeights.get(sample.layer) || 0) + sample.weightMs
    )
    ownerWeights.set(
      sample.owner,
      (ownerWeights.get(sample.owner) || 0) + sample.weightMs
    )

    const leaf = sample.stack[0]
    if (leaf) {
      const key = JSON.stringify(formatFrame(leaf.callFrame))
      const item = selfFrames.get(key) || {
        ...formatFrame(leaf.callFrame),
        weightMs: 0,
      }
      item.weightMs += sample.weightMs
      selfFrames.set(key, item)
    }

    const seen = new Set()
    for (const node of sample.stack) {
      const frame = formatFrame(node.callFrame)
      const key = JSON.stringify(frame)
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      const item = inclusiveFrames.get(key) || { ...frame, weightMs: 0 }
      item.weightMs += sample.weightMs
      inclusiveFrames.set(key, item)
    }
  }

  const totalWeightMs = samples.reduce((total, sample) => total + sample.weightMs, 0)
  const idleWeightMs = Array.from(categoryWeights.entries())
    .filter(([category]) => IDLE_CATEGORIES.has(category))
    .reduce((total, [, weight]) => total + weight, 0)
  const activeWeightMs = Math.max(0, totalWeightMs - idleWeightMs)

  const categories = Array.from(categoryWeights.entries())
    .map(([category, weightMs]) => ({
      category,
      weightMs: Number(weightMs.toFixed(3)),
      percentTotal: percentage(weightMs, totalWeightMs),
      percentActive: IDLE_CATEGORIES.has(category)
        ? 0
        : percentage(weightMs, activeWeightMs),
    }))
    .sort((left, right) => right.weightMs - left.weightMs)

  const layers = Array.from(layerWeights.entries())
    .map(([layer, weightMs]) => ({
      layer,
      weightMs: Number(weightMs.toFixed(3)),
      percentTotal: percentage(weightMs, totalWeightMs),
      percentActive: IDLE_CATEGORIES.has(layer)
        ? 0
        : percentage(weightMs, activeWeightMs),
    }))
    .sort((left, right) => right.weightMs - left.weightMs)

  const owners = Array.from(ownerWeights.entries())
    .map(([owner, weightMs]) => ({
      owner,
      weightMs: Number(weightMs.toFixed(3)),
      percentTotal: percentage(weightMs, totalWeightMs),
      percentActive: IDLE_CATEGORIES.has(owner)
        ? 0
        : percentage(weightMs, activeWeightMs),
    }))
    .sort((left, right) => right.weightMs - left.weightMs)

  const top = (items) =>
    Array.from(items.values())
      .sort((left, right) => right.weightMs - left.weightMs)
      .slice(0, 100)
      .map((item) => ({
        ...item,
        weightMs: Number(item.weightMs.toFixed(3)),
        percentActive: percentage(item.weightMs, activeWeightMs),
      }))

  return {
    sampleCount: samples.length,
    totalWeightMs: Number(totalWeightMs.toFixed(3)),
    activeWeightMs: Number(activeWeightMs.toFixed(3)),
    categories,
    layers,
    owners,
    topSelfFrames: top(selfFrames),
    topInclusiveFrames: top(inclusiveFrames),
  }
}

function summarizePairedWindows(snapshot, startName, endName) {
  const starts = new Map()
  const windows = []
  for (const mark of snapshot?.marks || []) {
    const token = mark.detail?.token
    if (!token) {
      continue
    }
    if (mark.name === startName) {
      starts.set(token, mark)
      continue
    }
    if (mark.name !== endName) {
      continue
    }
    const start = starts.get(token)
    if (!start || mark.time < start.time) {
      continue
    }
    windows.push({
      token,
      startMs: start.time,
      endMs: mark.time,
      durationMs: mark.time - start.time,
      rowsBefore: start.detail?.rowsBefore,
      rowsAfter: mark.detail?.rowsAfter,
      startDetail: start.detail,
      endDetail: mark.detail,
    })
  }
  return windows
}

function summarizeActionWindows(snapshot) {
  const starts = new Map()
  const windows = []
  for (const mark of snapshot?.marks || []) {
    if (mark.name === 'mst-action-start' && mark.detail?.token) {
      starts.set(mark.detail.token, mark)
      continue
    }
    if (mark.name !== 'mst-action-end' || !mark.detail?.token) {
      continue
    }
    const start = starts.get(mark.detail.token)
    if (!start || mark.time < start.time) {
      continue
    }
    windows.push({
      actionName: mark.detail.actionName,
      actionType: mark.detail.actionType,
      path: mark.detail.path,
      durationMs: mark.time - start.time,
    })
  }

  const groups = new Map()
  for (const window of windows) {
    const key = `${window.actionName}:${window.actionType}`
    const group = groups.get(key) || {
      key,
      actionName: window.actionName,
      actionType: window.actionType,
      count: 0,
      totalInclusiveMs: 0,
      maxInclusiveMs: 0,
      durationsMs: [],
      paths: new Set(),
    }
    group.count += 1
    group.totalInclusiveMs += window.durationMs
    group.maxInclusiveMs = Math.max(group.maxInclusiveMs, window.durationMs)
    group.durationsMs.push(window.durationMs)
    group.paths.add(window.path)
    groups.set(key, group)
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      totalInclusiveMs: Number(group.totalInclusiveMs.toFixed(3)),
      maxInclusiveMs: Number(group.maxInclusiveMs.toFixed(3)),
      medianInclusiveMs: Number(
        percentile(group.durationsMs, 0.5).toFixed(3)
      ),
      p95InclusiveMs: Number(
        percentile(group.durationsMs, 0.95).toFixed(3)
      ),
      durationsMs: group.durationsMs.map((duration) =>
        Number(duration.toFixed(3))
      ),
      paths: Array.from(group.paths).sort(),
    }))
    .sort((left, right) => right.totalInclusiveMs - left.totalInclusiveMs)
}

function percentile(values, ratio) {
  if (!values.length) {
    return 0
  }
  const sorted = values.slice().sort((left, right) => left - right)
  return sorted[
    Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))
  ]
}

function summarizeReactCommitWindow(snapshot, window) {
  const commits = (snapshot?.marks || []).filter(
    (mark) =>
      mark.name === 'react-commit' &&
      (!window ||
        (mark.time >= window.startMs && mark.time <= window.endMs))
  )
  return {
    count: commits.length,
    actualDurationMs: Number(
      commits
        .reduce((total, mark) => total + (mark.detail?.actualDuration || 0), 0)
        .toFixed(3)
    ),
    baseDurationMs: Number(
      commits
        .reduce((total, mark) => total + (mark.detail?.baseDuration || 0), 0)
        .toFixed(3)
    ),
    commits: commits.map((mark) => ({
      phase: mark.detail?.phase,
      actualDurationMs: mark.detail?.actualDuration || 0,
      baseDurationMs: mark.detail?.baseDuration || 0,
      startTimeMs: mark.detail?.startTime,
      commitTimeMs: mark.detail?.commitTime,
      callbackTimeMs: mark.time,
    })),
  }
}

function summarizeReactCommits(snapshot) {
  const measurement = createWindow(snapshot, 'measurement', 'scenario-start', 'ready')
  const postResponse = createWindow(snapshot, 'post-response', 'fetcher-resolved', 'ready')
  return {
    measurement: summarizeReactCommitWindow(snapshot, measurement),
    postResponse: summarizeReactCommitWindow(snapshot, postResponse),
  }
}

function summarizePostResponseTimeline(snapshot) {
  const postResponse = createWindow(
    snapshot,
    'post-response',
    'fetcher-resolved',
    'ready'
  )
  const table = createMaterializingTableUpdateWindow(snapshot)
  const initRows = createLargestMstActionWindow(
    snapshot,
    'initRows',
    'table-init-rows'
  )
  const react = createLargestReactCommitWindow(snapshot)
  if (!postResponse || !table || !initRows || !react) {
    return {
      status: 'missing-boundary',
      postResponse,
      table,
      initRows,
      react,
    }
  }

  const rawSegments = [
    ['response-handoff', postResponse.startMs, table.startMs],
    ['table-before-init-rows', table.startMs, initRows.startMs],
    ['table-init-rows', initRows.startMs, initRows.endMs],
    ['table-after-init-rows', initRows.endMs, table.endMs],
    ['pre-react-render-gap', table.endMs, react.startMs],
    ['dominant-react-render', react.startMs, react.endMs],
    ['post-render-tail', react.endMs, postResponse.endMs],
  ]
  const segments = rawSegments.map(([name, startMs, endMs]) => {
    const durationMs = Math.max(0, endMs - startMs)
    return {
      name,
      startMs,
      endMs,
      durationMs,
      percentWall: Number(
        ((durationMs / postResponse.durationMs) * 100).toFixed(1)
      ),
    }
  })
  return {
    status: 'ok',
    durationMs: postResponse.durationMs,
    coveredDurationMs: Number(
      segments.reduce((total, segment) => total + segment.durationMs, 0).toFixed(3)
    ),
    segments,
  }
}

function summarizeCpuProfile(profile, snapshot, timing) {
  const samples = buildSamples(profile, timing)
  const stages = createStageWindows(snapshot).map((window) => ({
    ...window,
    cpu: summarizeSamples(
      samples.filter(
        (sample) =>
          sample.performanceTimeMs >= window.startMs &&
          sample.performanceTimeMs <= window.endMs
      )
    ),
  }))

  return {
    timing,
    stages,
    mstActionWindows: summarizeActionWindows(snapshot),
    tablePhaseWindows: {
      componentDidUpdate: summarizePairedWindows(
        snapshot,
        'table-component-update-start',
        'table-component-update-end'
      ),
      syncRows: summarizePairedWindows(
        snapshot,
        'table-sync-rows-start',
        'table-sync-rows-end'
      ),
    },
    postResponseTimeline: summarizePostResponseTimeline(snapshot),
    react: summarizeReactCommits(snapshot),
  }
}

module.exports = {
  classifyFrame,
  createStageWindows,
  summarizeActionWindows,
  summarizeCpuProfile,
  summarizeReactCommits,
  summarizePostResponseTimeline,
}
