const { defineConfig } = require('@playwright/test')
const live = Boolean(process.env.RPC_TESTING_BACKEND_URL)
if (live)
  for (const name of [
    'RPC_TESTING_FRONTEND_URL',
    'RPC_TESTING_TARGET_STUB_URL',
    'RPC_TESTING_APP_NAME',
    'RPC_TESTING_APP_WORKSPACE',
    'RPC_TESTING_USERNAME',
    'RPC_TESTING_PASSWORD',
  ]) {
    if (!process.env[name])
      throw new Error(`Missing ${name} for real-backend verification`)
  }
module.exports = defineConfig({
  testMatch: live ? '**/rpc-model-journey.spec.js' : '**/rpc-model-editor.spec.js',
  testDir: './tests/integration/rpc-model-testing',
  outputDir: './target/playwright-rpc-model-testing',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  retries: 0,
  use: { browserName: 'chromium', headless: true, trace: 'retain-on-failure' },
})
