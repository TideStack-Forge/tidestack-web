const { defineConfig } = require('@playwright/test')

const MAIN_APP_PORT = 43187

module.exports = defineConfig({
  testDir: './tests/integration/table-loading-timeout',
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
  webServer: {
    command: `PLAYWRIGHT_HARNESS=true node ./scripts/webpack-serve.js --host 127.0.0.1 --port ${MAIN_APP_PORT}`,
    url: `http://127.0.0.1:${MAIN_APP_PORT}/table-loading-timeout-playwright-harness.html`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
})
