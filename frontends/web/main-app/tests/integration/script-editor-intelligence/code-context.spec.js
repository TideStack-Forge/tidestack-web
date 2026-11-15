const { test, expect } = require('@playwright/test')

async function mount(page, field, hints = {}, fixture = {}) {
  const requests = []
  await page.addInitScript(() => {
    window.__codeApplied = 0
    window.__codeEditors = {}
    window.__OUROBOROS_SCRIPT_EDITOR_DEBUG__ = {
      onIntelligenceApplied: () => window.__codeApplied++,
      onMounted: ({ editor, props }) => (window.__codeEditors[props.name] = editor),
    }
  })
  const context = {
    language: 'spel',
    codeSite: 'logicflow.mapping',
    codePointer: '/mapping',
    intelligenceApi: '/api/dev/${appName}/code-intelligence/context',
    ...fixture.context,
  }
  const flow = fixture.flow || {
    name: 'flow',
    nodes: [{ type: 'mapping', name: 'map', mapping: { customer: '' } }],
  }
  await page.route('**/behavior-editor-fixture', (route) =>
    route.fulfill({
      json: {
        data: {
          appName: 'example',
          __FLOW_MODEL: flow,
          __CURRENT_NODE_NAME: fixture.nodeName || 'map',
          mapping: flow.nodes[0].mapping,
          code: '',
        },
        body: [
          ...(fixture.fields || []),
          {
            ...field,
            ...(field.type === 'json-data-editor' ? { codeContext: context } : context),
          },
        ],
      },
    })
  )
  await page.route('**/api/dev/example/code-intelligence/context', async (route) => {
    const request = route.request().postDataJSON()
    requests.push(request)
    await route.fulfill({
      json: {
        status: 0,
        data: {
          documentId: request.documentId,
          documentVersion: request.documentVersion,
          draftRevision: request.draftRevision,
          snapshot: {
            runtimeProfile: context.language,
            versionToken: 'v1',
            source: 'browser-fixture',
            javaImports: [],
            javaTypes: [],
            globals: [
              {
                name: '$input',
                kind: 'variable',
                shape: {
                  schema: {
                    type: 'object',
                    'x-representation': 'map',
                    properties: {
                      customerId: { type: 'string' },
                      total: { type: 'number' },
                    },
                  },
                },
              },
            ],
            languageProjectionHints: {
              embeddedExpressionMode: 'bare',
              embeddedArrayValues: false,
              ...hints,
            },
          },
        },
      },
    })
  })
  await page.goto('/business-behavior-catalog-playwright-harness.html?editor=1')
  await page.waitForFunction(
    () => window.behaviorCatalogHarness?.ready && window.__codeApplied > 0
  )
  return requests
}

test('JSON mapping uses the unified context endpoint and completes inside string values', async ({
  page,
}) => {
  const requests = await mount(page, {
    type: 'json-data-editor',
    name: 'mapping',
    allowValueTypes: 'object',
  })
  expect(requests[0].location).toEqual({ nodeName: 'map', pointer: '/mapping' })
  expect(requests[0].resource.type).toBe('logicflow')
  await page.evaluate(() =>
    window.__codeEditors.mapping.setValue('{"customer":"$input."}')
  )
  await expect
    .poll(() => requests.at(-1)?.draft.nodes[0].mapping)
    .toEqual({ customer: '$input.' })
  await page.evaluate(() => {
    const editor = window.__codeEditors.mapping
    editor.focus()
    editor.setPosition({ lineNumber: 1, column: editor.getValue().length - 1 })
    editor.trigger('test', 'editor.action.triggerSuggest', {})
  })
  await expect(page.locator('.suggest-widget.visible')).toContainText('customerId')
  await page.keyboard.press('Escape')
  await page.evaluate(() =>
    window.__codeEditors.mapping.setValue(
      '{"nested":{"name":"$input.total"},"flags":[true,null,3]}'
    )
  )
  await expect
    .poll(() => page.evaluate(() => window.behaviorCatalogHarness.values().mapping))
    .toEqual({
      nested: { name: '$input.total' },
      flags: [true, null, 3],
    })
})

test('plain SpEL editor applies node members through real AMIS and Monaco', async ({
  page,
}) => {
  await mount(page, { type: 'script-editor', name: 'code', codePointer: '/mapping' })
  const input = page.locator('.monaco-editor textarea.inputarea')
  await input.focus()
  await page.keyboard.insertText('$input.')
  await page.keyboard.press('Control+Space')
  await expect(page.locator('.suggest-widget.visible')).toContainText('customerId')
})

for (const type of ['script-editor', 'json-data-editor']) {
  test(`${type} propagates sibling draft changes without changing its code`, async ({
    page,
  }, testInfo) => {
    const script = type === 'script-editor'
    const name = script ? 'code' : 'mapping'
    const requests = await mount(
      page,
      { type, name },
      {},
      {
        flow: {
          name: 'flow',
          inputSchema: { type: 'object', properties: { oldField: { type: 'string' } } },
          nodes: [
            { type: 'mapping', name: 'map', mapping: { customer: '' } },
            { type: 'script', name: 'script', language: 'javascript', script: '' },
          ],
        },
        nodeName: script ? 'script' : 'map',
        context: script
          ? {
              language: 'javascript',
              codeSite: 'logicflow.script',
              codePointer: '/script',
            }
          : {},
        fields: [
          {
            type: 'json-data-editor',
            name: '__FLOW_MODEL.inputSchema',
            label: '上游输入合同',
          },
        ],
      }
    )
    const original = await page.evaluate(
      (name) => window.__codeEditors[name].getValue(),
      name
    )
    const inputSchema = {
      type: 'object',
      properties: { renamedField: { type: 'number' } },
    }
    await page.evaluate((inputSchema) => {
      const editor = window.__codeEditors['__FLOW_MODEL.inputSchema']
      editor.focus()
      editor.setSelection(editor.getModel().getFullModelRange())
      editor.trigger('test', 'paste', { text: JSON.stringify(inputSchema, null, 2) })
    }, inputSchema)
    await expect
      .poll(() =>
        page.evaluate(
          () => window.behaviorCatalogHarness.values().__FLOW_MODEL.inputSchema
        )
      )
      .toEqual(inputSchema)
    await expect.poll(() => requests.at(-1)?.draft.inputSchema).toEqual(inputSchema)
    expect(requests.at(-1).documentId).toBe(requests[0].documentId)
    expect(requests.at(-1).documentVersion).toBe(requests[0].documentVersion)
    expect(requests.at(-1).draftRevision).toBeGreaterThan(requests[0].draftRevision)
    expect(
      await page.evaluate((name) => window.__codeEditors[name].getValue(), name)
    ).toBe(original)
    await testInfo.attach('sibling-change-transport', {
      body: JSON.stringify(
        { requests, inputSchema, codeBefore: original, codeUnchanged: true },
        null,
        2
      ),
      contentType: 'application/json',
    })
  })
}
