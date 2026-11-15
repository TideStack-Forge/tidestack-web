const { defineConfig } = require('@playwright/test')
const port = 43261
module.exports = defineConfig({
  testDir: './tests/integration/notification-runtime-management',
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `PLAYWRIGHT_HARNESS=true node ./scripts/webpack-serve.js --host 127.0.0.1 --port ${port} --api http://127.0.0.1:43262`,
    url: `http://127.0.0.1:${port}`, timeout: 300_000, reuseExistingServer: false,
  },
})
