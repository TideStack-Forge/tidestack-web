import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { JSDOM } from 'jsdom'

vi.mock('@/store/storeFacade', () => ({
  dispatch: vi.fn(),
  readGetters: () => ({ 'user/menu': { globalMenu: [], globalSubNav: [] } }),
  subscribeState: vi.fn(() => () => {}),
}))

const { MenuBadge } = await import('@/layouts/menu/MenuBadge.tsx')

let dom
let root
let container

async function renderBadge(badge) {
  await act(async () => {
    root.render(React.createElement(MenuBadge, { badge }))
    await Promise.resolve()
  })
}

beforeEach(() => {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })
  container = dom.window.document.getElementById('root')

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: dom.window,
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: dom.window.document,
  })
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    writable: true,
    value: true,
  })

  root = createRoot(container)
})

afterEach(async () => {
  if (root) {
    await act(async () => {
      root.unmount()
    })
  }
  delete globalThis.window
  delete globalThis.document
  delete globalThis.IS_REACT_ACT_ENVIRONMENT
  dom?.window.close()
})

test('无徽标时不渲染', async () => {
  await renderBadge(undefined)
  expect(container.querySelector('.menu-badge')).toBeNull()
})

test('dot 形态渲染红点且带缺省 danger 语义类', async () => {
  await renderBadge({ type: 'dot' })
  const badge = container.querySelector('.menu-badge--dot')
  expect(badge).not.toBeNull()
  expect(badge.className).toContain('menu-badge--tone-danger')
})

test('dot 支持自定义颜色（内联 CSS 变量，不带 tone 类）', async () => {
  await renderBadge({ type: 'dot', color: '#00b3ff' })
  const badge = container.querySelector('.menu-badge--dot')
  expect(badge.style.getPropertyValue('--menu-badge-color')).toBe('#00b3ff')
  expect(badge.className).not.toContain('menu-badge--tone-')
})

test('number 形态渲染数字，max 溢出显示 99+', async () => {
  await renderBadge({ type: 'number', value: 3 })
  expect(container.querySelector('.menu-badge--number').textContent).toBe('3')

  await renderBadge({ type: 'number', value: 120 })
  expect(container.querySelector('.menu-badge--number').textContent).toBe('99+')

  await renderBadge({ type: 'number', value: 120, max: 50 })
  expect(container.querySelector('.menu-badge--number').textContent).toBe('50+')
})

test('number 为 0 且未开 showZero 时不渲染', async () => {
  await renderBadge({ type: 'number', value: 0 })
  expect(container.querySelector('.menu-badge')).toBeNull()

  await renderBadge({ type: 'number', value: 0, showZero: true })
  expect(container.querySelector('.menu-badge--number').textContent).toBe('0')
})

test('text 形态渲染短文本', async () => {
  await renderBadge({ type: 'text', text: 'NEW', tone: 'warning' })
  const badge = container.querySelector('.menu-badge--text')
  expect(badge.textContent).toBe('NEW')
  expect(badge.className).toContain('menu-badge--tone-warning')
})

test('ribbon 形态渲染缎带角标，支持位置与语义色', async () => {
  await renderBadge({ type: 'ribbon', text: 'HOT', tone: 'success' })
  const ribbon = container.querySelector('.menu-badge--ribbon')
  expect(ribbon.textContent).toBe('HOT')
  expect(ribbon.className).toContain('menu-badge--tone-success')
  expect(ribbon.className).not.toContain('menu-badge--ribbon-left')

  await renderBadge({ type: 'ribbon', text: 'NEW', position: 'top-left' })
  expect(container.querySelector('.menu-badge--ribbon-left')).not.toBeNull()
})
