const { defineConfig } = require('@playwright/test')

const MAIN_APP_PORT = 43183

module.exports = defineConfig({
  testDir: './tests/integration/form-smart-layout',
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
  webServer: {
    command: `PLAYWRIGHT_HARNESS=true node ./scripts/webpack-serve.js --host 127.0.0.1 --port ${MAIN_APP_PORT}`,
    url: `http://127.0.0.1:${MAIN_APP_PORT}`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
})
