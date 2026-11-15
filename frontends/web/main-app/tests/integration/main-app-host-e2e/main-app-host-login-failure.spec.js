const { test, expect } = require('@playwright/test')

const { attachScreenshotEvidence } = require('./helpers/evidence')

const APP_NAME = 'Ouroboros Mock Layout'
const LOGIN_URL_PATTERN = /\/login(?:\?.*)?$/
const FAILURE_MESSAGE = 'Mock login rejected'

const PRELOADED_AUTH_PROVIDERS = [
  {
    key: 'mock-ldap',
    type: 'ldap',
    displayName: 'Mock LDAP',
    loginUrl: null,
    availability: 'healthy',
  },
]

async function expectLoginPageReady(page) {
  await expect(page).toHaveURL(LOGIN_URL_PATTERN)
  await expect(page.getByText(APP_NAME, { exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('请输入用户名')).toBeVisible()
  await expect(page.getByPlaceholder('请输入密码')).toBeVisible()
  await expect(page.locator('.login-form__button span')).toHaveText(/登录/)
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

test('main app host login failure keeps the user on login and surfaces the error with screenshot evidence', async ({
  page,
}, testInfo) => {
  await preloadAuthProviders(page)
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 1,
        msg: FAILURE_MESSAGE,
        data: null,
      }),
    })
  })

  await page.goto('/login')

  await expectLoginPageReady(page)
  await page.getByPlaceholder('请输入用户名').fill('mock-admin')
  await page.getByPlaceholder('请输入密码').fill('wrong-password')
  await page.locator('.login-form__button').click()

  await expect(page).toHaveURL(LOGIN_URL_PATTERN)
  await expect(page.getByText(FAILURE_MESSAGE, { exact: true })).toBeVisible()

  await attachScreenshotEvidence({
    page,
    testInfo,
    name: 'login-failure',
  })
})
