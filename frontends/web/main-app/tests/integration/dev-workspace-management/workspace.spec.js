const { test, expect } = require('@playwright/test')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '../../../../../..')
const appMetadata = path.join(root, 'dev-module/ouroboros-dev-app-management/src/main/metadata/dev/{appName}')
const projectionMetadata = path.join(root, 'core/ouroboros-business-model/ouroboros-business-model-dev/src/main/metadata/dev/{appName}/business-model/model-bundle')
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8')).schema
const ok = (data) => ({ code: 0, data, msg: '' })
async function mount(page, schema, responses) {
  await page.route('**/workspace-management-fixture', (route) => route.fulfill({ json: { ...schema, data: { appName: 'crm', fullName: 'sales.Order', name: 'sales/order', ...schema.data } } }))
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const response = await responses(url, route.request())
    await route.fulfill({ json: response ?? ok({}) })
  })
  await page.goto('/dev-workspace-management-playwright-harness.html')
  await page.waitForFunction(() => window.workspaceHarness?.ready)
}

test('current files allow owned commits and administrator unlock; credentials stack vertically', async ({ page }, testInfo) => {
  const requests = []
  await mount(page, read(path.join(appMetadata, 'versions.ui-schema.json')), (url, req) => {
    if (url.pathname.endsWith('/state')) return ok({currentBranch:'master', currentRevision:'abc123456', lastCommitMessage:'更新订单模型', workspaceClean:false, remoteUri:'https://example.com/crm.git'})
    if (url.pathname.endsWith('/workspace/files')) return ok({items:[
      {path:'models/order.json', exists:true, canCommit:true, canUnlock:true, canForceUnlock:false, lockOwner:'我', lockState:'OWNED', versionState:'CHANGED'},
      {path:'models/customer.json', exists:true, canCommit:false, canUnlock:false, canForceUnlock:true, lockOwner:'另一位开发者', lockState:'LOCKED', versionState:'CHANGED'},
    ]})
    if (url.pathname.endsWith('/workspace/commit') || url.pathname.endsWith('/workspace/unlock')) { requests.push({path:url.pathname,data:req.postDataJSON()}); return ok(true) }
    if (url.pathname.endsWith('/config/local-binding')) return ok({bindings:[{remoteName:'origin',authType:'HTTP_BASIC',username:'developer'}]})
    return ok({items:[]})
  })
  await expect(page.getByText('abc123456', {exact:true})).toBeVisible()
  await expect(page.getByText('models/order.json', {exact:true})).toBeVisible()
  const mine = page.locator('tbody tr').filter({hasText:'models/order.json'})
  const other = page.locator('tbody tr').filter({hasText:'models/customer.json'})
  await expect(other.getByRole('button',{name:'提交', exact:true})).toHaveCount(0)
  await mine.getByRole('button',{name:'提交', exact:true}).click()
  await page.getByPlaceholder('说明本次修改').fill('修正订单')
  await page.getByRole('button',{name:'提交',exact:true}).last().click()
  await expect.poll(() => requests.filter(r=>r.path.endsWith('/commit'))).toEqual([{path:'/api/dev/crm/vcs/workspace/commit',data:{paths:['models/order.json'],message:'修正订单'}}])
  if (await page.getByRole('button',{name:'取消',exact:true}).count()) await page.getByRole('button',{name:'取消',exact:true}).last().click()
  await expect(mine.locator('input[type="checkbox"]')).toHaveCount(1)
  await expect(other.locator('input[type="checkbox"]')).toBeDisabled()
  await mine.locator('label').filter({has:page.locator('input[type="checkbox"]')}).click()
  await page.getByRole('button',{name:'提交选中文件',exact:true}).click()
  await page.getByPlaceholder('说明本次修改').fill('批量提交订单')
  await page.getByRole('button',{name:'提交',exact:true}).last().click()
  await expect.poll(() => requests.filter(r=>r.path.endsWith('/commit')).length).toBe(2)
  expect(requests.filter(r=>r.path.endsWith('/commit'))[1]).toEqual({path:'/api/dev/crm/vcs/workspace/commit',data:{paths:['models/order.json'],message:'批量提交订单'}})
  if (await page.getByRole('button',{name:'取消',exact:true}).count()) await page.getByRole('button',{name:'取消',exact:true}).last().click()
  await other.getByRole('button',{name:'强制解锁',exact:true}).click()
  await page.getByRole('button',{name:/确认|确定/}).last().click()
  await expect.poll(() => requests.filter(r=>r.path.endsWith('/unlock')).length).toBe(1)
  expect(requests.find(r=>r.path.endsWith('/unlock')).data).toEqual({paths:['models/customer.json'],force:true})
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.screenshot({path:testInfo.outputPath('current-workspace.png'), fullPage:true})
  await page.getByRole('button',{name:/凭证配置$/}).click()
  const username = page.locator('input[name="username"]')
  await expect(username).toBeVisible()
  const remote = page.getByPlaceholder('请输入远程名称')
  expect((await username.boundingBox()).y).toBeGreaterThan((await remote.boundingBox()).y + (await remote.boundingBox()).height)
  await page.screenshot({path:testInfo.outputPath('credentials.png'), fullPage:true})
})

for (const kind of ['logicflow','ui-schema']) {
  test(`${kind} projection opens existing target, clones only when absent, and stops on failure`, async ({page}) => {
    let exists = true
    let fail = false
    const calls = []
    const schema = read(path.join(projectionMetadata, kind === 'logicflow' ? 'flow-model-detail.ui-schema.json' : 'schema-detail.ui-schema.json'))
    // Preview content uses a real external micro frontend; this test targets the shared action boundary.
    schema.body = schema.body.filter(item => item.type === 'button-toolbar')
    const button = {type:'button',label:'打开预览',actionType:'dialog',dialog:{title:'模型投射',body:schema,actions:[{type:'button',label:'关闭',actionType:'close'}]}}
    await mount(page,{type:'page',body:[button]}, (url, req) => {
      calls.push({path:url.pathname,method:req.method()})
      if(url.pathname.endsWith('/projection-target'))return ok({name:'sales/order',editName:'sales.order',editUrl:'/dev/crm/'+(kind==='logicflow'?'logicflow-model':'ui-schema')+'/sales.order',isCloned:exists})
      if(req.method()==='POST')return fail?{code:1,msg:'克隆失败'}:ok('sales.order')
      return ok({})
    })
    await page.getByRole('button',{name:'打开预览',exact:true}).click()
    await page.getByRole('button',{name:/打开编辑器$/}).click()
    await expect.poll(()=>page.evaluate(()=>window.workspaceHarness.opened.length)).toBe(1)
    expect(calls.filter(call=>call.method==='POST')).toHaveLength(0)
    exists=false
    await page.getByRole('button',{name:'打开预览',exact:true}).click()
    await page.getByRole('button',{name:/克隆并编辑$/}).click()
    await expect.poll(()=>page.evaluate(()=>window.workspaceHarness.opened.length)).toBe(2)
    expect(calls.filter(call=>call.method==='POST')).toHaveLength(1)
    fail=true
    await page.getByRole('button',{name:'打开预览',exact:true}).click()
    await page.getByRole('button',{name:/克隆并编辑$/}).click()
    await expect(page.getByText('克隆失败',{exact:true})).toBeVisible()
    expect(await page.evaluate(()=>window.workspaceHarness.opened.length)).toBe(2)
    await expect(page.getByRole('button',{name:/克隆并编辑$/})).toBeVisible()
  })
}
