const { test, expect } = require('@playwright/test')

async function gotoHarness(page) {
  await page.goto('/input-table-overlay-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__INPUT_TABLE_OVERLAY_PLAYWRIGHT_HARNESS__?.ready === true
  })
}

async function getHarnessValues(page) {
  return page.evaluate(() => {
    return window.__INPUT_TABLE_OVERLAY_PLAYWRIGHT_HARNESS__.getValues()
  })
}

function section(page, className) {
  return page.locator(`.${className}`).first()
}

async function clickAddInSection(page, className) {
  const root = section(page, className)
  await root
    .getByRole('button', { name: /新增|添加/ })
    .last()
    .click()
}

async function clickEditInSection(page, className) {
  const root = section(page, className)
  await root.locator('tbody tr').first().locator('button:has(svg[icon="pencil"])').click()
}

async function confirmOverlay(page) {
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /确认|确定|保存/ })
    .last()
    .click()
}

async function cancelOverlay(page) {
  await page.getByRole('button', { name: /取消/ }).last().click()
}

async function expectNoOverlay(page) {
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

function overlayTextInput(overlay, index = 0) {
  return overlay.locator('input:not([type="hidden"]):not([type="submit"])').nth(index)
}

function overlayNumberInput(overlay) {
  return overlay.getByRole('spinbutton').first()
}

function overlayTextarea(overlay) {
  return overlay.locator('textarea').first()
}

async function amountInputAt(page, rowIndex) {
  return section(page, 'input-table-lts-enhancements')
    .locator('tbody tr')
    .nth(rowIndex)
    .locator('td')
    .nth(1)
    .locator('input:not([type="hidden"])')
    .first()
}

function inlineRow(page, className, rowIndex) {
  const rows = section(page, className).locator('tbody tr')
  return rowIndex === 'last' ? rows.last() : rows.nth(rowIndex)
}

function inlineInputAt(page, className, rowIndex, columnIndex = 0) {
  return inlineRow(page, className, rowIndex)
    .getByRole('cell')
    .nth(columnIndex)
    .locator('input:not([type="hidden"]):not([type="submit"])')
    .first()
}

function inlineNamedInputAt(page, className, rowIndex, name) {
  return inlineRow(page, className, rowIndex)
    .locator(`input[name="${name}"]:not([type="hidden"]):not([type="submit"])`)
    .first()
}

async function waitForInputTableInlineEditTick(page) {
  await page.evaluate(() => {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(resolve)
      })
    })
  })
}

async function requireBoundingBox(locator) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box
}

test('input-table overlay supports default-derived add dialog and edit drawer', async ({
  page,
}) => {
  await gotoHarness(page)

  await clickAddInSection(page, 'input-table-overlay-default')

  const addDialog = page.getByRole('dialog')
  await expect(addDialog.getByText('新增明细 Dialog')).toBeVisible()
  await expect(addDialog.getByText('名称')).toBeVisible()
  await expect(overlayTextInput(addDialog)).toBeVisible()
  await expect(addDialog.getByText('金额')).toBeVisible()
  await expect(overlayNumberInput(addDialog)).toBeVisible()
  await expect(addDialog.getByText('不进入弹层')).toHaveCount(0)

  await overlayTextInput(addDialog).fill('Bob')
  await overlayNumberInput(addDialog).fill('12')
  await confirmOverlay(page)

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.defaultOverlayLines?.some(
        (item) => item.name === 'Bob' && Number(item.amount) === 12
      )
    })
    .toBe(true)
  await expectNoOverlay(page)

  await clickEditInSection(page, 'input-table-overlay-default')

  const editDrawer = page.getByRole('dialog')
  await expect(editDrawer.getByText('编辑明细 Drawer')).toBeVisible()
  await expect(editDrawer.getByText('名称')).toBeVisible()
  await expect(overlayTextInput(editDrawer)).toBeVisible()
  await expect(editDrawer.getByText('金额')).toBeVisible()
  await expect(overlayNumberInput(editDrawer)).toBeVisible()
  await expect(editDrawer.getByText('不进入弹层')).toHaveCount(0)
  await cancelOverlay(page)
  await expectNoOverlay(page)
})

test('parent form validation preserves an add overlay when edit remains inline', async ({
  page,
}) => {
  await gotoHarness(page)

  await clickAddInSection(page, 'input-table-overlay-mixed-mode')

  const addDialog = page.getByRole('dialog')
  await expect(addDialog.getByText('混合模式新增 Dialog')).toBeVisible()
  await expect(
    page.evaluate(async () => {
      return window.__INPUT_TABLE_OVERLAY_PLAYWRIGHT_HARNESS__.validate()
    })
  ).resolves.toBe(true)
  await expect(addDialog).toBeVisible()

  await overlayTextInput(addDialog).fill('Mixed mode row')
  await confirmOverlay(page)

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.mixedModeOverlayLines?.[0]?.name
    })
    .toBe('Mixed mode row')
  await expectNoOverlay(page)
})

test('default inline renders native controls and commits immediately', async ({
  page,
}) => {
  await gotoHarness(page)

  const root = section(page, 'input-table-auto-inline-default')
  const firstRow = inlineRow(page, 'input-table-auto-inline-default', 0)

  await expect(root.getByRole('button', { name: '保存' })).toHaveCount(0)
  await expect(root.getByRole('button', { name: '取消' })).toHaveCount(0)
  await expect(firstRow.locator('button:has(svg[icon="pencil"])')).toHaveCount(0)

  const editNameInput = await inlineInputAt(page, 'input-table-auto-inline-default', 0, 0)
  await editNameInput.fill('Inline Edited')
  await expect(editNameInput).toBeFocused()
  await expect(editNameInput).toHaveValue('Inline Edited')

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.autoInlineLines?.[0]?.name
    })
    .toBe('Inline Edited')
})

test('inline needConfirm=true keeps rows static and commits only after row save', async ({
  page,
}) => {
  await gotoHarness(page)

  const root = section(page, 'input-table-confirm-inline-no-api')
  const firstRow = inlineRow(page, 'input-table-confirm-inline-no-api', 0)

  await expect(root.getByRole('button', { name: '保存' })).toHaveCount(0)
  await expect(root.getByRole('button', { name: '取消' })).toHaveCount(0)
  await expect(firstRow.locator('input:not([type="hidden"])')).toHaveCount(0)
  await expect(firstRow.locator('button:has(svg[icon="pencil"])')).toBeVisible()

  await clickEditInSection(page, 'input-table-confirm-inline-no-api')
  await expect(root.getByRole('button', { name: '保存' })).toBeVisible()
  await expect(root.getByRole('button', { name: '取消' })).toBeVisible()

  const editNameInput = await inlineInputAt(
    page,
    'input-table-confirm-inline-no-api',
    0,
    0
  )
  await editNameInput.fill('Confirm Edited')

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.confirmInlineLines?.[0]?.name
    })
    .toBe('Confirm A')

  await root.getByRole('button', { name: '保存' }).click()

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.confirmInlineLines?.[0]?.name
    })
    .toBe('Confirm Edited')

  await clickAddInSection(page, 'input-table-confirm-inline-no-api')
  await expect(root.getByRole('button', { name: '取消' })).toBeVisible()

  await expect
    .poll(async () => {
      return page.evaluate(async () => {
        return window.__INPUT_TABLE_OVERLAY_PLAYWRIGHT_HARNESS__.validate()
      })
    })
    .toBe(false)

  await inlineInputAt(page, 'input-table-confirm-inline-no-api', 'last', 0).fill(
    'Validated add'
  )
  await inlineInputAt(page, 'input-table-confirm-inline-no-api', 'last', 1).fill('10')

  await expect
    .poll(async () => {
      return page.evaluate(async () => {
        return window.__INPUT_TABLE_OVERLAY_PLAYWRIGHT_HARNESS__.validate()
      })
    })
    .toBe(false)

  await root.getByRole('button', { name: '保存' }).click()

  await expect
    .poll(async () => {
      return page.evaluate(async () => {
        return window.__INPUT_TABLE_OVERLAY_PLAYWRIGHT_HARNESS__.validate()
      })
    })
    .toBe(true)
})

test('default inline lazy-rendered table is available for manual checks', async ({
  page,
}) => {
  await gotoHarness(page)

  const root = section(page, 'input-table-default-inline-lazy')
  await expect(root.locator('tbody[data-lazy-row-body="true"]')).toHaveCount(1)
  await expect(root.getByRole('button', { name: '保存' })).toHaveCount(0)
  await expect(root.getByRole('button', { name: '取消' })).toHaveCount(0)
  await expect(
    inlineRow(page, 'input-table-default-inline-lazy', 0).locator(
      'button:has(svg[icon="pencil"])'
    )
  ).toHaveCount(0)
  const firstNameInput = await inlineInputAt(
    page,
    'input-table-default-inline-lazy',
    0,
    1
  )
  await firstNameInput.fill('Lazy Inline Immediate')
  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.lazyDefaultInlineLines?.[0]?.name
    })
    .toBe('Lazy Inline Immediate')
  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.lazyDefaultInlineLines?.length
    })
    .toBe(40)
  await expect
    .poll(async () => {
      return root.locator('[data-lazy-row-placeholder]').count()
    })
    .toBeGreaterThan(0)

  const addButton = root.getByRole('button', { name: /新增|添加/ }).last()
  await addButton.scrollIntoViewIfNeeded()
  await addButton.click()
  await expect(root.getByRole('button', { name: '保存' })).toHaveCount(0)
  await expect(root.getByRole('button', { name: '取消' })).toBeVisible()
  await expect(root.getByRole('button', { name: /新增|添加/ })).toHaveCount(0)

  const addedNameInput = await inlineInputAt(
    page,
    'input-table-default-inline-lazy',
    'last',
    1
  )
  const addedAmountInput = await inlineInputAt(
    page,
    'input-table-default-inline-lazy',
    'last',
    2
  )
  const addedRemarkInput = await inlineInputAt(
    page,
    'input-table-default-inline-lazy',
    'last',
    3
  )
  await expect(addedNameInput).toBeVisible()
  await addedNameInput.fill('Lazy Default Add')
  await addedAmountInput.fill('41')
  await addedRemarkInput.fill('Immediate add row')

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      const item = values.lazyDefaultInlineLines?.find(
        (line) => line.name === 'Lazy Default Add'
      )
      return !!item && Number(item.amount) === 41 && item.remark === 'Immediate add row'
    })
    .toBe(true)

  await expect(root.getByRole('button', { name: '取消' })).toHaveCount(0)
  await expect(addButton).toBeEnabled()
  await expect(
    inlineRow(page, 'input-table-default-inline-lazy', 'last').locator(
      'button:has(svg[icon="minus"])'
    )
  ).toBeVisible()
})

test('inline needConfirm=true lazy-rendered table keeps save confirmation', async ({
  page,
}) => {
  await gotoHarness(page)

  const root = section(page, 'input-table-confirm-inline-lazy')
  await expect(root.locator('tbody[data-lazy-row-body="true"]')).toHaveCount(1)
  await expect(root.getByRole('button', { name: '保存' })).toHaveCount(0)
  await expect(root.getByRole('button', { name: '取消' })).toHaveCount(0)
  await expect(
    inlineRow(page, 'input-table-confirm-inline-lazy', 0).locator(
      'button:has(svg[icon="pencil"])'
    )
  ).toBeVisible()
  await expect(
    inlineRow(page, 'input-table-confirm-inline-lazy', 0).locator(
      'input:not([type="hidden"])'
    )
  ).toHaveCount(0)
  await expect
    .poll(async () => {
      return root.locator('[data-lazy-row-placeholder]').count()
    })
    .toBeGreaterThan(0)

  const addButton = root.getByRole('button', { name: /新增|添加/ }).last()
  await addButton.scrollIntoViewIfNeeded()
  const scrollHeights = await root.evaluate((el) => {
    const scroller = el.querySelector('.input-table-confirm-inline-lazy-scroll')
    const heights = scroller ? [scroller.scrollHeight] : []
    const observer = scroller
      ? new ResizeObserver(() => heights.push(scroller.scrollHeight))
      : undefined

    observer?.observe(scroller)
    el.__inputTableScrollHeights = { heights, observer }
    return heights
  })
  const pageScrollBeforeAdd = await page.evaluate(() => window.scrollY)
  await addButton.click()
  await expect(root.getByRole('button', { name: '保存' })).toBeVisible()
  await expect(root.getByRole('button', { name: '取消' })).toBeVisible()
  await expect
    .poll(async () => {
      return root.evaluate((el) => {
        const scroller = el.querySelector('.input-table-confirm-inline-lazy-scroll')
        return scroller
          ? scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop
          : Infinity
      })
    })
    .toBeLessThanOrEqual(2)
  await expect
    .poll(async () => {
      return page.evaluate(
        (before) => Math.abs(window.scrollY - before),
        pageScrollBeforeAdd
      )
    })
    .toBeLessThanOrEqual(2)
  const observedScrollHeights = await root.evaluate((el) => {
    const state = el.__inputTableScrollHeights
    state?.observer?.disconnect()
    return state?.heights || []
  })
  expect(Math.min(...observedScrollHeights)).toBeGreaterThanOrEqual(scrollHeights[0])

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.lazyConfirmInlineLines?.length
    })
    .toBe(40)

  const addedNameInput = await inlineInputAt(
    page,
    'input-table-confirm-inline-lazy',
    'last',
    1
  )
  await expect(addedNameInput).toBeFocused()
  const addedAmountInput = await inlineInputAt(
    page,
    'input-table-confirm-inline-lazy',
    'last',
    2
  )
  await addedNameInput.fill('Lazy Inline Add')
  await addedAmountInput.fill('41')

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.lazyConfirmInlineLines?.some(
        (line) => line.name === 'Lazy Inline Add'
      )
    })
    .toBe(false)

  await root.getByRole('button', { name: '保存' }).click()

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      const item = values.lazyConfirmInlineLines?.find(
        (line) => line.name === 'Lazy Inline Add'
      )
      return !!item && Number(item.amount) === 41
    })
    .toBe(true)

  const addedRow = inlineRow(page, 'input-table-confirm-inline-lazy', 'last')
  await expect(root.getByRole('button', { name: '取消' })).toHaveCount(0)
  await expect(addedRow.locator('button:has(svg[icon="pencil"])')).toBeVisible()
  await expect(addedRow.locator('button:has(svg[icon="minus"])')).toBeVisible()
})

test('inline needConfirm works with explicit save buttons without row apis', async ({
  page,
}) => {
  await gotoHarness(page)

  const root = section(page, 'input-table-confirm-inline-no-api')
  await clickAddInSection(page, 'input-table-confirm-inline-no-api')

  await expect(root.getByRole('button', { name: '保存' })).toBeVisible()
  await inlineInputAt(page, 'input-table-confirm-inline-no-api', 'last', 0).fill(
    'Confirm Add'
  )
  await inlineInputAt(page, 'input-table-confirm-inline-no-api', 'last', 1).fill('12')
  await waitForInputTableInlineEditTick(page)

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.confirmInlineLines?.some((line) => line.name === 'Confirm Add')
    })
    .toBe(false)

  await root.getByRole('button', { name: '保存' }).click()

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      const item = values.confirmInlineLines?.find((line) => line.name === 'Confirm Add')
      return !!item && Number(item.amount) === 12
    })
    .toBe(true)
})

test('configured row api keeps inline actions on explicit save buttons', async ({
  page,
}) => {
  await gotoHarness(page)

  await clickAddInSection(page, 'input-table-api-gated-inline')

  const root = section(page, 'input-table-api-gated-inline')
  await expect(root.getByRole('button', { name: '保存' })).toBeVisible()
  await inlineInputAt(page, 'input-table-api-gated-inline', 'last', 0).fill('API Add')

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.apiGatedInlineLines?.some((line) => line.name === 'API Add')
    })
    .toBe(false)

  await root.getByRole('button', { name: '取消' }).click()
  await clickEditInSection(page, 'input-table-api-gated-inline')
  await expect(root.getByRole('button', { name: '保存' })).toBeVisible()
  await inlineInputAt(page, 'input-table-api-gated-inline', 0, 0).fill('API Edited')

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.apiGatedInlineLines?.[0]?.name
    })
    .toBe('API A')

  await root.getByRole('button', { name: '保存' }).click()

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.apiGatedInlineLines?.[0]?.name
    })
    .toBe('API Edited')
})

test('input-table operation config controls add placement and custom state buttons', async ({
  page,
}) => {
  await gotoHarness(page)

  const root = section(page, 'input-table-operation-config')
  const explicitColumnsRoot = section(page, 'input-table-columns-toggler-explicit')
  const topToolbar = root.locator('[class*="InputTable-addToolbar--top-right"]').first()
  const topAddButton = root.getByRole('button', {
    name: '配置顶部新增',
  })

  await expect(root.getByRole('button', { name: '列设置' })).toHaveCount(0)
  await expect(explicitColumnsRoot.getByRole('button', { name: '列设置' })).toBeVisible()
  await expect(topToolbar).toBeVisible()
  await expect(topToolbar.getByRole('button', { name: '配置顶部新增' })).toBeVisible()
  await expect(topAddButton).toBeVisible()

  const rootBox = await requireBoundingBox(root)
  const tableBox = await requireBoundingBox(root.locator('table').first())
  const addButtonBox = await requireBoundingBox(topAddButton)
  const explicitColumnsTableBox = await requireBoundingBox(
    explicitColumnsRoot.locator('table').first()
  )
  const columnsTogglerBox = await requireBoundingBox(
    explicitColumnsRoot.getByRole('button', { name: '列设置' })
  )
  expect(addButtonBox.y).toBeLessThan(tableBox.y)
  expect(addButtonBox.x).toBeGreaterThan(rootBox.x + rootBox.width / 2)
  const addButtonGap = tableBox.y - (addButtonBox.y + addButtonBox.height)
  const columnsTogglerGap =
    explicitColumnsTableBox.y - (columnsTogglerBox.y + columnsTogglerBox.height)
  expect(addButtonGap).toBeGreaterThan(0)
  expect(Math.abs(addButtonGap - columnsTogglerGap)).toBeLessThanOrEqual(4)

  const topLeftColumnsRoot = section(page, 'input-table-columns-toggler-top-left')
  const topRightColumnsRoot = section(page, 'input-table-columns-toggler-top-right')
  const topLeftToolbar = topLeftColumnsRoot
    .locator('[class*="InputTable-addToolbar--top-left"]')
    .first()
  const topRightToolbar = topRightColumnsRoot
    .locator('[class*="InputTable-addToolbar--top-right"]')
    .first()
  const topLeftAddButton = topLeftColumnsRoot.getByRole('button', {
    name: '左上新增',
  })
  const topLeftColumnsButton = topLeftColumnsRoot.getByRole('button', {
    name: '列设置',
  })
  const topRightAddButton = topRightColumnsRoot.getByRole('button', {
    name: '右上新增',
  })
  const topRightColumnsButton = topRightColumnsRoot.getByRole('button', {
    name: '列设置',
  })

  await expect(topLeftToolbar).toBeVisible()
  await expect(topRightToolbar).toBeVisible()
  await expect(topLeftToolbar).toHaveCount(1)
  await expect(topRightToolbar).toHaveCount(1)
  await expect(topLeftToolbar.getByRole('button', { name: '左上新增' })).toBeVisible()
  await expect(topLeftToolbar.getByRole('button', { name: '列设置' })).toBeVisible()
  await expect(topRightToolbar.getByRole('button', { name: '右上新增' })).toBeVisible()
  await expect(topRightToolbar.getByRole('button', { name: '列设置' })).toBeVisible()

  const topLeftAddBox = await requireBoundingBox(topLeftAddButton)
  const topLeftColumnsBox = await requireBoundingBox(topLeftColumnsButton)
  const topRightAddBox = await requireBoundingBox(topRightAddButton)
  const topRightColumnsBox = await requireBoundingBox(topRightColumnsButton)
  expect(Math.abs(topLeftAddBox.y - topLeftColumnsBox.y)).toBeLessThanOrEqual(4)
  expect(topLeftAddBox.x).toBeGreaterThan(topLeftColumnsBox.x + topLeftColumnsBox.width)
  expect(Math.abs(topRightAddBox.y - topRightColumnsBox.y)).toBeLessThanOrEqual(4)
  expect(topRightAddBox.x).toBeGreaterThan(topRightColumnsBox.x)

  const firstRow = inlineRow(page, 'input-table-operation-config', 0)
  await expect(firstRow.locator('button:has(svg[icon="pencil"])')).toHaveCount(0)
  await expect(firstRow.locator('button:has(svg[icon="minus"])')).toHaveCount(0)
  await expect(firstRow.getByRole('button', { name: '普通编辑' })).toBeVisible()
  await expect(firstRow.getByRole('button', { name: '普通复制' })).toBeVisible()
  await expect(firstRow.getByRole('button', { name: '普通删除' })).toBeVisible()

  await firstRow.getByRole('button', { name: '普通编辑' }).click()
  await expect(root.getByRole('button', { name: '编辑保存' })).toBeVisible()
  await expect(root.getByRole('button', { name: '编辑取消' })).toBeVisible()
  await expect(root.getByRole('button', { name: '普通编辑' })).toHaveCount(0)
  await waitForInputTableInlineEditTick(page)
  const operationNameInput = inlineNamedInputAt(
    page,
    'input-table-operation-config',
    0,
    'name'
  )
  await operationNameInput.fill('Operation Edited')
  await expect(operationNameInput).toHaveValue('Operation Edited')
  await waitForInputTableInlineEditTick(page)
  await page.waitForTimeout(100)
  await root.getByRole('button', { name: '编辑保存' }).click()
  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.operationConfigLines?.[0]?.name
    })
    .toBe('Operation Edited')
  await expect(root.getByRole('button', { name: '编辑保存' })).toHaveCount(0)

  const lengthBeforeCopy = await getHarnessValues(page).then(
    (values) => values.operationConfigLines?.length
  )
  await firstRow.getByRole('button', { name: '普通复制' }).click()
  await expect(root.getByRole('button', { name: '新增保存' })).toBeVisible()
  await expect(root.getByRole('button', { name: '新增取消' })).toBeVisible()
  await root.getByRole('button', { name: '新增保存' }).click()
  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.operationConfigLines?.length
    })
    .toBe(lengthBeforeCopy + 1)
  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.operationConfigLines?.filter(
        (line) => line.name === 'Operation Edited'
      ).length
    })
    .toBe(2)

  await root.getByRole('button', { name: '普通插入' }).first().click()
  await expect(root.getByRole('button', { name: '新增保存' })).toBeVisible()
  await expect(root.getByRole('button', { name: '新增取消' })).toBeVisible()
  await inlineNamedInputAt(page, 'input-table-operation-config', 1, 'name').fill(
    'Canceled Operation Add'
  )
  await waitForInputTableInlineEditTick(page)
  await root.getByRole('button', { name: '新增取消' }).click()
  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.operationConfigLines?.some(
        (line) => line.name === 'Canceled Operation Add'
      )
    })
    .toBe(false)

  await topAddButton.click()
  await expect(root.getByRole('button', { name: '新增保存' })).toBeVisible()
  await inlineNamedInputAt(page, 'input-table-operation-config', 'last', 'name').fill(
    'Operation Add'
  )
  await inlineNamedInputAt(page, 'input-table-operation-config', 'last', 'amount').fill(
    '9'
  )
  await waitForInputTableInlineEditTick(page)
  await root.getByRole('button', { name: '新增保存' }).click()
  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      const item = values.operationConfigLines?.find(
        (line) => line.name === 'Operation Add'
      )
      return !!item && Number(item.amount) === 9
    })
    .toBe(true)

  await root.getByRole('button', { name: '普通删除' }).last().click()
  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.operationConfigLines?.some((line) => line.name === 'Operation Add')
    })
    .toBe(false)
})

test('input-table operation actionTypes stay scoped and honor row guards', async ({
  page,
}) => {
  await gotoHarness(page)

  const fallbackRoot = section(page, 'input-table-operation-fallback')
  await expect(fallbackRoot.getByRole('button', { name: '只改普通态编辑' })).toBeVisible()
  await fallbackRoot.getByRole('button', { name: '只改普通态编辑' }).click()
  await expect(fallbackRoot.getByRole('button', { name: '保存' })).toBeVisible()
  await expect(fallbackRoot.getByRole('button', { name: '取消' })).toBeVisible()
  await expect(fallbackRoot.getByRole('button', { name: '只改普通态编辑' })).toHaveCount(
    0
  )
  await fallbackRoot.getByRole('button', { name: '取消' }).click()
  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.operationFallbackLines?.[0]?.inputTableOperation
        ?.__ouroborosInputTableOperationContext
    })
    .toBe(true)
  await fallbackRoot.getByRole('button', { name: '单元删除动作' }).click()
  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.operationFallbackLines?.length
    })
    .toBe(1)

  const immediateRoot = section(page, 'input-table-operation-immediate')
  await expect(immediateRoot.getByRole('button', { name: '不应显示编辑' })).toHaveCount(0)
  await expect(immediateRoot.getByRole('button', { name: '保存' })).toHaveCount(0)
  await expect(immediateRoot.getByRole('button', { name: '取消' })).toHaveCount(0)
  const noTypeNameInput = inlineInputAt(page, 'input-table-operation-immediate', 0, 0)
  await expect(noTypeNameInput).toBeVisible()
  await noTypeNameInput.fill('Immediate Edited')
  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.operationImmediateLines?.[0]?.name
    })
    .toBe('Immediate Edited')
  await expect(immediateRoot.getByRole('button', { name: '即时添加子项' })).toBeVisible()
  await immediateRoot.getByRole('button', { name: '即时添加子项' }).click()
  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.operationImmediateLines?.[0]?.children?.length
    })
    .toBe(1)

  const guardRoot = section(page, 'input-table-operation-guards')
  await guardRoot.getByRole('button', { name: '限制新增' }).click()
  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.operationGuardLines?.length
    })
    .toBe(1)
  await expect(guardRoot.getByRole('button', { name: '保存' })).toHaveCount(0)

  await guardRoot.getByRole('button', { name: '限制删除' }).click()
  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.operationGuardLines?.length
    })
    .toBe(1)
})

test('input-table LTS enhancements support row aggregate and arrow navigation', async ({
  page,
}) => {
  await gotoHarness(page)

  const firstAmount = await amountInputAt(page, 0)
  const secondAmount = await amountInputAt(page, 1)

  await firstAmount.click()
  await firstAmount.fill('5')
  await firstAmount.press('ArrowDown')

  await expect(secondAmount).toBeFocused()

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.navigationAggregateLines?.find((item) => item.code === 'TOTAL')
        ?.amount
    })
    .toBe('7')
})

test('input-table overlay supports custom add drawer and edit dialog form items', async ({
  page,
}) => {
  await gotoHarness(page)

  await clickAddInSection(page, 'input-table-overlay-custom')

  const addDrawer = page.getByRole('dialog')
  await expect(addDrawer.getByText('新增明细 Drawer')).toBeVisible()
  await expect(addDrawer.getByText('新增名称')).toBeVisible()
  await expect(overlayTextInput(addDrawer)).toBeVisible()
  await expect(addDrawer.getByText('备注')).toHaveCount(0)

  await overlayTextInput(addDrawer).fill('Custom Add')
  await confirmOverlay(page)

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.customOverlayLines?.some((item) => item.name === 'Custom Add')
    })
    .toBe(true)
  await expectNoOverlay(page)

  await clickEditInSection(page, 'input-table-overlay-custom')

  const editDialog = page.getByRole('dialog')
  await expect(editDialog.getByText('编辑明细 Dialog')).toBeVisible()
  await expect(editDialog.getByText('编辑备注')).toBeVisible()
  await expect(overlayTextarea(editDialog)).toBeVisible()
  await expect(editDialog.getByText('名称')).toHaveCount(0)
  await overlayTextarea(editDialog).fill('changed remark')
  await confirmOverlay(page)

  await expect
    .poll(async () => {
      const values = await getHarnessValues(page)
      return values.customOverlayLines?.some((item) => item.remark === 'changed remark')
    })
    .toBe(true)
  await expectNoOverlay(page)
})
