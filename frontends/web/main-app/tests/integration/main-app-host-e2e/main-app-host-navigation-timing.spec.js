const { test, expect } = require('@playwright/test')

const APP_NAME = 'Ouroboros Mock Layout'
const USERNAME = 'mock-admin'
const HOST_MENU_TITLE = '主应用 Host E2E'
const LOGIN_URL_PATTERN = /\/login(?:\?.*)?$/
const WELCOME_URL_PATTERN = /\/welcome(?:\?.*)?$/
const PRELOADED_AUTH_PROVIDERS = [
  {
    key: 'mock-ldap',
    type: 'ldap',
    displayName: 'Mock LDAP',
    loginUrl: null,
    availability: 'healthy',
  },
]

const ORDERS_ROUTE = {
  title: '订单看板',
  schemaPath: '/mock/orders-dashboard',
  urlPattern: /\/mock\/orders-dashboard(?:\?.*)?$/,
  readyText: '订单看板页面已由独立 mock server 成功提供。',
}

const APPROVAL_ROUTE = {
  title: '审批中心',
  schemaPath: '/mock/approval-center',
  urlPattern: /\/mock\/approval-center(?:\?.*)?$/,
  readyText: '审批中心页面已由独立 mock server 成功提供。',
}

function activeTab(page) {
  return page.locator('.app-tabs__item.is-active').first()
}

async function expectLoginPageReady(page) {
  await expect(page).toHaveURL(LOGIN_URL_PATTERN)
  await expect(page.getByText(APP_NAME, { exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('请输入用户名')).toBeVisible()
  await expect(page.getByPlaceholder('请输入密码')).toBeVisible()
  await expect(page.locator('.login-form__button span')).toHaveText(/登录/)
}

async function expectActiveTabTitle(page, title) {
  await expect(activeTab(page)).toContainText(title)
}

async function expectLayoutReady(page) {
  await expect(page).toHaveURL(WELCOME_URL_PATTERN)
  await expect(page.locator('.app-header')).toBeVisible()
  await expect(page.locator('.app-sidebar')).toBeVisible()
  await expect(page.getByText(APP_NAME, { exact: true })).toBeVisible()
  await expect(page.getByText(USERNAME, { exact: true })).toBeVisible()
  await expect(
    page.locator('.dual-mode-menu__item').filter({ hasText: HOST_MENU_TITLE })
  ).toBeVisible()
  await expect(page.getByTestId('welcome-page')).toHaveCount(1)
  await expectActiveTabTitle(page, '欢迎页')
}

async function preloadAuthProviders(page) {
  await page.route('**/api/sys/web-app-info', async (route) => {
    const response = await route.fetch()
    const payload = await response.json()
    const appInfo = payload?.data && typeof payload.data === 'object' ? payload.data : {}

    await route.fulfill({
      response,
      contentType: 'application/json',
      body: JSON.stringify({
        ...payload,
        data: {
          ...appInfo,
          appName: APP_NAME,
          authProviders: Array.isArray(appInfo.authProviders)
            ? appInfo.authProviders
            : PRELOADED_AUTH_PROVIDERS,
        },
      }),
    })
  })
}

async function login(page) {
  await preloadAuthProviders(page)
  await page.goto('/login')

  await expectLoginPageReady(page)
  await page.getByPlaceholder('请输入用户名').fill('mock-admin')
  await page.getByPlaceholder('请输入密码').fill('mock-password')
  await page.locator('.login-form__button').click()
  await expectLayoutReady(page)
}

async function clickMenuRouteAndWait(page, route) {
  const hostMenu = page.locator('.dual-mode-menu__item').filter({
    hasText: HOST_MENU_TITLE,
  })
  const hostMenuLink = hostMenu.locator('.dual-mode-menu__link')
  const schemaResponsePromise = page.waitForResponse((response) => {
    return (
      response.request().method() === 'GET' &&
      response.status() === 200 &&
      response.url().includes('/api/ui-schema') &&
      response.url().includes(encodeURIComponent(route.schemaPath))
    )
  })

  await expect(hostMenu).toBeVisible()
  await hostMenuLink.hover({ force: true })
  await hostMenu.dispatchEvent('mouseover')

  const floatingMenu = page.locator('.app-float-menu__panel')
  const targetItem = floatingMenu.locator('.app-float-menu__item').filter({
    hasText: route.title,
  })

  await expect(floatingMenu).toBeVisible()
  await expect(targetItem).toBeVisible()
  const start = performance.now()
  await targetItem.click()
  await schemaResponsePromise
  await expectRouteReady(page, route)
  return performance.now() - start
}

async function clickTabAndWait(page, route) {
  const targetTab = page.locator('.app-tabs__item').filter({ hasText: route.title })

  await expect(targetTab).toBeVisible()
  const start = performance.now()
  await targetTab.click()
  await expectRouteReady(page, route)
  return performance.now() - start
}

async function expectRouteReady(page, route) {
  await expect(page).toHaveURL(route.urlPattern)
  await expectActiveTabTitle(page, route.title)
  await expect(page.getByText(route.readyText, { exact: true })).toBeVisible()
}

test('main app host menu and tab navigation timing stays responsive', async ({
  page,
}, testInfo) => {
  await login(page)

  const timings = {
    openOrdersMs: await clickMenuRouteAndWait(page, ORDERS_ROUTE),
    openApprovalMs: await clickMenuRouteAndWait(page, APPROVAL_ROUTE),
    switchBackToOrdersMs: await clickTabAndWait(page, ORDERS_ROUTE),
  }
  const roundedTimings = Object.fromEntries(
    Object.entries(timings).map(([key, value]) => [key, Math.round(value)])
  )

  console.log(`[main-app-host-navigation-timing] ${JSON.stringify(roundedTimings)}`)
  await testInfo.attach('main-app-host-navigation-timing.json', {
    body: JSON.stringify(roundedTimings, null, 2),
    contentType: 'application/json',
  })
})
