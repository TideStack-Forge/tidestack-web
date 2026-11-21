// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
const host = vi.hoisted(() => ({ get: vi.fn(), openMenu: vi.fn(), openTab: vi.fn() }))
vi.mock('#ouroboros-host/utils/http', () => ({ Client: { get: host.get } }))
vi.mock('#ouroboros-host/common/menus', () => ({ openMenuItem: host.openMenu }))
vi.mock('#ouroboros-host/common/tabs', () => ({
  default: { openOrSwitchTab: host.openTab },
}))
vi.mock('amis', () => ({
  Renderer: () => (component) => component,
  Icon: ({ icon, className = '' }) =>
    React.createElement('span', {
      className,
      'data-icon': typeof icon === 'string' ? icon : icon.id,
    }),
}))
import { DevAppKanban } from 'ouroboros-amis-runtime/renderers/DevAppDashboard'
import {
  boardNodes,
  capabilityRelations,
  circuitCoordinates,
  dashboardCatalog,
} from 'ouroboros-amis-runtime/renderers/dev-app-dashboard'
import { resolveVariableAndFilter } from 'amis-core'
import businessModelPage from '../../../../../../../../../core/ouroboros-business-model/ouroboros-business-model-dev/src/main/metadata/dev/{appName}/business-model.ui-schema.json'

const menus = [
  { fullName: 'AppDevDashboard', title: '应用开发看板', url: '/dev/demo/dashboard' },
  {
    fullName: 'businessModelManagement',
    title: '业务模型',
    icon: 'icon-business-model',
    url: '/dev/demo/business-model',
  },
  {
    fullName: 'UIDesign',
    title: '界面设计',
    icon: 'fas fa-palette',
    children: [
      {
        fullName: 'UIDesign.UIManagement',
        title: '前端页面',
        url: '/dev/demo/ui',
        children: [
          {
            fullName: 'UIDesign.UIManagement.Schema',
            title: 'UI Schema',
            icon: 'icon-ui-schema',
            url: '/dev/demo/ui-schema',
            showMode: 'newWindow',
          },
        ],
      },
    ],
  },
  {
    fullName: 'BusinessLogic',
    title: '业务逻辑',
    icon: 'fas fa-cogs',
    children: [
      {
        fullName: 'BusinessLogic.Logic',
        title: '逻辑流',
        icon: 'icon-logic-flow',
        url: '/dev/demo/logicflow-model',
      },
    ],
  },
]
function installApi() {
  host.get.mockImplementation(async (url) => ({
    data: {
      code: 0,
      data: url.endsWith('dev-workspace-menu')
        ? { main: menus }
        : url.includes('recent-change-log')
          ? { items: [{ message: '更新订单关系', authorName: '陈工' }] }
          : { name: 'demo', title: '供应链管理' },
    },
  }))
}
let container, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  installApi()
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})
async function mount() {
  await act(async () =>
    root.render(
      React.createElement(DevAppKanban, {
        data: { appName: 'demo', canManageEditAccess: true },
        render: () => React.createElement('button', null, '编辑权限'),
      })
    )
  )
}
async function click(element) {
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}
const button = (text) =>
  [...container.querySelectorAll('button')].find(
    (item) => item.textContent.trim() === text
  )

test('the business-model page resolves its visual entry to a numeric tab key', () => {
  const tabs = businessModelPage.schema.body[0]
  expect(resolveVariableAndFilter(tabs.activeKey, { view: 'visual-modeling' })).toBe(1)
  expect(resolveVariableAndFilter(tabs.activeKey, {})).toBe(0)
})

test('catalog retains official nested menus, names and navigation metadata', () => {
  const catalog = dashboardCatalog(menus)
  expect(catalog.standalone.map((entry) => entry.menu.title)).toEqual(['业务模型'])
  expect(catalog.groups[0].entries[1]).toEqual({
    menu: menus[2].children[0].children[0],
    breadcrumb: ['界面设计', '前端页面', 'UI Schema'],
  })
})

test('printed routes preserve terminal positions and 45 degree bends as the board resizes', () => {
  for (const width of [800, 860, 1000])
    for (const edge of capabilityRelations) {
      const points = circuitCoordinates(edge.points, width / 860)
      const source = boardNodes.find((node) => node.id === edge.from)
      const target = boardNodes.find((node) => node.id === edge.to)
      for (const [point, node] of [
        [points[0], source],
        [points.at(-1), target],
      ]) {
        expect(point[0]).toBeGreaterThanOrEqual((node.x * width) / 860 - 0.001)
        expect(point[0]).toBeLessThanOrEqual(
          ((node.x + node.width) * width) / 860 + 0.001
        )
        expect(point[1]).toBeGreaterThanOrEqual(node.y)
        expect(point[1]).toBeLessThanOrEqual(node.y + node.height)
      }
      for (let index = 1; index < points.length; index++) {
        const dx = Math.abs(points[index][0] - points[index - 1][0]),
          dy = Math.abs(points[index][1] - points[index - 1][1])
        if (dx > 0 && dy > 0) expect(dx).toBeCloseTo(dy, 6)
      }
    }
})

test('renders all six business elements and preserves traces when motion stops', async () => {
  await mount()
  expect(container.querySelectorAll('.board-node')).toHaveLength(16)
  expect(container.querySelectorAll('.board-trace')).toHaveLength(15)
  expect(container.querySelector('.board-node--business').textContent).toContain(
    '属性 · 关系 · 视图\n动作 · 事件 · 访问权限'
  )
  expect(container.querySelector('[marker-end]')).toBeNull()
  await click(container.querySelector('[role="switch"]'))
  expect(container.querySelector('[role="switch"]').getAttribute('aria-checked')).toBe(
    'false'
  )
  expect(container.querySelectorAll('.board-trace')).toHaveLength(15)
  expect(container.querySelectorAll('animateMotion')).toHaveLength(0)
  await click(
    [...container.querySelectorAll('.board-net')].find((item) =>
      item.getAttribute('aria-label').includes('计划任务 → 逻辑流')
    )
  )
  expect(container.querySelector('.dashboard-context').textContent).toContain(
    '计划任务触发逻辑流'
  )
  await click(button('查看目标'))
  expect(container.querySelector('.dashboard-context h2').textContent).toBe('逻辑流')
})

test('matrix follows official menus and opens entries with their original navigation mode', async () => {
  await mount()
  await click(button('功能矩阵'))
  expect(container.querySelector('.dashboard-board').hidden).toBe(true)
  expect(container.querySelector('.dashboard-matrix').hidden).toBe(false)
  expect(
    [...container.querySelectorAll('.matrix-group h3')].map((item) => item.textContent)
  ).toEqual(['界面设计', '业务逻辑'])
  const entry = button('UI Schema')
  expect(entry.title).toBe('界面设计 / 前端页面 / UI Schema')
  expect(entry.querySelector('[data-icon]').dataset.icon).toBe('svg-icon-ui-schema')
  await click(entry)
  expect(host.openMenu).toHaveBeenCalledWith(menus[2].children[0].children[0])
})

test('visual modeling opens the selected model tab and retains administration entries', async () => {
  await mount()
  await click(button('可视化建模'))
  expect(host.openMenu).toHaveBeenCalledWith(
    expect.objectContaining({
      url: '/dev/demo/business-model?view=visual-modeling',
      icon: 'icon-business-model',
    })
  )
  await click(button('应用配置'))
  expect(host.openTab).toHaveBeenCalledWith('/dev/demo/app-setting')
  expect(button('编辑权限')).toBeTruthy()
  expect(button('最近提交更新订单关系').title).toContain('陈工')
})

test('reduced motion hides particles and missing application capabilities cannot navigate', async () => {
  window.matchMedia.mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  await mount()
  expect(container.querySelector('[role="switch"]').disabled).toBe(true)
  expect(container.querySelectorAll('animateMotion')).toHaveLength(0)
  await click(
    [...container.querySelectorAll('.board-node')].find(
      (item) => item.textContent === '计划任务'
    )
  )
  expect(button('打开计划任务').disabled).toBe(true)
})

test('failed loading is visible and retry restores the current application', async () => {
  host.get.mockRejectedValue(new Error('菜单读取失败'))
  await mount()
  expect(container.querySelector('[role="alert"]').textContent).toContain('菜单读取失败')
  installApi()
  await click(button('重新加载'))
  expect(container.querySelector('[role="alert"]')).toBeNull()
  expect(container.querySelector('h1').textContent).toBe('供应链管理')
})

test('search includes business elements, empty results recover and tabs support keyboard navigation', async () => {
  await mount()
  const input = container.querySelector('input')
  await act(async () => Simulate.change(input, { target: { value: '访问权限' } }))
  expect(container.querySelectorAll('.board-node:not(.is-filtered)')).toHaveLength(1)
  expect(container.querySelector('.board-node:not(.is-filtered)').textContent).toContain(
    '业务模型'
  )
  await act(async () => Simulate.change(input, { target: { value: '没有这个功能' } }))
  expect(container.querySelector('.board-empty').textContent).toBe('没有匹配的开发能力')
  await click(button('清空'))
  expect(container.querySelector('.board-empty')).toBeNull()
  const tab = [...container.querySelectorAll('[role="tab"]')][0]
  await act(async () =>
    tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  )
  expect(container.querySelector('[role="tab"][aria-selected="true"]').textContent).toBe(
    '功能矩阵'
  )
  await act(async () => Simulate.change(input, { target: { value: '界面设计' } }))
  expect(
    [...container.querySelectorAll('.matrix-entry')].map((item) => item.textContent)
  ).toEqual(['前端页面', 'UI Schema'])
})
