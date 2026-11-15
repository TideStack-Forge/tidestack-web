const assert = require('node:assert/strict')
const path = require('node:path')

const { registerTypescriptRequire, requireMirroredSrcModule } = require(
  path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit')
)

registerTypescriptRequire()

function loadSchemaKeyOrderModule() {
  return requireMirroredSrcModule(__filename, './schemaKeyOrder.ts')
}

function loadSchemaChangeSourceModule() {
  return requireMirroredSrcModule(__filename, './schemaChangeSource.tsx')
}

test('reorderSchemaLike keeps previous key order and updates values', () => {
  const { reorderSchemaLike } = loadSchemaKeyOrderModule()

  const previous = { type: 'page', title: 'Old', body: [] }
  const next = { body: [{ type: 'tpl', tpl: 'hello' }], title: 'New', type: 'page' }

  const reordered = reorderSchemaLike(previous, next)

  assert.deepEqual(Object.keys(reordered), ['type', 'title', 'body'])
  assert.equal(reordered.title, 'New')
  assert.deepEqual(reordered.body, [{ type: 'tpl', tpl: 'hello' }])
})

test('reorderSchemaLike appends new keys and keeps deleted keys removed', () => {
  const { reorderSchemaLike } = loadSchemaKeyOrderModule()

  const previous = { type: 'page', title: 'Old', className: 'legacy', body: [] }
  const next = { body: [], aside: [], type: 'page' }

  const reordered = reorderSchemaLike(previous, next)

  assert.deepEqual(Object.keys(reordered), ['type', 'body', 'aside'])
  assert.equal(Object.prototype.hasOwnProperty.call(reordered, 'title'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(reordered, 'className'), false)
})

test('reorderSchemaLike recurses through nested objects and arrays by index', () => {
  const { reorderSchemaLike } = loadSchemaKeyOrderModule()

  const previous = {
    type: 'page',
    body: [
      {
        type: 'form',
        title: 'Form',
        body: [{ type: 'input-text', name: 'firstName', label: 'First name' }],
      },
    ],
  }
  const next = {
    body: [
      {
        body: [
          { label: 'Given name', required: true, name: 'firstName', type: 'input-text' },
        ],
        title: 'Form',
        type: 'form',
      },
    ],
    type: 'page',
  }

  const reordered = reorderSchemaLike(previous, next)

  assert.deepEqual(Object.keys(reordered), ['type', 'body'])
  assert.deepEqual(Object.keys(reordered.body[0]), ['type', 'title', 'body'])
  assert.deepEqual(Object.keys(reordered.body[0].body[0]), [
    'type',
    'name',
    'label',
    'required',
  ])
})

test('reorderSchemaLike does not mutate inputs', () => {
  const { reorderSchemaLike } = loadSchemaKeyOrderModule()

  const previous = { type: 'page', title: 'Old', body: [{ type: 'tpl', tpl: 'old' }] }
  const next = { body: [{ tpl: 'new', type: 'tpl' }], type: 'page' }
  const previousSnapshot = JSON.stringify(previous)
  const nextSnapshot = JSON.stringify(next)

  const reordered = reorderSchemaLike(previous, next)

  assert.notEqual(reordered, next)
  assert.notEqual(reordered.body, next.body)
  assert.equal(JSON.stringify(previous), previousSnapshot)
  assert.equal(JSON.stringify(next), nextSnapshot)
})

test('schema change source tracker marks code panel component changes', () => {
  const { createSchemaChangeSourceTracker } = loadSchemaChangeSourceModule()

  const tracker = createSchemaChangeSourceTracker()
  const calls = []
  const OriginalPanel = () => null
  const codePanel = { key: 'code', component: OriginalPanel }

  tracker.decorateOnBuildPanels({ data: [codePanel] })
  const element = codePanel.component({
    onChange: (...args) => calls.push(args),
  })

  element.props.onChange({ type: 'page' }, [{ kind: 'E' }])

  assert.equal(tracker.consume(), 'code')
  assert.equal(tracker.consume(), undefined)
  assert.deepEqual(calls, [[{ type: 'page' }, [{ kind: 'E' }]]])
})

test('schema change source tracker ignores non-code panels', () => {
  const { createSchemaChangeSourceTracker } = loadSchemaChangeSourceModule()

  const tracker = createSchemaChangeSourceTracker()
  const configPanel = {
    key: 'config',
    render: (props) => props,
  }

  tracker.decorateOnBuildPanels({ data: [configPanel] })
  const renderedProps = configPanel.render({ onChange: () => undefined })
  renderedProps.onChange({ type: 'page' })

  assert.equal(tracker.consume(), undefined)
})
