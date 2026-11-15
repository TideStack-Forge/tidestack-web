const { test, expect } = require('@playwright/test')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const FRONTEND = process.env.RPC_TESTING_FRONTEND_URL
const BACKEND = process.env.RPC_TESTING_BACKEND_URL
const TARGET = process.env.RPC_TESTING_TARGET_STUB_URL
const APP = process.env.RPC_TESTING_APP_NAME
const WORKSPACE = process.env.RPC_TESTING_APP_WORKSPACE
const evidence = path.resolve(
  process.env.RPC_TESTING_EVIDENCE_DIR ||
    '../../../tmp/testing-evidence/rpc-model-testing'
)
let stub
const exchanges = []
test.beforeEach(() => {
  exchanges.length = 0
})
test.beforeAll(async () => {
  const target = new URL(TARGET)
  stub = http.createServer((request, response) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => {
      exchanges.push({
        method: request.method,
        url: request.url,
        body: Buffer.concat(chunks).toString(),
        hasBearerAuthorization:
          request.headers.authorization?.startsWith('Bearer ') || false,
      })
      response.setHeader('Content-Type', 'application/json')
      response.end(
        JSON.stringify(
          request.url.startsWith('/token')
            ? { access_token: 'acceptance-runtime-token', expires_in: 3600 }
            : {
                marker: new URL(request.url, TARGET).searchParams.get('marker'),
                ok: true,
              }
        )
      )
    })
  })
  await new Promise((resolve) =>
    stub.listen(Number(target.port), target.hostname, resolve)
  )
})

test('SEM-01/02/03/04/05: real configuration-driven dependencies reinitialize without calls and reject old revisions', async ({
  page,
  request,
}) => {
  test.setTimeout(120000)
  const startCount = exchanges.length
  const login = await request.post(`${BACKEND}/api/auth/login`, {
    data: {
      username: process.env.RPC_TESTING_USERNAME,
      password: process.env.RPC_TESTING_PASSWORD,
    },
  })
  const auth = await login.json()
  expect(auth.code).toBe(0)
  const headers = { Authorization: `Bearer ${auth.data.accessToken.token}` }
  const id = Date.now()
  const name = `AASemantic${id}`
  const credential = `ConfigAuth${id}`
  const tokenA = `ZTokenA${id}`,
    tokenB = `ZTokenB${id}`
  const keys = Object.fromEntries(
    ['auth', 'mode', 'tokenModel', 'timeout', 'retry'].map((key) => [
      key,
      `acceptance.${key}.${id}`,
    ])
  )
  const reference = (key) => `#{${keys[key]}}`
  const create = async (kind, model) => {
    const response = await request.post(`${BACKEND}/api/dev/${APP}/${kind}`, {
      headers,
      data: model,
    })
    expect((await response.json()).code).toBe(0)
  }
  const model = (modelName, url, parameters = []) => ({
    name: modelName,
    title: modelName,
    type: 'OpenApi',
    isEnabled: true,
    retry: 0,
    timeout: 3000,
    request: { method: 'POST', url, parameters },
  })
  await create('rpc-auth', {
    name: credential,
    title: '配置驱动认证验收',
    type: 'AccessToken',
    isEnabled: true,
    accessToken: {
      mode: reference('mode'),
      request: { modelName: reference('tokenModel') },
      accessTokenPath: '$.access_token',
      expiresConfig: { expiresValueSource: 'response', expiresPath: '$.expires_in' },
    },
  })
  await create(
    'rpc-model',
    model(tokenA, `${TARGET}/token-a`, [
      { name: 'first', in: 'body', value: '$firstInput', required: true },
    ])
  )
  await create(
    'rpc-model',
    model(tokenB, `${TARGET}/token-b`, [
      { name: 'second', in: 'body', value: '$secondInput', required: true },
    ])
  )
  await create('rpc-model', {
    ...model(name, `${TARGET}/echo?marker=semantics`),
    authCredential: reference('auth'),
    timeout: reference('timeout'),
    retry: reference('retry'),
    description: '${this is literal[}',
  })
  const endpoint = `${BACKEND}/api/dev/${APP}/rpc-model/${name}/test`
  const initialize = async (configValues) => {
    const response = await request.post(`${endpoint}/init-form`, {
      headers,
      data: { configValues },
    })
    const result = await response.json()
    expect(result.code).toBe(0)
    return result.data
  }
  const partial = await initialize({})
  expect(partial.ready).toBe(false)
  expect(new Set(partial.missingConfigKeys)).toEqual(
    new Set([keys.auth, keys.timeout, keys.retry])
  )
  expect(exchanges).toHaveLength(startCount)
  const removedGet = await request.get(`${endpoint}/init-form`, { headers })
  expect(removedGet.status()).toBe(405)
  const beforeCommit = git('rev-parse', 'HEAD')
  const preparations = []
  const responseTasks = []
  page.on('response', (response) => {
    if (response.url().includes(`/rpc-model/${name}/test/init-form`))
      responseTasks.push(
        (async () => {
          const payload = await response.json()
          const body = response.request().postDataJSON()
          preparations.push({
            method: response.request().method(),
            path: new URL(response.url()).pathname,
            overrideKeys: Object.keys(body.configValues),
            code: payload.code,
            ready: payload.data?.ready,
            revision: payload.data?.revision,
            missingConfigKeys: payload.data?.missingConfigKeys,
            variables: payload.data?.variables.map((item) => item.name),
          })
        })()
      )
  })
  await page.goto(`${FRONTEND}/login`)
  await page.getByPlaceholder('请输入用户名').fill(process.env.RPC_TESTING_USERNAME)
  await page.getByPlaceholder('请输入密码').fill(process.env.RPC_TESTING_PASSWORD)
  await page.locator('.login-form__button').click()
  await expect(page).not.toHaveURL(/\/login/)
  await page.goto(`${FRONTEND}/dev/${APP}/rpc-model`)
  const row = page.getByRole('row').filter({ hasText: name })
  await row.locator('.fa-play').click()
  const footer = page.locator('.cxd-Drawer-footer')
  await expect(page.getByText(keys.auth, { exact: true })).toBeVisible()
  await expect(
    footer.locator('.cxd-Button').filter({ hasText: /^运行测试$/ })
  ).toHaveClass(/is-disabled/)
  await page.screenshot({
    path: path.join(evidence, 'semantics-missing-config.png'),
    fullPage: true,
    animations: 'disabled',
  })
  const configRow = (key) =>
    page
      .locator('.cxd-InputTable tbody tr')
      .filter({ has: page.getByText(key, { exact: true }) })
  const fill = async (key, value) =>
    configRow(key).locator('input[type="password"]').fill(value)
  await fill(keys.timeout, '3000')
  await fill(keys.retry, '0')
  await fill(keys.auth, credential)
  await expect(page.getByText(keys.mode, { exact: true })).toBeVisible()
  await fill(keys.mode, 'dynamic')
  await fill(keys.tokenModel, tokenA)
  await expect(page.getByText('firstInput', { exact: true })).toBeVisible()
  await expect(footer.getByRole('button', { name: '运行测试' })).toBeEnabled()
  expect(exchanges).toHaveLength(startCount)
  const firstConfig = {
    [keys.auth]: credential,
    [keys.mode]: 'dynamic',
    [keys.tokenModel]: tokenA,
    [keys.timeout]: '3000',
    [keys.retry]: '0',
  }
  const first = await initialize(firstConfig)
  expect(first.ready).toBe(true)
  const changedConfig = { ...firstConfig, [keys.tokenModel]: tokenB }
  const stale = await request.post(endpoint, {
    headers,
    data: {
      revision: first.revision,
      variables: { firstInput: 'one' },
      configValues: changedConfig,
    },
  })
  expect((await stale.json()).data.error.reason).toBe('RESOURCE_CHANGED')
  expect(exchanges).toHaveLength(startCount)
  await fill(keys.tokenModel, tokenB)
  await expect(
    footer.locator('.cxd-Button').filter({ hasText: /^运行测试$/ })
  ).toHaveClass(/is-disabled/)
  await expect(page.getByText('secondInput', { exact: true })).toBeVisible()
  await expect(page.getByText('firstInput', { exact: true })).toHaveCount(0)
  const variable = page
    .locator('.cxd-InputTable tbody tr')
    .filter({ has: page.getByText('secondInput', { exact: true }) })
  await variable.locator('textarea').fill('second-value')
  await expect(footer.getByRole('button', { name: '运行测试' })).toBeEnabled()
  await page.screenshot({
    path: path.join(evidence, 'semantics-dependency-switch.png'),
    fullPage: true,
    animations: 'disabled',
  })
  expect(exchanges).toHaveLength(startCount)
  await footer.getByRole('button', { name: '运行测试' }).click()
  await expect(page.getByText(/请求成功/)).toBeVisible()
  expect(exchanges.slice(startCount).map((item) => item.url)).toEqual([
    '/token-b',
    '/echo?marker=semantics',
  ])
  expect(JSON.parse(exchanges[startCount].body)).toEqual({ second: 'second-value' })
  expect(exchanges[startCount + 1].hasBearerAuthorization).toBe(true)
  expect(git('rev-parse', 'HEAD')).toBe(beforeCommit)
  await page.screenshot({
    path: path.join(evidence, 'semantics-live-result.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await footer.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(page.locator('.cxd-Drawer')).toHaveCount(0)
  await Promise.all(responseTasks)
  fs.writeFileSync(
    path.join(evidence, 'semantics-live-journey.json'),
    JSON.stringify(
      {
        name,
        credential,
        tokenA,
        tokenB,
        initialMissing: partial.missingConfigKeys,
        removedGetStatus: removedGet.status(),
        beforeCommit,
        afterCommit: git('rev-parse', 'HEAD'),
        preparations,
        exchanges: exchanges.slice(startCount),
      },
      null,
      2
    )
  )
})
test.afterAll(async () => {
  if (stub) await new Promise((resolve) => stub.close(resolve))
})
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    const screenshot = testInfo.outputPath('live-failure.png')
    await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' })
    await testInfo.attach('live-failure', { path: screenshot, contentType: 'image/png' })
  }
})
const git = (...args) =>
  execFileSync('git', args, { cwd: WORKSPACE, encoding: 'utf8' }).trim()

async function enterRequestUrl(page, value) {
  const editor = page
    .locator('.rpc-model-editor .cxd-Combo-form .cxd-InputGroup')
    .first()
    .locator('.cxd-EditorControl')
    .nth(1)
  await editor.scrollIntoViewIfNeeded()
  await expect(editor.getByRole('code')).toBeVisible()
  await editor.locator('textarea.inputarea').focus()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(value)
}

test('RPC-T01/T03/T16/T20/T21: real main app saves, tests latest workspace, then explicitly commits', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120000)
  page.on('pageerror', (error) => console.log('RPC page error:', error.message))
  page.on('response', async (response) => {
    if (response.url().includes(`/api/dev/${APP}/rpc-model`)) {
      const payload = await response.json().catch(() => ({}))
      console.log(
        'RPC API',
        response.request().method(),
        new URL(response.url()).pathname,
        response.status(),
        payload.code,
        payload.code ? payload.msg : ''
      )
    }
  })
  const login = await request.post(`${BACKEND}/api/auth/login`, {
    data: {
      username: process.env.RPC_TESTING_USERNAME,
      password: process.env.RPC_TESTING_PASSWORD,
    },
  })
  const auth = await login.json()
  expect(auth.code).toBe(0)
  const token = auth.data.accessToken.token
  const headers = { Authorization: `Bearer ${token}` }
  const api = async (suffix) =>
    (
      await request.get(`${BACKEND}/api/dev/${APP}/rpc-model/${suffix}`, { headers })
    ).json()
  const modelName = `Acceptance${Date.now()}`
  const initialCommit = git('rev-parse', 'HEAD')
  await page.goto(`${FRONTEND}/login`)
  await page.getByPlaceholder('请输入用户名').fill(process.env.RPC_TESTING_USERNAME)
  await page.getByPlaceholder('请输入密码').fill(process.env.RPC_TESTING_PASSWORD)
  await page.locator('.login-form__button').click()
  await expect(page).not.toHaveURL(/\/login/)
  const loaded = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/dev/${APP}/rpc-model` &&
      response.request().method() === 'GET'
  )
  await page.goto(`${FRONTEND}/dev/${APP}/rpc-model`)
  await loaded
  await page.getByRole('button', { name: '新增', exact: true }).first().click()
  const drawer = page.locator('.cxd-Drawer')
  const footer = page.locator('.cxd-Drawer-footer')
  await page.locator('input[name="name"]').fill(modelName)
  await page.locator('input[name="title"]').fill('RPC 真后端验收')
  await enterRequestUrl(page, `${TARGET}/echo?marker=initial`)
  await footer.getByRole('button', { name: /保存$/ }).click()
  await expect(drawer).toBeVisible()
  await expect
    .poll(async () => (await api(`${modelName}/status`)).data?.versionState, {
      timeout: 30000,
    })
    .toBe('UNVERSIONED')
  expect(git('rev-parse', 'HEAD')).toBe(initialCommit)
  expect((await api(`${modelName}/status`)).data.versionState).toBe('UNVERSIONED')
  await enterRequestUrl(page, `${TARGET}/echo?marker=latest`)
  await page.getByText('接口测试', { exact: true }).click()
  await expect(
    footer.locator('.cxd-Button').filter({ hasText: /^运行测试$/ })
  ).toHaveClass(/is-disabled/)
  await footer.getByRole('button', { name: /保存$/ }).click()
  await expect(footer.getByRole('button', { name: /运行测试$/ })).toBeEnabled()
  expect(git('rev-parse', 'HEAD')).toBe(initialCommit)
  await expect(page.getByText('已保存，待提交', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/快照/)).toHaveCount(0)
  await page.getByText('模型配置', { exact: true }).click()
  await page.screenshot({
    path: path.join(evidence, 'drawer-live-config.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByText('接口测试', { exact: true }).click()
  await page.screenshot({
    path: path.join(evidence, 'drawer-live-parameters.png'),
    fullPage: true,
    animations: 'disabled',
  })
  const stale = await request.post(
    `${BACKEND}/api/dev/${APP}/rpc-model/${modelName}/test`,
    {
      headers,
      data: { revision: 'outdated', variables: {}, configValues: {} },
    }
  )
  expect((await stale.json()).data.error.reason).toBe('RESOURCE_CHANGED')
  expect(exchanges).toHaveLength(0)
  await footer.getByRole('button', { name: /运行测试$/ }).click()
  await expect(page.getByText(/请求成功/)).toBeVisible()
  await expect(page.locator('.rpc-model-editor__body')).toContainText('"ok":true')
  await page.getByText('响应头', { exact: true }).click()
  await expect(page.getByText('content-type', { exact: false }).first()).toBeVisible()
  await page.getByText('响应头', { exact: true }).click()
  expect(exchanges).toHaveLength(1)
  expect(exchanges[0].url).toBe('/echo?marker=latest')
  expect(git('rev-parse', 'HEAD')).toBe(initialCommit)
  await page.screenshot({
    path: path.join(evidence, 'drawer-live-test.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await testInfo.attach('live-test', {
    path: path.join(evidence, 'drawer-live-test.png'),
    contentType: 'image/png',
  })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page
      .locator('.rpc-model-editor')
      .evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).toBe(true)
  await page.screenshot({
    path: path.join(evidence, 'drawer-live-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await page.setViewportSize({ width: 1280, height: 720 })
  await footer.getByRole('button', { name: /提交$/ }).click()
  await page.locator('textarea[name="message"]').fill('RPC 测试验收：保存与提交分离')
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(drawer).toHaveCount(0)
  const finalCommit = git('rev-parse', 'HEAD')
  expect(finalCommit).not.toBe(initialCommit)
  // The formal VCS chain appends the operator to the supplied commit message.
  const committedMessage = git('log', '-1', '--format=%s')
  expect(committedMessage.split(' 操作人:')[0]).toBe('RPC 测试验收：保存与提交分离')
  const committedFiles = git(
    'diff-tree',
    '--no-commit-id',
    '--name-only',
    '-r',
    'HEAD'
  ).split('\n')
  expect(committedFiles).toEqual([`rpc-model/${modelName}.rpc.json`])
  const status = (await api(`${modelName}/status`)).data
  expect(status.versionState).toBe('NOTCHANGED')
  expect(status.lockState).toBe('UNLOCKED')
  fs.writeFileSync(
    path.join(evidence, 'live-journey.json'),
    JSON.stringify(
      { modelName, initialCommit, finalCommit, committedFiles, status, exchanges },
      null,
      2
    )
  )
})
