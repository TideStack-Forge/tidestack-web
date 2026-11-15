// @vitest-environment jsdom
import React from 'react'
import { expect, test, vi } from 'vitest'

vi.mock('amis', () => ({
  ActionSchema: {},
  IScopedContext: {},
  IServiceStore: {},
  ModalStore: { name: 'ModalStore' },
  Renderer: () => (component) => component,
  isObjectShallowModified: vi.fn(() => false),
}))

vi.mock('amis/lib/renderers/Dialog', () => ({
  DialogRenderer: {
    ComposedComponent: class MockDialogRenderer extends React.Component {
      render() {
        return React.createElement(
          'mock-modal',
          {
            modalClassName: 'Modal-content',
            size: this.props.size,
            style: this.props.style,
          },
          React.createElement(
            'div',
            { className: 'Modal-header' },
            React.createElement('a', { className: 'Modal-close' }, 'close'),
            this.props.allowFullscreen
              ? React.createElement(
                  'a',
                  { className: 'Modal-close Modal-screen' },
                  'native'
                )
              : null,
            React.createElement('div', { className: 'Modal-title' }, 'title')
          ),
          React.createElement('div', { role: 'dialog-body' }, 'body')
        )
      }
    },
  },
}))

vi.mock('@/common/modal', () => ({
  popModalMethods: vi.fn(),
  pushModalMethods: vi.fn(),
}))

vi.mock('@/store/storeFacade', () => ({
  readGetters: vi.fn(() => ({ 'user/menu': { globalMenu: [], globalSubNav: [] } })),
  subscribeState: vi.fn(() => () => {}),
}))

const dialogModule =
  await import('../../../../../../src/components/amis/renderers/OuroborosDialog.tsx')
const OuroborosDialog = dialogModule.default

function flattenReactChildren(node) {
  const result = []

  function visit(value) {
    React.Children.forEach(value, (child) => {
      if (!React.isValidElement(child)) {
        return
      }

      result.push(child)
      visit(child.props.children)
    })
  }

  visit(node)
  return result
}

test('allowFullscreen renders as Ouroboros dialog header button instead of AMIS native screen button', () => {
  const store = {
    isFullscreen: false,
    schema: { allowFullscreen: true },
    setFullScreen: vi.fn(),
  }
  const dialog = new OuroborosDialog({ store }, {})

  const rendered = dialog.render()
  const children = flattenReactChildren(rendered.props.children)

  expect(
    children.find((child) => child.props.className === 'Modal-close Modal-screen')
  ).toBeUndefined()

  const fullscreenButton = children.find((child) =>
    child.props.className?.includes('OuroborosDialog-fullscreenButton')
  )

  expect(fullscreenButton).toBeDefined()
  expect(fullscreenButton.props['aria-label']).toBe('全屏')

  fullscreenButton.props.onClick({ preventDefault: vi.fn(), stopPropagation: vi.fn() })
  expect(store.setFullScreen).toHaveBeenCalledWith(true)
})

test('fullscreen header button reflects restore state from AMIS modal store', () => {
  const store = {
    isFullscreen: true,
    schema: { allowFullscreen: true },
    setFullScreen: vi.fn(),
  }
  const dialog = new OuroborosDialog({ store }, {})

  const rendered = dialog.render()
  const fullscreenButton = flattenReactChildren(rendered.props.children).find((child) =>
    child.props.className?.includes('OuroborosDialog-fullscreenButton')
  )

  expect(fullscreenButton.props['aria-label']).toBe('退出全屏')

  fullscreenButton.props.onClick({ preventDefault: vi.fn(), stopPropagation: vi.fn() })
  expect(store.setFullScreen).toHaveBeenCalledWith(false)
})

test('size switch renders limited size options directly without more dropdown button', () => {
  const store = {
    isFullscreen: false,
    schema: {
      sizeSwitchable: true,
      sizeOptions: ['sm', 'xl', 'full'],
    },
  }
  const dialog = new OuroborosDialog({ store }, {})

  const rendered = dialog.render()
  const children = flattenReactChildren(rendered.props.children)
  const sizeButtons = children.filter((child) =>
    child.props.className?.includes('OuroborosDialog-sizePresetButton')
  )
  const moreButton = children.find((child) =>
    child.props.className?.includes('OuroborosDialog-sizeMoreButton')
  )

  expect(sizeButtons).toHaveLength(3)
  expect(moreButton).toBeUndefined()
})

test('size switch renders the first three configured size options before more dropdown', () => {
  const store = {
    isFullscreen: false,
    schema: {
      sizeSwitchable: true,
      sizeOptions: ['md', 'lg', 'xl', 'full'],
    },
  }
  const dialog = new OuroborosDialog({ store }, {})

  const rendered = dialog.render()
  const children = flattenReactChildren(rendered.props.children)
  const sizeButtons = children.filter((child) =>
    child.props.className?.includes('OuroborosDialog-sizePresetButton')
  )
  const moreButton = children.find((child) =>
    child.props.className?.includes('OuroborosDialog-sizeMoreButton')
  )

  expect(sizeButtons.map((button) => button.props['aria-label'])).toEqual([
    '切换为中尺寸',
    '切换为大尺寸',
    '切换为超大尺寸',
  ])
  expect(moreButton).toBeDefined()
})

test('fullscreen mode hides the size switch group', () => {
  const store = {
    isFullscreen: true,
    schema: {
      sizeSwitchable: true,
      sizeOptions: ['md', 'lg', 'xl', 'full'],
      allowFullscreen: true,
    },
    setFullScreen: vi.fn(),
  }
  const dialog = new OuroborosDialog({ store }, {})

  const rendered = dialog.render()
  const children = flattenReactChildren(rendered.props.children)
  const sizeButtons = children.filter((child) =>
    child.props.className?.includes('OuroborosDialog-sizePresetButton')
  )
  const moreButton = children.find((child) =>
    child.props.className?.includes('OuroborosDialog-sizeMoreButton')
  )

  expect(sizeButtons).toHaveLength(0)
  expect(moreButton).toBeUndefined()
})
