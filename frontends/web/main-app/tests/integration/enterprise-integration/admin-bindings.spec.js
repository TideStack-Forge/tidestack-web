const { test, expect } = require('@playwright/test')
const schema = require('../../../../../../security/ouroboros-web-security/ouroboros-web-security-rbac-manage/src/main/metadata/system-setting/user-management/detail.ui-schema.json')

async function open(page, { empty = false, failDelete = false } = {}) {
  const writes = []
  let bindings = empty ? [] : [{
    id: 'binding-1', providerKey: 'feishu-main', externalId: 'external-alice',
    displayName: 'Alice', createdAt: '2026-11-16T10:00:00',
  }]
  await page.route('**/integration-test-page', (route) => route.fulfill({ json: schema }))
  await page.route('**/api/sys/user/alice', (route) => route.fulfill({
    json: { code: 0, data: { userIdentity: 'alice', roles: [] } },
  }))
  await page.route('**/api/sys/role', (route) => route.fulfill({ json: { code: 0, data: [] } }))
  await page.route('**/api/admin/users/alice/bindings**', (route) => {
    if (route.request().method() === 'DELETE') {
      writes.push(route.request().url())
      if (failDelete) return route.fulfill({ json: { code: 40401, msg: '绑定不存在' } })
      bindings = []
      return route.fulfill({ json: { code: 0, data: null } })
    }
    return route.fulfill({ json: { code: 0, data: bindings } })
  })
  await page.goto('/enterprise-integration-playwright-harness.html')
  await page.waitForFunction(() => window.integrationHarness?.ready)
  return writes
}

test('[EIM-USER-001] shows the target user bindings, cancels safely and refreshes after confirmed unbinding', async ({ page }, info) => {
  const writes = await open(page)
  await expect(page.getByRole('cell', { name: 'feishu-main', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'external-alice', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '解绑', exact: true }).click()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  expect(writes).toHaveLength(0)
  await page.getByRole('button', { name: '解绑', exact: true }).click()
  await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.getByText('该用户尚未绑定第三方登录账号', { exact: true })).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(new URL(writes[0]).pathname).toBe('/api/admin/users/alice/bindings/binding-1')
  await info.attach('unbound-user-detail', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})

test('[EIM-USER-002] failed unbinding keeps the binding visible and shows the error', async ({ page }) => {
  const writes = await open(page, { failDelete: true })
  await page.getByRole('button', { name: '解绑', exact: true }).click()
  await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect(page.getByText('绑定不存在', { exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'external-alice', exact: true })).toBeVisible()
  expect(writes).toHaveLength(1)
})

test('[EIM-USER-003] a user without bindings has an empty list and no unbinding action', async ({ page }) => {
  await open(page, { empty: true })
  await expect(page.getByText('该用户尚未绑定第三方登录账号', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '解绑', exact: true })).toHaveCount(0)
})
