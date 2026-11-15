const fs = require('node:fs')
const path = require('node:path')
const { test, expect } = require('@playwright/test')

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..')
const businessModelPageSchema = readJson(
  'core/ouroboros-business-model/ouroboros-business-model-dev/src/main/resources/META-INF/ouroboros/ui-schema/dev/{appName}/business-model/{fullName}.json'
)
const dashboardEditorSchema = fs.readFileSync(
  path.join(
    repoRoot,
    'core/ouroboros-business-model/ouroboros-business-model-default/src/main/resources/META-INF/editor-schema-templates/dashboard/index.json.ftl'
  ),
  'utf8'
)

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'))
}

function buildDashboardModel(widgets = []) {
  return {
    appName: 'demo',
    namespace: 'demo',
    name: 'sales-dashboard',
    fullName: 'demo.sales-dashboard',
    title: 'Sales Dashboard',
    modelType: 'dashboard',
    version: '1.0',
    isEnabled: true,
    layout: {
      cols: 24,
      rowHeight: 10,
    },
    widgets,
    migration: {
      loadingPolicy: 'business-model-first',
      legacyReadOnly: true,
    },
    globalFilterBinding: {
      source: 'reactive-data-domain',
      widgetFieldMappings: [],
    },
  }
}

function buildReportViewProjection(viewName) {
  const value = viewName === 'demo.sales-metric' ? 128 : 64
  return {
    projection: {
      displayType: 'metric-card',
      metricFields: ['total_amount'],
      columns: [{ name: 'total_amount', title: '销售额' }],
      rows: [{ total_amount: value }],
      cards: [{ field: 'total_amount', title: '销售额', value }],
      displayConfig: {
        titleText: viewName,
      },
    },
  }
}

async function mockDashboardEditorApis(page) {
  const saveRequests = []
  let currentDashboard = buildDashboardModel()
  const schemaRequests = []
  const reportViewOptionsRequests = []
  const reportViewExecuteRequests = []

  await page.route('**/api/ui-schema**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const schemaPath = requestUrl.searchParams.get('path')
    schemaRequests.push({
      path: schemaPath,
      modelType: requestUrl.searchParams.get('modelType'),
      appName: requestUrl.searchParams.get('appName'),
      fullName: requestUrl.searchParams.get('fullName'),
    })

    let payload = null
    if (schemaPath === '/dev/{appName}/business-model/{fullName}') {
      payload = businessModelPageSchema
    } else if (schemaPath === '/dev/{appName}/business-model/editor') {
      payload = JSON.parse(
        dashboardEditorSchema
          .replace(/^<#noparse>\s*/, '')
          .replace(/\s*<\/#noparse>\s*$/, '')
      )
    }

    await route.fulfill({
      status: payload ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify({
        code: payload ? 0 : 404,
        status: payload ? 0 : 404,
        msg: payload ? '' : 'Schema Not Found',
        data: payload,
      }),
    })
  })

  await page.route(
    '**/api/dev/demo/business-model/demo.sales-dashboard',
    async (route) => {
      if (route.request().method() === 'PUT') {
        const payload = route.request().postDataJSON()
        saveRequests.push(payload)
        currentDashboard = {
          ...currentDashboard,
          ...payload,
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          status: 0,
          msg: '',
          data: currentDashboard,
        }),
      })
    }
  )

  await page.route(
    '**/api/dev/demo/statistics-reporting/report-views/options**',
    async (route) => {
      reportViewOptionsRequests.push(new URL(route.request().url()).pathname)
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
                label: 'Sales Metric',
                value: 'demo.sales-metric',
                datasetName: 'demo.sales',
                displayType: 'metric-card',
                status: 'READY',
              },
              {
                label: 'Sales By Region',
                value: 'demo.sales-by-region',
                datasetName: 'demo.sales',
                displayType: 'bar',
                status: 'READY',
              },
            ],
          },
        }),
      })
    }
  )

  await page.route(
    '**/api/runtime/statistics-reporting/report-views/*/execute',
    async (route) => {
      const match = route.request().url().match(/report-views\/([^/]+)\/execute/)
      reportViewExecuteRequests.push(decodeURIComponent(match?.[1] || 'demo.sales-metric'))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          status: 0,
          msg: '',
          data: buildReportViewProjection(decodeURIComponent(match?.[1] || 'demo.sales-metric')),
        }),
      })
    }
  )

  return {
    saveRequests,
    schemaRequests,
    reportViewOptionsRequests,
    reportViewExecuteRequests,
    getCurrentDashboard: () => currentDashboard,
  }
}

async function openDashboardBusinessModelEditor(page) {
  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(() => {
    return Boolean(
      window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__?.openDashboardBusinessModelEditor
    )
  })
  await page.evaluate(() => {
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.openDashboardBusinessModelEditor()
  })
}

async function seedDashboardWidgetThroughRealDrop(page) {
  const hoverArea = await page.locator('.dashboard-wrapper .hover-area').boundingBox()
  expect(hoverArea).not.toBeNull()
  await page.mouse.move(hoverArea.x + hoverArea.width / 2, hoverArea.y + hoverArea.height / 2)
  await page.getByRole('button', { name: '开始编辑' }).click({ force: true })
  await page.getByRole('button', { name: '选择栏目' }).click()
  await expect(page.getByText('报表视图', { exact: true }).first()).toBeVisible()

  const source = page.locator('.widget-definition-item').first()
  const target = page.locator('.dashboard-grid').first()
  await source.dragTo(target, {
    targetPosition: {
      x: 160,
      y: 120,
    },
  })

  await page.getByRole('button', { name: '取消' }).last().click()
  await expect(page.getByText('组件列表', { exact: true })).toHaveCount(0)
  await expect(page.locator('.dashboard-grid [data-widget-name="report-view"]')).toHaveCount(1)
}

async function chooseReportViewInWidgetConfig(page) {
  const canvasWidget = page.locator('.dashboard-grid [data-widget-name="report-view"]')
  await canvasWidget.hover()
  await page.locator('.dashboard-grid .edit-toolbar button').first().click({ force: true })
  await expect(page.getByText('小组件配置', { exact: true })).toBeVisible()
  const dialog = page.locator('[role="dialog"]').last()
  await dialog.locator('[role="combobox"]').last().click()
  await page.getByText('Sales Metric', { exact: true }).click()
  await dialog.getByRole('textbox').last().fill('Sales Metric Widget')
  await dialog.getByRole('button', { name: /确定|确认/ }).last().click()
}

async function saveDashboard(page) {
  await page.getByRole('button', { name: '确定' }).click()
  await page.getByRole('button', { name: /保存$/ }).click()
}

test('dashboard business-model editor selects report-view and saves canonical widget shape', async ({
  page,
}) => {
  const {
    saveRequests,
    schemaRequests,
    reportViewOptionsRequests,
    reportViewExecuteRequests,
    getCurrentDashboard,
  } = await mockDashboardEditorApis(page)

  await openDashboardBusinessModelEditor(page)

  await expect(page).toHaveURL(/\/dev\/demo\/business-model\/demo\.sales-dashboard$/)
  await expect(page.getByText('Dashboard 编辑面', { exact: true })).toBeVisible()
  expect(
    schemaRequests.some(
      (request) =>
        request.path === '/dev/{appName}/business-model/editor' &&
        request.modelType === 'dashboard' &&
        request.appName === 'demo' &&
        request.fullName === 'demo.sales-dashboard'
    )
  ).toBe(true)

  await seedDashboardWidgetThroughRealDrop(page)
  await chooseReportViewInWidgetConfig(page)
  await expect.poll(() => reportViewOptionsRequests.length).toBeGreaterThan(0)
  await expect.poll(() => reportViewExecuteRequests).toContain('demo.sales-metric')
  await expect(page.getByText('Sales Metric Widget', { exact: true })).toBeVisible()
  await expect(page.getByText('128', { exact: true })).toBeVisible()

  await saveDashboard(page)
  await expect.poll(() => saveRequests.length).toBe(1)

  const savedWidget = saveRequests[0].widgets[0]
  expect(savedWidget.widgetName).toBe('report-view')
  expect(savedWidget.viewName).toBe('demo.sales-metric')
  expect(savedWidget.config.viewName).toBe('demo.sales-metric')
  expect(savedWidget.config.title).toBe('Sales Metric Widget')
  expect(savedWidget.config.schema).toEqual({
    type: 'report-view-runtime',
    viewName: '#{viewName}',
  })
  expect(savedWidget.config.appName).toBeUndefined()
  expect(savedWidget.config.fullName).toBeUndefined()
  expect(savedWidget.config.modelType).toBeUndefined()

  await openDashboardBusinessModelEditor(page)

  await expect(page.locator('[data-widget-name="report-view"]')).toHaveCount(1)
  await expect(page.getByText('Sales Metric Widget', { exact: true })).toBeVisible()
  expect(getCurrentDashboard().widgets[0].viewName).toBe('demo.sales-metric')
})
