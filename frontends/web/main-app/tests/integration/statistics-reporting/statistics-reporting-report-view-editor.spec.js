const fs = require('node:fs')
const path = require('node:path')
const { test, expect } = require('@playwright/test')

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..')
const reportViewSchema = readJson(
  'core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/resources/META-INF/ouroboros/ui-schema/dev/{appName}/analytics/report-views/{fullName}.json'
)
const studioSchema = readJson(
  'core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/resources/META-INF/ouroboros/ui-schema/dev/{appName}/analytics/dataset-studio.json'
)
const publishCheckPanelSchema = readJson(
  'core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/resources/META-INF/ouroboros/ui-schema/dev/{appName}/analytics/dataset-studio/publish-check-panel.json'
)

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'))
}

function buildReportViewDefinition() {
  return {
    type: 'report',
    name: 'demo.sales-by-region',
    title: 'Sales By Region',
    datasetName: 'demo.sales',
    displayType: 'bar',
    dimensionFields: ['region'],
    metricFields: ['total_amount'],
    timeField: 'order_date',
    seriesField: 'channel',
    displayConfig: {
      titleText: 'Sales By Region',
      showLegend: true,
      legendPosition: 'top',
      sortOrder: 'desc',
      limit: 10,
    },
    interactionConfig: {},
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

function buildDatasetStudioLayout() {
  return {
    dataset: {
      name: 'demo.sales',
      title: 'Sales Dataset',
      status: 'DRAFT',
      parameters: [],
      schema: buildDatasetDefinition().schema,
      queryDefinition: {
        type: 'sql',
        datasourceName: 'reporting-main',
        genericSql: 'select region, total_amount, order_date from sales_order_fact',
        variants: [],
      },
    },
    kernelType: 'sql',
    datasourceOptions: [{ label: 'reporting-main', value: 'reporting-main' }],
    references: [],
    publicationReport: {
      blocking: false,
      issues: [],
    },
  }
}

function buildAssetReferenceGraph() {
  return {
    nodes: [
      { type: 'dataset', name: 'demo.sales', title: 'Sales Dataset', dangling: false },
      {
        type: 'report-view',
        name: 'demo.sales-by-region',
        title: 'Sales By Region',
        dangling: false,
      },
      {
        type: 'dashboard',
        name: 'demo.sales-dashboard',
        title: 'Sales Dashboard',
        dangling: false,
      },
    ],
    edges: [
      {
        fromType: 'dataset',
        fromName: 'demo.sales',
        toType: 'report-view',
        toName: 'demo.sales-by-region',
        relation: 'uses-dataset',
        dangling: false,
      },
      {
        fromType: 'report-view',
        fromName: 'demo.sales-by-region',
        toType: 'dashboard',
        toName: 'demo.sales-dashboard',
        relation: 'uses-report-view',
        dangling: false,
      },
    ],
    dangling: [],
  }
}

async function mockReportViewEditorApis(page) {
  const saveRequests = []
  const previewRequests = []

  await page.route('**/api/ui-schema**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const schemaPath = requestUrl.searchParams.get('path')
    let payload = null
    if (schemaPath === '/dev/{appName}/analytics/report-views/{fullName}') {
      payload = reportViewSchema
    } else if (schemaPath === '/dev/{appName}/analytics/datasets/{datasetName}/studio') {
      payload = studioSchema
    } else if (
      schemaPath === '/dev/{appName}/analytics/dataset-studio/publish-check-panel'
    ) {
      payload = publishCheckPanelSchema
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

  await page.route(
    '**/api/dev/demo/statistics-reporting/dataset-studio/demo.sales',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          status: 0,
          msg: '',
          data: buildDatasetStudioLayout(),
        }),
      })
    }
  )

  await page.route(
    '**/api/dev/demo/statistics-reporting/dataset-fixture/demo.sales',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          status: 0,
          msg: '',
          data: {
            appName: 'demo',
            datasetName: 'demo.sales',
          },
        }),
      })
    }
  )

  await page.route(
    '**/api/dev/demo/statistics-reporting-report-view/demo.sales-by-region',
    async (route) => {
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
          data: buildReportViewDefinition(),
        }),
      })
    }
  )

  await page.route(
    '**/api/dev/demo/statistics-reporting-dataset',
    async (route) => {
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
    }
  )

  await page.route(
    '**/api/dev/demo/statistics-reporting-dataset/demo.sales',
    async (route) => {
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
    }
  )

  await page.route(
    '**/api/dev/demo/statistics-reporting/chart-field-options/demo.sales?kind=*',
    async (route) => {
      const requestUrl = new URL(route.request().url())
      const kind = requestUrl.searchParams.get('kind')
      const allOptions = [
        {
          label: 'Order ID (order_id)',
          value: 'order_id',
          semanticRole: 'identifier',
          dataType: 'string',
          slotGroups: ['dimension', 'series'],
        },
        {
          label: 'Region (region)',
          value: 'region',
          semanticRole: 'dimension',
          dataType: 'string',
          slotGroups: ['dimension', 'series'],
        },
        {
          label: 'Channel (channel)',
          value: 'channel',
          semanticRole: 'detail',
          dataType: 'string',
          slotGroups: ['dimension', 'series'],
        },
        {
          label: 'Total Amount (total_amount)',
          value: 'total_amount',
          semanticRole: 'metric',
          dataType: 'decimal',
          slotGroups: ['metric'],
        },
        {
          label: 'Order Date (order_date)',
          value: 'order_date',
          semanticRole: 'time',
          dataType: 'datetime',
          slotGroups: ['time'],
        },
      ]
      const items =
        kind && kind !== 'all'
          ? allOptions.filter((option) => option.slotGroups.includes(kind))
          : allOptions
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
    }
  )

  await page.route('**/api/dev/demo/statistics-reporting/preview', async (route) => {
    previewRequests.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: {
          projection: {
            displayType: 'bar',
            dimensionFields: ['region'],
            metricFields: ['total_amount'],
            columns: [
              { name: 'region', title: 'Region' },
              { name: 'total_amount', title: 'Total Amount' },
            ],
            rows: [
              { region: 'east', total_amount: 128 },
              { region: 'west', total_amount: 64 },
            ],
            displayConfig: {
              titleText: 'Sales By Region',
              showLegend: true,
            },
          },
        },
      }),
    })
  })

  await page.route(
    '**/api/dev/demo/statistics-reporting/asset-reference-graph',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          status: 0,
          msg: '',
          data: buildAssetReferenceGraph(),
        }),
      })
    }
  )

  return {
    previewRequests,
    saveRequests,
  }
}

test('report view editor uses dataset select, semanticRole slots, preview, and save flow', async ({
  page,
}) => {
  const { previewRequests, saveRequests } = await mockReportViewEditorApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })
  await page.evaluate(() => {
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.openReportViewEditor()
  })

  await expect(page).toHaveURL(/\/dev\/demo\/analytics\/report-views\/demo\.sales-by-region$/)
  await expect(page.getByRole('textbox', { name: '显示名称' })).toHaveValue('Sales Dataset')
  await expect(page.getByText('semanticRole 槽位', { exact: true })).toBeVisible()
  await expect(page.getByText('即时预览', { exact: true })).toBeVisible()
  await expect(page.getByText('上下游引用', { exact: true })).toBeVisible()
  await expect(page.getByText('uses-report-view', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('demo.sales-dashboard', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('Region (region)', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Total Amount (total_amount)', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Order Date (order_date)', { exact: true }).first()).toBeVisible()

  await expect.poll(() => previewRequests.length).toBeGreaterThan(0)
  await expect(page.locator('.cxd-Chart, .a-Chart').first()).toBeVisible()
  const latestPreview = previewRequests[previewRequests.length - 1]
  expect(latestPreview.datasetName).toBe('demo.sales')
  expect(latestPreview.view.displayType).toBe('bar')
  expect(latestPreview.view.dimensionFields).toContain('region')
  expect(latestPreview.view.metricFields).toContain('total_amount')

  await page.getByRole('button', { name: '保存' }).click()
  await expect.poll(() => saveRequests.length).toBe(1)
  expect(saveRequests[0].datasetName).toBe('demo.sales')
  expect(saveRequests[0].dimensionFields).toContain('region')
  expect(saveRequests[0].metricFields).toContain('total_amount')
})
