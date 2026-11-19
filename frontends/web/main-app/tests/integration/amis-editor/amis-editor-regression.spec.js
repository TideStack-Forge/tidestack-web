const path = require('node:path')
const { test, expect } = require('@playwright/test')
const { startHarness } = require('../modal-form-rendering/harness/server')
const { createHostBindings } = require('../../../../ouroboros-amis-runtime/host-bindings.cjs')
const hostPorts = require('../../../../ouroboros-amis-runtime/host-ports.json')

let harness
let errors
test.beforeEach(({ page }) => {
  errors = []
  page.on('pageerror', (error) => errors.push(error.message))
})
test.afterEach(() => expect(errors).toEqual([]))
test.beforeAll(async () => {
  test.setTimeout(120_000)
  harness = await startHarness({
    entry: path.join(__dirname, 'harness/index.js'),
    alias: {
      'ouroboros-amis-runtime': path.resolve(__dirname, '../../../../ouroboros-amis-runtime/src'),
      ...createHostBindings(Object.fromEntries(hostPorts.map(port => [port,
        path.resolve(__dirname, '../modal-form-rendering/harness/environment.js'),
      ]))),
      amis$: require.resolve('amis'),
      'entities/lib/maps/entities.json': path.resolve(
        __dirname,
        '../../../src/compat/markdownItEntities.js'
      ),
    },
  })
})
test.afterAll(async () => harness?.close())

async function open(page, schema) {
  await page.evaluate((value) => window.editorHarness.open(value), schema)
  await page.waitForFunction(() => window.editorHarness.manager?.store.activeId)
}

test('the Web lazy editor retains inline popups through repeated edit/save/reopen', async ({
  page,
}) => {
  await page.goto(harness.url)
  let schema = {
    type: 'page',
    title: 'Web popup',
    body: [
      {
        type: 'button',
        label: 'Open',
        actionType: 'dialog',
        dialog: { title: 'Inline', body: [{ type: 'tpl', tpl: 'Body' }] },
      },
      {
        type: 'button',
        label: 'Other',
        actionType: 'dialog',
        dialog: { title: 'Other', body: [{ type: 'tpl', tpl: 'Other body' }] },
      },
    ],
  }
  for (let round = 0; round < 3; round++) {
    await open(page, schema)
    schema = await page.evaluate((round) => {
      const { manager } = window.editorHarness,
        { store } = manager
      const button = store.schema.body[0]
      store.setActiveId(button.$$id)
      const plugin = manager.plugins.find((plugin) => plugin.rendererName === 'action')
      plugin.editDetail(button.$$id)
      const pristine = JSON.parse(JSON.stringify(store.subEditorContext.value))
      store.confirmSubEditor([
        {
          schema: { ...pristine, title: `Edited ${round}` },
          __pristine: { schema: pristine },
        },
      ])
      return store.schemaRaw
    }, round)
    expect(schema.body[0].dialog.title).toBe(`Edited ${round}`)
    expect(Object.keys(schema.definitions || {})).toEqual([])
    expect(schema.body[1].dialog.body[0].tpl).toBe('Other body')
  }
})

test('explicit popup reuse creates one shared definition and keeps its references through reopen', async ({
  page,
}) => {
  await page.goto(harness.url)
  let schema = {
    type: 'page',
    body: [
      {
        type: 'button',
        label: 'Open',
        actionType: 'dialog',
        dialog: { title: 'First', body: [] },
      },
      {
        type: 'button',
        label: 'Other',
        actionType: 'dialog',
        dialog: { title: 'Reusable', body: [{ type: 'tpl', tpl: 'Shared body' }] },
      },
    ],
  }
  for (let round = 0; round < 3; round++) {
    await open(page, schema)
    schema = await page.evaluate((round) => {
      const { manager } = window.editorHarness,
        { store } = manager
      const button = store.schema.body[0]
      store.setActiveId(button.$$id)
      manager.plugins
        .find((plugin) => plugin.rendererName === 'action')
        .editDetail(button.$$id)
      const pristine = JSON.parse(JSON.stringify(store.subEditorContext.value))
      const edited = { ...pristine, title: 'Edited' }
      if (!round) {
        const ref = Object.keys(edited.definitions).find(
          (key) => edited.definitions[key].title === 'Reusable'
        )
        edited.body = [{ type: 'button', actionType: 'dialog', dialog: { $ref: ref } }]
      }
      store.confirmSubEditor([{ schema: edited, __pristine: { schema: pristine } }])
      return store.schemaRaw
    }, round)
    const keys = Object.keys(schema.definitions)
    expect(keys).toHaveLength(1)
    expect(schema.body[0].dialog.body[0].dialog.$ref).toBe(keys[0])
    expect(schema.body[1].dialog.$ref).toBe(keys[0])
    expect(schema.definitions[keys[0]].body[0].tpl).toBe('Shared body')
  }
})

for (const field of ['dialog', 'drawer', 'feedback']) {
  test(`the legacy ${field} property control saves content without promoting unrelated popups`, async ({
    page,
  }) => {
    await page.goto(harness.url)
    await open(page, {
      type: 'page',
      body: [
        {
          type: 'button',
          actionType: field === 'feedback' ? 'ajax' : field,
          [field]: { title: 'Property popup', body: [] },
        },
        { type: 'button', actionType: 'dialog', dialog: { title: 'Other', body: [] } },
      ],
    })
    const schema = await page.evaluate((field) => {
      const { manager } = window.editorHarness,
        { store } = manager
      const action = store.schema.body[0]
      store.setActiveId(action.$$id)
      const plugin = manager.plugins.find((plugin) => plugin.rendererName === 'action')
      const panel = plugin.panelBodyCreator(manager.buildEventContext(action.$$id))
      function findControl(value) {
        if (!value || typeof value !== 'object') return null
        if (value.name === field && typeof value.children === 'function') return value
        return Object.values(value).map(findControl).find(Boolean)
      }
      function clickEdit(element) {
        if (element?.props?.onClick) return element.props.onClick()
        const children = element?.props?.children
        return clickEdit(Array.isArray(children) ? children[0] : children)
      }
      clickEdit(
        findControl(panel).children({
          value: store.getValueOf(action.$$id)[field],
          onChange: (value) =>
            manager.panelChangeValue(
              { [field]: value },
              undefined,
              undefined,
              action.$$id
            ),
        })
      )
      const pristine = JSON.parse(JSON.stringify(store.subEditorContext.value))
      store.confirmSubEditor([
        {
          schema: { ...pristine, title: 'Edited property' },
          __pristine: { schema: pristine },
        },
      ])
      return store.schemaRaw
    }, field)
    expect(schema.body[0][field].title).toBe('Edited property')
    expect(schema.body[1].dialog.title).toBe('Other')
    expect(Object.keys(schema.definitions || {})).toEqual([])
  })
}

test('the Web lazy editor does not infer Form purpose and still edits fields', async ({
  page,
}) => {
  await page.goto(harness.url)
  await open(page, {
    type: 'form',
    title: 'Web form',
    body: [{ type: 'input-text', name: 'name', label: 'Name' }],
  })
  await expect(page.locator('input[name="title"]')).toHaveValue('Web form')
  await page.waitForTimeout(700)
  const opened = await page.evaluate(() => window.editorHarness.manager.store.schemaRaw)
  for (const field of ['feat', 'actions', 'dsType', 'labelAlign']) {
    expect(opened).not.toHaveProperty(field)
  }
  expect(
    await page.evaluate(() => window.editorHarness.manager.store.schemaRaw.feat)
  ).toBeUndefined()
  await page.getByText('Name', { exact: true }).last().click()
  const label = page.locator('input[name="label"]')
  await expect(label).toHaveValue('Name')
  await label.fill('Customer')
  await label.blur()
  await expect
    .poll(() =>
      page.evaluate(() => window.editorHarness.manager.store.schemaRaw.body[0].label)
    )
    .toBe('Customer')
  expect(
    await page.evaluate(() => window.editorHarness.manager.store.schemaRaw.feat)
  ).toBeUndefined()
})

test('the Web lazy editor displays Page defaults without writing them and saves real changes', async ({
  page,
}) => {
  await page.goto(harness.url)
  await open(page, { type: 'page', title: 'Web page', body: [] })
  await expect(page.locator('input[name="title"]')).toHaveValue('Web page')
  await page.waitForTimeout(700)
  const pageSchema = await page.evaluate(
    () => window.editorHarness.manager.store.schemaRaw
  )
  expect(pageSchema).not.toHaveProperty('asideResizor')
  expect(pageSchema).not.toHaveProperty('pullRefresh')
  await page
    .locator('[data-amis-name="asideResizor"]')
    .getByRole('checkbox')
    .check({ force: true })
  await expect
    .poll(() =>
      page.evaluate(() => window.editorHarness.manager.store.schemaRaw.asideResizor)
    )
    .toBe(true)
})
