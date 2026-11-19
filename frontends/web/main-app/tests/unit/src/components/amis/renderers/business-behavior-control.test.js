import { test, expect, vi } from 'vitest'
import { renderBusinessBehaviorControl } from 'ouroboros-amis-runtime/renderers/BusinessBehaviorControl'

test('isolated control emits only actual edits and resets its formal AMIS store after cancelled async changes', async () => {
  const render = vi.fn(),
    change = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(undefined)
  renderBusinessBehaviorControl(
    render,
    'subject',
    { type: 'button-group-select' },
    { value: 'instance', onChange: change }
  )
  const [, schema, props] = render.mock.lastCall
  expect(schema.inheritData).toBe(false)
  expect(schema.formLazyChange).toBe(false)
  const store = { changeValue: vi.fn() }
  await props.onChange({ value: 'instance' }, {}, { store })
  expect(change).not.toHaveBeenCalled()
  await props.onChange({ value: 'model' }, {}, { store })
  expect(store.changeValue).toHaveBeenCalledWith('value', 'instance')
  store.changeValue.mockClear()
  await props.onChange({ value: 'model' }, {}, { store })
  expect(store.changeValue).not.toHaveBeenCalled()
})
