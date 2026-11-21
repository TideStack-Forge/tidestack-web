const fs = require('node:fs')
const path = require('node:path')
const { test, expect } = require('@playwright/test')

const { installBrowserErrorChecks } = require('./helpers/browserErrors')

installBrowserErrorChecks(test)

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..')
const datasetEditorSchema = readJson(
  'core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/resources/META-INF/ouroboros/ui-schema/dev/{appName}/dataset/{datasetName}.json'
)
const datasetListSchema = readJson(
  'core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/resources/META-INF/ouroboros/ui-schema/dev/{appName}/dataset.json'
)
function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'))
}

function buildDatasetEditorLayout() {
  return {
    dataset: {
      name: 'demo.sales',
      title: 'Sales Overview',
      tags: null,
      isEnabled: true,
      parameters: [
        {
          name: 'startDate',
          title: 'Start Date',
          type: 'date',
          operator: '>=',
          required: true,
          multiValue: false,
          allowEmptyOmitCondition: false,
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
            nullable: true,
            sortable: true,
            filterable: true,
            exportable: false,
            visibleByDefault: false,
          },
          {
            name: 'total_amount',
            title: 'Total Amount',
            dataType: 'decimal',
            semanticRole: 'metric',
            nullable: true,
            sortable: false,
            filterable: false,
            exportable: true,
            visibleByDefault: true,
          },
        ],
      },
      queryDefinition: {
        type: 'sql',
        datasource: 'reporting-main',
        sql: 'select * from sales_order_fact where order_date >= ${startDate}',
        dialects: [
          {
            dialectName: 'mysql',
            sql: 'select * from sales_order_fact where order_time >= ${startDate}',
          },
        ],
      },
    },
    datasourceOptions: [
      {
        label: 'reporting-main',
        value: 'reporting-main',
        platformDataSourceName: 'jdbc-reporting-main',
      },
    ],
  }
}

async function mockDatasetEditorApis(
  page,
  { saveDelayMs = 0, connectionTestFailureCount = 0, devConfigLoadFailure = '', defaultDatasource = false } = {}
) {
  const saveRequests = []
  const devConfigSaveRequests = []
  const inferSchemaRequests = []
  const connectionTestRequests = []
  const previewRequests = []
  const lifecycleRequests = []
  const datasetItems = [
    buildDatasetEditorLayout().dataset,
    {
      ...buildDatasetEditorLayout().dataset,
      name: 'demo.archive',
      title: 'Archived Sales',
      isEnabled: false,
    },
  ]

  await page.route('**/api/ui-schema**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const schemaPath = requestUrl.searchParams.get('path')

    let payload = null
    if (schemaPath === '/dev/{appName}/dataset/{datasetName}') {
      payload = datasetEditorSchema
    } else if (schemaPath === '/dev/{appName}/dataset') {
      payload = datasetListSchema
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

  await page.route('**/api/dev/demo/dataset/demo.sales/editor', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: (() => {
          const layout = buildDatasetEditorLayout()
          if (defaultDatasource) layout.dataset.queryDefinition.datasource = 'default'
          return layout
        })(),
      }),
    })
  })

  await page.route('**/api/dev/demo/dataset/demo.sales', async (route) => {
    const savedDataset = route.request().postDataJSON()
    saveRequests.push(savedDataset)
    if (saveDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, saveDelayMs))
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: savedDataset,
      }),
    })
  })

  await page.route('**/api/dev/demo/dataset/demo.sales/dev-config', async (route) => {
    if (route.request().method() === 'GET' && devConfigLoadFailure) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: -1,
          status: -1,
          msg: devConfigLoadFailure,
          data: null,
        }),
      })
      return
    }
    if (route.request().method() === 'PUT') {
      devConfigSaveRequests.push(route.request().postDataJSON())
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
          datasource: defaultDatasource ? 'default' : 'reporting-main',
          parameters: devConfigSaveRequests.at(-1)?.parameters || {
            startDate: '2026-01-01',
          },
          testConnection: devConfigSaveRequests.at(-1)?.testConnection || { kind: 'application' },
        },
      }),
    })
  })

  await page.route('**/api/dev/demo/dataset/datasource-tables', route => route.fulfill({
    json: { code: 0, status: 0, data: { items: [{ name: 'sales_order', title: '订单', source: 'model', columns: [{ name: 'order_id', dataType: 'integer' }] }], warnings: [] } },
  }))
  await page.route('**/api/dev/demo/dataset/test-connections/runtime', route => route.fulfill({
    json: { code: 0, status: 0, data: [{ label: 'CRM 测试容器', value: 'runtime-1' }] },
  }))
  await page.route('**/api/dev/demo/dataset/test-connections/platform', route => route.fulfill({
    json: { code: 0, status: 0, data: [{ label: '分析数据库', value: 'warehouse' }] },
  }))
  await page.route('**/api/dev/demo/dataset/test-connections/platform/warehouse/environments', route => route.fulfill({
    json: { code: 0, status: 0, data: [{ label: '开发环境', value: 'dev' }] },
  }))

  await page.route('**/api/dev/demo/dataset/infer-schema', async (route) => {
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
              semanticRole: null,
            },
            {
              name: 'inferred_revenue',
              title: 'Inferred Revenue',
              dataType: 'decimal',
              semanticRole: null,
            },
          ],
          warnings: ['JDBC JSON type fallback to string'],
        },
      }),
    })
  })

  await page.route('**/api/dev/demo/dataset/test-connection', async (route) => {
    connectionTestRequests.push(route.request().postDataJSON())
    const failed = connectionTestRequests.length <= connectionTestFailureCount
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        failed
          ? {
              code: -1,
              status: -1,
              msg: 'datasource-unreachable: connection refused',
              data: null,
            }
          : { code: 0, status: 0, msg: '', data: null }
      ),
    })
  })

  await page.route('**/api/dev/demo/dataset/preview', async (route) => {
    const request = route.request().postDataJSON()
    previewRequests.push(request)
    const pageNo = request.page?.pageNo || 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: {
          resolvedSchema: {
            fields: [
              {
                name: 'order_date',
                title: 'Order Date',
                dataType: 'date',
              },
              {
                name: 'total_amount',
                title: 'Total Amount',
                dataType: 'number',
              },
            ],
          },
          rows:
            pageNo === 1
              ? [{ order_date: '2026-07-04', total_amount: 1280.5 }]
              : [{ order_date: '2026-07-05', total_amount: null }],
          pageInfo: { pageNo, pageSize: 100, total: 101 },
          diagnostics: {
            matchedSqlDialect: 'mysql',
            messages: ['SQL result columns drift from declared dataset schema.'],
            attributes: { datasource: 'reporting-main' },
          },
          executionMeta: {
            datasource: 'reporting-main',
            dialect: 'mysql',
          },
        },
      }),
    })
  })

  await page.route(/\/api\/dev\/demo\/dataset(?:\?[^#]*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: {
          items: datasetItems,
          total: datasetItems.length,
        },
      }),
    })
  })

  await page.route(
    /\/api\/dev\/demo\/dataset\/(demo\.(?:sales|archive))(?:\?commit=true)?$/,
    async (route) => {
      const request = route.request()
      const requestUrl = new URL(request.url())
      const datasetName = decodeURIComponent(requestUrl.pathname.split('/').pop())
      const method = request.method()
      if (method === 'PUT' && requestUrl.searchParams.get('commit') === 'true') {
        const payload = request.postDataJSON()
        lifecycleRequests.push({ method, datasetName, payload })
        const item = datasetItems.find((candidate) => candidate.name === datasetName)
        if (item) {
          Object.assign(item, payload)
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 0, status: 0, msg: '', data: item }),
        })
        return
      }
      if (method === 'DELETE') {
        lifecycleRequests.push({ method, datasetName })
        const index = datasetItems.findIndex(
          (candidate) => candidate.name === datasetName
        )
        const deleted = index >= 0 ? datasetItems.splice(index, 1)[0] : null
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 0, status: 0, msg: '', data: deleted }),
        })
        return
      }
      await route.fallback()
    }
  )

  return {
    saveRequests,
    devConfigSaveRequests,
    inferSchemaRequests,
    connectionTestRequests,
    previewRequests,
    lifecycleRequests,
  }
}

async function confirmCrudAction(page, button) {
  await button.click()
  const confirmButton = page
    .getByRole('dialog')
    .getByRole('button', { name: /确认|确定/ })
    .last()
  await page.waitForTimeout(100)
  if (await confirmButton.isVisible()) {
    await confirmButton.click()
  }
}

test('dataset editor harness renders the real page and guards route leave when dirty', async ({
  page,
}, testInfo) => {
  await mockDatasetEditorApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  await expect(
    page.getByRole('heading', { name: '编辑数据集「Sales Overview」', exact: true })
  ).toBeVisible()
  await expect(page.getByText('执行并推导字段', { exact: true })).toBeVisible()
  const inferAction = page.getByRole('button', { name: '执行并推导字段', exact: true })
  await expect(inferAction).toHaveClass(/Button--link/)
  const inferBounds = await inferAction.boundingBox()
  const cancelBounds = await page.getByRole('button', { name: '取消', exact: true }).boundingBox()
  expect(inferBounds.x).toBeLessThan(cancelBounds.x)
  await expect(page.getByText('参数定义', { exact: true })).toBeVisible()
  await expect(page.getByText('测试夹具', { exact: true })).toHaveCount(0)
  await expect(page.getByText('输出字段 Schema', { exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: '基础 SQL' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'mysql' })).toBeVisible()
  await expect(page.locator('textarea[aria-label^="编辑器内容"]').first()).toHaveValue(
    /\$\{startDate\}/
  )
  await expect(page.getByText('方言 SQL 覆盖', { exact: true })).toHaveCount(0)
  await expect(page.getByText('工作流', { exact: true })).toHaveCount(0)
  await expect(page.getByText('发布检查', { exact: true })).toHaveCount(0)
  await expect(page.getByText('资产引用图', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Parameter Hints', { exact: true })).toHaveCount(0)
  await expect(page).toHaveURL(/\/dev\/demo\/dataset\/demo\.sales$/)

  await page.screenshot({
    path: testInfo.outputPath('statistics-dataset-editor.png'),
    fullPage: true,
  })

  await page.evaluate(() => {
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.setSqlValue(
      'select 1 as dirty_dataset_editor'
    )
  })

  await expect(page.getByText('未保存', { exact: true })).toBeVisible()

  await page.evaluate(() => {
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.publishSavedEvent()
  })
  await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)

  await page.evaluate(() => {
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.setSqlValue(
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
  await expect(page).toHaveURL(/\/dev\/demo\/dataset\/demo\.sales$/)

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

test('dataset access tab shows current grants and saves scope bindings', async ({ page }, testInfo) => {
  const { saveRequests } = await mockDatasetEditorApis(page)
  await page.route('**/api/dev/demo/dataset/demo.sales/editor', route => {
    const layout = buildDatasetEditorLayout()
    layout.dataset.parameters.push({ name: 'departmentId', title: '部门', type: 'string', operator: 'eq' })
    layout.dataset.queryDefinition.sql += ' and department_id = ${departmentId}'
    layout.dataset.permissionDefinition = { scopeBindings: { departmentId: 'departmentId' } }
    return route.fulfill({ json: { code: 0, status: 0, data: layout } })
  })
  await page.route('**/api/auth/authorities**', route => route.fulfill({ json: {
    code: 0, status: 0, data: { 'statisticsReporting.runtime.dataset.DEMO.SALES.execute': {} },
  } }))
  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.getByText('访问与数据范围', { exact: true }).click()
  await expect(page.getByText('已授权', { exact: true })).toBeVisible()
  await expect(page.getByText('未授权', { exact: true })).toBeVisible()
  await expect(page.getByText('departmentId', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('当前部门', { exact: true }).last()).toBeVisible()
  await page.getByText('当前部门', { exact: true }).last().click()
  await page.getByText('当前组织', { exact: true }).last().click()
  await expect(page.getByText('未保存', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '保存' })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('dataset-access-scope.png'), fullPage: true })
  await page.getByRole('button', { name: '保存' }).click()
  await expect.poll(() => saveRequests.length).toBe(1)
  expect(saveRequests[0].permissionDefinition.scopeBindings).toEqual({ departmentId: 'organizationId' })
})

test('dataset metadata rows and query sections have distinct spacing', async ({ page }) => {
  await mockDatasetEditorApis(page)
  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready)

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    const spacing = await page.evaluate(() => {
      const row = (field) => document
        .querySelector(`[data-amis-name="${field}"]`)
        .closest('.cxd-Grid')
        .getBoundingClientRect()
      const identity = row('dataset.title')
      const description = row('dataset.description')
      const query = row('dataset.queryDefinition')
      return {
        metadataRows: description.top - identity.bottom,
        querySection: query.top - description.bottom,
      }
    })
    expect(spacing.metadataRows).toBeGreaterThanOrEqual(16)
    expect(spacing.querySection).toBeGreaterThanOrEqual(32)
  }
})

test('dataset metadata tables remain usable on a narrow viewport', async ({ page }) => {
  await mockDatasetEditorApis(page)
  await page.setViewportSize({ width: 390, height: 844 })

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  const metadataTabs = page.locator('.statistics-dataset-metadata-tabs')
  await expect(metadataTabs).toBeVisible()
  const viewportMetrics = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }))
  expect(viewportMetrics.documentWidth).toBeLessThanOrEqual(viewportMetrics.viewportWidth)

  for (const tabName of ['参数定义', '输出字段 Schema']) {
    await page.getByText(tabName, { exact: true }).click()
    const table = metadataTabs.locator('.cxd-Table:visible').first()
    await expect(table).toBeVisible()
    const tableMetrics = await table.evaluate((element) => {
      const scrollContainer = element.querySelector('.cxd-Table-content') || element
      return {
        clientWidth: scrollContainer.clientWidth,
        scrollWidth: scrollContainer.scrollWidth,
        overflowX: getComputedStyle(scrollContainer).overflowX,
      }
    })
    expect(tableMetrics.clientWidth).toBeLessThanOrEqual(390)
    expect(tableMetrics.scrollWidth).toBeGreaterThan(tableMetrics.clientWidth)
    expect(['auto', 'scroll']).toContain(tableMetrics.overflowX)
  }
})

test('dataset editor harness saves edited sql through the real save button flow', async ({
  page,
}) => {
  const { saveRequests, devConfigSaveRequests } = await mockDatasetEditorApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  await page.evaluate(() => {
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.setSqlValue(
      'select 3 as saved_from_real_button'
    )
  })

  await expect(page.getByText('未保存', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '保存' }).click()

  await expect.poll(() => saveRequests.length).toBe(1)
  expect(devConfigSaveRequests).toHaveLength(0)
  expect(saveRequests[0].queryDefinition.sql).toBe('select 3 as saved_from_real_button')
  expect(saveRequests[0].tags).toEqual([])
  const savedPayload = JSON.stringify(saveRequests[0])
  expect(savedPayload).not.toContain('activeDialectName')
  expect(savedPayload).not.toContain('jdbcConnection')
  expect(savedPayload).not.toContain('fixture')
  expect(savedPayload).not.toContain('testDatasourceName')
  expect(savedPayload).not.toContain('testParameters')
  await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)
})

test('dataset editor tracks non-SQL metadata changes and supports shortcut save', async ({
  page,
}) => {
  const { saveRequests } = await mockDatasetEditorApis(page, { saveDelayMs: 150 })

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  const saveButton = page.getByRole('button', { name: '保存' })
  await expect(saveButton).toHaveCount(0)
  await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)
  await page.locator('input[value="Sales Overview"]').fill('Updated Sales Overview')
  await expect(saveButton).toBeVisible()
  await expect(page.getByText('未保存', { exact: true })).toBeVisible()

  await Promise.all([page.keyboard.press('Control+s'), page.keyboard.press('Control+s')])

  await expect.poll(() => saveRequests.length).toBe(1)
  await page.waitForTimeout(200)
  expect(saveRequests).toHaveLength(1)
  expect(saveRequests[0].title).toBe('Updated Sales Overview')
  await expect(saveButton).toHaveCount(0)
  await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)
})

test('dataset editor cancel confirms non-SQL unsaved changes', async ({ page }) => {
  await mockDatasetEditorApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  await page.locator('input[value="Sales Overview"]').fill('Unsaved Dataset Title')
  await expect(page.getByText('未保存', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '取消', exact: true }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('未保存的数据将会丢失')
  await dialog.getByRole('button', { name: '取消', exact: true }).click()

  await expect(page).toHaveURL(/\/dev\/demo\/dataset\/demo\.sales$/)
  await expect(page.getByText('未保存', { exact: true })).toBeVisible()
})

test('dataset preview parameters save independently from the connection dialog', async ({
  page,
}) => {
  const { saveRequests, devConfigSaveRequests } = await mockDatasetEditorApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  await page.getByRole('button', { name: '预览参数', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '预览参数' })).toBeVisible()
  await expect(page.getByRole('dialog').getByText('预览连接', { exact: true })).toHaveCount(0)
  await page.getByLabel('预览参数值 1').fill('2026-02-01')
  await page.getByRole('button', { name: '保存参数' }).click()

  await expect.poll(() => devConfigSaveRequests.length).toBe(1)
  expect(saveRequests).toHaveLength(0)
  expect(devConfigSaveRequests[0].datasource).toBe('reporting-main')
  expect(devConfigSaveRequests[0].testConnection).toEqual({ kind: 'application' })
  expect(devConfigSaveRequests[0].parameters.startDate).toBe('2026-02-01')
  await page.getByLabel('配置开发态数据源').click()
  await expect(page.getByRole('dialog').getByLabel('预览参数值 1')).toHaveCount(0)
  await page.getByRole('dialog').getByRole('button', { name: '保存配置', exact: true }).click()
  await expect.poll(() => devConfigSaveRequests.length).toBe(2)
  expect(devConfigSaveRequests[1].parameters.startDate).toBe('2026-02-01')
})

test('dataset editor surfaces a dev config load failure and still allows recovery', async ({
  page,
}) => {
  await mockDatasetEditorApis(page, {
    devConfigLoadFailure: '开发态配置存储暂时不可用',
  })

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  await expect(page.getByText('开发态配置存储暂时不可用')).toBeVisible()
  await page.getByLabel('配置开发态数据源').click()
  await expect(page.getByRole('dialog', { name: '开发态数据源配置' })).toContainText(
    '开发态配置存储暂时不可用'
  )
})

test('dataset editor harness saves field advanced properties through schema editor', async ({
  page,
}) => {
  const { saveRequests } = await mockDatasetEditorApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  await page.locator('input[value="Sales Overview"]').fill('Sales Overview Updated')
  await page.getByRole('button', { name: '保存' }).click()

  await expect.poll(() => saveRequests.length).toBe(1)
  expect(saveRequests[0].schema.fields[0].sortable).toBe(true)
  expect(saveRequests[0].schema.fields[0].filterable).toBe(true)
  expect(saveRequests[0].schema.fields[0].exportable).toBe(false)
  expect(saveRequests[0].schema.fields[0].visibleByDefault).toBe(false)
})

test('dataset editor harness infers schema fields from the real action flow', async ({
  page,
}) => {
  const { inferSchemaRequests } = await mockDatasetEditorApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  await page.getByRole('tab', { name: 'mysql' }).click()
  await page.getByRole('button', { name: '执行并推导字段' }).click()

  await expect.poll(() => inferSchemaRequests.length).toBe(1)
  expect(inferSchemaRequests[0].datasource).toBe('reporting-main')
  expect(inferSchemaRequests[0].sql).toContain('sales_order_fact')
  expect(inferSchemaRequests[0].dialectName).toBe('mysql')
  expect(inferSchemaRequests[0].dialects).toEqual([
    {
      dialectName: 'mysql',
      sql: 'select * from sales_order_fact where order_time >= ${startDate}',
    },
  ])
  expect(inferSchemaRequests[0].parameterDefinitions[0].name).toBe('startDate')
  await page.getByText('输出字段 Schema', { exact: true }).click()
  await expect(page.locator('input[value="inferred_order_date"]:visible')).toBeVisible()
  await expect(page.locator('input[value="inferred_revenue"]:visible')).toBeVisible()
  await expect(page.getByText(/JDBC JSON type fallback to string/)).toBeVisible()
})

test('dataset editor tests the current dev connection without changing metadata', async ({
  page,
}) => {
  const { saveRequests, connectionTestRequests } = await mockDatasetEditorApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  await page.getByLabel('配置开发态数据源').click()
  await page.getByRole('button', { name: '测试连接' }).click()

  await expect.poll(() => connectionTestRequests.length).toBe(1)
  expect(connectionTestRequests[0].datasource).toBe('reporting-main')
  expect(connectionTestRequests[0].testConnection).toEqual({ kind: 'application' })
  expect(saveRequests).toHaveLength(0)
  await expect(page.getByText('连接成功', { exact: true })).toBeVisible()
})

test('dataset editor can retry after a connection test failure', async ({ page }) => {
  const { connectionTestRequests } = await mockDatasetEditorApis(page, {
    connectionTestFailureCount: 1,
  })

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  await page.getByLabel('配置开发态数据源').click()
  await page.getByRole('button', { name: '测试连接' }).click()

  await expect(page.getByText('datasource-unreachable: connection refused')).toBeVisible()
  await page.getByRole('button', { name: '测试连接' }).click()

  await expect.poll(() => connectionTestRequests.length).toBe(2)
  await expect(page.getByText('连接成功', { exact: true })).toBeVisible()
  await expect(page.getByText('datasource-unreachable: connection refused')).toHaveCount(
    0
  )
})

test('dataset preview renders schema, rows, diagnostics and pagination', async ({
  page,
}) => {
  const { previewRequests } = await mockDatasetEditorApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })

  await page.getByRole('tab', { name: 'mysql' }).click()
  await page.getByRole('button', { name: '预览', exact: true }).click()

  await expect(page.getByText('Order Date', { exact: true })).toBeVisible()
  await expect(page.getByText('order_date · date', { exact: true })).toBeVisible()
  await expect(page.getByText('2026-07-04', { exact: true })).toBeVisible()
  await expect(page.getByText('1280.5', { exact: true })).toBeVisible()
  await expect(page.getByText('数据源：reporting-main', { exact: true })).toBeVisible()
  await expect(page.getByText('SQL：mysql', { exact: true })).toBeVisible()
  await expect(page.getByText(/SQL result columns drift/)).toHaveCount(0)
  await expect(page.getByText('共 101 条，第 1 / 2 页', { exact: true })).toBeVisible()

  expect(previewRequests[0].dialectName).toBe('mysql')
  expect(previewRequests[0].executionContext.datasource).toBe('reporting-main')
  expect(previewRequests[0].dataset.queryDefinition.sql).toContain('${startDate}')
  expect(previewRequests[0].dataset.queryDefinition.dialects[0].sql).toContain('${startDate}')
  expect(previewRequests[0].dataset.tags).toEqual([])
  expect(JSON.stringify(previewRequests[0])).not.toContain('jdbcConnection')
  expect(JSON.stringify(previewRequests[0])).not.toContain('activeDialectName')

  await page.getByLabel('下一页').click()
  await expect(page.getByText('2026-07-05', { exact: true })).toBeVisible()
  await expect(page.getByText('NULL', { exact: true })).toBeVisible()
  expect(previewRequests[1].page.pageNo).toBe(2)
})

test('dataset list enables, disables and deletes definitions through lifecycle APIs', async ({
  page,
}) => {
  const { lifecycleRequests } = await mockDatasetEditorApis(page)
  page.on('dialog', (dialog) => dialog.accept())

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })
  await page.evaluate(() => {
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.openDatasetList()
  })

  await expect(page).toHaveURL(/\/dev\/demo\/dataset(?:\?.*)?$/)
  await expect(page.getByRole('row').filter({ hasText: 'demo.sales' }).getByText('启用', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/<span/)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '数据集', exact: true })).toBeVisible()

  const salesRow = page.getByRole('row').filter({ hasText: 'demo.sales' })
  await confirmCrudAction(page, salesRow.getByRole('button', { name: '禁用' }))
  await expect.poll(() => lifecycleRequests.length).toBe(1)
  expect(lifecycleRequests[0]).toMatchObject({
    method: 'PUT',
    datasetName: 'demo.sales',
    payload: {
      name: 'demo.sales',
      isEnabled: false,
    },
  })
  expect(JSON.stringify(lifecycleRequests[0].payload)).not.toContain('jdbcConnection')

  const archiveRow = page.getByRole('row').filter({ hasText: 'demo.archive' })
  await confirmCrudAction(page, archiveRow.getByRole('button', { name: '启用' }))
  await expect.poll(() => lifecycleRequests.length).toBe(2)
  expect(lifecycleRequests[1]).toMatchObject({
    method: 'PUT',
    datasetName: 'demo.archive',
    payload: {
      name: 'demo.archive',
      isEnabled: true,
    },
  })

  await confirmCrudAction(page, archiveRow.getByRole('button', { name: '删除' }))
  await expect.poll(() => lifecycleRequests.length).toBe(3)
  expect(lifecycleRequests[2]).toEqual({
    method: 'DELETE',
    datasetName: 'demo.archive',
  })
  await expect(page.getByRole('row').filter({ hasText: 'demo.archive' })).toHaveCount(0)
})


test('default datasource saves a platform connection reference and can reset to application selection', async ({ page }) => {
  const { devConfigSaveRequests } = await mockDatasetEditorApis(page, { defaultDatasource: true })
  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true)
  await page.getByLabel('配置开发态数据源').click()
  let dialog = page.getByRole('dialog', { name: '开发态数据源配置' })
  await dialog.getByText('应用绑定连接', { exact: true }).click()
  await page.getByRole('option', { name: '平台保存连接', exact: true }).click()
  const connection = dialog.locator('.cxd-Form-item').filter({ has: page.locator('label').filter({ hasText: /平台连接/ }) })
  await connection.locator('.cxd-Select').click()
  await page.getByRole('option', { name: '分析数据库', exact: true }).click()
  const environment = dialog.locator('.cxd-Form-item').filter({ has: page.locator('label').filter({ hasText: /连接环境/ }) })
  await environment.locator('.cxd-Select').click()
  await page.getByRole('option', { name: '开发环境', exact: true }).click()
  await dialog.getByRole('button', { name: '保存配置', exact: true }).click()
  await expect.poll(() => devConfigSaveRequests.length).toBe(1)
  expect(devConfigSaveRequests[0].testConnection).toMatchObject({
    kind: 'platform', platformDataSourceName: 'warehouse', envName: 'dev',
  })
  await page.getByLabel('配置开发态数据源').click()
  dialog = page.getByRole('dialog', { name: '开发态数据源配置' })
  await dialog.getByText('平台保存连接', { exact: true }).click()
  await page.getByRole('option', { name: '应用运行容器', exact: true }).click()
  await dialog.getByText('应用运行容器', { exact: true }).click()
  await page.getByRole('option', { name: '应用绑定连接', exact: true }).click()
  await dialog.getByRole('button', { name: '保存配置', exact: true }).click()
  await expect.poll(() => devConfigSaveRequests.length).toBe(2)
  expect(devConfigSaveRequests[1].testConnection.kind).toBe('application')
})


test('dataset editor shows model table structure through its datasource service', async ({ page }) => {
  await mockDatasetEditorApis(page)
  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true)
  await page.getByRole('button', { name: '查看表结构', exact: true }).click()
  await expect(page.getByRole('button', { name: 'sales_order 订单', exact: true })).toBeVisible()
  await expect(page.getByText('order_id', { exact: true })).toBeVisible()
  await page.getByPlaceholder('搜索表名或标题').fill('不存在的表')
  await expect(page.getByText('没有匹配的数据表', { exact: true })).toBeVisible()
  await page.getByPlaceholder('搜索表名或标题').fill('订单')
  await expect(page.getByText('order_id', { exact: true })).toBeVisible()
})

test('table browser retries a failed load and switches the selected table', async ({
  page,
}) => {
  await mockDatasetEditorApis(page)
  let attempts = 0
  await page.route('**/api/dev/demo/dataset/datasource-tables', (route) => {
    attempts += 1
    return route.fulfill({
      json: attempts === 1
        ? { code: 1, status: 1, msg: '表结构暂时不可用' }
        : {
          code: 0,
          status: 0,
          data: {
            items: [
              {
                name: 'sales_order',
                title: '订单',
                source: 'model',
                columns: [{ name: 'order_id', dataType: 'integer' }],
              },
              {
                name: 'customer',
                title: '客户',
                source: 'database',
                columns: [{ name: 'customer_name', title: '姓名', dataType: 'string' }],
              },
            ],
            warnings: [],
          },
        },
    })
  })
  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.getByRole('button', { name: '查看表结构', exact: true }).click()
  await expect(page.getByText('表结构暂时不可用', { exact: false })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: '重试', exact: true }).click()
  await page.getByRole('button', { name: 'customer 客户', exact: true }).click()
  await expect(
    page.getByLabel('字段结构').getByText('customer_name', { exact: true })
  ).toBeVisible()
  await expect(
    page.getByLabel('字段结构').getByText('order_id', { exact: true })
  ).toHaveCount(0)
})
