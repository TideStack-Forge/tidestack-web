import { expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('amis', () => ({ FormItem: () => (component) => component }))
import { BusinessModelFormatUpgrade } from 'ouroboros-amis-runtime/renderers/BusinessModelFormatUpgrade'

const draft = () => ({
  modelType: 'default',
  namespace: 'sales',
  name: 'Order',
  title: '订单',
  future: { keep: true },
})
const upgraded = () => ({
  ...draft(),
  formatVersion: '2.0',
  actions: [{ name: 'approve' }],
})
function preview(requestId = '1') {
  return {
    ok: true,
    data: {
      requestId,
      planFingerprint: 'complete-resource-plan',
      upgradedModel: upgraded(),
      resources: [
        {
          path: 'business-model/sales.Order.business.json',
          operation: 'update',
          encoding: 'utf-8',
          before: JSON.stringify(draft()),
          after: JSON.stringify(upgraded()),
        },
      ],
    },
  }
}
function control(fetcher, overrides = {}) {
  const instance = new BusinessModelFormatUpgrade({
    appName: 'demo',
    data: draft(),
    env: { fetcher },
    onChange: vi.fn(),
    classnames: (...classes) => classes.join(' '),
    onAction: vi.fn().mockResolvedValue(true),
    ...overrides,
  })
  instance.setState = (patch) => {
    instance.state = { ...instance.state, ...patch }
  }
  return instance
}
function form() {
  const store = {
    data: draft(),
    updateData: vi.fn((value) => {
      store.data = { ...store.data, ...value }
    }),
  }
  return store
}
function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const html = (instance) => renderToStaticMarkup(instance.render())

test('preview sends the complete legacy draft and cancellation never writes or converts it', async () => {
  const fetcher = vi.fn().mockResolvedValue(preview())
  const store = form(),
    instance = control(fetcher, { formStore: store })
  await instance.loadPreview()
  expect(fetcher.mock.calls[0][0]).toEqual({
    method: 'post',
    url: '/api/dev/demo/business-model/sales.Order/format-upgrade-preview?requestId=1',
    data: draft(),
  })
  expect(html(instance)).toContain('完整升级差异')
  expect(html(instance)).toContain('确认升级并提交')
  instance.cancel()
  expect(store.data).toEqual(draft())
  expect(store.updateData).not.toHaveBeenCalled()
  expect(instance.props.onChange).not.toHaveBeenCalled()
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(instance.state.preview).toBeNull()
})

test('an edited draft or invalid editor cannot apply an earlier preview', async () => {
  const fetcher = vi.fn().mockResolvedValue(preview())
  const store = form(),
    instance = control(fetcher, { formStore: store })
  await instance.loadPreview()
  store.data.title = 'new draft'
  expect(html(instance)).toContain('升级预览已过期')
  await instance.apply()
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(html(instance)).toContain('重新预览完整差异')
  instance.props.onAction.mockResolvedValue(false)
  await instance.apply()
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(html(instance)).toContain('表单存在无效输入')
})

test('explicit application sends the preview fingerprint and syncs only the saved model', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(preview())
    .mockResolvedValueOnce({
      ok: true,
      data: { businessModel: upgraded(), validationSnapshot: { validationErrors: [] } },
    })
  const store = form(),
    instance = control(fetcher, { formStore: store })
  await instance.loadPreview()
  await instance.apply()
  expect(fetcher.mock.calls[1][0]).toEqual({
    method: 'post',
    url: '/api/dev/demo/business-model/sales.Order/format-upgrade?planFingerprint=complete-resource-plan',
    data: draft(),
  })
  expect(store.updateData).toHaveBeenCalledWith(upgraded())
  expect(store.data).not.toHaveProperty('planFingerprint')
  expect(store.data).not.toHaveProperty('validationSnapshot')
  expect(instance.state.preview).toBeNull()
  expect(html(instance)).toContain('已升级至 2.0 并提交')
})

test('backend failure retains the original version, scripts and reviewable difference', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(preview())
    .mockResolvedValueOnce({ ok: false, msg: '升级预览已过期' })
  const store = form(),
    instance = control(fetcher, { formStore: store })
  await instance.loadPreview()
  await instance.apply()
  expect(store.data).toEqual(draft())
  expect(store.updateData).not.toHaveBeenCalled()
  expect(html(instance)).toContain('升级预览已过期')
  expect(instance.state.preview).not.toBeNull()
})

test('new edits during submission are preserved when the older draft has already committed', async () => {
  const pending = deferred()
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(preview())
    .mockReturnValueOnce(pending.promise)
  const store = form(),
    instance = control(fetcher, { formStore: store })
  await instance.loadPreview()
  const applying = instance.apply()
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  store.data.title = 'edit during submit'
  pending.resolve({ ok: true, data: { businessModel: upgraded() } })
  await applying
  expect(store.updateData).not.toHaveBeenCalled()
  expect(store.data.title).toBe('edit during submit')
  expect(html(instance)).toContain('请保留草稿后重新加载模型')
})

test('cancelled or unmounted previews cannot reappear after their response arrives', async () => {
  for (const stop of ['cancel', 'componentWillUnmount']) {
    const pending = deferred(),
      instance = control(vi.fn().mockReturnValue(pending.promise))
    const loading = instance.loadPreview()
    await vi.waitFor(() => expect(instance.props.env.fetcher).toHaveBeenCalledTimes(1))
    instance[stop]()
    pending.resolve(preview())
    await loading
    expect(instance.state.preview).toBeNull()
  }
})

test('invalid JSON input stops before previewing the stale last valid form value', async () => {
  const fetcher = vi.fn(),
    instance = control(fetcher, {
      formStore: form(),
      onAction: vi.fn().mockResolvedValue(false),
    })
  await instance.loadPreview()
  expect(fetcher).not.toHaveBeenCalled()
  expect(html(instance)).toContain('表单存在无效输入')
})

test('unknown versions do not offer conversion and read-only editors cannot confirm', async () => {
  const instance = control(vi.fn(), { data: { ...draft(), formatVersion: null } })
  expect(html(instance)).toContain('无法识别当前格式版本')
  expect(html(instance)).not.toContain('预览升级至 2.0')
  const readOnly = control(vi.fn().mockResolvedValue(preview()), { readOnly: true })
  await readOnly.loadPreview()
  expect(html(readOnly)).toMatch(/disabled=""[^>]*>确认升级并提交/)
})
