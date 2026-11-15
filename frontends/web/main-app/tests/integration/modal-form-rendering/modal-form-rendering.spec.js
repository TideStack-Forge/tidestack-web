const { test, expect } = require('@playwright/test')
const { startHarness } = require('./harness/server')

let harness
let errors

test.beforeAll(async () => {
  harness = await startHarness()
})
test.afterAll(async () => {
  await harness?.close()
})
test.beforeEach(async ({ page }) => {
  errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
})
test.afterEach(() => {
  expect(errors, 'browser errors, including MobX-caught React #185').toEqual([])
})

async function openModal(page, query = '') {
  await page.goto(`${harness.url}/?${query}`)
  await page.waitForFunction(() => window.__modalFormHarness?.ready)
  await page.getByRole('button', { name: /^(配置角色|配置组织|新增)$/ }).click()
}

function footer(page, type = 'drawer') {
  return page.locator(type === 'drawer' ? '.cxd-Drawer-footer' : '.cxd-Modal-footer')
}

async function expectInitialized(page, kind = 'role') {
  const init =
    kind === 'organization'
      ? '/api/user/test-user/company'
      : '/api/sys/user/test-user/role'
  const source = kind === 'organization' ? '/api/organization/companies' : '/api/sys/role'
  const urls = kind === 'add' ? [source] : [init, source]
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__modalFormHarness.requests
          .filter(
            (request) =>
              request.method === 'get' &&
              !request.url.startsWith('/api/form-schema') &&
              !request.url.startsWith('/api/ui-schema')
          )
          .map((request) => request.url)
          .sort()
      )
    )
    .toEqual(urls.sort())
  await expect(page.locator('.cxd-Spinner-overlay.in')).toHaveCount(0)
}

for (const kind of ['role', 'organization', 'add']) {
  test(`${kind} initializes once and exposes the default submit action`, async ({
    page,
  }) => {
    await openModal(page, `kind=${kind}`)
    await expectInitialized(page, kind)
    await expect(
      footer(page, kind === 'add' ? 'dialog' : 'drawer').getByRole('button', {
        name: '提交',
        exact: true,
      })
    ).toBeVisible()
  })
}

for (const modal of ['drawer', 'dialog']) {
  test(`${modal} inherits a form title without an update loop`, async ({ page }) => {
    await openModal(page, `modal=${modal}&title=implicit&readonly=true`)
    await expectInitialized(page)
    await expect(
      page.locator(modal === 'drawer' ? '.cxd-Drawer-title' : '.cxd-Modal-title')
    ).toHaveText('表单标题')
    await expect(
      footer(page, modal).getByRole('button', { name: '提交', exact: true })
    ).toBeVisible()
  })

  test(`${modal} renders a schema title and submits through the inherited footer action`, async ({
    page,
  }) => {
    await openModal(page, `modal=${modal}&title=object`)
    await expectInitialized(page)
    await expect(
      page.locator(modal === 'drawer' ? '.cxd-Drawer-title' : '.cxd-Modal-header')
    ).toHaveText('表单 test-user')
    await footer(page, modal).getByRole('button', { name: '提交', exact: true }).click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__modalFormHarness.requests
            .filter((request) => request.method === 'put')
            .map((request) => request.data)
        )
      )
      .toEqual([['item-1']])
  })

  test(`${modal} resolves a remote form title and actions without duplicate initialization`, async ({
    page,
  }) => {
    await openModal(page, `modal=${modal}&title=implicit&async=true`)
    await expectInitialized(page)
    expect(
      await page.evaluate(
        () =>
          window.__modalFormHarness.requests.filter((request) =>
            request.url.startsWith('/api/form-schema')
          ).length
      )
    ).toBe(1)
    await expect(
      page.locator(modal === 'drawer' ? '.cxd-Drawer-title' : '.cxd-Modal-title')
    ).toHaveText('表单标题')
    await expect(
      footer(page, modal).getByRole('button', { name: '提交', exact: true })
    ).toBeVisible()
  })

  test(`${modal} preserves an explicit footer action and submits initialized form data`, async ({
    page,
  }) => {
    await openModal(page, `modal=${modal}&actions=explicit`)
    await expectInitialized(page)
    await footer(page, modal)
      .getByRole('button', { name: '确认配置', exact: true })
      .click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__modalFormHarness.requests
            .filter((request) => request.method === 'put')
            .map((request) => request.data)
        )
      )
      .toEqual([['item-1']])
  })
}

test('explicit empty actions remain empty', async ({ page }) => {
  await openModal(page, 'actions=empty')
  await expectInitialized(page)
  await expect(footer(page).getByRole('button')).toHaveCount(0)
})

test('explicit empty form actions suppress the default submit', async ({ page }) => {
  await openModal(page, 'actions=form-empty&title=implicit')
  await expectInitialized(page)
  await expect(footer(page).getByRole('button')).toHaveCount(0)
})

test('explicit empty modal title is preserved', async ({ page }) => {
  await openModal(page, 'title=empty')
  await expectInitialized(page)
  await expect(page.locator('.cxd-Drawer-title')).toHaveCount(0)
})

test('action synchronization can be disabled', async ({ page }) => {
  await openModal(page, 'title=implicit&sync=false')
  await expectInitialized(page)
  await expect(page.locator('.cxd-Drawer-title')).toHaveCount(0)
  await expect(
    footer(page).getByRole('button', { name: '提交', exact: true })
  ).toHaveCount(0)
})

test('schema titles and default actions survive closing and reopening', async ({
  page,
}) => {
  await openModal(page, 'title=implicit')
  for (let cycle = 1; cycle <= 3; cycle += 1) {
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.__modalFormHarness.requests.filter(
              (request) => request.url === '/api/sys/user/test-user/role'
            ).length
        )
      )
      .toBe(cycle)
    await expect(page.locator('.cxd-Drawer-title')).toHaveText('表单标题')
    await expect(
      footer(page).getByRole('button', { name: '提交', exact: true })
    ).toBeVisible()
    await page.locator('.cxd-Drawer-close').click()
    await expect(page.locator('.cxd-Drawer-content')).toHaveCount(0)
    if (cycle < 3)
      await page.getByRole('button', { name: '配置角色', exact: true }).click()
  }
})

for (const modal of ['drawer', 'dialog']) {
  for (const mode of ['reference', 'lazy']) {
    test(`${modal} normalizes ${mode} schemas through the same modal lifecycle`, async ({
      page,
    }) => {
      await openModal(page, `modal=${modal}&title=implicit&async=${mode}`)
      await expectInitialized(page)
      if (mode === 'reference') {
        expect(
          await page.evaluate(
            () =>
              window.__modalFormHarness.requests.filter((request) =>
                request.url.startsWith('/api/ui-schema')
              ).length
          )
        ).toBe(1)
      }
      await expect(
        page.locator(modal === 'drawer' ? '.cxd-Drawer-title' : '.cxd-Modal-title')
      ).toHaveText('表单标题')
      await expect(
        footer(page, modal).getByRole('button', { name: '提交', exact: true })
      ).toBeVisible()
    })
  }
  test(`${modal} preserves explicit empty metadata on remote forms`, async ({ page }) => {
    await openModal(page, `modal=${modal}&title=empty&actions=empty&async=true`)
    await expectInitialized(page)
    await expect(
      page.locator(modal === 'drawer' ? '.cxd-Drawer-title' : '.cxd-Modal-title')
    ).toHaveCount(0)
    await expect(footer(page, modal).getByRole('button')).toHaveCount(0)
  })
  test(`${modal} ignores a schema response from a closed opening`, async ({ page }) => {
    await openModal(page, `modal=${modal}&title=implicit&async=delayed`)
    await page.waitForFunction(() => !!window.__modalFormHarness.resolveSchema)
    await page
      .locator(modal === 'drawer' ? '.cxd-Drawer-close' : '.cxd-Modal-close')
      .click()
    const content = page.locator(
      modal === 'drawer' ? '.cxd-Drawer-content' : '.cxd-Modal-content'
    )
    await expect(content).toHaveCount(0)
    await page.getByRole('button', { name: '配置角色', exact: true }).click()
    await expectInitialized(page)
    await page.evaluate(() => window.__modalFormHarness.resolveSchema())
    await expect(
      page.locator(modal === 'drawer' ? '.cxd-Drawer-title' : '.cxd-Modal-title')
    ).toHaveText('表单标题')
    await expect(
      footer(page, modal).getByRole('button', { name: '提交', exact: true })
    ).toBeVisible()
  })
}
