const { test, expect } = require('@playwright/test')

const { attachScreenshotEvidence } = require('../main-app-host-e2e/helpers/evidence')

const seededToken = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 60 * 60,
  refreshTokenExpiresIn: 24 * 60 * 60,
  issuedAt: 1_710_000_000_000,
}

async function seedAuthToken(page) {
  await page.addInitScript((token) => {
    window.localStorage.setItem('Ouroboros_token', JSON.stringify(token))
  }, seededToken)
}

async function openRuntimePage(page, path) {
  await seedAuthToken(page)
  await page.goto(path)
}

function runtimeTab(page, text) {
  return page.locator('.a-Tabs-link, .cxd-Tabs-link').filter({ hasText: text }).first()
}

test.describe('statistics reporting runtime pages', () => {
  test('report-view runtime renders chart projections for line, bar, and pie', async ({
    page,
  }, testInfo) => {
    const chartCases = [
      {
        viewName: 'sales-line',
        heading: '图表: sales-line',
        expectCanvas: true,
        evidenceName: 'statistics-reporting-runtime-line',
      },
      {
        viewName: 'sales-bar',
        heading: '图表: sales-bar',
        expectCanvas: true,
        evidenceName: 'statistics-reporting-runtime-bar',
      },
      {
        viewName: 'sales-pie',
        heading: '图表: sales-pie',
        expectCanvas: true,
        evidenceName: 'statistics-reporting-runtime-pie',
      },
    ]

    for (const chartCase of chartCases) {
      await openRuntimePage(
        page,
        `/runtime/statistics-reporting/report-views/${chartCase.viewName}`
      )

      await expect(page.getByRole('heading', { name: chartCase.heading })).toBeVisible()
      await expect(runtimeTab(page, '图表')).toBeVisible()
      await expect(runtimeTab(page, '数据')).toBeVisible()
      if (chartCase.expectCanvas) {
        await expect(page.locator('canvas').first()).toBeVisible()
      }

      await attachScreenshotEvidence({
        page,
        testInfo,
        name: chartCase.evidenceName,
      })
    }
  })

  test('report-view runtime renders metric-card and crosstab projections', async ({
    page,
  }, testInfo) => {
    await openRuntimePage(page, '/runtime/statistics-reporting/report-views/sales-metric')

    await expect(page.getByRole('heading', { name: '图表: sales-metric' })).toBeVisible()
    await expect(page.getByText('销售额', { exact: true })).toBeVisible()
    await expect(page.getByText('128', { exact: true })).toBeVisible()
    await expect(page.getByText('毛利', { exact: true })).toBeVisible()
    await expect(page.getByText('64', { exact: true })).toBeVisible()

    await attachScreenshotEvidence({
      page,
      testInfo,
      name: 'statistics-reporting-runtime-metric-card',
    })

    await openRuntimePage(page, '/runtime/statistics-reporting/report-views/sales-crosstab')

    await expect(page.getByRole('heading', { name: '图表: sales-crosstab' })).toBeVisible()
    await expect(page.getByText('区域', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('已支付', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('待支付', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('east', { exact: true })).toBeVisible()
    await expect(page.getByText('west', { exact: true })).toBeVisible()

    await attachScreenshotEvidence({
      page,
      testInfo,
      name: 'statistics-reporting-runtime-crosstab',
    })
  })

  test('dashboard runtime renders embedded report-view widgets', async ({ page }, testInfo) => {
    await openRuntimePage(page, '/runtime/statistics-reporting/dashboards/sales-overview')

    await expect(page.getByRole('heading', { name: '仪表盘: sales-overview' })).toBeVisible()
    await expect(page.locator('[data-widget-name="report-view"]')).toHaveCount(2)
    await expect(page.getByText('销售指标卡', { exact: true })).toBeVisible()
    await expect(page.getByText('区域收款分布', { exact: true })).toBeVisible()
    await expect(page.getByText('销售额', { exact: true })).toBeVisible()
    await expect(page.getByText('128', { exact: true })).toBeVisible()
    await expect(page.getByText('已支付', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('待支付', { exact: true }).first()).toBeVisible()

    await attachScreenshotEvidence({
      page,
      testInfo,
      name: 'statistics-reporting-runtime-dashboard',
    })
  })
})
