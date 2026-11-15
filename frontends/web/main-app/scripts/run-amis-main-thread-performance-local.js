const cp = require('node:child_process')
const path = require('node:path')

const ARTIFACT_EXIT_CODE = 86

function run(command, args, options = {}) {
  return cp.spawnSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PERF_MODE: process.env.PERF_MODE || 'record',
      PERF_SAMPLE_SET: process.env.PERF_SAMPLE_SET || 'smoke',
      PERF_RUNS: process.env.PERF_RUNS || '1',
    },
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  })
}

function runNodeScript(scriptPath) {
  return run(process.execPath, [path.join(process.cwd(), scriptPath)])
}

function statusOrFailure(result) {
  if (result.error) {
    console.error(result.error.message)
    return ARTIFACT_EXIT_CODE
  }
  if (typeof result.status === 'number') {
    return result.status
  }
  return ARTIFACT_EXIT_CODE
}

const playwright = run('npx', [
  'playwright',
  'test',
  'tests/integration/amis-main-thread-performance',
  '--config=playwright.config.js',
  '--project=chromium',
  '--workers=1',
  '--retries=0',
])

const playwrightExit = statusOrFailure(playwright)

const fingerprint = runNodeScript(
  './scripts/write-amis-main-thread-performance-fingerprint.js'
)
if (statusOrFailure(fingerprint) !== 0) {
  process.exit(ARTIFACT_EXIT_CODE)
}

if (playwrightExit !== 0) {
  process.exit(playwrightExit)
}

const artifactValidation = runNodeScript(
  './scripts/validate-amis-main-thread-performance-artifacts.js'
)
const artifactValidationExit = statusOrFailure(artifactValidation)
if (artifactValidationExit !== 0) {
  process.exit(artifactValidationExit)
}

process.exit(0)
