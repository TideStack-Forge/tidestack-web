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
async function mount(page, data, body, form = {}) {
  const exchanges = [], errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', async response => {
    if (new URL(response.url()).pathname === endpoint) exchanges.push({ request: response.request().postDataJSON(), status: response.status(), response: await response.json() })
  })
  await page.addInitScript(() => {
    window.__editors = {}; window.__snapshots = []
    window.__OUROBOROS_SCRIPT_EDITOR_DEBUG__ = {
      onMounted: ({ editor, props, monaco }) => { window.__editors[props.name] = editor; window.__syntaxMonaco = monaco; editor.getDomNode().setAttribute('data-evidence-editor', props.name) },
      onIntelligenceApplied: ({ snapshot }) => window.__snapshots.push(snapshot),
    }
  })
  await page.route('**/behavior-editor-fixture', route => route.fulfill({ json: { data: { appName: 'example', ...data }, body, ...form } }))
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

const syntaxCases = [
  {
    name: 'bare SpEL', field: { type: 'script-editor', name: 'expression', language: 'spel', codeSite: 'logicflow.switch', codePointer: '/conditions/0/expression' },
    data: { expression: 'true', __CURRENT_NODE_NAME: 'switch', __FLOW_MODEL: { name: 'flow', entryNode: 'switch', nodes: [{ name: 'switch', type: 'switch', conditions: [{ expression: 'true' }] }] } },
    invalid: '$0.total +', corrected: '$0.total > 0',
  },
  {
    name: 'mapping JSON strings', field: { type: 'json-data-editor', name: 'mapping', codeContext: { language: 'spel', codeSite: 'logicflow.mapping', codePointer: '/mapping', intelligenceApi: endpoint } },
    data: { mapping: { amount: '1' }, __CURRENT_NODE_NAME: 'mapping', __FLOW_MODEL: { name: 'flow', entryNode: 'mapping', nodes: [{ name: 'mapping', type: 'mapping', mapping: { amount: '1' } }] } },
    invalid: '{"amount":"$0.total +","literal":["not an expression +"]}', corrected: '{"amount":"$0.total + 1","literal":["not an expression +"]}',
  },
  {
    name: 'RPC mixed template', field: control('rpc-model/form-items', '/request/url'),
    data: { name: 'orders', type: 'OpenApi', request: { url: '', method: 'POST' }, inputSchema: { type: 'object', properties: { customer: { type: 'string' } } } },
    invalid: 'https://#{rpc.endpoint}/${customer +}', corrected: 'https://#{rpc.endpoint}/${customer}',
  },
  {
    name: 'RPC config placeholder', field: control('rpc-auth/type/HmacSignature', '/hmacSignature/secretKey'),
    data: { name: 'auth', type: 'HmacSignature', hmacSignature: { preset: 'aws_sigv4', secretKey: '' } },
    invalid: '#{rpc.secret', corrected: '#{rpc.secret}',
  },
  {
    name: 'RPC JSONPath', field: control('rpc-auth/type/AccessToken', '/accessToken/accessTokenPath'),
    data: { name: 'auth', type: 'AccessToken', accessToken: { mode: 'dynamic', request: { modelName: 'token' }, accessTokenPath: '' } },
    invalid: "$['data'", corrected: '$.data.accessToken',
  },
  {
    name: 'FreeMarker', field: { type: 'script-editor', name: 'summaryTemplate', language: 'freemarker', codeResourceType: 'business-log-template', codeSite: 'business-log.summary', codePointer: '/summaryTemplate' },
    data: { name: 'log', httpMethod: 'POST', url: '/orders', summaryTemplate: '' },
    invalid: '<#if Request>\n${Request.body}', corrected: '<#if Request>\n${Request.body}\n</#if>',
  },
]

for (const scenario of syntaxCases) {
  test(`basic syntax diagnostics block AMIS submit for ${scenario.name} and accept corrected code`, async ({ page }, info) => {
    const submissions = []
    await page.route('**/syntax-validation-submit', async route => {
      submissions.push(route.request().postDataJSON())
      await route.fulfill({ json: { status: 0, data: {} } })
    })
    // A control nested in a combo names its local field; here mount it directly at the same resource pointer.
    const field = { ...scenario.field, intelligenceApi: endpoint }
    if (scenario.name === 'RPC mixed template') field.name = 'request.url'
    const state = await mount(page, scenario.data, [field], {
      api: 'post:/syntax-validation-submit', actions: [{ type: 'submit', label: '保存并验证' }],
    })
    const enter = async value => {
      await page.evaluate(({ name, value }) => {
        const editor = window.__editors[name]
        editor.focus()
        editor.setSelection(editor.getModel().getFullModelRange())
        editor.trigger('acceptance', 'paste', { text: value })
      }, { name: field.name, value })
    }
    await enter(scenario.invalid)
    await expect.poll(() => page.evaluate(name => window.__syntaxMonaco.editor.getModelMarkers({
      resource: window.__editors[name].getModel().uri, owner: 'editor-syntax',
    }).length, field.name)).toBeGreaterThan(0)
    await page.getByRole('button', { name: '保存并验证' }).click()
    await expect(page.locator('.cxd-Form-feedback')).toContainText('第 ')
    expect(submissions).toHaveLength(0)
    await evidence(page, info, 'syntax-error-blocked', state)
    await enter(scenario.corrected)
    await page.getByRole('button', { name: '保存并验证' }).click()
    await expect.poll(() => submissions.length).toBe(1)
    await expect(page.locator('.cxd-Form-feedback')).toHaveCount(0)
    await evidence(page, info, 'syntax-corrected-submitted', state)
    await info.attach('submissions', { body: JSON.stringify(submissions, null, 2), contentType: 'application/json' })
  })
}
