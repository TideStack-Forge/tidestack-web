const { test, expect } = require('@playwright/test')
const fs = require('node:fs')
const path = require('node:path')
const { buildShellAppInfo, buildShellToken, buildShellUserInfo } = require('../../../../script-editor-intelligence-mock-server/fixtures/shellBootstrap')
const root = path.resolve(__dirname, '../../../../../..')
const metadata = 'dev-module/ouroboros-dev-app-management/src/main/metadata/'
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'))
const ok = (data) => ({ code: 0, data, msg: '' })
const menu = (name) => {
  const item = read(name)
  return { ...item, url: item.url?.replace('{appName}', 'crm') }
}

test('opening an app lands on its dashboard and menu selection follows detours and reused tabs', async ({ page }, testInfo) => {
  const dashboard = menu(metadata + 'AppDevDashboard.dev-menu.json')
  const model = menu('core/ouroboros-business-model/ouroboros-business-model-dev/src/main/metadata/businessModelManagement.dev-menu.json')
  const openApps = menu(metadata + 'SecondaryOpenApps.dev-menu.json')
  const logicMenus = [
    'core/ouroboros-webapi-model/ouroboros-webapi-model-dev/src/main/metadata/webapiManagement.dev-menu.json',
    'core/ouroboros-logicflow/ouroboros-logicflow-dev/src/main/metadata/AllModels.LogicflowModel.dev-menu.json',
    'core/ouroboros-approval-workflow/ouroboros-approval-workflow-dev/src/main/metadata/BusinessLogic.ApprovalWorkflowDefinition.dev-menu.json',
  ].map(menu).sort((a, b) => a.order - b.order)
  const appMenus = ['AppSetting.dev-menu.json', 'VersionManagement.dev-menu.json'].map(name => menu(metadata + name)).sort((a, b) => a.order - b.order)
  const menus = { main: [dashboard, model,
    { ...menu(metadata + 'BusinessLogic.dev-menu.json'), children: logicMenus },
    { ...menu(metadata + 'ApplicationManagement.dev-menu.json'), children: appMenus },
  ], secondary: [openApps] }
  const routes = [dashboard, model, openApps, ...logicMenus, ...appMenus].map(item => ({ path: item.url, title: item.title, type: 'amis', config: { schemaId: item.url } }))
  await page.addInitScript(token => localStorage.setItem('Ouroboros_token', JSON.stringify(token)), buildShellToken())
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    let data = {}
    if (url.pathname === '/api/sys/web-app-info') data = { ...buildShellAppInfo(), defaultTheme:'default', currentTheme:'default', layoutType:'sidebar-split', homePage:'/dev/apps', routes }
    else if (url.pathname === '/api/sys/user/info') data = buildShellUserInfo()
    else if (url.pathname === '/api/authored-menu-tree' || url.pathname.endsWith('/dev-workspace-menu')) data = menus
    else if (url.pathname === '/api/auth/authorities') data = {}
    else if (url.pathname === '/api/app') data = { items:[{ appInfo:{name:'crm', title:'客户管理'}, canEdit:true }] }
    else if (url.pathname === '/api/app/category') data = { items:[] }
    else if (url.pathname === '/api/ui-schema') {
      const schemaPath = url.searchParams.get('path')
      data = schemaPath === '/dev/apps' ? read(metadata + 'dev/apps.ui-schema.json').schema : { type:'page', title:routes.find(item => item.path === schemaPath)?.title, body:'已打开开发页面' }
    }
    await route.fulfill({ json:ok(data) })
  })
  await page.goto('/dev/apps')
  await page.getByText('打开', { exact:true }).click()
  await expect(page).toHaveURL(/\/dev\/crm\/dashboard$/)
  const sidebar = page.locator('.app-sidebar')
  await expect(sidebar.locator('.tree-menu__item.is-active')).toContainText('应用开发看板')
  await sidebar.getByRole('button', { name:'业务模型', exact:true }).click()
  await expect(page).toHaveURL(/\/dev\/crm\/business-model$/)
  await expect(sidebar.locator('.tree-menu__item.is-active')).toContainText('业务模型')
  await sidebar.getByText('打开应用', { exact:true }).click()
  await expect(page).toHaveURL(/\/dev\/apps$/)
  await sidebar.getByRole('button', { name:'业务模型', exact:true }).click()
  await expect(page).toHaveURL(/\/dev\/crm\/business-model$/)
  await expect(sidebar.locator('.tree-menu__item.is-active')).toContainText('业务模型')
  await expect(page.locator('.app-tabs__item.is-active')).toContainText('业务模型')
  await sidebar.getByText('业务逻辑', { exact:true }).click()
  const logic = sidebar.locator('.tree-menu__item').filter({has:page.locator('.tree-menu__title', {hasText:/^业务逻辑$/})}).first()
  await expect(logic.locator('.tree-menu--level-1 .tree-menu__title')).toHaveText(['后端接口','逻辑流','审批流'])
  await sidebar.getByText('应用管理', { exact:true }).click()
  const management = sidebar.locator('.tree-menu__item').filter({has:page.locator('.tree-menu__title', {hasText:/^应用管理$/})}).first()
  await expect(management.locator('.tree-menu--level-1 .tree-menu__title').last()).toHaveText('版本管理')
  await page.screenshot({path:testInfo.outputPath('application-navigation.png'),fullPage:true})
})
