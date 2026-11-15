const { test, expect } = require('@playwright/test')

async function openPlayground(page) {
  await page.goto('/debug/statistics-sql-editor')
  await page.waitForFunction(() => {
    return window.__STATISTICS_SQL_EDITOR_PLAYGROUND__?.ready === true
  })
}

test('loads the statistics sql editor playground and switches to a dialect variant', async ({
  page,
}) => {
  await openPlayground(page)

  await expect(
    page.getByRole('heading', { name: 'Statistics SQL Editor Playground' })
  ).toBeVisible()
  await expect(page.getByText('通用 SQL', { exact: true })).toBeVisible()
  for (const [index, minHeight] of [300, 250].entries()) {
    const control = page.locator('.cxd-EditorControl').nth(index)
    await control.scrollIntoViewIfNeeded()
    const editor = control.locator('.monaco-editor').first()
    await expect(editor).toBeVisible()
    await expect
      .poll(async () =>
        editor.evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          const section = element.closest('section').getBoundingClientRect()
          return bounds.width / section.width
        })
      )
      .toBeGreaterThanOrEqual(0.95)
    await expect
      .poll(() => editor.evaluate((element) => element.getBoundingClientRect().height))
      .toBeGreaterThanOrEqual(minHeight)
  }
  await page.getByRole('button', { name: 'postgres-warehouse' }).click()
  await expect(page.getByText('方言 postgresql')).toBeVisible()
  await page.getByRole('button', { name: 'mysql-reporting' }).click()
  await expect(page.getByText('方言 mysql')).toBeVisible()
})

test('keeps datasource and variant edits when switching variants and supports adding and removing them', async ({
  page,
}) => {
  await openPlayground(page)

  await page
    .getByRole('combobox', { name: '数据源', exact: true })
    .selectOption('warehouse-read')
  await page
    .getByLabel('数据源标签', { exact: true })
    .first()
    .fill('warehouse, reporting')
  await page.getByLabel('方言版本范围', { exact: true }).fill('8.4')
  await page.getByRole('spinbutton', { name: '优先级', exact: true }).fill('120')
  await page.getByRole('button', { name: 'postgres-warehouse' }).click()
  await expect(page.getByLabel('方言', { exact: true })).toHaveValue('postgresql')
  await page.getByRole('button', { name: 'mysql-reporting' }).click()
  await expect(page.getByLabel('方言版本范围', { exact: true })).toHaveValue('8.4')
  await expect(page.getByRole('spinbutton', { name: '优先级', exact: true })).toHaveValue(
    '120'
  )
  await expect(page.getByRole('combobox', { name: '数据源', exact: true })).toHaveValue(
    'warehouse-read'
  )
  await expect(page.getByLabel('数据源标签', { exact: true }).first()).toHaveValue(
    'warehouse, reporting'
  )
  await page.getByRole('button', { name: '添加变体', exact: true }).click()
  await expect(
    page.getByRole('group', { name: 'SQL 方言变体' }).getByRole('button')
  ).toHaveCount(3)
  await expect(page.getByLabel('方言', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: '删除变体', exact: true }).click()
  await expect(
    page.getByRole('group', { name: 'SQL 方言变体' }).getByRole('button')
  ).toHaveCount(2)
  await expect(page.getByText('未保存', { exact: true })).toBeVisible()
})

test('marks the playground editor as unsaved and clears the badge after a save event', async ({
  page,
}) => {
  await openPlayground(page)

  await page.evaluate(() => {
    window.__STATISTICS_SQL_EDITOR_PLAYGROUND__.setGenericSqlValue(
      'select 1 as changed_from_playwright'
    )
  })

  await expect(page.getByText('未保存', { exact: true })).toBeVisible()

  await page.evaluate(() => {
    window.__STATISTICS_SQL_EDITOR_PLAYGROUND__.publishSavedEvent()
  })

  await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)
})

test('does not re-mark the playground editor dirty when the saved sql is replayed', async ({
  page,
}) => {
  await openPlayground(page)

  await page.evaluate(() => {
    window.__STATISTICS_SQL_EDITOR_PLAYGROUND__.setGenericSqlValue(
      'select 1 as replayed_saved_sql'
    )
  })

  await expect(page.getByText('未保存', { exact: true })).toBeVisible()

  await page.evaluate(() => {
    window.__STATISTICS_SQL_EDITOR_PLAYGROUND__.publishSavedEvent()
  })

  await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)

  await page.evaluate(() => {
    window.__STATISTICS_SQL_EDITOR_PLAYGROUND__.setGenericSqlValue(
      'select 1 as replayed_saved_sql'
    )
  })

  await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)
})
