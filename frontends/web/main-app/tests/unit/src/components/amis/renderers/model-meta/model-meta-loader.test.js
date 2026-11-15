const assert = require('node:assert/strict')
const path = require('node:path')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

const originalFetch = global.fetch
const originalLocalStorage = global.localStorage
const originalSessionStorage = global.sessionStorage

function createStorage(items = {}) {
  const values = new Map(Object.entries(items))
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

function loadModule() {
  clearMirroredSrcModuleCache(__filename, 'model-meta')
  return requireMirroredSrcModule(__filename, './model-meta-loader.ts')
}

afterEach(() => {
  global.fetch = originalFetch
  global.localStorage = originalLocalStorage
  global.sessionStorage = originalSessionStorage
})

test('model meta loader prefers staticMeta hits and skips remote fetch', async () => {
  const { loadModelMeta } = loadModule()
  let fetchCalls = 0
  global.fetch = async () => {
    fetchCalls += 1
    throw new Error('should not fetch')
  }

  const meta = await loadModelMeta({
    provider: {
      modelRefKey: 'fullName',
      staticMeta: {
        'crm.customer': {
          model: { name: 'crm.customer', label: '客户' },
          fields: [{ name: 'name', label: '客户名称', type: 'text' }],
          relations: [
            {
              name: 'owner',
              label: '负责人',
              targetModel: 'sys.user',
              type: 'model',
            },
          ],
        },
      },
    },
    data: { fullName: 'crm.customer' },
  })

  assert.equal(fetchCalls, 0)
  assert.equal(meta.model.name, 'crm.customer')
  assert.equal(meta.relations[0].targetModel, 'sys.user')
})

test('model meta loader resolves explicit modelRef into request templates', async () => {
  const { loadModelMeta } = loadModule()
  const calls = []
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init })
    return {
      ok: true,
      async json() {
        return {
          data: {
            model: { name: 'sys.user', label: '用户' },
            fields: [{ name: 'nickname', label: '昵称', type: 'text' }],
            relations: [],
          },
        }
      },
    }
  }

  const meta = await loadModelMeta({
    provider: {
      modelRef: 'sys.user',
      source: {
        method: 'post',
        url: '/api/dev/${appName}/business-model-helper/${modelRef}/model-meta',
      },
      requestData: {
        appName: '${appName}',
        modelRef: '${modelRef}',
      },
      paths: {
        model: 'data.model',
        fields: 'data.fields',
        relations: 'data.relations',
      },
    },
    data: { appName: 'demo-app', fullName: 'ignored.value' },
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/dev/demo-app/business-model-helper/sys.user/model-meta')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(JSON.parse(calls[0].init.body).modelRef, 'sys.user')
  assert.equal(meta.model.name, 'sys.user')
})

test('model meta loader appends GET requestData into query strings', async () => {
  const { loadModelMeta } = loadModule()
  const calls = []
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init })
    return {
      ok: true,
      async json() {
        return {
          data: {
            model: { name: 'crm.customer', label: '客户' },
            fields: [],
            relations: [],
          },
        }
      },
    }
  }

  await loadModelMeta({
    provider: {
      modelRefKey: 'fullName',
      source: {
        method: 'get',
        url: '/api/meta?tenant=demo',
        headers: {
          'X-Test': '1',
        },
      },
      requestData: {
        appName: '${appName}',
        modelRef: '${modelRef}',
        optional: null,
      },
      paths: {
        model: 'data.model',
        fields: 'data.fields',
        relations: 'data.relations',
      },
    },
    data: {
      appName: 'demo-app',
      fullName: 'crm.customer',
    },
  })

  assert.equal(calls.length, 1)
  assert.equal(
    calls[0].url,
    '/api/meta?tenant=demo&appName=demo-app&modelRef=crm.customer'
  )
  assert.equal(calls[0].init.method, 'GET')
  assert.equal(calls[0].init.body, undefined)
  assert.equal(calls[0].init.headers['X-Test'], '1')
})

test('model meta loader attaches stored authorization to direct fetches', async () => {
  const { loadModelMeta } = loadModule()
  const calls = []
  global.localStorage = createStorage({
    Ouroboros_token: JSON.stringify({
      accessToken: {
        token: 'stored-access-token',
        expiresAt: Date.now() + 60_000,
      },
    }),
  })
  global.sessionStorage = createStorage()
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init })
    return {
      ok: true,
      async json() {
        return {
          data: {
            model: { name: 'crm.customer', label: '客户' },
            fields: [],
            relations: [],
          },
        }
      },
    }
  }

  await loadModelMeta({
    provider: {
      modelRefKey: 'fullName',
      source: {
        method: 'get',
        url: '/api/meta/${modelRef}',
      },
      paths: {
        model: 'data.model',
        fields: 'data.fields',
        relations: 'data.relations',
      },
    },
    data: { fullName: 'crm.customer' },
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].init.headers.Authorization, 'Bearer stored-access-token')
})

test('model meta loader keeps explicit authorization headers', async () => {
  const { loadModelMeta } = loadModule()
  const calls = []
  global.localStorage = createStorage({
    Ouroboros_token: JSON.stringify({
      accessToken: {
        token: 'stored-access-token',
        expiresAt: Date.now() + 60_000,
      },
    }),
  })
  global.sessionStorage = createStorage()
  global.fetch = async (url, init = {}) => {
    calls.push({ url, init })
    return {
      ok: true,
      async json() {
        return {
          data: {
            model: { name: 'crm.customer', label: '客户' },
            fields: [],
            relations: [],
          },
        }
      },
    }
  }

  await loadModelMeta({
    provider: {
      modelRefKey: 'fullName',
      source: {
        method: 'get',
        url: '/api/meta/${modelRef}',
        headers: {
          Authorization: 'Bearer explicit-token',
        },
      },
      paths: {
        model: 'data.model',
        fields: 'data.fields',
        relations: 'data.relations',
      },
    },
    data: { fullName: 'crm.customer' },
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].init.headers.Authorization, 'Bearer explicit-token')
})

test('model meta loader normalizes remote payloads through configured paths and mappings', async () => {
  const { loadModelMeta } = loadModule()
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        payload: {
          meta: { name: 'crm.customer', label: '客户' },
          columns: [{ key: 'name', title: '客户名称', kind: 'text' }],
          links: [
            {
              key: 'owner',
              title: '负责人',
              ref: 'sys.user',
              refTitle: '用户',
              relationKind: 'model',
            },
          ],
        },
      }
    },
  })

  const meta = await loadModelMeta({
    provider: {
      modelRefKey: 'fullName',
      source: {
        method: 'get',
        url: '/api/meta/${modelRef}',
      },
      paths: {
        model: 'payload.meta',
        fields: 'payload.columns',
        relations: 'payload.links',
      },
      fieldMapping: {
        name: 'key',
        label: 'title',
        type: 'kind',
      },
      relationMapping: {
        name: 'key',
        label: 'title',
        targetModel: 'ref',
        targetModelLabel: 'refTitle',
        type: 'relationKind',
      },
    },
    data: { fullName: 'crm.customer' },
  })

  assert.deepEqual(meta, {
    model: { name: 'crm.customer', label: '客户' },
    fields: [{ name: 'name', label: '客户名称', type: 'text' }],
    relations: [
      {
        name: 'owner',
        label: '负责人',
        targetModel: 'sys.user',
        targetModelLabel: '用户',
        type: 'model',
      },
    ],
  })
})

test('model meta loader caches resolved remote meta by provider and modelRef', async () => {
  const { loadModelMeta } = loadModule()
  let fetchCalls = 0
  global.fetch = async () => {
    fetchCalls += 1
    return {
      ok: true,
      async json() {
        return {
          data: {
            model: { name: 'crm.customer', label: '客户' },
            fields: [{ name: 'name', label: '客户名称', type: 'text' }],
            relations: [],
          },
        }
      },
    }
  }

  const input = {
    provider: {
      modelRefKey: 'fullName',
      source: {
        method: 'get',
        url: '/api/meta/${modelRef}',
      },
      paths: {
        model: 'data.model',
        fields: 'data.fields',
        relations: 'data.relations',
      },
    },
    data: { fullName: 'crm.customer' },
  }

  const first = await loadModelMeta(input)
  const second = await loadModelMeta(input)

  assert.equal(fetchCalls, 1)
  assert.equal(first, second)
})
