/* @vitest-environment jsdom */

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

vi.mock('@/common/api/amis', () => ({ default: vi.fn() }))
vi.mock('@/router/routerFacade', () => ({
  readCurrentRoute: () => ({ fullPath: '/example', meta: { schemaId: '/example' } }),
}))
vi.mock('@/store/storeFacade', () => ({
  store: {
    getters: {
      activeTabId: 'example',
      tabsList: [{ id: 'example', fullPath: '/example' }],
      'app/amisComponentsRegistered': true,
    },
  },
}))
vi.mock('@/layouts/useHostSnapshot', () => ({ useHostSnapshot: () => {} }))
vi.mock('@/common/i18n', async () => {
  const { I18nManager } = await import('@/common/i18n/I18nManager')
  const { EventBus } = await import('@/common/eventBus')
  const manager = new I18nManager(EventBus)
  return { i18nService: { getManager: () => manager }, i18nManager: manager }
})
vi.mock('@/components/amis/AmisComponent', () => ({
  default: ({ amisSchema }) => React.createElement('p', null, amisSchema.title),
}))

const { default: getSchema } = await import('@/common/api/amis')
const { i18nManager } = await import('@/common/i18n')
const { default: createAmisPage } = await import('@/components/amis/AmisPage')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let container
let root

function setTitle(locale, title) {
  i18nManager.setLocale({ locale, messages: { '/example': { 'page.title': title } } })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  getSchema.mockReset().mockResolvedValue({ type: 'page', title: '原始标题' })
  setTitle('zh-CN', '中文标题')
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

test('an already loaded page translates again on repeated language changes', async () => {
  const Page = createAmisPage('/example')
  await act(async () => root.render(React.createElement(Page)))
  expect(container.textContent).toBe('中文标题')

  for (const [locale, title] of [
    ['en-US', 'English title'],
    ['zh-CN', '中文标题'],
    ['en-US', 'Updated title'],
  ]) {
    await act(async () => setTitle(locale, title))
    expect(container.textContent).toBe(title)
  }
  expect(getSchema).toHaveBeenCalledTimes(1)
})

test('new messages for the current language refresh a loaded schema', async () => {
  const Page = createAmisPage('/example')
  await act(async () => root.render(React.createElement(Page)))
  await act(async () => setTitle('zh-CN', '更新后的标题'))
  expect(container.textContent).toBe('更新后的标题')
})

test('a remounted page uses the latest language and continues receiving changes', async () => {
  const Page = createAmisPage('/example')
  await act(async () => root.render(React.createElement(Page)))
  await act(async () => root.render(null))
  await act(async () => setTitle('en-US', 'Changed while closed'))
  await act(async () => root.render(React.createElement(Page)))
  expect(container.textContent).toBe('Changed while closed')
  await act(async () => setTitle('zh-CN', '重新打开后切换'))
  expect(container.textContent).toBe('重新打开后切换')
})
