const fs = require('node:fs')
const path = require('node:path')
const { test, expect } = require('@playwright/test')

const root = path.resolve(__dirname, '../../../../../..')
const metadata = path.join(
  root,
  'core/ouroboros-approval-workflow/ouroboros-approval-workflow-web/src/main/metadata/approval-center/start/init-form.ui-schema.json'
)
const schema = JSON.parse(fs.readFileSync(metadata, 'utf8')).schema
const evidence = path.join(root, 'tmp/testing-evidence/approval-custom-form/browser')

for (const available of [false, true]) {
  test(`custom form start page follows actual form service availability: ${available}`, async ({
    page,
  }) => {
    const requests = []
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/api/approval-workflow/**', async (route) => {
      requests.push({ url: route.request().url(), method: route.request().method() })
      await route.fulfill({
        json: {
          code: 0,
          status: 0,
          data: available
            ? {
                type: 'container',
                formAvailable: true,
                body: [{ type: 'input-text', name: 'formData.title', label: '申请事项' }],
              }
            : {
                type: 'alert',
                level: 'info',
                formAvailable: false,
                body: '当前表单未接入通用审批页面，请通过业务页面操作（custom）',
              },
        },
      })
    })
    await page.goto('/approval-workflow-playwright-harness.html?presentation')
    await expect(page.getByTestId('main-app-workflow-status')).toHaveText(
      'Approval presentation ready'
    )
    await page.evaluate(
      (schema) => window.renderApprovalPresentation(schema, { id: 'custom-purchase' }),
      schema
    )
    if (available) {
      await expect(page.getByText('申请事项', { exact: true })).toBeVisible()
      await page.getByRole('textbox').fill('采购办公设备')
      await expect(page.getByRole('textbox')).toHaveValue('采购办公设备')
      await expect(page.getByRole('button', { name: '提交审批' })).toBeVisible()
    } else {
      await expect(
        page.getByText('当前表单未接入通用审批页面，请通过业务页面操作（custom）')
      ).toBeVisible()
      await expect(page.getByRole('button', { name: '提交审批' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: '重置' })).toHaveCount(0)
    }
    expect(requests.filter((request) => request.url.endsWith('/init-form'))).toHaveLength(
      1
    )
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0)
    expect(errors).toEqual([])
    fs.mkdirSync(evidence, { recursive: true })
    await page.screenshot({
      path: path.join(
        evidence,
        `start-form-${available ? 'available' : 'unavailable'}.png`
      ),
      fullPage: true,
    })
    fs.writeFileSync(
      path.join(evidence, `start-form-${available}-requests.json`),
      JSON.stringify(requests, null, 2)
    )
  })
}
