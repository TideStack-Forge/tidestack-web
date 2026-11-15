const { test, expect } = require('@playwright/test')

async function gotoHarness(page) {
  await page.goto('/input-tree-auto-fill-height-playwright-harness.html')
  await page.waitForFunction(() => {
    return window.__INPUT_TREE_AUTO_FILL_HEIGHT_HARNESS__?.ready === true
  })
}

async function readTreeMetrics(page, parentTestId) {
  return page.evaluate((testId) => {
    const parent = document.querySelector(`[data-testid="${testId}"]`)
    const control = parent?.querySelector('.cxd-TreeControl')
    const search = control?.querySelector(':scope > .cxd-TreeControl-searchbox')
    const tree = control?.querySelector(':scope > .cxd-Tree')

    if (!parent || !control || !tree) {
      return null
    }

    const parentBox = parent.getBoundingClientRect()
    const controlBox = control.getBoundingClientRect()
    const searchBox = search?.getBoundingClientRect()
    const treeBox = tree.getBoundingClientRect()
    const treeStyle = getComputedStyle(tree)
    const scrollContainer = [tree, ...tree.querySelectorAll('*')].find((element) => {
      const overflowY = getComputedStyle(element).overflowY
      return (
        element.scrollHeight > element.clientHeight + 1 &&
        (overflowY === 'auto' || overflowY === 'scroll')
      )
    })

    return {
      parentHeight: parentBox.height,
      controlHeight: controlBox.height,
      searchTop: searchBox?.top,
      treeTop: treeBox.top,
      treeBottom: treeBox.bottom,
      treeHeight: treeBox.height,
      treeScrollHeight: tree.scrollHeight,
      treeScrollTop: tree.scrollTop,
      treeOverflowY: treeStyle.overflowY,
      activeScrollTop: scrollContainer?.scrollTop ?? 0,
      activeScrollHeight: scrollContainer?.scrollHeight ?? 0,
      activeClientHeight: scrollContainer?.clientHeight ?? 0,
      treeIsActiveScroller: scrollContainer === tree,
      parentScrollTop: parent.scrollTop,
      controlScrollTop: control.scrollTop,
    }
  }, parentTestId)
}

async function scrollTreeToBottom(page, parentTestId) {
  await page.evaluate((testId) => {
    const tree = document.querySelector(
      `[data-testid="${testId}"] .cxd-TreeControl > .cxd-Tree`
    )
    const scrollContainer = [tree, ...tree.querySelectorAll('*')].find((element) => {
      const overflowY = getComputedStyle(element).overflowY
      return (
        element.scrollHeight > element.clientHeight + 1 &&
        (overflowY === 'auto' || overflowY === 'scroll')
      )
    })

    scrollContainer.scrollTop = scrollContainer.scrollHeight
    scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }))
  }, parentTestId)
}

async function readTreeEditorMetrics(page, parentTestId) {
  return page.evaluate((testId) => {
    const parent = document.querySelector(`[data-testid="${testId}"]`)
    const tree = parent?.querySelector('.cxd-Tree')
    const formItem = tree?.closest('[class*="Form-item"]')

    if (!parent || !tree) {
      return null
    }

    const parentBox = parent.getBoundingClientRect()
    const treeBox = tree.getBoundingClientRect()
    const treeStyle = getComputedStyle(tree)
    const scrollContainer = [tree, ...tree.querySelectorAll('*')].find((element) => {
      const overflowY = getComputedStyle(element).overflowY
      return (
        element.scrollHeight > element.clientHeight + 1 &&
        (overflowY === 'auto' || overflowY === 'scroll')
      )
    })

    return {
      parentHeight: parentBox.height,
      treeHeight: treeBox.height,
      treeBottom: treeBox.bottom,
      treeScrollHeight: tree.scrollHeight,
      treeScrollTop: tree.scrollTop,
      treeOverflowY: treeStyle.overflowY,
      treeClassName: tree.className,
      activeScrollTop: scrollContainer?.scrollTop ?? 0,
      activeScrollHeight: scrollContainer?.scrollHeight ?? 0,
      activeClientHeight: scrollContainer?.clientHeight ?? 0,
      treeIsActiveScroller: scrollContainer === tree,
      parentScrollTop: parent.scrollTop,
      formItemScrollTop: formItem?.scrollTop ?? 0,
    }
  }, parentTestId)
}

async function scrollTreeEditorToBottom(page, parentTestId) {
  await page.evaluate((testId) => {
    const tree = document.querySelector(`[data-testid="${testId}"] .cxd-Tree`)
    const scrollContainer = [tree, ...tree.querySelectorAll('*')].find((element) => {
      const overflowY = getComputedStyle(element).overflowY
      return (
        element.scrollHeight > element.clientHeight + 1 &&
        (overflowY === 'auto' || overflowY === 'scroll')
      )
    })

    scrollContainer.scrollTop = scrollContainer.scrollHeight
    scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }))
  }, parentTestId)
}

test('autoFillHeight keeps search fixed and makes Tree the only vertical scroller', async ({
  page,
}, testInfo) => {
  const consoleErrors = []
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      !message.text().startsWith('Warning: findDOMNode is deprecated')
    ) {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))

  await gotoHarness(page)

  const before = await readTreeMetrics(page, 'auto-fill-parent')
  expect(before).not.toBeNull()
  expect(before.controlHeight).toBeGreaterThan(before.parentHeight - 2)
  expect(before.treeOverflowY).toBe('auto')
  expect(before.treeScrollHeight).toBeGreaterThan(before.treeHeight)
  expect(before.treeIsActiveScroller).toBe(true)

  await scrollTreeToBottom(page, 'auto-fill-parent')
  await expect
    .poll(async () => (await readTreeMetrics(page, 'auto-fill-parent')).treeScrollTop)
    .toBeGreaterThan(0)

  const afterScroll = await readTreeMetrics(page, 'auto-fill-parent')
  expect(Math.abs(afterScroll.searchTop - before.searchTop)).toBeLessThan(1)
  expect(afterScroll.parentScrollTop).toBe(0)
  expect(afterScroll.controlScrollTop).toBe(0)

  const lastNode = page.getByText('Auto node 080', { exact: true })
  await expect(lastNode).toBeVisible()
  const lastNodeBox = await lastNode.boundingBox()
  expect(lastNodeBox.y + lastNodeBox.height).toBeLessThanOrEqual(
    afterScroll.treeBottom + 1
  )

  await page.evaluate(() => {
    window.__INPUT_TREE_AUTO_FILL_HEIGHT_HARNESS__.resizeParent('auto-fill-parent', 220)
  })
  await expect
    .poll(async () => (await readTreeMetrics(page, 'auto-fill-parent')).controlHeight)
    .toBeLessThan(before.controlHeight - 80)

  await page.screenshot({
    path: testInfo.outputPath('input-tree-auto-fill-height.png'),
    fullPage: true,
  })
  expect(consoleErrors).toEqual([])
})

test('virtual tree remains scrollable after its bounded parent resizes', async ({
  page,
}) => {
  await gotoHarness(page)

  const before = await readTreeMetrics(page, 'virtual-tree-parent')
  expect(before).not.toBeNull()
  expect(before.treeOverflowY).toBe('auto')
  expect(before.activeScrollHeight).toBeGreaterThan(before.activeClientHeight)
  expect(before.treeIsActiveScroller).toBe(false)

  await page.evaluate(() => {
    window.__INPUT_TREE_AUTO_FILL_HEIGHT_HARNESS__.resizeParent(
      'virtual-tree-parent',
      210
    )
  })
  await expect
    .poll(async () => (await readTreeMetrics(page, 'virtual-tree-parent')).treeHeight)
    .toBeLessThan(before.treeHeight - 80)

  await scrollTreeToBottom(page, 'virtual-tree-parent')
  await expect
    .poll(
      async () => (await readTreeMetrics(page, 'virtual-tree-parent')).activeScrollTop
    )
    .toBeGreaterThan(0)
  await expect(page.getByText('Virtual node 160', { exact: true })).toBeVisible()
})

test('default and heightAuto retain the native amis height modes', async ({ page }) => {
  await gotoHarness(page)

  const modes = await page.evaluate(() => {
    const readMode = (rootId) => {
      const control = document.querySelector(`#${rootId} .cxd-TreeControl`)
      const tree = control.querySelector(':scope > .cxd-Tree')
      const style = getComputedStyle(tree)

      return {
        controlClassName: control.className,
        maxHeight: style.maxHeight,
        overflowY: style.overflowY,
      }
    }

    return {
      defaultMode: readMode('default-tree-root'),
      naturalMode: readMode('height-auto-tree-root'),
    }
  })

  expect(modes.defaultMode.controlClassName).not.toContain('autoFillHeight')
  expect(modes.defaultMode.maxHeight).not.toBe('none')
  expect(modes.defaultMode.overflowY).toBe('auto')
  expect(modes.naturalMode.controlClassName).toContain('h-auto')
  expect(modes.naturalMode.controlClassName).not.toContain('autoFillHeight')
  expect(modes.naturalMode.maxHeight).toBe('none')
  expect(modes.naturalMode.overflowY).toBe('visible')
})

test('tree-editor fills a bounded parent while its default mode keeps natural height', async ({
  page,
}, testInfo) => {
  const consoleErrors = []
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      !message.text().startsWith('Warning: findDOMNode is deprecated')
    ) {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))

  await gotoHarness(page)

  const autoFillBefore = await readTreeEditorMetrics(page, 'tree-editor-auto-fill-parent')
  expect(autoFillBefore).not.toBeNull()
  expect(autoFillBefore.treeClassName).toContain('cxd-TreeEditor--autoFillHeight')
  expect(autoFillBefore.treeHeight).toBeGreaterThan(autoFillBefore.parentHeight - 2)
  expect(autoFillBefore.treeOverflowY).toBe('auto')
  expect(autoFillBefore.treeScrollHeight).toBeGreaterThan(autoFillBefore.treeHeight)
  expect(autoFillBefore.treeIsActiveScroller).toBe(true)

  await scrollTreeEditorToBottom(page, 'tree-editor-auto-fill-parent')
  await expect
    .poll(
      async () =>
        (await readTreeEditorMetrics(page, 'tree-editor-auto-fill-parent')).treeScrollTop
    )
    .toBeGreaterThan(0)

  const autoFillAfterScroll = await readTreeEditorMetrics(
    page,
    'tree-editor-auto-fill-parent'
  )
  expect(autoFillAfterScroll.parentScrollTop).toBe(0)
  expect(autoFillAfterScroll.formItemScrollTop).toBe(0)
  await expect(page.getByText('Editor node 080', { exact: true })).toBeVisible()

  await page.evaluate(() => {
    window.__INPUT_TREE_AUTO_FILL_HEIGHT_HARNESS__.resizeParent(
      'tree-editor-auto-fill-parent',
      215
    )
  })
  await expect
    .poll(
      async () =>
        (await readTreeEditorMetrics(page, 'tree-editor-auto-fill-parent')).treeHeight
    )
    .toBeLessThan(autoFillBefore.treeHeight - 80)

  const virtualBefore = await readTreeEditorMetrics(page, 'tree-editor-virtual-parent')
  expect(virtualBefore).not.toBeNull()
  expect(virtualBefore.activeScrollHeight).toBeGreaterThan(
    virtualBefore.activeClientHeight
  )
  expect(virtualBefore.treeIsActiveScroller).toBe(false)

  await page.evaluate(() => {
    window.__INPUT_TREE_AUTO_FILL_HEIGHT_HARNESS__.resizeParent(
      'tree-editor-virtual-parent',
      205
    )
  })
  await expect
    .poll(
      async () =>
        (await readTreeEditorMetrics(page, 'tree-editor-virtual-parent')).treeHeight
    )
    .toBeLessThan(virtualBefore.treeHeight - 80)
  await expect
    .poll(async () => {
      const metrics = await readTreeEditorMetrics(page, 'tree-editor-virtual-parent')
      return (
        !metrics.treeIsActiveScroller &&
        Math.abs(metrics.activeClientHeight - metrics.treeHeight) < 2
      )
    })
    .toBe(true)

  await scrollTreeEditorToBottom(page, 'tree-editor-virtual-parent')
  await expect
    .poll(
      async () =>
        (await readTreeEditorMetrics(page, 'tree-editor-virtual-parent')).activeScrollTop
    )
    .toBeGreaterThan(0)
  await expect(page.getByText('Virtual editor node 160', { exact: true })).toBeVisible()

  const defaultMode = await page.evaluate(() => {
    const tree = document.querySelector('#tree-editor-default-root .cxd-Tree')
    return {
      className: tree.className,
      height: tree.getBoundingClientRect().height,
      clientHeight: tree.clientHeight,
      scrollHeight: tree.scrollHeight,
    }
  })
  expect(defaultMode.className).not.toContain('TreeEditor--autoFillHeight')
  expect(defaultMode.height).toBeGreaterThan(100)
  expect(Math.abs(defaultMode.scrollHeight - defaultMode.clientHeight)).toBeLessThan(2)

  await page.screenshot({
    path: testInfo.outputPath('tree-editor-auto-fill-height.png'),
    fullPage: true,
  })
  expect(consoleErrors).toEqual([])
})
