const { test, expect } = require('@playwright/test')

const seededToken = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 60 * 60,
  refreshTokenExpiresIn: 24 * 60 * 60,
  issuedAt: Date.now(),
}

const APP_NAME = 'Ouroboros Mock Layout'
const SIDEBAR_WIDTH_CONFIG = {
  'sidebar.width': 220,
  'sidebar.minWidth': 180,
  'sidebar.maxWidth': 300,
}

function buildSuccessEnvelope(data) {
  return {
    code: 0,
    status: 0,
    msg: '',
    data,
  }
}

async function seedAuthToken(page) {
  await page.addInitScript((token) => {
    window.localStorage.setItem('Ouroboros_token', JSON.stringify(token))
  }, seededToken)
}

async function mockSidebarRuntime(page, { layoutType, resizable, storedWidth = null }) {
  const state = {
    storedWidth,
    patchBodies: [],
  }

  await page.route('**/api/sys/web-app-info', async (route) => {
    const response = await route.fetch()
    const payload = await response.json()
    const appInfo = payload?.data && typeof payload.data === 'object' ? payload.data : {}

    await route.fulfill({
      response,
      contentType: 'application/json',
      body: JSON.stringify({
        ...payload,
        data: {
          ...appInfo,
          appName: APP_NAME,
          layoutType,
          config: {
            ...(appInfo.config || {}),
            ...SIDEBAR_WIDTH_CONFIG,
            'sidebar.resizable': resizable,
          },
        },
      }),
    })
  })

  await page.route('**/api/user-setting', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      const payload =
        state.storedWidth === null
          ? {}
          : {
              'sidebar-width': String(state.storedWidth),
            }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildSuccessEnvelope(payload)),
      })
      return
    }

    if (method === 'PATCH') {
      const body = route.request().postDataJSON()
      state.patchBodies.push(body)
      if (body?.settingName === 'sidebar-width') {
        state.storedWidth = body.settingValue
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildSuccessEnvelope(null)),
      })
      return
    }

    await route.fallback()
  })

  return state
}

async function readResolvedSidebarWidth(page) {
  return page.locator('.mothership-app-layout').evaluate((element) => {
    return getComputedStyle(element)
      .getPropertyValue('--layout-sidebar-width-open')
      .trim()
  })
}

async function dragSidebarHandleToMax(page) {
  const handle = page.locator('.app-sidebar__resize-handle')
  const box = await handle.boundingBox()
  if (!box) {
    throw new Error('Sidebar resize handle bounding box was not available')
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 240, box.y + box.height / 2, {
    steps: 12,
  })
  await page.mouse.up()
}

for (const layoutType of ['header-sidebar', 'sidebar-split', 'sidebar-split-no-header']) {
  test(`sidebar resize drag persists across reload in ${layoutType}`, async ({
    page,
  }) => {
    await seedAuthToken(page)
    const state = await mockSidebarRuntime(page, {
      layoutType,
      resizable: true,
      storedWidth: 280,
    })

    await page.goto('/welcome')

    await expect(page).toHaveURL(/\/welcome$/)
    await expect(page.getByTestId('welcome-page')).toHaveCount(1)
    await expect(page.locator('.app-sidebar')).toBeVisible()
    await expect(page.locator('.app-sidebar__resize-handle')).toBeVisible()
    await expect.poll(async () => readResolvedSidebarWidth(page)).toBe('280px')

    await dragSidebarHandleToMax(page)

    await expect.poll(async () => readResolvedSidebarWidth(page)).toBe('300px')
    await expect.poll(() => state.patchBodies.at(-1)?.settingValue).toBe(300)
    await expect(state.patchBodies.at(-1)).toMatchObject({
      settingName: 'sidebar-width',
      settingValue: 300,
      isAutoLoad: true,
    })

    await page.reload()

    await expect(page.getByTestId('welcome-page')).toHaveCount(1)
    await expect.poll(async () => readResolvedSidebarWidth(page)).toBe('300px')
  })
}

test('sidebar resize handle stays hidden and width falls back to config when resizing is disabled', async ({
  page,
}) => {
  await seedAuthToken(page)
  const state = await mockSidebarRuntime(page, {
    layoutType: 'sidebar-split-no-header',
    resizable: false,
    storedWidth: 280,
  })

  await page.goto('/welcome')

  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByTestId('welcome-page')).toHaveCount(1)
  await expect(page.locator('.app-sidebar')).toBeVisible()
  await expect(page.locator('.app-sidebar__resize-handle')).toHaveCount(0)
  await expect.poll(async () => readResolvedSidebarWidth(page)).toBe('220px')
  await expect(state.patchBodies).toHaveLength(0)
})
