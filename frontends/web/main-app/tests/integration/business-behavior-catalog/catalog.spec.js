const { test, expect } = require('@playwright/test')

test('explicit format upgrade previews all resources, cancels cleanly and syncs the saved model only after success', async ({
  page,
}, testInfo) => {
  const previews = [],
    applications = []
  let rejectApplication = true
  await page.route(
    '**/business-model/sales.Order/format-upgrade-preview?*',
    async (route) => {
      const draft = route.request().postDataJSON()
      previews.push(draft)
      await route.fulfill({
        json: {
          code: 0,
          data: {
            requestId: new URL(route.request().url()).searchParams.get('requestId'),
            planFingerprint: 'reviewed-plan',
            upgradedModel: { ...draft, formatVersion: '2.0' },
            resources: [
              {
                path: 'business-model/sales.Order.business.json',
                operation: 'update',
                encoding: 'utf-8',
                before: JSON.stringify(draft),
                after: JSON.stringify({ ...draft, formatVersion: '2.0' }),
              },
              {
                path: 'logic-flow/sales.Order.approve.logicflow.json',
                operation: 'create',
                encoding: 'utf-8',
                before: null,
                after: '{"name":"sales.Order.approve","script":"return request.body"}',
              },
            ],
          },
        },
      })
    }
  )
  await page.route('**/business-model/sales.Order/format-upgrade?*', async (route) => {
    const draft = route.request().postDataJSON()
    applications.push({
      draft,
      fingerprint: new URL(route.request().url()).searchParams.get('planFingerprint'),
    })
    await route.fulfill({
      json: rejectApplication
        ? { code: -1, msg: '升级预览已过期，请重新预览' }
        : {
            code: 0,
            data: {
              businessModel: {
                ...draft,
                formatVersion: '2.0',
                actions: [{ name: 'approve' }],
              },
              validationSnapshot: { validationErrors: [] },
            },
          },
    })
  })
  await page.goto('/business-behavior-catalog-playwright-harness.html')
  await page.waitForFunction(() => window.behaviorCatalogHarness?.ready)
  const original = await page.evaluate(() => window.behaviorCatalogHarness.values())
  await page.getByRole('button', { name: '预览升级至 2.0' }).click()
  await expect(page.getByLabel('完整升级差异')).toBeVisible()
  await page
    .getByText('新增 · logic-flow/sales.Order.approve.logicflow.json', { exact: true })
    .click()
  await expect(page.getByLabel('完整升级差异')).toContainText('return request.body')
  const inside = await page.getByLabel('完整升级差异').evaluate((container) => {
    const boundary = container.getBoundingClientRect()
    return [...container.querySelectorAll('pre')].every((node) => {
      const box = node.getBoundingClientRect()
      return !box.width || (box.left >= boundary.left && box.right <= boundary.right + 1)
    })
  })
  expect(inside).toBe(true)
  await testInfo.attach('upgrade-resource-diff', {
    body: await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('upgrade-diff.png'),
    }),
    contentType: 'image/png',
  })
  await page.getByRole('button', { name: '取消升级' }).click()
  expect(await page.evaluate(() => window.behaviorCatalogHarness.values())).toEqual(
    original
  )
  expect(applications).toHaveLength(0)
  await page.getByRole('button', { name: '预览升级至 2.0' }).click()
  await page.getByPlaceholder('输入模型标题').fill('修改后的订单')
  await expect(page.getByRole('button', { name: '确认升级并提交' })).toBeDisabled()
  await page.getByRole('button', { name: '预览升级至 2.0' }).click()
  await page.getByRole('button', { name: '确认升级并提交' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: '升级预览已过期' })
  ).toBeVisible()
  expect(
    (await page.evaluate(() => window.behaviorCatalogHarness.values())).formatVersion
  ).toBeUndefined()
  rejectApplication = false
  await page.getByRole('button', { name: '预览升级至 2.0' }).click()
  await page.getByRole('button', { name: '确认升级并提交' }).click()
  await expect(
    page.getByText('当前模型已升级至 2.0 并提交，关联资源一同保存。')
  ).toBeVisible()
  const saved = await page.evaluate(() => window.behaviorCatalogHarness.values())
  expect(saved).toMatchObject({
    title: '修改后的订单',
    formatVersion: '2.0',
    actions: [{ name: 'approve' }],
  })
  expect(saved).not.toHaveProperty('planFingerprint')
  expect(saved).not.toHaveProperty('resources')
  expect(saved).not.toHaveProperty('validationSnapshot')
  expect(applications).toHaveLength(2)
  expect(applications[1]).toMatchObject({
    draft: { title: '修改后的订单' },
    fingerprint: 'reviewed-plan',
  })
  expect(previews.length).toBeGreaterThan(2)
})

function catalog(revision) {
  return {
    modelFullName: 'sales.Order',
    revision,
    actions: [
      {
        name: 'add',
        title: '新增',
        emits: [{ modelFullName: 'sales.Order', eventName: 'recordsCreated' }],
      },
    ],
    events: [
      {
        name: 'recordsCreated',
        title: '记录已新增',
        occurrenceCondition: '实际源写入提交后',
        allowedProducerKinds: ['action'],
        payloadSchema: { type: 'object' },
      },
    ],
    subscriptions: [],
    sources: [
      {
        memberType: 'event',
        memberName: 'recordsCreated',
        role: 'definition',
        kind: 'generated',
        source: { resource: 'sales.Order', fieldPath: 'fields', formatVersion: '2.0' },
      },
    ],
    conflicts: [],
    mutationEventPlans: { add: { eventNames: { INSERT: 'recordsCreated' } } },
  }
}

test('workflow event sources, conditional notifications and write effects remain read-only in the real catalog', async ({
  page,
}, testInfo) => {
  const contract = catalog('workflow-and-effects')
  contract.actions.push({ name: 'delete', title: '删除' })
  contract.events.push({
    name: 'workflowTaskCreated',
    title: '任务已创建',
    allowedProducerKinds: ['workflow'],
    occurrenceCondition: '源事实提交后经可靠投影产生',
  })
  contract.subscriptions.push({
    name: 'notifyTask',
    sourceEventModelFullName: 'sales.Order',
    sourceEventName: 'workflowTaskCreated',
  })
  contract.sources.push(
    {
      memberType: 'action',
      memberName: 'delete',
      role: 'effect',
      kind: 'generated',
      source: { resource: 'sales.Order', fieldPath: 'features.isEnabledSoftDelete' },
      description: '实际删除时执行软删除，仍保留 DELETE 业务语义',
    },
    {
      memberType: 'event',
      memberName: 'workflowTaskCreated',
      role: 'producer',
      kind: 'generated',
      source: { resource: 'approval-workflow-definition:approval', fieldPath: 'process' },
      description: '审批源事实经可靠投影产生，非每次 Action 调用必发',
    },
    {
      memberType: 'subscription',
      memberName: 'notifyTask',
      role: 'configuration',
      kind: 'generated',
      source: {
        resource: 'approval-workflow-definition:approval',
        fieldPath: 'notification.taskCreatedTemplate',
      },
      description: '按原模板、节点开关与当前接收资格检查',
    }
  )
  await page.route('**/api/dev/example/business-model/behavior-preview?*', (route) =>
    route.fulfill({
      json: {
        code: 0,
        data: {
          requestId: new URL(route.request().url()).searchParams.get('requestId'),
          catalog: contract,
          validationSnapshot: { validationErrors: [] },
        },
      },
    })
  )
  await page.goto('/business-behavior-catalog-playwright-harness.html')
  await page.waitForFunction(() => window.behaviorCatalogHarness?.ready)
  const original = await page.evaluate(() => window.behaviorCatalogHarness.values())
  await expect(page.getByText('配置检查通过', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /任务已创建 workflowTaskCreated/ }).click()
  const detail = page.getByLabel('行为详情')
  await expect(detail).toContainText('notifyTask')
  await expect(detail).toContainText('notification.taskCreatedTemplate')
  await expect(detail).toContainText('非每次 Action 调用必发')
  await expect(detail.getByRole('button', { name: '打开流程配置' })).toHaveCount(2)
  await expect(detail).toContainText('外部消费者待核验')
  await testInfo.attach('workflow-origins', {
    body: await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('workflow-origins.png'),
    }),
    contentType: 'image/png',
  })
  await page.getByRole('button', { name: '动作', exact: true }).click()
  await page.getByRole('button', { name: /删除 delete/ }).click()
  await expect(detail).toContainText('实际写入时的附加效果')
  await expect(detail).toContainText('实际删除时执行软删除')
  await expect(detail.getByRole('button', { name: '打开原配置' })).toBeVisible()
  expect(await page.evaluate(() => window.behaviorCatalogHarness.values())).toEqual(
    original
  )
})

test('real AMIS form preserves draft values, invalidates edited previews and separates target snapshots', async ({
  page,
}, testInfo) => {
  const requests = []
  await page.route(
    '**/api/dev/example/business-model/behavior-preview?*',
    async (route) => {
      const request = route.request(),
        data = request.postDataJSON()
      requests.push(data)
      await route.fulfill({
        json: {
          code: 0,
          data: {
            requestId: new URL(request.url()).searchParams.get('requestId'),
            draftFingerprint: data.title,
            codeContributionCoverage: 'development-environment-only',
            catalog: catalog('draft-' + data.title),
            validationSnapshot: { validationErrors: [] },
          },
        },
      })
    }
  )
  await page.route(
    '**/api/tunnel/example/api/business-model-behaviors/sales.Order/catalog',
    (route) =>
      route.fulfill({
        json: {
          code: 0,
          data: {
            view: 'published',
            catalog: catalog('published-only'),
            consumers: [],
            externalEvents: [],
          },
        },
      })
  )
  await page.goto('/business-behavior-catalog-playwright-harness.html')
  await page.waitForFunction(() => window.behaviorCatalogHarness?.ready)
  await expect(page.getByText('配置检查通过', { exact: true })).toBeVisible()
  await expect.poll(() => requests.at(-1)?.title).toBe('订单')
  await expect(
    page.getByRole('button', { name: /记录已新增 recordsCreated/ })
  ).toBeVisible()
  await page.getByRole('button', { name: /记录已新增 recordsCreated/ }).click()
  await expect(page.getByLabel('行为详情')).toContainText('add：实际源写入成功后自动产生')
  expect(requests[0]).toMatchObject({ namespace: 'sales', name: 'Order', events: [] })
  await page.getByPlaceholder('输入模型标题').fill('新标题')
  await expect(page.getByRole('status')).toContainText('配置已修改，待检查')
  await expect(page.getByText('配置检查通过', { exact: true })).toBeVisible()
  await expect.poll(() => requests.at(-1)?.title).toBe('新标题')
  await page.getByText('更多', { exact: true }).click()
  await page.getByRole('button', { name: '对照已发布版本' }).click()
  await expect(
    page.getByText('目标应用未连接，代码贡献与通知规则未核验。', { exact: true })
  ).toBeVisible()
  await page.getByLabel('目标会话 API 前缀').fill('/api/tunnel/example/api')
  await page.getByLabel('目标访问令牌（可选）').fill('target-session-token')
  await page.getByRole('button', { name: '连接应用并查询' }).click()
  await expect(page.getByText('已发布 ·', { exact: false })).toContainText(
    'published-only'
  )
  await page.getByRole('button', { name: '返回当前配置' }).click()
  await expect.poll(() => requests.at(-1)?.title).toBe('新标题')
  const saved = await page.evaluate(() => window.behaviorCatalogHarness.values())
  expect(saved).not.toHaveProperty('targetToken')
  expect(saved).not.toHaveProperty('published')
  expect(saved.behaviorCatalog).toBeUndefined()
  await testInfo.attach('behavior-catalog', {
    body: await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('catalog.png'),
    }),
    contentType: 'image/png',
  })
  const requestCount = requests.length
  const editor = page.getByRole('textbox', { name: /编辑器内容/ })
  await editor.click()
  await editor.press('ControlOrMeta+A')
  await page.keyboard.insertText('@')
  await page.getByPlaceholder('输入模型标题').fill('包含无效输入')
  await expect(
    page.getByRole('alert').filter({ hasText: '表单存在无效输入' })
  ).toBeVisible()
  expect(requests).toHaveLength(requestCount)
})
