const { test, expect } = require('@playwright/test')

async function gotoHarness(page) {
  await page.goto('/form-smart-layout-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__FORM_SMART_LAYOUT_PLAYWRIGHT_HARNESS__?.ready === true
  })
}

async function readFirstFieldMetrics(page, formSelector) {
  return page.evaluate((selector) => {
    const root = document.querySelector(selector)
    const form =
      root?.closest?.('.cxd-Form') || root?.querySelector?.('.cxd-Form') || root
    const input = root?.querySelector?.('input[name="name"]')
    const labels = Array.from(root?.querySelectorAll?.('.cxd-Form-label') || [])
    const label = labels.find((item) => item.textContent?.includes('标准名称'))

    if (!root || !form || !input || !label) {
      return null
    }

    const labelBox = label.getBoundingClientRect()
    const inputBox = input.getBoundingClientRect()

    return {
      formClassName: form.className,
      labelAboveInput: labelBox.bottom <= inputBox.top + 2,
      labelBox: {
        top: labelBox.top,
        bottom: labelBox.bottom,
        left: labelBox.left,
        right: labelBox.right,
      },
      inputBox: {
        top: inputBox.top,
        bottom: inputBox.bottom,
        left: inputBox.left,
        right: inputBox.right,
      },
    }
  }, formSelector)
}

test('service-wrapped table fieldset still uses smartLayout normal label placement', async ({
  page,
}) => {
  await gotoHarness(page)

  const directTableMetrics = await readFirstFieldMetrics(
    page,
    '.form-smart-layout-direct-table'
  )
  const serviceTableMetrics = await readFirstFieldMetrics(
    page,
    '.form-smart-layout-service-table'
  )

  expect(directTableMetrics).not.toBeNull()
  expect(serviceTableMetrics).not.toBeNull()
  expect(directTableMetrics.formClassName).toContain('cxd-Form--normal')
  expect(serviceTableMetrics.formClassName).toContain('cxd-Form--normal')
  expect(serviceTableMetrics.formClassName).not.toContain('cxd-Form--horizontal')
  expect(directTableMetrics.labelAboveInput).toBe(true)
  expect(serviceTableMetrics.labelAboveInput).toBe(true)
})

test('mapping field keeps its label and occupies a form grid cell', async ({ page }) => {
  await gotoHarness(page)

  const metrics = await page.evaluate(() => {
    const root = document.querySelector('.form-smart-layout-direct-table')
    const items = Array.from(root?.querySelectorAll?.('[data-role="form-item"]') || [])
    const item = items.find(
      (candidate) => candidate.getAttribute('data-amis-name') === 'status'
    )
    const aliasItem = items.find(
      (candidate) => candidate.getAttribute('data-amis-name') === 'statusAlias'
    )
    const secondColumnItem = items.find(
      (candidate) => candidate.getAttribute('data-amis-name') === 'vehicleType'
    )
    if (!item || !aliasItem || !secondColumnItem) {
      return null
    }

    const label = item.querySelector('.cxd-Form-label')
    const value = item.querySelector('.cxd-MappingField')
    const labelBox = label?.getBoundingClientRect()
    const valueBox = value?.getBoundingClientRect()
    const aliasLabel = aliasItem.querySelector('.cxd-Form-label')
    const aliasValue = aliasItem.querySelector('.cxd-MappingField')

    return {
      formClassName: item.closest('.cxd-Form')?.className || '',
      labelText: label?.textContent?.trim() || '',
      valueText: value?.textContent?.trim() || '',
      aliasLabelText: aliasLabel?.textContent?.trim() || '',
      aliasValueText: aliasValue?.textContent?.trim() || '',
      labelAboveValue: labelBox && valueBox ? labelBox.bottom <= valueBox.top + 2 : false,
      itemLeft: Math.round(item.getBoundingClientRect().left),
      secondColumnItemLeft: Math.round(secondColumnItem.getBoundingClientRect().left),
    }
  })

  expect(metrics).not.toBeNull()
  expect(metrics.formClassName).toContain('cxd-Form--column-2')
  expect(metrics.labelText).toBe('状态')
  expect(metrics.valueText).toBe('启用')
  expect(metrics.aliasLabelText).toBe('状态（别名）')
  expect(metrics.aliasValueText).toBe('停用')
  expect(metrics.labelAboveValue).toBe(true)
  expect(metrics.itemLeft).toBeLessThan(metrics.secondColumnItemLeft)
})
