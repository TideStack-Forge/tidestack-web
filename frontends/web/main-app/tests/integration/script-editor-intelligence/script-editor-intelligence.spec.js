const { test, expect } = require('@playwright/test')

async function openPlayground(page, search = '') {
  await page.goto(`/debug/script-editor-intelligence${search}`)
  await page.waitForFunction(() => {
    return window.__SCRIPT_EDITOR_INTELLIGENCE_PLAYGROUND__?.ready === true
  })
}

test('loads the script editor intelligence playground route', async ({ page }) => {
  await openPlayground(page)

  await expect(
    page.getByRole('heading', { name: 'Script Editor Intelligence Playground' })
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'JavaScript (GraalJS)' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Groovy' })).toBeVisible()
})

test('injects mocked graaljs declarations without browser globals', async ({ page }) => {
  await openPlayground(page)

  await expect
    .poll(() =>
      page.evaluate(() => {
        return window.__SCRIPT_EDITOR_INTELLIGENCE_PLAYGROUND__.getRequestCount(
          'javascript'
        )
      })
    )
    .toBe(1)

  const extraLibs = await page.evaluate(() => {
    return window.__SCRIPT_EDITOR_INTELLIGENCE_PLAYGROUND__.getJavascriptExtraLibs()
  })

  expect(
    extraLibs.some((source) => source.includes("type(name: 'java.time.LocalDate')"))
  ).toBe(true)
  expect(extraLibs.some((source) => source.includes('readonly MIN:'))).toBe(true)
  expect(
    extraLibs.some((source) => /\bwindow\b|\blocation\b|\bhistory\b/.test(source))
  ).toBe(false)
})

test('shows mocked javascript static member suggestions', async ({ page }) => {
  await openPlayground(page)
  await page.waitForFunction(() => {
    return window.__SCRIPT_EDITOR_INTELLIGENCE_PLAYGROUND__?.hasApplied('javascript')
  })

  await page.evaluate(() => {
    window.__SCRIPT_EDITOR_INTELLIGENCE_PLAYGROUND__.setValue('javascript', 'LocalDate.')
    window.__SCRIPT_EDITOR_INTELLIGENCE_PLAYGROUND__.triggerSuggest('javascript')
  })

  const suggestions = page.locator('.suggest-widget.visible')
  await expect(suggestions).toBeVisible()
  await expect(suggestions).toContainText('now')
  await expect(suggestions).toContainText('MIN')
})

test('shows mocked groovy global suggestions', async ({ page }) => {
  await openPlayground(page)
  await page.waitForFunction(() => {
    return window.__SCRIPT_EDITOR_INTELLIGENCE_PLAYGROUND__?.hasApplied('groovy')
  })

  await page.evaluate(() => {
    window.__SCRIPT_EDITOR_INTELLIGENCE_PLAYGROUND__.setValue('groovy', '$input.')
    window.__SCRIPT_EDITOR_INTELLIGENCE_PLAYGROUND__.triggerSuggest('groovy')
  })

  const suggestions = page.locator('.suggest-widget.visible')
  await expect(suggestions).toBeVisible()
  await expect(suggestions).toContainText('orderId')
  await expect(suggestions).toContainText('submittedAt')
  await expect(suggestions).toContainText('toMap')
})

test('api mode requests the logicflow snapshot endpoint and applies returned metadata', async ({
  page,
}) => {
  const requests = []
  page.on('request', (request) => {
    if (
      request.url().includes('/api/dev/playground-app/logicflow/script-intelligence/snapshot')
    ) {
      requests.push(request.postDataJSON())
    }
  })

  await openPlayground(page, '?source=api')

  await expect.poll(() => requests.length).toBe(2)
  await expect(page.getByText('Data Source API', { exact: false })).toBeVisible()
  await expect(
    page.getByText(
      'Loading raw metadata from metadata endpoints plus live script-intelligence snapshots from /api/dev/playground-app/logicflow/script-intelligence/snapshot.',
      { exact: true }
    )
  ).toBeVisible()
  await expect(page.getByText('Metadata dev-helper-runtime', { exact: false })).toHaveCount(2)
  await expect(page.getByText('Snapshot dev-helper-cache', { exact: false })).toHaveCount(2)

  expect(requests.map((request) => request.language).sort()).toEqual([
    'groovy',
    'javascript',
  ])
})
