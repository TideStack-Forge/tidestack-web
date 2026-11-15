const { defineConfig } = require('@playwright/test')

const MOCK_SERVER_PORT = 43174
const MAIN_APP_PORT = 43173
const WORKFLOW_EDITOR_PORT = 43175
const projectGeneratorOnly = process.argv.some((arg) =>
  /(^|[/\\])tests[/\\]integration[/\\]project-generator(?:[/\\]|$)/.test(arg)
)

const mainAppCommand =
  `PLAYWRIGHT_HARNESS=true node ./scripts/webpack-serve.js --host 127.0.0.1 --port ${MAIN_APP_PORT} --api http://127.0.0.1:${MOCK_SERVER_PORT}` +
  (projectGeneratorOnly
    ? ''
    : ` --workflow_editor http://127.0.0.1:${WORKFLOW_EDITOR_PORT}`)

module.exports = defineConfig({
  testDir: './tests/integration',
  testIgnore: [
    'tests/integration/layout-parity/**',
    // These suites start a real Java backend through their dedicated config.
    'tests/integration/script-editor-intelligence/code-context-live.spec.js',
    'tests/integration/script-editor-intelligence/code-context-scenarios.spec.js',
    'tests/integration/script-editor-intelligence/groovy-lsp-live.spec.js',
  ],
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${MAIN_APP_PORT}`,
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  webServer: [
    {
      command: `node ../script-editor-intelligence-mock-server/server.js --port ${MOCK_SERVER_PORT}`,
      url: `http://127.0.0.1:${MOCK_SERVER_PORT}/health`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
    ...(projectGeneratorOnly
      ? []
      : [
          {
            command: `PLAYWRIGHT_HARNESS=true npm --prefix ../ouroboros-approval-workflow-designer run serve -- --host 127.0.0.1 --port ${WORKFLOW_EDITOR_PORT}`,
            url: `http://127.0.0.1:${WORKFLOW_EDITOR_PORT}/micro-workflow-editor/`,
            timeout: 300_000,
            reuseExistingServer: !process.env.CI,
          },
        ]),
    {
      command: mainAppCommand,
      url: `http://127.0.0.1:${MAIN_APP_PORT}`,
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
