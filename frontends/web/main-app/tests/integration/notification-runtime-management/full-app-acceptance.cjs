const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium, expect } = require('@playwright/test')

// Runs against the actual Mothership and built shell. No HTTP routes are mocked.
const origin = process.env.NOTIFICATION_ACCEPTANCE_BASE_URL
const secretFile = process.env.NOTIFICATION_ACCEPTANCE_SECRETS
const phase = process.argv[2]
if (
  process.env.NOTIFICATION_ISOLATED_FIXTURE !== '1' ||
  !origin ||
  !['127.0.0.1', 'localhost'].includes(new URL(origin).hostname) ||
  !secretFile ||
  !['initial', 'after-restart', 'upgrade', 'follow-default'].includes(phase)
) {
  throw new Error(
    'Select an isolated loopback fixture, secrets file and acceptance phase'
  )
}
const secrets = JSON.parse(fs.readFileSync(secretFile, 'utf8'))
const evidence = path.resolve(process.env.NOTIFICATION_ACCEPTANCE_EVIDENCE)
fs.mkdirSync(evidence, { recursive: true })
const templateApi = '/api/sys/notification-template/runtime-acceptance'
const groupApi = '/api/sys/configuration/workbench/group?path=notification.email'
const retainedFile = path.join(path.dirname(secretFile), 'acceptance-state.json')
const readState = () => JSON.parse(fs.readFileSync(retainedFile, 'utf8'))
const record = (id, details) => {
  fs.appendFileSync(
    path.join(evidence, 'assertions.jsonl'),
    JSON.stringify({ phase, id, result: 'pass', ...details }) + '\n'
  )
}

async function run() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const api = context.request
  const headers = {}
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  async function call(method, route, data, auth = headers, base = origin) {
    const response = await api.fetch(base + route, { method, headers: auth, data })
    const body = await response.json()
    return { status: response.status(), body }
  }
  async function ok(method, route, data, auth, base) {
    const result = await call(method, route, data, auth, base)
    assert.equal(result.body.code, 0, `${method} ${route}: ${result.body.msg}`)
    return result.body.data
  }
  async function login(user = 'admin') {
    const data = await ok(
      'POST',
      '/api/auth/login',
      {
        principalType: 'username',
        principal: user,
        credentials: secrets.adminPassword,
      },
      {}
    )
    return { Authorization: `Bearer ${data.accessToken.token}` }
  }
  async function uiLogin(
    user = 'admin',
    target = '/system-setting/notification-templates'
  ) {
    await page.goto(origin + '/login?redirect=' + encodeURIComponent(target))
    await page.locator('#login-username').fill(user)
    await page.locator('#login-password').fill(secrets.adminPassword)
    await page.locator('button[type=submit]').click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30000 })
  }
  const definition = () => ok('GET', templateApi + '/runtime-definition')
  const group = () => ok('GET', groupApi)
  const command = (current, changes) => ({
    expectedDefaultRevision: current.defaultRevision,
    expectedOverrideRevision: current.overrideRevision,
    ...(changes ? { changes } : {}),
  })
  try {
    Object.assign(headers, await login())
    if (phase === 'initial') {
      const previous = await definition()
      if (previous.hasOverride) {
        await ok('POST', templateApi + '/restore-default', command(previous))
      }
      const anonymous = await call(
        'GET',
        templateApi + '/runtime-definition',
        undefined,
        {}
      )
      assert([401, 403].includes(anonymous.status))
      const menus = await ok('GET', '/api/authored-menu-tree')
      assert(JSON.stringify(menus).includes('/system-setting/notification-templates'))
      assert(JSON.stringify(menus).includes('/system-setting/notification-channels'))
      await uiLogin()
      await page
        .locator('.app-sidebar__body')
        .getByText('通知模板', { exact: true })
        .click()
      await expect(
        page.getByRole('button', { name: '运行时验收默认 V1', exact: true })
      ).toBeVisible()
      await page.getByRole('button', { name: '运行时验收默认 V1', exact: true }).click()
      await expect(
        page.getByRole('button', { name: '编辑配置', exact: true })
      ).toBeVisible()
      const opened = await definition()
      assert.equal(opened.hasOverride, false)
      assert.equal(opened.effectiveTemplate.isEnabled, false)
      await page.getByRole('button', { name: '编辑配置', exact: true }).click()
      await page.getByLabel('模板标题', { exact: true }).fill('完整应用保存的覆盖')
      await page.getByRole('button', { name: '检查配置', exact: true }).click()
      await expect(page.getByLabel('检查结果')).toContainText('检查配置通过')
      assert.equal((await definition()).hasOverride, false)
      await page.getByRole('button', { name: '保存并生效', exact: true }).click()
      await page.getByRole('button', { name: '确认保存并生效', exact: true }).click()
      await expect(
        page.getByRole('status').filter({ hasText: '配置已保存并生效' })
      ).toBeVisible()
      const saved = await definition()
      assert.equal(saved.effectiveTemplate.title, '完整应用保存的覆盖')
      assert.equal(saved.modifiedBy, 'admin')
      assert.equal(saved.effectiveTemplate.isEnabled, false)
      assert.deepEqual(
        saved.effectiveTemplate.payloadSchema,
        opened.effectiveTemplate.payloadSchema
      )
      await page.screenshot({
        path: path.join(evidence, 'full-shell-saved.png'),
        fullPage: true,
      })
      record('NRM-SHELL-001', {
        defaultRevision: saved.defaultRevision,
        overrideRevision: saved.overrideRevision,
      })
      await page
        .locator('.app-sidebar__body')
        .getByText('通知渠道', { exact: true })
        .click()
      await expect(
        page.getByRole('columnheader', { name: '渠道', exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole('cell', { name: '邮件通知', exact: true })
      ).toBeVisible()

      const oldItems = (await group()).items
      const host = oldItems.find((item) => item.key === 'notification.email.host')
      const secret = oldItems.find(
        (item) => item.key === 'notification.email.authorizationCode'
      )
      const credential = secrets.cacheSecret
      await ok('PUT', '/api/sys/configuration', [
        {
          key: host.key,
          operation: 'SET',
          value: 'node-a.invalid',
          expectedRevision: host.revision,
        },
        {
          key: secret.key,
          operation: 'SET',
          value: credential,
          expectedRevision: secret.revision,
        },
      ])
      const updated = await group()
      assert(!JSON.stringify(updated).includes(credential))
      assert.equal(
        updated.items.find((item) => item.key === host.key).value,
        'node-a.invalid'
      )
      const secretProjection = updated.items.find((item) => item.key === secret.key)
      assert.equal(secretProjection.metadata.secretConfigured, true)
      record('NRM-SECRET-001', { configured: true })

      const roleId = 'notification-acceptance-template-only'
      const role = await call('GET', '/api/sys/role/' + roleId)
      if (role.body.code !== 0 || !role.body.data) {
        await ok('POST', '/api/sys/role', { id: roleId, name: '通知模板验收角色' })
      }
      await ok('PUT', '/api/sys/role/' + roleId + '/authority', [
        { authority: 'systemSetting.notificationTemplate' },
      ])
      for (const [userIdentity, roles] of [
        ['notification-template-operator', [roleId]],
        ['notification-ungranted', []],
      ]) {
        const found = await call('GET', '/api/sys/user/' + userIdentity)
        if (found.body.code !== 0 || !found.body.data) {
          await ok('POST', '/api/sys/user', {
            userIdentity,
            password: secrets.adminPassword,
            roles,
          })
        }
      }
      const operator = await login('notification-template-operator')
      assert.equal(
        (await call('GET', templateApi + '/runtime-definition', undefined, operator)).body
          .code,
        0
      )
      assert.equal((await call('GET', groupApi, undefined, operator)).status, 403)
      const denied = await login('notification-ungranted')
      assert.equal(
        (await call('GET', templateApi + '/runtime-definition', undefined, denied))
          .status,
        403
      )
      const deniedMenu = await ok('GET', '/api/authored-menu-tree', undefined, denied)
      assert(
        !JSON.stringify(deniedMenu).includes('/system-setting/notification-templates')
      )
      await context.clearCookies()
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
      const deniedReads = []
      page.on('request', (request) => {
        if (
          /\/api\/(sys\/notification-template|notification\/adapter-schema\/management)/.test(
            request.url()
          )
        ) {
          deniedReads.push(new URL(request.url()).pathname)
        }
      })
      await uiLogin('notification-ungranted')
      await expect(
        page.locator('.app-sidebar__body').getByText('通知模板', { exact: true })
      ).toHaveCount(0)
      for (const route of [
        '/system-setting/notification-templates',
        '/system-setting/notification-templates/detail?name=runtime-acceptance',
        '/system-setting/notification-templates/edit?name=runtime-acceptance',
        '/system-setting/notification-channels',
      ]) {
        await page.goto(origin + route)
        await expect(
          page.getByText('无权访问通知配置，请联系管理员分配权限。', { exact: true })
        ).toBeVisible()
        await expect(page.getByPlaceholder('模板标题或标识')).toHaveCount(0)
        await expect(
          page.getByRole('button', { name: '保存并生效', exact: true })
        ).toHaveCount(0)
      }
      assert.deepEqual(
        deniedReads,
        [],
        'Denied pages must not initialize protected data requests'
      )
      await page.screenshot({
        path: path.join(evidence, 'full-shell-ungranted.png'),
        fullPage: true,
      })
      record('NRM-RBAC-001', {
        anonymous: anonymous.status,
        ungranted: 403,
        configurationIndependent: true,
      })
      fs.writeFileSync(
        retainedFile,
        JSON.stringify({
          defaultRevision: opened.defaultRevision,
          savedTitle: saved.effectiveTemplate.title,
        }),
        { mode: 0o600 }
      )
    } else if (phase === 'after-restart') {
      const retained = readState()
      const current = await definition()
      assert.equal(current.effectiveTemplate.title, retained.savedTitle)
      assert.equal(current.hasOverride, true)
      const historical = await ok(
        'GET',
        '/api/sys/notification-template/historical-only/runtime-definition'
      )
      assert.equal(historical.defaultExists, false)
      assert.equal(historical.availableActions.edit, false)
      assert.equal(historical.availableActions.restore, false)
      assert.equal(
        (
          await call(
            'PUT',
            '/api/sys/notification-template/historical-only/runtime-override',
            command(historical, { title: 'forbidden' })
          )
        ).status,
        409
      )
      record('NRM-UPGRADE-001', {
        persisted: true,
        legacyBackfill: true,
        historicalReadOnly: true,
      })
      const second = process.env.NOTIFICATION_ACCEPTANCE_SECOND_URL
      assert(second && ['127.0.0.1', 'localhost'].includes(new URL(second).hostname))
      const secondAuthData = await ok(
        'POST',
        '/api/auth/login',
        {
          principalType: 'username',
          principal: 'admin',
          credentials: secrets.adminPassword,
        },
        {},
        second
      )
      const secondAuth = { Authorization: `Bearer ${secondAuthData.accessToken.token}` }
      const secondDefinition = await ok(
        'GET',
        templateApi + '/runtime-definition',
        undefined,
        secondAuth,
        second
      )
      assert.equal(secondDefinition.overrideRevision, current.overrideRevision)
      const warm = await ok('GET', groupApi, undefined, secondAuth, second)
      assert.equal(
        warm.items.find((item) => item.key === 'notification.email.host').value,
        'node-a.invalid'
      )
      const host = (await group()).items.find(
        (item) => item.key === 'notification.email.host'
      )
      await ok('PUT', '/api/sys/configuration', [
        {
          key: host.key,
          operation: 'SET',
          value: 'node-b-visible.invalid',
          expectedRevision: host.revision,
        },
      ])
      const visible = (
        await ok('GET', groupApi, undefined, secondAuth, second)
      ).items.find((item) => item.key === host.key)
      assert.equal(visible.value, 'node-b-visible.invalid')
      assert.notEqual(visible.revision, host.revision)
      const fresh = await definition()
      await ok(
        'PUT',
        templateApi + '/runtime-override',
        command(fresh, { title: '跨实例可见的覆盖' })
      )
      assert.equal(
        (
          await ok(
            'GET',
            templateApi + '/runtime-definition',
            undefined,
            secondAuth,
            second
          )
        ).effectiveTemplate.title,
        '跨实例可见的覆盖'
      )
      await ok(
        'PUT',
        '/api/sys/configuration',
        (await group()).items
          .filter((item) =>
            ['notification.email.host', 'notification.email.authorizationCode'].includes(
              item.key
            )
          )
          .map((item) => ({
            key: item.key,
            operation: 'RESTORE_DEFAULT',
            expectedRevision: item.revision,
          }))
      )
      const restored = (
        await ok('GET', groupApi, undefined, secondAuth, second)
      ).items.filter((item) =>
        ['notification.email.host', 'notification.email.authorizationCode'].includes(
          item.key
        )
      )
      assert(
        restored.every(
          (item) => item.revision.startsWith('default-') && !item.configValue
        )
      )
      record('NRM-CLUSTER-001', {
        processes: 2,
        warmedSharedCache: true,
        saveAndRestoreVisible: true,
      })
    } else if (phase === 'upgrade') {
      const retained = readState()
      const current = await definition()
      assert.notEqual(current.defaultRevision, retained.defaultRevision)
      assert.equal(current.defaultTemplate.title, '运行时验收默认 V2')
      assert.equal(current.effectiveTemplate.title, '跨实例可见的覆盖')
      assert.equal(current.baseChanged, true)
      const stale = command(current, { title: '过期部署默认写入' })
      stale.expectedDefaultRevision = retained.defaultRevision
      assert.equal(
        (await call('PUT', templateApi + '/runtime-override', stale)).status,
        409
      )
      await ok('POST', templateApi + '/restore-default', command(current))
      const restored = await definition()
      assert.equal(restored.hasOverride, false)
      assert.equal(restored.effectiveTemplate.title, '运行时验收默认 V2')
      assert.equal(restored.overrideRevision, 'NONE')
      record('NRM-DEFAULT-001', { staleRejected: true, restoredVersion: 'V2' })
    } else {
      const current = await definition()
      assert.equal(current.hasOverride, false)
      assert.equal(current.effectiveTemplate.title, '运行时验收默认 V3')
      const host = (await group()).items.find(
        (item) => item.key === 'notification.email.host'
      )
      assert.equal(host.value, 'deployment-v3.invalid')
      assert(host.revision.startsWith('default-'))
      assert(!host.configValue)
      record('NRM-DEFAULT-002', {
        subsequentDeployment: 'V3',
        templateAndChannelFollowDefaults: true,
      })
    }
    assert.deepEqual(errors, [], 'Uncaught errors in full application shell')
    console.log(JSON.stringify({ phase, result: 'pass' }))
  } catch (error) {
    console.error('Acceptance failed before cleanup:', error.message)
    await page.screenshot({
      path: path.join(evidence, phase + '-failure.png'),
      fullPage: true,
    })
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
