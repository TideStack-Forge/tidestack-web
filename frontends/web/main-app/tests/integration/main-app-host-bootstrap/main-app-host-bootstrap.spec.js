const { test, expect } = require('@playwright/test')

const seededToken = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 60 * 60,
  refreshTokenExpiresIn: 24 * 60 * 60,
  issuedAt: Date.now(),
}

const APP_NAME = 'Ouroboros Mock Layout'

async function seedAuthToken(page) {
  await page.addInitScript((token) => {
    window.localStorage.setItem('Ouroboros_token', JSON.stringify(token))
  }, seededToken)
}

async function seedAppName(page, appInfoOverrides = {}) {
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
          ...appInfoOverrides,
        },
      }),
    })
  })
}

for (const layoutType of ['sidebar-split', 'header-sidebar']) {
  test(`${layoutType} renders the top-level application logo without config.logo across navigation`, async ({
    page,
  }) => {
    const logo = '/api/app-metadata/logo.png'
    await seedAuthToken(page)
    await seedAppName(page, { logo, layoutType })
    await page.route(`**${logo}`, (route) =>
      route.fulfill({
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/></svg>',
      })
    )
    await page.goto('/welcome')

    const images = page.locator('.app-brand img')
    await expect(images.first()).toBeVisible()
    await expect
      .poll(() =>
        images.evaluateAll((items) => items.map((item) => item.getAttribute('src')))
      )
      .toEqual([logo])
    await expect
      .poll(() =>
        images.first().evaluate((image) => image.complete && image.naturalWidth > 0)
      )
      .toBe(true)

    if (layoutType === 'sidebar-split') {
      await page.getByRole('button', { name: '展开主应用 Host E2E', exact: true }).click()
      await page.locator('.app-sidebar').getByText('订单看板', { exact: true }).click()
    } else {
      const hostMenu = page.locator('.dual-mode-menu__item').filter({
        hasText: '主应用 Host E2E',
      })
      await hostMenu.locator('.dual-mode-menu__link').hover({ force: true })
      await hostMenu.dispatchEvent('mouseover')
      await page.locator('.app-float-menu__item').filter({ hasText: '订单看板' }).click()
    }
    await expect(page).toHaveURL(/\/mock\/orders-dashboard$/)
    await expect(images.first()).toHaveAttribute('src', logo)
    await page.getByRole('button', { name: '切换到标签 欢迎页' }).click()
    await expect(page).toHaveURL(/\/welcome$/)
    await expect(images.first()).toHaveAttribute('src', logo)
  })
}

test('confirmation title and buttons use the preferred language and preserve cancel/confirm behavior', async ({
  page,
}) => {
  const translations = {
    'id-ID': {
      systemTip: 'Pemberitahuan',
      confirm: 'Konfirmasi',
      cancel: 'Batal',
      deleteConfirmation: 'Hapus data ini?',
    },
    'en-US': {
      systemTip: 'System notice',
      confirm: 'Confirm',
      cancel: 'Cancel',
      deleteConfirmation: 'Delete this record?',
    },
    'ar-SA': {
      systemTip: 'إشعار',
      confirm: 'تأكيد',
      cancel: 'إلغاء',
      deleteConfirmation: 'حذف هذا السجل؟',
    },
    'zh-CN': {
      systemTip: '系统提示',
      confirm: '确定',
      cancel: '取消',
      deleteConfirmation: '删除这条数据？',
    },
  }
  await seedAuthToken(page)
  await seedAppName(page)
  await page.route('**/api/i18n/languages', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          items: Object.keys(translations).map((value) => ({
            value,
            label: value,
            version: '1',
            isDefault: value === 'id-ID',
          })),
        },
      },
    })
  )
  await page.route('**/api/i18n/locale/*', (route) => {
    const locale = route.request().url().split('/').pop()
    return route.fulfill({
      json: {
        code: 0,
        data: {
          locale,
          name: locale,
          version: '1',
          enabled: true,
          direction: locale === 'ar-SA' ? 'RTL' : 'LTR',
          messages: {
            common: translations[locale],
            '/mock/orders-dashboard': {
              deleteConfirmation: translations[locale].deleteConfirmation,
            },
          },
        },
      },
    })
  })
  await page.route('**/api/ui-schema?**', (route) => {
    const schemaId = new URL(route.request().url()).searchParams.get('path')
    if (schemaId !== '/mock/orders-dashboard') return route.fallback()
    return route.fulfill({
      json: {
        code: 0,
        data: {
          type: 'page',
          body: [
            {
              type: 'button',
              label: 'Delete test record',
              actionType: 'ajax',
              api: { method: 'delete', url: '/api/test/confirm-delete' },
              confirmText: '删除这条数据？',
              localeKeys: { confirmText: 'deleteConfirmation' },
            },
          ],
        },
      },
    })
  })
  let deletions = 0
  await page.route('**/api/test/confirm-delete', (route) => {
    deletions++
    return route.fulfill({ json: { code: 0, data: {} } })
  })
  await page.goto('/mock/orders-dashboard')

  for (const [locale, common] of Object.entries(translations)) {
    if (locale !== 'id-ID') {
      await page.evaluate((value) => window.$i18nDebug.switchTo(value), locale)
    }
    const trigger = page.getByRole('button', { name: 'Delete test record', exact: true })
    await trigger.click()
    await expect(page.locator('.cxd-Modal-title:visible')).toHaveText(common.systemTip)
    await expect(page.getByText(common.deleteConfirmation, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: common.cancel, exact: true }).click()
    expect(deletions).toBe(Object.keys(translations).indexOf(locale))
    await expect(page.locator('.cxd-Modal-title:visible')).toHaveCount(0)

    await trigger.click()
    await page.getByRole('button', { name: common.confirm, exact: true }).click()
    await expect.poll(() => deletions).toBe(Object.keys(translations).indexOf(locale) + 1)
    await expect(page.locator('.cxd-Modal-title:visible')).toHaveCount(0)
  }
})

test('main-app host bootstrap boots against the standalone mock service and renders the welcome route', async ({
  page,
}) => {
  await seedAuthToken(page)
  await seedAppName(page)

  await page.goto('/welcome')

  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByTestId('welcome-page')).toHaveCount(1)
  await expect(page.locator('.app-header')).toBeVisible()
  await expect(page.locator('.app-sidebar')).toBeVisible()
  await expect(page.getByText(APP_NAME)).toBeVisible()
  await expect(page.locator('.app-header .app-user-menu__name')).toHaveText('mock-admin')
  await expect(page.getByRole('button', { name: '切换到标签 欢迎页' })).toBeVisible()
})

test('layouts configured without a header do not render one or reserve its height', async ({
  page,
}) => {
  await seedAuthToken(page)
  await seedAppName(page, {
    layoutType: 'sidebar-split-no-header',
    headerEntry: '',
  })

  await page.goto('/welcome')

  await expect(page.getByTestId('welcome-page')).toHaveCount(1)
  await expect(page.locator('.app-header')).toHaveCount(0)
  await expect
    .poll(() =>
      page.locator('.app-body').evaluate((element) => element.getBoundingClientRect().top)
    )
    .toBe(0)
})

test('fullscreen routes do not render or reserve a header', async ({ page }) => {
  await seedAuthToken(page)
  await seedAppName(page)

  await page.goto('/welcome?fullscreen=true')

  await expect(page.getByTestId('welcome-page')).toHaveCount(1)
  await expect(page.locator('.app-header')).toHaveCount(0)
  await expect
    .poll(() =>
      page
        .locator('.fullscreen-layout')
        .evaluate((element) => element.getBoundingClientRect().top)
    )
    .toBe(0)
})

test('initialization failure preserves the token and retries in the same session', async ({
  page,
}) => {
  await seedAuthToken(page)
  await seedAppName(page)
  let unavailable = true
  let menuRequests = 0
  let loginWrites = 0
  page.on('request', (request) => {
    if (request.url().endsWith('/api/auth/login')) loginWrites++
  })
  await page.route('**/api/authored-menu-tree', async (route) => {
    menuRequests++
    if (unavailable) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 50000,
          msg: '服务暂时不可用，请稍后重试',
          data: null,
        }),
      })
    } else {
      await route.continue()
    }
  })
  await page.goto('/welcome')
  const recovery = page.getByTestId('error-after-login-page')
  await expect(recovery).toBeVisible()
  await expect(recovery.getByRole('heading')).toHaveText('暂时无法加载用户信息')
  await expect(recovery).toContainText('服务暂时不可用，请稍后重试')
  await expect(recovery).not.toContainText('菜单权限未配置')
  await expect(page.locator('.app-header')).toHaveCount(0)
  await expect(page.getByTestId('welcome-page')).toHaveCount(0)
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('Ouroboros_token')).accessToken
    )
  ).toBe(seededToken.accessToken)

  await recovery.getByRole('button', { name: '重新加载' }).click()
  await expect(recovery.getByRole('button', { name: '重新加载' })).toBeEnabled()
  expect(menuRequests).toBe(2)
  unavailable = false
  await recovery.getByRole('button', { name: '重新加载' }).click()
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByTestId('welcome-page')).toHaveCount(1)
  await expect(page.locator('.app-header')).toBeVisible()
  expect(menuRequests).toBe(3)
  expect(loginWrites).toBe(0)
})

for (const entry of [
  {
    name: 'password login',
    path: '/login?redirect=%2Fwelcome',
    write: '/api/auth/login',
  },
  {
    name: 'external callback',
    path: '/login/callback?code=once&redirect=%2Fwelcome',
    write: '/api/auth/login-code/exchange',
  },
  {
    name: 'external binding',
    path: '/login/bind?token=once&redirect=%2Fwelcome',
    write: '/api/auth/bind',
  },
]) {
  test(`${entry.name} recovers by reading initialization data without repeating authentication writes`, async ({
    page,
  }) => {
    const runtimeErrors = []
    page.on('pageerror', (error) => {
      runtimeErrors.push(error.message)
      console.error('Authentication page runtime failure:', error.message)
    })
    await seedAppName(page)
    let writes = 0
    let unavailable = true
    await page.route(`**${entry.write}`, async (route) => {
      writes++
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, msg: '', data: seededToken }),
      })
    })
    await page.route('**/api/authored-menu-tree', async (route) => {
      if (unavailable) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 50000,
            msg: '服务暂时不可用，请稍后重试',
            data: null,
          }),
        })
      } else {
        await route.continue()
      }
    })
    await page.goto(entry.path)
    if (entry.name === 'password login') {
      await expect(page.locator('#login-username')).toBeVisible()
      await page.locator('#login-username').fill('alice')
      await page.locator('#login-password').fill('secret')
      await page.locator('button[type="submit"]').click()
    }
    if (entry.name === 'external binding') {
      await page.getByLabel('平台用户名').fill('alice')
      await page.getByLabel('平台密码').fill('secret')
      await page.getByRole('button', { name: '绑定并登录' }).click()
    }
    const recovery = page.getByTestId('error-after-login-page')
    await expect(recovery).toBeVisible()
    await expect(recovery.getByRole('heading')).toHaveText('暂时无法加载用户信息')
    expect(writes).toBe(1)
    unavailable = false
    await recovery.getByRole('button', { name: '重新加载' }).click()
    await expect(page).toHaveURL(/\/welcome$/)
    await expect(page.locator('.app-header')).toBeVisible()
    expect(writes).toBe(1)
    expect(runtimeErrors).toEqual([])
  })
}
