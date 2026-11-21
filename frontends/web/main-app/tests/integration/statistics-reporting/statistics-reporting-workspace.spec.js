const fs = require('node:fs')
const path = require('node:path')
const { test, expect } = require('@playwright/test')
const { buildShellAppInfo, buildShellToken, buildShellUserInfo } = require('../../../../script-editor-intelligence-mock-server/fixtures/shellBootstrap')

const resources = path.resolve(__dirname, '../../../../../../core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/resources/META-INF/ouroboros')
const read = file => JSON.parse(fs.readFileSync(path.join(resources, file), 'utf8'))
const dataset = (name, title) => ({
  name, title, isEnabled: true, parameters: [],
  queryDefinition: { type: 'sql', datasource: 'default', sql: 'select 1 as id', dialects: [] },
  schema: { fields: [{ name: 'id', title: 'ID', dataType: 'integer', sortable: true }] },
})

async function mountWorkspace(page, { empty = false, fail = false } = {}) {
  const routes = ['dataset', 'dataset/add', 'dataset/{datasetName}', 'chart', 'chart/add', 'chart/{fullName}']
    .map(name => read('ui-model/dev/{appName}/' + name + '.ui-model.json'))
    .map(model => ({ ...model, config: { schemaId: model.path } }))
  const state = { empty, fail, created: null }
  const requests = []
  await page.addInitScript(token => localStorage.setItem('Ouroboros_token', JSON.stringify(token)), buildShellToken())
  await page.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    requests.push({ path: url.pathname, method: request.method(), data: request.postDataJSON() })
    let data = {}
    if (url.pathname === '/api/sys/web-app-info') data = { ...buildShellAppInfo(), routes, currentTheme: 'default', defaultTheme: 'default' }
    else if (url.pathname === '/api/sys/user/info') data = buildShellUserInfo()
    else if (url.pathname === '/api/ui-schema') {
      const schemaPath = url.searchParams.get('path')
      data = read('ui-schema/' + schemaPath.replace(/^\//, '') + '.json')
    } else if (url.pathname === '/api/authored-menu-tree' || url.pathname.endsWith('/dev-workspace-menu')) {
      data = { main: [{ name: 'analytics', title: '统计分析', type: 'group', children: [
        { name: 'datasets', title: '数据集', url: '/dev/crm/dataset' },
        { name: 'charts', title: '图表', url: '/dev/crm/chart' },
      ] }], secondary: [] }
    } else if (url.pathname === '/api/dev/crm/dataset' && request.method() === 'POST') {
      state.created = request.postDataJSON()
      data = state.created
    } else if (url.pathname === '/api/dev/crm/dataset') {
      if (state.fail) return route.fulfill({ json: { code: 1, status: 1, msg: '数据集读取失败' } })
      const keyword = (url.searchParams.get('keyword') || '').toLowerCase()
      data = state.empty ? [] : [dataset('sales.orders', '订单分析'), dataset('sales.customers', '客户分析')]
        .filter(item => (item.name + item.title).toLowerCase().includes(keyword))
    } else if (url.pathname.endsWith('/editor')) data = {
      dataset: state.created || dataset('sales.orders', '订单分析'),
      datasourceOptions: [{ label: '默认数据源', value: 'default' }], references: [],
    }
    else if (url.pathname.endsWith('/dev-config')) data = { parameters: {}, testConnection: { kind: 'application' } }
    else if (url.pathname.endsWith('/execution-policy')) data = { queryTimeoutSeconds: 30, maxPageSize: 1000, maxExportRows: 100000 }
    else if (url.pathname.endsWith('/datasources')) data = [{ label: '默认数据源', value: 'default' }]
    else if (url.pathname === '/api/dev/crm/chart' && request.method() === 'POST') data = state.createdChart = request.postDataJSON()
    else if (url.pathname === '/api/dev/crm/chart/sales.newTrend') data = state.createdChart
    else if (url.pathname.includes('/chart/field-options/')) data = [{ label: 'ID', value: 'id', semanticRole: 'metric', dataType: 'integer' }]
    else if (url.pathname === '/api/dev/crm/chart') data = [{ name: 'sales.trend', title: '销售趋势', type: 'chart', chartType: 'line', datasetName: 'sales.orders', isEnabled: true }]
    else if (url.pathname.endsWith('/options')) data = [{ label: '订单分析', value: 'sales.orders' }]
    else if (url.pathname === '/api/dev/crm/chart/sales.trend') data = { name: 'sales.trend', title: '销售趋势', type: 'chart', chartType: 'line', datasetName: 'sales.orders', params: { xField: 'id', yFields: ['id'] }, isEnabled: true }
    await route.fulfill({ json: { code: 0, status: 0, data, msg: '' } })
  })
  return { state, requests }
}

test('dataset search and edit preserve the selected application and definition', async ({ page }) => {
  await mountWorkspace(page)
  await page.goto('/dev/crm/dataset')
  await expect(page.getByText('订单分析', { exact: true })).toBeVisible()
  await page.getByPlaceholder('搜索名称或标题').fill('customers')
  await page.getByRole('button', { name: /搜索|查询/ }).click()
  await expect(page.getByText('客户分析', { exact: true })).toBeVisible()
  await expect(page.getByText('订单分析', { exact: true })).toHaveCount(0)
  await page.getByPlaceholder('搜索名称或标题').fill('ORDERS')
  await page.getByRole('button', { name: /搜索|查询/ }).click()
  await page.locator('tbody tr').filter({ hasText: 'sales.orders' }).getByRole('button', { name: '编辑', exact: true }).click()
  await expect(page).toHaveURL(/\/dev\/crm\/dataset\/sales.orders$/)
  await expect(page.getByRole('heading', { name: /订单分析/ })).toBeVisible()
})

test('dataset and chart navigation use the current editors', async ({ page }) => {
  await mountWorkspace(page)
  await page.goto('/dev/crm/dataset')
  await page.getByRole('button', { name: '图表', exact: true }).click()
  await expect(page).toHaveURL(/\/dev\/crm\/chart(?:\?.*)?$/)
  await page.locator('tbody tr').filter({ hasText: 'sales.trend' }).getByRole('button', { name: '编辑', exact: true }).click()
  await expect(page).toHaveURL(/\/dev\/crm\/chart\/sales.trend$/)
  await expect(page.getByRole('heading', { name: /编辑图表/ })).toBeVisible()
})

test('empty datasets keep creation available', async ({ page }) => {
  const { state } = await mountWorkspace(page, { empty: true })
  await page.goto('/dev/crm/dataset')
  await page.getByRole('button', { name: '新建数据集', exact: true }).click()
  await expect(page).toHaveURL(/\/dev\/crm\/dataset\/add$/)
  await page.getByPlaceholder('例如：sales.orders').fill('sales.newOrders')
  await page.getByPlaceholder('例如：订单分析数据集').fill('新订单分析')
  await page.getByRole('button', { name: '创建并编辑', exact: true }).click()
  await expect.poll(() => state.created?.queryDefinition?.datasource).toBe('default')
  await expect(page).toHaveURL(/\/dev\/crm\/dataset\/sales.newOrders$/)
})

test('dataset list can recover after a failed load', async ({ page }) => {
  const { state } = await mountWorkspace(page, { fail: true })
  await page.goto('/dev/crm/dataset')
  await expect(page.getByText('数据集读取失败', { exact: true }).first()).toBeVisible()
  state.fail = false
  await page.locator('button').filter({ has: page.locator('.fa-sync') }).click()
  await expect(page.getByText('订单分析', { exact: true })).toBeVisible()
})


test('creating a chart submits typed field bindings through the visible create action', async ({ page }) => {
  const { state } = await mountWorkspace(page)
  await page.goto('/dev/crm/chart/add')
  await page.getByPlaceholder('sales.orders.trend').fill('sales.newTrend')
  await page.getByPlaceholder('订单趋势').fill('新指标')
  await page.getByText('请选择数据集', { exact: true }).click()
  await page.getByRole('option', { name: '订单分析', exact: true }).click()
  await page.getByText('柱状图', { exact: true }).click()
  await page.getByRole('option', { name: '指标卡', exact: true }).click()
  const fields = page.locator('.cxd-Form-item').filter({ has: page.locator('label').filter({ hasText: /指标字段/ }) })
  await fields.locator('.cxd-Select').click()
  await page.getByRole('option', { name: 'ID', exact: true }).getByText('ID', { exact: true }).click()
  await fields.locator('.cxd-PopOver-overlay').click({ position: { x: 5, y: 5 } })
  await expect(fields.locator('.cxd-Select')).toContainText('ID')
  await page.getByRole('button', { name: '创建并编辑', exact: true }).click()
  await expect.poll(() => state.createdChart?.params?.valueFields).toEqual(['id'])
  expect(Object.keys(state.createdChart.params)).toEqual(['valueFields'])
  await expect(page).toHaveURL(/\/dev\/crm\/chart\/sales.newTrend$/)
})
