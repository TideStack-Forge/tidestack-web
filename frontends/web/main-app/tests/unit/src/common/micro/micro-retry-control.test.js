const assert = require('node:assert/strict')
const path = require('node:path')
const { requireMirroredSrcModule } = require(path.join(process.cwd(), 'tests/unit/helpers/mainAppTestKit'))

const {
  MAX_MICRO_APP_LOAD_RETRIES,
  canRetryMicroApp,
  getMicroAppLoadState,
  recordMicroAppLoadFailure,
  recordMicroAppLoadFailureByName,
  recordMicroAppMountSuccess,
  recordMicroAppMountSuccessByName,
  registerMicroAppLoadTarget,
  resetMicroAppLoadRetryState,
} = requireMirroredSrcModule(__filename, './loadRetry')

beforeEach(() => {
  resetMicroAppLoadRetryState()
})

test('micro app retries are exhausted after the configured number of failures', () => {
  registerMicroAppLoadTarget('broken-micro', 'route:/broken')

  for (let index = 1; index <= MAX_MICRO_APP_LOAD_RETRIES; index += 1) {
    const state = recordMicroAppLoadFailureByName('broken-micro', new Error(`fail-${index}`))
    assert.equal(state.failures, index)
    assert.equal(state.exhausted, index >= MAX_MICRO_APP_LOAD_RETRIES)
  }

  assert.equal(canRetryMicroApp('route:/broken'), false)
  assert.deepEqual(getMicroAppLoadState('route:/broken'), {
    exhausted: true,
    failures: MAX_MICRO_APP_LOAD_RETRIES,
  })
})

test('a successful mount clears previous failure state', () => {
  registerMicroAppLoadTarget('flaky-micro', 'route:/flaky')
  recordMicroAppLoadFailureByName('flaky-micro', new Error('temporary'))

  recordMicroAppMountSuccessByName('flaky-micro')

  assert.equal(canRetryMicroApp('route:/flaky'), true)
  assert.deepEqual(getMicroAppLoadState('route:/flaky'), {
    exhausted: false,
    failures: 0,
  })
})

test('retry state can be managed directly by retry key', () => {
  for (let index = 1; index <= MAX_MICRO_APP_LOAD_RETRIES; index += 1) {
    const state = recordMicroAppLoadFailure('component-library:/micro-logicflow-editor/')
    assert.equal(state.failures, index)
  }

  assert.equal(canRetryMicroApp('component-library:/micro-logicflow-editor/'), false)

  recordMicroAppMountSuccess('component-library:/micro-logicflow-editor/')

  assert.equal(canRetryMicroApp('component-library:/micro-logicflow-editor/'), true)
  assert.deepEqual(getMicroAppLoadState('component-library:/micro-logicflow-editor/'), {
    exhausted: false,
    failures: 0,
  })
})
