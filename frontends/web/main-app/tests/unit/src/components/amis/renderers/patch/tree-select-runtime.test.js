/* @vitest-environment jsdom */

const assert = require('node:assert/strict')
const path = require('node:path')

const {
  clearMirroredSrcModuleCache,
  registerTypescriptRequire,
  requireMirroredSrcModule,
} = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

registerTypescriptRequire()

function loadTreeSelectModule() {
  clearMirroredSrcModuleCache(__filename, '.')
  return requireMirroredSrcModule(__filename, './TreeSelect.tsx')
}

function createLifecycleHarness(FixedTreeSelector) {
  const options = []
  const selector = Object.create(FixedTreeSelector.prototype)
  selector.props = { value: 'option-b', options }
  selector.state = {
    value: ['option-a'],
    valueSet: new Set(['option-a']),
  }
  selector.setState = () => undefined
  selector.forceVirtualListRerender = () => {
    selector.virtualListRerenderCount += 1
  }
  selector.virtualListRerenderCount = 0

  return { options, selector }
}

test('TreeSelect refreshes the virtual list after external value state settles', () => {
  const { FixedTreeSelector } = loadTreeSelectModule()
  const { options, selector } = createLifecycleHarness(FixedTreeSelector)
  const previousProps = { value: 'option-a', options }
  const previousState = {
    value: ['option-a'],
    valueSet: new Set(['option-a']),
  }

  selector.componentDidUpdate(previousProps, previousState)
  assert.equal(selector.virtualListRerenderCount, 1)

  selector.state = {
    value: ['option-b'],
    valueSet: new Set(['option-b']),
  }
  selector.componentDidUpdate(selector.props, previousState)

  assert.equal(
    selector.virtualListRerenderCount,
    2,
    'the second lifecycle pass must refresh rows with the settled selection'
  )
})

test('TreeSelect forwards native drag support and publishes the drop payload', async () => {
  const {default: OptimizedTreeSelectControl} = loadTreeSelectModule()
  const events = []
  const control = Object.create(OptimizedTreeSelectControl.prototype)
  control.props = {
    options: [],
    value: '',
    classnames: value => value,
    translate: value => value,
    dispatchEvent: async (...args) => {
      events.push(args)
      return undefined
    },
    searchable: false,
    draggable: true,
    inputValue: '',
  }
  control.state = {inputValue: ''}

  const tree = control.renderOuter()
  assert.equal(tree.props.draggable, true)

  const dropInfo = {
    dragNode: {id: 'source-node'},
    node: {id: 'target-node'},
    position: 'self',
  }
  await tree.props.onMove(dropInfo)

  assert.equal(events.length, 1)
  assert.equal(events[0][0], 'move')
  assert.deepEqual(events[0][1], dropInfo)
})
