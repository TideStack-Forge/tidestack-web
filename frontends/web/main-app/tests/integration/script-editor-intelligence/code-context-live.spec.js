const { test, expect } = require('@playwright/test')

const endpoint = '/api/dev/example/code-intelligence/context'
const upstreamField = '__FLOW_MODEL.nodes.1.mapping'
const validationSchema = {
  type: 'object',
  properties: {
    customer: { type: 'object', properties: { name: { type: 'string' } } },
    items: {
      type: 'array',
      items: { type: 'object', properties: { quantity: { type: 'integer' } } },
    },
  },
}

function flow() {
  return {
    name: 'completion-proof',
    entryNode: 'validate',
    nodes: [
      { name: 'validate', type: 'validate', schema: validationSchema },
      {
        name: 'map',
        type: 'mapping',
        mapping: {
          displayName: "$0.customer.name + '!'",
          firstQuantity: '$0.items[0].quantity',
          'profile.active': true,
        },
      },
      {
        name: 'script',
        type: 'script',
        language: 'javascript',
        script: '',
        inputPorts: [{ name: 'mapped' }],
      },
    ],
    connections: [
      {
        sourceNode: 'validate',
        sourceOutputPort: 0,
        targetNode: 'map',
        targetInputPort: 0,
      },
      {
        sourceNode: 'map',
        sourceOutputPort: 0,
        targetNode: 'script',
        targetInputPort: 0,
      },
    ],
  }
}

async function mount(page, body, nodeName = 'script') {
  const exchanges = []
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', async (response) => {
    if (new URL(response.url()).pathname !== endpoint) return
    exchanges.push({
      request: response.request().postDataJSON(),
      response: await response.json(),
      status: response.status(),
    })
  })
  await page.addInitScript(() => {
    window.__codeEditors = {}
    window.__codeSnapshots = []
    window.__OUROBOROS_SCRIPT_EDITOR_DEBUG__ = {
      onMounted: ({ editor, monaco, props }) => {
        window.__codeEditors[props.name] = editor
        if (window.__measureCompletion && !window.__providerTimings) {
          window.__providerTimings = []
          window.__workerTimings = []
          const register = monaco.languages.registerCompletionItemProvider
          monaco.languages.registerCompletionItemProvider = (language, provider) => {
            const provide = provider.provideCompletionItems.bind(provider)
            provider.provideCompletionItems = async (...args) => {
              const start = performance.now()
              const result = await provide(...args)
              window.__providerTimings.push({
                language,
                start,
                duration: performance.now() - start,
                count: result?.suggestions?.length,
              })
              return result
            }
            return register(language, provider)
          }
          const createWorker = monaco.editor.createWebWorker
          monaco.editor.createWebWorker = (options) => {
            const worker = createWorker(options)
            const sync = worker.withSyncedResources.bind(worker)
            worker.withSyncedResources = async (...args) => {
              const start = performance.now()
              const result = await sync(...args)
              window.__workerTimings.push({
                label: options.label,
                compilerOptions: options.createData?.compilerOptions,
                start,
                duration: performance.now() - start,
              })
              return result
            }
            return worker
          }
        }
        editor.getDomNode().setAttribute('data-evidence-editor', props.name)
      },
      onIntelligenceApplied: ({ snapshot }) => window.__codeSnapshots.push(snapshot),
    }
  })
  // Only form data/layout are fixtures. Code context requests use the real HTTP backend.
  await page.route('**/behavior-editor-fixture', (route) =>
    route.fulfill({
      json: {
        data: {
          appName: 'example',
          __FLOW_MODEL: flow(),
          __CURRENT_NODE_NAME: nodeName,
          code: '// 输入 $0. 查看上游映射的输出字段\n',
          mapping: { customer: '$0.customer.' },
        },
        body: [
          {
            type: 'tpl',
            tpl: '<h2>代码提示 · 真实 Java HTTP 联调</h2><p>JSON Schema 校验 → 映射 → 脚本。AMIS / Monaco 编辑器，后端通过 SPI 分析当前草稿。</p><p>校验声明：customer.name 为 string，items[].quantity 为 integer。</p><p>验证范围：草稿上下文推断；开发助手运行环境未连接。</p>',
          },
          ...body,
        ],
      },
    })
  )
  await page.goto('/business-behavior-catalog-playwright-harness.html?editor=1')
  await page.waitForFunction(
    () => window.behaviorCatalogHarness?.ready && window.__codeSnapshots.length > 0
  )
  return { exchanges, errors }
}

async function enter(page, name, text) {
  await page.evaluate((name) => {
    const instance = window.__codeEditors[name]
    instance.focus()
    instance.setSelection(instance.getModel().getFullModelRange())
  }, name)
  if (name === 'code') {
    await page.keyboard.insertText(text)
  } else {
    // A multiline JSON replacement is a paste, rather than a sequence of typed braces.
    await page.evaluate(
      ({ name, text }) => {
        window.__codeEditors[name].trigger('browser-test', 'paste', { text })
      },
      { name, text }
    )
  }
  await expect
    .poll(() => page.evaluate((name) => window.__codeEditors[name].getValue(), name))
    .toBe(text)
}

async function suggest(page, name) {
  await expect
    .poll(() => page.evaluate(() => window.__codeSnapshots.length))
    .toBeGreaterThan(0)
  await page.evaluate((name) => window.__codeEditors[name].focus(), name)
  await page.keyboard.press('Control+Space')
  return page.locator('.suggest-widget.visible')
}

async function evidence(page, testInfo, name, state) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true })
  await testInfo.attach(name, {
    body: JSON.stringify(state, null, 2),
    contentType: 'application/json',
  })
  expect(state.exchanges.length).toBeGreaterThan(0)
  expect(
    state.exchanges.every((item) => item.status === 200 && item.response.code === 0)
  ).toBe(true)
  expect(state.errors).toEqual([])
}

test('real Java inference supplies script completions and refreshes after upstream mapping edits', async ({
  page,
}, testInfo) => {
  const state = await mount(page, [
    {
      type: 'grid',
      columns: [
        {
          md: 6,
          body: [
            {
              type: 'json-data-editor',
              name: upstreamField,
              label: '上游映射节点（可编辑）',
            },
          ],
        },
        {
          md: 6,
          body: [
            {
              type: 'script-editor',
              name: 'code',
              label: '下游 JavaScript 脚本节点',
              language: 'javascript',
              codeSite: 'logicflow.script',
              codePointer: '/script',
              intelligenceApi: endpoint,
              options: { fontSize: 18, minimap: { enabled: false } },
            },
          ],
        },
      ],
    },
  ])
  await enter(page, 'code', '$0.')
  let widget = await suggest(page, 'code')
  await expect(widget).toContainText('displayName')
  await expect(widget).toContainText('firstQuantity')
  await expect(widget).toContainText('profile')
  const initial = state.exchanges[0]
  expect(initial.request.draft.nodes[1].mapping.displayName).toBe(
    "$0.customer.name + '!'"
  )
  const input = initial.response.data.snapshot.globals.find((item) => item.name === '$0')
    .shape.schema
  expect(input.properties.displayName.type).toBe('string')
  expect(input.properties.firstQuantity.type).toBe('integer')
  expect(input.properties.profile.properties.active.type).toBe('boolean')
  expect(initial.response.data.runtimeStatus).toBe('UNAVAILABLE')
  await evidence(page, testInfo, '01-mapped-script-members', state)
  await page.waitForTimeout(1800)
  await page.keyboard.press('Escape')

  await enter(page, 'code', '$0.profile.')
  widget = await suggest(page, 'code')
  await expect(widget).toContainText('active')
  await evidence(page, testInfo, '02-nested-script-member', state)
  await page.waitForTimeout(1600)
  await page.keyboard.press('Escape')

  await enter(
    page,
    upstreamField,
    JSON.stringify(
      {
        renamedCustomer: '$0.customer.name',
        firstQuantity: '$0.items[0].quantity',
        'profile.active': true,
      },
      null,
      2
    )
  )
  await expect
    .poll(() =>
      page.evaluate(
        () => window.behaviorCatalogHarness.values().__FLOW_MODEL.nodes[1].mapping
      )
    )
    .toHaveProperty('renamedCustomer', '$0.customer.name')
  await expect
    .poll(() => state.exchanges.at(-1)?.request.draft.nodes[1].mapping)
    .toHaveProperty('renamedCustomer', '$0.customer.name')
  await expect
    .poll(() =>
      page.evaluate(() => {
        const snapshot = window.__codeSnapshots.at(-1)
        return snapshot?.globals.find((item) => item.name === '$0')?.shape.schema
          .properties
      })
    )
    .toHaveProperty('renamedCustomer')
  await page.waitForTimeout(700)
  await enter(page, 'code', '$0.')
  widget = await suggest(page, 'code')
  await expect(widget).toContainText('renamedCustomer')
  await expect(widget).not.toContainText('displayName')
  await evidence(page, testInfo, '03-upstream-change-refreshed', state)
  await page.waitForTimeout(2200)
})

test('JavaScript completion latency stays below one second on first invocation', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    window.__measureCompletion = true
  })
  const state = await mount(page, [
    {
      type: 'script-editor',
      name: 'code',
      label: 'JavaScript completion latency',
      language: 'javascript',
      codeSite: 'logicflow.script',
      codePointer: '/script',
      intelligenceApi: endpoint,
    },
  ])
  const measurements = []
  for (const text of [
    '$0.',
    '$0.profile.',
    '$0.',
    'const label = $0.displayName;\nlabel.',
  ]) {
    await enter(page, 'code', text)
    await page.evaluate(() => {
      window.__suggestStarted = performance.now()
      window.__codeEditors.code.trigger('benchmark', 'editor.action.triggerSuggest', {})
    })
    await page.waitForFunction(
      (text) => {
        const widget = document.querySelector('.suggest-widget.visible')
        return widget?.textContent.includes(text)
      },
      text.includes('const label')
        ? 'charAt'
        : text === '$0.profile.'
          ? 'active'
          : 'displayName',
      { timeout: 5000 }
    )
    measurements.push(
      await page.evaluate(
        (text) => ({
          text,
          elapsedMs: performance.now() - window.__suggestStarted,
          workers: performance
            .getEntriesByType('resource')
            .filter((entry) => entry.name.includes('ts.worker'))
            .map((entry) => ({
              url: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
            })),
        }),
        text
      )
    )
    await page.keyboard.press('Escape')
  }
  const timings = await page.evaluate(() => ({
    providers: window.__providerTimings,
    workers: window.__workerTimings,
  }))
  const report = { measurements, requests: state.exchanges.length, ...timings }
  await testInfo.attach('completion-latency', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  })
  console.log('Completion latency:', JSON.stringify(report))
  expect(measurements[0].elapsedMs).toBeLessThan(1000)
  expect(Math.max(...measurements.slice(1).map((item) => item.elapsedMs))).toBeLessThan(
    500
  )
  expect(measurements.at(-1).workers).toHaveLength(1)
})

test('real validation schema supplies SpEL completion inside the mapping JSON editor', async ({
  page,
}, testInfo) => {
  const state = await mount(
    page,
    [
      {
        type: 'json-data-editor',
        name: 'mapping',
        label: '映射节点 · JSON 内的 SpEL 表达式',
        codeContext: {
          language: 'spel',
          codeSite: 'logicflow.mapping',
          codePointer: '/mapping',
          intelligenceApi: endpoint,
        },
      },
    ],
    'map'
  )
  await enter(page, 'mapping', '{\n  "customer": "$0.customer."\n}')
  await page.evaluate(() => {
    const instance = window.__codeEditors.mapping
    const expression = '$0.customer.'
    const offset = instance.getValue().indexOf(expression) + expression.length
    instance.setPosition(instance.getModel().getPositionAt(offset))
  })
  const widget = await suggest(page, 'mapping')
  await expect(widget).toContainText('name')
  await evidence(page, testInfo, '04-json-spel-member', state)
  await page.waitForTimeout(1800)
  await page.keyboard.press('Tab')
  await expect
    .poll(() => page.evaluate(() => window.behaviorCatalogHarness.values().mapping))
    .toEqual({ customer: '$0.customer.name' })
  await evidence(page, testInfo, '05-accepted-json-spel-member', state)
  await page.waitForTimeout(1800)
})
