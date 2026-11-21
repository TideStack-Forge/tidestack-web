const { test, expect } = require('@playwright/test')
const path = require('path')
const root = path.resolve(__dirname, '../../../../../..')
const { schema } = require(path.join(root, 'ability/ouroboros-organization-structure/ouroboros-organization-structure-enterprise-runtime/src/main/metadata/system-setting/integration-management/enterprise-directory.ui-schema.json'))

async function open(page, { canBind = true, canSynchronize = true, failRead = false,
  bindings = [], scopes = [], complete = true, failApply = false } = {}) {
  const writes = []
  const reads = []
  const unbinds = []
  const applies = []
  await page.route('**/integration-test-page', route => route.fulfill({ json: { schema } }))
  await page.route('**/api/sys/enterprise-directory/management-state', route => route.fulfill({ json: { code: 0, data: { canBind, canSynchronize } } }))
  await page.route('**/api/sys/enterprise-directory/connections', route => route.fulfill({ json: { code: 0, data: { options: [{ label: '集团飞书', value: 'feishu-main' }] } } }))
  await page.route('**/api/sys/enterprise-directory/snapshot?**', route => {
    reads.push(new URL(route.request().url()).searchParams.get('connectionId'))
    return route.fulfill({ json: failRead ? { code: -1, msg: '目录读取失败，请检查通讯录权限' } : { code: 0, data: {
      connectionId: 'feishu-main', revision: 'connection-1', snapshot: { complete: true,
        departments: [{ externalId: 'rd', name: '研发部', parentExternalId: '0' }],
        members: [{ externalId: 'alice-feishu', name: '外部甲', departmentExternalIds: ['rd'], active: true }],
      },
    } } })
  })
  await page.route('**/api/sys/enterprise-directory/local-options?**', route => route.fulfill({ json: { code: 0, data: {
    options: [{ label: '本地甲', value: 'employee-a' }],
  } } }))
  await page.route('**/api/sys/enterprise-directory/bindings*', route => {
    if (route.request().method() === 'POST') {
      writes.push(route.request().postDataJSON())
      return route.fulfill({ json: { code: 0, data: {} } })
    }
    return route.fulfill({ json: { code: 0, data: { items: bindings } } })
  })
  await page.route('**/api/sys/enterprise-directory/bindings/*/unbind', route => {
    unbinds.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() })
    return route.fulfill({ json: { code: 0, data: {} } })
  })
  await page.route('**/api/sys/enterprise-directory/scopes*', route => route.fulfill({ json: { code: 0, data: { items: scopes } } }))
  await page.route('**/api/sys/enterprise-directory/scopes/*/preview', route => route.fulfill({ json: { code: 0, data: {
    runId: 'run-1', complete,
    changes: [{ objectType: 'MEMBER', externalId: 'alice-feishu', name: '外部甲', action: '新增（不自动匹配）', candidates: [] }],
    missingPendingReview: ['MEMBER:missing-user'],
    primaryDepartmentChoices: [{ externalId: 'alice-feishu', name: '外部甲',
      departmentOptions: [{ label: '研发部', value: 'rd' }, { label: '产品部', value: 'product' }] }],
  } } }))
  await page.route('**/api/sys/enterprise-directory/runs/*/apply', route => {
    applies.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() })
    return route.fulfill({ json: failApply ? { code: -1, msg: '关联已改变，请重新预览' } : { code: 0, data: {} } })
  })
  await page.goto('/enterprise-integration-playwright-harness.html')
  await page.waitForFunction(() => window.integrationHarness?.ready)
  return { writes, reads, unbinds, applies }
}

async function choose(page, label, value) {
  const field = page.locator('.cxd-Form-item:visible').filter({ has: page.locator('label').filter({ hasText: label }) }).first()
  await field.locator('.cxd-Select').click()
  await page.getByText(value, { exact: true }).last().click()
}

test('[EIM-DIRECTORY-001] read and bind an existing employee without creating a login binding', async ({ page }, info) => {
  const { writes, reads } = await open(page)
  await choose(page, '企业连接', '集团飞书')
  await page.getByRole('button', { name: '读取企业目录', exact: true }).click()
  await expect(page.getByText('外部甲', { exact: true })).toBeVisible()
  expect(reads).toEqual(['feishu-main'])
  await page.getByRole('button', { name: '关联本地员工', exact: true }).click()
  await expect(page.getByText('仅建立组织关联，不创建登录绑定，不改变本地资料或账号权限。', { exact: true })).toBeVisible()
  await choose(page, '本地对象', '本地甲')
  await page.getByRole('dialog').getByRole('button', { name: '提交', exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]).toEqual({ connectionId: 'feishu-main', objectType: 'MEMBER', externalId: 'alice-feishu', localId: 'employee-a' })
  await info.attach('enterprise-directory-bind', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})

test('[EIM-DIRECTORY-002] readers see the directory without binding or synchronization operations', async ({ page }) => {
  const { writes } = await open(page, { canBind: false, canSynchronize: false })
  await choose(page, '企业连接', '集团飞书')
  await page.getByRole('button', { name: '读取企业目录', exact: true }).click()
  await expect(page.getByText('研发部', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '关联本地员工', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '关联本地部门', exact: true })).toHaveCount(0)
  await page.getByText('主来源同步', { exact: true }).click()
  await expect(page.getByRole('button', { name: '设置主来源', exact: true })).toHaveCount(0)
  expect(writes).toHaveLength(0)
})

test('[EIM-DIRECTORY-003] failed reads remain visible and cannot offer binding actions', async ({ page }) => {
  const { writes } = await open(page, { failRead: true })
  await choose(page, '企业连接', '集团飞书')
  await page.getByRole('button', { name: '读取企业目录', exact: true }).click()
  await expect(page.getByText('目录读取失败，请检查通讯录权限', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '关联本地员工', exact: true })).toHaveCount(0)
  expect(writes).toHaveLength(0)
})

const sourceScope = { id: 'company-a', connectionId: 'feishu-main', externalRootId: '0', enabled: true, version: 2 }

test('[EIM-DIRECTORY-004] require an explicit primary department and preserve failed preview submissions', async ({ page }) => {
  const { applies } = await open(page, { scopes: [sourceScope], failApply: true })
  await page.getByText('主来源同步', { exact: true }).click()
  await page.getByRole('button', { name: '预览同步', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('外部甲', { exact: true }).first()).toBeVisible()
  await expect(dialog.getByText(/MEMBER:missing-user/)).toBeVisible()
  await dialog.getByRole('button', { name: '应用本次同步', exact: true }).click()
  expect(applies).toHaveLength(0)
  await dialog.locator('.cxd-InputTable .cxd-Select').click()
  await page.getByText('产品部', { exact: true }).last().click()
  await dialog.getByText('已核对新增、候选绑定和任职变化，确认应用此次预览', { exact: true }).click()
  await dialog.getByRole('button', { name: '应用本次同步', exact: true }).click()
  await expect(page.getByText('关联已改变，请重新预览', { exact: true })).toBeVisible()
  expect(applies).toHaveLength(1)
  expect(applies[0].path).toBe('/api/sys/enterprise-directory/runs/run-1/apply')
  expect(applies[0].body.confirmCreation).toBe(true)
  expect(applies[0].body.primaryDepartmentChoices).toEqual([
    expect.objectContaining({ externalId: 'alice-feishu', primaryDepartmentId: 'product' }),
  ])
  await expect(dialog.getByText('产品部', { exact: true })).toBeVisible()
})

test('[EIM-DIRECTORY-005] incomplete previews cannot be applied', async ({ page }) => {
  const { applies } = await open(page, { scopes: [sourceScope], complete: false })
  await page.getByText('主来源同步', { exact: true }).click()
  await page.getByRole('button', { name: '预览同步', exact: true }).click()
  await expect(page.getByText('读取不完整，本次预览不能应用。请核对通讯录权限和外部授权范围。', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '应用本次同步', exact: true })).toHaveCount(0)
  expect(applies).toHaveLength(0)
})

test('[EIM-DIRECTORY-006] unbind only after confirmation with the displayed relationship version', async ({ page }) => {
  const { unbinds } = await open(page, { bindings: [{ id: 'binding-1', objectType: 'MEMBER', externalId: 'alice-feishu',
    localId: 'employee-a', active: true, externalRouteKey: 'route-key', version: 7 }] })
  await page.getByText('已有组织关联', { exact: true }).click()
  await choose(page, '企业连接', '集团飞书')
  await page.getByRole('button', { name: '解绑', exact: true }).click()
  await expect(page.getByText(/登录绑定需在用户管理中另行核对和解绑/)).toBeVisible()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  expect(unbinds).toHaveLength(0)
  await page.getByRole('button', { name: '解绑', exact: true }).click()
  await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect.poll(() => unbinds.length).toBe(1)
  expect(unbinds[0]).toEqual({ path: '/api/sys/enterprise-directory/bindings/binding-1/unbind',
    body: { expectedVersion: 7, acknowledgeImpact: true } })
})
