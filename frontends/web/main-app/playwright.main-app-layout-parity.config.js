const { defineConfig } = require('@playwright/test')

const LEGACY_BASE_URL = 'http://127.0.0.1:88'
const MAIN_APP_PORT = 43184

module.exports = defineConfig({
  testDir: './tests/integration/layout-parity',
  timeout: 90_000,
  workers: 1,
  fullyParallel: false,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${MAIN_APP_PORT}`,
    headless: true,
    trace: 'on-first-retry',
    viewport: {
      width: 1440,
      height: 900,
    },
    locale: 'zh-CN',
    colorScheme: 'light',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  metadata: {
    legacyBaseUrl: LEGACY_BASE_URL,
  },
  webServer: [
    {
      command:
        `PLAYWRIGHT_HARNESS=true node ./scripts/webpack-serve.js --host 127.0.0.1 --port ${MAIN_APP_PORT} ` +
        `--api ${LEGACY_BASE_URL} --debug_console ${LEGACY_BASE_URL} --logicflow_editor ${LEGACY_BASE_URL} ` +
        `--workflow_editor ${LEGACY_BASE_URL} --other ${LEGACY_BASE_URL}`,
      url: `http://127.0.0.1:${MAIN_APP_PORT}`,
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
