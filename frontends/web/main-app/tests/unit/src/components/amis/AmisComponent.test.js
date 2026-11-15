import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, test, vi } from 'vitest'

import { I18nManager } from '../../../../../src/common/i18n/I18nManager.ts'

const mocks = vi.hoisted(() => ({
  render: vi.fn(() => null),
  confirm: vi.fn(async () => true),
  alert: vi.fn(),
  manager: null,
}))

vi.mock('amis', () => ({
  render: mocks.render,
  confirm: mocks.confirm,
  alert: mocks.alert,
  ToastComponent: () => null,
  AlertComponent: () => null,
  extractObjectChain: () => [],
  createObjectFromChain: (chain) => Object.assign({}, ...chain),
}))

vi.mock('@/common/i18n', () => ({
  i18nService: { getManager: () => mocks.manager },
}))
vi.mock('@/store/storeFacade', () => ({
  store: { state: { app: {}, user: {} }, getters: {} },
}))
vi.mock('@/layouts/useHostSnapshot', () => ({ useHostSnapshot: vi.fn() }))
vi.mock('@/router/routerFacade', () => ({ pushLocation: vi.fn() }))
vi.mock('@/utils/http', () => ({ Client: {} }))
vi.mock('@/utils/toast', () => ({ default: {} }))
vi.mock('../../../../../src/components/amis/runtimePreset', () => ({}))

const AmisComponent = (
  await import('../../../../../src/components/amis/AmisComponent.tsx')
).default

function renderEnvironment() {
  renderToStaticMarkup(
    React.createElement(AmisComponent, { amisSchema: { type: 'page' } })
  )
  return mocks.render.mock.calls.at(-1)[2]
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.manager = new I18nManager({ publish: vi.fn() })
  mocks.manager.setLocale({
    locale: 'id-ID',
    messages: {
      common: { systemTip: 'Pemberitahuan', confirm: 'Konfirmasi', cancel: 'Batal' },
    },
  })
})

test('uses the active common translations when AMIS requests confirmation with only a message', async () => {
  const env = renderEnvironment()

  await expect(env.confirm('Hapus data ini?')).resolves.toBe(true)

  expect(mocks.confirm).toHaveBeenCalledWith(
    'Hapus data ini?',
    'Pemberitahuan',
    {
      confirmText: 'Konfirmasi',
      cancelText: 'Batal',
      confirmBtnLevel: 'primary',
      cancelBtnLevel: 'default',
    },
    'Batal'
  )
})

test.each([
  ['en-US', { systemTip: 'System notice', confirm: 'Confirm', cancel: 'Cancel' }],
  ['ar-SA', { systemTip: 'إشعار', confirm: 'تأكيد', cancel: 'إلغاء' }],
  ['zh-CN', {}],
])('resolves confirmation defaults at call time for %s', async (locale, common) => {
  const env = renderEnvironment()
  mocks.manager.setLocale({ locale, messages: { common } })

  await env.confirm('message', '')

  expect(mocks.confirm).toHaveBeenCalledWith(
    'message',
    common.systemTip || '系统提示',
    {
      confirmText: common.confirm || '确定',
      cancelText: common.cancel || '取消',
      confirmBtnLevel: 'primary',
      cancelBtnLevel: 'default',
    },
    common.cancel || '取消'
  )
})

test('preserves caller-supplied title and button labels', async () => {
  await renderEnvironment().confirm('message', 'Custom title', 'Delete', 'Keep')

  expect(mocks.confirm).toHaveBeenCalledWith(
    'message',
    'Custom title',
    {
      confirmText: 'Delete',
      cancelText: 'Keep',
      confirmBtnLevel: 'primary',
      cancelBtnLevel: 'default',
    },
    'Keep'
  )
})

test('fills omitted option labels without changing the caller options', async () => {
  const options = Object.freeze({
    confirmText: 'Delete',
    confirmBtnLevel: 'danger',
    size: 'lg',
  })
  mocks.confirm.mockResolvedValueOnce(false)

  await expect(
    renderEnvironment().confirm('message', 'Custom title', options)
  ).resolves.toBe(false)

  expect(mocks.confirm).toHaveBeenCalledWith(
    'message',
    'Custom title',
    {
      ...options,
      cancelText: 'Batal',
      cancelBtnLevel: 'default',
    },
    'Batal'
  )
})

test('uses translated defaults when AMIS supplies undefined button options', async () => {
  await renderEnvironment().confirm('message', undefined, {
    confirmText: undefined,
    cancelText: undefined,
  })

  expect(mocks.confirm).toHaveBeenCalledWith(
    'message',
    'Pemberitahuan',
    {
      confirmText: 'Konfirmasi',
      cancelText: 'Batal',
      confirmBtnLevel: 'primary',
      cancelBtnLevel: 'default',
    },
    'Batal'
  )
})

test('translates runtime dialog schemas through the same development namespace and preserves form values', async () => {
  const { pushModalMethods, popModalMethods, init, openDialog } =
    await import('@/common/modal')
  const actions = []
  init({ doAction: vi.fn() })
  await new Promise((resolve) => setTimeout(resolve, 5))
  pushModalMethods((action) => actions.push(action))
  const schema = {
    localeNamespace: 'logicflow-editor',
    title: '删除端口',
    body: { type: 'input-text', name: 'name', label: '名称', value: '名称' },
  }
  mocks.manager.setLocale({
    locale: 'en-US',
    messages: { 'logicflow-editor': { 删除端口: 'Delete ports', 名称: 'Name' } },
  })
  try {
    const result = openDialog(schema)
    await Promise.resolve()
    const dialog = actions[0].dialog
    expect(dialog.title).toBe('Delete ports')
    expect(dialog.body).toMatchObject({ label: 'Name', value: '名称' })
    expect(schema.body.label).toBe('名称')
    dialog.onConfirm([{ name: 'Custom node' }])
    await expect(result).resolves.toEqual([{ name: 'Custom node' }])
  } finally {
    popModalMethods()
  }
})
