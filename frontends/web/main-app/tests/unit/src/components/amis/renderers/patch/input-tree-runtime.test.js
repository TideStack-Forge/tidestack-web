/* @vitest-environment jsdom */

const assert = require('node:assert/strict')
const path = require('node:path')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()
require.extensions['.scss'] = () => undefined

function loadInputTreeModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './InputTree.tsx')
}

function findTreeElement(node) {
  if (!node || typeof node !== 'object') return null
  if (node.props?.draggable !== undefined && node.props?.onMove) return node

  const children = node.props?.children
  if (!children) return null
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findTreeElement(child)
    if (found) return found
  }
  return null
}

function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return null
  if (predicate(node)) return node

  const children = node.props?.children
  if (!children) return null
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findElement(child, predicate)
    if (found) return found
  }
  return null
}

test('input-tree forwards native drag support and publishes the drop payload', async () => {
  const { default: OuroborosInputTreeControl } = loadInputTreeModule()
  const events = []
  const control = Object.create(OuroborosInputTreeControl.prototype)
  control.props = {
    options: [],
    value: '',
    classnames: (value) => value,
    translate: (value) => value,
    dispatchEvent: async (...args) => {
      events.push(args)
      return undefined
    },
    draggable: true,
    inputValue: '',
  }
  control.state = { filteredOptions: [], keyword: '', allowSearch: false }

  const tree = findTreeElement(control.render())
  assert.ok(tree)
  assert.equal(tree.props.draggable, true)

  const dropInfo = {
    dragNode: { id: 'source-node' },
    node: { id: 'target-node' },
    position: 'self',
  }
  await tree.props.onMove(dropInfo)

  assert.equal(events.length, 1)
  assert.equal(events[0][0], 'move')
  assert.deepEqual(events[0][1], dropInfo)
})

test('input-tree keeps the native drag support disabled for a false expression result', () => {
  const { default: OuroborosInputTreeControl } = loadInputTreeModule()
  const control = Object.create(OuroborosInputTreeControl.prototype)
  control.props = {
    options: [],
    value: '',
    classnames: (value) => value,
    translate: (value) => value,
    dispatchEvent: async () => undefined,
    draggable: 'false',
    inputValue: '',
  }
  control.state = { filteredOptions: [], keyword: '', allowSearch: false }

  const tree = findTreeElement(control.render())
  assert.equal(tree, null)
})

test('input-tree resolves the schema expression against the renderer data', async () => {
  const { default: OuroborosInputTreeControl } = loadInputTreeModule()
  const events = []
  const control = Object.create(OuroborosInputTreeControl.prototype)
  control.props = {
    options: [],
    value: '',
    classnames: (value) => value,
    translate: (value) => value,
    dispatchEvent: async (...args) => {
      events.push(args)
      return undefined
    },
    draggable: '${treeEditMode}',
    data: { treeEditMode: true },
    inputValue: '',
  }
  control.state = { filteredOptions: [], keyword: '', allowSearch: false }

  const tree = findTreeElement(control.render())
  assert.ok(tree)
  assert.equal(tree.props.draggable, true)
})

test('input-tree fills its bounded container without replacing native tree classes', () => {
  const { default: OuroborosInputTreeControl } = loadInputTreeModule()
  const control = Object.create(OuroborosInputTreeControl.prototype)
  control.props = {
    options: [],
    value: '',
    classPrefix: 'cxd-',
    classnames: (value) => value,
    translate: (value) => value,
    dispatchEvent: async () => undefined,
    autoFillHeight: true,
    heightAuto: true,
    treeContainerClassName: 'business-tree-container',
    treeClassName: 'business-tree',
    inputValue: '',
  }
  control.state = { filteredOptions: [], keyword: '', allowSearch: false }

  const rendered = control.render()
  const treeControl = findElement(rendered, (node) =>
    node.props?.className?.split(/\s+/).includes('cxd-TreeControl')
  )
  const tree = findElement(
    rendered,
    (node) =>
      node.props?.treeClassName === undefined &&
      node.props?.className === 'business-tree' &&
      Object.prototype.hasOwnProperty.call(node.props, 'options')
  )

  assert.ok(treeControl)
  assert.match(treeControl.props.className, /\bbusiness-tree-container\b/)
  assert.match(treeControl.props.className, /\bcxd-TreeControl--autoFillHeight\b/)
  assert.match(treeControl.props.className, /\bh-auto\b/)
  assert.ok(tree)
  assert.equal(tree.props.className, 'business-tree')
  assert.equal(tree.props.draggable, undefined)
})

test('input-tree leaves native height behavior untouched by default', () => {
  const { default: OuroborosInputTreeControl } = loadInputTreeModule()
  const control = Object.create(OuroborosInputTreeControl.prototype)
  control.props = {
    options: [],
    value: '',
    classPrefix: 'cxd-',
    classnames: (value) => value,
    translate: (value) => value,
    dispatchEvent: async () => undefined,
    inputValue: '',
  }
  control.state = { filteredOptions: [], keyword: '', allowSearch: false }

  const treeControl = findElement(control.render(), (node) =>
    node.props?.className?.split(/\s+/).includes('cxd-TreeControl')
  )

  assert.ok(treeControl)
  assert.doesNotMatch(treeControl.props.className, /autoFillHeight/)
})
