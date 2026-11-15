import { expect, test, vi } from 'vitest'

vi.mock('amis', () => ({ FormItem: () => (component) => component }))
import JsonDataEditor from '@/components/amis/renderers/JsonDataEditor'

test('dynamic behavior arrays remain structured values and reject other roots', () => {
  const onChange = vi.fn()
  const editor = new JsonDataEditor({ allowValueTypes: 'array', onChange, value: [] })
  editor.handleChange('[{"name":"approve"}]')
  expect(onChange).toHaveBeenCalledWith([{ name: 'approve' }], undefined, true)
  expect(editor.handleValidate('[{"name":"approve"}]')).toBe('')
  expect(editor.handleValidate('{}')).toBe('数据类型错误')
  expect(editor.handleValidate('null')).toBe('数据类型错误')
  expect(editor.handleValidate('[')).toBe('格式错误')
  editor.handleChange('[')
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(editor.validate()).toBe('格式错误')
  editor.handleChange('[]')
  expect(editor.validate()).toBe('')
})

test('object inputs keep explicit nulls while the configured root remains enforced', () => {
  const onChange = vi.fn()
  const editor = new JsonDataEditor({ allowValueTypes: 'object', onChange, value: {} })
  editor.handleChange('{"params":null,"data":{"amount":3}}')
  expect(onChange).toHaveBeenCalledWith(
    { params: null, data: { amount: 3 } },
    undefined,
    true
  )
  expect(editor.handleValidate('[]')).toBe('数据类型错误')
  expect(editor.handleValidate('{}')).toBe('')
})

test('parent echoes preserve raw edits while an explicit external reset replaces them', () => {
  const render = vi.fn(),
    onChange = vi.fn()
  const editor = new JsonDataEditor({
    allowValueTypes: 'array',
    value: [],
    onChange,
    render,
  })
  editor.setState = (patch) => {
    editor.state = { ...editor.state, ...patch }
  }
  const raw = '[ { "name": "approved", "future": {"keep":true} } ]'
  editor.handleChange(raw)
  const previous = editor.props
  editor.props = { ...previous, value: JSON.parse(raw) }
  editor.componentDidUpdate(previous)
  editor.render()
  expect(render.mock.lastCall[2].data.jsonData).toBe(raw)
  editor.handleChange('[')
  const beforeClone = editor.props
  editor.props = { ...beforeClone, value: JSON.parse(raw) }
  editor.componentDidUpdate(beforeClone)
  expect(editor.validate()).toBe('格式错误')
  const beforeReset = editor.props
  editor.props = { ...beforeReset, value: [] }
  editor.componentDidUpdate(beforeReset)
  expect(editor.validate()).toBe('')
  editor.render()
  expect(render.mock.lastCall[2].data.jsonData).toBe('[]')
})

test('schema hints and diagnostics are scoped to each editor and released independently', () => {
  const defaults = {
    diagnosticsOptions: {
      schemas: [{ uri: 'existing', fileMatch: ['other'], schema: {} }],
    },
    setDiagnosticsOptions(value) {
      this.diagnosticsOptions = value
    },
  }
  const monaco = { languages: { json: { jsonDefaults: defaults } } }
  const first = new JsonDataEditor({ jsonSchema: { type: 'array' }, value: [] })
  const second = new JsonDataEditor({ jsonSchema: { type: 'object' }, value: {} })
  const editor = (uri) => ({ getModel: () => ({ uri: { toString: () => uri } }) })
  const releaseFirst = first.handleEditorMounted(editor('first'), monaco)
  const releaseSecond = second.handleEditorMounted(editor('second'), monaco)
  expect(defaults.diagnosticsOptions.schemas[1]).toEqual({
    uri: 'first/schema',
    fileMatch: ['first'],
    schema: { type: 'array' },
  })
  releaseFirst()
  expect(defaults.diagnosticsOptions.schemas.map((schema) => schema.uri)).toEqual([
    'existing',
    'second/schema',
  ])
  releaseSecond()
  expect(defaults.diagnosticsOptions.schemas.map((schema) => schema.uri)).toEqual([
    'existing',
  ])
})

test('input-state notifications invalidate old checks even while malformed JSON cannot change metadata', () => {
  const onInputStateChange = vi.fn(),
    onChange = vi.fn()
  const editor = new JsonDataEditor({
    value: {},
    allowValueTypes: 'object',
    onChange,
    onInputStateChange,
  })
  editor.handleChange('{')
  expect(onInputStateChange).toHaveBeenLastCalledWith('格式错误')
  expect(onChange).not.toHaveBeenCalled()
  editor.handleChange('{}')
  expect(onInputStateChange).toHaveBeenLastCalledWith('')
  expect(editor.validate()).toBe('')
})

test('empty initialization of an absent optional value stays absent and does not mark the form invalid', () => {
  const editor = new JsonDataEditor({
    value: undefined,
    allowValueTypes: 'object',
    onChange: vi.fn(),
    onInputStateChange: vi.fn(),
  })
  editor.handleChange(undefined)
  editor.handleChange('')
  expect(editor.validate()).toBe('')
  expect(editor.props.onChange).not.toHaveBeenCalled()
  expect(editor.props.onInputStateChange).not.toHaveBeenCalled()
  editor.handleChange('{')
  expect(editor.props.onInputStateChange).toHaveBeenLastCalledWith('格式错误')
})
