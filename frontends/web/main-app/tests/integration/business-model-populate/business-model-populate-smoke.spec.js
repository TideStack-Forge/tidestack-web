const { test, expect } = require('@playwright/test')

function buildHarnessData(overrides = {}) {
  return {
    rootModelRef: 'crm.order',
    rootWhereValue: {
      status: 'PENDING',
      totalAmount: { $gte: 1000 },
    },
    populateValue: [
      'customer',
      {
        owner: ['id', 'nickname'],
      },
      {
        items: {
          where: {
            status: 'ACTIVE',
            quantity: { $gte: 1 },
          },
          populate: {
            product: {
              omit: ['costPrice'],
            },
          },
        },
      },
    ],
    ...overrides,
  }
}

async function gotoHarness(page) {
  await page.goto('/business-model-populate-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__BUSINESS_MODEL_POPULATE_PLAYWRIGHT_HARNESS__?.ready === true
  })
}

async function getHarnessValues(page) {
  return page.evaluate(() => {
    return window.__BUSINESS_MODEL_POPULATE_PLAYWRIGHT_HARNESS__.getValues()
  })
}

async function setHarnessValues(page, values, replace = true) {
  await page.evaluate(
    ({ nextValues, shouldReplace }) => {
      window.__BUSINESS_MODEL_POPULATE_PLAYWRIGHT_HARNESS__.setValues(
        nextValues,
        shouldReplace
      )
    },
    {
      nextValues: values,
      shouldReplace: replace,
    }
  )
}

function getPopulateNode(page, relationName) {
  return page.locator(`[data-populate-node="${relationName}"]`).first()
}

test('business model populate harness supports recursive populate editing flow', async ({
  page,
}, testInfo) => {
  await gotoHarness(page)

  await expect(
    page.getByRole('heading', { name: 'Populate / Where 编辑器 Smoke Harness' })
  ).toBeVisible()
  await expect(page.getByTestId('business-model-populate-live-data')).toContainText(
    '"rootModelRef": "crm.order"'
  )

  const initialValues = await getHarnessValues(page)
  expect(initialValues.populateValue[0]).toBe('customer')
  expect(initialValues.populateValue[1].owner).toEqual(['id', 'nickname'])
  expect(initialValues.populateValue[2].items.populate.product.omit).toEqual([
    'costPrice',
  ])

  await page.screenshot({
    path: testInfo.outputPath('business-model-populate-initial.png'),
    fullPage: true,
  })

  const standaloneWhere = page.getByRole('group', { name: 'Standalone Where' })
  await standaloneWhere.getByRole('button', { name: '原始 JSON' }).click()
  await expect(
    standaloneWhere.getByRole('button', { name: '切换到可视化' })
  ).toBeVisible()
  await standaloneWhere.getByRole('button', { name: '切换到可视化' }).click()
  await expect(standaloneWhere.getByRole('button', { name: '原始 JSON' })).toBeVisible()

  const populateEditor = page.getByRole('group', { name: 'Populate Editor' })
  await getPopulateNode(page, 'items').getByRole('button', { name: '编辑' }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText('relation: items')).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('business-model-populate-items-drawer.png'),
    fullPage: true,
  })
  await drawer.getByRole('button', { name: '原始 JSON' }).click()
  await expect(drawer.getByRole('button', { name: '切换到可视化' })).toBeVisible()
  await drawer.getByRole('button', { name: '切换到可视化' }).click()
  await drawer.getByRole('spinbutton').first().fill('5')
  await drawer.getByRole('button', { name: '保存' }).click()

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      if (Array.isArray(values.populateValue)) {
        return null
      }
      return values.populateValue?.items?.limit ?? null
    })
    .toBe(5)

  await expect(page.getByTestId('business-model-populate-live-data')).toContainText(
    '"limit": 5'
  )
  await expect(populateEditor.getByText('limit: 5')).toBeVisible()
})

test('where editor keeps unsupported list DSL in raw mode', async ({ page }) => {
  await gotoHarness(page)

  const unsupportedExpression = ['AND', ['=', 'status', 'PENDING']]
  await setHarnessValues(
    page,
    buildHarnessData({
      rootWhereValue: unsupportedExpression,
      populateValue: {
        customer: true,
      },
    })
  )

  const standaloneWhere = page.getByRole('group', { name: 'Standalone Where' })
  await expect(standaloneWhere.getByText('列表式 DSL')).toBeVisible()
  await expect(standaloneWhere.getByRole('textbox')).toBeVisible()
  await expect(page.getByTestId('business-model-populate-live-data')).toContainText(
    '"AND"'
  )

  const currentValues = await getHarnessValues(page)
  expect(currentValues.rootWhereValue).toEqual(unsupportedExpression)
})
;[
  {
    name: 'string populate input',
    populateValue: 'customer,owner',
    expectedRelations: ['customer', 'owner'],
    expectedOwner: true,
  },
  {
    name: 'list populate input',
    populateValue: ['customer', { owner: ['id'] }, { auditLogs: true }],
    expectedRelations: ['customer', 'owner', 'auditLogs'],
    expectedOwner: {
      select: ['id'],
    },
  },
  {
    name: 'map populate input',
    populateValue: {
      customer: true,
      owner: {
        select: ['id'],
      },
      items: {
        limit: 2,
      },
    },
    expectedRelations: ['customer', 'owner', 'items'],
    expectedOwner: {
      select: ['id'],
    },
  },
].forEach((scenario) => {
  test(`populate editor accepts ${scenario.name} and normalizes on save`, async ({
    page,
  }) => {
    await gotoHarness(page)
    await setHarnessValues(
      page,
      buildHarnessData({
        populateValue: scenario.populateValue,
      })
    )

    for (const relationName of scenario.expectedRelations) {
      await expect(getPopulateNode(page, relationName)).toBeVisible()
    }

    await getPopulateNode(page, 'owner').getByRole('button', { name: '编辑' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByText('relation: owner')).toBeVisible()
    await drawer.getByRole('button', { name: '保存' }).click()

    await expect
      .poll(async () => {
        const values = await getHarnessValues(page)
        if (
          Array.isArray(values.populateValue) ||
          typeof values.populateValue === 'string'
        ) {
          return null
        }
        return values.populateValue
      })
      .not.toBeNull()

    const currentValues = await getHarnessValues(page)
    expect(Array.isArray(currentValues.populateValue)).toBe(false)
    expect(typeof currentValues.populateValue).toBe('object')
    expect(currentValues.populateValue.customer).toBe(true)
    expect(currentValues.populateValue.owner).toEqual(scenario.expectedOwner)
  })
})
