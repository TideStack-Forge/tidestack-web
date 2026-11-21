const { test, expect } = require('@playwright/test')

const { attachScreenshotEvidence } = require('../main-app-host-e2e/helpers/evidence')
const { waitForEChartsSettled } = require('./helpers/echarts')
const { installBrowserErrorChecks } = require('./helpers/browserErrors')

installBrowserErrorChecks(test)

const seededToken = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 60 * 60,
  refreshTokenExpiresIn: 24 * 60 * 60,
  issuedAt: Date.now(),
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

test.describe('statistics reporting runtime pages', () => {
  test('chart runtime renders backend options for line, bar, and pie', async ({
    page,
  }, testInfo) => {
    const chartCases = [
      {
        chartName: 'sales-line',
        heading: '图表: sales-line',
        expectCanvas: true,
        evidenceName: 'statistics-reporting-runtime-line',
      },
      {
        chartName: 'sales-bar',
        heading: '图表: sales-bar',
        expectCanvas: true,
        evidenceName: 'statistics-reporting-runtime-bar',
      },
      {
        chartName: 'sales-pie',
        heading: '图表: sales-pie',
        expectCanvas: true,
        evidenceName: 'statistics-reporting-runtime-pie',
      },
    ]

    for (const chartCase of chartCases) {
      await openRuntimePage(
        page,
        `/runtime/statistics-reporting/charts/${chartCase.chartName}`
      )

      await expect(page.getByRole('heading', { name: chartCase.heading })).toBeVisible()
      if (chartCase.expectCanvas) {
        await expect(page.locator('canvas').first()).toBeVisible()
      }
      await waitForEChartsSettled(page, { requireSeriesData: true })

      await attachScreenshotEvidence({
        page,
        testInfo,
        name: chartCase.evidenceName,
      })
    }
  })

  test('chart runtime renders metric-card and crosstab backend options', async ({
    page,
  }, testInfo) => {
    await openRuntimePage(page, '/runtime/statistics-reporting/charts/sales-metric')

    await expect(page.getByRole('heading', { name: '图表: sales-metric' })).toBeVisible()
    await expect(page.locator('canvas').first()).toBeVisible()
    await waitForEChartsSettled(page)

    await attachScreenshotEvidence({
      page,
      testInfo,
      name: 'statistics-reporting-runtime-metric-card',
    })

    await openRuntimePage(page, '/runtime/statistics-reporting/charts/sales-crosstab')

    await expect(
      page.getByRole('heading', { name: '图表: sales-crosstab' })
    ).toBeVisible()
    await expect(page.locator('canvas').first()).toBeVisible()
    await waitForEChartsSettled(page)

    await attachScreenshotEvidence({
      page,
      testInfo,
      name: 'statistics-reporting-runtime-crosstab',
    })
  })

  test('dashboard runtime fetches structure and renders chart widgets independently', async ({
    page,
  }, testInfo) => {
    const dashboardResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/demo/sales-dashboard')
    )
    const chartRequests = []
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().includes('/api/runtime/statistics-reporting/charts/') &&
        request.url().endsWith('/execute')
      ) {
        chartRequests.push(request.url())
      }
    })

    await openRuntimePage(page, '/demo/sales-dashboard')

    const dashboardPayload = await (await dashboardResponse).json()
    expect(dashboardPayload.data.widgets).toHaveLength(2)
    expect(dashboardPayload.data.widgets.every((widget) => !('data' in widget))).toBe(
      true
    )

    await expect(page.getByRole('heading', { name: '销售总览仪表板' })).toBeVisible()
    await expect(page.locator('[data-widget-name="chart"]')).toHaveCount(2)
    await expect(page.getByText('销售指标卡', { exact: true })).toBeVisible()
    await expect(page.getByText('区域收款分布', { exact: true })).toBeVisible()
    await expect(page.locator('canvas')).toHaveCount(2)
    await waitForEChartsSettled(page, { minimumInstances: 2 })
    expect(chartRequests).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/charts/sales-metric/execute'),
        expect.stringContaining('/charts/sales-crosstab/execute'),
      ])
    )

    await attachScreenshotEvidence({
      page,
      testInfo,
      name: 'statistics-reporting-runtime-dashboard',
    })
  })

  test('dashboard runtime keeps chart widgets readable on a narrow viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openRuntimePage(page, '/demo/sales-dashboard')

    const widgets = page.locator('[data-widget-name="chart"]')
    await expect(widgets).toHaveCount(2)
    for (const widget of await widgets.all()) {
      await widget.scrollIntoViewIfNeeded()
      await expect(widget.locator('canvas')).toBeVisible()
    }
    await expect(page.locator('canvas')).toHaveCount(2)
    const metrics = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      widgets: Array.from(document.querySelectorAll('[data-widget-name="chart"]')).map(
        (element) => {
          const widgetRect = element.getBoundingClientRect()
          const canvas = element.querySelector('canvas')
          const canvasRect = canvas?.getBoundingClientRect()
          return {
            widgetWidth: widgetRect.width,
            canvasWidth: canvasRect?.width ?? 0,
          }
        }
      ),
    }))

    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth)
    for (const widget of metrics.widgets) {
      expect(widget.widgetWidth).toBeGreaterThanOrEqual(280)
      expect(widget.canvasWidth).toBeGreaterThanOrEqual(240)
    }
  })
  test('dashboard retries a failed widget while keeping another widget available', async ({ page }) => {
    let attempts = 0
    await page.route('**/api/runtime/statistics-reporting/charts/sales-metric/execute', async route => {
      attempts += 1
      if (attempts === 1) {
        await route.fulfill({ json: { code: 500, status: 500, msg: '指标暂时不可用' } })
      } else {
        await route.continue()
      }
    })
    await openRuntimePage(page, '/demo/sales-dashboard')
    const failed = page.locator('[data-widget-name="chart"]').filter({ hasText: '销售指标卡' })
    const healthy = page.locator('[data-widget-name="chart"]').filter({ hasText: '区域收款分布' })
    await expect(failed.getByText('指标暂时不可用', { exact: true })).toBeVisible()
    await expect(healthy.locator('canvas')).toBeVisible()
    await failed.getByRole('button', { name: '重试', exact: true }).click()
    await expect(failed.locator('canvas')).toBeVisible()
    await expect(healthy.locator('canvas')).toBeVisible()
    expect(attempts).toBe(2)
  })

})
