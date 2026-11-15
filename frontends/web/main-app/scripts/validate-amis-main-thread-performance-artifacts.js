const fs = require('node:fs')
const path = require('node:path')

const ARTIFACT_EXIT_CODE = 86
const ARTIFACT_DIR = path.join(
  process.cwd(),
  'test-results',
  'amis-main-thread-performance'
)

const REQUIRED_SNAPSHOTS = [
  ['C0', 'C0-run-1'],
  ['C1', 'C1-run-1'],
  ['C2', 'C2-run-1'],
  ['C3', 'C3-run-1'],
  ['C4a', 'C4a-object-default-empty-run-1'],
  ['C4a', 'C4a-amis-json-empty-run-1'],
  ['C4b', 'C4b-object-default-empty-run-1'],
  ['C4c', 'C4c-object-default-echo-run-1'],
  ['C4c', 'C4c-amis-json-echo-run-1'],
]

function fail(message) {
  console.error(`[amis-main-thread-performance] ${message}`)
  process.exit(ARTIFACT_EXIT_CODE)
}

function readJson(fileName) {
  const filePath = path.join(ARTIFACT_DIR, fileName)
  if (!fs.existsSync(filePath)) {
    fail(`missing artifact: ${filePath}`)
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`invalid JSON artifact ${filePath}: ${error.message}`)
  }
}

function assert(condition, message) {
  if (!condition) {
    fail(message)
  }
}

const smokeMetrics = readJson('smoke-metrics.json')
const traceCategories = readJson('trace-categories.json')
const fingerprint = readJson('environment-fingerprint.json')

assert(smokeMetrics.env?.mode === 'record', 'smoke metrics env.mode must be record')
assert(
  smokeMetrics.env?.sampleSet === 'smoke',
  'smoke metrics env.sampleSet must be smoke'
)
assert(smokeMetrics.env?.runs === 1, 'smoke metrics env.runs must be 1')
assert(Array.isArray(smokeMetrics.snapshots), 'smoke metrics snapshots must be an array')

for (const [scenarioId, runId] of REQUIRED_SNAPSHOTS) {
  const snapshot = smokeMetrics.snapshots.find(
    (item) => item.scenarioId === scenarioId && item.runId === runId
  )
  assert(snapshot, `missing smoke snapshot: ${scenarioId}/${runId}`)
  assert(
    typeof snapshot.functionalHash === 'string' &&
      /^\d+:[a-f0-9]+$/.test(snapshot.functionalHash),
    `invalid functionalHash for ${scenarioId}/${runId}`
  )
  assert(
    Array.isArray(snapshot.marks) &&
      snapshot.marks.some((mark) => mark.name === 'scenario-start') &&
      snapshot.marks.some((mark) => mark.name === 'ready'),
    `missing lifecycle marks for ${scenarioId}/${runId}`
  )
}

assert(
  Array.isArray(traceCategories.resolved) &&
    traceCategories.resolved.includes('blink.user_timing'),
  'trace categories must resolve blink.user_timing'
)

assert(fingerprint.execution === 'local', 'fingerprint execution must be local')
assert(
  typeof fingerprint.hostName === 'string' && fingerprint.hostName.length > 0,
  'fingerprint must include hostName'
)
assert(typeof fingerprint.os?.kernel === 'string', 'fingerprint must include os.kernel')
assert(
  typeof fingerprint.cpu?.model === 'string' && fingerprint.cpu.model.length > 0,
  'fingerprint must include cpu.model'
)
assert(
  Number.isInteger(fingerprint.cpu?.logicalCores) &&
    fingerprint.cpu.logicalCores > 0,
  'fingerprint must include cpu.logicalCores'
)
assert(typeof fingerprint.node === 'string', 'fingerprint must include node')
assert(typeof fingerprint.npm === 'string', 'fingerprint must include npm')
assert(
  typeof fingerprint.chromiumRevision === 'string',
  'fingerprint must include chromiumRevision'
)
assert(fingerprint.viewport === '1440x900', 'fingerprint viewport must be 1440x900')
assert(fingerprint.cpuThrottle === 4, 'fingerprint cpuThrottle must be 4')
assert(
  typeof fingerprint.provenance?.runtimeSourceHash === 'string' &&
    /^[a-f0-9]{64}$/.test(fingerprint.provenance.runtimeSourceHash),
  'fingerprint provenance.runtimeSourceHash must be a sha256 hex string'
)
assert(
  fingerprint.comparisonFingerprint?.viewport === '1440x900',
  'fingerprint comparisonFingerprint must include viewport'
)
assert(
  fingerprint.comparisonFingerprint?.cpuThrottle === 4,
  'fingerprint comparisonFingerprint must include cpuThrottle'
)

console.log(
  `[amis-main-thread-performance] artifact contract valid in ${ARTIFACT_DIR}`
)
