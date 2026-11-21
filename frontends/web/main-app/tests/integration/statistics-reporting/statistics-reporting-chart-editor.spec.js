const fs = require('node:fs')
const path = require('node:path')
const { test, expect } = require('@playwright/test')

const { waitForEChartsSettled } = require('./helpers/echarts')
const { installBrowserErrorChecks } = require('./helpers/browserErrors')

installBrowserErrorChecks(test)

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..')
const chartSchema = readJson(
  'core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/resources/META-INF/ouroboros/ui-schema/dev/{appName}/chart/{fullName}.json'
)
const datasetEditorSchema = readJson(
  'core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/resources/META-INF/ouroboros/ui-schema/dev/{appName}/dataset/{datasetName}.json'
)

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'))
}

function buildChartDefinition() {
  return {
    type: 'chart',
    name: 'demo.sales-by-region',
    title: 'Sales By Region',
    datasetName: 'demo.sales',
    chartType: 'bar',
    params: {
      xField: 'region',
      yFields: ['total_amount'],
      seriesField: 'channel',
      titleText: 'Sales By Region',
      showLegend: true,
      sortOrder: 'desc',
      limit: 10,
    },
  }
}

function buildDatasetDefinition() {
  return {
    name: 'demo.sales',
    title: 'Sales Dataset',
    schema: {
      fields: [
        {
          name: 'order_id',
          title: 'Order ID',
          dataType: 'string',
          semanticRole: 'identifier',
        },
        {
          name: 'region',
          title: 'Region',
          dataType: 'string',
          semanticRole: 'dimension',
        },
        {
          name: 'channel',
          title: 'Channel',
          dataType: 'string',
          semanticRole: 'detail',
        },
        {
          name: 'total_amount',
          title: 'Total Amount',
          dataType: 'decimal',
          semanticRole: 'metric',
        },
        {
          name: 'order_date',
          title: 'Order Date',
          dataType: 'datetime',
          semanticRole: 'time',
        },
      ],
    },
  }
}

async function mockChartEditorApis(page) {
  const saveRequests = []
  const previewRequests = []

  await page.route('**/api/ui-schema**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const schemaPath = requestUrl.searchParams.get('path')
    let payload = null
    if (schemaPath === '/dev/{appName}/dataset/{datasetName}') {
      payload = datasetEditorSchema
    } else if (schemaPath === '/dev/{appName}/chart/{fullName}') {
      payload = chartSchema
    }

    if (!payload) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 404,
          status: 404,
          msg: 'Schema Not Found',
          data: null,
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: payload,
      }),
    })
  })

  await page.route('**/api/dev/demo/dataset/demo.sales/editor', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: {
          dataset: {
            ...buildDatasetDefinition(),
            isEnabled: true,
            queryDefinition: {
              type: 'sql',
              datasource: 'default',
              sql: 'select 1',
              dialects: [],
            },
          },
          datasourceOptions: [],
        },
      }),
    })
  })

  await page.route('**/api/dev/demo/chart/demo.sales-by-region', async (route) => {
    if (route.request().method() === 'PUT') {
      saveRequests.push(route.request().postDataJSON())
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: buildChartDefinition(),
      }),
    })
  })

  await page.route('**/api/dev/demo/dataset', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: {
          items: [
            {
              name: 'demo.sales',
              title: 'Sales Dataset',
            },
          ],
        },
      }),
    })
  })

  await page.route('**/api/dev/demo/dataset/demo.sales', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: buildDatasetDefinition(),
      }),
    })
  })

  await page.route('**/api/dev/demo/chart/field-options/demo.sales**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const parameter = requestUrl.searchParams.get('param')
    const allOptions = [
      {
        label: 'Order ID (order_id)',
        value: 'order_id',
        semanticRole: 'identifier',
        dataType: 'string',
        roles: ['category', 'any'],
      },
      {
        label: 'Region (region)',
        value: 'region',
        semanticRole: 'dimension',
        dataType: 'string',
        roles: ['category', 'any'],
      },
      {
        label: 'Channel (channel)',
        value: 'channel',
        semanticRole: 'detail',
        dataType: 'string',
        roles: ['category', 'any'],
      },
      {
        label: 'Total Amount (total_amount)',
        value: 'total_amount',
        semanticRole: 'metric',
        dataType: 'decimal',
        roles: ['metric', 'any'],
      },
      {
        label: 'Order Date (order_date)',
        value: 'order_date',
        semanticRole: 'time',
        dataType: 'datetime',
        roles: ['category', 'any'],
      },
    ]
    const metricParameters = new Set([
      'yFields',
      'valueField',
      'valueFields',
      'sizeField',
      'series.field',
    ])
    const role = metricParameters.has(parameter)
      ? 'metric'
      : parameter === 'sortField' || parameter === 'columns'
        ? 'any'
        : 'category'
    const items = allOptions.filter((option) => option.roles.includes(role))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: {
          items,
        },
      }),
    })
  })

  await page.route('**/api/dev/demo/chart/preview', async (route) => {
    previewRequests.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: {
          chartType: 'bar',
          option: {
            title: { text: 'Sales By Region' },
            xAxis: { type: 'category', data: ['east', 'west'] },
            yAxis: { type: 'value' },
            series: [{ type: 'bar', data: [128, 64] }],
          },
        },
      }),
    })
  })

  return {
    previewRequests,
    saveRequests,
  }
}

test('chart editor uses dataset-backed params, backend preview, and save flow', async ({
  page,
}, testInfo) => {
  const { previewRequests, saveRequests } = await mockChartEditorApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })
  await page.evaluate(() =>
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.openChartEditor()
  )

  await expect(page).toHaveURL(/\/dev\/demo\/chart\/demo\.sales-by-region$/)
  const metadata = page.locator('.statistics-chart-editor-metadata')
  const dataFields = page.locator('.statistics-chart-editor-data-fields')
  await expect(metadata.locator('.cxd-Collapse-contentWrapper')).toHaveCSS('height', '0px')
  await expect(dataFields).toHaveClass(/is-active/)
  const metadataHeader = await metadata.locator('.cxd-Collapse-header').boundingBox()
  const dataFieldsHeader = await dataFields.locator('.cxd-Collapse-header').boundingBox()
  expect(metadataHeader.y).toBeLessThan(dataFieldsHeader.y)
  await dataFields.locator('.cxd-Collapse-header').click()
  await expect(dataFields.locator('.cxd-Collapse-contentWrapper')).toHaveCSS('height', '0px')
  await dataFields.locator('.cxd-Collapse-header').click()
  await expect(dataFields).toHaveClass(/is-active/)
  await page.getByText('基本信息', { exact: true }).click()
  await expect(
    page.locator('.statistics-chart-editor-controls input[name="title"]')
  ).toHaveValue('Sales By Region')
  await page.locator('.statistics-chart-editor-controls input[name="title"]').fill('区域销售分析')
  await page.getByText('基本信息', { exact: true }).click()
  await expect(page.getByText('横轴字段', { exact: true })).toBeVisible()
  await expect(page.getByText('数值字段', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('系列字段', { exact: true })).toBeVisible()
  await expect(page.getByText('图表预览', { exact: true })).toBeVisible()
  const controls = page.locator('.statistics-chart-editor-controls')
  const canvas = page.locator('.statistics-chart-editor-canvas')
  const previewBody = page.locator('.statistics-chart-editor-preview-body')
  await expect(controls).toBeVisible()
  await expect(canvas).toBeVisible()
  await expect(page.locator('.statistics-chart-editor-preview-shell')).toBeVisible()
  await expect(previewBody).toBeVisible()
  const controlsBox = await controls.boundingBox()
  const canvasBox = await canvas.boundingBox()
  const previewBodyBox = await previewBody.boundingBox()
  expect(controlsBox?.width).toBeGreaterThanOrEqual(300)
  expect(controlsBox?.width).toBeLessThanOrEqual(340)
  expect(canvasBox?.width).toBeGreaterThan(controlsBox?.width || 0)
  expect(previewBodyBox?.height).toBeGreaterThanOrEqual((canvasBox?.height || 0) - 120)
  await expect(page.getByText('上下游引用', { exact: true })).toHaveCount(0)
  await expect(page.getByText('uses-chart', { exact: true })).toHaveCount(0)
  await expect(page.getByText('demo.sales-dashboard', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Region (region)', { exact: true }).first()).toBeVisible()
  await expect(
    page.getByText('Total Amount (total_amount)', { exact: true }).first()
  ).toBeVisible()
  await page.getByText('Region (region)', { exact: true }).first().click()
  await expect(
    page.getByText('Order Date (order_date)', { exact: true }).first()
  ).toBeVisible()
  await page.getByText('Region (region)', { exact: true }).last().click()

  await expect.poll(() => previewRequests.length).toBeGreaterThan(0)
  for (const request of previewRequests) {
    expect(request.datasetName).toBe('demo.sales')
    expect(request.chart.name).toBe('demo.sales-by-region')
    expect(request.chart.chartType).toBe('bar')
    expect(Array.isArray(request.chart.tags)).toBe(true)
  }
  await expect(page.locator('.cxd-Chart, .a-Chart').first()).toBeVisible()
  const latestPreview = previewRequests[previewRequests.length - 1]
  expect(latestPreview.datasetName).toBe('demo.sales')
  expect(latestPreview.chart.chartType).toBe('bar')
  expect(latestPreview.chart.params).toMatchObject({
    xField: 'region',
    yFields: ['total_amount'],
    seriesField: 'channel',
  })

  await waitForEChartsSettled(page, {
    rootSelector: '.statistics-chart-editor-preview-body',
    requireSeriesData: true,
  })

  await page.screenshot({
    path: testInfo.outputPath('statistics-chart-editor.png'),
    fullPage: true,
  })

  await dataFields.locator('.cxd-Collapse-header').click()
  await expect(dataFields.locator('.cxd-Collapse-contentWrapper')).toHaveCSS('height', '0px')
  await page.getByRole('button', { name: '保存' }).click()
  await expect.poll(() => saveRequests.length).toBe(1)
  expect(saveRequests[0].title).toBe('区域销售分析')
  expect(saveRequests[0].datasetName).toBe('demo.sales')
  expect(saveRequests[0].chartType).toBe('bar')
  expect(saveRequests[0].params).toMatchObject({
    xField: 'region',
    yFields: ['total_amount'],
    seriesField: 'channel',
  })
})

test('chart editor switches to a full-width stacked layout on a narrow viewport', async ({
  page,
}) => {
  await mockChartEditorApis(page)
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })
  await page.evaluate(() =>
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.openChartEditor()
  )

  await expect(page).toHaveURL(/\/dev\/demo\/chart\/demo\.sales-by-region$/)
  const previewBody = page.locator('.statistics-chart-editor-preview-body')
  await expect(previewBody).toBeVisible()
  const metrics = await page.evaluate(() => {
    const read = (selector) => {
      const element = document.querySelector(selector)
      if (!element) return null
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        width: rect.width,
        height: rect.height,
        flexDirection: style.flexDirection,
      }
    }
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      layout: read('.statistics-chart-editor-layout'),
      controls: read('.statistics-chart-editor-controls'),
      canvas: read('.statistics-chart-editor-canvas'),
      previewBody: read('.statistics-chart-editor-preview-body'),
    }
  })
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth)
  expect(metrics.layout?.flexDirection).toBe('column')
  expect(metrics.controls?.width).toBeGreaterThanOrEqual(metrics.viewportWidth - 24)
  expect(metrics.canvas?.width).toBeGreaterThanOrEqual(metrics.viewportWidth - 24)
  expect(metrics.previewBody?.height).toBeGreaterThanOrEqual(400)
})
