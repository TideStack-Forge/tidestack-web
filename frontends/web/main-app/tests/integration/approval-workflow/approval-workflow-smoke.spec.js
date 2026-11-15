const { test, expect } = require('@playwright/test')

test('main app loads the approval workflow editor', async ({ page }) => {
  const saveRequests = []

  await page.route(
    '**/api/approval-workflow/base-info/form/default/purchase/expression-variable',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          status: 0,
          msg: '',
          data: [],
        }),
      })
    }
  )

  await page.route('**/api/approval-workflow/base-info/categories', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: [],
      }),
    })
  })

  await page.route('**/api/approval-workflow/base-info/form/default/', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: [
          {
            title: '采购单',
            name: 'purchase',
          },
        ],
      }),
    })
  })

  await page.route('**/api/approval-workflow/definition/main-app-flow-v2?deploy=false', async (route) => {
    saveRequests.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        status: 0,
        msg: '',
        data: null,
      }),
    })
  })

  await page.goto('/approval-workflow-playwright-harness.html')
  await expect(page.getByRole('button', { name: '保存' })).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: '保存' }).click()

  await expect.poll(() => saveRequests.length).toBe(1)
  expect(saveRequests[0].formatVersion).toBe(2)
  expect(saveRequests[0].id).toBe('main-app-flow-v2')
  expect(saveRequests[0].nodes.find((node) => node.id === 'approve-main-app').candidates).toEqual([
    { type: 'user', value: 'u1' },
  ])
})
