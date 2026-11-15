const { test, expect } = require('@playwright/test')

async function gotoHarness(page) {
  await page.goto('/input-table-overlay-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__INPUT_TABLE_OVERLAY_PLAYWRIGHT_HARNESS__?.ready === true
  })
  await page.waitForFunction(() => !document.querySelector('.cxd-Spinner-overlay.in'))
}

async function readInputTableContentMetrics(page, className) {
  return page.evaluate((rootClassName) => {
    const root = document.querySelector(`.${rootClassName}`)
    const content = root?.querySelector('.cxd-Table-content.input-table-virtual-scroll')

    if (!root || !content) {
      return null
    }

    const contentStyle = window.getComputedStyle(content)

    return {
      clientHeight: content.clientHeight,
      maxHeight: contentStyle.maxHeight,
      overflowY: contentStyle.overflowY,
      rowCount: content.querySelectorAll('tbody tr').length,
      scrollHeight: content.scrollHeight,
    }
  }, className)
}

function inputTableContent(page, className) {
  return page.locator(`.${className} .cxd-Table-content.input-table-virtual-scroll`)
}

async function moveMouseToInputTableContent(page, content) {
  await content.hover()
}

async function readHorizontalOverflowMetrics(page, rootClassName) {
  return page.evaluate((targetRootClassName) => {
    const root = document.querySelector(`.${targetRootClassName}`)
    const value = root?.querySelector('.cxd-Form-value')
    const control = root?.querySelector('.cxd-Form-control')
    const content = root?.querySelector('.cxd-Table-content.input-table-virtual-scroll')
    const table = content?.querySelector('table')

    if (!root || !content || !table) {
      return null
    }

    const valueRect = value?.getBoundingClientRect()
    const controlRect = control?.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    const tableRect = table.getBoundingClientRect()
    const contentStyle = window.getComputedStyle(content)

    return {
      contentClientWidth: content.clientWidth,
      contentOverflowX: contentStyle.overflowX,
      contentRight: contentRect.right,
      contentScrollWidth: content.scrollWidth,
      controlRight: controlRect?.right,
      rootRight: rootRect.right,
      tableWidth: tableRect.width,
      valueRight: valueRect?.right,
    }
  }, rootClassName)
}

async function readDialogInputTableOverflowMetrics(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('.cxd-Modal-content')
    const body =
      document.querySelector('[role="dialog-body"]') ||
      document.querySelector('.cxd-Modal-body')
    const root = document.querySelector('.meter-type-dialog-metric-input-table')
    const formItem = root?.closest('.cxd-Form-item')
    const content = root?.querySelector('.cxd-Table-content.input-table-virtual-scroll')
    const table = content?.querySelector('table')

    if (!dialog || !body || !root || !formItem || !content || !table) {
      return null
    }

    const dialogRect = dialog.getBoundingClientRect()
    const bodyRect = body.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    const formItemRect = formItem.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    const tableRect = table.getBoundingClientRect()
    const contentStyle = window.getComputedStyle(content)

    return {
      bodyRight: bodyRect.right,
      contentClientWidth: content.clientWidth,
      contentOverflowX: contentStyle.overflowX,
      contentRight: contentRect.right,
      contentScrollWidth: content.scrollWidth,
      dialogRight: dialogRect.right,
      dialogWidth: dialogRect.width,
      formItemRight: formItemRect.right,
      rootRight: rootRect.right,
      tableWidth: tableRect.width,
      viewportWidth: window.innerWidth,
    }
  })
}

test('input-table content sizing defaults to natural height and accepts explicit bounds', async ({
  page,
}) => {
  await gotoHarness(page)

  await expect(page.locator('.input-table-default-inline-lazy')).toBeVisible()
  await expect(page.locator('.input-table-content-sizing-auto-grow')).toBeVisible()
  await expect(page.locator('.input-table-content-sizing-constrained')).toBeVisible()

  const defaultMetrics = await readInputTableContentMetrics(
    page,
    'input-table-default-inline-lazy'
  )
  const autoGrowMetrics = await readInputTableContentMetrics(
    page,
    'input-table-content-sizing-auto-grow'
  )
  const constrainedMetrics = await readInputTableContentMetrics(
    page,
    'input-table-content-sizing-constrained'
  )

  expect(defaultMetrics).not.toBeNull()
  expect(autoGrowMetrics).not.toBeNull()
  expect(constrainedMetrics).not.toBeNull()
  expect(defaultMetrics.rowCount).toBe(40)
  expect(autoGrowMetrics.rowCount).toBe(40)
  expect(constrainedMetrics.rowCount).toBe(40)

  expect(defaultMetrics.overflowY).toBe('auto')
  expect(defaultMetrics.maxHeight).toBe('none')
  expect(defaultMetrics.scrollHeight).toBe(defaultMetrics.clientHeight)

  expect(autoGrowMetrics.overflowY).toBe('visible')
  expect(autoGrowMetrics.maxHeight).toBe('none')
  expect(autoGrowMetrics.scrollHeight).toBe(autoGrowMetrics.clientHeight)

  expect(constrainedMetrics.overflowY).toBe('auto')
  expect(constrainedMetrics.maxHeight).toBe('180px')
  expect(constrainedMetrics.scrollHeight).toBeGreaterThan(constrainedMetrics.clientHeight)
  expect(constrainedMetrics.clientHeight).toBeLessThan(autoGrowMetrics.clientHeight)
})

test('constrained input-table chains wheel scrolling to outer page at vertical bounds', async ({
  page,
}) => {
  await gotoHarness(page)

  const content = inputTableContent(page, 'input-table-content-sizing-constrained')
  await expect(content).toBeVisible()
  await content.evaluate((element) => {
    element.scrollIntoView({ block: 'center' })
    element.scrollTop = 0
  })
  await moveMouseToInputTableContent(page, content)

  await page.mouse.wheel(0, 240)
  await expect
    .poll(() => content.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0)

  await content.evaluate((element) => {
    element.scrollTop = element.scrollHeight - element.clientHeight
  })
  const outerScrollTop = await page.evaluate(() => window.scrollY)

  await page.mouse.wheel(0, 160)
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(outerScrollTop)
})

test('wide input-table stays inside horizontal form control and scrolls horizontally', async ({
  page,
}) => {
  await gotoHarness(page)

  await expect(page.locator('.input-table-horizontal-overflow')).toBeVisible()

  const metrics = await readHorizontalOverflowMetrics(
    page,
    'input-table-horizontal-overflow'
  )

  expect(metrics).not.toBeNull()
  expect(metrics.contentOverflowX).toBe('auto')
  expect(metrics.contentRight).toBeLessThanOrEqual(metrics.valueRight + 1)
  expect(metrics.contentRight).toBeLessThanOrEqual(metrics.controlRight + 1)
  expect(metrics.contentScrollWidth).toBeGreaterThan(metrics.contentClientWidth)
  expect(metrics.tableWidth).toBeGreaterThan(metrics.contentClientWidth)
})

test('meter type dialog input-table keeps native horizontal overflow inside modal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoHarness(page)

  await page.locator('.open-meter-type-dialog-overflow-repro').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.locator(
      '.meter-type-dialog-metric-input-table .cxd-Table-content.input-table-virtual-scroll'
    )
  ).toBeVisible()

  const metrics = await readDialogInputTableOverflowMetrics(page)

  expect(metrics).not.toBeNull()
  expect(metrics.contentOverflowX).toBe('auto')
  expect(metrics.contentScrollWidth).toBeGreaterThan(metrics.contentClientWidth)
  expect(metrics.tableWidth).toBeGreaterThan(metrics.contentClientWidth)
  expect(metrics.dialogWidth).toBeLessThanOrEqual(metrics.viewportWidth * 0.92)
  expect(metrics.formItemRight).toBeLessThanOrEqual(metrics.bodyRight + 1)
  expect(metrics.rootRight).toBeLessThanOrEqual(metrics.bodyRight + 1)
  expect(metrics.contentRight).toBeLessThanOrEqual(metrics.bodyRight + 1)
  expect(metrics.contentRight).toBeLessThanOrEqual(metrics.dialogRight + 1)
})
