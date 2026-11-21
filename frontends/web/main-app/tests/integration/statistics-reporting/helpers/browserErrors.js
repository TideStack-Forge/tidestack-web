const { expect } = require('@playwright/test')

const EXPECTED_FIXTURE_HTTP_FAILURES = [
  /\/api\/i18n\/languages(?:\?|$)/,
  /\/api\/i18n\/locale\//,
  /\/api\/notification\/unread-count/,
  /\/api\/dev\/[^/]+\/dev-workspace-menu(?:\?|$)/,
  /\/api\/dev\/[^/]+\/dataset\/[^/]+\/dev-config(?:\?|$)/,
]

const EXPECTED_CONSOLE_ERRORS = [
  /Failed to load resource: the server responded with a status of 404/,
  /findDOMNode.*deprecated/i,
]

function installBrowserErrorChecks(test) {
  const errorsByPage = new WeakMap()

  test.beforeEach(({ page }) => {
    const errors = []
    errorsByPage.set(page, errors)

    page.on('pageerror', (error) => {
      errors.push(`pageerror: ${error.stack || error.message}`)
    })
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        !EXPECTED_CONSOLE_ERRORS.some((pattern) => pattern.test(message.text()))
      ) {
        errors.push(`console.error: ${message.text()}`)
      }
    })
    page.on('response', (response) => {
      if (
        response.status() >= 400 &&
        !EXPECTED_FIXTURE_HTTP_FAILURES.some((pattern) => pattern.test(response.url()))
      ) {
        errors.push(`HTTP ${response.status()}: ${response.url()}`)
      }
    })
  })

  test.afterEach(({ page }) => {
    expect(errorsByPage.get(page) || []).toEqual([])
  })
}

module.exports = { installBrowserErrorChecks }
