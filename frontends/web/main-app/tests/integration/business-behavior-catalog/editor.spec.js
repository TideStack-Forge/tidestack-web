const fs = require('node:fs')
const { test, expect } = require('@playwright/test')

function fixture(data) {
  const artifact = process.env.OUROBOROS_EDITOR_SCHEMA
  if (!artifact)
    throw new Error(
      'Set OUROBOROS_EDITOR_SCHEMA to the BusinessBehaviorEditorSchemaTest generated schema artifact'
    )
  const schema = JSON.parse(fs.readFileSync(artifact, 'utf8'))
  const tabs = schema.body.find((node) => node.type === 'tabs').tabs
  const custom = tabs.find((tab) => tab.title === '自定义功能')
  const behavior = tabs.find((tab) => tab.title === '行为契约').body[0]
  return {
    data: {
      appName: 'example',
      fullName: 'sales.Order',
      modelType: 'default',
      namespace: 'sales',
      name: 'Order',
      title: '订单',
      ...data,
    },
    body: [
      {
        type: 'input-text',
        name: 'title',
        label: '模型标题',
        placeholder: '修改模型标题',
      },
      ...custom.body,
      behavior,
    ],
  }
}
async function mount(page, data) {
  const initial = fixture(data)
  await page.route('**/behavior-editor-fixture', (route) =>
    route.fulfill({ json: initial })
  )
  await page.goto('/business-behavior-catalog-playwright-harness.html?editor=1')
  await page.waitForFunction(() => window.behaviorCatalogHarness?.ready)
  return initial.data
}
const values = (page) => page.evaluate(() => window.behaviorCatalogHarness.values())

test('script shortcut previews formal resources, cancels without writes, then updates only after the resource commit', async ({
  page,
}, testInfo) => {
  const previews = [],
    commits = []
  const script = 'return $input.params.id + ":" + $input.data.note'
  let saved
  await page.route(
    '**/business-model/sales.Order/script-action-preview?*',
    async (route) => {
      const request = route.request().postDataJSON()
      previews.push(request)
      saved = JSON.parse(JSON.stringify(request.businessModel))
      saved.actions = [
        ...(saved.actions || []),
        {
          name: request.actionName,
          isEnabled: true,
          readOnly: request.readOnly,
          binding: { kind: 'logicflow', flowName: `sales.Order.${request.actionName}` },
        },
      ]
      saved.custom[0].api.action = request.actionName
      await route.fulfill({
        json: {
          code: 0,
          data: {
            requestId: new URL(route.request().url()).searchParams.get('requestId'),
            planFingerprint: 'script-plan',
            actionName: request.actionName,
            flowName: `sales.Order.${request.actionName}`,
            resources: [
              {
                path: 'business-model/sales.Order.business.json',
                before: JSON.stringify(request.businessModel),
                after: JSON.stringify(saved),
              },
              {
                path: 'logic-flow/sales.Order.calculate.logicflow.json',
                before: null,
                after: JSON.stringify({ script }),
              },
            ],
          },
        },
      })
    }
  )
  await page.route('**/business-model/sales.Order/script-action?*', async (route) => {
    commits.push(route.request().postDataJSON())
    await route.fulfill({ json: { code: 0, data: { businessModel: saved } } })
  })
  const custom = [
    {
      name: 'button',
      title: '计算按钮',
      future: 1,
      api: {
        isEnabled: true,
        httpMethod: 'POST',
        url: 'calculate',
        implementationMode: 'ACTION',
        actionInputMapping: {},
      },
    },
  ]
  await mount(page, { formatVersion: '2.0', custom, future: { keep: true } })
  await page.getByText('API配置', { exact: true }).click()
  const create = page.getByLabel('快捷创建脚本动作')
  await create.getByRole('button', { name: '新建脚本动作', exact: true }).click()
  await create.getByLabel('新动作名称', { exact: true }).fill('calculate')
  await create.getByLabel('脚本语言', { exact: true }).selectOption('groovy')
  const monaco = create.getByRole('textbox', { name: /编辑器内容/ })
  await monaco.click()
  await monaco.press('ControlOrMeta+A')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.evaluate((text) => navigator.clipboard.writeText(text), script)
  await monaco.press('ControlOrMeta+V')
  await create.getByRole('button', { name: '预览脚本动作资源', exact: true }).click()
  await expect(create.getByLabel('脚本动作完整资源差异')).toBeVisible()
  expect(previews[0]).toMatchObject({
    functionName: 'button',
    actionName: 'calculate',
    scriptLanguage: 'groovy',
    script,
    readOnly: true,
  })
  expect(previews[0].businessModel.custom).toEqual(custom)
  expect((await values(page)).custom).toEqual(custom)
  expect(await values(page)).not.toHaveProperty('script')
  await create.getByRole('button', { name: '取消创建', exact: true }).click()
  expect(commits).toHaveLength(0)
  expect((await values(page)).custom).toEqual(custom)
  await create.getByRole('button', { name: '新建脚本动作', exact: true }).click()
  await expect(create.locator('.view-lines')).toContainText(script)
  await create.getByRole('button', { name: '预览脚本动作资源', exact: true }).click()
  await expect(create.getByLabel('脚本动作完整资源差异')).toBeVisible()
  await testInfo.attach('script-action-resource-preview', {
    body: await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('script-action-preview.png'),
    }),
    contentType: 'image/png',
  })
  await create
    .getByRole('button', { name: '确认创建并提交完整资源', exact: true })
    .click()
  await expect
    .poll(async () => (await values(page)).custom[0].api.action)
    .toBe('calculate')
  expect(commits).toHaveLength(1)
  expect((await values(page)).actions).toHaveLength(1)
  expect((await values(page)).future).toEqual({ keep: true })
  expect(JSON.stringify(await values(page))).not.toContain('return $input.params')
  expect(await values(page)).not.toHaveProperty('scriptSource')
})

test('subscription enablement preserves missing defaults and edits only the original definition', async ({
  page,
}) => {
  const subscription = {
    name: 'notify',
    listenerName: 'noticeListener',
    sourceEventModelFullName: 'sales.Order',
    sourceEventName: 'approved',
    executionPrincipalRef: 'notice-user',
    future: { keep: true },
  }
  await mount(page, { eventSubscriptions: [subscription] })
  await page.getByRole('button', { name: '事件订阅', exact: true }).click()
  await page.getByRole('button', { name: /notify notify/ }).click()
  const state = page.getByLabel('动态订阅定义', { exact: true }).getByRole('checkbox')
  await expect(state).toBeChecked()
  expect((await values(page)).eventSubscriptions).toEqual([subscription])
  await state.locator('..').click()
  await expect
    .poll(async () => (await values(page)).eventSubscriptions)
    .toEqual([{ ...subscription, isEnabled: false }])
  await state.locator('..').click()
  await expect
    .poll(async () => (await values(page)).eventSubscriptions)
    .toEqual([{ ...subscription, isEnabled: true }])
})

test('legacy custom function open, API inspection and unrelated edit preserve missing version, flags and original scripts', async ({
  page,
}) => {
  const custom = [
    {
      name: 'approve',
      title: '审批',
      future: { keep: true },
      ui: { isEnabled: true, mode: 'api' },
      api: {
        isEnabled: true,
        isGenerateImplementation: true,
        httpMethod: 'POST',
        url: 'approve',
        script: 'return request.params.id',
        future: 1,
      },
    },
  ]
  const initial = await mount(page, { custom })
  await page.getByText('API配置', { exact: true }).click()
  await expect(page.getByText('生成接口实现', { exact: true })).toBeVisible()
  expect((await values(page)).custom).toEqual(initial.custom)
  expect(await values(page)).not.toHaveProperty('formatVersion')
  expect(await values(page)).not.toHaveProperty('actions')
  await page.getByPlaceholder('修改模型标题').fill('标题修改')
  expect((await values(page)).custom).toEqual(initial.custom)
  await expect.poll(async () => (await values(page)).title).toBe('标题修改')
  await expect(page.getByLabel('功能实现方式')).toHaveCount(0)
})

test('version 2 functions reuse one formal Action, preview the whole model and preserve unloaded code references', async ({
  page,
}, testInfo) => {
  const requests = []
  await page.route('**/business-model/behavior-preview?*', async (route) => {
    requests.push(route.request().postDataJSON())
    await route.fulfill({
      json: {
        code: 0,
        data: {
          requestId: new URL(route.request().url()).searchParams.get('requestId'),
          catalog: {
            actions: [{ name: 'approve', title: '审批', isEnabled: true }],
            sources: [
              {
                memberType: 'action',
                memberName: 'approve',
                role: 'definition',
                kind: 'metadata',
                source: { resource: 'sales.Order', fieldPath: 'actions.approve' },
              },
            ],
          },
          validationSnapshot: { validationErrors: [] },
        },
      },
    })
  })
  const custom = [
    {
      name: 'approveButton',
      title: '审批按钮',
      api: {
        isEnabled: true,
        httpMethod: 'POST',
        url: 'approve',
        implementationMode: 'ACTION',
        action: 'approve',
      },
    },
    {
      name: 'otherButton',
      title: '其他按钮',
      api: {
        isEnabled: false,
        httpMethod: 'POST',
        url: 'other',
        implementationMode: 'ACTION',
        action: 'codeAction',
      },
    },
  ]
  const actions = [
    {
      name: 'approve',
      isEnabled: true,
      binding: { kind: 'handler', handlerName: 'orderActionHandler' },
      future: 1,
    },
  ]
  await mount(page, { formatVersion: '2.0', custom, actions })
  await page.getByText('API配置', { exact: true }).filter({ visible: true }).click()
  const reference = page.getByLabel('功能实现方式')
  await expect(reference).toBeVisible()
  await reference.getByRole('button', { name: '读取完整草稿的动作' }).click()
  await expect(reference.getByText('动作来源：metadata', { exact: false })).toBeVisible()
  expect(requests[0]).toMatchObject({
    name: 'Order',
    custom,
    actions,
    formatVersion: '2.0',
  })
  expect((await values(page)).custom).toEqual(custom)
  expect((await values(page)).actions).toEqual(actions)
  await reference.getByLabel('实现方式', { exact: true }).selectOption('WEB_API')
  await expect
    .poll(async () => (await values(page)).custom[0].api)
    .toEqual({
      isEnabled: true,
      httpMethod: 'POST',
      url: 'approve',
      implementationMode: 'WEB_API',
    })
  expect((await values(page)).actions).toEqual(actions)
  await page.getByText('其他按钮(otherButton)', { exact: true }).click()
  await page.getByText('API配置', { exact: true }).filter({ visible: true }).click()
  // Disabled HTTP configuration still keeps the Action reference in the document.
  expect((await values(page)).custom[1]).toEqual(custom[1])
  await testInfo.attach('versioned-custom-action-editor', {
    body: await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('custom-action-editor.png'),
    }),
    contentType: 'image/png',
  })
})

test('structured events and JSON advanced editor share one original array and invalid JSON cannot be discarded by switching', async ({
  page,
}) => {
  await mount(page, {
    events: [
      {
        name: 'approved',
        description: '中文\n多行说明',
        occurrenceCondition: '审批通过后',
        payloadSchema: { type: 'object', properties: { id: { type: 'string' } } },
        future: { keep: true },
      },
    ],
  })
  await page.getByRole('button', { name: /approved approved/ }).click()
  const editor = page.getByLabel('动态事件定义', { exact: true })
  await editor.getByLabel('业务说明').fill('新的业务说明')
  await expect
    .poll(async () => (await values(page)).events[0])
    .toMatchObject({
      description: '新的业务说明',
      future: { keep: true },
    })
  await editor.getByRole('button', { name: '高级定义' }).click()
  const monaco = editor.getByRole('textbox', { name: /编辑器内容/ })
  await monaco.click()
  await monaco.press('ControlOrMeta+A')
  await page.keyboard.insertText('@')
  await editor.getByRole('button', { name: '返回表单' }).click()
  await expect(editor.getByRole('alert')).toContainText('请先修正当前 JSON')
  expect((await values(page)).events[0].description).toBe('新的业务说明')
  await monaco.click()
  await monaco.press('ControlOrMeta+A')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.evaluate(
    (text) => navigator.clipboard.writeText(text),
    '[{"name":"approved","description":"JSON修改","future":{"keep":true}}]'
  )
  await monaco.press('ControlOrMeta+V')
  await editor.getByRole('button', { name: '返回表单' }).click()
  await expect(editor.getByLabel('业务说明')).toHaveValue('JSON修改')
  await expect
    .poll(async () => (await values(page)).events)
    .toEqual([{ name: 'approved', description: 'JSON修改', future: { keep: true } }])
})

test('new version 2 functions use the reference format while legacy models still create legacy definitions', async ({
  page,
}) => {
  for (const version of ['2.0', undefined]) {
    await mount(page, version ? { formatVersion: version } : {})
    await page.getByRole('button', { name: '+ 新增', exact: true }).click()
    await page.getByPlaceholder('请输入功能名（输入后不能修改）').fill('printButton')
    await page.getByPlaceholder('请输入功能标题').fill('打印按钮')
    await page.getByRole('button', { name: '确定', exact: true }).click()
    await expect.poll(async () => (await values(page)).custom?.length).toBe(1)
    const added = (await values(page)).custom[0]
    expect(added).toMatchObject({ name: 'printButton', title: '打印按钮' })
    expect(added).not.toHaveProperty('modelFormatVersion')
    expect(added).not.toHaveProperty('allItems')
    expect(added).not.toHaveProperty('formatVersion')
    if (version) {
      expect(added.api).toEqual({
        isEnabled: false,
        httpMethod: 'POST',
        url: '',
        implementationMode: 'WEB_API',
      })
      expect(added.api).not.toHaveProperty('script')
    } else {
      expect(added.api).toMatchObject({
        isGenerateImplementation: true,
        isBindAction: true,
        script: '',
      })
      expect(added.api).not.toHaveProperty('implementationMode')
      expect(await values(page)).not.toHaveProperty('formatVersion')
    }
  }
})
