const { defineConfig } = require('@playwright/test')
const mockBackend = process.env.CODE_CONTEXT_BACKEND === 'mock'
const scenarioBackend = process.env.CODE_CONTEXT_BACKEND === 'scenarios'
const groovyBackend = process.env.CODE_CONTEXT_BACKEND === 'groovy'

module.exports = defineConfig({
  testDir: './tests/integration/script-editor-intelligence',
  testMatch: scenarioBackend ? 'code-context-scenarios.spec.js' : groovyBackend ? 'groovy-lsp-live.spec.js' : mockBackend ? 'code-context.spec.js' : /code-context(?:-live)?\.spec\.js/,
  outputDir: scenarioBackend ? './target/playwright-code-context-scenarios' : groovyBackend ? './target/playwright-groovy-lsp' : mockBackend
    ? './target/playwright-code-intelligence-transport'
    : './target/playwright-code-intelligence',
  timeout: groovyBackend ? 180_000 : 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:43183',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    video: { mode: 'on', size: { width: 1440, height: 1000 } },
    trace: 'on',
  },
  webServer: [
    {
      command: groovyBackend
        ? `python3 ../../../testing/integration/feature/development/groovy-language-service/scripts/full_chain.py --prepare ${process.env.LANGUAGE_CONTAINER_IMAGE ? '--container-image ' + process.env.LANGUAGE_CONTAINER_IMAGE : ''} --spring.application.name=example`
        : mockBackend
        ? 'node ../script-editor-intelligence-mock-server/server.js --port 43184'
        : 'python3 tests/integration/script-editor-intelligence/start-backend.py',
      url: 'http://127.0.0.1:43184/health',
      timeout: 300_000,
      reuseExistingServer: (groovyBackend || scenarioBackend) && !process.env.CI,
    },
    {
      command:
        'PLAYWRIGHT_HARNESS=true node ./scripts/webpack-serve.js --host 127.0.0.1 --port 43183 --api http://127.0.0.1:43184',
      url: 'http://127.0.0.1:43183',
      timeout: 300_000,
    },
  ],
})
