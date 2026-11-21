const { test, expect } = require('@playwright/test')
const path = require('path')
const root = path.resolve(__dirname, '../../../../../..')
const hostMetadata = path.join(root, 'ability/ouroboros-integration-management/ouroboros-integration-management-runtime/src/main/metadata')
const authMetadata = path.join(root, 'ability/ouroboros-external-auth-configuration/src/main/metadata')
const oidcMetadata = path.join(root, 'ability/ouroboros-oidc-server/src/main/metadata')
const rpcMetadata = path.join(root, 'ability/ouroboros-enterprise-rpc/ouroboros-enterprise-rpc-runtime/src/main/metadata')

async function open(page, { mode = 'ldap', conflict = false } = {}) {
  const writes = []
  const calls = []
  page.on('request', (request) => calls.push(new URL(request.url()).pathname))
  await page.route('**/integration-test-page', (route) => route.fulfill({
    json: require(path.join(hostMetadata, 'system-setting/integration-management.ui-schema.json')),
  }))
  await page.route('**/api/sys/integration-management/sections/*', (route) => {
    const connections = new URL(route.request().url()).pathname.endsWith('/connections')
    const schemaPath = connections
      ? mode === 'rpc' ? '/system-setting/integration-management/enterprise-rpc'
        : mode === 'settings' ? null : '/system-setting/integration-management/external-auth/ldap'
      : ['ldap', 'rpc'].includes(mode) ? null : `/system-setting/integration-management/applications/${mode}`
    return route.fulfill({ json: { code: 0, data: schemaPath ? {
      type: 'service', schemaApi: { method: 'get', url: '/api/ui-schema', data: { path: schemaPath } },
    } : { type: 'tpl', tpl: '当前账号没有此区域的管理权限。' } } })
  })
  await page.route('**/api/ui-schema?**', (route) => {
    const requested = new URL(route.request().url()).searchParams.get('path')
    const metadata = requested.endsWith('/enterprise-rpc') ? rpcMetadata
      : requested.includes('/external-auth/') ? authMetadata : oidcMetadata
    return route.fulfill({ json: { code: 0, data: require(path.join(metadata, `${requested.slice(1)}.ui-schema.json`)).schema } })
  })
  const changes = { providers: [{ key: 'corp-directory', enabled: false, displayName: '集团目录', urls: [], attributeMapping: {} }] }
  await page.route('**/api/sys/external-auth/ldap', (route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      writes.push(body)
      if (conflict) return route.fulfill({ json: { code: 409, msg: '配置已被其他操作修改，请核对最新配置' } })
      return route.fulfill({ json: { code: 0, data: { changes: body.changes, expectedRevision: 'revision-2' } } })
    }
    return route.fulfill({ json: { code: 0, data: { changes, expectedRevision: 'revision-1' } } })
  })
  await page.route('**/api/sys/auth-clients/settings', (route) => route.fulfill({
    json: { code: 0, data: { expectedRevision: 'settings-1', settings: {
      enabled: false, accessTokenTimeToLive: 'PT30M', refreshTokenTimeToLive: 'P7D',
    } } },
  }))
  await page.route('**/api/sys/auth-clients/registration', (route) => route.fulfill({
    json: { code: 0, data: { revision: 'dcr-1', settings: { enabled: false, mode: 'INITIAL_ACCESS_TOKEN', redirectPolicy: {}, rateLimit: {} } } },
  }))
  await page.goto('/enterprise-integration-playwright-harness.html')
  await page.waitForFunction(() => window.integrationHarness?.ready)
  return { writes, calls }
}

test('[EIM-CONFIG-001] external login edits in the upper section without requesting client data', async ({ page }, info) => {
  const { writes, calls } = await open(page)
  await expect(page.getByRole('heading', { name: '外部连接', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '应用接入', exact: true })).toBeVisible()
  await page.locator('input[name="displayName"]').fill('更新后的集团目录')
  await page.getByRole('button', { name: '保存登录配置', exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0].expectedRevision).toBe('revision-1')
  expect(writes[0].changes.providers[0].displayName).toBe('更新后的集团目录')
  expect(calls.some((url) => url.startsWith('/api/sys/auth-clients'))).toBe(false)
  await info.attach('integration-management-external-login', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})

test('[EIM-CONFIG-002] a concurrent configuration edit preserves the administrators draft', async ({ page }) => {
  await open(page, { conflict: true })
  await page.locator('input[name="displayName"]').fill('保留本次输入')
  await page.getByRole('button', { name: '保存登录配置', exact: true }).click()
  await expect(page.getByText('配置已被其他操作修改，请核对最新配置', { exact: true })).toBeVisible()
  await expect(page.locator('input[name="displayName"]')).toHaveValue('保留本次输入')
})

test('[EIM-RPC-001] API guidance links to existing RPC management without invoking APIs', async ({ page }) => {
  const { calls } = await open(page, { mode: 'rpc' })
  await expect(page.getByText('测试仍需原 RPC 管理权限及企业 API 调用权限；发送消息等写接口可能产生真实业务效果。', { exact: true })).toBeVisible()
  const entry = page.getByRole('button', { name: '查看接口与测试', exact: true })
  await expect(entry).toBeVisible()
  expect(calls.some(url => url.startsWith('/api/sys/rpc'))).toBe(false)
  expect(calls.some(url => url.startsWith('/api/sys/auth-clients'))).toBe(false)
  await entry.click()
  await expect(page).toHaveURL(/\/system-setting\/rpc-runtime-management$/)
})

test('[EIM-CONFIG-001] server settings and DCR load independently of the application list', async ({ page }) => {
  let state = await open(page, { mode: 'settings' })
  await expect(page.locator('input[name="settings.accessTokenTimeToLive"]')).toHaveValue('PT30M')
  expect(state.calls).not.toContain('/api/sys/auth-clients')
  state = await open(page, { mode: 'registration' })
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible()
  expect(state.calls).not.toContain('/api/sys/auth-clients')
})
