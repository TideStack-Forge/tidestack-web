const { defineConfig } = require('@playwright/test')
module.exports = defineConfig({
  testDir: './tests/integration',
  testMatch: ['**/dev-workspace-management/*.spec.js', '**/table-children-expand/*.harness.spec.js', '**/statistics-reporting/statistics-reporting-workspace.spec.js'],
  timeout: 45_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:43188', headless: true, viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  webServer: {
    command: 'PLAYWRIGHT_HARNESS=true node ./scripts/webpack-serve.js --host 127.0.0.1 --port 43188',
    url: 'http://127.0.0.1:43188/dev-workspace-management-playwright-harness.html',
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
})
