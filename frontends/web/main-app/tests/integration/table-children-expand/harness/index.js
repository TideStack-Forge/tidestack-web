import React from 'react'
import ReactDOM from 'react-dom'

import { renderAmisSchema } from '@/components/amis/AmisComponent'

window.React = React
window.ReactDOM = ReactDOM

const statusElement = document.getElementById('table-children-expand-playwright-status')
const editorRoot = document.getElementById('table-children-expand-editor-root')

let rendered = null

const fixtureItems = [
  {
    id: 'parent-alpha',
    path: 'fixture/parent-alpha',
    name: 'Parent Alpha',
    children: [
      {
        id: 'child-alpha-1',
        path: 'fixture/parent-alpha/child-one',
        name: 'Child Alpha One',
        children: [
          {
            id: 'grandchild-alpha-1',
            path: 'fixture/parent-alpha/child-one/grandchild-one',
            name: 'Grandchild Alpha One',
            children: [
              {
                id: 'great-grandchild-alpha-1',
                path: 'fixture/parent-alpha/child-one/grandchild-one/great-grandchild-one',
                name: 'Great Grandchild Alpha One',
              },
            ],
          },
          {
            id: 'grandchild-alpha-2',
            path: 'fixture/parent-alpha/child-one/grandchild-two',
            name: 'Grandchild Alpha Two',
          },
        ],
      },
      {
        id: 'child-alpha-2',
        path: 'fixture/parent-alpha/child-two',
        name: 'Child Alpha Two',
      },
    ],
  },
  {
    id: 'parent-beta',
    path: 'fixture/parent-beta',
    name: 'Parent Beta',
    children: [
      {
        id: 'child-beta-1',
        path: 'fixture/parent-beta/child-one',
        name: 'Child Beta One',
      },
    ],
  },
  {
    id: 'leaf-gamma',
    path: 'fixture/leaf-gamma',
    name: 'Leaf Gamma',
  },
]

function buildSchema(iteration) {
  return {
    type: 'page',
    title: `Table Children Expand ${iteration}`,
    data: {
      items: fixtureItems,
    },
    body: [
      {
        type: 'table',
        id: 'tableChildrenExpandTarget',
        name: 'tableChildrenExpandTarget',
        className: 'table-children-expand-target',
        source: '$items',
        columns: [
          {
            name: 'path',
            label: 'Path',
            type: 'text',
          },
          {
            name: 'name',
            label: 'Name',
            type: 'text',
          },
        ],
      },
    ],
  }
}

function readRows() {
  return Array.from(document.querySelectorAll('.table-children-expand-target table tbody tr')).map(
    (row, rowIndex) => ({
      rowIndex,
      className: row.className,
      text: (row.innerText || '').replace(/\s+/g, ' ').trim(),
    })
  )
}

async function renderScenario(options = {}) {
  const iteration = options.iteration ?? 1

  rendered?.destroy?.()
  rendered = null
  editorRoot.innerHTML = ''
  statusElement.textContent = `Rendering table children expand iteration ${iteration}...`

  rendered = await renderAmisSchema(editorRoot, buildSchema(iteration), {})
  statusElement.textContent = `Table children expand iteration ${iteration} ready`

  return {
    iteration,
    rows: readRows(),
    fixtureItems,
  }
}

window.__TABLE_CHILDREN_EXPAND_PLAYWRIGHT_HARNESS__ = {
  ready: true,
  renderScenario,
  readRows,
  parentPath: fixtureItems[0].path,
  childPath: fixtureItems[0].children[0].path,
  grandchildPath: fixtureItems[0].children[0].children[0].path,
  greatGrandchildPath: fixtureItems[0].children[0].children[0].children[0].path,
  expectedCollapsedCount: fixtureItems.length,
}

statusElement.textContent = 'Table children expand harness ready'
