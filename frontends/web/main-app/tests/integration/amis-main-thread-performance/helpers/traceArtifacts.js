const fs = require('node:fs')
const path = require('node:path')
const { summarizeCpuProfile } = require('./cpuProfileAnalysis')

const STABLE_ARTIFACT_DIR = path.join(
  process.cwd(),
  'test-results',
  'amis-main-thread-performance'
)
const TARGET_URL_PART = '/api/amis-main-thread-performance/'

const REQUESTED_CATEGORIES = [
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'v8',
  'disabled-by-default-v8.cpu_profiler',
  'blink.user_timing',
  'loading',
  'toplevel',
]

const REQUIRED_DIAGNOSIS_CATEGORIES = [
  'blink.user_timing',
  'devtools.timeline',
  'disabled-by-default-v8.cpu_profiler',
]

function safeFilePart(value) {
  return String(value || 'default')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createDiagnosisArtifactPrefix(scenarioId, options = {}, runIndex = 1) {
  return [
    scenarioId,
    options.variant || 'default',
    options.responseMode || 'empty',
    options.validationMode || null,
    options.rowCount ? `rows-${options.rowCount}` : null,
    `run-${runIndex}`,
  ]
    .filter(Boolean)
    .map(safeFilePart)
    .join('-')
}

function resolveTraceCategories(availableCategories) {
  const available = new Set(availableCategories || [])
  const resolved = REQUESTED_CATEGORIES.filter((category) => available.has(category))
  const rejected = REQUESTED_CATEGORIES.filter((category) => !available.has(category))
  const missingRequired = REQUIRED_DIAGNOSIS_CATEGORIES.filter(
    (category) => !resolved.includes(category)
  )
  return {
    requested: REQUESTED_CATEGORIES.slice(),
    resolved,
    rejected,
    required: REQUIRED_DIAGNOSIS_CATEGORIES.slice(),
    missingRequired,
  }
}

function getMark(snapshot, name) {
  return (snapshot?.marks || []).find((mark) => mark.name === name) || null
}

function summarizeWindow(snapshot, name, startMarkName, endMarkName) {
  const startMark = getMark(snapshot, startMarkName)
  const endMark = getMark(snapshot, endMarkName)
  if (!startMark || !endMark) {
    return {
      name,
      startMark: startMarkName,
      endMark: endMarkName,
      status: 'missing',
    }
  }

  const durationMs = endMark.time - startMark.time
  if (durationMs < 0) {
    return {
      name,
      startMark: startMarkName,
      endMark: endMarkName,
      status: 'invalid',
      durationMs,
    }
  }

  const intersectingLongTasks = (snapshot.longTasks || []).filter((task) => {
    const taskStart = task.startTime
    const taskEnd = task.startTime + task.duration
    return taskStart < endMark.time && taskEnd > startMark.time
  })

  return {
    name,
    startMark: startMarkName,
    endMark: endMarkName,
    status: 'ok',
    durationMs,
    longTaskCount: intersectingLongTasks.length,
    longTaskTotalMs: intersectingLongTasks.reduce(
      (total, task) => total + task.duration,
      0
    ),
    longTaskMaxMs: intersectingLongTasks.length
      ? Math.max(...intersectingLongTasks.map((task) => task.duration))
      : 0,
  }
}

function summarizePhaseWindows(snapshot) {
  return [
    summarizeWindow(
      snapshot,
      'network-wait',
      'requestWillBeSent',
      'transport-response-end'
    ),
    summarizeWindow(
      snapshot,
      'request-transform',
      'request-transform-start',
      'request-body-ready'
    ),
    summarizeWindow(
      snapshot,
      'json-parse',
      'response-transform-start',
      'json-parse-finished'
    ),
    summarizeWindow(
      snapshot,
      'remap-handoff',
      'json-parse-finished',
      'fetcher-resolved'
    ),
    summarizeWindow(snapshot, 'react-browser', 'react-commit', 'ready'),
    summarizeWindow(snapshot, 'dialog-shell', 'click', 'shell-first-paint'),
    summarizeWindow(snapshot, 'dialog-body', 'shell-first-paint', 'body-ready'),
    summarizeWindow(snapshot, 'submit-pre-send', 'click', 'request-body-ready'),
    summarizeWindow(
      snapshot,
      'submit-response',
      'transport-response-end',
      'submit-complete'
    ),
  ]
}

async function readTraceStream(client, stream) {
  const chunks = []
  let eof = false
  while (!eof) {
    const response = await client.send('IO.read', { handle: stream })
    chunks.push(response.data || '')
    eof = Boolean(response.eof)
  }
  await client.send('IO.close', { handle: stream })
  return chunks.join('')
}

function summarizeTrace(traceJson, snapshot, categorySummary) {
  const traceEvents = Array.isArray(traceJson?.traceEvents)
    ? traceJson.traceEvents
    : []
  const durationEvents = traceEvents
    .filter((event) => typeof event.dur === 'number' && event.dur > 0)
    .sort((left, right) => right.dur - left.dur)
    .slice(0, 30)
    .map((event) => ({
      name: event.name,
      category: event.cat,
      durationMs: event.dur / 1000,
    }))

  const userTimingMarkNames = Array.from(
    new Set(
      traceEvents
        .filter((event) => String(event.cat || '').includes('blink.user_timing'))
        .map((event) => event.name)
        .filter(Boolean)
    )
  ).sort()

  const rendererMainThread = summarizeRendererMainThread(traceEvents, snapshot)

  return {
    categorySummary,
    traceEventCount: traceEvents.length,
    topDurationEvents: durationEvents,
    cpuProfileHotFrames: summarizeCpuProfileHotFrames(traceEvents),
    networkRequests: summarizeNetworkRequests(traceEvents),
    userTimingMarkNames,
    rendererMainThread,
    phaseWindows: summarizePhaseWindows(snapshot),
  }
}

const RENDERER_EVENT_CATEGORY = new Map([
  ['UpdateLayoutTree', 'style'],
  ['RecalculateStyles', 'style'],
  ['Layout', 'layout'],
  ['PrePaint', 'prepaint'],
  ['Paint', 'paint'],
  ['PaintImage', 'paint'],
  ['Layerize', 'composite'],
  ['UpdateLayer', 'composite'],
  ['Commit', 'composite'],
])

const SCRIPT_EVENT_NAMES = new Set([
  'EvaluateScript',
  'EventDispatch',
  'FireAnimationFrame',
  'FunctionCall',
  'RunMicrotasks',
  'TimerFire',
  'XHRLoad',
  'XHRReadyStateChange',
])

const CATEGORY_PRIORITY = {
  'main-thread-other': 1,
  script: 2,
  gc: 3,
  style: 4,
  layout: 4,
  prepaint: 4,
  paint: 4,
  composite: 4,
}

function rendererEventCategory(event) {
  if (RENDERER_EVENT_CATEGORY.has(event.name)) {
    return RENDERER_EVENT_CATEGORY.get(event.name)
  }
  if (
    /^V8\.GC/.test(event.name || '') ||
    /^(MinorGC|MajorGC|GC)$/.test(event.name || '')
  ) {
    return 'gc'
  }
  if (SCRIPT_EVENT_NAMES.has(event.name)) {
    return 'script'
  }
  if (event.name === 'RunTask') {
    return 'main-thread-other'
  }
  return null
}

function findRendererMainThread(traceEvents) {
  const metadata = traceEvents.find(
    (event) =>
      event.name === 'thread_name' && event.args?.name === 'CrRendererMain'
  )
  return metadata ? { pid: metadata.pid, tid: metadata.tid } : null
}

function findTraceMark(traceEvents, name, thread) {
  return traceEvents.find(
    (event) =>
      event.name === name &&
      event.pid === thread.pid &&
      event.tid === thread.tid
  )
}

function summarizeRendererMainThread(traceEvents, snapshot) {
  const thread = findRendererMainThread(traceEvents)
  const scenarioId = snapshot?.scenarioId
  if (!thread || !scenarioId) {
    return { status: 'missing-thread-or-scenario' }
  }

  const startMark = findTraceMark(
    traceEvents,
    `${scenarioId}:fetcher-resolved`,
    thread
  )
  const endMark = findTraceMark(traceEvents, `${scenarioId}:ready`, thread)
  if (!startMark || !endMark || endMark.ts < startMark.ts) {
    return { status: 'missing-post-response-marks', thread }
  }

  const startUs = startMark.ts
  const endUs = endMark.ts
  const events = traceEvents
    .filter(
      (event) =>
        event.pid === thread.pid &&
        event.tid === thread.tid &&
        event.ph === 'X' &&
        typeof event.dur === 'number' &&
        event.dur > 0 &&
        event.ts < endUs &&
        event.ts + event.dur > startUs
    )
    .map((event) => ({
      name: event.name,
      category: rendererEventCategory(event),
      startUs: Math.max(startUs, event.ts),
      endUs: Math.min(endUs, event.ts + event.dur),
      durationUs: event.dur,
    }))
    .filter((event) => event.category)

  const boundaries = Array.from(
    new Set([
      startUs,
      endUs,
      ...events.flatMap((event) => [event.startUs, event.endUs]),
    ])
  ).sort((left, right) => left - right)
  const categoryUs = new Map()
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const intervalStart = boundaries[index]
    const intervalEnd = boundaries[index + 1]
    if (intervalEnd <= intervalStart) {
      continue
    }
    const active = events
      .filter(
        (event) =>
          event.startUs <= intervalStart && event.endUs >= intervalEnd
      )
      .sort((left, right) => {
        const priority =
          CATEGORY_PRIORITY[right.category] - CATEGORY_PRIORITY[left.category]
        return priority || left.durationUs - right.durationUs
      })
    const category = active[0]?.category || 'idle-or-untraced'
    categoryUs.set(
      category,
      (categoryUs.get(category) || 0) + intervalEnd - intervalStart
    )
  }

  const durationMs = (endUs - startUs) / 1000
  const categories = Array.from(categoryUs.entries())
    .map(([category, durationUs]) => ({
      category,
      durationMs: Number((durationUs / 1000).toFixed(3)),
      percentWall: Number(((durationUs / (endUs - startUs)) * 100).toFixed(1)),
    }))
    .sort((left, right) => right.durationMs - left.durationMs)
  const directRenderingEvents = events
    .filter((event) =>
      ['style', 'layout', 'prepaint', 'paint', 'composite'].includes(
        event.category
      )
    )
    .sort((left, right) => right.durationUs - left.durationUs)
    .slice(0, 30)
    .map((event) => ({
      name: event.name,
      category: event.category,
      durationMs: Number((event.durationUs / 1000).toFixed(3)),
    }))

  return {
    status: 'ok',
    thread,
    durationMs,
    categories,
    directRenderingEvents,
  }
}

function getEventData(event) {
  return event?.args?.data || {}
}

function summarizeNetworkRequests(traceEvents) {
  const requests = new Map()
  for (const event of traceEvents) {
    if (
      !['ResourceSendRequest', 'ResourceReceiveResponse', 'ResourceFinish'].includes(
        event.name
      )
    ) {
      continue
    }
    const data = getEventData(event)
    const requestId = data.requestId
    const url = data.url
    if (!requestId) {
      continue
    }
    const existing = requests.get(requestId) || { requestId }
    if (url) {
      existing.url = url
    }
    if (event.name === 'ResourceSendRequest') {
      existing.method = data.requestMethod
      existing.resourceType = data.resourceType
      existing.sendTs = event.ts
    }
    if (event.name === 'ResourceReceiveResponse') {
      existing.statusCode = data.statusCode
      existing.mimeType = data.mimeType
      existing.responseTs = event.ts
      existing.encodedDataLength = data.encodedDataLength
    }
    if (event.name === 'ResourceFinish') {
      existing.finishTs = event.ts
      existing.didFail = data.didFail
      existing.decodedBodyLength = data.decodedBodyLength
    }
    requests.set(requestId, existing)
  }

  return Array.from(requests.values())
    .filter((request) => request.url?.includes(TARGET_URL_PART))
    .map((request) => ({
      requestId: request.requestId,
      url: request.url,
      method: request.method,
      statusCode: request.statusCode,
      resourceType: request.resourceType,
      mimeType: request.mimeType,
      timeToResponseMs:
        request.sendTs && request.responseTs
          ? (request.responseTs - request.sendTs) / 1000
          : null,
      timeToFinishMs:
        request.sendTs && request.finishTs
          ? (request.finishTs - request.sendTs) / 1000
          : null,
      encodedDataLength: request.encodedDataLength,
      decodedBodyLength: request.decodedBodyLength,
      didFail: request.didFail,
    }))
}

function formatCallFrame(callFrame = {}) {
  const functionName = callFrame.functionName || '(anonymous)'
  const url = callFrame.url || '(unknown)'
  const lineNumber =
    typeof callFrame.lineNumber === 'number' ? callFrame.lineNumber + 1 : null
  return `${functionName} @ ${url}${lineNumber ? `:${lineNumber}` : ''}`
}

function summarizeCpuProfileHotFrames(traceEvents) {
  const totals = new Map()
  let hasTimeDeltas = false
  for (const event of traceEvents) {
    if (event.name !== 'ProfileChunk') {
      continue
    }
    const data = getEventData(event)
    const profile = data.cpuProfile || {}
    const nodesById = new Map(
      (profile.nodes || []).map((node) => [node.id, node.callFrame])
    )
    const samples = profile.samples || []
    const timeDeltas = data.timeDeltas || []
    if (timeDeltas.length > 0) {
      hasTimeDeltas = true
    }
    samples.forEach((sampleId, index) => {
      const callFrame = nodesById.get(sampleId)
      if (!callFrame) {
        return
      }
      const key = formatCallFrame(callFrame)
      const current = totals.get(key) || {
        frame: key,
        functionName: callFrame.functionName || '(anonymous)',
        url: callFrame.url || '(unknown)',
        lineNumber:
          typeof callFrame.lineNumber === 'number'
            ? callFrame.lineNumber + 1
            : null,
        sampleCount: 0,
        sampleWeightUs: 0,
      }
      current.sampleCount += 1
      current.sampleWeightUs += timeDeltas[index] || 0
      totals.set(key, current)
    })
  }

  return Array.from(totals.values())
    .sort((left, right) => {
      const leftWeight = hasTimeDeltas ? left.sampleWeightUs : left.sampleCount
      const rightWeight = hasTimeDeltas ? right.sampleWeightUs : right.sampleCount
      return rightWeight - leftWeight
    })
    .slice(0, 30)
    .map((item) => ({
      ...item,
      sampleWeightMs: hasTimeDeltas ? item.sampleWeightUs / 1000 : null,
    }))
}

function writeJsonPair(testInfo, fileName, value) {
  const outputPath = testInfo.outputPath(fileName)
  fs.mkdirSync(STABLE_ARTIFACT_DIR, { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(value, null, 2))
  fs.writeFileSync(
    path.join(STABLE_ARTIFACT_DIR, fileName),
    JSON.stringify(value, null, 2)
  )
  return outputPath
}

async function collectTraceCategorySnapshot(page, testInfo) {
  const client = await page.context().newCDPSession(page)
  const { categories } = await client.send('Tracing.getCategories')
  const summary = resolveTraceCategories(categories)
  const outputPath = testInfo.outputPath('trace-categories.json')
  fs.mkdirSync(STABLE_ARTIFACT_DIR, { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2))
  fs.writeFileSync(
    path.join(STABLE_ARTIFACT_DIR, 'trace-categories.json'),
    JSON.stringify(summary, null, 2)
  )
  await testInfo.attach('trace-categories', {
    path: outputPath,
    contentType: 'application/json',
  })
  await client.detach()
  return summary
}

async function collectCdpTraceForAction(page, testInfo, prefix, action) {
  const client = await page.context().newCDPSession(page)
  const { categories } = await client.send('Tracing.getCategories')
  const categorySummary = resolveTraceCategories(categories)
  if (categorySummary.missingRequired.length > 0) {
    await client.detach()
    throw new Error(
      `Missing required CDP trace categories: ${categorySummary.missingRequired.join(
        ', '
      )}`
    )
  }

  let actionResult
  let actionError
  let traceJson = null
  let cpuProfile = null
  let cpuProfileTiming = null
  const tracingComplete = new Promise((resolve) => {
    client.once('Tracing.tracingComplete', resolve)
  })

  await client.send('Tracing.start', {
    categories: categorySummary.resolved.join(','),
    transferMode: 'ReturnAsStream',
  })

  await client.send('Profiler.enable')
  await client.send('Profiler.setSamplingInterval', { interval: 500 })
  const profileStartBefore = await readPagePerformanceNow(client)
  await client.send('Profiler.start')
  const profileStartAfter = await readPagePerformanceNow(client)

  try {
    actionResult = await action()
  } catch (error) {
    actionError = error
  } finally {
    const profileEndBefore = await readPagePerformanceNow(client)
    const stoppedProfile = await client.send('Profiler.stop')
    const profileEndAfter = await readPagePerformanceNow(client)
    cpuProfile = stoppedProfile.profile
    cpuProfileTiming = {
      profileStartPerformanceMs:
        (profileStartBefore + profileStartAfter) / 2,
      profileEndPerformanceMs: (profileEndBefore + profileEndAfter) / 2,
      startCalibrationRangeMs: profileStartAfter - profileStartBefore,
      endCalibrationRangeMs: profileEndAfter - profileEndBefore,
      samplingIntervalUs: 500,
    }
    await client.send('Profiler.disable')
    await client.send('Tracing.end')
    const completeEvent = await tracingComplete
    const rawTrace = await readTraceStream(client, completeEvent.stream)
    traceJson = JSON.parse(rawTrace)
    await client.detach()
  }

  if (actionError) {
    throw actionError
  }

  const traceFileName = `${prefix}-cdp-trace.json`
  const cpuProfileFileName = `${prefix}-cpu-profile.json`
  const summaryFileName = `${prefix}-trace-summary.json`
  const metricsFileName = `${prefix}-metrics.json`
  const traceSummary = summarizeTrace(traceJson, actionResult, categorySummary)
  traceSummary.cpuAttribution = summarizeCpuProfile(
    cpuProfile,
    actionResult,
    cpuProfileTiming
  )
  const tracePath = writeJsonPair(testInfo, traceFileName, traceJson)
  const cpuProfilePath = writeJsonPair(
    testInfo,
    cpuProfileFileName,
    cpuProfile
  )
  const summaryPath = writeJsonPair(testInfo, summaryFileName, traceSummary)
  const metricsPath = writeJsonPair(testInfo, metricsFileName, {
    snapshot: {
      ...actionResult,
      phaseWindows: traceSummary.phaseWindows,
    },
    categorySummary,
  })

  await testInfo.attach(traceFileName, {
    path: tracePath,
    contentType: 'application/json',
  })
  await testInfo.attach(cpuProfileFileName, {
    path: cpuProfilePath,
    contentType: 'application/json',
  })
  await testInfo.attach(summaryFileName, {
    path: summaryPath,
    contentType: 'application/json',
  })
  await testInfo.attach(metricsFileName, {
    path: metricsPath,
    contentType: 'application/json',
  })

  return {
    result: {
      ...actionResult,
      phaseWindows: traceSummary.phaseWindows,
    },
    summary: traceSummary,
    paths: {
      trace: tracePath,
      cpuProfile: cpuProfilePath,
      summary: summaryPath,
      metrics: metricsPath,
    },
  }
}

async function readPagePerformanceNow(client) {
  const response = await client.send('Runtime.evaluate', {
    expression: 'performance.now()',
    returnByValue: true,
  })
  const value = response?.result?.value
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Unable to calibrate CDP CPU profile to performance.now()')
  }
  return value
}

module.exports = {
  REQUESTED_CATEGORIES,
  collectCdpTraceForAction,
  collectTraceCategorySnapshot,
  createDiagnosisArtifactPrefix,
  resolveTraceCategories,
  summarizeRendererMainThread,
  summarizePhaseWindows,
}
