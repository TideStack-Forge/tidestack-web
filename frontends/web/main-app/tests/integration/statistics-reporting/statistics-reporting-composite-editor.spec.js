const fs = require('node:fs')
const path = require('node:path')
const { test, expect } = require('@playwright/test')
const { installBrowserErrorChecks } = require('./helpers/browserErrors')
installBrowserErrorChecks(test)
const repo = path.resolve(__dirname, '../../../../../..')
test.use({ viewport: { width: 1440, height: 960 }, video: 'on', trace: 'on' })
const field = (name) => ({
  name,
  title: name,
  dataType: 'string',
  nullable: false,
  semanticRole: 'dimension',
  filterable: true,
  sortable: true,
})
async function setup(page) {
  let model = {
    modelType: 'composite-view',
    namespace: 'demo',
    name: 'sales-dashboard',
    fullName: 'demo.sales-dashboard',
    title: '订单综合查询',
    isEnabled: true,
    datasetName: 'demo.orders',
    columns: [
      { field: 'id', title: '订单编号', width: 160 },
      { field: 'title', title: '订单标题' },
    ],
    filterConfig: { items: [{ field: 'id', widget: 'input', ops: ['eq'] }] },
    layoutConfig: { pageSize: 20, defaultSort: [] },
    actionButtons: [
      {
        label: '审核',
        scope: 'row',
        apiRef: 'demo.approve',
        contextBinding: { orderId: 'id' },
      },
    ],
  }
  const saves = [],
    previews = []
  const network = []
  page.on('response', async (response) => {
    if (
      !response.url().includes('/composite-view/') &&
      !response.url().includes('/business-model/')
    )
      return
    try {
      network.push({
        url: response.url(),
        method: response.request().method(),
        status: response.status(),
        request: response.request().postData(),
        response: await response.json(),
      })
    } catch (error) {
      network.push({ url: response.url(), error: String(error) })
    }
  })
  page.on('close', () => {
    const output = process.env.STATISTICS_ACCEPTANCE_EVIDENCE
    if (output) {
      fs.mkdirSync(output, { recursive: true })
      fs.writeFileSync(
        path.join(output, `browser-api-${Date.now()}.json`),
        JSON.stringify(network, null, 2)
      )
    }
  })
  const policy = {
    queryTimeoutSeconds: 30,
    maxPageSize: 1000,
    maxExportRows: 100000,
    revision: 'test-v1',
  }
  const schemaHandler = (route) => {
    const id = new URL(route.request().url()).searchParams.get('path')
    const schema =
      id === '/dev/{appName}/business-model/{fullName}'
        ? JSON.parse(
            fs.readFileSync(
              path.join(
                repo,
                'core/ouroboros-business-model/ouroboros-business-model-dev/src/main/metadata/dev/{appName}/business-model/{fullName}.ui-schema.json'
              )
            )
          ).schema
        : id === '/dev/{appName}/business-model/editor'
          ? JSON.parse(
              fs
                .readFileSync(
                  path.join(
                    repo,
                    'core/ouroboros-business-model/ouroboros-business-model-default/src/main/resources/META-INF/editor-schema-templates/composite-view/index.json.ftl'
                  ),
                  'utf8'
                )
                .replace(/^<#noparse>\s*/, '')
                .replace(/\s*<\/#noparse>\s*$/, '')
            )
          : { type: 'page', title: '统计分析工作区' }
    return route.fulfill({ json: { code: 0, status: 0, data: schema } })
  }
  await page.route('**/api/ui-schema**', schemaHandler)
  await page.route('**/api/amis-schema**', schemaHandler)
  await page.route('**/api/dev/demo/business-model/demo.sales-dashboard**', (route) => {
    if (route.request().method() === 'PUT') {
      model = { ...model, ...route.request().postDataJSON() }
      saves.push(model)
    }
    return route.fulfill({
      json: {
        code: 0,
        status: 0,
        data: {
          businessModel: model,
          appName: 'demo',
          validationSnapshot: { validationErrors: [], validationDiagnostics: [] },
        },
      },
    })
  })
  const apis = [
    {
      method: 'POST',
      path: '/api/orders/{orderId}/approve',
      operationId: 'demo.approve',
      parameters: [
        { name: 'orderId', in: 'path', required: true, schema: { type: 'string' } },
      ],
    },
    {
      method: 'POST',
      path: '/api/orders/batch',
      operationId: 'demo.batch',
      parameters: [
        {
          name: 'ids',
          in: 'query',
          required: true,
          schema: { type: 'array', items: { type: 'string' } },
        },
      ],
    },
  ]
  await page.route('**/api/dev/demo/composite-view/contracts', (route) =>
    route.fulfill({
      json: {
        code: 0,
        status: 0,
        data: {
          executionPolicy: policy,
          datasets: [
            {
              name: 'demo.orders',
              title: '销售订单',
              isEnabled: true,
              schema: { fields: [field('id'), field('title')] },
            },
            {
              name: 'demo.inventory',
              title: '库存',
              isEnabled: true,
              schema: { fields: [field('stock')] },
            },
          ],
          apis,
        },
      },
    })
  )
  await page.route('**/api/dev/demo/composite-view/execution-policy', (route) =>
    route.fulfill({ json: { code: 0, status: 0, data: policy } })
  )
  await page.route('**/api/dev/demo/composite-view/validate', (route) =>
    route.fulfill({
      json: {
        code: 0,
        status: 0,
        data: {
          diagnostics:
            route.request().postDataJSON().datasetName === 'demo.inventory'
              ? ['columns[0].field: 字段 id 已失效']
              : [],
        },
      },
    })
  )
  await page.route('**/api/dev/demo/composite-view/preview', (route) => {
    previews.push(route.request().postDataJSON())
    return route.fulfill({
      json: {
        code: 0,
        status: 0,
        data: {
          rows: [{ id: 'A-01', title: '销售订单' }],
          pageInfo: {
            total: 21,
            pageNo: previews.at(-1).request.page.pageNo,
            pageSize: 20,
          },
        },
      },
    })
  })
  await page.goto('/statistics-reporting-playwright-harness.html')
  await page.waitForFunction(
    () =>
      typeof window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__
        ?.openDashboardBusinessModelEditor === 'function'
  )
  await page.evaluate(() =>
    window.__STATISTICS_REPORTING_PLAYWRIGHT_HARNESS__.openDashboardBusinessModelEditor()
  )
  await expect(page.getByRole('navigation', { name: '综合查询配置' })).toBeVisible()
  await expect(page.getByText('正在读取数据与接口合同…')).toHaveCount(0)
  return { saves, previews }
}

test('SRT-CV-UI-001 composite editor saves fields through the business model toolbar and previews pagination', async ({
  page,
}, testInfo) => {
  const { saves, previews } = await setup(page)
  await expect(page.getByText('销售订单', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '列配置', exact: true }).click()
  await page.getByLabel('显示名 1', { exact: true }).fill('订单 ID')
  await page.getByRole('button', { name: /保存$/ }).click()
  await expect.poll(() => saves.length).toBe(1)
  expect(saves[0]).toMatchObject({
    modelType: 'composite-view',
    namespace: 'demo',
    name: 'sales-dashboard',
    datasetName: 'demo.orders',
  })
  expect(saves[0].columns[0].title).toBe('订单 ID')
  expect(saves[0]).not.toHaveProperty('executionPolicy')
  await page.getByRole('button', { name: '刷新预览', exact: true }).click()
  await expect(page.getByText('A-01', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await expect.poll(() => previews.length).toBe(2)
  expect(previews[1].request.page.pageNo).toBe(2)
  await page.screenshot({
    path: testInfo.outputPath('composite-columns-preview.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: '数据来源', exact: true }).click()
  await page.getByRole('button', { name: '更换数据集', exact: true }).click()
  await page.getByLabel('搜索数据集', { exact: true }).fill('inventory')
  await page.getByRole('button', { name: /库存/ }).click()
  await page.getByRole('button', { name: '校验配置', exact: true }).click()
  await page.getByRole('button', { name: /columns\[0\]/ }).click()
  await expect(page.getByLabel('列字段 1', { exact: true })).toContainText('已失效')
  await expect(page.getByLabel('列字段 1', { exact: true })).toBeFocused()
})

test('SRT-CV-UI-002 composite editor configures batch mappings and private query parameters', async ({
  page,
}, testInfo) => {
  await setup(page)
  await page.getByRole('button', { name: '操作按钮', exact: true }).click()
  await page.getByRole('button', { name: '配置操作与映射', exact: true }).click()
  await expect(page.getByLabel('映射来源 orderId', { exact: true })).toHaveValue('id')
  await page.getByLabel('操作范围', { exact: true }).selectOption('batch')
  await expect(page.getByText('批量字段需要数组参数', { exact: true })).toBeVisible()
  await page.getByLabel('操作接口', { exact: true }).selectOption('demo.batch')
  await page.getByLabel('映射来源 ids', { exact: true }).selectOption('id')
  await expect(page.getByText('通过', { exact: true })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('composite-batch-mapping.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: '完成配置', exact: true }).click()
  await page.getByRole('button', { name: '数据来源', exact: true }).click()
  await page.getByRole('button', { name: '内嵌查询', exact: true }).click()
  await expect(page.getByText('必需账户上下文', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '添加参数', exact: true }).click()
  await page.getByLabel('参数名称 1', { exact: true }).fill('departmentId')
  await page.getByLabel('参数值来源 1', { exact: true }).selectOption('systemContext')
  await expect(page.getByLabel('参数上下文 1', { exact: true })).toHaveValue(
    'departmentId'
  )
  await page.getByLabel('查询超时收紧值', { exact: true }).fill('15')
  await expect(page.getByText('15 秒', { exact: true })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('composite-private-query.png'),
    fullPage: true,
  })
})

test('SRT-CV-UI-003 composite preview shows action parameters and recovers from query failures on narrow screens', async ({
  page,
}, testInfo) => {
  const { previews } = await setup(page)
  await page.getByRole('button', { name: '刷新预览', exact: true }).click()
  await expect(page.getByText('A-01', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '审核', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '操作参数预览' })
  await expect(dialog).toContainText('"orderId": "A-01"')
  await page.screenshot({
    path: testInfo.outputPath('composite-row-action-preview.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: '关闭参数预览', exact: true }).click()
  await page.route('**/api/dev/demo/composite-view/preview', (route) =>
    route.fulfill({ json: { code: 1, msg: 'dataset.query-timeout: 查询超过 30 秒' } })
  )
  await page.getByRole('button', { name: '刷新预览', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('查询超过 30 秒')
  await page.screenshot({
    path: testInfo.outputPath('composite-preview-timeout.png'),
    fullPage: true,
  })
  await page.unroute('**/api/dev/demo/composite-view/preview')
  await page.route('**/api/dev/demo/composite-view/preview', (route) =>
    route.fulfill({ json: { code: 0, data: { rows: [], pageInfo: { total: 0 } } } })
  )
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: testInfo.outputPath('composite-mobile.png'),
    fullPage: true,
  })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true)
  expect(previews.length).toBe(1)
})
