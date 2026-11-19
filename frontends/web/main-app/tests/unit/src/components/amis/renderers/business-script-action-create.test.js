import React from 'react'
import { expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BusinessScriptActionCreate } from 'ouroboros-amis-runtime/renderers/BusinessScriptActionCreate'

function setup(fetcher) {
  const root = {
    data: {
      modelType: 'default',
      formatVersion: '2.0',
      namespace: 'sales',
      name: 'Order',
      future: 1,
      custom: [{ name: 'button', api: { implementationMode: 'ACTION' } }],
    },
    validate: vi.fn().mockResolvedValue(true),
    updateData: vi.fn(),
  }
  const instance = new BusinessScriptActionCreate({
    appName: 'example',
    functionName: 'button',
    modelForm: () => root,
    env: { fetcher },
    onChange: vi.fn(),
    classnames: (...names) => names.join(' '),
    render: () => React.createElement('span', null, 'script editor'),
  })
  instance.setState = (patch) => {
    instance.state = { ...instance.state, ...patch }
  }
  instance.setState({ open: true, actionName: 'calculate', script: 'return $input.data' })
  return { instance, root }
}
const previewResponse = (id = '1') => ({
  ok: true,
  data: {
    requestId: id,
    planFingerprint: 'plan',
    actionName: 'calculate',
    flowName: 'sales.Order.calculate',
    resources: [
      { path: 'model.json', before: 'old model', after: 'new model' },
      { path: 'flow.json', before: null, after: 'new flow' },
    ],
  },
})
const html = (instance) => renderToStaticMarkup(instance.render())

test('prepares the whole draft and explicit script without writing temporary options into metadata', async () => {
  const fetcher = vi.fn().mockResolvedValue(previewResponse())
  const { instance, root } = setup(fetcher)
  await instance.preview()
  expect(root.validate).toHaveBeenCalledOnce()
  expect(fetcher.mock.calls[0][0]).toMatchObject({
    url: '/api/dev/example/business-model/sales.Order/script-action-preview?requestId=1',
    data: {
      businessModel: root.data,
      functionName: 'button',
      actionName: 'calculate',
      scriptLanguage: 'javascript',
      script: 'return $input.data',
      readOnly: true,
    },
  })
  expect(root.data).not.toHaveProperty('script')
  expect(root.updateData).not.toHaveBeenCalled()
  expect(instance.props.onChange).not.toHaveBeenCalled()
  expect(html(instance)).toContain('flow.json')
  expect(html(instance)).toContain('$input.context.request')
})

test('cancellation and late preview results cannot create resources or overwrite the current preparation', async () => {
  let resolve
  const fetcher = vi.fn().mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const { instance, root } = setup(fetcher)
  const pending = instance.preview()
  await Promise.resolve()
  instance.cancel()
  resolve(previewResponse())
  await pending
  expect(instance.state.preview).toBeNull()
  await instance.apply()
  expect(fetcher).toHaveBeenCalledOnce()
  expect(root.updateData).not.toHaveBeenCalled()
})

test('changed drafts expire the preview and cannot submit the old plan', async () => {
  const fetcher = vi.fn().mockResolvedValue(previewResponse())
  const { instance, root } = setup(fetcher)
  await instance.preview()
  root.data = { ...root.data, title: 'new title' }
  expect(html(instance)).toContain('预览已过期')
  await instance.apply()
  expect(fetcher).toHaveBeenCalledOnce()
  expect(instance.state.error).toContain('重新预览')
})

test('only a successful complete resource commit updates the root through the official form store', async () => {
  const saved = {
    modelType: 'default',
    formatVersion: '2.0',
    namespace: 'sales',
    name: 'Order',
    actions: [{ name: 'calculate' }],
    custom: [{ name: 'button', api: { action: 'calculate' } }],
  }
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(previewResponse())
    .mockResolvedValueOnce({ ok: true, data: { businessModel: saved } })
  const { instance, root } = setup(fetcher)
  await instance.preview()
  await instance.apply()
  expect(fetcher.mock.calls[1][0].url).toBe(
    '/api/dev/example/business-model/sales.Order/script-action?planFingerprint=plan'
  )
  expect(root.updateData).toHaveBeenCalledWith(saved)
  expect(instance.props.onChange).not.toHaveBeenCalled()
  expect(instance.state.open).toBe(false)
})

test('a failed commit or invalid input preserves the original draft and pending action', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(previewResponse())
    .mockResolvedValueOnce({ ok: false, msg: 'commit rejected' })
  const { instance, root } = setup(fetcher)
  await instance.preview()
  await instance.apply()
  expect(instance.state.error).toBe('commit rejected')
  expect(root.updateData).not.toHaveBeenCalled()
  root.validate.mockResolvedValue(false)
  await instance.preview()
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(instance.state.error).toContain('无效输入')
})

test('a draft edited during resource commit is retained while the committed result is reported', async () => {
  let resolve
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(previewResponse())
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
  const { instance, root } = setup(fetcher)
  await instance.preview()
  const pending = instance.apply()
  await Promise.resolve()
  root.data = { ...root.data, title: 'edited while committing' }
  resolve({
    ok: true,
    data: { businessModel: { ...root.data, actions: [{ name: 'calculate' }] } },
  })
  await pending
  expect(root.updateData).not.toHaveBeenCalled()
  expect(instance.state.message).toContain('当前改动未被覆盖')
})
