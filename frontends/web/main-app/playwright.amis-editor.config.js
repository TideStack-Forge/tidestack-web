const { defineConfig } = require('@playwright/test')
const evidence = process.env.OB_IDE_EVIDENCE_DIR
const recordVideo = process.env.OB_IDE_RECORD_VIDEO === '1'

module.exports = defineConfig({
  testDir: './tests/integration/amis-editor',
  outputDir: evidence ? `${evidence}/web-browser-artifacts` : './target/playwright-amis-editor',
  ...(evidence ? {reporter: [['list'], ['json', {outputFile: `${evidence}/web-browser.json`}]]} : {}),
  timeout: 30_000,
  workers: 1,
  retries: 0,
  use: {
    browserName: 'chromium', headless: true, trace: 'retain-on-failure',
    video: recordVideo ? {mode: 'on', size: {width: 1280, height: 720}, show: {actions: {}, test: {level: 'title'}}} : 'off',
  },
})
