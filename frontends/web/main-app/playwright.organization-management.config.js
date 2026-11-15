const { defineConfig } = require('@playwright/test')

/**
 * 组织架构页回归测试：需要真实运行时后端，目标环境由
 * ORG_MGMT_BASE_URL / ORG_MGMT_USERNAME / ORG_MGMT_PASSWORD 提供，因此本配置不启动 webServer。
 */
module.exports = defineConfig({
  testDir: './tests/integration/organization-management',
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  use: {
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
})
