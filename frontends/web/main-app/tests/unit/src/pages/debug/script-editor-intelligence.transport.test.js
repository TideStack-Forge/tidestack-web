const assert = require('node:assert/strict')
const path = require('node:path')
const { requireMirroredSrcModule } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

const { createPlaygroundFetcher, fetchMetadataSnapshot, buildMetadataApi } =
  requireMirroredSrcModule(__filename, './script-editor-intelligence.transport')

test('playground fetcher delegates api mode requests through the provided client', async () => {
  const calls = []
  const client = {
    async post(url, data) {
      calls.push({
        method: 'post',
        url,
        data,
      })
      return {
        status: 200,
        data: {
          code: 0,
          status: 0,
          msg: '',
          data: {
            runtimeProfile: 'logicflow-graaljs',
          },
        },
      }
    },
    async get(url, params) {
      calls.push({
        method: 'get',
        url,
        params,
      })
      return {
        status: 200,
        data: {
          code: 0,
          msg: '',
          data: {
            source: 'dev-helper-runtime',
            runtimeProfile: 'logicflow-graaljs',
          },
        },
      }
    },
  }
  const fetcher = createPlaygroundFetcher({
    sourceMode: 'api',
    client,
  })

  const snapshotResponse = await fetcher({
    method: 'post',
    url: '/api/dev/playground-app/code-intelligence/context',
    data: {
      language: 'javascript',
    },
  })
  const metadata = await fetchMetadataSnapshot(fetcher, 'playground-app', 'javascript')

  assert.equal(snapshotResponse.data.data.runtimeProfile, 'logicflow-graaljs')
  assert.deepEqual(metadata, {
    source: 'dev-helper-runtime',
    runtimeProfile: 'logicflow-graaljs',
  })
  assert.deepEqual(calls, [
    {
      method: 'post',
      url: '/api/dev/playground-app/code-intelligence/context',
      data: {
        language: 'javascript',
      },
    },
    {
      method: 'get',
      url: buildMetadataApi('playground-app', 'javascript'),
      params: {},
    },
  ])
})

test('playground fetcher intercepts mock snapshot requests locally', async () => {
  const requests = []
  const fetcher = createPlaygroundFetcher({
    sourceMode: 'mock',
    intelligenceApi: '/api/mock/script-intelligence',
    debugState: {
      requests,
    },
    buildMockSnapshot(request) {
      return {
        source: 'playground-mock',
        runtimeProfile: 'playground-mock',
        versionToken: `${request.language}-playground-v1`,
      }
    },
  })

  const result = await fetcher({
    method: 'post',
    url: '/api/mock/script-intelligence',
    data: {
      language: 'groovy',
    },
  })

  assert.deepEqual(requests, [
    {
      language: 'groovy',
    },
  ])
  assert.deepEqual(result, {
    status: 0,
    data: {
      documentId: undefined, documentVersion: undefined, draftRevision: undefined,
      snapshot: { source: 'playground-mock', runtimeProfile: 'playground-mock', versionToken: 'groovy-playground-v1' },
    },
  })
})

test('mock language sessions exercise the same LSP messages and lifecycle as the real client', async () => {
  const fetcher = createPlaygroundFetcher({ sourceMode: 'mock', intelligenceApi: '/api/mock/code-intelligence/context',
    buildMockSnapshot: () => ({ globals: [{ name: '$input', members: [{ name: 'customerName', memberKind: 'field' }] }] }) })
  const url = '/api/mock/code-intelligence/sessions'
  const opened = (await fetcher({ method: 'post', url, data: { text: '$input.', context: { language: 'groovy' } } })).data
  assert(opened.messages[0].result.capabilities.completionProvider)
  const response = await fetcher({ method: 'post', url: `${url}/${opened.sessionId}/messages`, data: [
    { id: 'completion', method: 'textDocument/completion', params: { position: { line: 0, character: 7 } } },
  ] })
  assert.equal(response.data.messages[0].id, 'completion')
  assert.equal(response.data.messages[0].result[0].label, 'customerName')
  await fetcher({ method: 'delete', url: `${url}/${opened.sessionId}` })
  await assert.rejects(fetcher({ method: 'get', url: `${url}/${opened.sessionId}/notifications` }), /not found/)
})
