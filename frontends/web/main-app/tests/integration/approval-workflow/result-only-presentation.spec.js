const fs = require('node:fs')
const path = require('node:path')
const { test, expect } = require('@playwright/test')

const repo = path.resolve(__dirname, '../../../../../..')
const metadataRoot = path.join(repo, 'core/ouroboros-approval-workflow/ouroboros-approval-workflow-web/src/main/metadata')
const adminDetail = JSON.parse(fs.readFileSync(path.join(metadataRoot,
  'system-setting/approval-workflow-definition/instance-details/detail.ui-schema.json'), 'utf8')).schema
const adminList = JSON.parse(fs.readFileSync(path.join(metadataRoot,
  'system-setting/approval-workflow-definition/instance-details.ui-schema.json'), 'utf8')).schema

async function saveEvidence(page, testInfo, requests) {
  const screenshotPath = testInfo.outputPath('presentation.png')
  const requestsPath = testInfo.outputPath('requests.json')
  await page.screenshot({ path: screenshotPath })
  fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2))
  await testInfo.attach('presentation', { path: screenshotPath, contentType: 'image/png' })
  await testInfo.attach('requests', { path: requestsPath, contentType: 'application/json' })
}

async function openPresentation(page, schema, info) {
  const requests = []
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('request', request => {
    if (request.url().includes('/api/approval-workflow/')) requests.push(request.url())
  })
  await page.route('**/api/approval-workflow/**', async route => {
    const url = route.request().url()
    const data = url.endsWith('/info') ? info
      : url.includes('/list') ? { items: [info], total: 1 }
      : { definition: { nodes: [], edges: [] }, activeNodeIds: [], items: [] }
    await route.fulfill({ json: { code: 0, status: 0, data } })
  })
  await page.goto('/approval-workflow-playwright-harness.html?presentation')
  await expect(page.getByTestId('main-app-workflow-status')).toHaveText('Approval presentation ready')
  await page.evaluate(({ schema, info }) => window.renderApprovalPresentation(schema, info), { schema, info })
  return { requests, pageErrors }
}

for (const hasLink of [true, false]) {
  test(`APF-RESULT-UI-001 result-only detail respects capabilities, link=${hasLink}`, async ({ page }, testInfo) => {
    const { requests, pageErrors } = await openPresentation(page, adminDetail, {
      instanceId: 'result-tracking-1', status: 'running',
      externalUrl: hasLink ? 'https://approval.example/instance/1' : null,
      diagramAvailable: false, timelineAvailable: false, cancellable: false,
    })
    await expect.poll(() => requests.some(url => url.endsWith('/info'))).toBe(true)
    await expect(page.getByText('流程实例ID', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '打开外部审批' })).toHaveCount(hasLink ? 1 : 0)
    await expect(page.getByText('流程图', { exact: true })).toHaveCount(0)
    await expect(page.getByText('审批时间线', { exact: true })).toHaveCount(0)
    expect(requests.filter(url => /\/(diagram|timeline|task)(?:[/?]|$)/.test(url))).toEqual([])
    if (hasLink) {
      await page.context().route('https://approval.example/**', route => route.fulfill({ body: 'External approval' }))
      const popupPromise = page.waitForEvent('popup')
      await page.getByRole('button', { name: '打开外部审批' }).click()
      const popup = await popupPromise
      await expect(popup).toHaveURL('https://approval.example/instance/1')
      await popup.close()
    }
    await saveEvidence(page, testInfo, requests)
    expect(pageErrors).toEqual([])
  })
}

for (const cancellable of [true, false]) {
  test(`APF-RESULT-UI-002 cancel button follows capability, cancellable=${cancellable}`, async ({ page }, testInfo) => {
    const { requests, pageErrors } = await openPresentation(page, adminList, {
      flowKey: 'approval', instanceId: 'execution-1', status: 'running', cancellable,
    })
    await expect(page.getByRole('button', { name: '查看', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '强制结束', exact: true })).toHaveCount(cancellable ? 1 : 0)
    if (cancellable) {
      await page.getByRole('button', { name: '强制结束', exact: true }).click()
      const cancelled = page.waitForRequest(request =>
        request.url().endsWith('/execution-1/cancel') && request.method() === 'POST')
      await page.getByRole('button', { name: /^(确认|确定)$/ }).click()
      await cancelled
    }
    await saveEvidence(page, testInfo, requests)
    expect(pageErrors).toEqual([])
  })
}

test('APF-RESULT-UI-001 generated business detail opens external approval without local queries', async ({ page }, testInfo) => {
  test.skip(!process.env.OB_TEST_GENERATED_PROCESS_DETAIL,
    'Generate the business-model schema with Maven and pass its path explicitly')
  const schema = JSON.parse(fs.readFileSync(process.env.OB_TEST_GENERATED_PROCESS_DETAIL, 'utf8'))
  const { requests, pageErrors } = await openPresentation(page, schema, {
    instanceId: 'result-tracking-1', status: 'finished', outcome: 'approved',
    externalUrl: 'https://approval.example/instance/1',
    diagramAvailable: false, timelineAvailable: false, cancellable: false,
  })
  await expect.poll(() => requests.some(url => url.endsWith('/info'))).toBe(true)
  await page.getByText('审批记录', { exact: true }).click()
  await expect(page.getByText('approved', { exact: true })).toBeVisible()
  await page.context().route('https://approval.example/**', route => route.fulfill({ body: 'External approval' }))
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: '打开外部审批' }).click()
  const popup = await popupPromise
  await expect(popup).toHaveURL('https://approval.example/instance/1')
  await popup.close()
  expect(requests.filter(url => /\/(diagram|timeline|task)(?:[/?]|$)/.test(url))).toEqual([])
  expect(pageErrors).toEqual([])
  await saveEvidence(page, testInfo, requests)
})
