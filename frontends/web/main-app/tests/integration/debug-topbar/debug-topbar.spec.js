const fs = require('node:fs')
const path = require('node:path')
const { test, expect } = require('@playwright/test')

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..')
const helperControlButtonsSchema = readJson(
  'dev-module/ouroboros-dev-app-management/src/main/resources/META-INF/ouroboros/ui-schema/dev/helper-control-buttons.json'
)

const APP_NAME = 'demo'
const APP_LIST_ROUTE = '/dev/app-list'
const DEV_ROUTE = `/dev/${APP_NAME}/helper-control-regression`

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'))
}

function ok(data) {
  return {
    code: 0,
    status: 0,
    msg: '',
    data,
  }
}

function helperStatus({ status = 'running', refreshPending = false }) {
  return {
    status,
    refreshPending,
    runtimeGeneration: 7,
    lastLoadTime: '2026-05-07T00:00:00Z',
    imageState: {
      reference: 'playwright/helper:latest',
      updateRecommended: false,
    },
  }
}

function buildAppInfo({ appName, homePage, routes, headerEntry }) {
  return {
    appName,
    homePage,
    headerEntry: headerEntry || '/debug-console-header/',
    layoutType: 'sidebar-split',
    defaultTheme: 'default',
    currentTheme: 'default',
    config: {
      'security.session.idleLogout': false,
    },
    routes,
  }
}

function buildMenus(main) {
  return {
    main,
    secondary: [],
  }
}

function debugRoutes() {
  return [
    {
      path: '/welcome',
      title: '个人门户',
      type: 'amis',
      config: {
        schemaId: '/playwright/debug-topbar/personal-portal-page',
      },
    },
    {
      path: APP_LIST_ROUTE,
      title: '应用列表',
      type: 'amis',
      config: {
        schemaId: '/playwright/debug-topbar/app-list-page',
      },
    },
    {
      path: '/dev/:appName/helper-control-regression',
      title: 'Debug Topbar Regression',
      type: 'amis',
      config: {
        schemaId: '/playwright/debug-topbar/dev-page',
      },
    },
  ]
}

async function fulfillJson(route, data) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  })
}

async function mockHarnessApis(page, state) {
  state.appInfoRequests = 0
  state.menuRequests = 0

  const openedAppInfo = buildAppInfo({
    appName: 'Opened App Shell',
    homePage: DEV_ROUTE,
    routes: debugRoutes(),
  })
  const platformInfo = buildAppInfo({
    appName: 'Platform Shell',
    homePage: '/welcome',
    routes: debugRoutes(),
    headerEntry: '/debug-console-header/',
  })
  const openedAppMenus = buildMenus([
    {
      title: 'Debug Topbar Regression',
      name: 'debug-topbar-regression',
      path: DEV_ROUTE,
      url: DEV_ROUTE,
      type: 'amis',
      children: [],
    },
    {
      title: '个人门户',
      name: 'personal-portal',
      path: '/welcome',
      url: '/welcome',
      type: 'internal',
      children: [],
    },
  ])
  const platformMenus = buildMenus([
    {
      title: '个人门户',
      name: 'personal-portal',
      path: '/welcome',
      url: '/welcome',
      type: 'internal',
      children: [],
    },
    {
      title: '应用列表',
      name: 'app-list',
      path: APP_LIST_ROUTE,
      url: APP_LIST_ROUTE,
      type: 'amis',
      children: [],
    },
    {
      title: 'Debug Topbar Regression',
      name: 'debug-topbar-regression',
      path: DEV_ROUTE,
      url: DEV_ROUTE,
      type: 'amis',
      children: [],
    },
  ])

  const initialShellIsWorkspace = state.initialPath.startsWith('/dev/')
  const appInfoSequence = initialShellIsWorkspace
    ? [openedAppInfo, platformInfo, platformInfo]
    : [platformInfo, openedAppInfo, platformInfo]
  const menuSequence = initialShellIsWorkspace
    ? [openedAppMenus, platformMenus, platformMenus]
    : [platformMenus, openedAppMenus, platformMenus]

  await page.route('**/api/sys/web-app-info', async (route) => {
    state.appInfoRequests += 1
    const response = appInfoSequence[Math.min(state.appInfoRequests - 1, appInfoSequence.length - 1)]
    await fulfillJson(route, ok(response))
  })
  await page.route('**/api/sys/user/info', async (route) => {
    await fulfillJson(route, ok({
      userIdentity: '',
      username: 'playwright-user',
      roles: [],
    }))
  })
  await page.route('**/api/authored-menu-tree', async (route) => {
    state.menuRequests += 1
    const response = menuSequence[Math.min(state.menuRequests - 1, menuSequence.length - 1)]
    await fulfillJson(route, ok(response))
  })
  await page.route('**/api/i18n/languages', async (route) => {
    await fulfillJson(route, ok({ items: [] }))
  })
  await page.route('**/api/i18n/locale/*', async (route) => {
    await fulfillJson(route, ok({ common: {} }))
  })
  await page.route('**/api/auth/authorities', async (route) => {
    await fulfillJson(route, ok({}))
  })
  await page.route('**/api/user-setting', async (route) => {
    await fulfillJson(route, ok({}))
  })
  await page.route('**/api/ui-schema**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const schemaPath = requestUrl.searchParams.get('path')

    if (schemaPath === '/dev/container-control-buttons') {
      await fulfillJson(route, ok({
        type: 'button-group',
        buttons: [],
      }))
      return
    }

    if (schemaPath === '/dev/helper-control-buttons') {
      await fulfillJson(route, ok(helperControlButtonsSchema))
      return
    }

    if (schemaPath === '/playwright/debug-topbar/dev-page') {
      await fulfillJson(route, ok({
        type: 'page',
        body: {
          type: 'tpl',
          tpl: '<div data-testid="debug-topbar-dev-page">Debug topbar dev page</div>',
        },
      }))
      return
    }

    if (schemaPath === '/playwright/debug-topbar/personal-portal-page') {
      await fulfillJson(route, ok({
        type: 'page',
        body: [
          {
            type: 'tpl',
            tpl: `<div data-testid="debug-topbar-personal-portal-page">个人门户</div>
              <button
                type="button"
                data-testid="debug-topbar-enter-app-list"
                onclick="window.__DEBUG_TOPBAR_PLAYWRIGHT_HARNESS__.openOrSwitchTab('${APP_LIST_ROUTE}', '应用列表')"
              >进入应用列表</button>`,
          },
          {
            type: 'tpl',
            tpl: '<div></div>',
            visibleOn: false,
          },
        ],
      }))
      return
    }

    if (schemaPath === '/playwright/debug-topbar/app-list-page') {
      await fulfillJson(route, ok({
        type: 'page',
        body: [
          {
            type: 'tpl',
            tpl: `<div data-testid="debug-topbar-app-list-page">应用列表</div>
              <button
                type="button"
                data-testid="debug-topbar-open-app-card"
                onclick="window.__DEBUG_TOPBAR_PLAYWRIGHT_HARNESS__.openOrSwitchTab('${DEV_ROUTE}', 'Debug Topbar Regression')"
              >通过应用卡片打开 Debug Topbar Regression</button>`,
          },
          {
            type: 'tpl',
            tpl: '<div></div>',
            visibleOn: false,
          },
        ],
      }))
      return
    }

    await fulfillJson(route, {
      code: 404,
      status: 404,
      msg: 'Schema Not Found',
      data: null,
    })
  })
  await page.route(`**/api/dev/${APP_NAME}/helper/status`, async (route) => {
    await fulfillJson(route, ok(helperStatus(state)))
  })
  await page.route('**/api/app/container**', async (route) => {
    await fulfillJson(route, ok({}))
  })
}

async function openHarness(page, state) {
  state.initialPath = state.initialPath || DEV_ROUTE
  state.initialTitle = state.initialTitle || (state.initialPath.startsWith('/dev/') ? 'Debug Topbar Regression' : '个人门户')

  await mockHarnessApis(page, state)
  await page.goto(`/debug-topbar-playwright-harness.html?path=${encodeURIComponent(state.initialPath)}&title=${encodeURIComponent(state.initialTitle)}`)
  await page.waitForFunction(() => window.__DEBUG_TOPBAR_PLAYWRIGHT_HARNESS__?.ready === true)
  await expect(page.getByTestId('debug-topbar-harness-status')).toHaveText('Debug topbar harness ready')
  await expect(page).toHaveURL(new RegExp(`${state.initialPath}$`))
}

async function openDebugTopbarTabs(page) {
  await page.getByRole('button', { name: '进入应用列表' }).evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  })
  await expect(page.locator('.app-tabs__item.is-active')).toContainText('应用列表')

  await page.getByRole('button', { name: '通过应用卡片打开 Debug Topbar Regression' }).evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  })
  await expect(page.locator('.app-tabs__item.is-active')).toContainText('Debug Topbar Regression')
  await expect(page.locator('.app-tabs__item')).toHaveCount(3)
}

async function beginTabDrag(page, tabTitle, moveOffsetY = 14) {
  return page.evaluate(({ tabTitle: currentTabTitle, moveOffsetY: currentMoveOffsetY }) => {
    const tabs = Array.from(document.querySelectorAll('.app-tabs__item'))
    const getTabLabel = (item) => item.getAttribute('aria-label')?.replace(/^切换到标签\s*/, '').trim()
    const tab = tabs.find((item) => getTabLabel(item) === currentTabTitle)
    if (!tab) {
      throw new Error(`Tab not found: ${currentTabTitle}`)
    }

    const rect = tab.getBoundingClientRect()
    const startX = rect.left + 30
    const startY = rect.top + rect.height / 2
    const tailRect = tabs[tabs.length - 1]?.getBoundingClientRect()
    const moveX = Math.max(startX + 220, (tailRect?.right || startX) + Math.max(tailRect?.width || 0, 160))
    const moveY = startY + currentMoveOffsetY
    tab.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 1,
      clientX: startX,
      clientY: startY,
      view: window,
    }))

    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      buttons: 1,
      clientX: moveX,
      clientY: moveY,
      view: window,
    }))

    window.__DEBUG_TOPBAR_TAB_DRAG_POINT__ = { x: moveX, y: moveY }
    return {
      expectedOffset: Math.round(moveX - startX),
    }
  }, { tabTitle, moveOffsetY })
}

async function releaseCurrentTabDrag(page) {
  await page.evaluate(() => {
    const draggingTab = document.querySelector('.app-tabs__item.is-dragging')
    if (!draggingTab) {
      throw new Error('No dragging tab found before mouseup')
    }

    const dragPoint = window.__DEBUG_TOPBAR_TAB_DRAG_POINT__
    if (!dragPoint) {
      throw new Error('No drag point found before mouseup')
    }

    document.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 0,
      clientX: dragPoint.x,
      clientY: dragPoint.y,
      view: window,
    }))
  })
}

async function readTabMotion(page, tabTitle) {
  return page.evaluate(({ tabTitle: currentTabTitle }) => {
    const tabs = Array.from(document.querySelectorAll('.app-tabs__item'))
    const getTabLabel = (item) => item.getAttribute('aria-label')?.replace(/^切换到标签\s*/, '').trim()
    const tab = tabs.find((item) => getTabLabel(item) === currentTabTitle)
    if (!tab) {
      return null
    }

    const style = window.getComputedStyle(tab)
    return {
      className: tab.className,
      dragOffset: style.getPropertyValue('--app-tabs-drag-offset'),
      order: tabs.map((item) => getTabLabel(item)),
    }
  }, { tabTitle })
}

test('debug topbar switches from personal portal through app list and app-card open into the workspace shell without refreshing', async ({ page }) => {
  const regressionState = {
    status: 'running',
    refreshPending: false,
    initialPath: '/welcome',
    initialTitle: '个人门户',
  }
  await openHarness(page, regressionState)

  await expect(page.locator('.custom-top-navbar')).toHaveCount(1)
  await expect(page.locator('.custom-top-navbar .title')).toContainText('Platform Shell')
  await expect(page.locator('.helper-buttons')).toBeHidden()

  await expect(page.getByTestId('debug-topbar-personal-portal-page')).toBeVisible()

  await page.getByRole('button', { name: '进入应用列表' }).evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  })
  await expect(page.locator('.app-tabs__item.is-active')).toContainText('应用列表')
  await expect(page.locator('.custom-top-navbar')).toHaveCount(1)
  await expect(page.locator('.custom-top-navbar .title')).toContainText('Platform Shell')
  await expect(page.locator('.helper-buttons')).toBeHidden()
  await expect(page.getByTestId('debug-topbar-app-list-page')).toBeVisible()

  await page.getByRole('button', { name: '通过应用卡片打开 Debug Topbar Regression' }).evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  })
  await expect(page.locator('.app-tabs__item.is-active')).toContainText('Debug Topbar Regression')
  await expect(page.getByTestId('debug-topbar-dev-page')).toBeVisible()
  await expect(page.locator('.helper-btn.helper-running')).toBeVisible()
  await expect(page.locator('.helper-buttons')).toBeVisible()

  const harnessInstanceId = await page.evaluate(() => {
    return window.__DEBUG_TOPBAR_PLAYWRIGHT_HARNESS__.instanceId
  })

  let navigationRequests = 0
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      navigationRequests += 1
    }
  })

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        return {
          beforeUnloadCount: window.__DEBUG_TOPBAR_PLAYWRIGHT_HARNESS__.beforeUnloadCount,
          instanceId: window.__DEBUG_TOPBAR_PLAYWRIGHT_HARNESS__.instanceId,
        }
      })
    })
    .toEqual({ beforeUnloadCount: 0, instanceId: harnessInstanceId })
  expect(navigationRequests).toBe(0)
})

test('debug topbar tabs drag follows x-only motion and settles into the released slot', async ({ page }) => {
  const regressionState = {
    status: 'running',
    refreshPending: false,
    initialPath: '/welcome',
    initialTitle: '个人门户',
  }
  await openHarness(page, regressionState)
  await openDebugTopbarTabs(page)

  const initialOrder = (await readTabMotion(page, '个人门户'))?.order
  expect(initialOrder).toHaveLength(3)
  const dragTitle = initialOrder[1]
  const expectedFinalOrder = [
    initialOrder[0],
    initialOrder[2],
    dragTitle,
  ]

  const { expectedOffset } = await beginTabDrag(page, dragTitle)

  await expect.poll(() => readTabMotion(page, dragTitle)).toMatchObject({
    className: expect.stringContaining('is-dragging'),
    dragOffset: `${expectedOffset}px`,
  })

  await releaseCurrentTabDrag(page)

  await expect.poll(() => readTabMotion(page, dragTitle)).toMatchObject({
    className: expect.stringContaining('is-settling'),
    dragOffset: '0px',
    order: expectedFinalOrder,
  })

  await expect.poll(() => readTabMotion(page, dragTitle)).toMatchObject({
    className: expect.not.stringContaining('is-settling'),
    dragOffset: '0px',
    order: expectedFinalOrder,
  })
})

test('debug topbar tabs ignore vertical motion and recover from a zero-offset no-op drop', async ({
  page,
}) => {
  const regressionState = {
    status: 'running',
    refreshPending: false,
    initialPath: '/welcome',
    initialTitle: '个人门户',
  }
  await openHarness(page, regressionState)
  await openDebugTopbarTabs(page)

  const initialOrder = (await readTabMotion(page, '个人门户'))?.order
  const dragTitle = initialOrder[1]
  const dragTab = page.locator('.app-tabs__item').filter({ hasText: dragTitle })
  const dragBox = await dragTab.boundingBox()
  const startX = dragBox.x + 30
  const startY = dragBox.y + dragBox.height / 2

  await dragTab.dispatchEvent('mousedown', {
    button: 0,
    buttons: 1,
    clientX: startX,
    clientY: startY,
  })
  await page.locator('body').dispatchEvent('mousemove', {
    buttons: 1,
    clientX: startX,
    clientY: startY + 14,
  })
  await page.locator('body').dispatchEvent('mouseup', {
    button: 0,
    buttons: 0,
    clientX: startX,
    clientY: startY + 14,
  })

  await expect(dragTab).not.toHaveClass(/is-dragging|is-settling/)
  expect((await readTabMotion(page, dragTitle))?.order).toEqual(initialOrder)

  await dragTab.dispatchEvent('mousedown', {
    button: 0,
    buttons: 1,
    clientX: startX,
    clientY: startY,
  })
  await page.locator('body').dispatchEvent('mousemove', {
    buttons: 1,
    clientX: startX + 86,
    clientY: startY,
  })
  await expect(dragTab).toHaveClass(/is-dragging/)
  await page.locator('body').dispatchEvent('mouseup', {
    button: 0,
    buttons: 0,
    clientX: startX,
    clientY: startY,
  })

  await expect(dragTab).not.toHaveClass(/is-dragging|is-settling/)
  expect((await readTabMotion(page, dragTitle))?.order).toEqual(initialOrder)

  await page.waitForTimeout(0)
  await dragTab.click()
  await expect(page.locator('.app-tabs__item.is-active')).toContainText(dragTitle)

  await dragTab.getByRole('button', { name: `关闭标签 ${dragTitle}` }).click()
  await expect(dragTab).toHaveCount(0)
  await expect(page.locator('.app-tabs__item')).toHaveCount(2)
})

test('debug topbar restores the public shell after opening the app, detouring away, and closing the app without refreshing', async ({ page }) => {
  const regressionState = {
    status: 'running',
    refreshPending: false,
    initialPath: '/welcome',
    initialTitle: '个人门户',
  }
  await openHarness(page, regressionState)

  await expect(page.locator('.custom-top-navbar')).toHaveCount(1)
  await expect(page.locator('.custom-top-navbar .title')).toContainText('Platform Shell')

  const harnessInstanceId = await page.evaluate(() => {
    return window.__DEBUG_TOPBAR_PLAYWRIGHT_HARNESS__.instanceId
  })

  let navigationRequests = 0
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      navigationRequests += 1
    }
  })

  await page.getByRole('button', { name: '进入应用列表' }).evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  })
  await expect(page).toHaveURL(new RegExp(`${APP_LIST_ROUTE}$`))
  await expect(page.locator('.app-tabs__item.is-active')).toContainText('应用列表')
  await expect(page.locator('.custom-top-navbar')).toHaveCount(1)
  await expect(page.locator('.custom-top-navbar .title')).toContainText('Platform Shell')
  await expect(page.locator('.helper-buttons')).toBeHidden()

  await page.getByRole('button', { name: '通过应用卡片打开 Debug Topbar Regression' }).evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  })
  await expect(page.locator('.app-tabs__item.is-active')).toContainText('Debug Topbar Regression')
  await expect(page.getByTestId('debug-topbar-dev-page')).toBeVisible()
  await expect(page.locator('.helper-buttons')).toBeVisible()

  await page.evaluate(() => window.__DEBUG_TOPBAR_PLAYWRIGHT_HARNESS__.switchToTab('个人门户'))
  await expect(page.locator('.app-tabs__item.is-active')).toContainText('个人门户')
  await expect(page.locator('.custom-top-navbar')).toHaveCount(1)
  await expect(page.locator('.custom-top-navbar .title')).toContainText('Platform Shell')
  await expect(page.locator('.helper-buttons')).toBeHidden()

  await page.evaluate(() => window.__DEBUG_TOPBAR_PLAYWRIGHT_HARNESS__.switchToTab('Debug Topbar Regression'))
  await expect(page.locator('.app-tabs__item.is-active')).toContainText('Debug Topbar Regression')
  await expect(page.locator('.helper-buttons')).toBeVisible()

  const closeButton = page.locator('.wrapperCustomStyle-closeAppButton').first()
  await expect(closeButton).toBeVisible()
  await closeButton.click()
  await page.getByRole('button', { name: /确定|确认/ }).last().click()

  await expect(page.locator('.custom-top-navbar')).toHaveCount(1)
  await expect(page.locator('.custom-top-navbar .title')).toContainText('Platform Shell')
  await expect(page.locator('.custom-top-navbar .helper-buttons')).toBeHidden()
  await expect(page.locator('.helper-buttons')).toBeHidden()
  await expect
    .poll(async () => {
      return page.evaluate(() => {
        return {
          beforeUnloadCount: window.__DEBUG_TOPBAR_PLAYWRIGHT_HARNESS__.beforeUnloadCount,
          instanceId: window.__DEBUG_TOPBAR_PLAYWRIGHT_HARNESS__.instanceId,
        }
      })
    })
    .toEqual({ beforeUnloadCount: 0, instanceId: harnessInstanceId })
  expect(navigationRequests).toBe(0)
})
