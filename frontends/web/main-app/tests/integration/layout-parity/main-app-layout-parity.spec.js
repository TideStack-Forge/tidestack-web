const { test, expect } = require('@playwright/test')

const {
  attachLayoutParityEvidence,
  comparePngBuffers,
  normalizeText,
} = require('./helpers/evidence')

const LEGACY_BASE_URL = 'http://127.0.0.1:88'
const CURRENT_BASE_URL = 'http://127.0.0.1:43184'
const USERNAME = 'admin'
const PASSWORD = '666666'
const LOGIN_URL_PATTERN = /\/login(?:\?.*)?$/
const USER_DASHBOARD_URL_PATTERN = /\/user-dashboard(?:\?.*)?$/
const MAX_POST_LOGIN_SCREENSHOT_DIFF_RATIO = 0.03

function expectMatchingEvidence(currentEvidence, legacyEvidence, checkpointName) {
  const screenshotDiff = comparePngBuffers(
    currentEvidence.screenshotBuffer,
    legacyEvidence.screenshotBuffer
  )

  expect(
    currentEvidence.domSnapshot,
    `${checkpointName} DOM snapshot drifted from the legacy baseline`
  ).toEqual(legacyEvidence.domSnapshot)
  expect(
    screenshotDiff.sameSize,
    `${checkpointName} screenshot dimensions drifted from legacy`
  ).toBe(true)
  expect(
    screenshotDiff.diffRatio,
    `${checkpointName} screenshot drifted from the legacy baseline (${screenshotDiff.diffPixels}/${screenshotDiff.totalPixels} pixels, ratio ${screenshotDiff.diffRatio})`
  ).toBeLessThanOrEqual(MAX_POST_LOGIN_SCREENSHOT_DIFF_RATIO)
}

async function expectLoginPageReady(page) {
  await expect(page).toHaveURL(LOGIN_URL_PATTERN)
  await expect(page.getByRole('heading', { name: '技术开发平台2' })).toBeVisible()
  await expect(page.getByPlaceholder('请输入用户名')).toBeVisible()
  await expect(page.getByPlaceholder('请输入密码')).toBeVisible()
  await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
}

async function login(page) {
  await page.getByPlaceholder('请输入用户名').fill(USERNAME)
  await page.getByPlaceholder('请输入密码').fill(PASSWORD)
  await page.getByRole('button', { name: '登录' }).click()
}

async function expectPostLoginFrame(page) {
  await expect(page).toHaveURL(USER_DASHBOARD_URL_PATTERN)
  await expect(page.getByPlaceholder('请输入菜单名称')).toBeVisible()
  await expect(
    page.locator('.app-sidebar').getByText('技术开发平台2', { exact: true })
  ).toBeVisible()
  await expect(
    page.locator('.app-sidebar').getByText('张三', { exact: true })
  ).toBeVisible()
  await expect(page.locator('.app-tabs__item.is-active')).toContainText('个人门户')
}

function createContext(browser) {
  return browser.newContext({
    viewport: {
      width: 1440,
      height: 900,
    },
    locale: 'zh-CN',
    colorScheme: 'light',
  })
}

test('main-app matches legacy login and post-login layout anchors with DOM and screenshot evidence', async ({
  browser,
}, testInfo) => {
  const legacyContext = await createContext(browser)
  const currentContext = await createContext(browser)
  const legacyPage = await legacyContext.newPage()
  const currentPage = await currentContext.newPage()

  try {
    await test.step('login page parity', async () => {
      await legacyPage.goto(`${LEGACY_BASE_URL}/login`)
      await currentPage.goto(`${CURRENT_BASE_URL}/login`)

      await expectLoginPageReady(legacyPage)
      await expectLoginPageReady(currentPage)

      const legacyLoginEvidence = await attachLayoutParityEvidence({
        page: legacyPage,
        testInfo,
        name: 'legacy-login',
      })
      const currentLoginEvidence = await attachLayoutParityEvidence({
        page: currentPage,
        testInfo,
        name: 'current-login',
      })

      expect(normalizeText(currentLoginEvidence.domSnapshot.path)).toBe(
        normalizeText(legacyLoginEvidence.domSnapshot.path)
      )
      expect(
        currentLoginEvidence.domSnapshot,
        'login page DOM snapshot drifted from the legacy baseline'
      ).toEqual(legacyLoginEvidence.domSnapshot)
    })

    await test.step('post-login frame parity', async () => {
      await login(legacyPage)
      await login(currentPage)

      await expectPostLoginFrame(legacyPage)
      await expectPostLoginFrame(currentPage)

      const legacyPostLoginEvidence = await attachLayoutParityEvidence({
        page: legacyPage,
        testInfo,
        name: 'legacy-post-login',
      })
      const currentPostLoginEvidence = await attachLayoutParityEvidence({
        page: currentPage,
        testInfo,
        name: 'current-post-login',
      })

      expect(normalizeText(currentPostLoginEvidence.domSnapshot.path)).toBe(
        normalizeText(legacyPostLoginEvidence.domSnapshot.path)
      )
      expectMatchingEvidence(
        currentPostLoginEvidence,
        legacyPostLoginEvidence,
        'post-login frame'
      )
    })
  } finally {
    await legacyContext.close()
    await currentContext.close()
  }
})
