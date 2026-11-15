const fs = require('node:fs')
const path = require('node:path')
const { test, expect } = require('@playwright/test')
const {
  buildShellAppInfo,
  buildShellToken,
  buildShellUserInfo,
} = require('../../../../script-editor-intelligence-mock-server/fixtures/shellBootstrap')

const repoRoot = path.resolve(__dirname, '../../../../../..')
const metadata = path.join(
  repoRoot,
  'core/ouroboros-statistics-reporting/ouroboros-statistics-reporting-dev/src/main/metadata'
)
const read = (file) => JSON.parse(fs.readFileSync(path.join(metadata, file), 'utf8'))
const ok = (data) => ({ code: 0, data, msg: '' })
const dataset = (name, title, datasourceName = 'reporting') => ({
  name,
  title,
  status: 'draft',
  appName: null,
  queryDefinition: {
    type: 'sql',
    datasourceName,
    genericSql: 'select 1 as id',
  },
  schema: {
    fields: [{ name: 'id', title: 'ID', dataType: 'string', semanticRole: 'identifier' }],
  },
})

async function mountWorkspace(
  page,
  {
    empty = false,
    fail = false,
    blocking = false,
    noDatasources = false,
    defaultDatasource = false,
  } = {}
) {
  const schemas = new Map()
  const routes = fs.readdirSync(path.join(metadata, 'dev/develop')).map((file) => {
    const model = read('dev/develop/' + file)
    return { ...model, config: { schemaId: model.path } }
  })
  for (const model of routes) {
    const suffix = model.path.replace('/dev/{appName}/analytics', '')
    const file =
      !suffix || suffix === '/datasets'
        ? 'datasets.ui-schema.json'
        : suffix === '/datasets/{datasetName}/studio'
          ? 'dataset-studio.ui-schema.json'
          : suffix.slice(1) + '.ui-schema.json'
    schemas.set(model.path, read('dev/{appName}/analytics/' + file).schema)
  }
  for (const panel of ['overview-panel', 'schema-panel', 'publish-check-panel']) {
    schemas.set(
      '/dev/{appName}/analytics/dataset-studio/' + panel,
      read('dev/{appName}/analytics/dataset-studio/' + panel + '.ui-schema.json').schema
    )
  }
  schemas.set(
    '/dev/{appName}/analytics/dataset-tables',
    read('dev/{appName}/analytics/dataset-tables.ui-schema.json').schema
  )
  const platformMetadata = path.join(
    repoRoot,
    'dev-module/ouroboros-dev-datasource/src/main/metadata/platform-datasource/add.ui-schema.json'
  )
  schemas.set(
    '/platform-datasource/add',
    JSON.parse(fs.readFileSync(platformMetadata, 'utf8')).schema
  )
  const datasourceMetadata = path.join(
    repoRoot,
    'dev-module/ouroboros-dev-datasource/src/main/metadata'
  )
  const datasourceModel = JSON.parse(
    fs.readFileSync(
      path.join(datasourceMetadata, 'dev/{appName}/datasource/add.ui-model.json'),
      'utf8'
    )
  )
  routes.push({ ...datasourceModel, config: { schemaId: datasourceModel.path } })
  schemas.set(
    datasourceModel.path,
    JSON.parse(
      fs.readFileSync(
        path.join(datasourceMetadata, 'dev/{appName}/datasource/add.ui-schema.json'),
        'utf8'
      )
    ).schema
  )
  const requests = []
  const state = {
    datasourceName: defaultDatasource ? 'default' : 'reporting',
    fail,
    empty,
    platformConnections: [{ name: 'warehouse', title: '分析数据库' }],
    datasources: noDatasources
      ? []
      : [{ dataStationName: 'reporting', platformDataSourceName: 'warehouse' }],
  }
  await page.addInitScript(
    (token) => localStorage.setItem('Ouroboros_token', JSON.stringify(token)),
    buildShellToken()
  )
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    requests.push({
      path: url.pathname,
      method: request.method(),
      data: request.postDataJSON(),
    })
    let data = {}
    if (url.pathname === '/api/sys/web-app-info')
      data = {
        ...buildShellAppInfo(),
        defaultTheme: 'default',
        currentTheme: 'default',
        layoutType: 'sidebar-split',
        routes,
      }
    else if (url.pathname === '/api/sys/user/info') data = buildShellUserInfo()
    else if (url.pathname === '/api/ui-schema') {
      data = schemas.get(url.searchParams.get('path'))
      if (!data) throw new Error('Unexpected schema: ' + url.searchParams.get('path'))
    } else if (
      url.pathname.endsWith('/dev-workspace-menu') ||
      url.pathname === '/api/authored-menu-tree'
    ) {
      const menu = read('statistics-analysis.dev-menu.json')
      data = { main: [{ ...menu, url: '/dev/crm/analytics' }], secondary: [] }
    } else if (
      url.pathname.endsWith('/statistics-reporting-dataset') &&
      request.method() === 'POST'
    )
      data = request.postDataJSON()
    else if (url.pathname.endsWith('/statistics-reporting-dataset')) {
      if (state.fail) return route.fulfill({ json: { code: 1, msg: '数据集读取失败' } })
      data = state.empty
        ? []
        : [
            dataset('sales.orders', '订单分析', state.datasourceName),
            dataset('sales.customers', '客户分析'),
          ]
    } else if (url.pathname.endsWith('/statistics-reporting-report-view'))
      data = state.empty
        ? []
        : [
            {
              name: 'sales.trend',
              title: '销售趋势',
              datasetName: 'sales.orders',
              displayType: 'line',
              appName: null,
            },
          ]
    else if (url.pathname.endsWith('/statistics-reporting-dashboard'))
      data = state.empty
        ? []
        : [
            {
              name: 'sales.overview',
              title: '销售总览',
              description: '销售与客户',
              widgets: [{ id: 'trend', type: 'report-view', viewName: 'sales.trend' }],
            },
          ]
    else if (url.pathname.endsWith('/statistics-reporting/datasources'))
      data = [
        { label: '默认数据源', value: 'default' },
        ...state.datasources.map((source) => ({
          label: source.dataStationName,
          value: source.dataStationName,
        })),
      ]
    else if (url.pathname.endsWith('/test-connections/platform'))
      data = state.platformConnections.map((source) => ({
        label: source.title,
        value: source.name,
      }))
    else if (url.pathname.endsWith('/environments'))
      data = [{ label: 'dev', value: 'dev' }]
    else if (url.pathname.endsWith('/test-connections/runtime'))
      data = [{ label: 'admin · DOCKER', value: 'runtime-crm-admin' }]
    else if (url.pathname.includes('/dataset-fixture/')) {
      if (request.method() === 'PUT') state.fixture = request.postDataJSON()
      data = state.fixture || {}
    } else if (url.pathname.endsWith('/infer-schema'))
      data = {
        fields: [{ name: 'id', title: 'id', dataType: 'integer' }],
        warnings:
          request.postDataJSON().datasourceName === 'default' &&
          !['platform', 'runtime'].includes(request.postDataJSON().testConnection?.kind)
            ? ['字段根据数据模型元数据推导']
            : [],
      }
    else if (url.pathname.endsWith('/preview'))
      data = { rows: [{ id: 42 }], resolvedSchema: { fields: [] } }
    else if (url.pathname.endsWith('/datasource-tables'))
      data = {
        items: [
          {
            name: 'sales_order',
            title: '订单',
            model: 'sales.Order',
            source: 'model',
            columns: [{ name: 'id', title: 'ID', dataType: 'Long' }],
          },
        ],
        warnings: [],
      }
    else if (url.pathname.includes('/dataset-studio/'))
      data = {
        dataset:
          state.savedDataset || dataset('sales.orders', '订单分析', state.datasourceName),
        kernelType: 'sql',
        datasourceOptions: [
          { label: '默认数据源', value: 'default' },
          { label: 'reporting', value: 'reporting' },
        ],
        references: blocking
          ? [
              {
                name: 'sales.trend',
                title: '销售趋势',
                viewType: 'report',
                status: 'draft',
                referencedFields: ['id'],
              },
            ]
          : [],
        publicationReport: {
          blocking,
          issues: blocking
            ? [{ code: 'missing-field', severity: 'error', message: '缺少输出字段' }]
            : [],
        },
      }
    else if (url.pathname.endsWith('/asset-reference-graph'))
      data = {
        edges: [],
        dangling: blocking
          ? [{ fromName: 'sales.trend', relation: 'dataset', toName: 'missing.dataset' }]
          : [],
      }
    else if (url.pathname === '/api/platform-datasource' && request.method() === 'POST') {
      data = request.postDataJSON()
      state.platformConnections.push(data)
    } else if (url.pathname === '/api/platform-datasource')
      data = { items: state.platformConnections, total: state.platformConnections.length }
    else if (url.pathname === '/api/dev-environment')
      data = { items: [{ name: 'dev', title: '开发环境' }], total: 1 }
    else if (url.pathname.endsWith('/datasource') && request.method() === 'POST') {
      data = request.postDataJSON()
      state.datasources.push(data)
    } else if (url.pathname.endsWith('/datasource'))
      data = { items: state.datasources, total: state.datasources.length }
    else if (url.pathname.includes('/statistics-reporting-report-view/'))
      data = {
        name: 'sales.trend',
        title: '销售趋势',
        datasetName: 'sales.orders',
        displayType: 'line',
        dimensions: [],
        metrics: [],
      }
    else if (url.pathname.includes('/statistics-reporting-dashboard/'))
      data = {
        name: 'sales.overview',
        title: '销售总览',
        widgets: [],
        layout: { cols: 24, rowHeight: 30 },
      }
    else if (url.pathname.includes('/statistics-reporting-dataset/')) {
      if (request.method() === 'PUT') state.savedDataset = request.postDataJSON()
      data =
        state.savedDataset || dataset('sales.orders', '订单分析', state.datasourceName)
    }
    await route.fulfill({ json: ok(data) })
  })
  return { requests, state }
}

test('datasets keep navigation and actions compact, filter locally, and open the correct application editor', async ({
  page,
}, testInfo) => {
  const { requests } = await mountWorkspace(page)
  await page.goto('/dev/crm/analytics')
  await expect(
    page.getByText('订单分析', { exact: true }).filter({ visible: true })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /新建数据集$/ })).toHaveCount(1)
  const name = page.getByPlaceholder('搜索名称或标识')
  await name.fill('客户')
  await page.getByRole('button', { name: /搜索$/ }).click()
  await expect(page.getByText('客户分析', { exact: true })).toBeVisible()
  await expect(page.getByText('订单分析', { exact: true })).toHaveCount(0)
  await name.fill('sales.orders')
  await page.getByRole('button', { name: /搜索$/ }).click()
  await expect(
    page.getByText('订单分析', { exact: true }).filter({ visible: true })
  ).toBeVisible()
  expect(
    requests.filter((item) => item.path.endsWith('/statistics-reporting-dataset'))
  ).toHaveLength(1)
  await name.fill('')
  await page.getByRole('button', { name: /搜索$/ }).click()
  await page.screenshot({
    path: testInfo.outputPath('datasets-desktop.png'),
    fullPage: true,
  })
  const row = page.locator('tbody tr').filter({ hasText: 'sales.orders' })
  await row.getByRole('button', { name: '编辑', exact: true }).click()
  await expect(page).toHaveURL(/\/dev\/crm\/analytics\/datasets\/sales.orders\/studio$/)
  await expect(page.getByRole('heading', { name: '订单分析', exact: true })).toBeVisible()
  await expect(
    page.getByText('订单分析', { exact: true }).filter({ visible: true })
  ).toBeVisible()
  await expect(page.getByText('发布检查', { exact: true })).toHaveCount(0)
  await expect
    .poll(async () =>
      page
        .locator('.monaco-editor')
        .first()
        .evaluate((element) => {
          const editor = element.getBoundingClientRect()
          const section = element.closest('section').getBoundingClientRect()
          return editor.width >= section.width * 0.95 && editor.height >= 300
        })
    )
    .toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('dataset-editor.png'),
    fullPage: true,
  })
  await page.getByText('高级查询设置', { exact: true }).click()
  await page.getByLabel('数据源标签', { exact: true }).fill('warehouse, analytics')
  await expect(page.getByText('未保存', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect
    .poll(
      () =>
        requests.find(
          (item) =>
            item.path.endsWith('/statistics-reporting-dataset/sales.orders') &&
            item.method === 'PUT'
        )?.data
    )
    .toMatchObject({
      name: 'sales.orders',
      queryDefinition: {
        datasourceName: 'reporting',
        genericSql: 'select 1 as id',
        datasourceTags: ['warehouse', 'analytics'],
      },
    })
  await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)
  await page.setViewportSize({ width: 768, height: 1024 })
  await expect
    .poll(async () =>
      page
        .locator('.monaco-editor')
        .first()
        .evaluate((element) => {
          const editor = element.getBoundingClientRect()
          const section = element.closest('section').getBoundingClientRect()
          const panel = element.closest('.cxd-Panel').getBoundingClientRect()
          return (
            editor.width >= section.width * 0.95 &&
            editor.right <= panel.right &&
            editor.right <= window.innerWidth
          )
        })
    )
    .toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('dataset-editor-narrow.png'),
    fullPage: true,
  })
})

test('chart and dashboard lists share navigation and preserve their editing destinations', async ({
  page,
}, testInfo) => {
  await mountWorkspace(page)
  await page.goto('/dev/crm/analytics')
  await page.getByRole('menuitem', { name: '图表', exact: true }).click()
  await expect(page).toHaveURL(/\/dev\/crm\/analytics\/report-views$/)
  await expect(page.getByText('销售趋势', { exact: true })).toBeVisible()
  await expect(page.getByText('折线图', { exact: true })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('charts-desktop.png'),
    fullPage: true,
  })
  await page
    .locator('tbody tr')
    .filter({ hasText: 'sales.trend' })
    .getByRole('button', { name: '编辑', exact: true })
    .click()
  await expect(page).toHaveURL(/\/dev\/crm\/analytics\/report-views\/sales.trend$/)
  await expect(page.getByPlaceholder('显示名称', { exact: true })).toHaveValue('销售趋势')
  await expect(page.getByRole('button', { name: '居中', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('chart-editor.png'), fullPage: true })
  await page.goto('/dev/crm/analytics/dashboards')
  await expect(page.getByText('销售总览', { exact: true })).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('dashboards-desktop.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.screenshot({
    path: testInfo.outputPath('dashboards-narrow.png'),
    fullPage: true,
  })
  await expect(page.getByRole('button', { name: /新建仪表板$/ })).toBeVisible()
  await page
    .locator('tbody tr')
    .filter({ hasText: 'sales.overview' })
    .getByRole('button', { name: '编辑布局', exact: true })
    .click()
  await expect(page).toHaveURL(
    /\/dev\/crm\/analytics\/dashboards\/sales.overview\/designer$/
  )
  await expect(page.getByRole('button', { name: '保存布局', exact: true })).toBeVisible()
})

test('empty datasets retain the create action and a failed load can be retried', async ({
  page,
}, testInfo) => {
  const { state, requests } = await mountWorkspace(page, { empty: true, fail: true })
  await page.goto('/dev/crm/analytics')
  await expect(page.getByText('数据集读取失败', { exact: true }).first()).toBeVisible()
  state.fail = false
  await page.getByRole('button', { name: /刷新$/ }).click()
  await expect(
    page.getByText('暂无数据集，点击“新建数据集”开始配置', { exact: true })
  ).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('datasets-empty.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: /新建数据集$/ }).click()
  await expect(page).toHaveURL(/\/dev\/crm\/analytics\/datasets\/add$/)
  await expect(page.getByRole('heading', { name: /新建数据集$/ })).toBeVisible()
  await expect(
    page.getByRole('button', { name: '创建数据集', exact: true })
  ).toBeVisible()
  await page.getByPlaceholder('例如：sales.orders').fill('sales.created')
  await page.getByPlaceholder('例如：订单分析数据集').fill('新建订单分析')
  await page
    .getByText('默认数据源', { exact: true })
    .filter({ visible: true })
    .first()
    .click()
  await page
    .getByText('reporting', { exact: true })
    .filter({ visible: true })
    .last()
    .click()
  await page.getByRole('button', { name: '创建数据集', exact: true }).click()
  await expect
    .poll(
      () =>
        requests.find(
          (item) =>
            item.path.endsWith('/statistics-reporting-dataset') && item.method === 'POST'
        )?.data
    )
    .toMatchObject({
      name: 'sales.created',
      title: '新建订单分析',
      status: 'draft',
      queryDefinition: {
        type: 'sql',
        datasourceName: 'reporting',
        genericSql: 'select 1 as id',
      },
    })
  await expect(page).toHaveURL(/\/dev\/crm\/analytics\/datasets\/sales.created\/studio$/)
})

test('creating a chart from a dataset passes its identity to the existing creation form', async ({
  page,
}, testInfo) => {
  await mountWorkspace(page)
  await page.goto('/dev/crm/analytics/datasets')
  await expect(
    page.getByText('订单分析', { exact: true }).filter({ visible: true })
  ).toBeVisible()
  await page
    .locator('tbody tr')
    .filter({ hasText: 'sales.orders' })
    .getByRole('button', { name: '创建图表', exact: true })
    .click()
  await expect(page).toHaveURL(
    /\/dev\/crm\/analytics\/report-views\/add\?datasetName=sales.orders$/
  )
  await expect(page.getByRole('heading', { name: '新建图表', exact: true })).toBeVisible()
  await expect(
    page.getByText('订单分析', { exact: true }).filter({ visible: true })
  ).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('create-chart.png'), fullPage: true })
})

test('dataset editor removes publication checks and keeps usage details on demand', async ({
  page,
}, testInfo) => {
  const { requests } = await mountWorkspace(page, { blocking: true })
  await page.goto('/dev/crm/analytics/datasets/sales.orders/studio')
  await expect(page.getByText('发布检查', { exact: true })).toHaveCount(0)
  await expect(page.getByText('存在阻塞问题', { exact: true })).toHaveCount(0)
  await page.getByText('使用情况', { exact: true }).click()
  await expect(page.getByText('销售趋势', { exact: true })).toBeVisible()
  expect(
    requests.filter((item) => item.path.endsWith('/asset-reference-graph'))
  ).toHaveLength(0)
  await page.screenshot({
    path: testInfo.outputPath('dataset-editor-issues.png'),
    fullPage: true,
  })
})

test('default datasource stays available without bindings and extra sources can be configured', async ({
  page,
}, testInfo) => {
  const { requests } = await mountWorkspace(page, { noDatasources: true })
  await page.goto('/dev/crm/analytics/datasets/add')
  await page.getByPlaceholder('例如：sales.orders').fill('sales.created')
  await page.getByPlaceholder('例如：订单分析数据集').fill('新建订单分析')
  await expect(
    page.getByText('默认数据源', { exact: true }).filter({ visible: true })
  ).toBeVisible()
  await page.getByRole('button', { name: '添加数据源', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('应用数据源名称', { exact: true })).toBeVisible()
  await dialog.locator('input[name="dataStationName"]').fill('reporting')
  await dialog.getByRole('combobox').click()
  await page
    .getByText('分析数据库', { exact: true })
    .filter({ visible: true })
    .last()
    .click()
  await dialog.getByRole('button', { name: '提交', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByPlaceholder('例如：订单分析数据集')).toHaveValue('新建订单分析')
  await page
    .getByText('默认数据源', { exact: true })
    .filter({ visible: true })
    .first()
    .click()
  await page
    .getByText('reporting', { exact: true })
    .filter({ visible: true })
    .last()
    .click()
  expect(
    requests.find(
      (item) => item.path === '/api/dev/crm/datasource' && item.method === 'POST'
    )?.data
  ).toMatchObject({
    appName: 'crm',
    dataStationName: 'reporting',
    platformDataSourceName: 'warehouse',
  })
  await page.screenshot({
    path: testInfo.outputPath('datasource-configured.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: '创建数据集', exact: true }).click()
  await expect
    .poll(
      () =>
        requests.find(
          (item) =>
            item.path.endsWith('/statistics-reporting-dataset') && item.method === 'POST'
        )?.data
    )
    .toMatchObject({
      name: 'sales.created',
      title: '新建订单分析',
      queryDefinition: { datasourceName: 'reporting' },
    })
  await expect(page).toHaveURL(/\/dev\/crm\/analytics\/datasets\/sales.created\/studio$/)
})

test('datasource refresh preserves the draft after closing configuration', async ({
  page,
}) => {
  const { requests, state } = await mountWorkspace(page, { noDatasources: true })
  await page.goto('/dev/crm/analytics/datasets/add')
  await page.getByPlaceholder('例如：sales.orders').fill('sales.created')
  await page.getByRole('button', { name: '添加数据源', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('应用数据源名称', { exact: true })).toBeVisible()
  await dialog.locator('.cxd-Modal-close').click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(
    requests.filter((item) => item.path.endsWith('/datasource') && item.method === 'POST')
  ).toHaveLength(0)
  state.datasources.push({
    dataStationName: 'reporting',
    platformDataSourceName: 'warehouse',
  })
  await page.getByRole('button', { name: '刷新数据源', exact: true }).click()
  await page
    .getByText('默认数据源', { exact: true })
    .filter({ visible: true })
    .first()
    .click()
  await expect(
    page.getByText('reporting', { exact: true }).filter({ visible: true })
  ).toBeVisible()
  await expect(page.getByPlaceholder('例如：sales.orders')).toHaveValue('sales.created')
  expect(
    requests.filter(
      (item) =>
        item.path.endsWith('/statistics-reporting/datasources') && item.method === 'GET'
    )
  ).toHaveLength(2)
})

test('an unbound application can create a dataset with its default logical datasource', async ({
  page,
}, testInfo) => {
  const { requests } = await mountWorkspace(page, { noDatasources: true })
  await page.goto('/dev/crm/analytics/datasets/add')
  await page.getByPlaceholder('例如：sales.orders').fill('sales.created')
  await page.getByPlaceholder('例如：订单分析数据集').fill('默认数据源分析')
  await page.getByRole('button', { name: '查看表结构', exact: true }).click()
  await expect(
    page.getByRole('dialog').getByText('sales_order', { exact: true })
  ).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('default-model-tables.png'),
    fullPage: true,
  })
  await page.getByRole('dialog').locator('.cxd-Modal-close').click()
  await page.getByRole('button', { name: '创建数据集', exact: true }).click()
  await expect
    .poll(
      () =>
        requests.find(
          (item) =>
            item.path.endsWith('/statistics-reporting-dataset') && item.method === 'POST'
        )?.data
    )
    .toMatchObject({ queryDefinition: { datasourceName: 'default' } })
  expect(
    requests.filter((item) => item.path.endsWith('/datasource') && item.method === 'POST')
  ).toHaveLength(0)
})

test('model inference and real preview share the selected persisted test connection', async ({
  page,
}, testInfo) => {
  const { requests, state } = await mountWorkspace(page, { defaultDatasource: true })
  await page.goto('/dev/crm/analytics/datasets/sales.orders/studio')
  await page.getByRole('button', { name: '推导字段', exact: true }).click()
  await expect(
    page.getByText('字段根据数据模型元数据推导', { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText('订单分析', { exact: true }).filter({ visible: true })
  ).toBeVisible()
  await page.getByText('预览连接', { exact: true }).click()
  await page.getByText('指定连接', { exact: true }).click()
  const platform = page
    .locator('.cxd-Form-item')
    .filter({ has: page.locator('label').filter({ hasText: /^实际连接$/ }) })
  await platform.getByRole('combobox').click()
  await page
    .getByText('分析数据库', { exact: true })
    .filter({ visible: true })
    .last()
    .click()
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect
    .poll(() => state.fixture?.testConnection)
    .toMatchObject({
      kind: 'platform',
      platformDataSourceName: 'warehouse',
      envName: 'dev',
    })
  expect(
    requests.find(
      (item) =>
        item.path.endsWith('/statistics-reporting-dataset/sales.orders') &&
        item.method === 'PUT'
    )?.data
  ).not.toHaveProperty('testConnection')
  await page.getByRole('button', { name: '推导字段', exact: true }).click()
  await expect
    .poll(
      () => requests.filter((item) => item.path.endsWith('/infer-schema')).at(-1)?.data
    )
    .toMatchObject({
      testConnection: {
        kind: 'platform',
        platformDataSourceName: 'warehouse',
        envName: 'dev',
      },
    })
  await page.getByRole('button', { name: '预览', exact: true }).click()
  await expect
    .poll(
      () =>
        requests.find((item) => item.path === '/api/dev/crm/statistics-reporting/preview')
          ?.data
    )
    .toMatchObject({
      testConnection: { kind: 'platform', platformDataSourceName: 'warehouse' },
    })
  await expect(page.getByRole('dialog')).toContainText('42')
  await page.getByRole('dialog').locator('.cxd-Modal-close').click()
  await page.getByText('运行容器', { exact: true }).first().click()
  const runtime = page
    .locator('.cxd-Form-item')
    .filter({ has: page.locator('label').filter({ hasText: /^运行容器$/ }) })
  await runtime.getByRole('combobox').click()
  await page
    .getByText('admin · DOCKER', { exact: true })
    .filter({ visible: true })
    .last()
    .click()
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect
    .poll(() => state.fixture?.testConnection)
    .toMatchObject({ kind: 'runtime', runtimeId: 'runtime-crm-admin' })
  await page.screenshot({
    path: testInfo.outputPath('runtime-test-connection.png'),
    fullPage: true,
  })
})

test('a new actual connection reuses platform persistence and remains separate from the dataset definition', async ({
  page,
}, testInfo) => {
  const { requests } = await mountWorkspace(page, { defaultDatasource: true })
  await page.goto('/dev/crm/analytics/datasets/sales.orders/studio')
  await page.getByText('预览连接', { exact: true }).click()
  await page.getByText('指定连接', { exact: true }).click()
  await page.getByRole('button', { name: '新增连接', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('input[name="name"]').fill('test-crm')
  await dialog.locator('input[name="title"]').fill('CRM 测试库')
  await dialog.getByRole('combobox').filter({ hasText: '请选择驱动' }).click()
  await page
    .getByRole('option', { name: 'MySQL (com.mysql.cj.jdbc.Driver)', exact: true })
    .click()
  await dialog
    .getByPlaceholder('jdbc:mysql://host:3306/dbname')
    .fill('jdbc:mysql://db/test_crm')
  await dialog.locator('input[name="username"]').fill('test-user')
  await dialog.locator('input[name="password"]').fill('test-password')
  await dialog.getByRole('button', { name: '提交', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect
    .poll(
      () =>
        requests.find(
          (item) => item.path === '/api/platform-datasource' && item.method === 'POST'
        )?.data
    )
    .toMatchObject({
      name: 'test-crm',
      definition: {
        dev: {
          type: 'jdbc',
          driverClassName: 'com.mysql.cj.jdbc.Driver',
          url: 'jdbc:mysql://db/test_crm',
          username: 'test-user',
          password: 'test-password',
        },
      },
    })
  const connection = page
    .locator('.cxd-Form-item')
    .filter({ has: page.locator('label').filter({ hasText: /^实际连接$/ }) })
  await connection.getByRole('combobox').click()
  await expect(
    page.getByText('CRM 测试库', { exact: true }).filter({ visible: true })
  ).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('saved-platform-test-connection.png'),
    fullPage: true,
  })
  expect(
    requests.filter((item) => item.path.endsWith('/datasource') && item.method === 'POST')
  ).toHaveLength(0)
})

test('bound sources need no preview setup and stale test settings cannot override them', async ({
  page,
}, testInfo) => {
  const { requests, state } = await mountWorkspace(page)
  state.fixture = {
    testDatasourceName: 'default',
    testConnection: {
      kind: 'platform',
      platformDataSourceName: 'obsolete',
      envName: 'prod',
    },
  }
  await page.goto('/dev/crm/analytics/datasets/sales.orders/studio')
  await expect(page.getByText('预览连接', { exact: true })).toHaveCount(0)
  await expect(page.getByText('指定连接', { exact: true })).toHaveCount(0)
  const source = page.getByRole('combobox', { name: '数据源', exact: true })
  await source.selectOption('default')
  await expect(page.getByText('预览连接', { exact: true })).toBeVisible()
  await source.selectOption('reporting')
  await expect(page.getByText('预览连接', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '推导字段', exact: true }).click()
  await expect
    .poll(
      () => requests.filter((item) => item.path.endsWith('/infer-schema')).at(-1)?.data
    )
    .toMatchObject({
      datasourceName: 'reporting',
      testConnection: { kind: 'application' },
    })
  await page.getByRole('button', { name: '查看表结构', exact: true }).click()
  await expect
    .poll(
      () =>
        requests.filter((item) => item.path.endsWith('/datasource-tables')).at(-1)?.data
    )
    .toMatchObject({
      datasourceName: 'reporting',
      testConnection: { kind: 'application' },
    })
  await page.getByRole('dialog').locator('.cxd-Modal-close').click()
  await page.getByRole('button', { name: '预览', exact: true }).click()
  await expect
    .poll(() => requests.filter((item) => item.path.endsWith('/preview')).at(-1)?.data)
    .toMatchObject({
      executionContext: { datasourceName: 'reporting' },
      testConnection: { kind: 'application' },
      dataset: { queryDefinition: { genericSql: 'select 1 as id' } },
    })
  await expect(page.getByRole('dialog')).toContainText('42')
  await page.getByRole('dialog').locator('.cxd-Modal-close').click()
  await page.screenshot({
    path: testInfo.outputPath('bound-source-editor.png'),
    fullPage: true,
  })
})

test('parameters and test values save through their own tabs without losing the query', async ({
  page,
}, testInfo) => {
  const { requests, state } = await mountWorkspace(page)
  state.fixture = { testParameters: { minId: '10' } }
  await page.goto('/dev/crm/analytics/datasets/sales.orders/studio')
  await page.getByText('参数', { exact: true }).first().click()
  await page.getByRole('button', { name: '添加参数', exact: true }).click()
  await page.locator('input[name="name"]').filter({ visible: true }).fill('minId')
  await page.locator('input[name="title"]').filter({ visible: true }).fill('最小编号')
  await page.locator('input[name="value"]').fill('25')
  await page.getByRole('button', { name: '保存草稿', exact: true }).click()
  await expect.poll(() => state.fixture?.testParameters).toMatchObject({ minId: '25' })
  await expect
    .poll(
      () =>
        requests.find(
          (item) =>
            item.path.endsWith('/statistics-reporting-dataset/sales.orders') &&
            item.method === 'PUT'
        )?.data
    )
    .toMatchObject({
      parameters: [{ name: 'minId', title: '最小编号' }],
      queryDefinition: { genericSql: 'select 1 as id' },
    })
  await expect(page.locator('input[name="name"]').filter({ visible: true })).toHaveValue(
    'minId'
  )
  await expect(page.getByRole('button', { name: '保存草稿', exact: true })).toBeEnabled()
  await page.screenshot({
    path: testInfo.outputPath('dataset-parameters.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByText('结果字段', { exact: true }).first().click()
  await expect(page.locator('input[name="name"]').filter({ visible: true })).toHaveValue(
    'id'
  )
  await expect
    .poll(() =>
      page
        .locator('input[name="name"]')
        .filter({ visible: true })
        .evaluate((element) => element.getBoundingClientRect().width)
    )
    .toBeGreaterThan(120)
  await page.screenshot({
    path: testInfo.outputPath('dataset-result-fields.png'),
    fullPage: true,
    animations: 'disabled',
  })
})
