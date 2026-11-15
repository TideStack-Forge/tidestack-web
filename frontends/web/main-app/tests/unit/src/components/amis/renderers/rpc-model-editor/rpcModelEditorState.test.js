const {
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require('../../../../../helpers/mainAppTestKit')
registerTypescriptRequire()
const { RpcModelEditorState, persistableModel, modelHash, testValues } =
  requireMirroredSrcModule(__filename, 'rpcModelEditorState.ts')

function setup(options = {}) {
  let saved = persistableModel({
    name: 'example',
    title: '示例',
    type: 'OpenApi',
    isEnabled: true,
    request: { url: 'http://local', method: 'GET' },
  })
  let changed = false
  let lock = options.owned ? 'OWNED' : 'UNLOCKED'
  const calls = []
  let commitFailure = options.commitFailure
  let history = []
  let responseLost = options.commitResponseLost
  const request = async (method, url, data) => {
    calls.push({ method, url, data })
    if (url.endsWith('/status'))
      return { lockState: lock, versionState: changed ? 'CHANGED' : 'NOTCHANGED' }
    if (url.endsWith('/release-lock')) {
      lock = 'UNLOCKED'
      return
    }
    if (url.endsWith('/lock')) {
      lock = 'OWNED'
      return
    }
    if (url.endsWith('/commit')) {
      if (commitFailure) {
        commitFailure = false
        throw new Error('提交失败')
      }
      changed = false
      lock = 'UNLOCKED'
      history = [{ id: 'committed', message: data.commitMsg }]
      if (responseLost) {
        responseLost = false
        throw new Error('commit response lost')
      }
      return true
    }
    if (url.endsWith('/change-log')) return history
    if (url.endsWith('/test/init-form'))
      return {
        modelHash: await modelHash(saved),
        revision: 'r1',
        testable: true,
        ready: true,
        variables: [{ name: 'input', suggestedType: 'object' }],
        configItems: [{ name: 'secret', hasDefault: true }],
        maxDurationMs: 100,
      }
    if (url.endsWith('/test')) return { testId: 't1', success: true }
    if (method === 'get') return structuredClone(saved)
    saved = structuredClone(data)
    changed = true
    lock = 'OWNED'
    return structuredClone(saved)
  }
  return { state: new RpcModelEditorState('demo', request, () => {}), calls }
}

test('normalizes persistable fields without losing extensions or false, zero, null and arrays', () => {
  const model = persistableModel(
    {
      isEnabled: false,
      retry: 0,
      description: '',
      request: { a: [false, 0, null] },
      appName: 'ui',
    },
    { extension: 0 }
  )
  expect(model).toMatchObject({
    extension: 0,
    isEnabled: false,
    retry: 0,
    description: '',
    request: { a: [false, 0, null] },
  })
  expect(model).not.toHaveProperty('appName')
})

test('loads a saved model, locks it and completes initialization', async () => {
  const { state } = setup()
  await state.load('example')
  expect(state.phase).toBe('')
  expect(state.dirty).toBe(false)
  expect(state.canTest).toBe(true)
  expect(state.pendingCommit).toBe(false)
  expect(state.ownedLock).toBe(true)
})

test('dirty disables test and restoring original re-enables it', async () => {
  const { state } = setup()
  await state.load('example')
  const original = structuredClone(state.draft)
  state.change({ ...original, title: '修改' })
  expect(state.canTest).toBe(false)
  state.change(original)
  expect(state.canTest).toBe(true)
  state.variables[0].value = '{"id":0}'
  state.inputChanged()
  expect(state.dirty).toBe(false)
})

test('new model can be saved repeatedly without VCS commit or tab changes', async () => {
  const { state, calls } = setup()
  await state.load()
  state.change({ ...state.draft, name: 'created', title: '新建' })
  state.tab = 'test'
  expect(await state.save()).toBe(true)
  state.change({ ...state.draft, title: '第二次' })
  expect(await state.save()).toBe(true)
  expect(calls.filter((c) => c.url.endsWith('/commit'))).toHaveLength(0)
  expect(
    calls.filter(
      (c) =>
        ['put', 'post'].includes(c.method) &&
        !c.url.endsWith('/lock') &&
        !c.url.endsWith('/test/init-form')
    )
  ).toHaveLength(2)
  expect(state.tab).toBe('test')
  expect(state.pendingCommit).toBe(true)
})

test('inherits same-user lock without claiming its release', async () => {
  const { state, calls } = setup({ owned: true })
  await state.load('example')
  state.init = null
  state.change({ ...state.draft, title: '修改' })
  await state.save()
  await state.releaseLock()
  expect(calls.some((c) => c.url.endsWith('/release-lock'))).toBe(false)
})

test('commit failure preserves saved data and message; retry only commits', async () => {
  const { state, calls } = setup({ commitFailure: true })
  await state.load('example')
  state.change({ ...state.draft, title: '修改' })
  state.commitMessage = '  完成接口测试  '
  expect(await state.commit()).toBe(false)
  expect(state.dirty).toBe(false)
  expect(state.commitMessage).toBe('  完成接口测试  ')
  expect(await state.commit()).toBe(true)
  expect(calls.filter((c) => c.method === 'put')).toHaveLength(1)
  expect(
    calls.filter((c) => c.url.endsWith('/commit')).map((c) => c.data.commitMsg)
  ).toEqual(['完成接口测试', '完成接口测试'])
})

test('validates commit message before any save or commit', async () => {
  const { state, calls } = setup()
  state.commitMessage = '   '
  expect(await state.commit()).toBe(false)
  state.commitMessage = '长'.repeat(201)
  expect(await state.commit()).toBe(false)
  expect(calls).toHaveLength(0)
})

test('typed test values preserve explicit empty configuration and reject duplicates', () => {
  expect(
    testValues([
      { name: 'bool', type: 'boolean', value: 'false' },
      { name: 'num', type: 'number', value: '0' },
      { name: 'obj', type: 'object', value: '{"id":0}' },
    ])
  ).toEqual({ bool: false, num: 0, obj: { id: 0 } })
  expect(
    testValues(
      [
        { name: 'default', value: 'ignored', override: false },
        { name: 'empty', value: '', override: true },
      ],
      true
    )
  ).toEqual({ empty: '' })
  expect(() =>
    testValues([
      { name: 'x', type: 'string', value: '' },
      { name: 'x', type: 'null', value: '' },
    ])
  ).toThrow('重复')
  expect(() => testValues([{ name: 'x', type: 'number', value: '' }])).toThrow('数字')
})

test('test result is retained and marked stale when input or model changes', async () => {
  const { state } = setup()
  await state.load('example')
  state.variables[0].value = '{}'
  await state.test()
  expect(state.resultStale).toBe(false)
  state.inputChanged()
  expect(state.resultStale).toBe(true)
  expect(state.result.testId).toBe('t1')
})

test('optional inputs remain absent while explicit null, empty and arrays survive', () => {
  expect(
    testValues([
      { name: 'absent', type: 'object', value: 'invalid', provided: false },
      { name: 'empty', type: 'string', value: '', provided: true },
      { name: 'nil', type: 'null', value: '', provided: true },
      { name: 'list', type: 'array', value: '[false,0,null]', provided: true },
    ])
  ).toEqual({ empty: '', nil: null, list: [false, 0, null] })
})

test('latest initialization wins and compatible entered values survive metadata refresh', async () => {
  const { state } = setup()
  await state.load('example')
  state.variables[0].value = '{"id":1}'
  state.variables[0].provided = true
  const init = {
    ...state.init,
    variables: [
      {
        name: 'input',
        suggestedType: 'object',
        required: true,
        sensitive: true,
        references: ['request.body'],
      },
    ],
  }
  const pending = []
  const request = state.request
  state.request = (method, url, data) =>
    url.endsWith('/test/init-form')
      ? new Promise((resolve) => pending.push(resolve))
      : request(method, url, data)
  const first = state.initialize()
  const second = state.initialize()
  pending[1]({ ...init, revision: 'new' })
  await second
  pending[0]({ ...init, revision: 'old' })
  await first
  expect(state.init.revision).toBe('new')
  expect(state.variables[0]).toMatchObject({
    value: '{"id":1}',
    provided: true,
    required: true,
    sensitive: true,
    references: ['request.body'],
  })
})

test('duplicate save clicks produce one write and a lost response is reconciled without replay', async () => {
  const { state, calls } = setup()
  await state.load('example')
  state.change({ ...state.draft, title: '保存后网络中断' })
  const request = state.request
  let finish
  state.request = async (method, url, data) => {
    if (method === 'put') {
      await new Promise((resolve) => {
        finish = resolve
      })
      await request(method, url, data)
      throw new Error('response lost')
    }
    return request(method, url, data)
  }
  const saving = state.save()
  expect(await state.save()).toBe(false)
  while (!finish) await Promise.resolve()
  finish()
  expect(await saving).toBe(false)
  expect(state.dirty).toBe(false)
  expect(state.error).toContain('已核对工作区内容')
  expect(calls.filter((call) => call.method === 'put')).toHaveLength(1)
})

test('a late initialization cannot reactivate a disposed editor', async () => {
  const { state } = setup()
  await state.load('example')
  const init = state.init
  let finish
  state.request = () =>
    new Promise((resolve) => {
      finish = resolve
    })
  const initializing = state.initialize()
  state.dispose()
  finish(init)
  await initializing
  expect(state.init).toBeNull()
})

test('another user lock leaves saved-model testing available but prohibits writes', async () => {
  const { state, calls } = setup()
  const request = state.request
  state.request = (method, url, data) => {
    if (url.endsWith('/lock')) throw new Error('模型由其他用户编辑')
    return request(method, url, data)
  }
  await state.load('example')
  expect(state.canEdit).toBe(false)
  expect(state.canTest).toBe(true)
  expect(await state.save()).toBe(false)
  await state.test()
  expect(calls.filter((call) => call.url.endsWith('/test'))).toHaveLength(1)
})

test('confirmed lost commit response is recovered from status and history without another commit', async () => {
  const { state, calls } = setup({ commitResponseLost: true })
  await state.load('example')
  state.change({ ...state.draft, title: 'changed' })
  state.commitMessage = '保存并提交'
  expect(await state.commit()).toBe(false)
  expect(state.commitConfirmed).toBe(true)
  expect(state.error).toContain('提交已完成')
  expect(await state.commit()).toBe(true)
  expect(calls.filter((call) => call.url.endsWith('/commit'))).toHaveLength(1)
})

test('a lock acquired after disposal is released without loading more resources', async () => {
  const { state, calls } = setup()
  const request = state.request
  let finish
  state.request = (method, url, data) =>
    url.endsWith('/lock')
      ? new Promise((resolve) => {
          finish = () => request(method, url, data).then(resolve)
        })
      : request(method, url, data)
  const loading = state.load('example')
  while (!finish) await Promise.resolve()
  state.dispose()
  finish()
  await loading
  expect(calls.filter((call) => call.url.endsWith('/release-lock'))).toHaveLength(1)
  expect(calls.some((call) => call.url.endsWith('/test/init-form'))).toBe(false)
})

test('configuration changes invalidate immediately, use POST bodies and prune obsolete dependencies', async () => {
  const { state, calls } = setup()
  await state.load('example')
  const initial = state.init
  const request = state.request
  const pending = []
  state.request = (method, url, data) => {
    if (!url.endsWith('/test/init-form')) return request(method, url, data)
    expect(method).toBe('post')
    expect(url).not.toContain('private')
    expect(Object.keys(data)).toEqual(['configValues'])
    return new Promise((resolve) => pending.push({ resolve, data }))
  }
  state.configurationChanged([
    { ...state.configs[0], override: true, value: 'private-one' },
  ])
  expect(state.canTest).toBe(false)
  expect(state.dirty).toBe(false)
  const first = state.initialize()
  state.configurationChanged([{ ...state.configs[0], value: 'private-two' }])
  const second = state.initialize()
  expect(pending.map((item) => item.data.configValues)).toEqual([
    { secret: 'private-one' },
    { secret: 'private-two' },
  ])
  pending[1].resolve({
    ...initial,
    revision: 'current',
    configItems: [{ name: 'new-key', hasDefault: false }],
    ready: false,
    missingConfigKeys: ['new-key'],
  })
  await second
  pending[0].resolve({ ...initial, revision: 'outdated' })
  await first
  expect(state.init.revision).toBe('current')
  expect(state.configs.map((item) => item.name)).toEqual(['new-key'])
  expect(state.canTest).toBe(false)
  await state.test()
  expect(calls.some((call) => call.url.endsWith('/test'))).toBe(false)
  state.dispose()
})

test('unchanged config and variable editing do not rebuild dependencies', async () => {
  const { state, calls } = setup()
  await state.load('example')
  const count = calls.length
  state.configurationChanged(structuredClone(state.configs))
  state.variables[0].value = '{}'
  state.inputChanged()
  expect(state.canTest).toBe(true)
  expect(calls).toHaveLength(count)
  state.dispose()
})
