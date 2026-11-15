const { test, expect } = require('@playwright/test')

/**
 * 回归：input-table 行内新增（auto-inline）的行，必须在表单校验/提交时进入提交值。
 *
 * 缺陷背景：产品类别「标签模板」等子表列形态为「列级 required + quickEdit」且未配置
 * addApi / needConfirm，新增行走 auto-inline 分支。用户填写后提交，后端报
 * 「required property 'templateNo' not found」——提交载荷里该行仍是空对象。
 *
 * 两处成因，缺一不可：
 *   1. auto-inline 同步在刷入行内值期间会因自身副作用使 session.revision 前移，
 *      被「是否过期」判定误判为 stale 而整体丢弃，行始终未物化；
 *   2. 即便同步执行，其发射经 FormTable.emitValue 以单参数调用 onChange
 *      （即 wrapControl#handleChange），changeImmediately 为假而落到 250ms 防抖的
 *      lazyEmitChange；而表单取值会紧接着同步读取 store.data，读到的是未写入值的新增行。
 *
 * 真实提交时序为：表单提交 → 各表单项 validate() → 读取提交值。
 */
async function gotoHarness(page, query = '') {
  await page.goto(`/input-table-overlay-playwright-harness.html${query}`)
  await page.waitForFunction(() => {
    return window.__INPUT_TABLE_OVERLAY_PLAYWRIGHT_HARNESS__?.ready === true
  })
}

async function getHarnessValues(page) {
  return page.evaluate(() => {
    return window.__INPUT_TABLE_OVERLAY_PLAYWRIGHT_HARNESS__.getValues()
  })
}

async function validateHarness(page) {
  return page.evaluate(async () => {
    return window.__INPUT_TABLE_OVERLAY_PLAYWRIGHT_HARNESS__.validate()
  })
}

const SECTION = 'input-table-auto-inline-default'
const FIELD = 'autoInlineLines'

function section(page, className) {
  return page.locator(`.${className}`).first()
}

function inlineRow(page, className, rowIndex) {
  const rows = section(page, className).locator('tbody tr')
  return rowIndex === 'last' ? rows.last() : rows.nth(rowIndex)
}

async function clickAdd(page, className) {
  await section(page, className)
    .getByRole('button', { name: /新增|添加/ })
    .last()
    .click()
}

function amountInputAt(page, rowIndex) {
  return inlineRow(page, SECTION, rowIndex)
    .getByRole('cell')
    .nth(1)
    .locator('input:not([type="hidden"]):not([type="submit"])')
    .first()
}

function nameInputAt(page, rowIndex) {
  return inlineRow(page, SECTION, rowIndex)
    .getByRole('cell')
    .nth(0)
    .locator('input:not([type="hidden"]):not([type="submit"])')
    .first()
}

async function getNotifications(page) {
  return page.evaluate(() => {
    return window.__INPUT_TABLE_OVERLAY_PLAYWRIGHT_HARNESS__.getNotifications()
  })
}

test('真实提交时序：填写后 validate()，值应已进入提交值', async ({ page }) => {
  await gotoHarness(page)

  await clickAdd(page, SECTION)

  const rowIndex = 1
  await amountInputAt(page, rowIndex).fill('42')

  // 真实提交时序：表单先 validate()，之后才读取提交值
  await validateHarness(page)

  const values = await getHarnessValues(page)
  const row = values[FIELD]?.[rowIndex] || {}

  expect(row.amount ?? null).toBe(42)
})

test('真实提交时序：提交值中不应残留未物化的空行', async ({ page }) => {
  await gotoHarness(page)

  await clickAdd(page, SECTION)

  const rowIndex = 1
  await amountInputAt(page, rowIndex).fill('42')

  await validateHarness(page)

  const rows = (await getHarnessValues(page))[FIELD] || []
  const emptyRows = rows.filter(
    (row) => row?.amount === undefined || row?.amount === null
  )

  expect(emptyRows).toHaveLength(0)
})

test('点击默认 inline 新增不会弹出隐式校验 toast', async ({ page }) => {
  await gotoHarness(page)

  await clickAdd(page, SECTION)

  await page.waitForTimeout(800)
  expect(await page.locator('.cxd-Toast').count()).toBe(0)
})

test('主动触发表单校验时默认 inline 仍会弹出校验 toast', async ({ page }) => {
  await gotoHarness(page)

  await clickAdd(page, SECTION)
  await page.waitForTimeout(800)
  expect(await page.locator('.cxd-Toast').count()).toBe(0)

  await validateHarness(page)
  await page.waitForTimeout(800)
  expect(await page.locator('.cxd-Toast').count()).toBeGreaterThan(0)
})

for (const validation of ['field', 'form']) {
  for (const needConfirm of ['', '&needConfirm=false']) {
    const scenario = `${validation} / needConfirm=${needConfirm ? 'false' : '默认'}`
    const query = `?validation=${validation}${needConfirm}`

    test(`${scenario}：新增及无效草稿自动同步不弹 toast`, async ({ page }) => {
      await gotoHarness(page, query)
      await clickAdd(page, SECTION)
      await page.waitForTimeout(1800)
      expect(await getNotifications(page)).toEqual([])

      await nameInputAt(page, 1).fill('草稿')
      await nameInputAt(page, 1).fill('')
      await amountInputAt(page, 1).fill('42')
      await page.getByRole('button', { name: '提交校验' }).focus()
      await page.waitForTimeout(1800)
      expect(await getNotifications(page)).toEqual([])
    })

    for (const action of ['validate', 'submit']) {
      test(`${scenario}：${action} 失败只由外层 form 提示一次`, async ({ page }) => {
        await gotoHarness(page, `${query}&submitOnChange=false`)
        await clickAdd(page, SECTION)
        if (action === 'validate') {
          expect(await validateHarness(page)).toBe(false)
        } else {
          await page.getByRole('button', { name: '提交校验' }).click()
        }
        await page.waitForTimeout(800)
        expect(await getNotifications(page)).toEqual([
          { type: 'error', message: '外层表单校验失败' },
        ])
      })
    }
  }
}

test('内部 quick-edit form：有效新增仍写入外层 form 提交值', async ({ page }) => {
  await gotoHarness(page, '?validation=form&submitOnChange=false')
  await clickAdd(page, SECTION)
  await nameInputAt(page, 1).fill('Inline B')
  await amountInputAt(page, 1).fill('42')
  expect(await validateHarness(page)).toBe(true)
  expect((await getHarnessValues(page))[FIELD][1]).toMatchObject({
    name: 'Inline B',
    amount: 42,
  })
  expect(await getNotifications(page)).toEqual([])
})

test('内部 quick-edit form：已有行编辑只在外层主动校验失败时提示', async ({ page }) => {
  await gotoHarness(page, '?validation=form&submitOnChange=false')
  await nameInputAt(page, 0).fill('')
  await amountInputAt(page, 0).fill('')
  await page.getByRole('button', { name: '提交校验' }).focus()
  await page.waitForTimeout(1800)
  expect(await getNotifications(page)).toEqual([])
  expect(await validateHarness(page)).toBe(false)
  expect(await getNotifications(page)).toEqual([
    { type: 'error', message: '外层表单校验失败' },
  ])
})
