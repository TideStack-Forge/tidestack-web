const { test, expect } = require('@playwright/test')
const path = require('path')
const metadata = path.resolve(
  __dirname,
  '../../../../../../ability/ouroboros-notification/ouroboros-notification-runtime/src/main/metadata'
)
const templateApi = '/api/sys/notification-template/alpha-template'
async function open(page, mode = 'detail') {
  const relative =
    mode === 'list'
      ? 'system-setting/notification-templates.ui-schema.json'
      : mode === 'channels'
        ? 'system-setting/notification-channels.ui-schema.json'
        : `system-setting/notification-templates/${mode}.ui-schema.json`
  const schema = require(path.join(metadata, relative))
  await page.route('**/notification-management-page', (route) =>
    route.fulfill({ json: schema })
  )
  await page.goto('/notification-runtime-playwright-harness.html')
  await page.waitForFunction(() => window.notificationManagementHarness?.ready)
}
async function current(request) {
  return (await (await request.get(`${templateApi}/runtime-definition`)).json()).data
}
async function restore(request) {
  const definition = await current(request)
  if (definition.hasOverride) {
    const response = await request.post(`${templateApi}/restore-default`, {
      data: {
        expectedDefaultRevision: definition.defaultRevision,
        expectedOverrideRevision: definition.overrideRevision,
        changes: {},
      },
    })
    expect(response.ok()).toBe(true)
  }
}
test.beforeEach(async ({ request }) => {
  await restore(request)
})

test('real controller and database: inspect, edit, check, save, resolve conflict and restore', async ({
  page,
  request,
}, info) => {
  const writes = []
  page.on('request', (request) => {
    if (request.method() === 'PUT') writes.push(request.postDataJSON())
  })
  await open(page)
  await expect(page.getByRole('heading', { name: 'Alpha', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '编辑配置', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '保存并生效', exact: true })
  ).toBeDisabled()
  await page.getByLabel('模板标题', { exact: true }).fill('浏览器配置')
  await page.getByLabel('添加渠道').selectOption('managed-test')
  await page.getByLabel('正文 *', { exact: true }).fill('您好 ${name}')
  await page.getByRole('button', { name: '检查配置', exact: true }).click()
  await expect(page.getByLabel('检查结果')).toContainText('检查配置通过')
  expect((await current(request)).hasOverride).toBe(false)
  expect(writes).toHaveLength(0)
  await page.getByRole('button', { name: '保存并生效', exact: true }).click()
  await page.getByRole('button', { name: '确认保存并生效', exact: true }).click()
  await expect(
    page.getByRole('status').filter({ hasText: '配置已保存并生效' })
  ).toBeVisible()
  expect((await current(request)).hasOverride).toBe(true)
  expect(Object.keys(writes[0].changes).sort()).toEqual(['channel', 'title'])
  expect(writes[0].changes.channel['managed-test'].schema.body).toBe('您好 ${name}')
  await page.getByRole('button', { name: '编辑配置', exact: true }).click()
  await page.getByLabel('模板标题', { exact: true }).fill('保留的本次输入')
  const opened = await current(request)
  const concurrent = await request.put(`${templateApi}/runtime-override`, {
    data: {
      expectedDefaultRevision: opened.defaultRevision,
      expectedOverrideRevision: opened.overrideRevision,
      changes: { title: '其他管理员的修改' },
    },
  })
  expect(concurrent.ok()).toBe(true)
  await page.getByRole('button', { name: '保存并生效', exact: true }).click()
  await expect(page.getByLabel('版本冲突')).toBeVisible()
  await expect(page.getByLabel('模板标题', { exact: true })).toHaveValue('保留的本次输入')
  await page.getByRole('button', { name: '读取最新配置，保留本次编辑' }).click()
  await expect(page.getByLabel('版本冲突')).toContainText('其他管理员的修改')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '保留本次输入，采用最新版本重新检查' }).click()
  await page.getByRole('button', { name: '保存并生效', exact: true }).click()
  await page.getByRole('button', { name: '确认保存并生效', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: '保留的本次输入', exact: true })
  ).toBeVisible()
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: '复制渠道内容', exact: true }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '您好 ${name}'
  )
  await expect(page.getByText('内容已复制到粘贴板', { exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: '与默认对比', exact: true }).click()
  await info.attach('desktop-default-comparison', {
    body: await page.screenshot({ path: info.outputPath('desktop.png'), fullPage: true }),
    contentType: 'image/png',
  })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true)
  await info.attach('mobile-default-comparison', {
    body: await page.screenshot({ path: info.outputPath('mobile.png'), fullPage: true }),
    contentType: 'image/png',
  })
  await page.getByRole('button', { name: '撤销覆盖', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('恢复后：已启用')
  await page.getByRole('button', { name: '确认撤销覆盖', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '已撤销覆盖' })).toBeVisible()
  expect((await current(request)).hasOverride).toBe(false)
})

test('committed uncertainty retains draft and blocks duplicate PUT until explicit verification', async ({
  page,
  request,
}) => {
  await open(page, 'edit')
  await page.getByLabel('模板标题', { exact: true }).fill('已提交待核对')
  await page.getByLabel('添加渠道').selectOption('managed-test')
  await page
    .getByLabel('正文 *', { exact: true })
    .fill('原始文本 <script>不会执行</script>')
  let writes = 0
  await page.route('**/alpha-template/runtime-override', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue()
    writes++
    const response = await route.fetch()
    const body = await response.json()
    expect(body.code).toBe(0)
    body.code = 503
    body.msg = '已保存，生效状态待核对'
    body.data.confirmed = false
    await route.fulfill({ status: 503, json: body })
  })
  await page.getByRole('button', { name: '保存并生效', exact: true }).click()
  await page.getByRole('button', { name: '确认保存并生效', exact: true }).click()
  await expect(page.getByLabel('提交结果待核对')).toBeVisible()
  await expect(
    page.getByRole('button', { name: '保存并生效', exact: true })
  ).toBeDisabled()
  expect((await current(request)).effectiveTemplate.title).toBe('已提交待核对')
  await page.getByRole('button', { name: '读取最新状态并核对' }).click()
  await page.getByRole('button', { name: '已核对，加载最新配置并结束本次编辑' }).click()
  await expect(page.getByRole('button', { name: '编辑配置', exact: true })).toBeVisible()
  expect(writes).toBe(1)
})

test('production list metadata filters before paging and channel catalog reads real descriptions', async ({
  page,
}) => {
  await open(page, 'list')
  await expect(page.getByRole('button', { name: 'Alpha', exact: true })).toBeVisible()
  await page.getByPlaceholder('模板标题或标识').fill('no-match')
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Alpha', exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: '重置', exact: true }).click()
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Alpha', exact: true })).toBeVisible()
  await page.unroute('**/notification-management-page')
  await open(page, 'channels')
  await expect(
    page.getByRole('cell', { name: 'Managed test', exact: true })
  ).toBeVisible()
  await expect(page.getByRole('cell', { name: '可配置', exact: true })).toBeVisible()
})

test('reused detail page loads the new template name instead of retaining its old draft', async ({
  page,
}) => {
  await open(page, 'edit')
  await page.getByLabel('模板标题', { exact: true }).fill('旧模板未提交内容')
  await page.evaluate(() => {
    void window.notificationManagementHarness.changeName('missing-template')
  })
  await expect(
    page.getByRole('heading', { name: 'missing-template', exact: true })
  ).toBeVisible()
  await expect(page.getByLabel('模板标题', { exact: true })).not.toBeVisible()
  await expect(page.getByRole('alert')).toContainText('不存在')
})

const configurationMetadata = path.resolve(
  metadata,
  '../../../../../ouroboros-configuration/ouroboros-configuration-runtime/src/main/metadata'
)
test('original configuration workbench replaces secrets, preserves blanks and really revokes overrides', async ({
  page,
  request,
}) => {
  const group = require(
    path.join(
      configurationMetadata,
      'system-setting/configuration-management/group-panel.ui-schema.json'
    )
  ).schema
  await page.route('**/notification-management-page', (route) =>
    route.fulfill({
      json: {
        schema: {
          type: 'page',
          body: {
            type: 'service',
            id: 'configurationWorkbenchGroupPanelService',
            api: '/api/sys/configuration/workbench/group?path=notification.email',
            body: group,
          },
        },
      },
    })
  )
  await page.route('**/api/ui-schema?**', (route) => {
    const requested = new URL(route.request().url()).searchParams.get('path')
    const schema = require(
      path.join(configurationMetadata, requested.slice(1) + '.ui-schema.json')
    ).schema
    return route.fulfill({ json: { code: 0, msg: '', data: schema } })
  })
  await page.goto('/notification-runtime-playwright-harness.html')
  await page.waitForFunction(() => window.notificationManagementHarness?.ready)
  const password = page.locator('input[type="password"]')
  const host = page.locator('input[type="text"]').first()
  await expect(password).toBeVisible()
  await password.fill('browser-credential-one')
  await host.fill('first.invalid')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(
    page.getByText('凭据已配置，真实值不予显示。留空保留，填写新值表示替换。')
  ).toBeVisible()
  await expect(password).toHaveValue('')
  const read = async () =>
    (
      await (
        await request.get(
          '/api/sys/configuration/workbench/group?path=notification.email'
        )
      ).json()
    ).data
  const items = (await read()).items
  const oldSecretRevision = items.find((item) =>
    item.key.endsWith('authorizationCode')
  ).revision
  expect(JSON.stringify(items)).not.toContain('browser-credential-one')
  await host.fill('second.invalid')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(host).toHaveValue('second.invalid')
  await expect
    .poll(
      async () => (await read()).items.find((item) => item.key.endsWith('host')).value
    )
    .toBe('second.invalid')
  expect(
    (await read()).items.find((item) => item.key.endsWith('authorizationCode')).revision
  ).toBe(oldSecretRevision)
  const restores = page.getByText('恢复部署默认配置', { exact: true })
  await restores.nth(0).click()
  await restores.nth(1).click()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(
    page.getByText('凭据尚未配置。填写后保存，或选择恢复部署默认。')
  ).toBeVisible()
  const restored = (await read()).items
  expect(restored.every((item) => item.revision.startsWith('default-'))).toBe(true)
  expect(restored.every((item) => !item.configValue)).toBe(true)
})
