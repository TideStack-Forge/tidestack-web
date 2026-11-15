const { defineConfig } = require('@playwright/test')

const BASE_URL = process.env.OUROBOROS_TABLE_CHILDREN_BASE_URL || 'http://127.0.0.1:88'

module.exports = defineConfig({
  testDir: './tests/integration/table-children-expand',
  testMatch: 'table-children-expand.repro.js',
  timeout: 90_000,
  workers: 1,
  fullyParallel: false,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'on-first-retry',
    viewport: {
      width: 1440,
      height: 900,
    },
    locale: 'zh-CN',
    colorScheme: 'light',
  },
})
