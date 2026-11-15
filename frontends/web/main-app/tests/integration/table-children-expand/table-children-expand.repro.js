const { test, expect } = require('@playwright/test')

const USERNAME = process.env.OUROBOROS_TABLE_CHILDREN_USERNAME || 'admin'
const PASSWORD = process.env.OUROBOROS_TABLE_CHILDREN_PASSWORD
const TARGET_PATH = '/dev/test/ui?page=1'

function requirePassword() {
  if (!PASSWORD) {
    throw new Error('Set OUROBOROS_TABLE_CHILDREN_PASSWORD before running this repro')
  }
}

function extractAccessToken(tokenPayload) {
  const access = tokenPayload?.accessToken || tokenPayload?.access_token

  if (typeof access === 'string') {
    return access
  }

  return access?.token || access?.access_token || access?.value || null
}

async function authenticate(page, request) {
  const loginResponse = await request.post('/api/auth/login', {
    data: {
      username: USERNAME,
      password: PASSWORD,
    },
  })
  const loginBody = await loginResponse.json().catch(() => null)

  expect(loginResponse.status(), 'login response HTTP status').toBe(200)
  expect(loginBody?.code, loginBody?.msg || 'login API should return code=0').toBe(0)
  expect(extractAccessToken(loginBody?.data), 'login API should return an access token').toBeTruthy()

  await page.addInitScript((tokenPayload) => {
    window.localStorage.setItem('Ouroboros_token', JSON.stringify(tokenPayload))
  }, loginBody.data)

  return loginBody.data
}

function readRows(page) {
  return page.locator('table tbody tr').evaluateAll((rows) =>
    rows.map((row, rowIndex) => ({
      rowIndex,
      className: row.className,
      dataIndex: row.getAttribute('data-index') || row.getAttribute('row-index'),
      text: (row.innerText || '').replace(/\s+/g, ' ').trim(),
    }))
  )
}

function normalizeAngleFromTransform(transform) {
  if (!transform || transform === 'none') {
    return 0
  }

  const matrix = transform.match(/matrix\(([^)]+)\)/)
  expect(matrix, `transform should be a 2d matrix: ${transform}`).not.toBeNull()

  const [a, b] = matrix[1].split(',').slice(0, 2).map(Number)
  return ((Math.round((Math.atan2(b, a) * 180) / Math.PI) % 360) + 360) % 360
}

async function readRowExpandButtonDirection(row) {
  return row.locator('.cxd-Table-expandBtn2').evaluate((button) => {
    const ownerRow = button.closest('tr')
    const svg = button.querySelector('svg')
    return {
      rowText: (ownerRow?.innerText || '').replace(/\s+/g, ' ').trim(),
      isExpandedRow: ownerRow?.classList.contains('is-expanded') ?? false,
      isActiveButton: button.classList.contains('is-active'),
      svgTransform: svg ? getComputedStyle(svg).transform : 'none',
    }
  })
}

function findRowExpandButtonDirectionMismatches(direction, label, expectedExpanded) {
  const mismatches = []

  if (direction.isExpandedRow !== expectedExpanded) {
    mismatches.push(
      `${label}: row expansion state ${direction.isExpandedRow} did not become ${expectedExpanded}`
    )
  }

  if (direction.isActiveButton !== direction.isExpandedRow) {
    mismatches.push(
      `${label}: button active state ${direction.isActiveButton} does not follow row expansion ${direction.isExpandedRow}`
    )
  }

  const actualAngle = normalizeAngleFromTransform(direction.svgTransform)
  const expectedAngle = direction.isActiveButton ? 90 : 0
  if (actualAngle !== expectedAngle) {
    mismatches.push(
      `${label}: row expand button angle ${actualAngle} does not point ${direction.isActiveButton ? 'down' : 'right'} for ${direction.rowText}`
    )
  }

  return mismatches
}

async function assertRowExpandButtonPointsToState(row, label, expectedExpanded) {
  await expect
    .poll(
      async () =>
        findRowExpandButtonDirectionMismatches(
          await readRowExpandButtonDirection(row),
          label,
          expectedExpanded
        ),
      {
        message: `${label}: row expand button direction settles to row state`,
        timeout: 2_000,
      }
    )
    .toEqual([])
}

function findParentWithDistinctChild(items) {
  return items.find(
    (item) =>
      item &&
      typeof item.path === 'string' &&
      Array.isArray(item.children) &&
      item.children.some((child) => child?.path && child.path !== item.path)
  )
}

test('table renderer expands children rows from dev UI data', async ({ page, request }, testInfo) => {
  requirePassword()

  const tokenPayload = await authenticate(page, request)
  const accessToken = extractAccessToken(tokenPayload)
  const apiResponse = await request.get('/api/dev/test/ui?page=1', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const body = await apiResponse.json()

  await page.goto(TARGET_PATH, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await expect(page).toHaveURL(/\/dev\/test\/ui(?:\?.*)?$/)

  const items = Array.isArray(body?.data?.items) ? body.data.items : []
  const parent = findParentWithDistinctChild(items)
  const child = parent?.children.find((candidate) => candidate?.path !== parent.path)

  expect(body?.code, body?.msg || 'dev UI API should return code=0').toBe(0)
  expect(parent, 'fixture API should include at least one parent row with children').toBeTruthy()
  expect(child, 'parent row should include a distinct child path').toBeTruthy()

  await expect(page.locator('table tbody tr')).toHaveCount(items.length)

  const beforeRows = await readRows(page)
  const beforeCount = beforeRows.length
  const cycles = []

  for (let iteration = 1; iteration <= 3; iteration += 1) {
    const parentRow = page
      .locator('table tbody tr')
      .filter({ hasText: parent.path })
      .first()

    await expect(parentRow, `cycle ${iteration}: parent row ${parent.path} should be visible`).toBeVisible()
    await assertRowExpandButtonPointsToState(
      parentRow,
      `cycle ${iteration}: parent row ${parent.path} before expand`,
      false
    )
    await parentRow.locator('.cxd-Table-expandBtn2').click()

    await expect(parentRow, `cycle ${iteration}: parent row ${parent.path} should become expanded`).toHaveClass(
      /is-expanded/
    )
    await assertRowExpandButtonPointsToState(
      parentRow,
      `cycle ${iteration}: parent row ${parent.path} after expand`,
      true
    )

    await page.waitForFunction(
      ({ childPath, minimumCount }) => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'))
        return (
          rows.length > minimumCount &&
          rows.some((row) => row.textContent?.includes(childPath))
        )
      },
      { childPath: child.path, minimumCount: beforeCount },
      { timeout: 5_000 }
    )

    const afterExpandRows = await readRows(page)

    expect(
      afterExpandRows.length,
      `cycle ${iteration}: expanded children should increase rendered row count`
    ).toBeGreaterThan(beforeCount)
    expect(
      afterExpandRows.some((row) => row.text.includes(child.path)),
      `cycle ${iteration}: expanded child row ${child.path} should be rendered`
    ).toBe(true)

    await parentRow.locator('.cxd-Table-expandBtn2').click()
    await expect(parentRow, `cycle ${iteration}: parent row ${parent.path} should collapse`).not.toHaveClass(
      /is-expanded/
    )
    await assertRowExpandButtonPointsToState(
      parentRow,
      `cycle ${iteration}: parent row ${parent.path} after collapse`,
      false
    )

    await page.waitForFunction(
      ({ childPath, expectedCount }) => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'))
        return (
          rows.length === expectedCount &&
          !rows.some((row) => row.textContent?.includes(childPath))
        )
      },
      { childPath: child.path, expectedCount: beforeCount },
      { timeout: 5_000 }
    )

    const afterCollapseRows = await readRows(page)

    expect(afterCollapseRows.length, `cycle ${iteration}: collapsed row count should reset`).toBe(
      beforeCount
    )
    expect(
      afterCollapseRows.some((row) => row.text.includes(child.path)),
      `cycle ${iteration}: collapsed child row ${child.path} should be removed`
    ).toBe(false)

    cycles.push({
      iteration,
      afterExpandRows,
      afterCollapseRows,
    })
  }

  await testInfo.attach('table-children-expand-debug.json', {
    body: JSON.stringify(
      {
        parentPath: parent.path,
        childPath: child.path,
        beforeRows,
        cycles,
      },
      null,
      2
    ),
    contentType: 'application/json',
  })
})
