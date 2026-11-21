const fs = require('node:fs')
const path = require('node:path')
const { test, expect } = require('@playwright/test')

const { waitForEChartsSettled } = require('./helpers/echarts')
const { installBrowserErrorChecks } = require('./helpers/browserErrors')

installBrowserErrorChecks(test)

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..')

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'))
}

function readJsonTemplate(relativePath) {
  const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8').trim()
  return JSON.parse(source.replace(/^<#noparse>\s*/, '').replace(/\s*<\/#noparse>$/, ''))
}

const businessModelPageSchema = readJson(
  'core/ouroboros-business-model/ouroboros-business-model-dev/src/main/metadata/dev/{appName}/business-model/{fullName}.ui-schema.json'
)
const datasetEditorSchema = readJson(
  'core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/resources/META-INF/ouroboros/ui-schema/dev/{appName}/dataset/{datasetName}.json'
)
const datasetListSchema = readJson(
  'core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/resources/META-INF/ouroboros/ui-schema/dev/{appName}/dataset.json'
)
const dashboardEditorSchema = readJsonTemplate(
  'core/ouroboros-business-model/ouroboros-business-model-default/src/main/resources/META-INF/editor-schema-templates/dashboard/index.json.ftl'
)

function buildDashboardDefinition() {
  return {
    modelType: 'dashboard',
    namespace: 'demo',
    name: 'sales-dashboard',
    fullName: 'demo.sales-dashboard',
    title: 'Sales Overview',
    description: 'Sales dashboard',
    isEnabled: true,
    layout: { cols: 24, rowHeight: 30, draggable: true, resizable: true },
    widgets: [],
  }
}

async function mockDashboardEditorApis(page) {
  let persistedDashboard = buildDashboardDefinition()
  const saveRequests = []
  const chartExecutionRequests = []
  const chartPreviewRequests = []

  const handleSchemaRequest = async (route) => {
    const schemaPath = new URL(route.request().url()).searchParams.get('path')
    let payload
    if (schemaPath === '/dev/{appName}/business-model/{fullName}') {
      payload = businessModelPageSchema.schema
    } else if (schemaPath === '/dev/{appName}/business-model/editor') {
      payload = dashboardEditorSchema
    } else if (schemaPath === '/dev/{appName}/dataset/{datasetName}') {
      payload = datasetEditorSchema
    } else if (schemaPath === '/dev/{appName}/dataset') {
      payload = datasetListSchema
    } else if (schemaPath === '/playwright/statistics-reporting/leave-target') {
      payload = { type: 'page', body: { type: 'tpl', tpl: '<h1>Leave Target</h1>' } }
    }

    if (!payload) {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, status: 0, msg: '', data: payload }),
    })
  }
  await page.route('**/api/ui-schema**', handleSchemaRequest)
  await page.route('**/api/amis-schema**', handleSchemaRequest)

  await page.route(
    '**/api/dev/demo/business-model/demo.sales-dashboard**',
    async (route) => {
      if (route.request().method() === 'PUT') {
        const requestData = route.request().postDataJSON()
        saveRequests.push(requestData)
        persistedDashboard = { ...persistedDashboard, ...requestData }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          status: 0,
          msg: '',
          data: {
            businessModel: persistedDashboard,
            appName: 'demo',
            validationSnapshot: {
              validationErrors: [],
              validationDiagnostics: [],
              validationSummary: '',
            },
          },
        }),
      })
    }
  )

  await page.route('**/api/dev/demo/chart/options', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: { items: [{ label: 'Sales By Region', value: 'demo.sales-by-region' }] },
      }),
    })
  })

  await page.route('**/api/runtime/statistics-reporting/charts/**', async (route) => {
    chartExecutionRequests.push(route.request().url())
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
            xAxis: { type: 'category', data: ['East', 'West'] },
            yAxis: { type: 'value' },
            series: [{ type: 'bar', data: [120, 80] }],
          },
        },
      }),
    })
  })

  await page.route('**/api/dev/demo/chart/**/preview', async (route) => {
    chartPreviewRequests.push(route.request().url())
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
            xAxis: { type: 'category', data: ['East', 'West'] },
            yAxis: { type: 'value' },
            series: [{ type: 'bar', data: [120, 80] }],
          },
        },
      }),
    })
  })

  await page.route('**/api/dev/demo/dataset/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: {
          dataset: { name: 'demo.sales', title: 'Sales Dataset', schema: { fields: [] } },
          datasourceOptions: [],
        },
      }),
    })
  })

  return { saveRequests, chartExecutionRequests, chartPreviewRequests }
}

test('dashboard business-model editor supports chart placement, configuration, persistence, and reopen', async ({
  page,
}, testInfo) => {
  const { saveRequests, chartExecutionRequests, chartPreviewRequests } =
    await mockDashboardEditorApis(page)

  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.ready === true
  })
  await page.evaluate(() => {
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.openDashboardBusinessModelEditor()
  })

  await expect(page).toHaveURL(/\/dev\/demo\/business-model\/demo\.sales-dashboard$/)
  const baseInfoCollapse = page.locator('.cxd-Collapse').first()
  await expect(page.getByText('仪表板标题', { exact: true })).not.toBeVisible()
  await expect(page.getByText('展开', { exact: true })).toBeVisible()
  await baseInfoCollapse.locator('.cxd-Collapse-header').click()
  await expect(baseInfoCollapse).toHaveClass(/is-active/)
  await expect(page.getByText('收起', { exact: true })).toBeVisible()
  await expect(page.getByText('仪表板标题', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '编辑布局' }).click()
  await page.getByRole('button', { name: '添加组件' }).click()
  await expect(page.getByText('添加组件', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('选择图表后显示数据', { exact: true })).toBeVisible()
  await expect(page.getByText('尚未选择图表', { exact: true })).toHaveCount(0)
  expect(chartExecutionRequests).toHaveLength(0)
  expect(chartPreviewRequests).toHaveLength(0)

  const chartDefinition = page
    .locator('.widget-definition-item')
    .filter({ hasText: '图表' })
  await expect(chartDefinition).toBeVisible()
  await chartDefinition.dragTo(page.locator('.dashboard-grid').first())
  await page.getByRole('dialog').getByRole('button', { name: '取消' }).click()

  const chartWidget = page.locator('[data-widget-name="chart"]').first()
  await expect(chartWidget).toBeVisible()
  await expect(
    chartWidget.getByText('选择图表后显示数据', { exact: true })
  ).toBeVisible()
  await expect(chartWidget.getByText('尚未选择图表', { exact: true })).toHaveCount(0)
  const widgetWrapper = chartWidget.locator('xpath=..')
  await page.mouse.move(0, 0)
  const widgetToolbar = widgetWrapper.locator('.edit-toolbar')
  await expect(widgetToolbar).toBeVisible()
  await expect(widgetToolbar).toHaveCSS('display', 'flex')
  await expect(widgetToolbar).toHaveCSS('position', 'absolute')
  await widgetWrapper.getByRole('button', { name: '配置组件', exact: true }).click()

  const configDialog = page.getByRole('dialog')
  await expect(configDialog.getByText('标题', { exact: true })).toHaveCount(1)
  await expect(configDialog.getByText('图表名称', { exact: true })).toBeVisible()
  await configDialog.getByRole('combobox').click()
  await page.getByText('Sales By Region', { exact: true }).last().click()
  await configDialog.getByRole('button', { name: '提交' }).click()
  await expect(page.getByText('Sales By Region', { exact: true })).toBeVisible()
  await expect.poll(() => chartPreviewRequests.length).toBeGreaterThanOrEqual(1)
  expect(chartPreviewRequests[0]).toContain('/api/dev/demo/chart/demo.sales-by-region/preview')
  expect(chartExecutionRequests).toHaveLength(0)

  await widgetWrapper.hover()
  const dragHandle = widgetWrapper.locator('.draggable')
  const handleBox = await dragHandle.boundingBox()
  if (!handleBox) {
    throw new Error('dashboard widget drag handle is not rendered')
  }
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2
  )
  await page.mouse.down()
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 120,
    handleBox.y + handleBox.height / 2 + 60
  )
  await page.mouse.up()

  await page.getByRole('button', { name: '完成布局', exact: true }).click()
  await page.getByRole('button', { name: /保存$/ }).click()
  await expect.poll(() => saveRequests.length).toBe(1)

  expect(saveRequests[0].modelType).toBe('dashboard')
  expect(saveRequests[0].widgets).toHaveLength(1)
  expect(saveRequests[0].widgets[0].widgetName).toBe('chart')
  expect(saveRequests[0].widgets[0].chartName).toBe('demo.sales-by-region')
  expect(saveRequests[0].widgets[0].config.chartName).toBeUndefined()
  expect(saveRequests[0].__dashboardCanvas).toBeUndefined()
  expect(saveRequests[0].layout).toMatchObject({ cols: 24, rowHeight: 30 })
  expect(saveRequests[0].widgets[0].position.x).toBeGreaterThan(0)

  await waitForEChartsSettled(page, {
    rootSelector: '[data-widget-name="chart"]',
    requireSeriesData: true,
  })
  await baseInfoCollapse.locator('.cxd-Collapse-header').click()
  await expect(baseInfoCollapse).not.toHaveClass(/is-active/)
  await expect(page.getByText('仪表板标题', { exact: true })).not.toBeVisible()

  await page.screenshot({
    path: testInfo.outputPath('statistics-dashboard-editor-saved.png'),
    fullPage: true,
  })

  await page.evaluate(() => {
    return window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.reopenDashboardBusinessModelEditor()
  })
  await expect(page.locator('[data-widget-name="chart"]')).toHaveCount(1)
  await expect.poll(() => chartPreviewRequests.length).toBeGreaterThanOrEqual(2)
  expect(chartExecutionRequests).toHaveLength(0)
  await expect(page.locator('[data-widget-name="chart"] canvas')).toBeVisible()
})
