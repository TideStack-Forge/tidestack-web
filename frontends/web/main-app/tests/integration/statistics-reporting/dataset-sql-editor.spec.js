const { test, expect } = require('@playwright/test')

const { installBrowserErrorChecks } = require('./helpers/browserErrors')

installBrowserErrorChecks(test)

async function openPlayground(page) {
  await page.goto('/debug/dataset-sql-editor')
  await page.waitForFunction(() => {
    return window.__DATASET_SQL_EDITOR_PLAYGROUND__?.ready === true
  })
}

test('loads the dataset sql editor playground and switches dialect SQL', async ({
  page,
}) => {
  await openPlayground(page)

  await expect(
    page.getByRole('heading', { name: '数据集 SQL 编辑器调试页' })
  ).toBeVisible()
  await expect(page.getByRole('tab', { name: '基础 SQL' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page.getByRole('tab', { name: 'mysql' })).toBeVisible()
  await page.getByRole('tab', { name: 'mysql' }).click()
  await expect(page.getByRole('tab', { name: 'mysql' })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page.getByLabel('方言名称')).toHaveValue('mysql')
})

test('marks the playground editor as unsaved and clears the badge after a save event', async ({
  page,
}) => {
  await openPlayground(page)

  await page.evaluate(() => {
    window.__DATASET_SQL_EDITOR_PLAYGROUND__.setSqlValue(
      'select 1 as changed_from_playwright'
    )
  })

  await expect(page.getByText('未保存', { exact: true })).toBeVisible()

  await page.evaluate(() => {
    window.__DATASET_SQL_EDITOR_PLAYGROUND__.publishSavedEvent()
  })

  await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)
})

test('does not re-mark the playground editor dirty when the saved sql is replayed', async ({
  page,
}) => {
  await openPlayground(page)

  await page.evaluate(() => {
    window.__DATASET_SQL_EDITOR_PLAYGROUND__.setSqlValue(
      'select 1 as replayed_saved_sql'
    )
  })

  await expect(page.getByText('未保存', { exact: true })).toBeVisible()

  await page.evaluate(() => {
    window.__DATASET_SQL_EDITOR_PLAYGROUND__.publishSavedEvent()
  })

  await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)

  await page.evaluate(() => {
    window.__DATASET_SQL_EDITOR_PLAYGROUND__.setSqlValue(
      'select 1 as replayed_saved_sql'
    )
  })

  await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)
})
