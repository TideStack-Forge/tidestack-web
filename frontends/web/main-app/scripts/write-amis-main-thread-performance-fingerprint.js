const fs = require('node:fs')
const crypto = require('node:crypto')
const os = require('node:os')
const path = require('node:path')
const cp = require('node:child_process')

function exec(command, args) {
  try {
    return cp
      .execFileSync(command, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      .trim()
  } catch (error) {
    return ''
  }
}

function chromiumRevision() {
  try {
    const browsers = require('../node_modules/playwright-core/browsers.json')
    const chromium = browsers.browsers.find((browser) => browser.name === 'chromium')
    return chromium ? chromium.revision : ''
  } catch (error) {
    return ''
  }
}

function gitValue(args) {
  return exec('git', args)
}

function sha256(text) {
  return crypto
    .createHash('sha256')
    .update(text || '')
    .digest('hex')
}

function collectInputTableRuntimeSourceFiles() {
  const inputTableDir = 'src/components/amis/renderers/patch/InputTable'
  const absoluteInputTableDir = path.join(process.cwd(), inputTableDir)

  if (!fs.existsSync(absoluteInputTableDir)) {
    return []
  }

  return fs
    .readdirSync(absoluteInputTableDir)
    .filter((fileName) => /\.(ts|tsx)$/.test(fileName))
    .map((fileName) => `${inputTableDir}/${fileName}`)
    .sort()
}

function collectRuntimeSourceFiles() {
  return [
    'src/components/amis/renderers/patch/Table.tsx',
    'src/components/amis/renderers/patch/CRUD.tsx',
    'src/components/amis/renderers/patch/InputTable/index.tsx',
    ...collectInputTableRuntimeSourceFiles().filter(
      (filePath) =>
        filePath !== 'src/components/amis/renderers/patch/InputTable/index.tsx'
    ),
    'src/components/amis/renderers/patch/cooperativeTableRendering.tsx',
    'src/components/amis/renderers/patch/tableLazyRow/LazyRow.tsx',
    'src/components/amis/renderers/patch/tableRenderPerformance.ts',
    'tests/integration/amis-main-thread-performance/harness/index.js',
  ]
}

function createRuntimeSourceHash() {
  const sourceFiles = collectRuntimeSourceFiles()
  const hash = crypto.createHash('sha256')

  sourceFiles.forEach((filePath) => {
    const absolutePath = path.join(process.cwd(), filePath)
    if (!fs.existsSync(absolutePath)) {
      return
    }
    hash.update(filePath)
    hash.update('\0')
    hash.update(fs.readFileSync(absolutePath))
    hash.update('\0')
  })

  return hash.digest('hex')
}

const artifactDir = path.join(
  process.cwd(),
  'test-results',
  'amis-main-thread-performance'
)

function createAmisMainThreadPerformanceFingerprint(options = {}) {
  const fingerprint = {
    execution: 'local',
    hostName: os.hostname(),
    hostLabel: process.env.AMIS_MAIN_THREAD_PERF_HOST_LABEL || '',
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      kernel: exec('uname', ['-a']),
    },
    cpu: {
      model: os.cpus()[0] ? os.cpus()[0].model : '',
      logicalCores: os.cpus().length,
    },
    node: process.version,
    npm: exec('npm', ['--version']),
    chromiumRevision: chromiumRevision(),
    viewport: '1440x900',
    cpuThrottle: 4,
  }

  return {
    ...fingerprint,
    provenance: {
      runtimeSourceHash: createRuntimeSourceHash(),
      gitHead: gitValue(['rev-parse', 'HEAD']),
      gitDirtyHash: sha256(gitValue(['diff', '--no-ext-diff', '--binary'])),
    },
    comparisonFingerprint: {
      os: fingerprint.os,
      cpu: fingerprint.cpu,
      node: fingerprint.node,
      chromiumRevision: fingerprint.chromiumRevision,
      viewport: fingerprint.viewport,
      cpuThrottle: fingerprint.cpuThrottle,
      fixtures: options.fixtures || [],
    },
  }
}

function writeAmisMainThreadPerformanceFingerprint(targetDir = artifactDir) {
  const fingerprint = createAmisMainThreadPerformanceFingerprint()
  fs.mkdirSync(targetDir, { recursive: true })
  fs.writeFileSync(
    path.join(targetDir, 'environment-fingerprint.json'),
    JSON.stringify(fingerprint, null, 2)
  )
  return fingerprint
}

if (require.main === module) {
  writeAmisMainThreadPerformanceFingerprint()
}

module.exports = {
  collectInputTableRuntimeSourceFiles,
  collectRuntimeSourceFiles,
  createAmisMainThreadPerformanceFingerprint,
  writeAmisMainThreadPerformanceFingerprint,
}
