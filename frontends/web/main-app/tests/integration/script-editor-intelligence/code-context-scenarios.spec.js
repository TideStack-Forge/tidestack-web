const { test, expect } = require('@playwright/test')
const fs = require('node:fs')
const path = require('node:path')
const repo = path.resolve(__dirname, '../../../../../..')
const endpoint = '/api/dev/example/code-intelligence/context'
const rpcSchemas = path.join(repo, 'ability/ouroboros-rpc-model/ouroboros-rpc-model-dev/src/main/metadata/dev/{appName}')
function control(file, pointer) {
  const document = JSON.parse(fs.readFileSync(path.join(rpcSchemas, file + '.ui-schema.json'), 'utf8'))
  function find(value) {
    if (!value || typeof value !== 'object') return undefined
    if (value.codePointer === pointer) return { ...value, intelligenceApi: endpoint }
    return Object.values(value).map(find).find(Boolean)
  }
  const result = find(document)
  if (!result) throw new Error(`Missing production control: ${file}:${pointer}`)
  return result
}
async function mount(page, data, body) {
  const exchanges = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', async response => {
    if (new URL(response.url()).pathname === endpoint) exchanges.push({ request: response.request().postDataJSON(), status: response.status(), response: await response.json() })
  })
  await page.addInitScript(() => {
    window.__editors = {}; window.__snapshots = []
    window.__OUROBOROS_SCRIPT_EDITOR_DEBUG__ = {
      onMounted: ({ editor, props }) => { window.__editors[props.name] = editor; editor.getDomNode().setAttribute('data-evidence-editor', props.name) },
      onIntelligenceApplied: ({ snapshot }) => window.__snapshots.push(snapshot),
    }
  })
  await page.route('**/behavior-editor-fixture', route => route.fulfill({ json: { data: { appName: 'example', ...data }, body } }))
  await page.goto('/business-behavior-catalog-playwright-harness.html?editor=1')
  await page.waitForFunction(() => window.behaviorCatalogHarness?.ready && window.__snapshots.length > 0)
  return { exchanges, errors }
}
async function suggest(page, name, value, label) {
  await page.evaluate(({ name, value }) => {
    const editor = window.__editors[name]; editor.focus(); editor.setSelection(editor.getModel().getFullModelRange()); editor.trigger('acceptance', 'paste', { text: value });
    editor.setPosition(editor.getModel().getPositionAt(value.length))
  }, { name, value })
  await page.keyboard.press('Control+Space')
  await expect(page.locator('.suggest-widget.visible')).toContainText(label)
}
async function evidence(page, info, name, state) {
  await page.screenshot({ path: info.outputPath(name + '.png'), fullPage: true })
  await info.attach(name, { body: JSON.stringify(state, null, 2), contentType: 'application/json' })
  expect(state.exchanges.length).toBeGreaterThan(0)
  expect(state.exchanges.every(item => item.status === 200 && item.response.code === 0)).toBe(true)
  expect(state.errors).toEqual([])
}

test('CCI-RPC-MODEL RPC model production URL and method controls show config and nested input completions', async ({ page }, info) => {
  const url = control('rpc-model/form-items', '/request/url')
  const method = control('rpc-model/form-items', '/request/method')
  const state = await mount(page, { name: 'orders', type: 'OpenApi', request: { url: '', method: 'POST' }, inputSchema: { type: 'object', properties: { customer: { type: 'object', properties: { name: { type: 'string' } } } } } }, [
    { type: 'combo', name: 'request', multiLine: true, items: [url, method] },
  ])
  await suggest(page, 'url', '#{rpc.', 'rpc.endpoint')
  await evidence(page, info, 'rpc-url-config', state)
  await page.keyboard.press('Escape')
  await suggest(page, 'url', '${customer.', 'name')
  await evidence(page, info, 'rpc-url-invocation', state)
  await page.keyboard.press('Escape')
  await suggest(page, 'method', '#{rpc.', 'rpc.endpoint')
  await evidence(page, info, 'rpc-method-config', state)
  expect(state.exchanges.at(-1).request.resource.type).toBe('rpc-model')
  expect(state.exchanges.at(-1).request.draft.inputSchema.properties.customer).toBeTruthy()
})

test('CCI-RPC-AUTH RPC auth production HMAC and token JSONPath controls show the correct language context', async ({ page }, info) => {
  const hmac = control('rpc-auth/type/HmacSignature', '/hmacSignature/secretKey')
  let state = await mount(page, { name: 'auth', type: 'HmacSignature', hmacSignature: { preset: 'aws_sigv4', secretKey: '' } }, [hmac])
  await suggest(page, 'hmacSignature.secretKey', '#{rpc.', 'rpc.secret')
  await evidence(page, info, 'rpc-auth-config', state)
  const token = control('rpc-auth/type/AccessToken', '/accessToken/accessTokenPath')
  state = await mount(page, { name: 'tokenAuth', type: 'AccessToken', accessToken: { mode: 'dynamic', request: { modelName: 'token' }, accessTokenPath: '' } }, [token])
  await suggest(page, 'accessToken.accessTokenPath', '$.data.', 'accessToken')
  await evidence(page, info, 'rpc-token-jsonpath', state)
  expect(state.exchanges.at(-1).request.language).toBe('jsonpath')
  expect(state.exchanges.at(-1).response.data.snapshot.globals).toEqual([])
})

test('CCI-BUSINESS-SCRIPTS business model before and after scripts use formal CRUD projection contexts', async ({ page }, info) => {
  const draft = { name: 'Order', title: '订单', modelType: 'default', isEnabled: true, fields: [
    { name: 'id', type: '单行文本', isPrimaryKey: true }, { name: 'customer', type: '单行文本' },
  ], apis: { add: { isEnabled: true, beforeScript: '', beforeScriptLanguage: 'javascript', afterScript: '', afterScriptLanguage: 'javascript' } } }
  const editor = (slot) => ({ type: 'script-editor', name: `apis.add.${slot}`, label: slot, language: 'javascript', codeResourceType: 'business-model', codeSite: 'business-model.api-script', codePointer: `/apis/add/${slot}`, intelligenceApi: endpoint })
  const state = await mount(page, draft, [editor('beforeScript'), editor('afterScript')])
  await suggest(page, 'apis.add.beforeScript', '$request.', 'data')
  await evidence(page, info, 'business-before', state)
  await page.keyboard.press('Escape')
  await suggest(page, 'apis.add.afterScript', '$0.', 'customer')
  await evidence(page, info, 'business-after', state)
})

test('CCI-BUSINESS-LOG business log FreeMarker production control shows HTTP roots', async ({ page }, info) => {
  const file = path.join(repo, 'ability/ouroboros-business-log/ouroboros-business-log-dev/src/main/metadata/dev/{appName}/business-log-template/edit.ui-schema.json')
  const template = JSON.parse(fs.readFileSync(file, 'utf8')).schema.body.find(item => item.name === 'summaryTemplate')
  const state = await mount(page, { name: 'log', httpMethod: 'POST', url: '/orders/{id}', summaryTemplate: '' }, [{ ...template, intelligenceApi: endpoint }])
  await suggest(page, 'summaryTemplate', '${Request.', 'body')
  await evidence(page, info, 'business-log-freemarker', state)
  expect(state.exchanges.at(-1).request.language).toBe('freemarker')
})
