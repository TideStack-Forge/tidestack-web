const { test, expect } = require('@playwright/test')
const path = require('node:path')
const { startHarness } = require('../modal-form-rendering/harness/server')
let harness
let errors
test.beforeAll(async () => {
  harness = await startHarness({
    entry: path.join(__dirname, 'harness/index.js'),
    alias: {
      '@/utils/http$': path.join(__dirname, 'harness/transport.js'),
    },
  })
})
test.afterAll(async () => harness?.close())
test.beforeEach(async ({ page }) => {
  errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(harness.url)
  await page.getByRole('button', { name: '编辑接口' }).click()
  await expect(page.locator('input[name="title"]')).toHaveValue('示例接口')
})

test('group can use an existing path, create a path and clear it through normal save', async ({
  page,
}) => {
  const group = page.locator('input[name="group"]')
  await group.fill('钉钉')
  await page.getByText('钉钉/通讯录', { exact: true }).last().click()
  await footer(page).getByRole('button', { name: '保存', exact: true }).click()
  await expect
    .poll(async () => (await calls(page, '/rpc-model/example')).at(-1)?.data?.group)
    .toBe('钉钉/通讯录')
  await group.fill('业务/订单')
  await footer(page).getByRole('button', { name: '保存', exact: true }).click()
  await expect
    .poll(async () => (await calls(page, '/rpc-model/example')).at(-1)?.data?.group)
    .toBe('业务/订单')
  await group.fill('')
  await footer(page).getByRole('button', { name: '保存', exact: true }).click()
  await expect
    .poll(async () => (await calls(page, '/rpc-model/example')).at(-1)?.data?.group)
    .toBe('')
})

test('RPC-G03: development and runtime lists use a group tree beside searchable model rows', async ({
  page,
}) => {
  await page.goto(`${harness.url}?view=groups`)
  for (const selector of ['.dev-models', '.runtime-models']) {
    await page.goto(
      `${harness.url}?view=${selector === '.dev-models' ? 'dev-list' : 'runtime-list'}`
    )
    const browser = page.locator(selector)
    const tree = browser.locator('.rpc-model-browser__aside')
    const list = browser.locator('.rpc-model-browser__list')
    await expect(list.getByText('旧接口', { exact: true })).toBeVisible()
    const treeBounds = await tree.boundingBox()
    const listBounds = await list.boundingBox()
    expect(treeBounds.x + treeBounds.width).toBeLessThanOrEqual(listBounds.x)
    await tree.getByText('钉钉', { exact: true }).click()
    await expect(list.getByText('旧接口', { exact: true })).toHaveCount(0)
    await expect(list.getByText('发送消息', { exact: true })).toBeVisible()
    await tree.getByText('通讯录', { exact: true }).click()
    await expect(list.getByText('发送消息', { exact: true })).toHaveCount(0)
    await expect(list.getByText('读取成员', { exact: true })).toBeVisible()
    await tree.locator('input[name="__rpcKeyword"]').fill('department')
    await expect(list.getByText('读取成员', { exact: true })).toHaveCount(0)
    await expect(list.getByText('读取部门', { exact: true })).toBeVisible()
    await tree.locator('input[name="__rpcKeyword"]').fill('不存在')
    await expect(list.getByText('读取部门', { exact: true })).toHaveCount(0)
    await expect(tree.getByText('消息', { exact: true })).toBeVisible()
    await tree.locator('input[name="__rpcKeyword"]').fill('')
    await tree.getByText('未分组', { exact: true }).click()
    await expect(list.getByText('旧接口', { exact: true })).toBeVisible()
    await expect(list.getByText('读取成员', { exact: true })).toHaveCount(0)
    await tree.getByText('全部模型', { exact: true }).click()
    await expect(list.getByText('读取成员', { exact: true })).toBeVisible()
    await expect(list.getByText('旧接口', { exact: true })).toBeVisible()
    await page.screenshot({
      path: path.resolve(
        __dirname,
        `../../../../../../tmp/testing-evidence/rpc-model-browser/${selector.slice(1)}.png`
      ),
      fullPage: true,
    })
  }
})

test('RPC-G04: the picker uses a group tree and list, confirms model names and cancels without changing them', async ({
  page,
}) => {
  await page.goto(`${harness.url}?view=picker`)
  const picker = page.locator('.cxd-Picker')
  const saved = page.locator('.cxd-Form-item').filter({ hasText: '实际模型名称' })
  await picker.locator('.cxd-Picker-btn').click()
  const modal = page.locator('.cxd-Modal')
  const tree = modal.locator('.rpc-model-browser__aside')
  const list = modal.locator('.rpc-model-browser__list')
  await tree.getByText('钉钉', { exact: true }).click()
  await expect(saved).not.toContainText('group:')
  await tree.getByText('通讯录', { exact: true }).click()
  await expect(list.getByText('发送消息', { exact: true })).toHaveCount(0)
  await tree.locator('input[name="__rpcKeyword"]').fill('MEMBER')
  await expect(list.getByText('读取部门', { exact: true })).toHaveCount(0)
  await list.getByRole('row').filter({ hasText: '读取成员' }).click()
  await page.screenshot({
    path: path.resolve(
      __dirname,
      '../../../../../../tmp/testing-evidence/rpc-model-browser/picker.png'
    ),
    fullPage: true,
  })
  await modal.getByRole('button', { name: '确认', exact: true }).click()
  await expect(saved).toContainText('member')
  await expect(picker).toContainText('读取成员')
  await picker.locator('.cxd-Picker-btn').click()
  await tree.getByText('未分组', { exact: true }).click()
  await list.getByRole('row').filter({ hasText: '旧接口' }).click()
  await modal.getByRole('button', { name: '取消', exact: true }).click()
  await expect(saved).toContainText('member')
  await picker.locator('.cxd-Picker-btn').click()
  await tree.getByText('全部模型', { exact: true }).click()
  await tree.locator('input[name="__rpcKeyword"]').fill('legacy')
  await expect(list.getByText('读取成员', { exact: true })).toHaveCount(0)
  await list.getByRole('row').filter({ hasText: '旧接口' }).click()
  await modal.getByRole('button', { name: '确认', exact: true }).click()
  await expect(saved).toContainText('legacy')
  await expect(picker).toContainText('旧接口')
})

test('RPC-G05: existing model values reload labels and empty collections keep usable group navigation', async ({
  page,
}) => {
  await page.goto(`${harness.url}?view=groups&selected=member`)
  await expect(page.locator('.cxd-Picker')).toContainText('读取成员')
  await page.goto(`${harness.url}?view=groups&empty=true`)
  for (const selector of ['.dev-models', '.runtime-models']) {
    const browser = page.locator(selector)
    await expect(browser.getByText('全部模型', { exact: true })).toBeVisible()
    await browser
      .locator('.rpc-model-browser__aside')
      .getByText('未分组', { exact: true })
      .click()
    await expect(
      browser
        .locator('.rpc-model-browser__list')
        .getByText('暂无匹配的 RPC 模型', { exact: true })
    ).toBeVisible()
  }
  await page.locator('.cxd-Picker-btn').click()
  await expect(
    page.locator('.cxd-Modal').getByText('全部模型', { exact: true })
  ).toBeVisible()
  await page
    .locator('.cxd-Modal')
    .getByRole('button', { name: '取消', exact: true })
    .click()
})
test('RPC-G06: refresh updates the full group tree across pagination and keeps a narrow two-pane layout', async ({
  page,
}) => {
  await page.goto(`${harness.url}?view=dev-list`)
  await page.evaluate(() => {
    window.__rpcRows = [
      ...window.__rpcRows,
      ...Array.from({ length: 11 }, (_, index) => ({
        name: `archive-${index}`,
        title: `历史接口 ${index}`,
        group: '外部/历史',
      })),
    ]
  })
  await page.getByRole('button', { name: '刷新', exact: true }).click()
  const tree = page.locator('.rpc-model-browser__aside')
  const list = page.locator('.rpc-model-browser__list')
  await tree.getByText('历史', { exact: true }).click()
  await expect(list.getByRole('row').filter({ hasText: '历史接口' })).toHaveCount(10)
  await list.locator('.cxd-Pagination').getByText('2', { exact: true }).click()
  await expect(list.getByRole('row').filter({ hasText: '历史接口' })).toHaveCount(1)
  await expect(tree.getByText('通讯录', { exact: true })).toBeVisible()
  await tree.getByText('通讯录', { exact: true }).click()
  await expect(list.getByText('读取成员', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  const treeBounds = await tree.boundingBox()
  const listBounds = await list.boundingBox()
  expect(treeBounds.x + treeBounds.width).toBeLessThanOrEqual(listBounds.x)
  const groupLabel = tree.getByText('通讯录', { exact: true })
  expect(
    await groupLabel.evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).toBe(true)
  expect((await tree.locator('label').first().boundingBox()).height).toBeLessThan(40)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true)
  await page.screenshot({
    path: path.resolve(
      __dirname,
      '../../../../../../tmp/testing-evidence/rpc-model-browser/narrow-list.png'
    ),
    fullPage: true,
  })
})

test.afterEach(() => expect(errors).toEqual([]))
const footer = (page) => page.locator('.cxd-Drawer-footer')
const calls = (page, suffix) =>
  page.evaluate(
    (suffix) => window.__rpcHarness.calls.filter((c) => c.url.endsWith(suffix)),
    suffix
  )

test('real Drawer keeps saved edits open and only explicitly commits with a message', async ({
  page,
}) => {
  await expect(page.getByText('模型已提交', { exact: true })).toHaveCount(0)
  await expect(page.getByText('已保存，待提交', { exact: true })).toHaveCount(0)
  await expect(footer(page).locator('.cxd-Button')).toHaveText(['关闭', '保存', '提交'])
  const title = page.locator('input[name="title"]')
  await title.fill('修改后的接口')
  await page.getByText('接口测试', { exact: true }).click()
  await expect(footer(page).locator('.cxd-Button')).toHaveText([
    '关闭',
    '运行测试',
    '保存',
    '提交',
  ])
  await expect(
    footer(page)
      .locator('.cxd-Button')
      .filter({ hasText: /^运行测试$/ })
  ).toHaveClass(/is-disabled/)
  await footer(page).getByRole('button', { name: '保存', exact: true }).click()
  await expect(footer(page).getByRole('button', { name: '运行测试' })).toBeEnabled()
  await expect(page.getByText('已保存，待提交', { exact: true })).toHaveCount(0)
  expect(await calls(page, '/commit')).toHaveLength(0)
  await footer(page).getByRole('button', { name: '运行测试' }).click()
  await expect(page.getByText(/请求成功/)).toBeVisible()
  await footer(page).getByRole('button', { name: '提交', exact: true }).click()
  await expect(page.locator('.cxd-Button').filter({ hasText: /^确认提交$/ })).toHaveClass(
    /is-disabled/
  )
  await page.locator('textarea[name="message"]').fill('新增接口测试')
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(page.locator('.cxd-Drawer')).toHaveCount(0)
  expect((await calls(page, '/commit'))[0].data.commitMsg).toBe('新增接口测试')
})

test('X, Escape and footer guard unsaved edits and allow save-and-close', async ({
  page,
}) => {
  await page.locator('input[name="title"]').fill('保留的草稿')
  await page.keyboard.press('Escape')
  await expect(page.getByText('当前有未保存的修改，请选择如何处理。')).toBeVisible()
  await page.getByRole('button', { name: '继续编辑' }).click()
  await expect(page.locator('input[name="title"]')).toHaveValue('保留的草稿')
  await footer(page).getByRole('button', { name: '关闭', exact: true }).click()
  await page.getByRole('button', { name: '保存并关闭' }).click()
  await expect(page.locator('.cxd-Drawer')).toHaveCount(0)
  expect(await calls(page, '/commit')).toHaveLength(0)
})

test('failed commit keeps saved model and retries without another write', async ({
  page,
}) => {
  await page.locator('input[name="title"]').fill('提交失败重试')
  await page.evaluate(() => {
    window.__rpcHarness.commitFailure = true
  })
  await footer(page).getByRole('button', { name: '提交', exact: true }).click()
  await page.locator('textarea[name="message"]').fill('说明修改')
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(page.getByText('模拟提交失败', { exact: true }).last()).toBeVisible()
  await expect(page.locator('textarea[name="message"]')).toHaveValue('说明修改')
  await page.locator('textarea[name="message"]').fill('补充后的提交说明')
  await page.getByRole('button', { name: '确认提交' }).click()
  await expect(page.locator('.cxd-Drawer')).toHaveCount(0)
  expect(
    await page.evaluate(
      () => window.__rpcHarness.calls.filter((c) => c.method === 'put').length
    )
  ).toBe(1)
  expect((await calls(page, '/commit'))[1].data.commitMsg).toBe('补充后的提交说明')
})

test('typed inputs stay separate from model edits, mask sensitive values and mark old results stale', async ({
  page,
}) => {
  await page.getByText('接口测试', { exact: true }).click()
  const tables = page.locator('.cxd-InputTable')
  const required = tables.first().locator('tbody tr').filter({ hasText: 'request.body' })
  const secret = tables.first().locator('tbody tr').filter({ hasText: 'password' })
  await expect(required.locator('input[type="checkbox"]')).toBeDisabled()
  await required.locator('textarea').fill('current input')
  await expect(secret.locator('input[type="password"]')).toBeDisabled()
  await footer(page).getByRole('button', { name: '运行测试' }).click()
  await expect(page.getByText(/请求成功/)).toBeVisible()
  expect((await calls(page, '/test'))[0].data.variables).toEqual({
    input: 'current input',
  })
  expect((await calls(page, '/test'))[0].config.authRefreshRetry).toBe(true)
  await page.getByText('测试参数', { exact: true }).click()
  await required.locator('textarea').fill('changed input')
  await expect(
    page.getByText('配置或测试输入已变化，以下结果仅供参考，请重新运行测试。')
  ).toBeVisible()
  await expect(
    footer(page)
      .locator('.cxd-Button')
      .filter({ hasText: /^保存$/ })
  ).toHaveClass(/is-disabled/)
  await secret.locator('label').click()
  await expect(secret.locator('input[type="checkbox"]')).toBeChecked()
  await secret.locator('input[type="password"]').fill('synthetic-secret')
  const config = tables.nth(1).locator('tbody tr')
  await config.locator('label').click()
  await expect(config.locator('input[type="checkbox"]')).toBeChecked()
  await expect(
    footer(page)
      .locator('.cxd-Button')
      .filter({ hasText: /^运行测试$/ })
  ).toHaveClass(/is-disabled/)
  await expect.poll(async () => (await calls(page, '/test/init-form')).length).toBe(2)
  await expect(footer(page).getByRole('button', { name: '运行测试' })).toBeEnabled()
  expect((await calls(page, '/test/init-form'))[1]).toMatchObject({
    method: 'post',
    data: { configValues: { host: '' } },
  })
  await footer(page).getByRole('button', { name: '运行测试' }).click()
  await expect.poll(async () => (await calls(page, '/test')).length).toBe(2)
  const latest = (await calls(page, '/test'))[1].data
  expect(latest.variables.password).toBe('synthetic-secret')
  expect(latest.configValues).toEqual({ host: '' })
})

test('X closes through the same dirty guard and discarding preserves the saved workspace', async ({
  page,
}) => {
  await page.locator('input[name="title"]').fill('discard me')
  await page.locator('.cxd-Drawer-close').click()
  await expect(page.getByText('当前有未保存的修改，请选择如何处理。')).toBeVisible()
  await page.getByRole('button', { name: '放弃修改并关闭' }).click()
  await expect(page.locator('.cxd-Drawer')).toHaveCount(0)
  await page.getByRole('button', { name: '编辑接口' }).click()
  await expect(page.locator('input[name="title"]')).toHaveValue('示例接口')
  expect(await calls(page, '/commit')).toHaveLength(0)
})

test('debug entry selects testing and an in-flight close never replays the request', async ({
  page,
}) => {
  await footer(page).getByRole('button', { name: '关闭', exact: true }).click()
  await page.goto(`${harness.url}?debug=true`)
  await page.getByRole('button', { name: '编辑接口' }).click()
  await expect(footer(page).getByRole('button', { name: '运行测试' })).toBeVisible()
  await page.evaluate(() => {
    window.__rpcHarness.holdTest = true
  })
  await footer(page).getByRole('button', { name: '运行测试' }).click()
  await expect(page.getByText('正在运行测试，配置和测试输入已锁定')).toBeVisible()
  await page.getByText('模型配置', { exact: true }).click()
  await expect(page.locator('input[name="title"]')).toBeDisabled()
  await page.locator('.cxd-Drawer-close').click()
  await expect(
    page.getByText('测试请求已发出，关闭后目标服务可能继续执行。仍要关闭吗？')
  ).toBeVisible()
  await page
    .locator('.cxd-Modal')
    .getByRole('button', { name: '关闭', exact: true })
    .click()
  await expect(page.locator('.cxd-Drawer')).toHaveCount(0)
  await page.evaluate(() => window.__rpcHarness.finishTest())
  await page.getByRole('button', { name: '编辑接口' }).click()
  await expect(page.locator('input[name="title"]')).toHaveValue('示例接口')
  expect(await calls(page, '/test')).toHaveLength(1)
})
