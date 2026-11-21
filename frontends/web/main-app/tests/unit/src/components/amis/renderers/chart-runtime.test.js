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

await import('../../../../../../src/components/amis/renderers/chart-runtime/ChartRuntime.tsx')

function deferred() {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function createRuntime(fetcher, overrides = {}) {
  const Runtime = rendererRegistry.registered
  const instance = new Runtime({
    chartName: 'demo.sales-metric',
    data: {},
    env: { fetcher },
    render: (region, schema, props) => ({ props, region, schema }),
    ...overrides,
  })
  instance.setState = (updater) => {
    const patch = typeof updater === 'function' ? updater(instance.state) : updater
    instance.state = { ...instance.state, ...patch }
  }
  return instance
}

function createPreviewRuntime(fetcher) {
  return createRuntime(fetcher, {
    chartName: undefined,
    api: {
      method: 'post',
      url: '/api/dev/demo/chart/preview',
      data: {
        chart: {
          type: 'chart',
          chartType: 'bar',
          params: {
            xField: 'region',
            yFields: ['total_amount'],
          },
        },
      },
    },
  })
}

function successPayload(titleText) {
  return {
    status: 0,
    data: {
      chartType: 'bar',
      option: {
        title: { text: titleText },
        series: [{ type: 'bar', data: [128] }],
      },
    },
  }
}

test('chart runtime calls chart execute API by chartName', async () => {
  const fetcher = vi.fn().mockResolvedValue(successPayload('real preview'))
  const runtime = createRuntime(fetcher)

  await runtime.loadChart()

  expect(fetcher).toHaveBeenCalledWith(
    {
      method: 'post',
      url: '/api/runtime/statistics-reporting/charts/demo.sales-metric/execute',
      data: {},
    },
    {}
  )
  expect(runtime.state.schema.config.title.text).toBe('real preview')
})

test('chart runtime passes an empty backend option to the chart renderer', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    status: 0,
    data: {
      chartType: 'bar',
      option: {},
    },
  })
  const runtime = createRuntime(fetcher)

  await runtime.loadChart()

  expect(runtime.state.schema).toEqual({ type: 'chart', config: {} })
})

test('chart runtime shows unauthorized state without blanking widget', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    status: 403,
    msg: '没有权限访问该图表',
  })
  const runtime = createRuntime(fetcher)

  await runtime.loadChart()

  expect(runtime.state.schema).toMatchObject({
    type: 'alert',
    level: 'warning',
    body: '没有权限访问该图表',
  })
})

test('chart runtime uses Chinese messages for missing charts and fallback failures', async () => {
  const fetcher = vi.fn()
  const missing = createRuntime(fetcher, { chartName: undefined })
  await missing.loadChart()
  expect(missing.state.schema.body).toBe('尚未选择图表')
  expect(fetcher).not.toHaveBeenCalled()

  fetcher.mockResolvedValueOnce({ status: 403 })
  const unauthorized = createRuntime(fetcher)
  await unauthorized.loadChart()
  expect(unauthorized.state.schema.body).toBe('无权限预览当前图表')

  fetcher.mockResolvedValueOnce({ status: 500 })
  const failed = createRuntime(fetcher)
  await failed.loadChart()
  expect(failed.state.schema.body).toBe('图表加载失败')
})

test('chart runtime shows error state without blanking widget', async () => {
  const fetcher = vi.fn().mockResolvedValue({ status: 500, msg: '执行失败' })
  const runtime = createRuntime(fetcher)

  await runtime.loadChart()

  expect(runtime.state.schema).toMatchObject({
    type: 'alert',
    level: 'danger',
    body: '执行失败',
  })
})

test('chart runtime discards stale successful responses after a newer preview request', async () => {
  const firstRequest = deferred()
  const secondRequest = deferred()
  const fetcher = vi
    .fn()
    .mockReturnValueOnce(firstRequest.promise)
    .mockReturnValueOnce(secondRequest.promise)
  const runtime = createPreviewRuntime(fetcher)

  const oldLoad = runtime.loadChart()
  runtime.props = {
    ...runtime.props,
    api: {
      ...runtime.props.api,
      data: {
        chart: {
          type: 'chart',
          chartType: 'bar',
          params: {
            xField: 'channel',
            yFields: ['total_amount'],
          },
        },
      },
    },
  }
  const newLoad = runtime.loadChart()

  secondRequest.resolve(successPayload('new preview'))
  await newLoad
  expect(runtime.state.schema.config.title.text).toBe('new preview')

  firstRequest.resolve(successPayload('old preview'))
  await oldLoad
  expect(runtime.state.schema.config.title.text).toBe('new preview')
})

test('chart runtime discards stale errors after a newer preview request', async () => {
  const firstRequest = deferred()
  const secondRequest = deferred()
  const fetcher = vi
    .fn()
    .mockReturnValueOnce(firstRequest.promise)
    .mockReturnValueOnce(secondRequest.promise)
  const runtime = createPreviewRuntime(fetcher)

  const oldLoad = runtime.loadChart()
  runtime.props = {
    ...runtime.props,
    api: {
      ...runtime.props.api,
      data: {
        chart: {
          type: 'chart',
          chartType: 'bar',
          params: {
            xField: 'channel',
            yFields: ['total_amount'],
          },
        },
      },
    },
  }
  const newLoad = runtime.loadChart()

  secondRequest.resolve(successPayload('current preview'))
  await newLoad
  expect(runtime.state.schema.config.title.text).toBe('current preview')

  firstRequest.reject(new Error('old preview failed'))
  await oldLoad
  expect(runtime.state.schema.config.title.text).toBe('current preview')
})


test('a failed widget retries independently and succeeds without remounting', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ status: 500, msg: 'failed' })
    .mockResolvedValueOnce(successPayload('retried'))
  const runtime = createRuntime(fetcher)
  await runtime.loadChart()
  expect(runtime.state.schema.type).toBe('alert')
  await runtime.retry()
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(runtime.state.schema.config.title.text).toBe('retried')
})

test('a stale retry of the same chart cannot overwrite a later successful retry', async () => {
  const first = deferred()
  const second = deferred()
  const runtime = createRuntime(vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise))
  const oldLoad = runtime.loadChart()
  const newLoad = runtime.retry()
  second.resolve(successPayload('latest'))
  await newLoad
  first.resolve({ status: 500, msg: 'old failure' })
  await oldLoad
  expect(runtime.state.schema.config.title.text).toBe('latest')
})
