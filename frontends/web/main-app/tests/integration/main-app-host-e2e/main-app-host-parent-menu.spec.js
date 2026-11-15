const { test, expect } = require('@playwright/test')
const { attachScreenshotEvidence } = require('./helpers/evidence')

const pages = [
  { fullName: 'UIDesign.UIManagement', title: '前端页面', url: '/mock/ui-pages' },
  { fullName: 'UIDesign.UIManagement.UIModel', title: 'UI 模型', url: '/mock/ui-model' },
  { fullName: 'UIDesign.UIManagement.UISchema', title: 'UI Schema', url: '/mock/ui-schema' },
]

async function prepareMenus(page, layoutType, {
  mainMenus = [{ fullName: 'UIDesign', title: '界面设计', children: [{ ...pages[0], children: pages.slice(1) }] }],
  routePages = pages,
} = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('Ouroboros_token', JSON.stringify({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600,
      refreshTokenExpiresIn: 86400,
      issuedAt: Date.now(),
    }))
  })
  await page.route('**/api/sys/web-app-info', async (route) => {
    const response = await route.fetch()
    const payload = await response.json()
    await route.fulfill({ json: {
      ...payload,
      data: {
        ...payload.data,
        layoutType,
        routes: routePages.map((item) => ({
          path: item.url,
          title: item.title,
          type: 'amis',
          config: { schemaId: item.url },
        })),
      },
    } })
  })
  await page.route('**/api/authored-menu-tree', (route) => route.fulfill({ json: {
    code: 0,
    data: {
      main: mainMenus,
      secondary: [],
    },
  } }))
  await page.route('**/api/ui-schema?*', (route) => {
    const path = new URL(route.request().url()).searchParams.get('path')
    const item = routePages.find((entry) => entry.url === path)
    return route.fulfill({ json: {
      code: 0,
      data: { type: 'page', title: item.title, body: `${item.title}页面已打开` },
    } })
  })
  await page.goto('/welcome')
  await expect(page.getByTestId('welcome-page')).toHaveCount(1)
}

async function expectPageOpen(page, item) {
  await expect(page).toHaveURL(new RegExp(`${item.url}$`))
  await expect(page.locator('.app-tabs__item.is-active')).toContainText(item.title)
  await expect(page.getByText(`${item.title}页面已打开`, { exact: true })).toBeVisible()
}

test('tree parent menu supports opening its page and independently expanding ordered children', async ({ page }, testInfo) => {
  await prepareMenus(page, 'sidebar-split')
  const sidebar = page.locator('.app-sidebar__body')
  await sidebar.getByText('界面设计', { exact: true }).click()
  const title = sidebar.getByText('前端页面', { exact: true })

  await expect(title).toBeVisible()
  await expect(sidebar.getByText('UI 模型', { exact: true })).not.toBeInViewport()
  await sidebar.getByRole('button', { name: '展开前端页面', exact: true }).click()
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(sidebar.locator('.tree-menu--level-2 .tree-menu__title')).toHaveText(['UI 模型', 'UI Schema'])

  await title.click()
  await expectPageOpen(page, pages[0])
  await expect(title.locator('xpath=ancestor::li[1]')).toHaveClass(/is-active/)
  await sidebar.getByRole('button', { name: '收起前端页面', exact: true }).click()
  await expectPageOpen(page, pages[0])
  await expect(sidebar.getByText('UI 模型', { exact: true })).not.toBeInViewport()

  const expand = sidebar.getByRole('button', { name: '展开前端页面', exact: true })
  await expand.focus()
  await page.keyboard.press('Enter')
  await sidebar.getByText('UI 模型', { exact: true }).click()
  await expectPageOpen(page, pages[1])
  await sidebar.getByText('UI Schema', { exact: true }).click()
  await expectPageOpen(page, pages[2])

  await sidebar.getByRole('button', { name: '收起前端页面', exact: true }).click()
  await page.getByRole('button', { name: '切换到标签 前端页面', exact: true }).click()
  await expectPageOpen(page, pages[0])
  await expect(sidebar.getByText('UI 模型', { exact: true })).toBeVisible()
  await attachScreenshotEvidence({ page, testInfo, name: 'parent-page-with-expanded-children' })
})

test('floating parent menu exposes ordered children and opens its own page', async ({ page }, testInfo) => {
  await prepareMenus(page, 'header-sidebar')
  const group = page.locator('.dual-mode-menu__item').filter({ hasText: '界面设计' })
  await group.hover()
  const title = page.locator('.app-float-menu__submenu-title').filter({ hasText: '前端页面' })
  await title.hover()
  await expect(page.locator('.app-float-menu__submenu-content .app-float-menu__item-text'))
    .toHaveText(['UI 模型', 'UI Schema'])
  await expect.poll(async () => {
    const parent = await title.boundingBox()
    const submenu = await page.locator('.app-float-menu__submenu-content').boundingBox()
    return Math.round(submenu.x - (parent.x + parent.width))
  }).toBe(0)
  await title.click()
  await expectPageOpen(page, pages[0])

  await group.hover()
  await title.hover()
  await attachScreenshotEvidence({ page, testInfo, name: 'floating-parent-and-children' })
  await page.locator('.app-float-menu__item').filter({ hasText: 'UI 模型' }).click()
  await expectPageOpen(page, pages[1])
})

const settingsGroups = [
  ['organizationAndAccess', '组织与权限', 'roleManagement', '角色管理'],
  ['basicConfiguration', '基础配置', 'authClients', '接入应用'],
  ['portalAndInterface', '门户与界面', 'WidgetManage', '门户栏目'],
  ['workflowManagement', '流程管理', 'approvalWorkflowDefinition', '审批流'],
  ['auditManagement', '审计管理', 'businessLog', '业务日志'],
  ['operationsManagement', '运行维护', 'platformCache', '平台缓存'],
].map(([group, title, name, pageTitle]) => ({
  fullName: `systemSetting.${group}`,
  title,
  children: [{ fullName: `systemSetting.${name}`, title: pageTitle, url: `/mock/settings/${name}` }],
}))

function settingsFixture() {
  return {
    mainMenus: [{ fullName: 'systemSetting', title: '系统设置', children: settingsGroups }],
    routePages: settingsGroups.flatMap((group) => group.children),
  }
}

test('settings tree groups preserve navigation and active path through detour and tab return', async ({ page }, testInfo) => {
  await prepareMenus(page, 'sidebar-split', settingsFixture())
  const sidebar = page.locator('.app-sidebar__body')
  await sidebar.getByText('系统设置', { exact: true }).click()
  await expect(sidebar.locator('.tree-menu--level-1 > .tree-menu__item > .tree-menu__link .tree-menu__title'))
    .toHaveText(settingsGroups.map((group) => group.title))

  await sidebar.getByText('基础配置', { exact: true }).click()
  await expect(page).toHaveURL(/\/welcome$/)
  await sidebar.getByText('接入应用', { exact: true }).click()
  await expectPageOpen(page, settingsGroups[1].children[0])

  await sidebar.getByText('审计管理', { exact: true }).click()
  await sidebar.getByText('业务日志', { exact: true }).click()
  await expectPageOpen(page, settingsGroups[4].children[0])
  await sidebar.getByRole('button', { name: '收起基础配置', exact: true }).click()
  await page.getByRole('button', { name: '切换到标签 接入应用', exact: true }).click()
  await expectPageOpen(page, settingsGroups[1].children[0])
  await expect(sidebar.getByText('接入应用', { exact: true }).locator('xpath=ancestor::li[1]'))
    .toHaveClass(/is-active/)
  await expect(sidebar.getByRole('button', { name: '收起基础配置', exact: true }))
    .toHaveAttribute('aria-expanded', 'true')
  await attachScreenshotEvidence({ page, testInfo, name: 'settings-six-groups-tab-return' })
})

test('settings floating groups stay open until a page is selected', async ({ page }, testInfo) => {
  await prepareMenus(page, 'header-sidebar', settingsFixture())
  await page.locator('.dual-mode-menu__item').filter({ hasText: '系统设置' }).hover()
  await page.locator('.app-float-menu__header').click()
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.locator('.app-float-menu__panel > .app-float-menu__submenu > .app-float-menu__submenu-title .app-float-menu__submenu-text'))
    .toHaveText(settingsGroups.map((group) => group.title))

  const group = page.locator('.app-float-menu__submenu-title').filter({ hasText: '基础配置' })
  await group.hover()
  await group.click()
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.locator('.app-float-menu__item').filter({ hasText: '接入应用' })).toBeVisible()
  await attachScreenshotEvidence({ page, testInfo, name: 'settings-floating-six-groups' })
  await page.locator('.app-float-menu__item').filter({ hasText: '接入应用' }).click()
  await expectPageOpen(page, settingsGroups[1].children[0])
})
