const { test, expect } = require('@playwright/test')

async function gotoHarness(page) {
  await page.goto('/table-loading-timeout-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__TABLE_LOADING_TIMEOUT_PLAYWRIGHT_HARNESS__?.ready === true
  })
}

test('table cooperative loading hides after max duration across repeated render cycles', async ({
  page,
}, testInfo) => {
  await gotoHarness(page)

  const snapshots = []

  for (let iteration = 1; iteration <= 5; iteration += 1) {
    const result = await page.evaluate((iterationIndex) => {
      return window.__TABLE_LOADING_TIMEOUT_PLAYWRIGHT_HARNESS__.runScenario({
        iteration: iterationIndex,
        loadingMaxDuration: 300,
      })
    }, iteration)

    snapshots.push(result)

    expect(result.visibleSnapshot.spinnerVisible, `iteration ${iteration} spinner appears`).toBe(true)
    expect(result.visibleSnapshot.materializationPending, `iteration ${iteration} starts pending`).toBe(true)
    expect(result.hiddenSnapshot.spinnerVisible, `iteration ${iteration} spinner hides`).toBe(false)
    expect(result.hiddenSnapshot.materializationPending, `iteration ${iteration} remains pending`).toBe(true)
    expect(
      result.hiddenSnapshot.cooperativeLoadingSuppressed,
      `iteration ${iteration} loading is suppressed`
    ).toBe(true)
  }

  await testInfo.attach('table-loading-timeout-repeat-snapshots.json', {
    body: JSON.stringify(snapshots, null, 2),
    contentType: 'application/json',
  })
})
