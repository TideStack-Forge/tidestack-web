const { test, expect } = require('@playwright/test')
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../../..')
const productionSchemas = path.join(root, 'tmp/testing-evidence/enterprise-management-schemas.json')
const hostMetadata = path.join(root, 'ability/ouroboros-integration-management/ouroboros-integration-management-runtime/src/main/metadata')

async function toggle(page, label) {
  await page.locator('.cxd-Form-item').filter({ has: page.getByText(label, { exact: true }) })
    .locator('[data-role="switch"]').click()
}

async function open(page, { provider = 'wecom', conflict = false, enabled = true, orphanCredentials = [], verifyFailure = false } = {}) {
  const schemas = JSON.parse(fs.readFileSync(productionSchemas, 'utf8'))
  const writes = []
  const budgetWrites = []
  const credentialClears = []
  const checks = []
  const requests = []
  page.on('request', request => requests.push(new URL(request.url()).pathname))
  await page.route('**/integration-test-page', route => route.fulfill({
    json: require(path.join(hostMetadata, 'system-setting/integration-management.ui-schema.json')),
  }))
  await page.route('**/api/sys/integration-management/sections/*', route => route.fulfill({ json: { code: 0, data:
    new URL(route.request().url()).pathname.endsWith('/connections') ? {
      type: 'service', schemaApi: `/api/sys/enterprise-connections/providers/${provider}/management-schema`,
    } : { type: 'tpl', tpl: '当前账号没有应用接入管理权限。' },
  } }))
  await page.route('**/api/sys/enterprise-connections/providers/*/management-schema*', route => route.fulfill({
    json: { code: 0, data: schemas[provider] },
  }))
  const state = {
    connection: { connectionId: `${provider}-main`, provider, corpId: 'corp-main', credentialRef: `managed:${provider}-main`,
      enabled, auth: { enabled: false } },
    isExisting: true, initialEnabled: enabled, replaceCredential: false,
    credentialState: { configured: true, credentialVersion: 'generation-1' },
    businessCallbackUrl: `https://platform.example/api/enterprise-callbacks/${provider}-main/callback`,
    expectedRevisions: { 'enterprise.connections': 'connections-1', 'enterprise.credentials': 'credentials-1' },
    orphanCredentials,
  }
  await page.route('**/api/sys/enterprise-connections/providers/*/budget', route => {
    if (route.request().method() === 'PUT') budgetWrites.push(route.request().postDataJSON())
    return route.fulfill({ json: { code: 0, data: {
      requestsPerSecond: budgetWrites.at(-1)?.requestsPerSecond ?? 5,
      expectedRevision: budgetWrites.length ? 'budget-2' : 'budget-1',
    } } })
  })
  await page.route('**/api/sys/enterprise-connections/credentials/*/clear', route => {
    credentialClears.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() })
    state.orphanCredentials = []
    state.expectedRevisions = { 'enterprise.connections': 'connections-1', 'enterprise.credentials': 'credentials-2' }
    return route.fulfill({ json: { code: 0, data: state } })
  })
  await page.route('**/api/sys/enterprise-connections/providers/*/configuration*', route => route.fulfill({ json: { code: 0, data: state } }))
  await page.route('**/api/sys/enterprise-connections/*/verify', route => {
    checks.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() })
    return route.fulfill({ json: verifyFailure ? { code: 502, msg: '应用令牌远程检查失败' } : { code: 0, data: {
      connectionId: `${provider}-main`, provider, checkedAt: '2026-11-16T12:00:00Z',
      message: '已保存连接的应用令牌远程检查通过。本次不验证业务权限。',
    } } })
  })
  await page.route('**/api/sys/enterprise-connections', route => {
    if (route.request().method() !== 'PUT') return route.fulfill({ json: { code: 0, data: state } })
    const body = route.request().postDataJSON()
    writes.push(body)
    if (conflict) return route.fulfill({ json: { code: 409, msg: '连接已被其他管理员修改，请刷新核对' } })
    Object.assign(state, { connection: body.connection, isExisting: true, initialEnabled: body.connection.enabled,
      expectedRevisions: { 'enterprise.connections': 'connections-2', 'enterprise.credentials': 'credentials-2' } })
    return route.fulfill({ json: { code: 0, data: state } })
  })
  await page.goto('/enterprise-integration-playwright-harness.html')
  await page.waitForFunction(() => window.integrationHarness?.ready)
  await expect(page.locator('input[name="connection.connectionId"]')).toHaveValue(`${provider}-main`)
  return { writes, requests, budgetWrites, credentialClears, checks }
}

test('[EIM-ENTERPRISE-006] explicit diagnosis sends no connection draft or entered secret', async ({ page }) => {
  const { checks, writes } = await open(page)
  await toggle(page, '启用企业登录')
  await toggle(page, '填写或替换应用凭据')
  await page.locator('input[name="credential.secret"]').fill('unsaved-private-draft')
  await page.getByRole('button', { name: '检查已保存连接', exact: true }).click()
  await expect.poll(() => checks.length).toBe(1)
  expect(checks[0]).toEqual({ path: '/api/sys/enterprise-connections/wecom-main/verify', body: {} })
  expect(writes).toHaveLength(0)
  await expect(page.getByText('已保存连接的应用令牌远程检查通过。本次不验证业务权限。', { exact: true })).toBeVisible()
  await expect(page.locator('input[name="credential.secret"]')).toHaveValue('unsaved-private-draft')
})

test('[EIM-ENTERPRISE-006] failed diagnosis leaves the saved state and current draft intact', async ({ page }) => {
  const { checks, writes } = await open(page, { verifyFailure: true })
  await toggle(page, '启用企业登录')
  await page.getByRole('button', { name: '检查已保存连接', exact: true }).click()
  await expect.poll(() => checks.length).toBe(1)
  await expect(page.getByRole('dialog').getByText('应用令牌远程检查失败', { exact: true })).toBeVisible()
  expect(writes).toHaveLength(0)
  await expect(page.locator('.cxd-Form-item').filter({ has: page.getByText('启用企业登录', { exact: true }) })
    .getByRole('checkbox')).toBeChecked()
})

test('[EIM-ENTERPRISE-001] rotate a self-built application credential with both authoritative revisions', async ({ page }, info) => {
  const { writes, requests } = await open(page)
  await expect(page.locator('input[name="businessCallbackUrl"]')).toHaveValue(
    'https://platform.example/api/enterprise-callbacks/wecom-main/callback'
  )
  await expect(page.locator('input[name="credential.secret"]')).toHaveCount(0)
  await toggle(page, '填写或替换应用凭据')
  await page.locator('input[name="credential.agentId"]').fill('100001')
  await page.locator('input[name="credential.secret"]').fill('new-private-secret')
  await page.getByRole('button', { name: '保存企业连接', exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0].credential).toMatchObject({ agentId: '100001', secret: 'new-private-secret' })
  expect(writes[0].expectedRevisions).toEqual({ 'enterprise.connections': 'connections-1', 'enterprise.credentials': 'credentials-1' })
  expect(writes[0].connection.credentialRef).toBe('managed:wecom-main')
  expect(writes[0]).not.toHaveProperty('credentialState')
  expect(writes[0]).not.toHaveProperty('businessCallbackUrl')
  await expect(page.locator('input[name="credential.secret"]')).toHaveCount(0)
  expect(requests.some(url => url.startsWith('/api/sys/auth-clients'))).toBe(false)
  await info.attach('enterprise-connection-management', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})

test('[EIM-ENTERPRISE-002] unchanged credential is omitted and a CAS failure preserves the local draft', async ({ page }) => {
  const { writes } = await open(page, { provider: 'dingtalk', conflict: true })
  await toggle(page, '启用企业登录')
  await page.getByRole('button', { name: '保存企业连接', exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0]).not.toHaveProperty('credential')
  expect(writes[0].connection.auth.enabled).toBe(true)
  await expect(page.getByText('连接已被其他管理员修改，请刷新核对', { exact: true })).toBeVisible()
  await expect(page.locator('input[name="connection.connectionId"]')).toHaveValue('dingtalk-main')
})

test('[EIM-ENTERPRISE-003] disabling requires an explicit impact acknowledgement', async ({ page }) => {
  const { writes } = await open(page)
  await toggle(page, '启用连接')
  await expect(page.getByText('停用后，新登录、通知、同步和 API 调用将被拒绝。请自行处理在途业务，并核对企业平台后台配置。')).toBeVisible()
  await page.getByRole('button', { name: '保存企业连接', exact: true }).click()
  expect(writes).toHaveLength(0)
  await page.getByText('已了解停用影响，由管理员负责后续处理', { exact: true }).click()
  await page.getByRole('button', { name: '保存企业连接', exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0].connection.enabled).toBe(false)
  expect(writes[0].acknowledgeDisable).toBe(true)
})

test('[EIM-ENTERPRISE-004] shared API budget uses its own revision without submitting the connection draft', async ({ page }) => {
  const { writes, budgetWrites } = await open(page)
  await toggle(page, '启用企业登录')
  await page.getByRole('button', { name: '调用预算', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const budget = dialog.locator('input[name="requestsPerSecond"]')
  await expect(budget).toHaveValue('5')
  await budget.fill('8')
  await dialog.getByRole('button', { name: '提交', exact: true }).click()
  await expect.poll(() => budgetWrites.length).toBe(1)
  expect(budgetWrites[0]).toEqual({ requestsPerSecond: 8, expectedRevision: 'budget-1' })
  expect(writes).toHaveLength(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await page.getByRole('button', { name: '保存企业连接', exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0].connection.auth.enabled).toBe(true)
  expect(writes[0].expectedRevisions['enterprise.credentials']).toBe('credentials-1')
})

test('[EIM-ENTERPRISE-005] orphan credential clear can be cancelled and refreshes authoritative revisions after confirmation', async ({ page }) => {
  const { writes, requests, credentialClears } = await open(page, { orphanCredentials: [
    { connectionId: 'retired-app', provider: 'wecom', credentialVersion: 'generation-old' },
  ] })
  await page.getByRole('button', { name: '凭据维护', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('retired-app', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: '清除', exact: true }).click()
  await page.getByRole('button', { name: '取消', exact: true }).last().click()
  expect(credentialClears).toHaveLength(0)
  const initialReads = requests.filter(url => url === '/api/sys/enterprise-connections').length
  await dialog.getByRole('button', { name: '清除', exact: true }).click()
  await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect.poll(() => credentialClears.length).toBe(1)
  expect(credentialClears[0]).toEqual({
    path: '/api/sys/enterprise-connections/credentials/retired-app/clear',
    body: { expectedRevisions: { 'enterprise.connections': 'connections-1', 'enterprise.credentials': 'credentials-1' } },
  })
  await expect(dialog.getByText('retired-app', { exact: true })).toHaveCount(0)
  await expect.poll(() => requests.filter(url => url === '/api/sys/enterprise-connections').length).toBeGreaterThan(initialReads)
  expect(writes).toHaveLength(0)
})
