const fs = require('node:fs')
const { test, expect } = require('@playwright/test')
const values = (page) => page.evaluate(() => window.behaviorCatalogHarness.values())

async function mount(page, data, options = {}) {
  const artifact = process.env.OUROBOROS_EDITOR_SCHEMA
  if (!artifact)
    throw new Error(
      'OUROBOROS_EDITOR_SCHEMA must point to the generated Java editor schema'
    )
  const schema = JSON.parse(fs.readFileSync(artifact, 'utf8'))
  const behavior = schema.body
    .find((node) => node.type === 'tabs')
    .tabs.find((tab) => tab.title === '行为契约').body[0]
  const requests = []
  await page.route('**/business-model/behavior-preview?*', async (route) => {
    const draft = route.request().postDataJSON()
    requests.push(draft)
    if (options.fail)
      return route.fulfill({ json: { code: -1, msg: '检查服务暂不可用' } })
    await route.fulfill({
      json: {
        code: 0,
        data: {
          requestId: new URL(route.request().url()).searchParams.get('requestId'),
          codeContributionCoverage: 'development-environment-only',
          catalog: {
            modelFullName: 'sales.Order',
            revision: 'test-revision',
            conflicts: [],
            mutationEventPlans: {},
            actions: [
              ...(draft.actions || []),
              {
                name: 'codeApprove',
                title: '代码审批',
                binding: { kind: 'handler', handlerName: 'orderHandler' },
              },
            ],
            events: [
              ...(draft.events || []),
              { name: 'recordsCreated', title: '记录已新增', subject: 'model' },
            ],
            subscriptions: draft.eventSubscriptions || [],
            sources: [
              {
                memberType: 'action',
                memberName: 'codeApprove',
                role: 'definition',
                kind: 'contribution',
                source: { resource: 'java:OrderActions', fieldPath: 'approve' },
              },
              {
                memberType: 'event',
                memberName: 'recordsCreated',
                role: 'definition',
                kind: 'generated',
                source: { resource: 'sales.Order', fieldPath: 'fields' },
              },
            ],
          },
          validationSnapshot: { validationErrors: options.errors || [] },
        },
      },
    })
  })
  await page.route('**/business-model/list', (route) =>
    route.fulfill({
      json: { code: 0, items: [{ fullName: 'sales.Order', title: '订单' }] },
    })
  )
  await page.route('**/business-model/*/model-bundle', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          FlowModelMeta: [
            { name: 'sales.Order.generated', model: { name: 'sales.Order.generated' } },
          ],
          BusinessModelBehavior: [
            {
              name: 'external.Payment',
              model: { events: { paid: { name: 'paid', title: '已付款' } }, actions: {} },
            },
          ],
        },
      },
    })
  )
  await page.route('**/logic-flow', (route) =>
    route.fulfill({
      json: { code: 0, items: [{ model: { name: 'sales.Order.approve' } }] },
    })
  )
  await page.route('**/behavior-editor-fixture', (route) =>
    route.fulfill({
      json: {
        data: {
          appName: 'example',
          namespace: 'sales',
          name: 'Order',
          modelType: 'default',
          formatVersion: '2.0',
          ...data,
        },
        body: [
          behavior,
          ...(options.styleReference
            ? [
                {
                  type: 'fieldset',
                  title: '标准表单对照',
                  body: [
                    { type: 'input-text', name: 'referenceName', label: '标准名称' },
                    { type: 'textarea', name: 'referenceNote', label: '标准说明' },
                    { type: 'button', label: '标准按钮' },
                  ],
                },
              ]
            : []),
        ],
      },
    })
  )
  await page.goto('/business-behavior-catalog-playwright-harness.html?editor=1')
  await page.waitForFunction(() => window.behaviorCatalogHarness?.ready)
  await expect(page.getByText('配置检查通过', { exact: true })).toBeVisible()
  return requests
}

test('unified editor checks automatically, preserves unknown metadata and keeps event payload independent of its subject', async ({
  page,
}, testInfo) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const event = {
    name: 'approved',
    title: '订单已审核',
    subject: 'instance',
    occurrenceCondition: '审核后',
    payloadSchema: {
      type: 'object',
      properties: { comment: { type: 'string' } },
      additionalProperties: false,
      'x-future': { keep: true },
    },
    future: { keep: true },
  }
  const requests = await mount(page, { events: [event], future: { keep: true } })
  const workbench = page.getByLabel('行为契约工作台', { exact: true })
  await expect(workbench.getByText('查看范围', { exact: true })).toHaveCount(0)
  await expect(workbench.getByRole('button', { name: '预览当前完整草稿' })).toHaveCount(0)
  await workbench.getByRole('button', { name: /订单已审核/ }).click()
  await workbench.getByLabel('业务说明', { exact: true }).fill('审核后的业务事实')
  const subject = workbench.getByText('事件主体', { exact: true }).locator('..')
  await subject.getByText('模型', { exact: true }).click()
  await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect.poll(async () => (await values(page)).events[0].subject).toBe('model')
  expect((await values(page)).events[0].payloadSchema).toEqual(event.payloadSchema)
  expect((await values(page)).events[0].future).toEqual({ keep: true })
  await expect
    .poll(() => requests.at(-1)?.events?.[0]?.description)
    .toBe('审核后的业务事实')
  expect(await values(page)).not.toHaveProperty('behaviorCatalog')
  expect(await values(page)).not.toHaveProperty('requestId')
  await testInfo.attach('event-workbench', {
    body: await page.screenshot({
      path: testInfo.outputPath('event.png'),
      fullPage: true,
    }),
    contentType: 'image/png',
  })
  expect(errors).toEqual([])
})

test('subscription maps independent params and data, retains external refs and targets code Actions without adding listeners', async ({
  page,
}, testInfo) => {
  const subscription = {
    name: 'confirm',
    sourceEventModelFullName: 'external.Payment',
    sourceEventName: 'paid',
    targetActionModelFullName: 'sales.Order',
    targetActionName: 'codeApprove',
    executionPrincipalRef: 'worker',
    inputMapping: {
      'params.order.id': '${ event.subject.id }',
      data: '${ event.payload }',
    },
    future: 1,
  }
  await mount(page, { eventSubscriptions: [subscription] })
  await page.getByRole('button', { name: '事件订阅', exact: true }).click()
  await page.getByRole('button', { name: /confirm/ }).click()
  await expect(page.getByText('外部引用待核验', { exact: true })).toBeVisible()
  await expect(page.getByLabel('动作参数 params', { exact: true })).toBeVisible()
  await expect(page.getByLabel('动作数据 data', { exact: true })).toBeVisible()
  await expect(page.getByText('响应方式', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Listener 名称')).toHaveCount(0)
  await page.getByLabel('来源表达式 1').fill('${ event.payload.orderId }')
  await expect
    .poll(
      async () =>
        (await values(page)).eventSubscriptions[0].inputMapping['params.order.id']
    )
    .toBe('${ event.payload.orderId }')
  const saved = (await values(page)).eventSubscriptions[0]
  expect(saved.sourceEventModelFullName).toBe('external.Payment')
  expect(saved.inputMapping.data).toBe('${ event.payload }')
  expect(saved.future).toBe(1)
  expect(saved).not.toHaveProperty('listenerName')
  await testInfo.attach('subscription-workbench', {
    body: await page.screenshot({
      path: testInfo.outputPath('subscription.png'),
      fullPage: true,
    }),
    contentType: 'image/png',
  })
})

test('generated and code members are read-only, filtering and narrow layout remain usable', async ({
  page,
}, testInfo) => {
  await mount(page, { actions: [] })
  await page.getByRole('button', { name: '动作', exact: true }).click()
  await page.getByRole('button', { name: /代码审批/ }).click()
  const detail = page.getByLabel('定义详情', { exact: true })
  await expect(detail.getByText('来源定义 · 只读')).toBeVisible()
  await expect(detail.getByLabel('标识', { exact: true })).toHaveCount(0)
  await expect(detail).toContainText('java:OrderActions')
  expect((await values(page)).actions).toEqual([])
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByLabel('搜索', { exact: true })).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true)
  await testInfo.attach('narrow-workbench', {
    body: await page.screenshot({
      path: testInfo.outputPath('narrow.png'),
      fullPage: true,
    }),
    contentType: 'image/png',
  })
})

test('new actions choose existing flows and keep logic-flow binding details out of the basic form', async ({
  page,
}, testInfo) => {
  await mount(page, { actions: [] })
  const editor = page.getByLabel('动态动作定义', { exact: true })
  await page.getByRole('button', { name: '动作', exact: true }).click()
  await page.getByRole('button', { name: '新增动作', exact: true }).click()
  await editor.getByLabel('标识', { exact: true }).fill('approve')
  await expect(editor.getByText('实现方式', { exact: true })).toHaveCount(0)
  await editor.getByLabel('执行配置', { exact: true }).getByRole('combobox').click()
  await page.getByText('sales.Order.approve', { exact: true }).last().click()
  await expect
    .poll(async () => (await values(page)).actions[0].binding)
    .toEqual({ kind: 'logicflow', flowName: 'sales.Order.approve' })
  await expect(
    editor.getByRole('button', { name: '打开逻辑流', exact: true })
  ).toBeEnabled()
  expect((await values(page)).actions[0].isEnabled).toBe(true)
  await expect(page.getByText('配置检查通过', { exact: true })).toBeVisible()
  await testInfo.attach('action-workbench', {
    body: await page.screenshot({
      path: testInfo.outputPath('action.png'),
      fullPage: true,
    }),
    contentType: 'image/png',
  })
})

test('fixed input values preserve types, quote platform EL and block unfinished numeric input and conflicting paths', async ({
  page,
}, testInfo) => {
  await mount(page, {
    eventSubscriptions: [
      {
        name: 'confirm',
        sourceEventModelFullName: 'sales.Order',
        sourceEventName: 'recordsCreated',
        targetActionModelFullName: 'sales.Order',
        targetActionName: 'codeApprove',
        executionPrincipalRef: 'worker',
        inputMapping: { 'params.id': 1, 'data.note': '${ event.payload.note }' },
      },
    ],
  })
  await page.getByRole('button', { name: '事件订阅', exact: true }).click()
  await page.getByRole('button', { name: /confirm confirm/ }).click()
  const data = page.getByLabel('动作数据 data', { exact: true })
  await data.getByText('固定值', { exact: true }).click()
  await data.getByLabel('固定值', { exact: true }).fill("O'Brien ${literal}")
  await expect
    .poll(
      async () => (await values(page)).eventSubscriptions[0].inputMapping['data.note']
    )
    .toBe("${ 'O''Brien $${literal}' }")
  await data.getByText('数字', { exact: true }).click()
  await expect(data.getByLabel('固定值', { exact: true })).toHaveValue('0')
  await data.getByLabel('固定值', { exact: true }).fill('12')
  await expect
    .poll(
      async () => (await values(page)).eventSubscriptions[0].inputMapping['data.note']
    )
    .toBe(12)
  await data.getByLabel('固定值', { exact: true }).fill('')
  await expect(page.getByText('输入尚未完成', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '事件', exact: true }).click()
  await expect(page.getByText(/请先修正当前输入/)).toBeVisible()
  expect((await values(page)).eventSubscriptions[0].inputMapping['data.note']).toBe(12)
  await data.getByLabel('固定值', { exact: true }).fill('13')
  await expect
    .poll(
      async () => (await values(page)).eventSubscriptions[0].inputMapping['data.note']
    )
    .toBe(13)
  await data.getByText('空值', { exact: true }).click()
  await expect
    .poll(
      async () => (await values(page)).eventSubscriptions[0].inputMapping['data.note']
    )
    .toBe(null)
  await data.getByRole('button', { name: '添加数据映射' }).click()
  await data.getByLabel('目标字段 3').fill('note')
  await expect(page.getByRole('alert').filter({ hasText: '目标字段冲突' })).toBeVisible()
  expect(Object.keys((await values(page)).eventSubscriptions[0].inputMapping)).toEqual([
    'params.id',
    'data.note',
  ])
  await data.getByRole('button', { name: '删除映射' }).last().click()
  await data.getByText('不传入', { exact: true }).click()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  expect((await values(page)).eventSubscriptions[0].inputMapping['data.note']).toBe(null)
  await data.getByText('不传入', { exact: true }).click()
  await page.getByRole('button', { name: '确定', exact: true }).click()
  await expect
    .poll(async () => (await values(page)).eventSubscriptions[0].inputMapping)
    .toEqual({ 'params.id': 1 })
  await testInfo.attach('typed-mapping', {
    body: await page.screenshot({
      path: testInfo.outputPath('typed-mapping.png'),
      fullPage: true,
    }),
    contentType: 'image/png',
  })
})

test('external event candidates can be loaded while unavailable names remain intact', async ({
  page,
}) => {
  await mount(page, {
    eventSubscriptions: [
      {
        name: 'confirm',
        sourceEventModelFullName: 'external.Payment',
        sourceEventName: 'paid',
        targetActionModelFullName: 'sales.Order',
        targetActionName: 'codeApprove',
        executionPrincipalRef: 'worker',
      },
    ],
  })
  await page.getByRole('button', { name: '事件订阅', exact: true }).click()
  await page.getByRole('button', { name: /confirm confirm/ }).click()
  const source = page.getByLabel('订阅事件', { exact: true })
  await source.getByRole('button', { name: '读取可见成员' }).click()
  await expect(source.getByText('外部引用待核验', { exact: true })).toHaveCount(0)
  await expect(source).toContainText('已付款')
  await source.getByLabel('模型全名', { exact: true }).fill('unloaded.Payment')
  await source.getByLabel('事件标识', { exact: true }).fill('futurePaid')
  await expect(source.getByText('外部引用待核验', { exact: true })).toBeVisible()
  expect((await values(page)).eventSubscriptions[0]).toMatchObject({
    sourceEventModelFullName: 'unloaded.Payment',
    sourceEventName: 'futurePaid',
  })
})

test('event payload fields are edited without raw JSON and advanced compositions remain intact', async ({
  page,
}) => {
  await mount(page, { events: [] })
  await page.getByRole('button', { name: '新增事件', exact: true }).click()
  const editor = page.getByLabel('动态事件定义', { exact: true })
  await editor.getByLabel('标识', { exact: true }).fill('paid')
  const payload = editor.getByLabel('事件数据', { exact: true })
  await payload.getByRole('button', { name: '添加属性', exact: true }).click()
  await payload.getByPlaceholder('字段标识', { exact: true }).fill('amount')
  await payload.getByPlaceholder('字段标识', { exact: true }).blur()
  await expect
    .poll(async () => (await values(page)).events[0].payloadSchema?.properties)
    .toHaveProperty('amount')
  expect((await values(page)).events[0].subject).toBe('model')
  expect((await values(page)).events[0].allowedProducerKinds).toEqual(['action'])
  const complex = {
    type: 'object',
    oneOf: [{ required: ['amount'] }, { required: ['receipt'] }],
    properties: { amount: { type: 'number' }, receipt: { type: 'string' } },
    'x-future': { keep: true },
  }
  await mount(page, {
    events: [{ name: 'paid', subject: 'model', payloadSchema: complex }],
  })
  await page.getByRole('button', { name: /paid paid/ }).click()
  await expect(
    page.getByText('此数据结构使用高级定义维护。', { exact: true })
  ).toBeVisible()
  await page.getByLabel('业务说明', { exact: true }).fill('兼容组合结构')
  expect((await values(page)).events[0].payloadSchema).toEqual(complex)
})

test('behavior controls follow the standard form theme and density without local control overrides', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent =
        '*, *::before, *::after { transition: none !important; animation: none !important; }'
      document.head.append(style)
    })
  })
  await mount(
    page,
    {
      events: [{ name: 'approved', title: '订单已审核', subject: 'model' }],
      referenceName: '参考',
      referenceNote: '参考说明',
    },
    { styleReference: true }
  )
  const workbench = page.getByLabel('行为契约工作台', { exact: true })
  await workbench.getByRole('button', { name: /订单已审核/ }).click()
  const appearance = (locator) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element)
      return Object.fromEntries(
        [
          'height',
          'borderRadius',
          'borderColor',
          'backgroundColor',
          'color',
          'fontFamily',
          'fontSize',
          'fontWeight',
        ].map((property) => [property, style[property]])
      )
    })
  const comparisons = []
  for (const theme of ['light', 'dark']) {
    for (const density of ['normal', 'compact']) {
      await page.evaluate(
        ({ theme, density }) => {
          document.documentElement.dataset.theme = theme
          document.documentElement.dataset.density = density
        },
        { theme, density }
      )
      const input = workbench.getByLabel('显示名称', { exact: true })
      const referenceControls = page
        .getByRole('group', { name: '标准表单对照' })
        .getByRole('textbox')
      const referenceInput = referenceControls.first()
      const box = input.locator('..')
      const referenceBox = referenceInput.locator('..')
      const actual = await appearance(box)
      const reference = await appearance(referenceBox)
      const button = await appearance(
        workbench.getByRole('button', { name: '高级定义', exact: true })
      )
      const referenceButton = await appearance(
        page.getByRole('button', { name: '标准按钮', exact: true })
      )
      const text = await appearance(workbench.getByLabel('业务说明', { exact: true }))
      const referenceText = await appearance(referenceControls.nth(1))
      const gap = await workbench.evaluate((element) => getComputedStyle(element).rowGap)
      comparisons.push({
        theme,
        density,
        actual,
        reference,
        button,
        referenceButton,
        text,
        referenceText,
        gap,
      })
      expect(button).toEqual(referenceButton)
      for (const property of [
        'height',
        'borderRadius',
        'borderColor',
        'backgroundColor',
        'color',
        'fontFamily',
        'fontSize',
        'fontWeight',
      ]) {
        expect(actual[property], `${theme}/${density} input ${property}`).toBe(
          reference[property]
        )
        expect(text[property], `${theme}/${density} textarea ${property}`).toBe(
          referenceText[property]
        )
      }
      await input.focus()
      const focused = await appearance(box)
      await referenceInput.focus()
      await expect(referenceBox).toHaveCSS('border-color', focused.borderColor)
      await referenceInput.blur()
      await testInfo.attach(`${theme}-${density}`, {
        body: await workbench.screenshot({
          path: testInfo.outputPath(`${theme}-${density}.png`),
        }),
        contentType: 'image/png',
      })
    }
  }
  await testInfo.attach('style-comparisons', {
    body: JSON.stringify(comparisons, null, 2),
    contentType: 'application/json',
  })
  expect(parseFloat(comparisons[1].gap)).toBeLessThan(parseFloat(comparisons[0].gap))
  expect(parseFloat(comparisons[3].gap)).toBeLessThan(parseFloat(comparisons[2].gap))
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(391)
  await testInfo.attach('narrow-editor', {
    body: await page.screenshot({
      path: testInfo.outputPath('narrow-editor.png'),
      fullPage: true,
    }),
    contentType: 'image/png',
  })
})
