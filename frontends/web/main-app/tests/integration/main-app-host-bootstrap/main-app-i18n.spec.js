const { test, expect } = require('@playwright/test')
const namespace = '/mock/orders-dashboard'
async function setup(
  page,
  fullscreen = false,
  { authenticate = true, path = namespace } = {}
) {
  await page.addInitScript((authenticate) => {
    if (authenticate)
      localStorage.setItem(
        'Ouroboros_token',
        JSON.stringify({
          accessToken: 'audit-token',
          refreshToken: 'audit-refresh',
          expiresIn: 3600,
          refreshTokenExpiresIn: 86400,
          issuedAt: Date.now(),
        })
      )
    localStorage.setItem('i18n-preferred-locale', 'en-US')
  }, authenticate)
  await page.route('**/api/i18n/languages', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          items: ['en-US', 'id-ID'].map((value) => ({
            value,
            label: value,
            version: 'audit-1',
            isDefault: value === 'en-US',
          })),
        },
      },
    })
  )
  await page.route('**/api/i18n/locale/*', (route) => {
    const locale = route.request().url().split('/').pop()
    const english = locale === 'en-US'
    return route.fulfill({
      json: {
        code: 0,
        data: {
          locale,
          version: 'audit-1',
          enabled: true,
          direction: 'LTR',
          messages: {
            common: {
              systemTip: english ? 'System notice' : 'Pemberitahuan',
              confirm: english ? 'Confirm' : 'Konfirmasi',
              cancel: english ? 'Cancel' : 'Batal',
              'copy.success': english ? 'Copied successfully' : 'Berhasil disalin',
              'http.networkError': english
                ? 'Network connection failed'
                : 'Koneksi gagal',
              'page.notFound.title': english
                ? 'Page not found'
                : 'Halaman tidak ditemukan',
            },
            base: {
              'Alert.info': english ? 'English notice' : 'Pemberitahuan',
              confirm: english ? 'English confirm' : 'Konfirmasi',
              cancel: english ? 'English cancel' : 'Batal',
            },
            '/login': {
              'bind.title': english ? 'Bind account' : 'Hubungkan akun',
              'callback.title': english
                ? 'Completing external login'
                : 'Menyelesaikan login eksternal',
              'error.40105': english ? 'Login result expired' : 'Hasil login kedaluwarsa',
            },
            [namespace]: {
              auditText: english
                ? 'Translated English record'
                : 'Catatan Bahasa Indonesia',
            },
          },
        },
      },
    })
  })
  await page.route('**/api/ui-schema?**', (route) => {
    if (new URL(route.request().url()).searchParams.get('path') !== namespace)
      return route.fallback()
    return route.fulfill({
      json: {
        code: 0,
        data: {
          type: 'page',
          body: [
            { type: 'tpl', tpl: '原始正文', localeKeys: { tpl: 'auditText' } },
            {
              type: 'button',
              label: 'Show alert',
              onEvent: {
                click: {
                  actions: [
                    {
                      actionType: 'alert',
                      dialog: { msg: 'English alert body', title: 'Alert.info' },
                    },
                  ],
                },
              },
            },
            {
              type: 'button',
              label: 'Copy value',
              onEvent: {
                click: {
                  actions: [{ actionType: 'copy', args: { content: 'audit value' } }],
                },
              },
            },
            {
              type: 'button',
              label: 'Request failure',
              actionType: 'ajax',
              api: '/api/test/i18n-network-error',
            },
          ],
        },
      },
    })
  })
  await page.goto(path + (fullscreen ? '?fullscreen=true' : ''))
  if (path === namespace)
    await expect(
      page.getByText('Translated English record', { exact: true })
    ).toBeVisible()
}
test('alert feedback uses registered active base translations', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Show alert', exact: true }).click()
  const title = page.locator('.cxd-Modal-title:visible')
  await expect(title).toBeVisible()
  await expect(title).toHaveText('English notice')
  await expect(
    page.getByRole('button', { name: 'English confirm', exact: true })
  ).toBeVisible()
})
test('copy feedback uses the active language', async ({ page }) => {
  await setup(page)
  await page.getByRole('button', { name: 'Copy value', exact: true }).click()
  await expect(page.getByText('Copied successfully', { exact: true })).toBeVisible()
})
test('network fallback uses the active language', async ({ page }) => {
  await setup(page)
  await page.route('**/api/test/i18n-network-error', (route) => route.abort('failed'))
  await page.getByRole('button', { name: 'Request failure', exact: true }).click()
  await expect(
    page.getByText('Network connection failed', { exact: true }).first()
  ).toBeVisible()
})
test('normal layout language switch refreshes menus successfully', async ({ page }) => {
  await setup(page)
  const result = await page.evaluate(async () => {
    try {
      await window.$i18nDebug.switchTo('id-ID')
      return 'ok'
    } catch (error) {
      return error.message
    }
  })
  expect(result).toBe('ok')
})
test('fullscreen schema refreshes translations after locale switch', async ({ page }) => {
  await setup(page, true)
  await page.evaluate(() => window.$i18nDebug.switchTo('id-ID'))
  await expect
    .poll(() => page.evaluate(() => window.$i18nDebug.getLocale()))
    .toBe('id-ID')
  await expect(page.getByText('Catatan Bahasa Indonesia', { exact: true })).toBeVisible()
})

test('404 page uses public translations and refreshes without reloading', async ({
  page,
}) => {
  await setup(page)
  await page.goto('/no-such-page')
  await expect(page.getByTestId('not-found-page')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.evaluate(() => window.$i18nDebug.switchTo('id-ID'))
  await expect(
    page.getByRole('heading', { name: 'Halaman tidak ditemukan' })
  ).toBeVisible()
})

test('external account binding retains entered credentials when the language changes', async ({
  page,
}) => {
  await setup(page, false, { authenticate: false, path: '/login/bind?token=once' })
  await expect(page.getByRole('heading', { name: 'Bind account' })).toBeVisible()
  await page.locator('input[type="text"]').fill('alice')
  await page.locator('input[type="password"]').fill('secret')
  await page.locator('.language-selector').selectOption('id-ID')
  await expect(page.getByRole('heading', { name: 'Hubungkan akun' })).toBeVisible()
  await expect(page.locator('input[type="text"]')).toHaveValue('alice')
  await expect(page.locator('input[type="password"]')).toHaveValue('secret')
})

test('external login callback and its error on the login page use public translations', async ({
  page,
}) => {
  let exchangeRoute
  await page.route('**/api/auth/login-code/exchange', (route) => {
    exchangeRoute = route
  })
  await setup(page, false, { authenticate: false, path: '/login/callback?code=once' })
  await expect(
    page.getByRole('heading', { name: 'Completing external login' })
  ).toBeVisible()
  await page.locator('.language-selector').selectOption('id-ID')
  await expect(
    page.getByRole('heading', { name: 'Menyelesaikan login eksternal' })
  ).toBeVisible()
  await expect.poll(() => Boolean(exchangeRoute)).toBe(true)
  await exchangeRoute.fulfill({ json: { code: 40105 } })
  await expect(page).toHaveURL(/\/login\?error=40105/)
  await expect(page.getByText('Hasil login kedaluwarsa', { exact: true })).toBeVisible()
  await page.locator('.language-selector:visible').selectOption('en-US')
  await expect(page.getByText('Login result expired', { exact: true })).toBeVisible()
})
