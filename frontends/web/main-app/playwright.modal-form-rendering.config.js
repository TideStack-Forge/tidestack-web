const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './tests/integration/modal-form-rendering',
  outputDir: './target/playwright-modal-form-rendering',
  timeout: 20_000,
  expect: { timeout: 5_000 },
  workers: 1,
  retries: 0,
  use: { browserName: 'chromium', headless: true, trace: 'retain-on-failure' },
})
