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
    url: '/api/dev/playground-app/logicflow/script-intelligence/snapshot',
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
      url: '/api/dev/playground-app/logicflow/script-intelligence/snapshot',
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
      source: 'playground-mock',
      runtimeProfile: 'playground-mock',
      versionToken: 'groovy-playground-v1',
    },
  })
})
