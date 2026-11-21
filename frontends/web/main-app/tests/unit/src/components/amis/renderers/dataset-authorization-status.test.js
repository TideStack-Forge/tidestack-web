import React from 'react'
import { beforeEach, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const client = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('amis', () => ({
  Renderer: () => target => target,
  Button: ({ children, onClick }) => React.createElement('button', { onClick }, children),
}))
vi.mock('#ouroboros-host/utils/http', () => ({ Client: client }))

const { default: AuthorizationStatus } = await import(
  '../../../../../../src/components/amis/renderers/dataset-access/DatasetAuthorizationStatus.tsx'
)

function status(datasetName = 'demo.sales') {
  const instance = new AuthorizationStatus({ datasetName })
  instance.setState = patch => { instance.state = { ...instance.state, ...patch } }
  return instance
}

beforeEach(() => client.get.mockReset())

test('reads existing authorities and compares dataset grants without case sensitivity', async () => {
  client.get.mockResolvedValue({ data: { code: 0, data: {
    'statisticsReporting.runtime.dataset.DEMO.SALES.execute': {},
  } } })
  const instance = status()
  expect(renderToStaticMarkup(instance.render())).toContain('读取中')
  await instance.load()
  expect(client.get).toHaveBeenCalledWith('/api/auth/authorities', {}, { isSilent: true })
  const html = renderToStaticMarkup(instance.render())
  expect(html).toContain('已授权')
  expect(html).toContain('未授权')
  expect(html).toContain('statisticsReporting.runtime.dataset.demo.sales.export')
})

test('shows API and transport errors and recovers when retried', async () => {
  client.get.mockResolvedValueOnce({ data: { code: 1, msg: '无权读取授权' } })
    .mockRejectedValueOnce(new Error('连接失败'))
    .mockResolvedValueOnce({ data: { code: 0, data: {} } })
  const instance = status()
  await instance.load()
  expect(renderToStaticMarkup(instance.render())).toContain('无权读取授权')
  expect(renderToStaticMarkup(instance.render())).toContain('重试')
  expect(renderToStaticMarkup(instance.render())).toContain('未读取')
  await instance.load()
  expect(renderToStaticMarkup(instance.render())).toContain('连接失败')
  await instance.load()
  expect(instance.state.error).toBe('')
  expect(renderToStaticMarkup(instance.render())).toContain('未授权')
})

test('ignores stale responses after changing datasets or unmounting', async () => {
  let resolveFirst
  client.get.mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve }))
    .mockResolvedValueOnce({ data: { code: 0, data: {} } })
  const instance = status()
  const first = instance.load()
  const previous = instance.props
  instance.props = { datasetName: 'demo.inventory' }
  instance.componentDidUpdate(previous)
  await Promise.resolve()
  resolveFirst({ data: { code: 0, data: { 'statisticsReporting.runtime.dataset.demo.inventory.execute': {} } } })
  await first
  expect(renderToStaticMarkup(instance.render())).not.toContain('已授权')
  let rejectLate
  client.get.mockReturnValueOnce(new Promise((resolve, reject) => { rejectLate = reject }))
  const late = instance.load()
  instance.componentWillUnmount()
  const snapshot = instance.state
  rejectLate(new Error('晚到的错误'))
  await late
  expect(instance.state).toBe(snapshot)
})
