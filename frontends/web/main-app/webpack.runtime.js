const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const dotenvExpand = require('dotenv-expand')

const DEFAULT_DEV_SERVER_HOST = '0.0.0.0'
const DEFAULT_DEV_SERVER_PORT = 8080
const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8888'
const DEFAULT_DEBUG_CONSOLE_MICRO_WEB = 'http://127.0.0.1:88/'
const DEFAULT_LOGICFLOW_EDITOR_MICRO_WEB = 'http://127.0.0.1:88/'
const DEFAULT_WORKFLOW_EDITOR_MICRO_WEB = 'http://127.0.0.1:88/'
const DEFAULT_OTHER_MICRO_WEB = 'http://127.0.0.1:88/'
const DYNAMIC_MICRO_WEB_ARG_NAMES = ['micro_map', 'micro-map']

function resolve(dir) {
  return path.join(__dirname, dir)
}

function collectArgs(argv = process.argv) {
  const argsMap = {}
  const argValuesMap = {}

  argv.forEach((arg, index) => {
    if (!arg.startsWith('--')) {
      return
    }

    const argName = arg.substring(2)
    const argValue = argv[index + 1]
    const parsedArgValue = argValue && !argValue.startsWith('--') ? argValue : true
    argsMap[argName] = parsedArgValue
    if (!argValuesMap[argName]) {
      argValuesMap[argName] = []
    }
    argValuesMap[argName].push(parsedArgValue)
  })

  return { argsMap, argValuesMap }
}

function readArgs(argv = process.argv) {
  const { argsMap } = collectArgs(argv)
  return argsMap
}

function getArgValues(argValuesMap, argNames) {
  return argNames.reduce((values, argName) => {
    if (argValuesMap[argName]) {
      values.push(...argValuesMap[argName])
    }
    return values
  }, [])
}

function normalizeProxyContext(rawContext) {
  const trimmedContext = typeof rawContext === 'string' ? rawContext.trim() : ''
  if (!trimmedContext) {
    return ''
  }

  const withLeadingSlash = trimmedContext.startsWith('/')
    ? trimmedContext
    : `/${trimmedContext}`

  return withLeadingSlash.endsWith('/')
    ? withLeadingSlash
    : `${withLeadingSlash}/`
}

function parseDynamicMicroWebProxyMap(argValuesMap) {
  return getArgValues(argValuesMap, DYNAMIC_MICRO_WEB_ARG_NAMES).reduce((proxyMap, argValue) => {
    if (typeof argValue !== 'string') {
      console.warn('[webpack.runtime] 忽略缺少值的 --micro_map 参数')
      return proxyMap
    }

    const separatorIndex = argValue.indexOf('=')
    if (separatorIndex <= 0 || separatorIndex === argValue.length - 1) {
      console.warn(
        `[webpack.runtime] 忽略非法的微前端代理参数 "${argValue}"，格式应为 /public-path/=http://target-host:port`
      )
      return proxyMap
    }

    const context = normalizeProxyContext(argValue.substring(0, separatorIndex))
    const target = argValue.substring(separatorIndex + 1).trim()
    if (!context || !target) {
      console.warn(
        `[webpack.runtime] 忽略非法的微前端代理参数 "${argValue}"，格式应为 /public-path/=http://target-host:port`
      )
      return proxyMap
    }

    proxyMap[context] = target
    return proxyMap
  }, {})
}

function getPages(isPlaywrightHarness, includeDebugEntrypoint = false) {
  const pages = {
    index: {
      entry: 'src/main.ts',
      template: 'public/index.html',
      filename: 'index.html',
      title: process.env.VUE_APP_NAME,
      inject: false,
    },
  }

  if (includeDebugEntrypoint) {
    pages.debug = {
      entry: 'src/debug-main.ts',
      template: 'public/index.html',
      filename: 'debug.html',
      title: 'Ouroboros Debug',
      inject: false,
    }
  }

  if (isPlaywrightHarness) {
    pages['enterprise-integration-playwright-harness'] = {
      entry: 'tests/integration/enterprise-integration/harness/index.js',
      template: 'tests/integration/enterprise-integration/harness/index.html',
      filename: 'enterprise-integration-playwright-harness.html',
      inject: true,
    }
    pages['notification-runtime-playwright-harness'] = {
      entry: 'tests/integration/notification-runtime-management/harness/index.js',
      template: 'tests/integration/notification-runtime-management/harness/index.html',
      filename: 'notification-runtime-playwright-harness.html',
      inject: true,
    }
    pages['approval-workflow-playwright-harness'] = {
      entry: 'tests/integration/approval-workflow/harness/index.js',
      template: 'tests/integration/approval-workflow/harness/index.html',
      filename: 'approval-workflow-playwright-harness.html',
      inject: true,
    }
    pages['business-behavior-catalog-playwright-harness'] = {
      entry: 'tests/integration/business-behavior-catalog/harness/index.js',
      template: 'tests/integration/business-behavior-catalog/harness/index.html',
      filename: 'business-behavior-catalog-playwright-harness.html',
      title: 'Business Behavior Catalog Harness',
      inject: true,
    }
    pages['business-model-populate-playwright-harness'] = {
      entry: 'tests/integration/business-model-populate/harness/index.js',
      template: 'tests/integration/business-model-populate/harness/index.html',
      filename: 'business-model-populate-playwright-harness.html',
      inject: true,
    }
    pages['input-table-overlay-playwright-harness'] = {
      entry: 'tests/integration/input-table-overlay/harness/index.js',
      template: 'tests/integration/input-table-overlay/harness/index.html',
      filename: 'input-table-overlay-playwright-harness.html',
      inject: true,
    }
    pages['form-smart-layout-playwright-harness'] = {
      entry: 'tests/integration/form-smart-layout/harness/index.js',
      template: 'tests/integration/form-smart-layout/harness/index.html',
      filename: 'form-smart-layout-playwright-harness.html',
      inject: true,
    }
    pages['crud-filter-smart-layout-playwright-harness'] = {
      entry: 'tests/integration/crud-filter-smart-layout/harness/index.js',
      template: 'tests/integration/crud-filter-smart-layout/harness/index.html',
      filename: 'crud-filter-smart-layout-playwright-harness.html',
      inject: true,
    }
    pages['input-table-lazy-delete-playwright-harness'] = {
      entry: 'tests/integration/input-table-lazy-delete/harness/index.js',
      template: 'tests/integration/input-table-lazy-delete/harness/index.html',
      filename: 'input-table-lazy-delete-playwright-harness.html',
      inject: true,
    }
    pages['statistics-reporting-playwright-harness'] = {
      entry: 'tests/integration/statistics-reporting/harness/index.js',
      template: 'tests/integration/statistics-reporting/harness/index.html',
      filename: 'statistics-reporting-playwright-harness.html',
      inject: true,
    }
    pages['debug-topbar-playwright-harness'] = {
      entry: 'tests/integration/debug-topbar/harness/index.js',
      template: 'tests/integration/debug-topbar/harness/index.html',
      filename: 'debug-topbar-playwright-harness.html',
      inject: true,
    }
    pages['amis-main-thread-performance-playwright-harness'] = {
      entry: 'tests/integration/amis-main-thread-performance/harness/index.js',
      template: 'tests/integration/amis-main-thread-performance/harness/index.html',
      filename: 'amis-main-thread-performance-playwright-harness.html',
      inject: true,
    }
    pages['dev-workspace-management-playwright-harness'] = {
      entry: 'tests/integration/dev-workspace-management/harness/index.js',
      template: 'tests/integration/dev-workspace-management/harness/index.html',
      filename: 'dev-workspace-management-playwright-harness.html',
      inject: true,
    }
    pages['table-children-expand-playwright-harness'] = {
      entry: 'tests/integration/table-children-expand/harness/index.js',
      template: 'tests/integration/table-children-expand/harness/index.html',
      filename: 'table-children-expand-playwright-harness.html',
      inject: true,
    }
    pages['table-loading-timeout-playwright-harness'] = {
      entry: 'tests/integration/table-loading-timeout/harness/index.js',
      template: 'tests/integration/table-loading-timeout/harness/index.html',
      filename: 'table-loading-timeout-playwright-harness.html',
      inject: true,
    }
    pages['input-tree-auto-fill-height-playwright-harness'] = {
      entry: 'tests/integration/input-tree-auto-fill-height/harness/index.js',
      template: 'tests/integration/input-tree-auto-fill-height/harness/index.html',
      filename: 'input-tree-auto-fill-height-playwright-harness.html',
      inject: true,
    }
  }

  return pages
}

function createRuntimeOptions(argv = process.argv) {
  const { argsMap, argValuesMap } = collectArgs(argv)
  const isPlaywrightHarness = process.env.PLAYWRIGHT_HARNESS === 'true'
  const nodeEnv = process.env.NODE_ENV || 'development'

  ;['.env', `.env.${nodeEnv}`].forEach((fileName) => {
    const filePath = resolve(fileName)
    if (!fs.existsSync(filePath)) {
      return
    }

    dotenvExpand.expand(dotenv.config({ path: filePath }))
  })

  const devServerHost = argsMap.host || DEFAULT_DEV_SERVER_HOST
  const devServerPort = Number(argsMap.port || DEFAULT_DEV_SERVER_PORT)
  const apiBackendUrl = argsMap.api || DEFAULT_BACKEND_URL
  // SockJS /info and fallback transports are regular HTTP requests, so the
  // dev proxy target must stay on the HTTP backend unless explicitly overridden.
  const wsBackendUrl = argsMap.ws || apiBackendUrl
  const debugConsoleMicroWeb = argsMap.debug_console || DEFAULT_DEBUG_CONSOLE_MICRO_WEB
  const logicflowEditorMicroWeb =
    argsMap.logicflow_editor || DEFAULT_LOGICFLOW_EDITOR_MICRO_WEB
  const workflowEditorMicroWeb =
    argsMap.workflow_editor || DEFAULT_WORKFLOW_EDITOR_MICRO_WEB
  const otherMicroWeb = argsMap.other || DEFAULT_OTHER_MICRO_WEB
  const microWebProxyMap = {
    '/debug-console-header/': debugConsoleMicroWeb,
    '/micro-logicflow-editor/': logicflowEditorMicroWeb,
    '/micro-workflow-editor/': workflowEditorMicroWeb,
    '/micro-app-other/': otherMicroWeb,
    ...parseDynamicMicroWebProxyMap(argValuesMap),
  }

  return {
    argsMap,
    nodeEnv,
    isPlaywrightHarness,
    publicPath: process.env.VUE_APP_PUBLICPATH || '/',
    assetsDir: 'static',
    outputDir: resolve('dist'),
    devServerHost,
    devServerPort,
    apiBackendUrl,
    wsBackendUrl,
    debugConsoleMicroWeb,
    logicflowEditorMicroWeb,
    workflowEditorMicroWeb,
    otherMicroWeb,
    microWebProxyMap,
    pages: getPages(isPlaywrightHarness, nodeEnv !== 'production'),
  }
}

module.exports = {
  createRuntimeOptions,
  getPages,
  readArgs,
  resolve,
}
