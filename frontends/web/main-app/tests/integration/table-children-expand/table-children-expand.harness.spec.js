const { test, expect } = require('@playwright/test')

async function gotoHarness(page) {
  await page.goto('/table-children-expand-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__TABLE_CHILDREN_EXPAND_PLAYWRIGHT_HARNESS__?.ready === true
  })
}

async function readRows(page) {
  return page.evaluate(() => {
    return window.__TABLE_CHILDREN_EXPAND_PLAYWRIGHT_HARNESS__.readRows()
  })
}

async function readHarnessValue(page, key) {
  return page.evaluate((harnessKey) => {
    return window.__TABLE_CHILDREN_EXPAND_PLAYWRIGHT_HARNESS__[harnessKey]
  }, key)
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

async function readExpandButtonDirections(page) {
  return page
    .locator('.table-children-expand-target')
    .evaluate((target) => {
      const readButton = (button, row) => {
        const svg = button.querySelector('svg')
        return {
          scope: row ? 'body' : 'header',
          rowText: (row?.innerText || 'header').replace(/\s+/g, ' ').trim(),
          rowClassName: row?.className || '',
          buttonClassName: button.className,
          isExpandedRow: row?.classList.contains('is-expanded') ?? false,
          isActiveButton: button.classList.contains('is-active'),
          svgTransform: svg ? getComputedStyle(svg).transform : 'none',
        }
      }

      return [
        ...Array.from(target.querySelectorAll('thead .cxd-Table-expandBtn2')).map((button) =>
          readButton(button, null)
        ),
        ...Array.from(target.querySelectorAll('tbody tr')).flatMap((row) => {
          const button = row.querySelector('.cxd-Table-expandBtn2')
          return button ? [readButton(button, row)] : []
        }),
      ]
    })
}

function findExpandButtonDirectionMismatches(directions, label) {
  const mismatches = []

  if (directions.length === 0) {
    mismatches.push(`${label}: no expand buttons rendered`)
  }

  if (directions.filter((direction) => direction.scope === 'body').length === 0) {
    mismatches.push(`${label}: no body expand buttons rendered`)
  }

  for (const [index, direction] of directions.entries()) {
    if (direction.scope === 'body' && direction.isActiveButton !== direction.isExpandedRow) {
      mismatches.push(
        `${label}: body expand button ${index} active state ${direction.isActiveButton} does not follow row expansion ${direction.isExpandedRow} for ${direction.rowText}`
      )
    }

    const actualAngle = normalizeAngleFromTransform(direction.svgTransform)
    const expectedAngle = direction.isActiveButton ? 90 : 0
    if (actualAngle !== expectedAngle) {
      mismatches.push(
        `${label}: expand button ${index} angle ${actualAngle} does not point ${direction.isActiveButton ? 'down' : 'right'} for ${direction.rowText}`
      )
    }
  }

  return mismatches
}

async function assertExpandButtonsPointToRowState(page, label) {
  await expect
    .poll(async () => findExpandButtonDirectionMismatches(await readExpandButtonDirections(page), label), {
      message: `${label}: expand button directions settle to row state`,
      timeout: 2_000,
    })
    .toEqual([])
}

async function expandRowAndWaitForDescendant(page, options) {
  const { rowPath, descendantPath, collapsedCount, label } = options
  const row = page
    .locator('.table-children-expand-target table tbody tr')
    .filter({ hasText: rowPath })
    .first()

  await expect(row, `${label}: row ${rowPath} visible`).toBeVisible()
  await row.locator('.cxd-Table-expandBtn2').click()
  await expect(row, `${label}: row ${rowPath} expanded`).toHaveClass(/is-expanded/)

  await page.waitForFunction(
    ({ targetDescendantPath, minimumCount }) => {
      const rows = Array.from(
        document.querySelectorAll('.table-children-expand-target table tbody tr')
      )
      return (
        rows.length > minimumCount &&
        rows.some((candidate) => candidate.textContent?.includes(targetDescendantPath))
      )
    },
    { targetDescendantPath: descendantPath, minimumCount: collapsedCount },
    { timeout: 5_000 }
  )

  return row
}

async function collapseRow(page, options) {
  const { rowPath, label } = options
  const row = page
    .locator('.table-children-expand-target table tbody tr')
    .filter({ hasText: rowPath })
    .first()

  await expect(row, `${label}: row ${rowPath} visible before collapse`).toBeVisible()
  await row.locator('.cxd-Table-expandBtn2').click()
  await expect(row, `${label}: row ${rowPath} collapsed`).not.toHaveClass(/is-expanded/)
}

test('table renderer expands and collapses children rows across repeated render cycles', async ({
  page,
}, testInfo) => {
  await gotoHarness(page)

  const snapshots = []

  for (let iteration = 1; iteration <= 5; iteration += 1) {
    const scenario = await page.evaluate((iterationIndex) => {
      return window.__TABLE_CHILDREN_EXPAND_PLAYWRIGHT_HARNESS__.renderScenario({
        iteration: iterationIndex,
      })
    }, iteration)

    const parentPath = await page.evaluate(
      () => window.__TABLE_CHILDREN_EXPAND_PLAYWRIGHT_HARNESS__.parentPath
    )
    const childPath = await readHarnessValue(page, 'childPath')
    const grandchildPath = await readHarnessValue(page, 'grandchildPath')
    const greatGrandchildPath = await readHarnessValue(page, 'greatGrandchildPath')
    const expectedCollapsedCount = await readHarnessValue(page, 'expectedCollapsedCount')

    await expect(page.locator('.table-children-expand-target table tbody tr')).toHaveCount(
      expectedCollapsedCount
    )
    await assertExpandButtonsPointToRowState(page, `iteration ${iteration} initial`)

    const cycleSnapshots = []

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      const label = `iteration ${iteration} cycle ${cycle}`
      const parentRow = await expandRowAndWaitForDescendant(page, {
        rowPath: parentPath,
        descendantPath: childPath,
        collapsedCount: expectedCollapsedCount,
        label,
      })
      await expandRowAndWaitForDescendant(page, {
        rowPath: childPath,
        descendantPath: grandchildPath,
        collapsedCount: expectedCollapsedCount,
        label,
      })
      await expandRowAndWaitForDescendant(page, {
        rowPath: grandchildPath,
        descendantPath: greatGrandchildPath,
        collapsedCount: expectedCollapsedCount,
        label,
      })

      const expandedRows = await readRows(page)
      await assertExpandButtonsPointToRowState(page, label)
      ;[
        [childPath, 'child row'],
        [grandchildPath, 'grandchild row'],
        [greatGrandchildPath, 'great-grandchild row'],
      ].forEach(([path, description]) => {
        expect(
          expandedRows.some((row) => row.text.includes(path)),
          `${label}: ${description} rendered`
        ).toBe(true)
      })

      if (iteration === 1 && cycle === 1) {
        const screenshotPath =
          process.env.OUROBOROS_TABLE_CHILDREN_SCREENSHOT_PATH ||
          testInfo.outputPath('table-children-multilevel-expanded.png')

        await page.screenshot({
          path: screenshotPath,
          fullPage: true,
        })
        await testInfo.attach('table-children-multilevel-expanded.png', {
          path: screenshotPath,
          contentType: 'image/png',
        })
      }

      await collapseRow(page, { rowPath: grandchildPath, label })
      await collapseRow(page, { rowPath: childPath, label })
      await parentRow.locator('.cxd-Table-expandBtn2').click()
      await expect(parentRow, `${label}: parent collapsed`).not.toHaveClass(/is-expanded/)

      await page.waitForFunction(
        ({ descendantPaths, collapsedCount }) => {
          const rows = Array.from(
            document.querySelectorAll('.table-children-expand-target table tbody tr')
          )
          return (
            rows.length === collapsedCount &&
            descendantPaths.every(
              (path) => !rows.some((row) => row.textContent?.includes(path))
            )
          )
        },
        {
          descendantPaths: [childPath, grandchildPath, greatGrandchildPath],
          collapsedCount: expectedCollapsedCount,
        },
        { timeout: 5_000 }
      )

      const collapsedRows = await readRows(page)
      expect(collapsedRows.length, `${label}: collapsed count`).toBe(
        expectedCollapsedCount
      )
      ;[childPath, grandchildPath, greatGrandchildPath].forEach((path) => {
        expect(collapsedRows.some((row) => row.text.includes(path)), `${label}: ${path} removed`).toBe(
          false
        )
      })

      cycleSnapshots.push({
        cycle,
        expandedRows,
        collapsedRows,
      })
    }

    snapshots.push({
      iteration,
      scenarioRows: scenario.rows,
      cycleSnapshots,
    })
  }

  await testInfo.attach('table-children-expand-repeat-snapshots.json', {
    body: JSON.stringify(snapshots, null, 2),
    contentType: 'application/json',
  })
})
