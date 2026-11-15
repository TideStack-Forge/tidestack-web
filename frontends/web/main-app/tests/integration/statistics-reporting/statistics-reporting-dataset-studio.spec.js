const fs = require('node:fs')
const path = require('node:path')
const { test, expect } = require('@playwright/test')

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..')
const studioSchema = readJson(
  'core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/resources/META-INF/ouroboros/ui-schema/dev/{appName}/analytics/dataset-studio.json'
)
const overviewPanelSchema = readJson(
  'core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/resources/META-INF/ouroboros/ui-schema/dev/{appName}/analytics/dataset-studio/overview-panel.json'
)
const schemaPanelSchema = readJson(
  'core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/resources/META-INF/ouroboros/ui-schema/dev/{appName}/analytics/dataset-studio/schema-panel.json'
)
const publishCheckPanelSchema = readJson(
  'core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/resources/META-INF/ouroboros/ui-schema/dev/{appName}/analytics/dataset-studio/publish-check-panel.json'
)

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'))
}

function buildDatasetStudioLayout() {
  return {
    dataset: {
      name: 'demo.sales',
      title: 'Sales Overview',
      status: 'DRAFT',
      parameters: [
        {
          name: 'startDate',
          title: 'Start Date',
          type: 'date',
          operator: '>=',
          required: true,
          multiValue: false,
          visibleInView: true,
        },
      ],
      schema: {
        fields: [
          {
            name: 'order_date',
            title: 'Order Date',
            dataType: 'date',
            semanticRole: 'dimension',
          },
          {
            name: 'total_amount',
            title: 'Total Amount',
            dataType: 'decimal',
            semanticRole: 'metric',
          },
        ],
      },
      queryDefinition: {
        type: 'sql',
        datasourceName: 'reporting-main',
        datasourceTags: ['warehouse'],
        genericSql:
          'select order_date, sum(total_amount) as total_amount from sales_order_fact',
        variants: [
          {
            variantName: 'mysql-reporting',
            dialect: 'mysql',
            dialectVersionRange: '8.x',
            datasourceTags: ['warehouse'],
            priority: 100,
            sqlText:
              'select date(order_time) as order_date, sum(total_amount) as total_amount from sales_order_fact',
          },
        ],
      },
    },
    kernelType: 'sql',
    sections: [
      { key: 'overview', title: 'Overview', status: 'draft' },
      { key: 'query-definition', title: 'Query Definition', status: 'ready' },
      { key: 'schema', title: 'Schema', status: 'ready' },
      { key: 'publish-check', title: 'Publish Check', status: 'ready' },
    ],
    datasourceOptions: [
      {
        label: 'reporting-main',
        value: 'reporting-main',
        platformDataSourceName: 'jdbc-reporting-main',
      },
    ],
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
      { type: 'dataset', name: 'demo.sales', title: 'Sales Overview', dangling: false },
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
      { type: 'dataset', name: 'demo.missing-dataset', dangling: true },
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
      {
        fromType: 'dataset',
        fromName: 'demo.missing-dataset',
        toType: 'report-view',
        toName: 'demo.orphan-view',
        relation: 'uses-dataset',
        dangling: true,
      },
    ],
    dangling: [
      {
        fromType: 'dataset',
        fromName: 'demo.missing-dataset',
        toType: 'report-view',
        toName: 'demo.orphan-view',
        relation: 'uses-dataset',
        dangling: true,
      },
    ],
  }
}

async function mockDatasetStudioApis(page) {
  const saveRequests = []
  const fixtureSaveRequests = []
  const inferSchemaRequests = []

  await page.route('**/api/ui-schema**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const schemaPath = requestUrl.searchParams.get('path')

    let payload = null
    if (schemaPath === '/dev/{appName}/analytics/datasets/{datasetName}/studio') {
      payload = studioSchema
    } else if (schemaPath === '/dev/{appName}/analytics/dataset-studio/overview-panel') {
      payload = overviewPanelSchema
    } else if (schemaPath === '/dev/{appName}/analytics/dataset-studio/schema-panel') {
      payload = schemaPanelSchema
    } else if (
      schemaPath === '/dev/{appName}/analytics/dataset-studio/publish-check-panel'
    ) {
      payload = publishCheckPanelSchema
    } else if (schemaPath === '/playwright/statistics-reporting/leave-target') {
      payload = {
        type: 'page',
        body: [
          {
            type: 'tpl',
            tpl: '<h1>Leave Target</h1>',
          },
        ],
      }
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
    '**/api/dev/demo/statistics-reporting-dataset/demo.sales',
    async (route) => {
      saveRequests.push(route.request().postDataJSON())
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          status: 0,
          msg: '',
          data: null,
        }),
      })
    }
  )

  await page.route(
    '**/api/dev/demo/statistics-reporting/dataset-fixture/demo.sales',
    async (route) => {
      if (route.request().method() === 'PUT') {
        fixtureSaveRequests.push(route.request().postDataJSON())
      }
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
            testDatasourceName: 'reporting-main',
            testParameters: {
              startDate: '2026-01-01',
            },
          },
        }),
      })
    }
  )

  await page.route(
    '**/api/dev/demo/statistics-reporting/infer-schema',
    async (route) => {
      inferSchemaRequests.push(route.request().postDataJSON())
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          status: 0,
          msg: '',
          data: {
            fields: [
              {
                name: 'inferred_order_date',
                title: 'Inferred Order Date',
                dataType: 'date',
                semanticRole: 'dimension',
              },
              {
                name: 'inferred_revenue',
                title: 'Inferred Revenue',
                dataType: 'decimal',
                semanticRole: 'metric',
              },
            ],
          },
        }),
      })
    }
  )

  await page.route('**/api/dev/demo/statistics-reporting/preview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: {
          rows: [],
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
    saveRequests,
    fixtureSaveRequests,
    inferSchemaRequests,
  }
}

test('dataset studio harness renders the real page and guards route leave when dirty', async ({
  page,
}) => {
  await mockDatasetStudioApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  await expect(page.getByText('Sales Overview', { exact: true })).toBeVisible()
  await expect(page.getByText('执行并推导字段', { exact: true })).toBeVisible()
  await expect(page.getByText('参数定义', { exact: true })).toBeVisible()
  await expect(page.getByText('测试配置', { exact: true })).toBeVisible()
  await expect(page.getByText('字段 Schema 编辑', { exact: true })).toBeVisible()
  await expect(page.getByText('资产引用图', { exact: true })).toBeVisible()
  await expect(page.getByText('uses-dataset', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('demo.sales-by-region', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('悬空引用', { exact: true })).toBeVisible()
  await expect(page.getByText('demo.missing-dataset', { exact: true }).first()).toBeVisible()
  await expect(page).toHaveURL(/\/dev\/demo\/analytics\/datasets\/demo\.sales\/studio$/)

  await page.evaluate(() => {
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.setGenericSqlValue(
      'select 1 as dirty_dataset_studio'
    )
  })

  await expect(page.getByText('未保存', { exact: true })).toBeVisible()

  await page.evaluate(() => {
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.publishSavedEvent()
  })
  await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)

  await page.evaluate(() => {
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.setGenericSqlValue(
      'select 2 as dirty_again'
    )
  })
  await expect(page.getByText('未保存', { exact: true })).toBeVisible()

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('未保存')
    await dialog.dismiss()
  })
  await page.evaluate(() => {
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.navigateToLeaveTarget()
  })
  await expect(page).toHaveURL(/\/dev\/demo\/analytics\/datasets\/demo\.sales\/studio$/)

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('未保存')
    await dialog.accept()
  })
  await page.evaluate(() => {
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.navigateToLeaveTarget()
  })

  await expect(page).toHaveURL(/\/playwright\/statistics-reporting\/leave-target$/)
  await expect(page.getByRole('heading', { name: 'Leave Target' })).toBeVisible()
})

test('dataset studio harness saves edited sql through the real save button flow', async ({
  page,
}) => {
  const { saveRequests, fixtureSaveRequests } = await mockDatasetStudioApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  await page.evaluate(() => {
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.setGenericSqlValue(
      'select 3 as saved_from_real_button'
    )
  })

  await expect(page.getByText('未保存', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '保存草稿' }).click()

  await expect.poll(() => saveRequests.length).toBe(1)
  await expect.poll(() => fixtureSaveRequests.length).toBe(1)
  expect(saveRequests[0].queryDefinition.genericSql).toBe(
    'select 3 as saved_from_real_button'
  )
  expect(fixtureSaveRequests[0].testDatasourceName).toBe('reporting-main')
  expect(fixtureSaveRequests[0].testParameters.startDate).toBe('2026-01-01')
  await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)
})

test('dataset studio harness saves field advanced properties through schema editor', async ({
  page,
}) => {
  const { saveRequests } = await mockDatasetStudioApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  await page.getByText('字段 Schema 编辑', { exact: true }).click()
  const firstFieldAdvancedProperties = page
    .getByRole('group', { name: '高级属性' })
    .first()
  await firstFieldAdvancedProperties.getByRole('checkbox').nth(0).setChecked(true, {
    force: true,
  })
  await firstFieldAdvancedProperties.getByRole('checkbox').nth(1).setChecked(true, {
    force: true,
  })
  await firstFieldAdvancedProperties.getByRole('checkbox').nth(2).setChecked(false, {
    force: true,
  })
  await firstFieldAdvancedProperties.getByRole('checkbox').nth(3).setChecked(false, {
    force: true,
  })
  await page.getByRole('button', { name: '保存草稿' }).click()

  await expect.poll(() => saveRequests.length).toBe(1)
  expect(saveRequests[0].schema.fields[0].sortable).toBe(true)
  expect(saveRequests[0].schema.fields[0].filterable).toBe(true)
  expect(saveRequests[0].schema.fields[0].exportable).toBe(false)
  expect(saveRequests[0].schema.fields[0].visibleByDefault).toBe(false)
})

test('dataset studio harness infers schema fields from the real action flow', async ({
  page,
}) => {
  const { inferSchemaRequests } = await mockDatasetStudioApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  await page.getByRole('button', { name: '执行并推导字段' }).click()

  await expect.poll(() => inferSchemaRequests.length).toBe(1)
  expect(inferSchemaRequests[0].datasourceName).toBe('reporting-main')
  expect(inferSchemaRequests[0].sql).toContain('sales_order_fact')
  await page.getByText('字段 Schema 编辑', { exact: true }).click()
  await expect(page.locator('input[value="inferred_order_date"]:visible')).toBeVisible()
  await expect(page.locator('input[value="inferred_revenue"]:visible')).toBeVisible()
})
