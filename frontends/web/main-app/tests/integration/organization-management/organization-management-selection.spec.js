const { test, expect } = require('@playwright/test')

/**
 * 组织架构页「选中节点 → 页面数据域 → 右侧列表」回归测试。
 *
 * 背景：该页的选中状态由树的 change 事件用定向 setValue 写入页面数据域
 * （componentId 指向页面根），左侧按钮/右侧信息条用 ${nodeId} 显隐，员工列表
 * api 用 ${nodeId} 等拼查询条件。事件处理器必须挂在自身具备 setData 的数据域
 * 渲染器上，否则选中后不会产生任何可见效果（页面只剩「新增组织」）。
 *
 * 该场景依赖真实运行时后端与真实组织数据，因此通过环境变量开启：
 *   ORG_MGMT_BASE_URL / ORG_MGMT_USERNAME / ORG_MGMT_PASSWORD
 *   ORG_MGMT_COMPANY_NODE（可选，默认 B化工公司）
 *   ORG_MGMT_DEPARTMENT_NODE（可选，默认 1）
 */
const BASE_URL = process.env.ORG_MGMT_BASE_URL
const USERNAME = process.env.ORG_MGMT_USERNAME
const PASSWORD = process.env.ORG_MGMT_PASSWORD
const COMPANY_NODE = process.env.ORG_MGMT_COMPANY_NODE || 'B化工公司'
const DEPARTMENT_NODE = process.env.ORG_MGMT_DEPARTMENT_NODE || '1'

test.skip(
  !BASE_URL || !USERNAME || !PASSWORD,
  '需要 ORG_MGMT_BASE_URL / ORG_MGMT_USERNAME / ORG_MGMT_PASSWORD 指向真实环境'
)

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function login(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="text"]', USERNAME)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button:has-text("登录")')
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 })
}

async function openOrganizationManagement(page) {
  await login(page)
  await page.goto(`${BASE_URL}/system-setting/organization-management`, {
    waitUntil: 'domcontentloaded',
  })
}

function treeNodeLocator(page, label) {
  return page
    .locator('.cxd-Tree-itemLabel-item')
    .filter({ hasText: new RegExp(`^${escapeRegExp(label)}$`) })
    .first()
}

async function visibleButtonLabels(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .map((button) => (button.innerText || '').trim())
      .filter(Boolean)
  )
}

/** 选中树节点，并返回这次选中触发的「带节点条件的员工列表请求」数量 */
async function selectTreeNode(page, label) {
  const treeNode = treeNodeLocator(page, label)
  await expect(treeNode).toBeVisible({ timeout: 40_000 })

  const nodeScopedRequests = []
  const listener = (request) => {
    const url = request.url()
    if (!/\/api\/organization\/employees\?/.test(url)) {
      return
    }
    // 未选中时页面也会拉一次不带任何节点条件的列表，这里只统计带节点条件的
    if (/departmentId=[^&]+|companyId=[^&]+|positionId=[^&]+/.test(url)) {
      nodeScopedRequests.push(url)
    }
  }
  page.on('request', listener)
  try {
    await treeNode.click()
    await expect
      .poll(() => nodeScopedRequests.length, { timeout: 15_000 })
      .toBeGreaterThan(0)
    // 等待可能的重复请求（历史缺陷：容器与 crud 各触发一次 reload）
    await page.waitForTimeout(1_500)
    return nodeScopedRequests.length
  } finally {
    page.off('request', listener)
  }
}

test('选中公司节点后出现部门/编辑/查看/删除等操作入口', async ({ page }) => {
  await openOrganizationManagement(page)

  await expect(treeNodeLocator(page, COMPANY_NODE)).toBeVisible({ timeout: 40_000 })

  // 未选中：只有「新增组织」，没有任何依赖 nodeId 的入口
  await expect.poll(() => visibleButtonLabels(page)).toContain('新增组织')
  expect(await visibleButtonLabels(page)).not.toContain('新增部门')

  // amis 的单选处理绑在 .cxd-Tree-itemLabel-item 上
  const nodeScopedRequests = await selectTreeNode(page, COMPANY_NODE)

  // 选中后：左侧出现依赖 ${nodeId} 的操作入口（组织类型只出现组织相关入口）
  const labels = await visibleButtonLabels(page)
  expect(labels).toEqual(
    expect.arrayContaining(['新增子组织', '新增部门', '编辑组织', '查看详情', '删除组织'])
  )
  expect(labels).not.toEqual(expect.arrayContaining(['编辑部门', '删除部门', '分配岗位']))

  // 同一份 nodeId 也写入页面数据域：右侧信息条用 ${nodeId} 显隐
  await expect(page.locator('.bg-light')).toContainText(COMPANY_NODE)

  // 选中只应触发一次员工列表请求（历史缺陷：容器与 crud 各触发一次）
  expect(nodeScopedRequests).toBe(1)
})

test('删除选中节点后清空选中状态，不残留已删除节点信息', async ({ page }) => {
  await openOrganizationManagement(page)

  // 自建自删的临时部门，测试结束后环境保持原状
  const tempDepartment = `自动化验证部门${Date.now().toString().slice(-6)}`
  await selectTreeNode(page, COMPANY_NODE)
  await page.locator('button:has-text("新增部门")').first().click()
  await page
    .locator('.amis-dialog-widget input[name="name"]')
    .first()
    .fill(tempDepartment)
  await page.locator('.amis-dialog-widget button:has-text("提交")').first().click()
  await expect(treeNodeLocator(page, tempDepartment)).toBeVisible({ timeout: 20_000 })

  await selectTreeNode(page, tempDepartment)
  await expect(page.locator('.bg-light')).toContainText(tempDepartment)

  await page.locator('button:has-text("删除部门")').first().click()
  await page.locator('.amis-dialog-widget button:has-text("确定")').last().click()

  // 树中节点消失，且页面选中状态被清空（右侧信息条不再渲染、按钮回到未选中态）
  await expect(treeNodeLocator(page, tempDepartment)).toHaveCount(0, { timeout: 20_000 })
  await expect(page.locator('.bg-light')).toHaveCount(0, { timeout: 15_000 })

  await expect
    .poll(() => visibleButtonLabels(page), { timeout: 15_000 })
    .toContain('新增组织')
  expect(await visibleButtonLabels(page)).not.toContain('删除部门')
})

test('选中部门节点后出现分配岗位/编辑部门/删除部门，且不出现组织入口', async ({
  page,
}) => {
  await openOrganizationManagement(page)

  await expect(treeNodeLocator(page, DEPARTMENT_NODE)).toBeVisible({ timeout: 40_000 })
  const nodeScopedRequests = await selectTreeNode(page, DEPARTMENT_NODE)

  const labels = await visibleButtonLabels(page)
  expect(labels).toEqual(
    expect.arrayContaining(['新增部门', '分配岗位', '编辑部门', '查看详情', '删除部门'])
  )
  expect(labels).not.toEqual(
    expect.arrayContaining(['编辑组织', '删除组织', '新增子组织'])
  )

  await expect(page.locator('.bg-light')).toContainText(DEPARTMENT_NODE)
  expect(nodeScopedRequests).toBe(1)
})
