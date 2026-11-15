const { test, expect } = require('@playwright/test')

const SCENARIOS = [
  {
    id: 'c1p-inline-allocated-width',
    scenario: 'c1p',
    width: 1742,
    viewport: { width: 1820, height: 360 },
    assertMetrics(metrics) {
      expect(metrics.crudClassNames.join(' ')).toContain('crud-filter-layout--inline')
      expect(metrics.crudClassNames.join(' ')).not.toContain(
        'crud-filter-form--mobile-stacked'
      )
      expect(metrics.formColumns).toBe('4')
      expect(metrics.dateRangeClassName).toContain('crud-filter-control--fill-width')
      expect(metrics.dateRangeWidth).toBeGreaterThan(320)
    },
  },
  {
    id: 'w1e-rail-wide-head',
    scenario: 'w1e',
    width: 1280,
    viewport: { width: 1360, height: 420 },
    assertMetrics(metrics) {
      expect(metrics.crudClassNames.join(' ')).toContain('crud-filter-layout--rail')
      expect(metrics.crudClassNames.join(' ')).toContain(
        'crud-filter-layout-topology--wide-head'
      )
      expect(metrics.dateRangeWidth).toBeGreaterThan(320)
      expect(metrics.dateRangeWidth).toBeLessThan(520)
    },
  },
  {
    id: 'wmp-wide-head-intrinsic-date-width',
    scenario: 'wmp',
    width: 1280,
    viewport: { width: 1360, height: 520 },
    assertMetrics(metrics) {
      expect(metrics.crudClassNames.join(' ')).toContain('crud-filter-layout--inline')
      expect(metrics.crudClassNames.join(' ')).toContain(
        'crud-filter-layout-topology--wide-head'
      )
      expect(metrics.dateRangeClassName).not.toContain('crud-filter-control--fill-width')
      expect(metrics.dateRangeWidth).toBeLessThan(520)
    },
  },
  {
    id: 'wide-grid-column-alignment',
    scenario: 'wide-grid',
    width: 1454,
    viewport: { width: 1500, height: 720 },
    assertMetrics(metrics) {
      const columns = metrics.columnRects
      const labels = metrics.labelRects

      // 首行（宽字段带）与下一行共用同一套列网格：跨列项按列宽对齐
      expect(columns).toHaveLength(6)
      expect(columns[0].top).toBeLessThan(columns[2].top)
      expect(Math.abs(columns[0].left - columns[2].left)).toBeLessThanOrEqual(1)
      expect(Math.abs(columns[0].width - columns[2].width)).toBeLessThanOrEqual(1)
      expect(Math.abs(columns[1].left - columns[3].left)).toBeLessThanOrEqual(1)
      expect(Math.abs(columns[1].right - columns[4].right)).toBeLessThanOrEqual(1)

      // 首行的 label 列与下面普通搜索项一致
      expect(Math.abs(labels[0].left - labels[2].left)).toBeLessThanOrEqual(1)
      expect(Math.abs(labels[0].width - labels[2].width)).toBeLessThanOrEqual(1)
    },
  },
  {
    id: 'mobile-stacked-full-width',
    scenario: 'c1p',
    width: 360,
    viewport: { width: 390, height: 720 },
    assertMetrics(metrics) {
      expect(metrics.crudClassNames.join(' ')).toContain(
        'crud-filter-form--mobile-stacked'
      )
      expect(metrics.formColumns).toBe('1')
      expect(
        metrics.mobileFieldWidths.every((width) => width >= metrics.formWidth - 2)
      ).toBe(true)
      expect(metrics.fillControlWidths.every((width) => width >= 250)).toBe(true)
      expect(
        metrics.visibleFillControlWidths.every((width) => width >= metrics.formWidth - 2)
      ).toBe(true)
      expect(
        metrics.toolbarButtonWidths.every((width) => width >= metrics.formWidth - 2)
      ).toBe(true)
      expect(metrics.dateRangeClassName).toContain('crud-filter-control--fill-width')
    },
  },
]

async function gotoHarness(page) {
  await page.goto('/crud-filter-smart-layout-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__CRUD_FILTER_SMART_LAYOUT_PLAYWRIGHT_HARNESS__?.ready === true
  })
}

async function waitForScenarioVisualSettle(page, scenarioConfig) {
  if (scenarioConfig.id === 'wide-grid-column-alignment') {
    await page.waitForFunction(() => {
      const form = document.querySelector(
        '.cxd-Crud-filter.cxd-Crud-filter--flat .cxd-Form'
      )

      return Boolean(form?.classList.contains('crud-filter-form--label-aligned'))
    })
    return
  }

  if (scenarioConfig.id !== 'mobile-stacked-full-width') {
    return
  }

  await page.waitForFunction(() => {
    const metrics =
      window.__CRUD_FILTER_SMART_LAYOUT_PLAYWRIGHT_HARNESS__?.readMetrics?.()

    if (!metrics?.formWidth) {
      return false
    }

    const isFullWidth = (width) => width >= metrics.formWidth - 2

    return (
      metrics.mobileFieldWidths.length >= 3 &&
      metrics.mobileFieldWidths.every(isFullWidth) &&
      metrics.visibleFillControlWidths.length >= 5 &&
      metrics.visibleFillControlWidths.every(isFullWidth) &&
      metrics.toolbarButtonWidths.length >= 2 &&
      metrics.toolbarButtonWidths.every(isFullWidth)
    )
  })
}

test.describe('CRUD filter smart layout visual regression', () => {
  for (const scenarioConfig of SCENARIOS) {
    test(`${scenarioConfig.id} renders expected filter layout`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(scenarioConfig.viewport)
      await gotoHarness(page)
      await page.evaluate(
        ({ scenario, width }) =>
          window.__CRUD_FILTER_SMART_LAYOUT_PLAYWRIGHT_HARNESS__.renderScenario(
            scenario,
            width
          ),
        { scenario: scenarioConfig.scenario, width: scenarioConfig.width }
      )
      await page.locator('.cxd-Crud-filter.cxd-Crud-filter--flat').waitFor()
      await page.locator('.cxd-Crud-filter.cxd-Crud-filter--flat .cxd-Form').waitFor()
      await page.waitForFunction(() => {
        const form = document.querySelector(
          '.cxd-Crud-filter.cxd-Crud-filter--flat .cxd-Form'
        )
        return Boolean(
          form?.style.getPropertyValue('--crud-filter-columns') ||
          getComputedStyle(form).getPropertyValue('--crud-filter-columns').trim()
        )
      })
      await waitForScenarioVisualSettle(page, scenarioConfig)

      const metrics = await page.evaluate(() =>
        window.__CRUD_FILTER_SMART_LAYOUT_PLAYWRIGHT_HARNESS__.readMetrics()
      )
      const screenshotPath = testInfo.outputPath(`${scenarioConfig.id}.png`)
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      })
      await testInfo.attach(scenarioConfig.id, {
        path: screenshotPath,
        contentType: 'image/png',
      })
      await testInfo.attach(`${scenarioConfig.id}-metrics`, {
        body: JSON.stringify(metrics, null, 2),
        contentType: 'application/json',
      })

      scenarioConfig.assertMetrics(metrics)
      expect(new Set(metrics.formItemBackgrounds)).toEqual(new Set(['rgba(0, 0, 0, 0)']))
    })
  }
})
