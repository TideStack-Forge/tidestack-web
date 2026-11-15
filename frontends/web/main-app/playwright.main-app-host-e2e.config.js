const { defineConfig } = require('@playwright/test')

const MOCK_SERVER_PORT = 43179
const MAIN_APP_PORT = 43180

module.exports = defineConfig({
  testDir: './tests/integration/main-app-host-e2e',
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
    {
      command: `PLAYWRIGHT_HARNESS=true node ./scripts/webpack-serve.js --host 127.0.0.1 --port ${MAIN_APP_PORT} --api http://127.0.0.1:${MOCK_SERVER_PORT}`,
      url: `http://127.0.0.1:${MAIN_APP_PORT}`,
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
