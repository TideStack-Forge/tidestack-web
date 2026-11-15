const { test, expect } = require('@playwright/test')

const endpoint = '/api/dev/example/code-intelligence/context'

function flow() {
  return {
    name: 'groovy-editor-acceptance', entryNode: 'validate',
    nodes: [
      { name: 'validate', type: 'validate', schema: { type: 'object', properties: {
        customers: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' } } } },
      } } },
      { name: 'mapping', type: 'mapping', mapping: { customers: '$0.customers', displayName: '$0.customers[0].name' } },
      { name: 'script', type: 'script', language: 'groovy', script: '', inputPorts: [{ name: 'mapped' }] },
    ],
    connections: [
      { sourceNode: 'validate', sourceOutputPort: 0, targetNode: 'mapping', targetInputPort: 0 },
      { sourceNode: 'mapping', sourceOutputPort: 0, targetNode: 'script', targetInputPort: 0 },
    ],
  }
}

async function mount(page, language = 'groovy') {
  const exchanges = [], errors = [], consoleErrors = []
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', async response => {
    if (!response.url().includes('/code-intelligence/')) return
    exchanges.push({ url: response.url(), status: response.status(), request: response.request().postData(), response: await response.json() })
  })
  await page.addInitScript(language => {
    window.__groovyEditors = {}
    window.__groovyReady = false
    window.__OUROBOROS_SCRIPT_EDITOR_DEBUG__ = {
      onMounted: ({ editor, monaco, props }) => {
        window.__groovyEditors[props.name] = editor
        window.__groovyMonaco = monaco
      },
      onIntelligenceApplied: ({ language: appliedLanguage, snapshot }) => {
        if (snapshot?.source === 'editor-lsp' || (language === 'javascript' && appliedLanguage === language)) window.__groovyReady = true
      },
    }
  }, language)
  await page.route('**/behavior-editor-fixture', route => route.fulfill({ json: {
    data: { appName: 'example', __FLOW_MODEL: { ...flow(), nodes: flow().nodes.map(node => node.name === 'script' ? { ...node, language } : node) }, __CURRENT_NODE_NAME: 'script', code: '' },
    body: [
      { type: 'tpl', tpl: `<h2>${language === 'groovy' ? 'Groovy' : '后端 JavaScript / GraalJS'} 编辑器 · 完整链路验收</h2><p>JSON Schema 校验 → 映射 → 脚本</p><p>语义引擎由开发平台托管；助手经 RabbitMQ 提供实际应用环境。后端 JS 使用独立的 ECMAScript 类型环境。</p>` },
      { type: 'json-data-editor', name: '__FLOW_MODEL.nodes.1.mapping', label: '上游映射（修改后更新下游上下文）' },
      { type: 'script-editor', name: 'code', label: `${language} 脚本`, language, codeSite: 'logicflow.script', codePointer: '/script', intelligenceApi: endpoint,
        options: { fontSize: 18, minimap: { enabled: false }, 'semanticHighlighting.enabled': true } },
    ],
  } }))
  await page.goto('/business-behavior-catalog-playwright-harness.html?editor=1')
  await page.waitForFunction(() => window.__groovyReady, undefined, { timeout: 60_000 })
  return { exchanges, errors, consoleErrors, timings: [] }
}

async function enter(page, text) {
  await page.evaluate(() => {
    const editor = window.__groovyEditors.code
    editor.focus()
    editor.setSelection(editor.getModel().getFullModelRange())
  })
  if (text.includes('\n')) {
    await page.evaluate(text => window.__groovyEditors.code.trigger('acceptance', 'paste', { text }), text)
  } else {
    await page.keyboard.insertText(text)
  }
  await expect.poll(() => page.evaluate(() => window.__groovyEditors.code.getValue())).toBe(text)
}

async function suggest(page, text, expected, state) {
  await enter(page, text)
  const started = Date.now()
  await page.keyboard.press('Control+Space')
  const widget = page.locator('.suggest-widget.visible')
  await expect(widget).toContainText(expected)
  state.timings.push({ text, visibleMs: Date.now() - started })
  return widget
}

async function evidence(page, testInfo, name, state) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true })
  await testInfo.attach(name, { body: JSON.stringify(state, null, 2), contentType: 'application/json' })
  expect(state.errors).toEqual([])
  expect(state.exchanges.length).toBeGreaterThan(0)
  expect(state.exchanges.every(exchange => exchange.status === 200 && exchange.response.code === 0)).toBe(true)
}

test('Groovy completion uses inferred upstream context, closure generics and the helper extension classpath', async ({ page }, testInfo) => {
  const state = await mount(page)
  let widget = await suggest(page, '$0.', 'displayName', state)
  await expect(widget).toContainText('customers')
  await evidence(page, testInfo, '01-upstream-fields', state)
  await page.waitForTimeout(1000)
  await page.keyboard.press('Escape')
  await suggest(page, 'def names = $0.customers.collect { it.name }\nnames.get(0).toU', 'toUpperCase', state)
  await evidence(page, testInfo, '02-closure-element-string', state)
  await page.waitForTimeout(1000)
  await page.keyboard.press('Escape')
  await suggest(page, 'import probe.CustomerApi\nCustomerApi.load().get(0).', 'address', state)
  await evidence(page, testInfo, '03-helper-extension-java-members', state)
  await page.waitForTimeout(1000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    const editor = window.__groovyEditors['__FLOW_MODEL.nodes.1.mapping']
    editor.setValue(JSON.stringify({ customers: '$0.customers', renamedCustomer: '$0.customers[0].name' }, null, 2))
  })
  await expect.poll(() => state.exchanges.filter(exchange => exchange.url.endsWith('/context')).at(-1)?.request || '').toContain('renamedCustomer')
  widget = await suggest(page, '$0.', 'renamedCustomer', state)
  await expect(widget).not.toContainText('displayName')
  await evidence(page, testInfo, '04-upstream-context-replaced', state)
  await page.waitForTimeout(1500)
  expect(Math.max(...state.timings.map(timing => timing.visibleMs))).toBeLessThan(1500)
})

test('Groovy Monaco shows hover, signatures, diagnostics, navigation and scope-correct rename', async ({ page }, testInfo) => {
  const state = await mount(page)
  await enter(page, "String text = 'hello'\ntext.substring(0, 2)")
  await page.evaluate(() => {
    const editor = window.__groovyEditors.code
    editor.setPosition({ lineNumber: 2, column: 9 })
    editor.trigger('acceptance', 'editor.action.showHover', {})
  })
  await expect(page.locator('.monaco-hover')).toContainText('substring')
  await evidence(page, testInfo, '05-java-hover', state)
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    const editor = window.__groovyEditors.code
    editor.setPosition({ lineNumber: 2, column: 18 })
    editor.trigger('acceptance', 'editor.action.triggerParameterHints', {})
  })
  await expect(page.locator('.parameter-hints-widget.visible')).toContainText('substring')
  await evidence(page, testInfo, '06-method-signature', state)
  await page.keyboard.press('Escape')
  await enter(page, 'def value = "hello"\ndef other(value) { value }\nvalue.toUpperCase()')
  await page.evaluate(() => {
    const editor = window.__groovyEditors.code
    editor.setPosition({ lineNumber: 3, column: 3 })
    editor.trigger('acceptance', 'editor.action.revealDefinition', {})
  })
  await expect.poll(() => page.evaluate(() => window.__groovyEditors.code.getPosition().lineNumber)).toBe(1)
  await page.evaluate(() => {
    const editor = window.__groovyEditors.code
    editor.setPosition({ lineNumber: 3, column: 3 })
    editor.trigger('acceptance', 'editor.action.rename', {})
  })
  const rename = page.getByRole('textbox', { name: /重命名输入|Rename input/ })
  await expect(rename).toBeVisible()
  await rename.fill('customerName')
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => window.__groovyEditors.code.getValue())).toBe('def customerName = "hello"\ndef other(value) { value }\ncustomerName.toUpperCase()')
  await evidence(page, testInfo, '07-scope-correct-rename', state)
  await page.evaluate(() => {
    const editor = window.__groovyEditors.code
    editor.setPosition({ lineNumber: 3, column: 3 })
    editor.trigger('acceptance', 'editor.action.referenceSearch.trigger', {})
  })
  await expect(page.locator('.reference-zone-widget')).toBeVisible()
  await evidence(page, testInfo, '08-references', state)
  await page.keyboard.press('Escape')
  await enter(page, 'String text = "hello"\ntext.substring(0')
  await expect.poll(() => page.evaluate(() => window.__groovyMonaco.editor.getModelMarkers({ owner: 'editor-lsp' }).length)).toBeGreaterThan(0)
  await page.evaluate(() => {
    const editor = window.__groovyEditors.code
    editor.setPosition({ lineNumber: 2, column: 17 })
    editor.trigger('acceptance', 'editor.action.showHover', {})
  })
  await evidence(page, testInfo, '09-versioned-diagnostics', state)
  await page.keyboard.press('Escape')
  await page.evaluate(() => window.__groovyEditors.code.trigger('acceptance', 'editor.action.quickFix', {}))
  await expect(page.getByRole('menuitem', { name: '补齐缺失的结束括号' })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => window.__groovyEditors.code.getValue())).toBe('String text = "hello"\ntext.substring(0)')
  await expect.poll(() => page.evaluate(() => window.__groovyMonaco.editor.getModelMarkers({ owner: 'editor-lsp' }).length)).toBe(0)
  await evidence(page, testInfo, '10-applied-quick-fix', state)
  await enter(page, 'if (true) {\nprintln "hello"\n}')
  await page.evaluate(() => window.__groovyEditors.code.getAction('editor.action.formatDocument').run())
  await expect.poll(() => page.evaluate(() => window.__groovyEditors.code.getValue())).toMatch(/\n +println/)
  await evidence(page, testInfo, '11-formatting', state)
  await page.waitForTimeout(1200)
})


test('Groovy Monaco receives semantic tokens and exposes document symbols', async ({ page }, testInfo) => {
  const state = await mount(page)
  await page.evaluate(() => {
    const monaco = window.__groovyMonaco
    monaco.editor.defineTheme('groovy-acceptance', { base: 'vs', inherit: true, colors: {},
      rules: [{ token: 'variable', foreground: 'C00080' }, { token: 'method', foreground: '007A3D' }] })
    monaco.editor.setTheme('groovy-acceptance')
  })
  await enter(page, 'def invoiceTotal = 42\ndef renderTotal(value) { value.toString() }\nrenderTotal(invoiceTotal)')
  await expect.poll(() => state.exchanges.flatMap(exchange => exchange.response?.data?.messages || [])
    .filter(message => Array.isArray(message.result?.data)).at(-1)?.result.data.length || 0).toBeGreaterThan(0)
  await expect.poll(() => page.locator('.view-line span').evaluateAll(elements => elements
    .filter(element => element.textContent === 'invoiceTotal').map(element => getComputedStyle(element).color)))
    .toContain('rgb(192, 0, 128)')
  await evidence(page, testInfo, '12-semantic-highlighting', state)
  await page.evaluate(() => window.__groovyEditors.code.getAction('editor.action.quickOutline').run())
  await expect(page.locator('.quick-input-widget')).toContainText('invoiceTotal')
  await expect(page.locator('.quick-input-widget')).toContainText('renderTotal')
  await evidence(page, testInfo, '13-document-symbols', state)
  await page.waitForTimeout(1200)
})

test('backend JavaScript uses actual Graal globals and excludes browser types while frontend JS keeps DOM', async ({ page }, testInfo) => {
  const state = await mount(page, 'javascript')
  const checks = []
  for (const name of ['Java', 'Polyglot', 'Graal', 'print', 'load']) {
    await suggest(page, 'globalThis.' + name.slice(0, -1), name, state)
    checks.push({ globalThisMember: name })
    await page.keyboard.press('Escape')
  }
  await evidence(page, testInfo, 'javascript-graal-globals', state)
  for (const text of ['window.', 'document.', 'navigator.', 'fetch.', 'localStorage.', 'setTimeout.', 'process.', 'require.', 'globalThis.document.']) {
    await enter(page, text)
    await page.keyboard.press('Control+Space')
    await page.waitForTimeout(350)
    await testInfo.attach(`javascript-${text}-candidates`, { body: JSON.stringify(await page.evaluate(() => ({
      text: window.__groovyEditors.code.getValue(),
      wordSuggestions: window.__groovyEditors.code.getRawOptions().wordBasedSuggestions,
      candidates: [...document.querySelectorAll('.suggest-widget.visible .monaco-list-row')].map(element => element.textContent),
    }))), contentType: 'application/json' })
    await expect(page.locator('.suggest-widget.visible')).toContainText(/无建议|No suggestions/)
    checks.push({ text, browserMembers: false })
  }
  await suggest(page, 'Java.', 'from', state)
  await suggest(page, 'Polyglot.', 'import', state)
  await suggest(page, 'const payload = { document: { title: "business" } }; payload.document.', 'title', state)
  const frontend = await page.evaluate(async () => {
    const monaco = window.__groovyMonaco
    const model = monaco.editor.createModel('document.', 'javascript', monaco.Uri.parse('inmemory://frontend-dom.js'))
    try {
      const accessor = await monaco.languages.typescript.getJavaScriptWorker()
      const worker = await accessor(model.uri)
      const result = await worker.getCompletionsAtPosition(model.uri.toString(), 'document.'.length)
      return result.entries.map(item => item.name)
    } finally { model.dispose() }
  })
  expect(frontend).toContain('querySelector')
  checks.push({ frontendDocumentQuerySelector: true })
  await testInfo.attach('javascript-runtime-boundaries', { body: JSON.stringify(checks, null, 2), contentType: 'application/json' })
})
