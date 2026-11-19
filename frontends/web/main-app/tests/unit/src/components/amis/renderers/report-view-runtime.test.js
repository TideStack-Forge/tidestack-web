import { expect, test, vi } from 'vitest'

const rendererRegistry = vi.hoisted(() => ({
  registered: null,
}))

vi.mock('amis', () => ({
  Renderer: () => (target) => {
    rendererRegistry.registered = target
    return target
  },
  buildApi: (api) => api,
  dataMapping: (api) => api,
}))

await import('../../../../../../../ouroboros-amis-runtime/src/renderers/report-view-runtime/ReportViewRuntime.tsx')

function deferred() {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return {
    promise,
    resolve,
    reject,
  }
}

function createRuntime(fetcher) {
  const Runtime = rendererRegistry.registered
  const instance = new Runtime({
    api: {
      method: 'post',
      url: '/api/dev/demo/statistics-reporting/preview',
      data: {
        view: {
          displayType: 'bar',
          dimensionFields: ['region'],
          metricFields: ['total_amount'],
        },
      },
    },
    data: {},
    env: {
      fetcher,
    },
    render: (region, schema, props) => ({
      props,
      region,
      schema,
    }),
  })
  instance.setState = (updater) => {
    const patch = typeof updater === 'function' ? updater(instance.state) : updater
    instance.state = {
      ...instance.state,
      ...patch,
    }
  }
  return instance
}

function createRuntimeWithProps(fetcher, overrides = {}) {
  const Runtime = rendererRegistry.registered
  const instance = new Runtime({
    viewName: 'demo.sales-metric',
    data: {},
    env: {
      fetcher,
    },
    render: (region, schema, props) => ({
      props,
      region,
      schema,
    }),
    ...overrides,
  })
  instance.setState = (updater) => {
    const patch = typeof updater === 'function' ? updater(instance.state) : updater
    instance.state = {
      ...instance.state,
      ...patch,
    }
  }
  return instance
}

function successPayload(titleText) {
  return {
    status: 0,
    data: {
      projection: {
        displayType: 'bar',
        dimensionFields: ['region'],
        metricFields: ['total_amount'],
        columns: [
          { name: 'region', title: 'Region' },
          { name: 'total_amount', title: 'Total Amount' },
        ],
        rows: [
          { region: 'east', total_amount: 128 },
        ],
        displayConfig: {
          titleText,
        },
      },
    },
  }
}

test('report view runtime calls report-view execute API by viewName', async () => {
  const fetcher = vi.fn().mockResolvedValue(successPayload('real preview'))
  const runtime = createRuntimeWithProps(fetcher)

  await runtime.loadProjection()

  expect(fetcher).toHaveBeenCalledWith(
    {
      method: 'post',
      url: '/api/runtime/statistics-reporting/report-views/demo.sales-metric/execute',
      data: {},
    },
    {}
  )
  expect(runtime.state.schema.config.title.text).toBe('real preview')
})

test('report view runtime shows empty state for empty projections', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    status: 0,
    data: {
      projection: {
        displayType: 'bar',
        dimensionFields: ['region'],
        metricFields: ['total_amount'],
        rows: [],
      },
    },
  })
  const runtime = createRuntimeWithProps(fetcher)

  await runtime.loadProjection()

  expect(runtime.state.schema).toMatchObject({
    type: 'alert',
    level: 'info',
    body: '暂无可预览数据',
  })
})

test('report view runtime shows unauthorized state without blanking widget', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    status: 403,
    msg: '没有权限访问该报表',
  })
  const runtime = createRuntimeWithProps(fetcher)

  await runtime.loadProjection()

  expect(runtime.state.schema).toMatchObject({
    type: 'alert',
    level: 'warning',
    body: '没有权限访问该报表',
  })
})

test('report view runtime shows error state without blanking widget', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    status: 500,
    msg: '执行失败',
  })
  const runtime = createRuntimeWithProps(fetcher)

  await runtime.loadProjection()

  expect(runtime.state.schema).toMatchObject({
    type: 'alert',
    level: 'danger',
    body: '执行失败',
  })
})

test('report view runtime discards stale successful responses after newer preview request', async () => {
  const firstRequest = deferred()
  const secondRequest = deferred()
  const fetcher = vi.fn()
    .mockReturnValueOnce(firstRequest.promise)
    .mockReturnValueOnce(secondRequest.promise)
  const runtime = createRuntime(fetcher)

  const oldLoad = runtime.loadProjection()
  runtime.props = {
    ...runtime.props,
    api: {
      ...runtime.props.api,
      data: {
        view: {
          displayType: 'bar',
          dimensionFields: ['channel'],
          metricFields: ['total_amount'],
        },
      },
    },
  }
  const newLoad = runtime.loadProjection()

  secondRequest.resolve(successPayload('new preview'))
  await newLoad
  expect(runtime.state.schema.config.title.text).toBe('new preview')

  firstRequest.resolve(successPayload('old preview'))
  await oldLoad
  expect(runtime.state.schema.config.title.text).toBe('new preview')
})

test('report view runtime discards stale errors after newer preview request', async () => {
  const firstRequest = deferred()
  const secondRequest = deferred()
  const fetcher = vi.fn()
    .mockReturnValueOnce(firstRequest.promise)
    .mockReturnValueOnce(secondRequest.promise)
  const runtime = createRuntime(fetcher)

  const oldLoad = runtime.loadProjection()
  runtime.props = {
    ...runtime.props,
    api: {
      ...runtime.props.api,
      data: {
        view: {
          displayType: 'bar',
          dimensionFields: ['channel'],
          metricFields: ['total_amount'],
        },
      },
    },
  }
  const newLoad = runtime.loadProjection()

  secondRequest.resolve(successPayload('current preview'))
  await newLoad
  expect(runtime.state.schema.config.title.text).toBe('current preview')

  firstRequest.reject(new Error('old preview failed'))
  await oldLoad
  expect(runtime.state.schema.config.title.text).toBe('current preview')
})
