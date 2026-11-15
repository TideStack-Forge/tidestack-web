const { test, expect } = require('@playwright/test')

const { attachScreenshotEvidence } = require('./helpers/evidence')

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

async function openHostMenuRoute(page, route) {
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
  await targetItem.click()

  await schemaResponsePromise
  await expect(page).toHaveURL(route.urlPattern)
  await expectActiveTabTitle(page, route.title)
  if (route.readyText) {
    await expect(page.getByText(route.readyText, { exact: true })).toBeVisible()
  }
}

async function logoutFromHeaderMenu(page) {
  const trigger = page.locator('.app-header .app-user-menu__trigger')
  const dropdown = page.locator('.app-header .app-user-menu__dropdown')
  const logoutItem = dropdown.locator('.app-user-menu__item').filter({
    hasText: '退出',
  })

  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(dropdown).toBeVisible()
  await expect(logoutItem).toBeVisible()
  await logoutItem.click()
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

test('main app host success path covers login, AMIS routes, tab switching, and logout with screenshot evidence', async ({
  page,
}, testInfo) => {
  await preloadAuthProviders(page)
  await page.goto('/login')

  await expectLoginPageReady(page)
  await attachScreenshotEvidence({
    page,
    testInfo,
    name: 'login-page',
  })

  await page.getByPlaceholder('请输入用户名').fill('mock-admin')
  await page.getByPlaceholder('请输入密码').fill('mock-password')
  await page.locator('.login-form__button').click()

  await expectLayoutReady(page)
  await attachScreenshotEvidence({
    page,
    testInfo,
    name: 'login-success-layout',
  })

  await openHostMenuRoute(page, ORDERS_ROUTE)
  await attachScreenshotEvidence({
    page,
    testInfo,
    name: 'menu-one-open',
  })

  await openHostMenuRoute(page, APPROVAL_ROUTE)
  await expect(
    page.locator('.app-tabs__item').filter({ hasText: ORDERS_ROUTE.title })
  ).toBeVisible()
  await expect(
    page.locator('.app-tabs__item').filter({ hasText: APPROVAL_ROUTE.title })
  ).toBeVisible()
  await attachScreenshotEvidence({
    page,
    testInfo,
    name: 'menu-two-open',
  })

  await page.locator('.app-tabs__item').filter({ hasText: ORDERS_ROUTE.title }).click()
  await expect(page).toHaveURL(ORDERS_ROUTE.urlPattern)
  await expectActiveTabTitle(page, ORDERS_ROUTE.title)
  await attachScreenshotEvidence({
    page,
    testInfo,
    name: 'tab-returned',
  })

  await logoutFromHeaderMenu(page)
  await expectLoginPageReady(page)
  await attachScreenshotEvidence({
    page,
    testInfo,
    name: 'logout-returned-login',
  })
})
