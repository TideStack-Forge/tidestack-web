const assert = require('node:assert/strict')

async function loadInstrumentation() {
  return import('../../../integration/amis-main-thread-performance/helpers/axiosTransformInstrumentation.js')
}

test('amis main-thread axios instrumentation leaves non-target URLs untouched', async () => {
  const { instrumentAxiosConfig } = await loadInstrumentation()
  const transformRequest = [(data) => `${data}-request`]
  const transformResponse = [(data) => `${data}-response`]
  const marks = []
  const config = {
    url: '/api/other-feature/list',
    transformRequest,
    transformResponse,
  }

  const result = instrumentAxiosConfig(config, {
    onMark: (name) => marks.push(name),
  })

  assert.equal(result, config)
  assert.equal(config.transformRequest, transformRequest)
  assert.equal(config.transformResponse, transformResponse)
  assert.deepEqual(marks, [])
})

test('amis main-thread axios instrumentation wraps target transforms exactly once and in order', async () => {
  const { instrumentAxiosConfig } = await loadInstrumentation()
  const calls = []
  const marks = []
  const config = {
    url: '/api/amis-main-thread-performance/c4-submit',
    transformRequest: [
      function firstRequest(data) {
        calls.push(['request-1', this.marker])
        return `${data}a`
      },
      function secondRequest(data) {
        calls.push(['request-2', this.marker])
        return `${data}b`
      },
    ],
    transformResponse: [
      function firstResponse(data) {
        calls.push(['response-1', this.marker])
        return JSON.parse(data)
      },
      function secondResponse(data) {
        calls.push(['response-2', this.marker])
        return { ...data, touched: true }
      },
    ],
  }

  instrumentAxiosConfig(config, {
    scenarioId: 'C4a',
    runId: 'run-1',
    onMark: (name, detail) => marks.push([name, detail]),
  })

  assert.equal(config.transformRequest.length, 1)
  assert.equal(config.transformResponse.length, 1)

  const context = { marker: 'axios-context' }
  const requestData = config.transformRequest[0].call(context, 'x', {})
  const responseData = config.transformResponse[0].call(
    context,
    '{"ok":true}',
    {},
    200
  )

  assert.equal(requestData, 'xab')
  assert.deepEqual(responseData, { ok: true, touched: true })
  assert.deepEqual(calls, [
    ['request-1', 'axios-context'],
    ['request-2', 'axios-context'],
    ['response-1', 'axios-context'],
    ['response-2', 'axios-context'],
  ])
  assert.deepEqual(
    marks.map(([name]) => name),
    [
      'request-transform-start',
      'request-body-ready',
      'response-transform-start',
      'json-parse-finished',
    ]
  )
  assert.equal(marks[1][1].requestBytes, 3)
  assert.equal(marks[3][1].responseBytes, 11)
  assert.equal(marks[0][1].scenarioId, 'C4a')
  assert.equal(marks[0][1].runId, 'run-1')
})

test('amis main-thread axios instrumentation uses axios defaults when config transforms are absent', async () => {
  const { instrumentAxiosConfig } = await loadInstrumentation()
  const config = {
    url: 'http://localhost/api/amis-main-thread-performance/load',
  }

  instrumentAxiosConfig(config, {
    axiosDefaults: {
      transformRequest: [(data) => `${data}-default-request`],
      transformResponse: [(data) => `${data}-default-response`],
    },
  })

  assert.equal(config.transformRequest[0]('x'), 'x-default-request')
  assert.equal(config.transformResponse[0]('x'), 'x-default-response')
})

test('amis main-thread axios instrumentation matches Client-normalized API URLs', async () => {
  const { instrumentAxiosConfig } = await loadInstrumentation()
  const marks = []
  const config = {
    url: 'api/amis-main-thread-performance/c0-crud',
    transformRequest: [(data) => data],
    transformResponse: [(data) => data],
  }

  instrumentAxiosConfig(config, {
    onMark: (name) => marks.push(name),
  })

  config.transformRequest[0]('', {})
  assert.deepEqual(marks, ['request-transform-start', 'request-body-ready'])
})

test('amis main-thread axios instrumentation installs and ejects one request interceptor', async () => {
  const { installAmisMainThreadPerformanceAxiosInstrumentation } =
    await loadInstrumentation()
  const installed = []
  const ejected = []
  const axios = {
    defaults: {
      transformRequest: [],
      transformResponse: [],
    },
    interceptors: {
      request: {
        use(handler) {
          installed.push(handler)
          return 42
        },
        eject(id) {
          ejected.push(id)
        },
      },
    },
  }

  const cleanup = installAmisMainThreadPerformanceAxiosInstrumentation(
    (configer) => configer(axios),
    {}
  )

  assert.equal(installed.length, 1)
  cleanup()
  cleanup()
  assert.deepEqual(ejected, [42])
})
