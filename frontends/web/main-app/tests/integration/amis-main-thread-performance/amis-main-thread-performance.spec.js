const fs = require('node:fs')
const crypto = require('node:crypto')
const os = require('node:os')
const path = require('node:path')
const { test, expect } = require('@playwright/test')
const {
  RAW_CHECK_COLUMNS,
  createDialogFormSchema,
  createRouteResponse,
} = require('./fixtures/performanceData')
const { resolvePerformanceMode } = require('./helpers/performanceExecutionMode')
const {
  collectCdpTraceForAction,
  collectTraceCategorySnapshot,
  createDiagnosisArtifactPrefix,
} = require('./helpers/traceArtifacts')
const {
  createAmisMainThreadPerformanceFingerprint,
} = require('../../../scripts/write-amis-main-thread-performance-fingerprint')

const PERF_ENV = resolvePerformanceMode()
const STABLE_ARTIFACT_DIR = path.join(
  process.cwd(),
  'test-results',
  'amis-main-thread-performance'
)
if (
  PERF_ENV.sampleSet === 'scroll-baseline' &&
  process.env.PERF_BASELINE_OUTPUT &&
  fs.existsSync(process.env.PERF_BASELINE_OUTPUT)
) {
  throw new Error(
    `Refusing to overwrite tracked baseline: ${process.env.PERF_BASELINE_OUTPUT}`
  )
}
const BASE_SCENARIOS = [
  ['C0'],
  ['C1'],
  ['C2'],
  ['C3'],
  ['C4a', { variant: 'object-default' }],
  ['C4a', { variant: 'amis-json' }],
  ['C4b', { variant: 'object-default' }],
  ['C4c', { variant: 'object-default', responseMode: 'echo' }],
  ['C4c', { variant: 'amis-json', responseMode: 'echo' }],
]
const DIAGNOSIS_SCENARIOS = [
  ['C0'],
  ['C1', { rowCount: 250 }],
  ['C1'],
  ['C2', { rowCount: 250 }],
  ['C2'],
  ['C3', { variant: 'inline' }],
  ['C3', { variant: 'lazy' }],
  ['C3', { variant: 'amis-schema' }],
  ['C4a', { variant: 'object-default' }],
  ['C4a', { variant: 'amis-json' }],
  ['C4b', { variant: 'object-default', validationMode: 'unique-on' }],
  ['C4b', { variant: 'object-default', validationMode: 'unique-off' }],
  ['C4c', { variant: 'object-default', responseMode: 'echo' }],
  ['C4c', { variant: 'amis-json', responseMode: 'echo' }],
]
const ATTRIBUTION_SCENARIOS = [
  ['C1'],
  ['C2'],
]
const SCHEDULE_POC_SCENARIOS = [
  ['C1', { cooperativeScheduling: true }],
  ['C2', { cooperativeScheduling: true }],
  ['C4a', { variant: 'object-default', cooperativeScheduling: true }],
  [
    'C4c',
    {
      variant: 'object-default',
      responseMode: 'echo',
      cooperativeScheduling: true,
    },
  ],
]
const IDENTITY_POC_SCENARIOS = [
  ['C4a', { variant: 'object-default' }],
  ['C4c', { variant: 'object-default', responseMode: 'echo' }],
]
const REAL_FORM_SCENARIOS = [
  ['C5', { variant: 'stuck' }],
  ['C5', { variant: 'adapted' }],
]
const POC_SCENARIOS = [
  ['C1', { rowCount: 250 }],
  ['C1'],
  ['C2', { rowCount: 50 }],
  ['C2', { rowCount: 250 }],
  ['C2'],
  ['C3', { variant: 'inline' }],
  ['C3', { variant: 'lazy' }],
  ['C3', { variant: 'amis-schema' }],
  ['C4b', { variant: 'object-default', validationMode: 'unique-on' }],
  ['C4b', { variant: 'object-default', validationMode: 'unique-off' }],
]
const GATE_SCENARIOS = [
  ['C0', { fixtureProfile: 'control' }],
  ['C1', { fixtureProfile: 'crud' }],
  ['C2', { fixtureProfile: 'input-table' }],
  ['C1', { fixtureProfile: 'scroll' }],
  ['C1', { fixtureProfile: 'wide-horizontal', columns: createWideColumns() }],
  ['C1', { fixtureProfile: 'dynamic-vertical', columns: createDynamicColumns() }],
  ['C1', { fixtureProfile: 'cross-axis', columns: createWideDynamicColumns() }],
]
const SCROLL_BASELINE_SCENARIOS = GATE_SCENARIOS
const RAW_CHECK_SCENARIOS = [
  [
    'C1',
    {
      fixtureProfile: 'raw-check',
      rowCount: 200,
      columns: RAW_CHECK_COLUMNS,
      selectable: true,
      multiple: true,
      columnsTogglable: true,
    },
  ],
]
const SCENARIOS =
  PERF_ENV.sampleSet === 'diagnose'
    ? DIAGNOSIS_SCENARIOS
    : PERF_ENV.sampleSet === 'attribution'
    ? ATTRIBUTION_SCENARIOS
    : PERF_ENV.sampleSet === 'schedule-poc'
    ? SCHEDULE_POC_SCENARIOS
    : PERF_ENV.sampleSet === 'identity-poc'
    ? IDENTITY_POC_SCENARIOS
    : PERF_ENV.sampleSet === 'form-real'
    ? REAL_FORM_SCENARIOS
    : PERF_ENV.sampleSet === 'poc'
    ? POC_SCENARIOS
    : PERF_ENV.sampleSet === 'scroll-baseline'
    ? SCROLL_BASELINE_SCENARIOS
    : PERF_ENV.sampleSet === 'gate'
    ? GATE_SCENARIOS
    : PERF_ENV.sampleSet === 'raw-check'
    ? RAW_CHECK_SCENARIOS
    : BASE_SCENARIOS

const C3_DIALOG_GATE_MAX_MEDIAN_SHELL_GAP_MS = 120
const TABLE_POST_RESPONSE_MAX_LONG_TASK_MS = 200
const TABLE_POST_RESPONSE_MAX_FRAME_GAP_MS = 220
const TABLE_READY_INTERACTION_MAX_LONG_TASK_MS = 100
const TABLE_READY_INTERACTION_MAX_FRAME_GAP_MS = 100
const REAL_FORM_ROW_COUNT = 1000

const REAL_FORM_SCHEMA_PATHS = {
  stuck:
    process.env.AMIS_STUCK_FORM_SCHEMA_PATH ||
    path.join(
      os.homedir(),
      'Downloads',
      'check.raw-check.edit-\u5361.json'
    ),
  adapted:
    process.env.AMIS_ADAPTED_FORM_SCHEMA_PATH ||
    path.join(
      os.homedir(),
      'Downloads',
      'check.raw-check.edit-\u4e0d\u5361.json'
    ),
}

function createWideColumns() {
  return Array.from({ length: 60 }, (_, index) => ({
    name: `field${index}`,
    label: `Wide Field ${index}`,
    type: index % 5 === 0 ? 'tpl' : 'text',
  }))
}

function createDynamicColumns() {
  return Array.from({ length: 12 }, (_, index) => ({
    name: `field${index}`,
    label: `Dynamic Field ${index}`,
    type: index % 3 === 0 ? 'tpl' : 'text',
    className: index % 3 === 0 ? 'amis-main-thread-dynamic-cell' : undefined,
  }))
}

function createWideDynamicColumns() {
  return createWideColumns().map((column, index) => ({
    ...column,
    className: index % 4 === 0 ? 'amis-main-thread-dynamic-cell' : undefined,
  }))
}

function loadRealFormSchema(variant) {
  const filePath = REAL_FORM_SCHEMA_PATHS[variant]
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Missing real Form schema for ${variant}: ${filePath}`)
  }
  const source = fs.readFileSync(filePath, 'utf8')
  const parsed = JSON.parse(source)
  if (!parsed?.schema || parsed.schema.type !== 'form') {
    throw new Error(`Invalid real Form schema for ${variant}: ${filePath}`)
  }
  return {
    schema: parsed.schema,
    sourceFile: path.basename(filePath),
    sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
  }
}

function parseRequestData(postData) {
  if (!postData) {
    return null
  }
  try {
    return JSON.parse(postData)
  } catch {
    return postData
  }
}

function summarizeRealFormRequest(postData) {
  const data = parseRequestData(postData)
  const detail = Array.isArray(data?.detail) ? data.detail : []
  const semanticPayload = {
    checkResult: data?.checkResult ?? null,
    detail: detail.map((item) => ({
      id: item?.id ?? null,
      checkValue: item?.checkValue ?? null,
      innerCheckResult:
        item?.innerCheckResult?.code ?? item?.innerCheckResult ?? null,
      fixResult: item?.fixResult ?? null,
    })),
  }
  return {
    detailCount: detail.length,
    checkResult: data?.checkResult ?? null,
    semanticSha256: crypto
      .createHash('sha256')
      .update(JSON.stringify(semanticPayload))
      .digest('hex'),
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function gotoHarness(page) {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message))
  await page.goto('/amis-main-thread-performance-playwright-harness.html')
  try {
    await page.waitForFunction(
      () => window.__AMIS_MAIN_THREAD_PERF__?.ready === true,
      null,
      { timeout: 30_000 }
    )
  } catch (error) {
    throw new Error(
      `Performance harness failed to become ready: ${pageErrors.join('\n') || error.message}`
    )
  }
}

async function installRoutes(page, routeRequests = []) {
  await page.route('**/api/ui-schema**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const schemaPath = requestUrl.searchParams.get('path')
    const payload =
      schemaPath === '/amis-main-thread-performance/dialog-form'
        ? createDialogFormSchema(500)
        : null
    await route.fulfill({
      status: payload ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify({
        code: payload ? 0 : 404,
        status: payload ? 0 : 404,
        msg: payload ? '' : 'Schema Not Found',
        data: payload,
      }),
    })
  })

  await page.route('**/api/amis-main-thread-performance/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const delayMs = url.pathname.includes('c0-crud') ? 1000 : 300
    const response = createRouteResponse(
      url.pathname,
      request.postData(),
      url.searchParams
    )
    routeRequests.push({
      pathname: url.pathname,
      page: Number(url.searchParams.get('page') || 1),
      perPage: Number(url.searchParams.get('perPage') || 0),
      itemCount: Array.isArray(response?.data?.items)
        ? response.data.items.length
        : null,
      total: typeof response?.data?.total === 'number' ? response.data.total : null,
      ...(url.pathname.endsWith('/c5-real-form-submit')
        ? { realFormPayload: summarizeRealFormRequest(request.postData()) }
        : {}),
    })
    const body = JSON.stringify(response)
    await sleep(delayMs)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'content-length': Buffer.byteLength(body).toString(),
      },
      body,
    })
  })

  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (
      pathname.startsWith('/api/amis-main-thread-performance/') ||
      pathname === '/api/ui-schema'
    ) {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, status: 0, msg: '', data: [] }),
    })
  })
}

function expectMarks(snapshot, names) {
  const actualNames = snapshot.marks.map((mark) => mark.name)
  for (const name of names) {
    expect(actualNames, `${snapshot.scenarioId} should include ${name}`).toContain(name)
  }
}

function expectMonotonicMarks(snapshot, names) {
  const marksByName = new Map(snapshot.marks.map((mark) => [mark.name, mark.time]))
  for (let index = 1; index < names.length; index += 1) {
    const previous = marksByName.get(names[index - 1])
    const current = marksByName.get(names[index])
    expect(previous, `${names[index - 1]} mark should exist`).toBeDefined()
    expect(current, `${names[index]} mark should exist`).toBeDefined()
    expect(current).toBeGreaterThanOrEqual(previous)
  }
}

function expectMonotonicRequestMarks(snapshot, names, urlPart) {
  const marks = names.map((name) => {
    if (name === 'click') {
      return snapshot.marks.find((mark) => mark.name === name)
    }
    return snapshot.marks.find(
      (mark) =>
        mark.name === name && String(mark.detail?.url || '').includes(urlPart)
    )
  })
  for (let index = 0; index < marks.length; index += 1) {
    expect(marks[index], `${snapshot.runId} should include ${names[index]}`).toBeDefined()
    if (index > 0) {
      expect(marks[index].time).toBeGreaterThanOrEqual(marks[index - 1].time)
    }
  }
}

function percentile(values, ratio) {
  if (!values.length) {
    return 0
  }
  const sorted = values.slice().sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1)
  )
  return sorted[index]
}

function median(values) {
  return percentile(values, 0.5)
}

function summarizeValues(values) {
  const medianValue = median(values)
  const deviations = values.map((value) => Math.abs(value - medianValue))
  return {
    median: medianValue,
    p95: percentile(values, 0.95),
    max: values.length ? Math.max(...values) : 0,
    mad: median(deviations),
  }
}

function scenarioKey(snapshot, options = {}) {
  const includePocDimensions = options.includePocDimensions === true
  return [
    snapshot.scenarioId,
    snapshot.fixtureProfile || null,
    snapshot.variant || 'default',
    snapshot.responseMode || 'empty',
    includePocDimensions ? snapshot.validationMode || null : null,
    includePocDimensions && snapshot.rowCount ? `rows-${snapshot.rowCount}` : null,
  ]
    .filter(Boolean)
    .join(':')
}

function summarizeRunDurations(items) {
  return summarizeValues(
    items.map((snapshot) => {
      const start = snapshot.marks?.find((mark) => mark.name === 'scenario-start')
      const ready = snapshot.marks?.find((mark) => mark.name === 'ready')
      return start && ready ? ready.time - start.time : 0
    })
  )
}

function summarizeSnapshots(snapshots, options = {}) {
  const groups = new Map()
  for (const snapshot of snapshots) {
    const key = scenarioKey(snapshot, options)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key).push(snapshot)
  }

  return Array.from(groups.entries()).map(([key, items]) => {
    const functionalHashes = Array.from(
      new Set(items.map((snapshot) => snapshot.functionalHash))
    )
    expect(functionalHashes, `${key} functionalHash should be stable`).toHaveLength(1)
    return {
      key,
      scenarioId: items[0].scenarioId,
      fixtureProfile: items[0].fixtureProfile || null,
      variant: items[0].variant || null,
      responseMode: items[0].responseMode || null,
      validationMode: items[0].validationMode || null,
      rowCount: items[0].rowCount || null,
      runs: items.length,
      functionalHash: functionalHashes[0],
      maxFrameGapMs: summarizeValues(
        items.map((snapshot) => snapshot.maxFrameGapMs || 0)
      ),
      maxLongTaskMs: summarizeValues(
        items.map((snapshot) => snapshot.maxLongTaskMs || 0)
      ),
      longTaskOver100Count: summarizeValues(
        items.map((snapshot) => snapshot.longTaskOver100Count || 0)
      ),
      durationMs: summarizeRunDurations(items),
    }
  })
}

function summarizeBaseline(snapshots) {
  return summarizeSnapshots(snapshots, { includePocDimensions: false }).map(
    ({
      key,
      scenarioId,
      variant,
      responseMode,
      runs,
      functionalHash,
      maxFrameGapMs,
      maxLongTaskMs,
      longTaskOver100Count,
    }) => ({
      key,
      scenarioId,
      variant,
      responseMode,
      runs,
      functionalHash,
      maxFrameGapMs,
      maxLongTaskMs,
      longTaskOver100Count,
    })
  )
}

function createComparisonFixtures(snapshots) {
  return summarizeSnapshots(snapshots, { includePocDimensions: true })
    .map((item) => ({
      key: item.key,
      scenarioId: item.scenarioId,
      fixtureProfile: item.fixtureProfile,
      variant: item.variant,
      responseMode: item.responseMode,
      validationMode: item.validationMode,
      rowCount: item.rowCount,
      functionalHash: item.functionalHash,
    }))
    .sort((left, right) => left.key.localeCompare(right.key))
}

function readJsonFile(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    throw new Error(`Failed to read ${label} JSON at ${filePath}: ${error.message}`)
  }
}

function writeScrollBaselineArtifact(metrics) {
  const outputPath = process.env.PERF_BASELINE_OUTPUT
  if (!outputPath) {
    return
  }
  if (fs.existsSync(outputPath)) {
    throw new Error(`Refusing to overwrite tracked baseline: ${outputPath}`)
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(metrics, null, 2))
}

function assertGateMatchesTrackedBaseline(metrics) {
  const baselinePath = process.env.PERF_BASELINE
  if (!baselinePath) {
    return
  }
  const baseline = readJsonFile(baselinePath, 'tracked baseline')
  expect(
    baseline.comparisonFingerprint,
    'tracked baseline must include comparisonFingerprint'
  ).toBeDefined()
  expect(metrics.comparisonFingerprint).toEqual(baseline.comparisonFingerprint)
}

function createInteractionFailureContext(snapshot, extra = {}) {
  return JSON.stringify(
    {
      scenarioId: snapshot.scenarioId,
      fixtureProfile: snapshot.fixtureProfile,
      runId: snapshot.runId,
      visibleRows: {
        all: snapshot.visibleRowCount,
        business: snapshot.visibleBusinessRowCount,
      },
      table: snapshot.tableStoreState,
      recentMarks: snapshot.marks
        ?.slice(-8)
        .map((mark) => ({
          name: mark.name,
          timestamp: mark.startTime,
          detail: mark.detail,
        })),
      ...extra,
    },
    null,
    2
  )
}

function expectVisibleRowShellCoverage(snapshot, expectedMinRows = 1) {
  const debug = createInteractionFailureContext(snapshot, {
    visibleRowShellCoverage: snapshot.visibleRowShellCoverage,
  })
  const coverage = snapshot.visibleRowShellCoverage
  expect(coverage, debug).toBeDefined()
  expect(coverage.rowCount, debug).toBeGreaterThanOrEqual(expectedMinRows)
  expect(coverage.minCellCount, debug).toBeGreaterThan(0)
  expect(coverage.rowsWithoutCells, debug).toBe(0)
  expect(coverage.emptyBlocksOutsideCells, debug).toBe(0)
  expect(coverage.placeholderRowsWithoutCellPlaceholder, debug).toBe(0)
}

function findMark(snapshot, name) {
  return snapshot.marks.find((mark) => mark.name === name)
}

function durationBetween(snapshot, startName, endName) {
  const start = findMark(snapshot, startName)
  const end = findMark(snapshot, endName)
  expect(start, `${snapshot.runId} should include ${startName}`).toBeDefined()
  expect(end, `${snapshot.runId} should include ${endName}`).toBeDefined()
  expect(end.time).toBeGreaterThanOrEqual(start.time)
  return end.time - start.time
}

function summarizeDurations(snapshots, startName, endName) {
  return summarizeValues(
    snapshots.map((snapshot) => durationBetween(snapshot, startName, endName))
  )
}

function assertC3DialogSchedulingGate(snapshots) {
  const c3Snapshots = snapshots.filter((snapshot) => snapshot.scenarioId === 'C3')
  const summary = summarizeSnapshots(c3Snapshots, { includePocDimensions: true })
  expect(summary, 'C3 dialog scheduling gate should have one summary group').toHaveLength(1)
  const c3 = summary[0]
  expect(c3.key).toBe('C3:inline:empty')
  expect(c3.runs).toBe(5)

  const shellGap = summarizeDurations(c3Snapshots, 'click', 'shell-first-paint')
  expect(shellGap.median).toBeLessThanOrEqual(
    C3_DIALOG_GATE_MAX_MEDIAN_SHELL_GAP_MS
  )

  for (const snapshot of c3Snapshots) {
    durationBetween(snapshot, 'shell-first-paint', 'body-ready')
  }
}

function timeoutForSampleSet(sampleSet) {
  if (sampleSet === 'calibrate') {
    return 1_800_000
  }
  if (sampleSet === 'diagnose') {
    return 600_000
  }
  if (sampleSet === 'attribution') {
    return 600_000
  }
  if (sampleSet === 'schedule-poc') {
    return 600_000
  }
  if (sampleSet === 'identity-poc') {
    return 600_000
  }
  if (sampleSet === 'poc') {
    return 600_000
  }
  if (sampleSet === 'scroll-baseline') {
    return 900_000
  }
  if (sampleSet === 'gate') {
    return 600_000
  }
  if (sampleSet === 'raw-check') {
    return 600_000
  }
  return 120_000
}

test.describe.configure({ mode: 'serial' })

test('amis main-thread performance harness records smoke metrics for C0-C4c', async ({
  page,
}, testInfo) => {
  test.setTimeout(timeoutForSampleSet(PERF_ENV.sampleSet))
  expect(['record', 'gate']).toContain(PERF_ENV.mode)

  const routeRequests = []
  await installRoutes(page, routeRequests)
  await gotoHarness(page)

  const traceSummary = await collectTraceCategorySnapshot(page, testInfo)
  expect(traceSummary.resolved).toContain('blink.user_timing')

  const snapshots = []
  const diagnosisArtifacts = []
  const isCalibration = PERF_ENV.sampleSet === 'calibrate'
  const isDiagnosis = PERF_ENV.sampleSet === 'diagnose'
  const isAttribution = PERF_ENV.sampleSet === 'attribution'
  const isSchedulePoc = PERF_ENV.sampleSet === 'schedule-poc'
  const isIdentityPoc = PERF_ENV.sampleSet === 'identity-poc'
  const isRealForm = PERF_ENV.sampleSet === 'form-real'
  const isRawCheck = PERF_ENV.sampleSet === 'raw-check'
  const isScrollBaseline = PERF_ENV.sampleSet === 'scroll-baseline'
  const isProfiled =
    isDiagnosis ||
    isAttribution ||
    isSchedulePoc ||
    isIdentityPoc ||
    isRealForm ||
    isRawCheck
  const isPoc = PERF_ENV.sampleSet === 'poc'
  const isGate = PERF_ENV.sampleSet === 'gate'
  for (let runIndex = 1; runIndex <= PERF_ENV.runs; runIndex += 1) {
    for (const [scenarioId, options] of SCENARIOS) {
      const scenarioOptions = { ...(options || {}), runIndex }
      if (scenarioId === 'C5') {
        scenarioOptions.realForm = loadRealFormSchema(
          scenarioOptions.variant || 'stuck'
        )
        scenarioOptions.rowCount = REAL_FORM_ROW_COUNT
      }
      const requestStartIndex = routeRequests.length
      const runAction = () =>
        page.evaluate(
          ({ scenario, scenarioOptions: pageScenarioOptions }) =>
            window.__AMIS_MAIN_THREAD_PERF__.runScenario(
              scenario,
              pageScenarioOptions
            ),
          {
            scenario: scenarioId,
            scenarioOptions,
          }
        )
      let snapshot
      if (isProfiled) {
        const prefix = createDiagnosisArtifactPrefix(
          scenarioId,
          options || {},
          runIndex
        )
        const traceArtifact = await collectCdpTraceForAction(
          page,
          testInfo,
          prefix,
          runAction
        )
        snapshot = traceArtifact.result
        diagnosisArtifacts.push({
          prefix,
          traceEventCount: traceArtifact.summary.traceEventCount,
          phaseWindows: traceArtifact.summary.phaseWindows,
          topDurationEvents: traceArtifact.summary.topDurationEvents.slice(0, 10),
          cpuAttribution: traceArtifact.summary.cpuAttribution,
        })
      } else {
        snapshot = await runAction()
      }
      if (scenarioId === 'C1') {
        const c1Request = routeRequests
          .slice(requestStartIndex)
          .reverse()
          .find((item) => item.pathname.endsWith('/c1-crud'))
        if (c1Request) {
          snapshot.dataScaleRequest = c1Request
        }
      }
      if (scenarioId === 'C5') {
        const submitRequest = routeRequests
          .slice(requestStartIndex)
          .reverse()
          .find((item) => item.pathname.endsWith('/c5-real-form-submit'))
        if (submitRequest) {
          snapshot.submitRequest = submitRequest
        }
      }
      snapshots.push(snapshot)
      expect(snapshot.functionalHash).toMatch(/^\d+:[a-f0-9]+$/)
      expect(snapshot.maxFrameGapMs).toBeGreaterThanOrEqual(0)
      expectMarks(snapshot, ['scenario-start', 'react-commit', 'ready'])

      if (['C0', 'C1', 'C2'].includes(scenarioId)) {
        expectMarks(snapshot, [
          'fetcher-entered',
          'request-transform-start',
          'request-body-ready',
          'response-transform-start',
          'json-parse-finished',
          'fetcher-resolved',
        ])
        expect(snapshot.tableStoreState?.rowCount).toBe(snapshot.rowCount)
        expect(snapshot.tableStoreState?.pendingMaterialization).toBe(0)
        expect(snapshot.hasFirstRowValue).toBe(true)
        expectVisibleRowShellCoverage(snapshot, Math.min(snapshot.rowCount, 1))
        expect(snapshot.visibleBusinessRowCount).toBeGreaterThanOrEqual(
          Math.min(snapshot.rowCount, 1)
        )
        if (scenarioId === 'C1' || scenarioId === 'C2') {
          expect(snapshot.postResponseResponsiveness?.status).toBe('ok')
        }
      }

      if (
        ['scroll', 'dynamic-vertical', 'cross-axis'].includes(
          snapshot.fixtureProfile
        )
      ) {
        expect(snapshot.verticalInteractionStatus).toBe('ok')
        expect(snapshot.verticalSeekResponsiveness?.status).toBe('ok')
        expect(snapshot.verticalReturnResponsiveness?.status).toBe('ok')
        if (!isScrollBaseline) {
          const verticalInteractionDebug = createInteractionFailureContext(
            snapshot,
            {
              verticalScrollExtent: snapshot.verticalScrollExtent,
              verticalSeekResponsiveness:
                snapshot.verticalSeekResponsiveness,
              verticalReturnResponsiveness:
                snapshot.verticalReturnResponsiveness,
              verticalSeekMaterializationDelta:
                snapshot.verticalSeekMaterializationDelta,
              verticalReturnMaterializationDelta:
                snapshot.verticalReturnMaterializationDelta,
            }
          )
          expect(
            snapshot.verticalSeekMaterializationDelta?.rowCreateDelta,
            verticalInteractionDebug
          ).toBe(0)
          expect(
            snapshot.verticalSeekMaterializationDelta?.publishDelta,
            verticalInteractionDebug
          ).toBe(0)
          expect(
            snapshot.verticalReturnMaterializationDelta?.rowCreateDelta,
            verticalInteractionDebug
          ).toBe(0)
          expect(
            snapshot.verticalReturnMaterializationDelta?.publishDelta,
            verticalInteractionDebug
          ).toBe(0)
          expect(
            snapshot.verticalSeekResponsiveness.maxLongTaskMs,
            verticalInteractionDebug
          ).toBeLessThan(TABLE_READY_INTERACTION_MAX_LONG_TASK_MS)
          expect(
            snapshot.verticalSeekResponsiveness.maxFrameGapMs,
            verticalInteractionDebug
          ).toBeLessThan(TABLE_READY_INTERACTION_MAX_FRAME_GAP_MS)
          expect(
            snapshot.verticalReturnResponsiveness.maxLongTaskMs,
            verticalInteractionDebug
          ).toBeLessThan(TABLE_READY_INTERACTION_MAX_LONG_TASK_MS)
          expect(
            snapshot.verticalReturnResponsiveness.maxFrameGapMs,
            verticalInteractionDebug
          ).toBeLessThan(TABLE_READY_INTERACTION_MAX_FRAME_GAP_MS)
        }
      }

      if (
        ['wide-horizontal', 'cross-axis'].includes(snapshot.fixtureProfile)
      ) {
        expect(snapshot.horizontalInteractionStatus).toBe('ok')
        expect(snapshot.horizontalSweepResponsiveness?.status).toBe('ok')
        if (!isScrollBaseline) {
          const horizontalInteractionDebug = createInteractionFailureContext(
            snapshot,
            {
              horizontalScrollExtent: snapshot.horizontalScrollExtent,
              horizontalSweepResponsiveness:
                snapshot.horizontalSweepResponsiveness,
              horizontalSweepMaterializationDelta:
                snapshot.horizontalSweepMaterializationDelta,
            }
          )
          expect(
            snapshot.horizontalSweepMaterializationDelta?.rowCreateDelta,
            horizontalInteractionDebug
          ).toBe(0)
          expect(
            snapshot.horizontalSweepMaterializationDelta?.publishDelta,
            horizontalInteractionDebug
          ).toBe(0)
          expect(
            snapshot.horizontalSweepResponsiveness.maxLongTaskMs,
            horizontalInteractionDebug
          ).toBeLessThan(TABLE_READY_INTERACTION_MAX_LONG_TASK_MS)
          expect(
            snapshot.horizontalSweepResponsiveness.maxFrameGapMs,
            horizontalInteractionDebug
          ).toBeLessThan(TABLE_READY_INTERACTION_MAX_FRAME_GAP_MS)
        }
      }

      if (scenarioId === 'C3') {
        expect(snapshot.tableStoreState?.rowCount).toBe(500)
        expect(snapshot.tableStoreState?.pendingMaterialization).toBe(0)
        expectVisibleRowShellCoverage(snapshot, 1)
        expect(snapshot.visibleBusinessRowCount).toBeGreaterThanOrEqual(1)
        expect(snapshot.dialogShellResponsiveness?.status).toBe('ok')
        expect(snapshot.dialogShellResponsiveness.maxLongTaskMs).toBeLessThanOrEqual(
          TABLE_POST_RESPONSE_MAX_LONG_TASK_MS
        )
        expect(
          snapshot.dialogShellResponsiveness.maxFrameGapMs
        ).toBeLessThanOrEqual(TABLE_POST_RESPONSE_MAX_FRAME_GAP_MS)
        expect(snapshot.dialogBodyResponsiveness?.status).toBe('ok')
      }

      if (scenarioId.startsWith('C4')) {
        expectMonotonicMarks(snapshot, [
          'click',
          'fetcher-entered',
          'request-transform-start',
          'request-body-ready',
        ])
      }
      if (scenarioId === 'C5') {
        expectMonotonicRequestMarks(
          snapshot,
          [
            'click',
            'fetcher-entered',
            'request-transform-start',
            'request-body-ready',
          ],
          '/c5-real-form-submit'
        )
        expect(snapshot.submitRequest?.realFormPayload?.detailCount).toBe(
          REAL_FORM_ROW_COUNT
        )
        expect(snapshot.tableStoreState?.rowCount).toBe(REAL_FORM_ROW_COUNT)
      }
    }
  }

  if (isRealForm) {
    for (let runIndex = 1; runIndex <= PERF_ENV.runs; runIndex += 1) {
      const stuck = snapshots.find(
        (snapshot) =>
          snapshot.variant === 'stuck' && snapshot.runIndex === runIndex
      )
      const adapted = snapshots.find(
        (snapshot) =>
          snapshot.variant === 'adapted' && snapshot.runIndex === runIndex
      )
      expect(stuck, `missing stuck Form snapshot for run ${runIndex}`).toBeDefined()
      expect(adapted, `missing adapted Form snapshot for run ${runIndex}`).toBeDefined()
      expect(stuck.submitRequest.realFormPayload.semanticSha256).toBe(
        adapted.submitRequest.realFormPayload.semanticSha256
      )
    }
  }

  const artifactName = isCalibration
    ? 'baseline-metrics.json'
    : isDiagnosis
    ? 'diagnosis-metrics.json'
    : isAttribution
    ? 'attribution-metrics.json'
    : isSchedulePoc
    ? 'schedule-poc-metrics.json'
    : isIdentityPoc
    ? 'identity-poc-metrics.json'
    : isRealForm
    ? 'form-real-metrics.json'
    : isPoc
    ? 'poc-metrics.json'
    : PERF_ENV.sampleSet === 'scroll-baseline'
    ? 'scroll-baseline-metrics.json'
    : isGate
    ? 'gate-metrics.json'
    : isRawCheck
    ? 'raw-check-metrics.json'
    : 'smoke-metrics.json'
  const attachmentName = isCalibration
    ? 'amis-main-thread-performance-baseline-metrics'
    : isDiagnosis
    ? 'amis-main-thread-performance-diagnosis-metrics'
    : isAttribution
    ? 'amis-main-thread-performance-attribution-metrics'
    : isSchedulePoc
    ? 'amis-main-thread-performance-schedule-poc-metrics'
    : isIdentityPoc
    ? 'amis-main-thread-performance-identity-poc-metrics'
    : isRealForm
    ? 'amis-main-thread-performance-form-real-metrics'
    : isPoc
    ? 'amis-main-thread-performance-poc-metrics'
    : PERF_ENV.sampleSet === 'scroll-baseline'
    ? 'amis-main-thread-performance-scroll-baseline-metrics'
    : isGate
    ? 'amis-main-thread-performance-gate-metrics'
    : isRawCheck
    ? 'amis-main-thread-performance-raw-check-metrics'
    : 'amis-main-thread-performance-smoke-metrics'
  if (
    isGate &&
    snapshots.some((snapshot) => snapshot.scenarioId === 'C3')
  ) {
    assertC3DialogSchedulingGate(snapshots)
  }
  const comparisonFixtures = createComparisonFixtures(snapshots)
  const fingerprint = createAmisMainThreadPerformanceFingerprint({
    fixtures: comparisonFixtures,
  })
  const outputPath = testInfo.outputPath(artifactName)
  const metrics = {
    env: PERF_ENV,
    fingerprint,
    provenance: fingerprint.provenance,
    comparisonFingerprint: fingerprint.comparisonFingerprint,
    snapshots,
    ...(isCalibration ? { baseline: summarizeBaseline(snapshots) } : {}),
    ...(isDiagnosis ? { diagnosisArtifacts } : {}),
    ...(isAttribution ? { attributionArtifacts: diagnosisArtifacts } : {}),
    ...(isSchedulePoc ? { schedulePocArtifacts: diagnosisArtifacts } : {}),
    ...(isIdentityPoc ? { identityPocArtifacts: diagnosisArtifacts } : {}),
    ...(isRealForm ? { realFormArtifacts: diagnosisArtifacts } : {}),
    ...(isRawCheck ? { rawCheckArtifacts: diagnosisArtifacts } : {}),
    ...(isPoc
      ? { poc: summarizeSnapshots(snapshots, { includePocDimensions: true }) }
      : {}),
    ...(isGate
      ? { gate: summarizeSnapshots(snapshots, { includePocDimensions: true }) }
      : {}),
  }
  fs.mkdirSync(STABLE_ARTIFACT_DIR, { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(metrics, null, 2))
  fs.writeFileSync(
    path.join(STABLE_ARTIFACT_DIR, artifactName),
    JSON.stringify(metrics, null, 2)
  )
  if (PERF_ENV.sampleSet === 'scroll-baseline') {
    writeScrollBaselineArtifact(metrics)
  }
  if (PERF_ENV.sampleSet === 'gate') {
    assertGateMatchesTrackedBaseline(metrics)
  }
  await testInfo.attach(attachmentName, {
    path: outputPath,
    contentType: 'application/json',
  })
})
