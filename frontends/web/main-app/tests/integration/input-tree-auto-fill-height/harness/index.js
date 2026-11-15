import React from 'react'
import ReactDOM from 'react-dom'

import { renderAmisSchema } from '@/components/amis/AmisComponent'

window.React = React
window.ReactDOM = ReactDOM

const statusElement = document.getElementById('input-tree-auto-fill-height-status')

function buildOptions(prefix, count) {
  return Array.from({ length: count }, (_, index) => ({
    label: `${prefix} ${String(index + 1).padStart(3, '0')}`,
    value: `${prefix.toLowerCase().replaceAll(' ', '-')}-${index + 1}`,
  }))
}

function buildEditorValue(prefix, count) {
  return Array.from({ length: count }, (_, index) => ({
    title: `${prefix} ${String(index + 1).padStart(3, '0')}`,
    value: `${prefix.toLowerCase().replaceAll(' ', '-')}-${index + 1}`,
  }))
}

function buildTreeSchema({
  autoFillHeight,
  className,
  heightAuto,
  optionCount,
  optionPrefix,
  searchable = false,
  virtualThreshold,
}) {
  return {
    type: 'input-tree',
    id: className,
    name: `${className}-value`,
    className,
    treeContainerClassName: `${className}-container`,
    treeClassName: `${className}-tree`,
    label: false,
    autoFillHeight,
    heightAuto,
    searchable,
    virtualThreshold,
    wrapperCustomStyle: autoFillHeight
      ? {
          root: {
            height: '100%',
          },
        }
      : undefined,
    options: buildOptions(optionPrefix, optionCount),
  }
}

function buildTreeEditorSchema({
  autoFillHeight,
  className,
  nodeCount,
  nodePrefix,
  virtualThreshold,
}) {
  return {
    type: 'tree-editor',
    id: className,
    name: `${className}-value`,
    className,
    label: false,
    autoFillHeight,
    draggable: false,
    virtualThreshold,
    wrapperCustomStyle: autoFillHeight
      ? {
          root: {
            height: '100%',
          },
        }
      : undefined,
    value: buildEditorValue(nodePrefix, nodeCount),
  }
}

async function mountHarness() {
  statusElement.textContent = 'Rendering input tree harness...'

  await Promise.all([
    renderAmisSchema(
      document.getElementById('auto-fill-tree-root'),
      buildTreeSchema({
        autoFillHeight: true,
        className: 'auto-fill-tree-control',
        heightAuto: true,
        optionCount: 80,
        optionPrefix: 'Auto node',
        searchable: true,
      })
    ),
    renderAmisSchema(
      document.getElementById('virtual-tree-root'),
      buildTreeSchema({
        autoFillHeight: true,
        className: 'virtual-tree-control',
        optionCount: 160,
        optionPrefix: 'Virtual node',
        searchable: true,
        virtualThreshold: 20,
      })
    ),
    renderAmisSchema(
      document.getElementById('default-tree-root'),
      buildTreeSchema({
        className: 'default-tree-control',
        optionCount: 40,
        optionPrefix: 'Default node',
      })
    ),
    renderAmisSchema(
      document.getElementById('height-auto-tree-root'),
      buildTreeSchema({
        className: 'height-auto-tree-control',
        heightAuto: true,
        optionCount: 12,
        optionPrefix: 'Natural node',
      })
    ),
    renderAmisSchema(
      document.getElementById('tree-editor-auto-fill-root'),
      buildTreeEditorSchema({
        autoFillHeight: true,
        className: 'tree-editor-auto-fill',
        nodeCount: 80,
        nodePrefix: 'Editor node',
      })
    ),
    renderAmisSchema(
      document.getElementById('tree-editor-virtual-root'),
      buildTreeEditorSchema({
        autoFillHeight: true,
        className: 'tree-editor-virtual',
        nodeCount: 160,
        nodePrefix: 'Virtual editor node',
        virtualThreshold: 20,
      })
    ),
    renderAmisSchema(
      document.getElementById('tree-editor-default-root'),
      buildTreeEditorSchema({
        className: 'tree-editor-default',
        nodeCount: 6,
        nodePrefix: 'Default editor node',
      })
    ),
  ])

  window.__INPUT_TREE_AUTO_FILL_HEIGHT_HARNESS__ = {
    ready: true,
    resizeParent(testId, height) {
      const parent = document.querySelector(`[data-testid="${testId}"]`)
      parent.style.height = `${height}px`
    },
  }
  statusElement.textContent = 'Input tree harness ready'
}

mountHarness().catch((error) => {
  console.error(error)
  statusElement.textContent = `Input tree harness failed: ${error.message}`
})
